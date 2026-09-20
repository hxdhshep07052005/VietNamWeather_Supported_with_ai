param(
    [string]$OutputPath = ".env.production",
    [switch]$Force = $false
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RootDir = Split-Path -Parent (Split-Path -Parent $ScriptDir)
$TargetFile = Join-Path $RootDir $OutputPath

if ((Test-Path $TargetFile) -and -not $Force) {
    Write-Host "File already exists at $TargetFile. Use -Force to overwrite." -ForegroundColor Yellow
    exit 0
}

function New-CryptoHex {
    param([int]$Bytes = 32)
    $bytesObj = New-Object byte[] $Bytes
    $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    $rng.GetBytes($bytesObj)
    return [System.BitConverter]::ToString($bytesObj).Replace("-", "").ToLowerInvariant()
}

function New-CryptoBase64Url {
    param([int]$Bytes = 32)
    $bytesObj = New-Object byte[] $Bytes
    $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    $rng.GetBytes($bytesObj)
    $b64 = [System.Convert]::ToBase64String($bytesObj)
    return $b64.Replace("+", "-").Replace("/", "_").TrimEnd("=")
}

$dbPassword = New-CryptoHex 32
$apiDbPassword = New-CryptoHex 32
$workerDbPassword = New-CryptoHex 32
$redisPassword = New-CryptoHex 32
$directusKey = New-CryptoHex 32
$directusSecret = New-CryptoHex 64
$sessionKey = New-CryptoBase64Url 32
$csrfKey = New-CryptoBase64Url 32

$configContent = @"
# Production Environment Configuration
# Generated automatically by tools/environment/generate-production-secrets.ps1
# Decisions: OPS-003, OPS-008, OPS-009, OPS-014

COMPOSE_PROJECT_NAME=vietnam_weather_prod
APP_ENV=production
NODE_ENV=production

# Database Configuration (PostgreSQL + PostGIS 16)
DB_DATABASE=directus
DB_USER=directus
DB_PASSWORD=$dbPassword
API_DB_USER=vnwa_api
API_DB_PASSWORD=$apiDbPassword

# Redis 7 Cache & Queue
REDIS_PASSWORD=$redisPassword

# Directus CMS & Identity
DIRECTUS_KEY=$directusKey
DIRECTUS_SECRET=$directusSecret
DIRECTUS_PUBLIC_URL=https://api.weather.example.vn
DIRECTUS_HOST_PORT=8055
DIRECTUS_PASSWORD_RESET_URL_ALLOW_LIST=https://weather.example.vn/api/v1/auth/password/consume
DIRECTUS_USER_REGISTER_URL_ALLOW_LIST=https://weather.example.vn/api/v1/auth/verification/consume
DIRECTUS_EMAIL_VERIFICATION_TOKEN_TTL=15m
DIRECTUS_ACCESS_TOKEN_TTL=10m
DIRECTUS_REFRESH_TOKEN_TTL=14d
DIRECTUS_EMAIL_FROM=noreply@weather.example.vn

# Integration Worker
WORKER_SERVICE_NAME=integration-worker
WORKER_PORT=8081
WEATHER_WORKER_DB_USER=vnwa_worker
WEATHER_WORKER_DB_PASSWORD=$workerDbPassword
WEATHER_WORKER_ID=worker_prod_01
WEATHER_WORKER_POLL_INTERVAL_MS=60000
WEATHER_WORKER_LEASE_DURATION_MS=120000
WEATHER_WORKER_HEARTBEAT_INTERVAL_MS=30000
WEATHER_WORKER_RETRY_BASE_DELAY_MS=5000
WEATHER_WORKER_RETRY_MAX_DELAY_MS=60000
WEATHER_WORKER_RETRY_JITTER_RATIO=0.2
WEATHER_PROVIDER_KEY=weatherapi
WEATHERAPI_API_KEY=whsec_replace_with_live_provider_key
WEATHER_PROVIDER_TIMEOUT_MS=8000
WEATHER_PARSER_VERSION=weatherapi-forecast-v1
WEATHER_PROVIDER_CIRCUIT_FAILURE_THRESHOLD=3
WEATHER_PROVIDER_CIRCUIT_RESET_MS=60000
WEATHERAPI_FORECAST_DAYS=3

# Application API
API_SERVICE_NAME=application-api
API_PORT=8080
API_ALLOWED_ORIGINS=https://weather.example.vn
API_PASSWORD_RESET_CONSUME_URL=https://weather.example.vn/api/v1/auth/password/consume
API_PASSWORD_RESET_REDIRECT_URL=https://weather.example.vn/reset-password
API_PASSWORD_RESET_TTL_SECONDS=900
API_PASSWORD_RESET_MIN_LENGTH=12
API_EMAIL_VERIFICATION_CONSUME_URL=https://weather.example.vn/api/v1/auth/verification/consume
API_EMAIL_VERIFICATION_REDIRECT_URL=https://weather.example.vn/verify-email
API_EMAIL_VERIFICATION_TTL_SECONDS=900
API_REGISTRATION_MIN_LENGTH=12
API_TRAVELER_ROLE_ID=00000000-0000-4000-8000-000000000001
API_SESSION_COOKIE_NAME=__Host-vnwa_session
API_CSRF_COOKIE_NAME=__Host-vnwa_csrf
API_SESSION_SAME_SITE=strict
API_SESSION_TTL_SECONDS=1209600
API_USER_SESSION_LIMIT=5
API_STAFF_SESSION_LIMIT=2
API_MAX_BODY_BYTES=16384
API_RATE_LIMIT_DEFAULT_MAX=120
API_RATE_LIMIT_LOGIN_MAX=5
API_RATE_LIMIT_WINDOW_MS=60000
API_RATE_LIMIT_WEATHER_MAX=60
API_WEATHER_CACHE_TTL_SECONDS=1800
API_WEATHER_PENDING_RETRY_SECONDS=30
API_REDIS_TIMEOUT_MS=2000
API_ACCESS_REFRESH_SKEW_MS=60000
API_TRUST_PROXY=true
API_SESSION_ENCRYPTION_KEY=$sessionKey
API_CSRF_SIGNING_KEY=$csrfKey

# Web Frontend Reverse Proxy
WEB_HOST_PORT=80
"@

Set-Content -Path $TargetFile -Value $configContent -Encoding utf8
Write-Host "Generated secure production configuration at: $TargetFile" -ForegroundColor Green
