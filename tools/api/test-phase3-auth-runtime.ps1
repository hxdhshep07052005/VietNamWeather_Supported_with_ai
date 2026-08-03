param(
    [string]$RuntimeEnvPath = '.env.local',
    [string]$AdminEnvPath = '.env.admin.local'
)

$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [Text.Encoding]::UTF8
$workspaceRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path

function Read-EnvironmentFile {
    param([string]$Path)
    $values = @{}
    Get-Content -LiteralPath $Path | ForEach-Object {
        if ($_ -match '^([A-Za-z_][A-Za-z0-9_]*)=(.*)$') { $values[$Matches[1]] = $Matches[2] }
    }
    return $values
}

function New-RandomBase64Url {
    param([ValidateRange(16, 128)][int]$ByteCount)
    $bytes = New-Object byte[] $ByteCount
    $generator = [Security.Cryptography.RandomNumberGenerator]::Create()
    try { $generator.GetBytes($bytes) } finally { $generator.Dispose() }
    return [Convert]::ToBase64String($bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_')
}

function Get-CookiePair {
    param($Response, [string]$Name)
    $headerValues = @($Response.SetCookies)
    foreach ($headerValue in $headerValues) {
        foreach ($segment in @([string]$headerValue -split ', (?=__Host-)')) {
            if ($segment.StartsWith("$Name=", [StringComparison]::Ordinal)) {
                return ([string]$segment -split ';', 2)[0]
            }
        }
    }
    throw "Missing response cookie: $Name"
}

Add-Type -AssemblyName System.Net.Http
$apiHandler = New-Object System.Net.Http.HttpClientHandler
$apiHandler.UseCookies = $false
$apiHandler.AllowAutoRedirect = $false
$apiClient = New-Object System.Net.Http.HttpClient -ArgumentList $apiHandler
$apiClient.Timeout = [TimeSpan]::FromSeconds(20)

function Invoke-ApiRequest {
    param(
        [string]$Method,
        [string]$Uri,
        [hashtable]$Headers = @{},
        [string]$Body = ''
    )
    $request = New-Object System.Net.Http.HttpRequestMessage -ArgumentList ([System.Net.Http.HttpMethod]::new($Method)), $Uri
    try {
        foreach ($entry in $Headers.GetEnumerator()) {
            if (-not $request.Headers.TryAddWithoutValidation([string]$entry.Key, [string]$entry.Value)) {
                throw "Unable to add API request header: $($entry.Key)"
            }
        }
        if (-not [string]::IsNullOrEmpty($Body)) {
            $request.Content = New-Object System.Net.Http.StringContent -ArgumentList $Body, ([Text.Encoding]::UTF8), 'application/json'
        }
        $response = $apiClient.SendAsync($request).GetAwaiter().GetResult()
        try {
            $content = $response.Content.ReadAsStringAsync().GetAwaiter().GetResult()
            $setCookies = New-Object Collections.Generic.List[string]
            $values = $null
            if ($response.Headers.TryGetValues('Set-Cookie', [ref]$values)) {
                foreach ($value in $values) { $setCookies.Add([string]$value) }
            }
            return [pscustomobject]@{
                StatusCode = [int]$response.StatusCode
                Content = $content
                SetCookies = @($setCookies)
            }
        }
        finally { $response.Dispose() }
    }
    finally { $request.Dispose() }
}

$runtime = Read-EnvironmentFile (Join-Path $workspaceRoot $RuntimeEnvPath)
$admin = Read-EnvironmentFile (Join-Path $workspaceRoot $AdminEnvPath)

function Clear-LocalApiRateLimitState {
    # Isolate the drill from earlier local requests without changing production limits.
    if ([IO.Path]::GetFileName($RuntimeEnvPath) -ne '.env.local') {
        throw 'Rate-limit state cleanup is restricted to .env.local.'
    }
    $command = 'for key in $(REDISCLI_AUTH="$REDIS_PASSWORD" redis-cli -n 1 --no-auth-warning --scan --pattern ''fastify-rate-limit-*''); do REDISCLI_AUTH="$REDIS_PASSWORD" redis-cli -n 1 --no-auth-warning DEL "$key" >/dev/null; done'
    docker compose --env-file $RuntimeEnvPath exec -T redis sh -c $command | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'Unable to isolate local API rate-limit state.' }
}

$directusBaseUrl = "http://127.0.0.1:$($runtime['DIRECTUS_HOST_PORT'])"
$apiBaseUrl = "http://localhost:$($runtime['API_HOST_PORT'])"
$origin = $apiBaseUrl
$manifest = Get-Content -LiteralPath (Join-Path $workspaceRoot 'apps\directus\security\phase3-default-deny.json') -Raw | ConvertFrom-Json
$travelerRole = @($manifest.roles | Where-Object key -eq 'registered_traveler')
if ($travelerRole.Count -ne 1) { throw 'Registered Traveler role is missing or duplicated.' }
$serviceRole = @($manifest.roles | Where-Object key -eq 'weather_ingestion_service')
if ($serviceRole.Count -ne 1) { throw 'Weather Ingestion Service role is missing or duplicated.' }

function New-ApplicationSession {
    param([Parameter(Mandatory = $true)][string]$Password)

    $csrfResponse = Invoke-ApiRequest -Method Get -Uri "$apiBaseUrl/api/v1/auth/csrf"
    if ($csrfResponse.StatusCode -ne 200) { throw 'CSRF endpoint failed during identity revocation drill.' }
    $csrfBody = $csrfResponse.Content | ConvertFrom-Json
    $csrfToken = [string]$csrfBody.data.csrfToken
    $csrfCookie = Get-CookiePair $csrfResponse $runtime['API_CSRF_COOKIE_NAME']

    $loginResponse = Invoke-ApiRequest -Method Post -Uri "$apiBaseUrl/api/v1/auth/login" -Headers @{
        Origin = $origin
        Cookie = $csrfCookie
        'X-CSRF-Token' = $csrfToken
    } -Body (@{ email = $userEmail; password = $Password } | ConvertTo-Json)
    if ($loginResponse.StatusCode -ne 200) {
        $failureCode = ''
        try { $failureCode = [string](($loginResponse.Content | ConvertFrom-Json).error.code) } catch {}
        throw "Application API login failed during identity revocation drill status=$($loginResponse.StatusCode) code=$failureCode"
    }
    if ($loginResponse.Content -match '(?i)access_token|refresh_token|bearer\s|directus_access|directus_refresh') {
        throw 'Identity revocation drill login exposed backend token material.'
    }
    return [pscustomobject]@{
        SessionCookie = Get-CookiePair $loginResponse $runtime['API_SESSION_COOKIE_NAME']
    }
}

function Assert-IdentitySessionRevoked {
    param(
        [Parameter(Mandatory = $true)][string]$SessionCookie,
        [Parameter(Mandatory = $true)]
        [ValidateSet('identity_password_changed', 'identity_status_changed', 'identity_role_changed')]
        [string]$Reason
    )

    $databaseEvidence = docker compose --env-file $RuntimeEnvPath exec -T database psql -At -v ON_ERROR_STOP=1 `
        -U $runtime['DB_USER'] -d $runtime['DB_DATABASE'] `
        -c "SELECT COUNT(*) FROM app_security.sessions WHERE user_id = '$userId' AND revoked_at IS NOT NULL AND revoke_reason = '$Reason';"
    if ($LASTEXITCODE -ne 0 -or [int]([string]$databaseEvidence).Trim() -ne 1) {
        throw "Identity change did not revoke exactly one active application session: $Reason"
    }
    $response = Invoke-ApiRequest -Method Get -Uri "$apiBaseUrl/api/v1/auth/me" -Headers @{ Cookie = $SessionCookie }
    if ($response.StatusCode -ne 401) { throw "Revoked identity session remained usable: $Reason" }
}

$adminLogin = $null
$userId = $null
$userPassword = New-RandomBase64Url 24
$userEmail = "phase3-auth-$([Guid]::NewGuid().ToString('N'))@example.com"

Push-Location $workspaceRoot
try {
    Clear-LocalApiRateLimitState
    $adminLogin = Invoke-RestMethod -Method Post -Uri "$directusBaseUrl/auth/login" -ContentType 'application/json' -Body (@{
        email = $admin['DIRECTUS_ADMIN_EMAIL']
        password = $admin['DIRECTUS_ADMIN_PASSWORD']
        mode = 'json'
    } | ConvertTo-Json) -TimeoutSec 20
    if ([string]::IsNullOrWhiteSpace($adminLogin.data.access_token)) { throw 'Directus admin login failed.' }
    $adminHeaders = @{ Authorization = "Bearer $($adminLogin.data.access_token)" }

    $createdUser = Invoke-RestMethod -Method Post -Uri "$directusBaseUrl/users" -Headers $adminHeaders -ContentType 'application/json' -Body (@{
        email = $userEmail
        password = $userPassword
        role = [string]$travelerRole[0].id
        status = 'active'
    } | ConvertTo-Json) -TimeoutSec 20
    $userId = [string]$createdUser.data.id
    if ([string]::IsNullOrWhiteSpace($userId)) { throw 'Ephemeral traveler creation failed.' }

    $csrfResponse = Invoke-ApiRequest -Method Get -Uri "$apiBaseUrl/api/v1/auth/csrf"
    $csrfBody = $csrfResponse.Content | ConvertFrom-Json
    $csrfToken = [string]$csrfBody.data.csrfToken
    $csrfCookie = Get-CookiePair $csrfResponse $runtime['API_CSRF_COOKIE_NAME']
    if ([string]::IsNullOrWhiteSpace($csrfToken)) { throw 'CSRF endpoint returned no token.' }

    $loginResponse = Invoke-ApiRequest -Method Post -Uri "$apiBaseUrl/api/v1/auth/login" -Headers @{
        Origin = $origin
        Cookie = $csrfCookie
        'X-CSRF-Token' = $csrfToken
    } -Body (@{ email = $userEmail; password = $userPassword } | ConvertTo-Json)
    if ($loginResponse.StatusCode -ne 200) {
        $failureCode = ''
        try { $failureCode = [string](($loginResponse.Content | ConvertFrom-Json).error.code) } catch {}
        throw "Application API login failed status=$($loginResponse.StatusCode) code=$failureCode"
    }
    if ($loginResponse.Content -match '(?i)access_token|refresh_token|bearer\s|directus_access|directus_refresh') {
        throw 'Application API login response exposed backend token material.'
    }
    $sessionCookie = Get-CookiePair $loginResponse $runtime['API_SESSION_COOKIE_NAME']
    $loginCsrfCookie = Get-CookiePair $loginResponse $runtime['API_CSRF_COOKIE_NAME']
    $loginBody = $loginResponse.Content | ConvertFrom-Json
    $loginCsrfToken = [string]$loginBody.data.csrfToken

    $meResponse = Invoke-ApiRequest -Method Get -Uri "$apiBaseUrl/api/v1/auth/me" -Headers @{ Cookie = $sessionCookie }
    $meBody = $meResponse.Content | ConvertFrom-Json
    if ([string]$meBody.data.user.id -ne $userId) { throw 'Application API session resolved the wrong user.' }

    $refreshResponse = Invoke-ApiRequest -Method Post -Uri "$apiBaseUrl/api/v1/auth/refresh" -Headers @{
        Origin = $origin
        Cookie = "$sessionCookie; $loginCsrfCookie"
        'X-CSRF-Token' = $loginCsrfToken
    }
    $rotatedSessionCookie = Get-CookiePair $refreshResponse $runtime['API_SESSION_COOKIE_NAME']
    if ($rotatedSessionCookie -eq $sessionCookie) { throw 'Application session handle was not rotated.' }
    $refreshCsrfCookie = Get-CookiePair $refreshResponse $runtime['API_CSRF_COOKIE_NAME']
    $refreshBody = $refreshResponse.Content | ConvertFrom-Json
    $refreshCsrfToken = [string]$refreshBody.data.csrfToken

    $replayResponse = Invoke-ApiRequest -Method Get -Uri "$apiBaseUrl/api/v1/auth/me" -Headers @{ Cookie = $sessionCookie }
    if ($replayResponse.StatusCode -ne 401) { throw 'Rotated session handle replay was not denied.' }

    $csrfDeniedResponse = Invoke-ApiRequest -Method Post -Uri "$apiBaseUrl/api/v1/auth/logout" -Headers @{
        Origin = $origin
        Cookie = $rotatedSessionCookie
    }
    if ($csrfDeniedResponse.StatusCode -ne 403) { throw 'Mutation without CSRF token was not denied.' }

    $logoutResponse = Invoke-ApiRequest -Method Post -Uri "$apiBaseUrl/api/v1/auth/logout" -Headers @{
        Origin = $origin
        Cookie = "$rotatedSessionCookie; $refreshCsrfCookie"
        'X-CSRF-Token' = $refreshCsrfToken
    }
    if ($logoutResponse.StatusCode -ne 204) { throw 'Application API logout failed.' }

    $revokedResponse = Invoke-ApiRequest -Method Get -Uri "$apiBaseUrl/api/v1/auth/me" -Headers @{ Cookie = $rotatedSessionCookie }
    if ($revokedResponse.StatusCode -ne 401) { throw 'Logged-out session remained valid.' }

    $passwordSession = New-ApplicationSession -Password $userPassword
    $replacementPassword = New-RandomBase64Url 24
    Invoke-RestMethod -Method Patch -Uri "$directusBaseUrl/users/$userId" -Headers $adminHeaders -ContentType 'application/json' `
        -Body (@{ password = $replacementPassword } | ConvertTo-Json) -TimeoutSec 20 | Out-Null
    Assert-IdentitySessionRevoked -SessionCookie $passwordSession.SessionCookie -Reason identity_password_changed
    $userPassword = $replacementPassword

    $statusSession = New-ApplicationSession -Password $userPassword
    Invoke-RestMethod -Method Patch -Uri "$directusBaseUrl/users/$userId" -Headers $adminHeaders -ContentType 'application/json' `
        -Body (@{ status = 'suspended' } | ConvertTo-Json) -TimeoutSec 20 | Out-Null
    Assert-IdentitySessionRevoked -SessionCookie $statusSession.SessionCookie -Reason identity_status_changed
    Invoke-RestMethod -Method Patch -Uri "$directusBaseUrl/users/$userId" -Headers $adminHeaders -ContentType 'application/json' `
        -Body (@{ status = 'active' } | ConvertTo-Json) -TimeoutSec 20 | Out-Null

    $roleSession = New-ApplicationSession -Password $userPassword
    Invoke-RestMethod -Method Patch -Uri "$directusBaseUrl/users/$userId" -Headers $adminHeaders -ContentType 'application/json' `
        -Body (@{ role = [string]$serviceRole[0].id } | ConvertTo-Json) -TimeoutSec 20 | Out-Null
    Assert-IdentitySessionRevoked -SessionCookie $roleSession.SessionCookie -Reason identity_role_changed
    Invoke-RestMethod -Method Patch -Uri "$directusBaseUrl/users/$userId" -Headers $adminHeaders -ContentType 'application/json' `
        -Body (@{ role = [string]$travelerRole[0].id } | ConvertTo-Json) -TimeoutSec 20 | Out-Null

    $dbEvidence = docker compose --env-file $RuntimeEnvPath exec -T database psql -At -v ON_ERROR_STOP=1 -U $runtime['DB_USER'] -d $runtime['DB_DATABASE'] -c "SELECT COUNT(*) FILTER (WHERE revoked_at IS NOT NULL), COUNT(*) FILTER (WHERE directus_access_token_ciphertext LIKE 'v1.%' AND directus_refresh_token_ciphertext LIKE 'v1.%'), COUNT(*) FROM app_security.sessions WHERE user_id = '$userId';"
    if ($LASTEXITCODE -ne 0 -or $dbEvidence.Trim() -ne '4|4|4') { throw 'Session revocation/encryption database evidence failed.' }
    $auditEvidence = docker compose --env-file $RuntimeEnvPath exec -T database psql -At -v ON_ERROR_STOP=1 -U $runtime['DB_USER'] -d $runtime['DB_DATABASE'] -c "SELECT COUNT(*) FROM app_security.audit_events WHERE actor_user_id = '$userId' AND result = 'success' AND event_type IN ('auth.login', 'auth.refresh', 'auth.logout');"
    if ($LASTEXITCODE -ne 0 -or [int]$auditEvidence.Trim() -lt 6) { throw 'Security audit evidence is incomplete.' }

    $databaseContainerId = (docker compose --env-file $RuntimeEnvPath ps -q database).Trim()
    if ([string]::IsNullOrWhiteSpace($databaseContainerId)) { throw 'Database container is not running.' }
    $remoteCheckPath = "/tmp/api-db-denial-$([Guid]::NewGuid().ToString('N')).sh"
    try {
        docker cp (Join-Path $workspaceRoot 'tools\api\check-api-db-denial.sh') "${databaseContainerId}:$remoteCheckPath" | Out-Null
        if ($LASTEXITCODE -ne 0) { throw 'Unable to copy API database denial check.' }
        docker exec $databaseContainerId sh $remoteCheckPath | Out-Null
        if ($LASTEXITCODE -ne 0) { throw 'Application API database least-privilege check failed.' }
    }
    finally {
        docker exec $databaseContainerId rm -f $remoteCheckPath 2>$null | Out-Null
    }

    $apiLogs = docker compose --env-file $RuntimeEnvPath logs --no-color --tail 200 api | Out-String
    if ($apiLogs -match '(?i)access_token|refresh_token|directus_secret|api_session_encryption_key|set-cookie') {
        throw 'Application API logs contain sensitive token or secret markers.'
    }

    Write-Output 'PHASE3_AUTH_RUNTIME_TEST_OK login=true refresh_rotation=true replay_denied=true csrf_denied=true logout_revoke=true password_change_revoke=true status_change_revoke=true role_change_revoke=true encrypted_tokens=true audit_events=6 api_db_least_privilege=true log_redaction=true browser_tokens_exposed=false secrets_printed=false'
}
finally {
    if ($null -ne $adminLogin -and -not [string]::IsNullOrWhiteSpace($userId)) {
        try {
            Invoke-RestMethod -Method Delete -Uri "$directusBaseUrl/users/$userId" -Headers @{ Authorization = "Bearer $($adminLogin.data.access_token)" } -TimeoutSec 20 | Out-Null
        } catch {}
        try {
            docker compose --env-file $RuntimeEnvPath exec -T database psql -v ON_ERROR_STOP=1 -U $runtime['DB_USER'] -d $runtime['DB_DATABASE'] -c "DELETE FROM app_security.audit_events WHERE actor_user_id = '$userId'; DELETE FROM app_security.sessions WHERE user_id = '$userId';" | Out-Null
        } catch {}
    }
    if ($null -ne $adminLogin -and -not [string]::IsNullOrWhiteSpace($adminLogin.data.refresh_token)) {
        try {
            Invoke-RestMethod -Method Post -Uri "$directusBaseUrl/auth/logout" -ContentType 'application/json' -Body (@{ refresh_token = $adminLogin.data.refresh_token; mode = 'json' } | ConvertTo-Json) -TimeoutSec 20 | Out-Null
        } catch {}
    }
    try { Clear-LocalApiRateLimitState } catch {}
    $apiClient.Dispose()
    $apiHandler.Dispose()
    Pop-Location
}
