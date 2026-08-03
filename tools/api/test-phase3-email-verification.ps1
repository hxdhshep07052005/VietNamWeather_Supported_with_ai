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

function Clear-LocalApiRateLimitState {
    if ([IO.Path]::GetFileName($RuntimeEnvPath) -ne '.env.local') {
        throw 'Rate-limit state cleanup is restricted to .env.local.'
    }
    $command = 'for key in $(REDISCLI_AUTH="$REDIS_PASSWORD" redis-cli -n 1 --no-auth-warning --scan --pattern ''fastify-rate-limit-*''); do REDISCLI_AUTH="$REDIS_PASSWORD" redis-cli -n 1 --no-auth-warning DEL "$key" >/dev/null; done'
    docker compose --env-file $RuntimeEnvPath exec -T redis sh -c $command | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'Unable to isolate local API rate-limit state.' }
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

$runtime = Read-EnvironmentFile (Join-Path $workspaceRoot $RuntimeEnvPath)
$admin = Read-EnvironmentFile (Join-Path $workspaceRoot $AdminEnvPath)
$directusBaseUrl = "http://127.0.0.1:$($runtime['DIRECTUS_HOST_PORT'])"
$apiBaseUrl = "http://localhost:$($runtime['API_HOST_PORT'])"
$origin = $apiBaseUrl

function Get-Csrf {
    $response = Invoke-HttpRequest -Method Get -Uri "$apiBaseUrl/api/v1/auth/csrf"
    if ($response.StatusCode -ne 200) { throw 'Email verification CSRF endpoint failed.' }
    $body = $response.Content | ConvertFrom-Json
    return [pscustomobject]@{ Token = [string]$body.data.csrfToken; Cookie = Get-CookiePair $response $runtime['API_CSRF_COOKIE_NAME'] }
}

function Invoke-ApiMutation {
    param([string]$Path, [string]$Body, $Csrf)
    return Invoke-HttpRequest -Method Post -Uri "$apiBaseUrl$Path" -Headers @{
        Origin = $origin
        Cookie = $Csrf.Cookie
        'X-CSRF-Token' = $Csrf.Token
    } -Body $Body
}

$adminLogin = $null
$userId = $null
$userEmail = "phase3-verification-$([Guid]::NewGuid().ToString('N'))@example.com"
$userPassword = New-RandomBase64Url 24
$verificationToken = $null
$messageCountBefore = 0
$testStartedAt = [DateTime]::UtcNow

Push-Location $workspaceRoot
try {
    Clear-LocalApiRateLimitState
    $mailBefore = Invoke-RestMethod -Uri 'http://127.0.0.1:8025/api/v1/messages' -TimeoutSec 20
    $messageCountBefore = [int]$mailBefore.total
    if ($messageCountBefore -ne 0) { throw 'Mailpit must be empty before the isolated email verification drill.' }

    $adminLogin = Invoke-RestMethod -Method Post -Uri "$directusBaseUrl/auth/login" -ContentType 'application/json' -Body (@{
        email = $admin['DIRECTUS_ADMIN_EMAIL']
        password = $admin['DIRECTUS_ADMIN_PASSWORD']
        mode = 'json'
    } | ConvertTo-Json) -TimeoutSec 20
    $adminHeaders = @{ Authorization = "Bearer $($adminLogin.data.access_token)" }

    $registerCsrf = Get-Csrf
    $register = Invoke-ApiMutation -Path '/api/v1/auth/register' -Body (@{ email = $userEmail; password = $userPassword } | ConvertTo-Json) -Csrf $registerCsrf
    if ($register.StatusCode -ne 202) { throw "Registration request failed status=$($register.StatusCode)" }
    if ($register.Content -match '(?i)token|password|verification|email') { throw 'Registration response exposed sensitive verification metadata.' }

    $filter = [Uri]::EscapeDataString((@{ email = @{ _eq = $userEmail } } | ConvertTo-Json -Compress))
    $createdResponse = Invoke-RestMethod -Uri "$directusBaseUrl/users?filter=$filter&fields=id,status,email" -Headers $adminHeaders -TimeoutSec 20
    $createdUsers = @($createdResponse.data)
    if ($createdUsers.Count -ne 1 -or [string]$createdUsers[0].status -ne 'unverified') { throw 'Registration did not create exactly one unverified traveler.' }
    $createdUser = $createdUsers[0]
    $userId = [string]$createdUser.id

    $duplicateRegister = Invoke-ApiMutation -Path '/api/v1/auth/register' -Body (@{ email = $userEmail; password = $userPassword } | ConvertTo-Json) -Csrf (Get-Csrf)
    if ($duplicateRegister.StatusCode -ne 202 -or $duplicateRegister.Content -match '(?i)token|password|verification|email') {
        throw 'Duplicate registration response exposed account existence or sensitive metadata.'
    }
    $duplicateResponse = Invoke-RestMethod -Uri "$directusBaseUrl/users?filter=$filter&fields=id" -Headers $adminHeaders -TimeoutSec 20
    if (@($duplicateResponse.data).Count -ne 1) { throw 'Duplicate registration created an unexpected additional identity.' }

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
    if ($null -eq $detail) { throw 'Email verification message was not delivered to Mailpit.' }
    $mailText = "$( $detail.Text )`n$( $detail.HTML )"
    $linkMatch = [regex]::Match($mailText, 'http[^\s"''<>]+/api/v1/auth/verification/consume\?token=([^\s"''<>]+)')
    if (-not $linkMatch.Success) { throw 'Verification email did not contain the approved consume URL.' }
    $verificationToken = [Uri]::UnescapeDataString($linkMatch.Groups[1].Value).TrimEnd(')', '.', ',')
    if ($verificationToken.Length -lt 16) { throw 'Verification email contained an invalid token.' }

    $beforeLogin = Invoke-ApiMutation -Path '/api/v1/auth/login' -Body (@{ email = $userEmail; password = $userPassword } | ConvertTo-Json) -Csrf (Get-Csrf)
    if ($beforeLogin.StatusCode -ne 401) { throw 'Unverified account could authenticate before verification.' }

    $consume = Invoke-HttpRequest -Method Get -Uri "$apiBaseUrl/api/v1/auth/verification/consume?token=$([Uri]::EscapeDataString($verificationToken))"
    if ($consume.StatusCode -ne 303 -or [string]::IsNullOrWhiteSpace($consume.Location)) { throw 'Verification consume endpoint did not redirect.' }
    if ($consume.Location -match '(?i)token=') { throw 'Verification redirect exposed the Directus token.' }
    if ($consume.Location -notmatch '#verification=([^&]+)$') { throw 'Verification redirect did not contain an opaque fragment handle.' }
    $handle = [Uri]::UnescapeDataString($Matches[1])
    if ($handle.Length -lt 16) { throw 'Verification opaque handle is too short.' }

    $complete = Invoke-ApiMutation -Path '/api/v1/auth/verification/complete' -Body (@{ handle = $handle } | ConvertTo-Json) -Csrf (Get-Csrf)
    if ($complete.StatusCode -ne 204) { throw "Verification completion failed status=$($complete.StatusCode)" }

    $verifiedUser = Invoke-RestMethod -Uri "$directusBaseUrl/users/${userId}?fields=id,status" -Headers $adminHeaders -TimeoutSec 20
    if ([string]$verifiedUser.data.status -ne 'active') { throw 'Email verification did not activate the Directus user.' }
    $afterLogin = Invoke-ApiMutation -Path '/api/v1/auth/login' -Body (@{ email = $userEmail; password = $userPassword } | ConvertTo-Json) -Csrf (Get-Csrf)
    if ($afterLogin.StatusCode -ne 200) { throw 'Verified user could not authenticate after email verification.' }
    if ($afterLogin.Content -match '(?i)access_token|refresh_token|bearer\s|directus_access|directus_refresh') { throw 'Verified login exposed backend token material.' }

    $replay = Invoke-ApiMutation -Path '/api/v1/auth/verification/complete' -Body (@{ handle = $handle } | ConvertTo-Json) -Csrf (Get-Csrf)
    if ($replay.StatusCode -ne 400 -or [string]($replay.Content | ConvertFrom-Json).error.code -ne 'EMAIL_VERIFICATION_INVALID') { throw 'Email verification handle replay was not denied.' }

    $dbEvidence = docker compose --env-file $RuntimeEnvPath exec -T database psql -At -v ON_ERROR_STOP=1 `
        -U $runtime['DB_USER'] -d $runtime['DB_DATABASE'] `
        -c "SELECT COUNT(*) FILTER (WHERE consumed_at IS NOT NULL), COUNT(*) FILTER (WHERE directus_verification_token_ciphertext LIKE 'v1.%') FROM app_security.email_verification_tokens;"
    if ($LASTEXITCODE -ne 0 -or $dbEvidence.Trim() -ne '1|1') { throw 'Email verification encrypted/consumed database evidence failed.' }

    $apiLogs = docker compose --env-file $RuntimeEnvPath logs --no-color --tail 300 api | Out-String
    if ($apiLogs.Contains($verificationToken) -or $apiLogs.Contains($userPassword)) { throw 'Application API logs exposed email verification material.' }
    $directusLogs = docker compose --env-file $RuntimeEnvPath logs --no-color --tail 300 directus | Out-String
    if ($directusLogs.Contains($verificationToken) -or $directusLogs.Contains($userPassword)) { throw 'Directus logs exposed email verification material.' }

    Write-Output 'PHASE3_EMAIL_VERIFICATION_RUNTIME_TEST_OK registration_accepted=true duplicate_enumeration_denied=true mailpit_delivery=true unverified_login_denied=true token_server_side=true clean_redirect=true verification_success=true verified_login=true replay_denied=true encrypted_token=true log_redaction=true secrets_printed=false'
}
finally {
    if ($null -ne $adminLogin -and -not [string]::IsNullOrWhiteSpace($userId)) {
        try { Invoke-WebRequest -Method Delete -Uri "$directusBaseUrl/users/$userId" -Headers @{ Authorization = "Bearer $($adminLogin.data.access_token)" } -UseBasicParsing | Out-Null } catch {}
        try {
            docker compose --env-file $RuntimeEnvPath exec -T database psql -v ON_ERROR_STOP=1 -U $runtime['DB_USER'] -d $runtime['DB_DATABASE'] `
                -c "DELETE FROM app_security.audit_events WHERE actor_user_id = '$userId' OR (event_type LIKE 'auth.email_verification.%' AND created_at >= '$($testStartedAt.ToString('o'))'); DELETE FROM app_security.sessions WHERE user_id = '$userId'; DELETE FROM app_security.email_verification_tokens WHERE created_at >= '$($testStartedAt.ToString('o'))';" | Out-Null
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
