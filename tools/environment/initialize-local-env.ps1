param(
    [Parameter(Mandatory = $true)]
    [ValidatePattern('^[^\s@]+@[^\s@]+\.[^\s@]+$')]
    [string]$AdminEmail,

    [string]$RuntimeEnvPath = '.env.local',
    [string]$BootstrapEnvPath = '.env.bootstrap.local',

    [ValidateRange(1, 65535)]
    [int]$DirectusHostPort = 8055,

    [ValidateRange(1, 65535)]
    [int]$ApiHostPort = 8080,

    [ValidateRange(1, 65535)]
    [int]$WorkerHostPort = 8081,

    [ValidateRange(1, 65535)]
    [int]$MailpitSmtpHostPort = 1025,

    [ValidateRange(1, 65535)]
    [int]$MailpitUiHostPort = 8025,

    [switch]$Force
)

$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [Text.Encoding]::UTF8

$workspaceRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path

function Resolve-WorkspaceOutputPath {
    param([string]$Path)

    $fullPath = [IO.Path]::GetFullPath((Join-Path $workspaceRoot $Path))
    $workspacePrefix = $workspaceRoot.TrimEnd('\') + '\'
    if (-not $fullPath.StartsWith($workspacePrefix, [StringComparison]::OrdinalIgnoreCase)) {
        throw 'Environment output path must remain inside the workspace.'
    }
    return $fullPath
}

function New-RandomBase64Url {
    param([ValidateRange(16, 128)][int]$ByteCount)

    $bytes = New-Object byte[] $ByteCount
    $generator = [Security.Cryptography.RandomNumberGenerator]::Create()
    try {
        $generator.GetBytes($bytes)
    }
    finally {
        $generator.Dispose()
    }
    return [Convert]::ToBase64String($bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_')
}

$runtimePath = Resolve-WorkspaceOutputPath $RuntimeEnvPath
$bootstrapPath = Resolve-WorkspaceOutputPath $BootstrapEnvPath
$securityManifestPath = Join-Path $workspaceRoot 'apps\directus\security\phase3-default-deny.json'
if (-not (Test-Path -LiteralPath $securityManifestPath -PathType Leaf)) {
    throw 'Phase 3 security manifest is missing.'
}
$securityManifest = Get-Content -LiteralPath $securityManifestPath -Raw | ConvertFrom-Json
$travelerRole = @($securityManifest.roles | Where-Object key -eq 'registered_traveler')
if ($travelerRole.Count -ne 1) { throw 'Registered Traveler role is missing or duplicated.' }
foreach ($path in @($runtimePath, $bootstrapPath)) {
    if ((Test-Path -LiteralPath $path) -and -not $Force) {
        throw 'A local environment file already exists. Use -Force only after confirming rotation/overwrite intent.'
    }
}

$runtimeValues = [ordered]@{
    COMPOSE_PROJECT_NAME = 'vietnam_weather_local'
    APP_ENV = 'local'
    DIRECTUS_HOST_PORT = $DirectusHostPort
    API_HOST_PORT = $ApiHostPort
    WORKER_HOST_PORT = $WorkerHostPort
    MAILPIT_SMTP_HOST_PORT = $MailpitSmtpHostPort
    MAILPIT_UI_HOST_PORT = $MailpitUiHostPort
    DB_DATABASE = 'directus'
    DB_USER = 'directus'
    DB_PASSWORD = New-RandomBase64Url 32
    REDIS_PASSWORD = New-RandomBase64Url 32
    API_DB_USER = 'vnwa_api'
    API_DB_PASSWORD = New-RandomBase64Url 32
    DIRECTUS_KEY = New-RandomBase64Url 32
    DIRECTUS_SECRET = New-RandomBase64Url 64
    DIRECTUS_PUBLIC_URL = "http://localhost:$DirectusHostPort"
    DIRECTUS_EMAIL_FROM = 'noreply@localhost.invalid'
    DIRECTUS_PASSWORD_RESET_URL_ALLOW_LIST = "http://localhost:$ApiHostPort/api/v1/auth/password/consume"
    DIRECTUS_USER_REGISTER_URL_ALLOW_LIST = "http://localhost:$ApiHostPort/api/v1/auth/verification/consume"
    DIRECTUS_EMAIL_VERIFICATION_TOKEN_TTL = '15m'
    DIRECTUS_ACCESS_TOKEN_TTL = '10m'
    DIRECTUS_REFRESH_TOKEN_TTL = '14d'
    DIRECTUS_LICENSE_KEY = ''
    DIRECTUS_LICENSE_TOKEN = ''
    API_SERVICE_NAME = 'application-api'
    API_PORT = 8080
    API_DIRECTUS_URL = 'http://directus:8055'
    API_ALLOWED_ORIGINS = "http://localhost:$ApiHostPort"
    API_PASSWORD_RESET_CONSUME_URL = "http://localhost:$ApiHostPort/api/v1/auth/password/consume"
    API_PASSWORD_RESET_REDIRECT_URL = "http://localhost:$ApiHostPort/reset-password"
    API_PASSWORD_RESET_TTL_SECONDS = 900
    API_PASSWORD_RESET_MIN_LENGTH = 12
    API_EMAIL_VERIFICATION_CONSUME_URL = "http://localhost:$ApiHostPort/api/v1/auth/verification/consume"
    API_EMAIL_VERIFICATION_REDIRECT_URL = "http://localhost:$ApiHostPort/verify-email"
    API_EMAIL_VERIFICATION_TTL_SECONDS = 900
    API_REGISTRATION_MIN_LENGTH = 12
    API_TRAVELER_ROLE_ID = [string]$travelerRole[0].id
    API_SESSION_COOKIE_NAME = '__Host-vnwa_session'
    API_CSRF_COOKIE_NAME = '__Host-vnwa_csrf'
    API_SESSION_SAME_SITE = 'strict'
    API_SESSION_TTL_SECONDS = 1209600
    API_USER_SESSION_LIMIT = 5
    API_STAFF_SESSION_LIMIT = 2
    API_MAX_BODY_BYTES = 16384
    API_RATE_LIMIT_DEFAULT_MAX = 120
    API_RATE_LIMIT_LOGIN_MAX = 5
    API_RATE_LIMIT_WINDOW_MS = 60000
    API_REDIS_TIMEOUT_MS = 2000
    API_ACCESS_REFRESH_SKEW_MS = 60000
    API_TRUST_PROXY = 'false'
    API_SESSION_ENCRYPTION_KEY = New-RandomBase64Url 32
    API_CSRF_SIGNING_KEY = New-RandomBase64Url 32
    SECURITY_SESSION_RETENTION_DAYS = 90
    SECURITY_AUDIT_RETENTION_MONTHS = 12
    BILLING_REFERENCE_RETENTION_MONTHS = 24
    WORKER_SERVICE_NAME = 'integration-worker'
    WORKER_PORT = 8081
}

$bootstrapValues = [ordered]@{
    DIRECTUS_ADMIN_EMAIL = $AdminEmail
    DIRECTUS_ADMIN_PASSWORD = New-RandomBase64Url 24
}

function ConvertTo-EnvironmentText {
    param([Collections.IDictionary]$Values)
    return (($Values.GetEnumerator() | ForEach-Object { "$($_.Key)=$($_.Value)" }) -join "`n") + "`n"
}

$utf8NoBom = New-Object Text.UTF8Encoding -ArgumentList $false
[IO.File]::WriteAllText($runtimePath, (ConvertTo-EnvironmentText $runtimeValues), $utf8NoBom)
[IO.File]::WriteAllText($bootstrapPath, (ConvertTo-EnvironmentText $bootstrapValues), $utf8NoBom)

Write-Output 'LOCAL_ENV_INITIALIZED runtime=.env.local bootstrap=.env.bootstrap.local secrets_printed=false'
