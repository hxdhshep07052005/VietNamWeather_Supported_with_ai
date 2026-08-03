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
    foreach ($header in @($Response.SetCookies)) {
        foreach ($segment in @([string]$header -split ', (?=__Host-)')) {
            if ($segment.StartsWith("$Name=", [StringComparison]::Ordinal)) { return ([string]$segment -split ';', 2)[0] }
        }
    }
    throw "Missing response cookie: $Name"
}

Add-Type -AssemblyName System.Net.Http
$httpHandler = New-Object System.Net.Http.HttpClientHandler
$httpHandler.UseCookies = $false
$httpHandler.AllowAutoRedirect = $false
$httpClient = New-Object System.Net.Http.HttpClient -ArgumentList $httpHandler
$httpClient.Timeout = [TimeSpan]::FromSeconds(20)

function Invoke-HttpRequest {
    param(
        [Parameter(Mandatory = $true)][string]$Method,
        [Parameter(Mandatory = $true)][string]$Uri,
        [hashtable]$Headers = @{},
        [string]$Body = ''
    )
    $request = New-Object System.Net.Http.HttpRequestMessage -ArgumentList ([System.Net.Http.HttpMethod]::new($Method)), $Uri
    try {
        foreach ($entry in $Headers.GetEnumerator()) { $request.Headers.TryAddWithoutValidation([string]$entry.Key, [string]$entry.Value) | Out-Null }
        if (-not [string]::IsNullOrEmpty($Body)) { $request.Content = New-Object System.Net.Http.StringContent -ArgumentList $Body, ([Text.Encoding]::UTF8), 'application/json' }
        $response = $httpClient.SendAsync($request).GetAwaiter().GetResult()
        try {
            $setCookies = @()
            $cookieValues = $null
            if ($response.Headers.TryGetValues('Set-Cookie', [ref]$cookieValues)) { $setCookies = @($cookieValues) }
            $location = $null
            if ($response.Headers.Location) { $location = [string]$response.Headers.Location }
            return [pscustomobject]@{
                StatusCode = [int]$response.StatusCode
                Content = $response.Content.ReadAsStringAsync().GetAwaiter().GetResult()
                SetCookies = $setCookies
                Location = $location
            }
        }
        finally { $response.Dispose() }
    }
    finally { $request.Dispose() }
}

function Get-Csrf {
    $response = Invoke-HttpRequest -Method Get -Uri "$apiBaseUrl/api/v1/auth/csrf"
    if ($response.StatusCode -ne 200) { throw 'Password recovery CSRF endpoint failed.' }
    $body = $response.Content | ConvertFrom-Json
    return [pscustomobject]@{ Token = [string]$body.data.csrfToken; Cookie = Get-CookiePair $response $runtime['API_CSRF_COOKIE_NAME'] }
}

function Invoke-ApiMutation {
    param([string]$Path, [string]$Body, $Csrf, [string]$Cookie = '')
    $cookies = if ([string]::IsNullOrWhiteSpace($Cookie)) { $Csrf.Cookie } else { "$Cookie; $($Csrf.Cookie)" }
    return Invoke-HttpRequest -Method Post -Uri "$apiBaseUrl$Path" -Headers @{
        Origin = $origin
        Cookie = $cookies
        'X-CSRF-Token' = $Csrf.Token
    } -Body $Body
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

$adminLogin = $null
$userId = $null
$userEmail = "phase3-recovery-$([Guid]::NewGuid().ToString('N'))@example.com"
$oldPassword = New-RandomBase64Url 24
$newPassword = New-RandomBase64Url 24
$sessionCookie = $null
$resetToken = $null
$messageCountBefore = 0
$testStartedAt = [DateTime]::UtcNow

Push-Location $workspaceRoot
try {
    Clear-LocalApiRateLimitState
    $mailBefore = Invoke-RestMethod -Uri 'http://127.0.0.1:8025/api/v1/messages' -TimeoutSec 20
    $messageCountBefore = [int]$mailBefore.total
    if ($messageCountBefore -ne 0) { throw 'Mailpit must be empty before the isolated password recovery drill.' }

    $adminLogin = Invoke-RestMethod -Method Post -Uri "$directusBaseUrl/auth/login" -ContentType 'application/json' -Body (@{
        email = $admin['DIRECTUS_ADMIN_EMAIL']
        password = $admin['DIRECTUS_ADMIN_PASSWORD']
        mode = 'json'
    } | ConvertTo-Json) -TimeoutSec 20
    $adminHeaders = @{ Authorization = "Bearer $($adminLogin.data.access_token)" }
    $createdUser = Invoke-RestMethod -Method Post -Uri "$directusBaseUrl/users" -Headers $adminHeaders -ContentType 'application/json' -Body (@{
        email = $userEmail
        password = $oldPassword
        role = [string]$travelerRole[0].id
        status = 'active'
    } | ConvertTo-Json) -TimeoutSec 20
    $userId = [string]$createdUser.data.id
    if ([string]::IsNullOrWhiteSpace($userId)) { throw 'Password recovery fixture creation failed.' }

    $loginCsrf = Get-Csrf
    $login = Invoke-ApiMutation -Path '/api/v1/auth/login' -Body (@{ email = $userEmail; password = $oldPassword } | ConvertTo-Json) -Csrf $loginCsrf
    if ($login.StatusCode -ne 200) { throw "Password recovery fixture login failed status=$($login.StatusCode)" }
    $sessionCookie = Get-CookiePair $login $runtime['API_SESSION_COOKIE_NAME']
    if ($login.Content -match '(?i)access_token|refresh_token|bearer\s|directus_access|directus_refresh') { throw 'Password recovery login exposed backend token material.' }

    $requestCsrf = Get-Csrf
    $requestResponse = Invoke-ApiMutation -Path '/api/v1/auth/password/request' -Body (@{ email = $userEmail } | ConvertTo-Json) -Csrf $requestCsrf
    if ($requestResponse.StatusCode -ne 202) { throw "Password recovery request failed status=$($requestResponse.StatusCode)" }
    if ($requestResponse.Content -match '(?i)token|password|email') { throw 'Password recovery request response exposed sensitive metadata.' }

    $message = $null
    $detail = $null
    for ($attempt = 0; $attempt -lt 20 -and $null -eq $detail; $attempt++) {
        Start-Sleep -Milliseconds 500
        $mail = Invoke-RestMethod -Uri 'http://127.0.0.1:8025/api/v1/messages' -TimeoutSec 20
        foreach ($candidate in @($mail.messages | Sort-Object Created -Descending)) {
            $candidateId = [string]$candidate.ID
            if ([string]::IsNullOrWhiteSpace($candidateId)) { continue }
            $addresses = @($candidate.To | ForEach-Object { if ($_.Address) { [string]$_.Address } else { [string]$_ } })
            if ($addresses -notcontains $userEmail) { continue }
            $candidateDetail = Invoke-RestMethod -Uri "http://127.0.0.1:8025/api/v1/message/$candidateId" -TimeoutSec 20
            $message = $candidate
            $detail = $candidateDetail
            break
        }
    }
    if ($null -eq $detail) { throw 'Password recovery email was not delivered to Mailpit.' }
    $mailText = "$( $detail.Text )`n$( $detail.HTML )"
    $linkMatch = [regex]::Match($mailText, 'http[^\s"''<>]+/api/v1/auth/password/consume\?token=([^\s"''<>]+)')
    if (-not $linkMatch.Success) { throw 'Password recovery email did not contain the approved consume URL.' }
    $resetToken = [Uri]::UnescapeDataString($linkMatch.Groups[1].Value).TrimEnd(')', '.', ',')
    if ($resetToken.Length -lt 16) { throw 'Password recovery email contained an invalid reset token.' }

    $consume = Invoke-HttpRequest -Method Get -Uri "$apiBaseUrl/api/v1/auth/password/consume?token=$([Uri]::EscapeDataString($resetToken))"
    if ($consume.StatusCode -ne 303 -or [string]::IsNullOrWhiteSpace($consume.Location)) { throw 'Password recovery consume endpoint did not redirect.' }
    if ($consume.Location -match '(?i)token=|directus-reset') { throw 'Password recovery redirect exposed the Directus reset token.' }
    if ($consume.Location -notmatch '#recovery=([^&]+)$') { throw 'Password recovery redirect did not contain an opaque fragment handle.' }
    $handle = [Uri]::UnescapeDataString($Matches[1])
    if ($handle.Length -lt 16) { throw 'Password recovery opaque handle is too short.' }

    $resetCsrf = Get-Csrf
    $reset = Invoke-ApiMutation -Path '/api/v1/auth/password/reset' -Body (@{ handle = $handle; password = $newPassword } | ConvertTo-Json) -Csrf $resetCsrf
    if ($reset.StatusCode -ne 204) { throw "Password reset completion failed status=$($reset.StatusCode)" }

    $oldSessionCheck = Invoke-HttpRequest -Method Get -Uri "$apiBaseUrl/api/v1/auth/me" -Headers @{ Cookie = $sessionCookie }
    if ($oldSessionCheck.StatusCode -ne 401) { throw 'Password reset did not revoke the old application session.' }

    $newLoginCsrf = Get-Csrf
    $newLogin = Invoke-ApiMutation -Path '/api/v1/auth/login' -Body (@{ email = $userEmail; password = $newPassword } | ConvertTo-Json) -Csrf $newLoginCsrf
    if ($newLogin.StatusCode -ne 200) { throw 'New password could not authenticate after reset.' }
    if ($newLogin.Content -match '(?i)access_token|refresh_token|bearer\s|directus_access|directus_refresh') { throw 'Password reset login exposed backend token material.' }

    $replay = Invoke-ApiMutation -Path '/api/v1/auth/password/reset' -Body (@{ handle = $handle; password = (New-RandomBase64Url 24) } | ConvertTo-Json) -Csrf (Get-Csrf)
    if ($replay.StatusCode -ne 400 -or [string]($replay.Content | ConvertFrom-Json).error.code -ne 'PASSWORD_RESET_INVALID') { throw 'Password recovery handle replay was not denied.' }

    $dbEvidence = docker compose --env-file $RuntimeEnvPath exec -T database psql -At -v ON_ERROR_STOP=1 `
        -U $runtime['DB_USER'] -d $runtime['DB_DATABASE'] `
        -c "SELECT COUNT(*) FILTER (WHERE consumed_at IS NOT NULL), COUNT(*) FILTER (WHERE directus_reset_token_ciphertext LIKE 'v1.%') FROM app_security.password_recovery_tokens;"
    if ($LASTEXITCODE -ne 0 -or $dbEvidence.Trim() -ne '1|1') { throw 'Password recovery encrypted/consumed database evidence failed.' }

    $apiLogs = docker compose --env-file $RuntimeEnvPath logs --no-color --tail 300 api | Out-String
    if ($apiLogs.Contains($resetToken) -or $apiLogs.Contains($oldPassword) -or $apiLogs.Contains($newPassword)) { throw 'Application API logs exposed password recovery material.' }
    $directusLogs = docker compose --env-file $RuntimeEnvPath logs --no-color --tail 300 directus | Out-String
    if ($directusLogs.Contains($resetToken) -or $directusLogs.Contains($oldPassword) -or $directusLogs.Contains($newPassword)) { throw 'Directus logs exposed password recovery material.' }

    Write-Output 'PHASE3_PASSWORD_RECOVERY_RUNTIME_TEST_OK request_accepted=true mailpit_delivery=true token_server_side=true clean_redirect=true reset_success=true old_session_revoked=true new_password_login=true replay_denied=true encrypted_token=true log_redaction=true secrets_printed=false'
}
finally {
    if ($null -ne $adminLogin -and -not [string]::IsNullOrWhiteSpace($userId)) {
        try { Invoke-WebRequest -Method Delete -Uri "$directusBaseUrl/users/$userId" -Headers @{ Authorization = "Bearer $($adminLogin.data.access_token)" } -UseBasicParsing | Out-Null } catch {}
        try {
            docker compose --env-file $RuntimeEnvPath exec -T database psql -v ON_ERROR_STOP=1 -U $runtime['DB_USER'] -d $runtime['DB_DATABASE'] `
                -c "DELETE FROM app_security.audit_events WHERE actor_user_id = '$userId'; DELETE FROM app_security.sessions WHERE user_id = '$userId'; DELETE FROM app_security.password_recovery_tokens WHERE created_at >= '$($testStartedAt.ToString('o'))';" | Out-Null
        } catch {}
        if ($messageCountBefore -eq 0) { try { Invoke-WebRequest -Method Delete -Uri 'http://127.0.0.1:8025/api/v1/messages' -UseBasicParsing | Out-Null } catch {} }
    }
    if ($null -ne $adminLogin -and -not [string]::IsNullOrWhiteSpace($adminLogin.data.refresh_token)) {
        try { Invoke-RestMethod -Method Post -Uri "$directusBaseUrl/auth/logout" -ContentType 'application/json' -Body (@{ refresh_token = $adminLogin.data.refresh_token; mode = 'json' } | ConvertTo-Json) -TimeoutSec 20 | Out-Null } catch {}
    }
    try { Clear-LocalApiRateLimitState } catch {}
    $httpClient.Dispose()
    $httpHandler.Dispose()
    Pop-Location
}
