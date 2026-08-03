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

function Get-Sha256Hex {
    param([string]$Value)
    $algorithm = [Security.Cryptography.SHA256]::Create()
    try { $hash = $algorithm.ComputeHash([Text.Encoding]::UTF8.GetBytes($Value)) } finally { $algorithm.Dispose() }
    return [BitConverter]::ToString($hash).Replace('-', '').ToLowerInvariant()
}

function ConvertFrom-Base32 {
    param([Parameter(Mandatory = $true)][string]$Value)
    $alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
    $normalized = $Value.Trim().TrimEnd('=').ToUpperInvariant()
    $output = New-Object Collections.Generic.List[byte]
    $buffer = 0
    $bits = 0
    foreach ($character in $normalized.ToCharArray()) {
        $index = $alphabet.IndexOf($character)
        if ($index -lt 0) { throw 'Directus returned an invalid Base32 TFA secret.' }
        $buffer = ($buffer -shl 5) -bor $index
        $bits += 5
        if ($bits -ge 8) {
            $bits -= 8
            $output.Add([byte](($buffer -shr $bits) -band 255))
            if ($bits -eq 0) { $buffer = 0 } else { $buffer = $buffer -band ((1 -shl $bits) - 1) }
        }
    }
    return $output.ToArray()
}

function Get-TotpCode {
    param(
        [Parameter(Mandatory = $true)][string]$Secret,
        [long]$UnixSeconds = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds(),
        [ValidateRange(6, 8)][int]$Digits = 6
    )
    [long]$counter = [Math]::Floor($UnixSeconds / 30)
    $counterBytes = New-Object byte[] 8
    for ($index = 7; $index -ge 0; $index--) {
        $counterBytes[$index] = [byte]($counter -band 255)
        $counter = $counter -shr 8
    }
    $hmac = New-Object Security.Cryptography.HMACSHA1 -ArgumentList (,(ConvertFrom-Base32 $Secret))
    try { $digest = $hmac.ComputeHash($counterBytes) } finally { $hmac.Dispose() }
    $offset = $digest[$digest.Length - 1] -band 15
    $binary = (($digest[$offset] -band 127) -shl 24) -bor
        (($digest[$offset + 1] -band 255) -shl 16) -bor
        (($digest[$offset + 2] -band 255) -shl 8) -bor
        ($digest[$offset + 3] -band 255)
    $modulus = [Math]::Pow(10, $Digits)
    return ([long]$binary % [long]$modulus).ToString("D$Digits")
}

Add-Type -AssemblyName System.Net.Http
$httpHandler = New-Object System.Net.Http.HttpClientHandler
$httpHandler.UseCookies = $false
$httpHandler.AllowAutoRedirect = $false
$httpClient = New-Object System.Net.Http.HttpClient -ArgumentList $httpHandler
$httpClient.Timeout = [TimeSpan]::FromSeconds(20)

function Invoke-DirectusRequest {
    param(
        [Parameter(Mandatory = $true)][string]$Method,
        [Parameter(Mandatory = $true)][string]$Uri,
        [hashtable]$Headers = @{},
        [hashtable]$Body
    )
    $request = New-Object System.Net.Http.HttpRequestMessage -ArgumentList ([System.Net.Http.HttpMethod]::new($Method)), $Uri
    try {
        foreach ($entry in $Headers.GetEnumerator()) {
            if (-not $request.Headers.TryAddWithoutValidation([string]$entry.Key, [string]$entry.Value)) {
                throw "Unable to add Directus request header: $($entry.Key)"
            }
        }
        if ($null -ne $Body) {
            $json = $Body | ConvertTo-Json -Compress
            $request.Content = New-Object System.Net.Http.StringContent -ArgumentList $json, ([Text.Encoding]::UTF8), 'application/json'
        }
        $response = $httpClient.SendAsync($request).GetAwaiter().GetResult()
        try {
            return [pscustomobject]@{
                StatusCode = [int]$response.StatusCode
                Content = $response.Content.ReadAsStringAsync().GetAwaiter().GetResult()
            }
        }
        finally { $response.Dispose() }
    }
    finally { $request.Dispose() }
}

function Invoke-DirectusLogin {
    param(
        [Parameter(Mandatory = $true)][string]$Email,
        [Parameter(Mandatory = $true)][string]$Password,
        [string]$Otp
    )
    $body = @{ email = $Email; password = $Password; mode = 'json' }
    if (-not [string]::IsNullOrWhiteSpace($Otp)) { $body['otp'] = $Otp }
    $response = Invoke-DirectusRequest -Method Post -Uri "$directusBaseUrl/auth/login" -Body $body
    if ($response.StatusCode -ne 200) { throw "Directus staff login failed status=$($response.StatusCode)" }
    $payload = $response.Content | ConvertFrom-Json
    if ([string]::IsNullOrWhiteSpace($payload.data.access_token) -or [string]::IsNullOrWhiteSpace($payload.data.refresh_token)) {
        throw 'Directus staff login returned incomplete token metadata.'
    }
    return $payload.data
}

function Remove-DirectusUser {
    param(
        [Parameter(Mandatory = $true)][string]$UserId,
        [Parameter(Mandatory = $true)][string]$AccessToken
    )
    $response = Invoke-WebRequest -Method Delete -Uri "$directusBaseUrl/users/$UserId" `
        -Headers @{ Authorization = "Bearer $AccessToken" } -UseBasicParsing
    return [int]$response.StatusCode
}

if ((Get-TotpCode -Secret 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ' -UnixSeconds 59 -Digits 8) -ne '94287082') {
    throw 'Local RFC 6238 TOTP implementation self-test failed.'
}

$runtime = Read-EnvironmentFile (Join-Path $workspaceRoot $RuntimeEnvPath)
$admin = Read-EnvironmentFile (Join-Path $workspaceRoot $AdminEnvPath)
$directusBaseUrl = "http://127.0.0.1:$($runtime['DIRECTUS_HOST_PORT'])"
$manifest = Get-Content -LiteralPath (Join-Path $workspaceRoot 'apps\directus\security\phase3-default-deny.json') -Raw | ConvertFrom-Json
$staffRole = @($manifest.roles | Where-Object key -eq 'weather_operations')
if ($staffRole.Count -ne 1) { throw 'Weather Operations role is missing or duplicated.' }

$adminLogin = $null
$staffLogins = New-Object Collections.Generic.List[object]
$userId = $null
$userEmail = "phase3-mfa-$([Guid]::NewGuid().ToString('N'))@example.com"
$userPassword = New-RandomBase64Url 24
$sessionHash = Get-Sha256Hex ([Guid]::NewGuid().ToString())
$sessionFamily = [Guid]::NewGuid().ToString()

Push-Location $workspaceRoot
try {
    $adminLogin = Invoke-DirectusLogin -Email $admin['DIRECTUS_ADMIN_EMAIL'] -Password $admin['DIRECTUS_ADMIN_PASSWORD']
    $adminHeaders = @{ Authorization = "Bearer $($adminLogin.access_token)" }
    $adminMeResponse = Invoke-DirectusRequest -Method Get -Uri "$directusBaseUrl/users/me?fields=id,role" -Headers $adminHeaders
    if ($adminMeResponse.StatusCode -ne 200) { throw 'Unable to resolve the Directus admin role for the MFA drill.' }
    $adminMe = $adminMeResponse.Content | ConvertFrom-Json
    $adminRoleId = if ($adminMe.data.role -is [string]) { [string]$adminMe.data.role } else { [string]$adminMe.data.role.id }
    $parsedAdminRoleId = [Guid]::Empty
    if (-not [Guid]::TryParse($adminRoleId, [ref]$parsedAdminRoleId)) { throw 'Directus admin role identifier is invalid.' }

    $createResponse = Invoke-DirectusRequest -Method Post -Uri "$directusBaseUrl/users" -Headers $adminHeaders -Body @{
        email = $userEmail
        password = $userPassword
        role = [string]$staffRole[0].id
        status = 'active'
    }
    if ($createResponse.StatusCode -ne 200) { throw "Ephemeral staff creation failed status=$($createResponse.StatusCode)" }
    $createdUser = $createResponse.Content | ConvertFrom-Json
    $userId = [string]$createdUser.data.id
    $parsedUserId = [Guid]::Empty
    if (-not [Guid]::TryParse($userId, [ref]$parsedUserId)) { throw 'Ephemeral staff creation returned an invalid identifier.' }

    $initialLogin = Invoke-DirectusLogin -Email $userEmail -Password $userPassword
    $staffLogins.Add($initialLogin)
    $staffHeaders = @{ Authorization = "Bearer $($initialLogin.access_token)" }
    $generateResponse = Invoke-DirectusRequest -Method Post -Uri "$directusBaseUrl/users/me/tfa/generate/" -Headers $staffHeaders -Body @{
        password = $userPassword
    }
    if ($generateResponse.StatusCode -ne 200) { throw "TFA generation failed status=$($generateResponse.StatusCode)" }
    $generated = $generateResponse.Content | ConvertFrom-Json
    $staffTfaSecret = [string]$generated.data.secret
    if ([string]::IsNullOrWhiteSpace($staffTfaSecret) -or [string]$generated.data.otpauth_url -notlike 'otpauth://totp/*') {
        throw 'TFA generation returned invalid enrollment metadata.'
    }

    $enableResponse = Invoke-DirectusRequest -Method Post -Uri "$directusBaseUrl/users/me/tfa/enable/" -Headers $staffHeaders -Body @{
        secret = $staffTfaSecret
        otp = Get-TotpCode -Secret $staffTfaSecret
    }
    if ($enableResponse.StatusCode -notin @(200, 204)) { throw "Managed staff TFA enable failed status=$($enableResponse.StatusCode)" }

    $managedMissingOtpResponse = Invoke-DirectusRequest -Method Post -Uri "$directusBaseUrl/auth/login" -Body @{
        email = $userEmail
        password = $userPassword
        mode = 'json'
    }
    if ($managedMissingOtpResponse.StatusCode -ne 401) { throw 'Managed staff login without OTP was not denied after TFA enrollment.' }
    $managedMissingOtpBody = $managedMissingOtpResponse.Content | ConvertFrom-Json
    if ([string]$managedMissingOtpBody.errors[0].extensions.code -ne 'INVALID_OTP') {
        throw 'Managed staff login without OTP returned an unexpected error code.'
    }

    $managedOtpLogin = Invoke-DirectusLogin -Email $userEmail -Password $userPassword -Otp (Get-TotpCode -Secret $staffTfaSecret)
    $staffLogins.Add($managedOtpLogin)

    $managedCleanupStatus = Remove-DirectusUser -UserId $userId -AccessToken $adminLogin.access_token
    if ($managedCleanupStatus -notin @(200, 204)) { throw "Managed staff MFA fixture cleanup failed status=$managedCleanupStatus" }
    $staffUserPassword = $userPassword
    $userEmail = "phase3-mfa-admin-$([Guid]::NewGuid().ToString('N'))@example.com"
    $userPassword = New-RandomBase64Url 24
    $createResponse = Invoke-DirectusRequest -Method Post -Uri "$directusBaseUrl/users" -Headers $adminHeaders -Body @{
        email = $userEmail
        password = $userPassword
        role = $adminRoleId
        status = 'active'
    }
    if ($createResponse.StatusCode -ne 200) { throw "Ephemeral admin creation failed status=$($createResponse.StatusCode)" }
    $createdUser = $createResponse.Content | ConvertFrom-Json
    $userId = [string]$createdUser.data.id
    $parsedUserId = [Guid]::Empty
    if (-not [Guid]::TryParse($userId, [ref]$parsedUserId)) { throw 'Ephemeral admin creation returned an invalid identifier.' }

    $initialLogin = Invoke-DirectusLogin -Email $userEmail -Password $userPassword
    $staffLogins.Add($initialLogin)
    $staffHeaders = @{ Authorization = "Bearer $($initialLogin.access_token)" }
    $generateResponse = Invoke-DirectusRequest -Method Post -Uri "$directusBaseUrl/users/me/tfa/generate/" -Headers $staffHeaders -Body @{
        password = $userPassword
    }
    if ($generateResponse.StatusCode -ne 200) { throw "Admin TFA generation failed status=$($generateResponse.StatusCode)" }
    $generated = $generateResponse.Content | ConvertFrom-Json
    $tfaSecret = [string]$generated.data.secret
    if ([string]::IsNullOrWhiteSpace($tfaSecret) -or [string]$generated.data.otpauth_url -notlike 'otpauth://totp/*') {
        throw 'Admin TFA generation returned invalid enrollment metadata.'
    }
    $enableResponse = Invoke-DirectusRequest -Method Post -Uri "$directusBaseUrl/users/me/tfa/enable/" -Headers $staffHeaders -Body @{
        secret = $tfaSecret
        otp = Get-TotpCode -Secret $tfaSecret
    }
    if ($enableResponse.StatusCode -notin @(200, 204)) { throw "Admin TFA enable failed status=$($enableResponse.StatusCode)" }

    $missingOtpResponse = Invoke-DirectusRequest -Method Post -Uri "$directusBaseUrl/auth/login" -Body @{
        email = $userEmail
        password = $userPassword
        mode = 'json'
    }
    if ($missingOtpResponse.StatusCode -ne 401) { throw 'Staff login without OTP was not denied after TFA enrollment.' }
    $missingOtpBody = $missingOtpResponse.Content | ConvertFrom-Json
    if ([string]$missingOtpBody.errors[0].extensions.code -ne 'INVALID_OTP') {
        throw 'Staff login without OTP returned an unexpected error code.'
    }

    $otpLogin = Invoke-DirectusLogin -Email $userEmail -Password $userPassword -Otp (Get-TotpCode -Secret $tfaSecret)
    $staffLogins.Add($otpLogin)

    $insertSql = "INSERT INTO app_security.sessions (session_id_hash, session_family_id, user_id, role_id, directus_access_token_ciphertext, directus_refresh_token_ciphertext, access_token_expires_at, created_at, last_seen_at, expires_at) VALUES ('$sessionHash', '$sessionFamily', '$userId', '$adminRoleId', 'v1.mfa-test', 'v1.mfa-test', CURRENT_TIMESTAMP + interval '10 minutes', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + interval '1 hour');"
    docker compose --env-file $RuntimeEnvPath exec -T database psql -v ON_ERROR_STOP=1 `
        -U $runtime['DB_USER'] -d $runtime['DB_DATABASE'] -c $insertSql | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'Unable to create the rolled-back MFA revocation fixture.' }

    $recoveryResponse = Invoke-DirectusRequest -Method Post -Uri "$directusBaseUrl/users/$userId/tfa/disable" -Headers $adminHeaders
    if ($recoveryResponse.StatusCode -notin @(200, 204)) { throw "Admin TFA recovery failed status=$($recoveryResponse.StatusCode)" }
    $revokeEvidence = docker compose --env-file $RuntimeEnvPath exec -T database psql -At -v ON_ERROR_STOP=1 `
        -U $runtime['DB_USER'] -d $runtime['DB_DATABASE'] `
        -c "SELECT COUNT(*) FROM app_security.sessions WHERE session_id_hash = '$sessionHash' AND revoked_at IS NOT NULL AND revoke_reason = 'identity_mfa_changed';"
    if ($LASTEXITCODE -ne 0 -or [int]([string]$revokeEvidence).Trim() -ne 1) {
        throw 'Admin TFA recovery did not revoke the application session fixture.'
    }

    $recoveryLogin = Invoke-DirectusLogin -Email $userEmail -Password $userPassword
    $staffLogins.Add($recoveryLogin)
    $directusLogs = docker compose --env-file $RuntimeEnvPath logs --no-color --tail 300 directus | Out-String
    if ($directusLogs.Contains($staffTfaSecret) -or $directusLogs.Contains($tfaSecret) -or $directusLogs.Contains($staffUserPassword) -or $directusLogs.Contains($userPassword)) {
        throw 'Directus logs exposed TFA enrollment or password material.'
    }

    Write-Output 'PHASE3_MFA_RUNTIME_TEST_OK managed_staff_enrollment=true managed_staff_missing_otp_denied=true managed_staff_otp_login=true admin_enrollment=true admin_missing_otp_denied=true admin_otp_login=true admin_recovery=true session_revoke=true totp_rfc6238=true log_redaction=true secrets_printed=false'
}
finally {
    foreach ($staffLogin in $staffLogins) {
        if (-not [string]::IsNullOrWhiteSpace($staffLogin.refresh_token)) {
            try {
                Invoke-DirectusRequest -Method Post -Uri "$directusBaseUrl/auth/logout" -Body @{
                    refresh_token = [string]$staffLogin.refresh_token
                    mode = 'json'
                } | Out-Null
            } catch {}
        }
    }
    if ($null -ne $adminLogin) {
        $remainingIds = @(docker compose --env-file $RuntimeEnvPath exec -T database psql -At -v ON_ERROR_STOP=1 `
            -U $runtime['DB_USER'] -d $runtime['DB_DATABASE'] `
            -c "SELECT id FROM directus_users WHERE email LIKE 'phase3-mfa-%@example.com';")
        if ($LASTEXITCODE -ne 0) { throw 'Unable to enumerate MFA test identities for cleanup.' }
        foreach ($ephemeralUserIdValue in @($remainingIds | Where-Object { -not [string]::IsNullOrWhiteSpace($_) })) {
            $ephemeralUserId = ([string]$ephemeralUserIdValue).Trim()
            $cleanupStatus = Remove-DirectusUser -UserId $ephemeralUserId -AccessToken $adminLogin.access_token
            if ($cleanupStatus -notin @(200, 204)) { throw "MFA test identity cleanup failed status=$cleanupStatus" }
            docker compose --env-file $RuntimeEnvPath exec -T database psql -v ON_ERROR_STOP=1 `
                -U $runtime['DB_USER'] -d $runtime['DB_DATABASE'] `
                -c "DELETE FROM app_security.audit_events WHERE actor_user_id = '$ephemeralUserId'; DELETE FROM app_security.sessions WHERE user_id = '$ephemeralUserId';" | Out-Null
            if ($LASTEXITCODE -ne 0) { throw 'MFA session/audit fixture cleanup failed.' }
        }
        $remainingCount = docker compose --env-file $RuntimeEnvPath exec -T database psql -At -v ON_ERROR_STOP=1 `
            -U $runtime['DB_USER'] -d $runtime['DB_DATABASE'] `
            -c "SELECT COUNT(*) FROM directus_users WHERE email LIKE 'phase3-mfa-%@example.com';"
        if ($LASTEXITCODE -ne 0 -or [int]([string]$remainingCount).Trim() -ne 0) {
            throw 'MFA test identities remain after cleanup.'
        }
        Write-Output 'PHASE3_MFA_FIXTURE_CLEANUP_OK users_remaining=0 secrets_printed=false'
    }
    if ($null -ne $adminLogin -and -not [string]::IsNullOrWhiteSpace($adminLogin.refresh_token)) {
        try {
            Invoke-DirectusRequest -Method Post -Uri "$directusBaseUrl/auth/logout" -Body @{
                refresh_token = [string]$adminLogin.refresh_token
                mode = 'json'
            } | Out-Null
        } catch {}
    }
    $httpClient.Dispose()
    $httpHandler.Dispose()
    Pop-Location
}
