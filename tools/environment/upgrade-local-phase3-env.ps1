param([string]$RuntimeEnvPath = '.env.local')

$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [Text.Encoding]::UTF8
$workspaceRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$runtimePath = [IO.Path]::GetFullPath((Join-Path $workspaceRoot $RuntimeEnvPath))
$workspacePrefix = $workspaceRoot.TrimEnd('\') + '\'
if (-not $runtimePath.StartsWith($workspacePrefix, [StringComparison]::OrdinalIgnoreCase)) {
    throw 'Runtime environment path must remain inside the workspace.'
}
if (-not (Test-Path -LiteralPath $runtimePath -PathType Leaf)) { throw 'Runtime environment file is missing.' }

function New-RandomBase64Url {
    param([ValidateRange(16, 128)][int]$ByteCount)
    $bytes = New-Object byte[] $ByteCount
    $generator = [Security.Cryptography.RandomNumberGenerator]::Create()
    try { $generator.GetBytes($bytes) } finally { $generator.Dispose() }
    return [Convert]::ToBase64String($bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_')
}

$existing = [ordered]@{}
Get-Content -LiteralPath $runtimePath | ForEach-Object {
    if ($_ -match '^([A-Za-z_][A-Za-z0-9_]*)=(.*)$') { $existing[$Matches[1]] = $Matches[2] }
}
$manifest = Get-Content -LiteralPath (Join-Path $workspaceRoot 'apps\directus\security\phase3-default-deny.json') -Raw | ConvertFrom-Json
$travelerRole = @($manifest.roles | Where-Object key -eq 'registered_traveler')
if ($travelerRole.Count -ne 1) { throw 'Registered Traveler role is missing or duplicated.' }

$values = [ordered]@{
    API_HOST_PORT = '8080'
    API_DB_USER = 'vnwa_api'
    API_DB_PASSWORD = New-RandomBase64Url 32
    DIRECTUS_LICENSE_KEY = ''
    DIRECTUS_LICENSE_TOKEN = ''
    DIRECTUS_ACCESS_TOKEN_TTL = '10m'
    DIRECTUS_REFRESH_TOKEN_TTL = '14d'
    DIRECTUS_PASSWORD_RESET_URL_ALLOW_LIST = 'http://localhost:8080/api/v1/auth/password/consume'
    DIRECTUS_USER_REGISTER_URL_ALLOW_LIST = 'http://localhost:8080/api/v1/auth/verification/consume'
    DIRECTUS_EMAIL_VERIFICATION_TOKEN_TTL = '15m'
    API_SERVICE_NAME = 'application-api'
    API_PORT = '8080'
    API_DIRECTUS_URL = 'http://directus:8055'
    API_ALLOWED_ORIGINS = 'http://localhost:8080'
    API_PASSWORD_RESET_CONSUME_URL = 'http://localhost:8080/api/v1/auth/password/consume'
    API_PASSWORD_RESET_REDIRECT_URL = 'http://localhost:8080/reset-password'
    API_PASSWORD_RESET_TTL_SECONDS = '900'
    API_PASSWORD_RESET_MIN_LENGTH = '12'
    API_EMAIL_VERIFICATION_CONSUME_URL = 'http://localhost:8080/api/v1/auth/verification/consume'
    API_EMAIL_VERIFICATION_REDIRECT_URL = 'http://localhost:8080/verify-email'
    API_EMAIL_VERIFICATION_TTL_SECONDS = '900'
    API_REGISTRATION_MIN_LENGTH = '12'
    API_TRAVELER_ROLE_ID = [string]$travelerRole[0].id
    API_SESSION_COOKIE_NAME = '__Host-vnwa_session'
    API_CSRF_COOKIE_NAME = '__Host-vnwa_csrf'
    API_SESSION_SAME_SITE = 'strict'
    API_SESSION_TTL_SECONDS = '1209600'
    API_USER_SESSION_LIMIT = '5'
    API_STAFF_SESSION_LIMIT = '2'
    API_MAX_BODY_BYTES = '16384'
    API_RATE_LIMIT_DEFAULT_MAX = '120'
    API_RATE_LIMIT_LOGIN_MAX = '5'
    API_RATE_LIMIT_WINDOW_MS = '60000'
    API_REDIS_TIMEOUT_MS = '2000'
    API_ACCESS_REFRESH_SKEW_MS = '60000'
    API_TRUST_PROXY = 'false'
    API_SESSION_ENCRYPTION_KEY = New-RandomBase64Url 32
    API_CSRF_SIGNING_KEY = New-RandomBase64Url 32
    SECURITY_SESSION_RETENTION_DAYS = '90'
    SECURITY_AUDIT_RETENTION_MONTHS = '12'
    BILLING_REFERENCE_RETENTION_MONTHS = '24'
}

$added = 0
foreach ($entry in $values.GetEnumerator()) {
    if (-not $existing.Contains($entry.Key)) {
        $existing[$entry.Key] = $entry.Value
        $added++
    }
}
$text = (($existing.GetEnumerator() | ForEach-Object { "$($_.Key)=$($_.Value)" }) -join "`n") + "`n"
[IO.File]::WriteAllText($runtimePath, $text, (New-Object Text.UTF8Encoding -ArgumentList $false))
Write-Output "LOCAL_PHASE3_ENV_UPGRADE_OK added=$added secrets_printed=false"
