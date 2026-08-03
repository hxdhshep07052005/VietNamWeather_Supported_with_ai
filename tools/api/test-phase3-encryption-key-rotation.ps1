param(
    [string]$RuntimeEnvPath = '.env.local',
    [string]$AdminEnvPath = '.env.admin.local',
    [switch]$ApplyLocalRotation,
    [switch]$SkipBuild
)

$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [Text.Encoding]::UTF8
$workspaceRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$runtimeFullPath = [IO.Path]::GetFullPath((Join-Path $workspaceRoot $RuntimeEnvPath))
$workspacePrefix = $workspaceRoot.TrimEnd('\') + '\'
if (-not $runtimeFullPath.StartsWith($workspacePrefix, [StringComparison]::OrdinalIgnoreCase)) {
    throw 'Runtime environment path must remain inside the workspace.'
}
if ([IO.Path]::GetFileName($RuntimeEnvPath) -ne '.env.local') {
    throw 'The key-rotation drill is restricted to the local environment.'
}

function Read-EnvironmentFile {
    param([string]$Path)
    $values = [ordered]@{}
    Get-Content -LiteralPath $Path | ForEach-Object {
        if ($_ -match '^([A-Za-z_][A-Za-z0-9_]*)=(.*)$') { $values[$Matches[1]] = $Matches[2] }
    }
    return $values
}

function Set-EnvironmentValue {
    param([string]$Path, [string]$Name, [string]$Value)
    $found = $false
    $content = Get-Content -LiteralPath $Path | ForEach-Object {
        if ($_ -match "^$([regex]::Escape($Name))=") {
            $found = $true
            "$Name=$Value"
        }
        else {
            $_
        }
    }
    if (-not $found) { throw "Missing environment value: $Name" }
    $content = ($content -join "`n") + "`n"
    [IO.File]::WriteAllText($Path, $content, (New-Object Text.UTF8Encoding -ArgumentList $false))
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
    foreach ($header in @($Response.SetCookies)) {
        foreach ($segment in @([string]$header -split ', (?=__Host-)')) {
            if ($segment.StartsWith("$Name=", [StringComparison]::Ordinal)) { return ([string]$segment -split ';', 2)[0] }
        }
    }
    throw "Missing response cookie: $Name"
}

function Clear-LocalApiRateLimitState {
    $command = 'for key in $(REDISCLI_AUTH="$REDIS_PASSWORD" redis-cli -n 1 --no-auth-warning --scan --pattern ''fastify-rate-limit-*''); do REDISCLI_AUTH="$REDIS_PASSWORD" redis-cli -n 1 --no-auth-warning DEL "$key" >/dev/null; done'
    docker compose --env-file $RuntimeEnvPath exec -T redis sh -c $command | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'Unable to isolate local API rate-limit state.' }
}

function Wait-ApiReady {
    param([string]$BaseUrl)
    for ($attempt = 0; $attempt -lt 60; $attempt++) {
        try {
            $response = Invoke-WebRequest -Uri "$BaseUrl/health/ready" -UseBasicParsing -TimeoutSec 3
            if ([int]$response.StatusCode -eq 200) { return }
        }
        catch {}
        Start-Sleep -Milliseconds 500
    }
    throw 'Application API did not become ready after key rotation.'
}

Add-Type -AssemblyName System.Net.Http
$httpHandler = New-Object System.Net.Http.HttpClientHandler
$httpHandler.UseCookies = $false
$httpHandler.AllowAutoRedirect = $false
$httpClient = New-Object System.Net.Http.HttpClient -ArgumentList $httpHandler
$httpClient.Timeout = [TimeSpan]::FromSeconds(20)

function Invoke-ApiRequest {
    param([string]$Method, [string]$Uri, [hashtable]$Headers = @{}, [string]$Body = '')
    $request = New-Object System.Net.Http.HttpRequestMessage -ArgumentList ([System.Net.Http.HttpMethod]::new($Method)), $Uri
    try {
        foreach ($entry in $Headers.GetEnumerator()) { $request.Headers.TryAddWithoutValidation([string]$entry.Key, [string]$entry.Value) | Out-Null }
        if (-not [string]::IsNullOrEmpty($Body)) { $request.Content = New-Object System.Net.Http.StringContent -ArgumentList $Body, ([Text.Encoding]::UTF8), 'application/json' }
        $response = $httpClient.SendAsync($request).GetAwaiter().GetResult()
        try {
            $cookies = @()
            $cookieValues = $null
            if ($response.Headers.TryGetValues('Set-Cookie', [ref]$cookieValues)) { $cookies = @($cookieValues) }
            return [pscustomobject]@{
                StatusCode = [int]$response.StatusCode
                Content = $response.Content.ReadAsStringAsync().GetAwaiter().GetResult()
                SetCookies = $cookies
            }
        }
        finally { $response.Dispose() }
    }
    finally { $request.Dispose() }
}

$runtime = Read-EnvironmentFile $runtimeFullPath
$admin = Read-EnvironmentFile (Join-Path $workspaceRoot $AdminEnvPath)
$directusBaseUrl = "http://127.0.0.1:$($runtime['DIRECTUS_HOST_PORT'])"
$apiBaseUrl = "http://localhost:$($runtime['API_HOST_PORT'])"
$manifest = Get-Content -LiteralPath (Join-Path $workspaceRoot 'apps\directus\security\phase3-default-deny.json') -Raw | ConvertFrom-Json
$travelerRoles = @($manifest.roles | Where-Object key -eq 'registered_traveler')
if ($travelerRoles.Count -ne 1) { throw 'Registered Traveler role is missing or duplicated.' }

$adminLogin = $null
$userId = $null
$userEmail = "phase3-key-rotation-$([Guid]::NewGuid().ToString('N'))@example.com"
$userPassword = New-RandomBase64Url 24
$nextKey = New-RandomBase64Url 32
$databaseRotated = $false
$environmentUpdated = $false
$apiStopped = $false

Push-Location $workspaceRoot
try {
    if (-not $SkipBuild) {
        docker compose --env-file $RuntimeEnvPath build api
        if ($LASTEXITCODE -ne 0) { throw 'Application API image build failed before key rotation.' }
        docker compose --env-file $RuntimeEnvPath up -d --no-deps --force-recreate api
        if ($LASTEXITCODE -ne 0) { throw 'Application API recreate failed before key rotation.' }
    }
    Wait-ApiReady $apiBaseUrl
    Clear-LocalApiRateLimitState

    $adminLogin = Invoke-RestMethod -Method Post -Uri "$directusBaseUrl/auth/login" -ContentType 'application/json' -Body (@{
        email = $admin['DIRECTUS_ADMIN_EMAIL']
        password = $admin['DIRECTUS_ADMIN_PASSWORD']
        mode = 'json'
    } | ConvertTo-Json) -TimeoutSec 20
    $adminHeaders = @{ Authorization = "Bearer $($adminLogin.data.access_token)" }
    $createdUser = Invoke-RestMethod -Method Post -Uri "$directusBaseUrl/users" -Headers $adminHeaders -ContentType 'application/json' -Body (@{
        email = $userEmail
        password = $userPassword
        role = [string]$travelerRoles[0].id
        status = 'active'
    } | ConvertTo-Json) -TimeoutSec 20
    $userId = [string]$createdUser.data.id
    if ([string]::IsNullOrWhiteSpace($userId)) { throw 'Key-rotation traveler creation failed.' }

    $csrf = Invoke-ApiRequest -Method Get -Uri "$apiBaseUrl/api/v1/auth/csrf"
    if ($csrf.StatusCode -ne 200) { throw 'Key-rotation CSRF request failed.' }
    $csrfBody = $csrf.Content | ConvertFrom-Json
    $csrfCookie = Get-CookiePair $csrf $runtime['API_CSRF_COOKIE_NAME']
    $login = Invoke-ApiRequest -Method Post -Uri "$apiBaseUrl/api/v1/auth/login" -Headers @{
        Origin = $apiBaseUrl
        Cookie = $csrfCookie
        'X-CSRF-Token' = [string]$csrfBody.data.csrfToken
    } -Body (@{ email = $userEmail; password = $userPassword } | ConvertTo-Json)
    if ($login.StatusCode -ne 200) { throw 'Key-rotation application login failed.' }
    $sessionCookie = Get-CookiePair $login $runtime['API_SESSION_COOKIE_NAME']

    $sessionCount = docker compose --env-file $RuntimeEnvPath exec -T database psql -At -v ON_ERROR_STOP=1 `
        -U $runtime['DB_USER'] -d $runtime['DB_DATABASE'] `
        -c "SELECT COUNT(*) FROM app_security.sessions WHERE user_id = '$userId' AND revoked_at IS NULL AND directus_access_token_ciphertext LIKE 'v1.%' AND directus_refresh_token_ciphertext LIKE 'v1.%';"
    if ($LASTEXITCODE -ne 0 -or $sessionCount.Trim() -ne '1') { throw 'Key-rotation encrypted session fixture is missing.' }

    $env:API_SESSION_ENCRYPTION_KEY_NEXT = $nextKey
    if ($ApplyLocalRotation) {
        docker compose --env-file $RuntimeEnvPath stop api | Out-Null
        if ($LASTEXITCODE -ne 0) { throw 'Unable to stop Application API for key rotation.' }
        $apiStopped = $true
        docker compose --env-file $RuntimeEnvPath run --rm --no-deps -e API_SESSION_ENCRYPTION_KEY_NEXT api node apps/api/dist/rotate-encryption-key.js
        if ($LASTEXITCODE -ne 0) { throw 'Application API encryption-key rotation failed.' }
        $databaseRotated = $true
        Set-EnvironmentValue -Path $runtimeFullPath -Name 'API_SESSION_ENCRYPTION_KEY' -Value $nextKey
        $environmentUpdated = $true
        $runtime['API_SESSION_ENCRYPTION_KEY'] = $nextKey
        docker compose --env-file $RuntimeEnvPath up -d --no-deps --force-recreate api | Out-Null
        if ($LASTEXITCODE -ne 0) { throw 'Unable to restart Application API with the rotated key.' }
        $apiStopped = $false
        Wait-ApiReady $apiBaseUrl
    }
    else {
        docker compose --env-file $RuntimeEnvPath run --rm --no-deps -e API_SESSION_ENCRYPTION_KEY_NEXT api node apps/api/dist/rotate-encryption-key.js --rollback
        if ($LASTEXITCODE -ne 0) { throw 'Application API encryption-key rollback drill failed.' }
    }

    $me = Invoke-ApiRequest -Method Get -Uri "$apiBaseUrl/api/v1/auth/me" -Headers @{ Cookie = $sessionCookie }
    if ($me.StatusCode -ne 200 -or [string](($me.Content | ConvertFrom-Json).data.user.id) -ne $userId) {
        throw 'Existing application session did not survive the encryption-key drill.'
    }

    $mode = if ($ApplyLocalRotation) { 'apply' } else { 'rollback' }
    Write-Output "PHASE3_API_ENCRYPTION_KEY_ROTATION_TEST_OK mode=$mode active_session_preserved=true rotation_transaction=true committed=$([bool]$ApplyLocalRotation) api_restart=$([bool]$ApplyLocalRotation) secrets_printed=false"
}
finally {
    Remove-Item Env:API_SESSION_ENCRYPTION_KEY_NEXT -ErrorAction SilentlyContinue
    if ($databaseRotated -and -not $environmentUpdated) {
        try { Set-EnvironmentValue -Path $runtimeFullPath -Name 'API_SESSION_ENCRYPTION_KEY' -Value $nextKey; $environmentUpdated = $true } catch {}
    }
    if ($apiStopped) {
        try { docker compose --env-file $RuntimeEnvPath up -d --no-deps --force-recreate api | Out-Null; Wait-ApiReady $apiBaseUrl } catch {}
    }
    if ($null -ne $adminLogin -and -not [string]::IsNullOrWhiteSpace($userId)) {
        try { Invoke-WebRequest -Method Delete -Uri "$directusBaseUrl/users/$userId" -Headers @{ Authorization = "Bearer $($adminLogin.data.access_token)" } -UseBasicParsing | Out-Null } catch {}
        try {
            docker compose --env-file $RuntimeEnvPath exec -T database psql -v ON_ERROR_STOP=1 -U $runtime['DB_USER'] -d $runtime['DB_DATABASE'] `
                -c "DELETE FROM app_security.audit_events WHERE actor_user_id = '$userId'; DELETE FROM app_security.sessions WHERE user_id = '$userId';" | Out-Null
        } catch {}
    }
    if ($null -ne $adminLogin -and -not [string]::IsNullOrWhiteSpace($adminLogin.data.refresh_token)) {
        try { Invoke-RestMethod -Method Post -Uri "$directusBaseUrl/auth/logout" -ContentType 'application/json' -Body (@{ refresh_token = $adminLogin.data.refresh_token; mode = 'json' } | ConvertTo-Json) -TimeoutSec 20 | Out-Null } catch {}
    }
    try { Clear-LocalApiRateLimitState } catch {}
    $httpClient.Dispose()
    $httpHandler.Dispose()
    Pop-Location
}
