param(
    [string]$RuntimeEnvPath = '.env.local',
    [string]$BootstrapEnvPath = '.env.bootstrap.local',
    [string]$AdminEnvPath = '.env.admin.local'
)

$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [Text.Encoding]::UTF8
$workspaceRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$failures = New-Object Collections.Generic.List[string]

function Read-EnvironmentFile {
    param([string]$Path)

    $values = @{}
    Get-Content -LiteralPath $Path | ForEach-Object {
        if ($_ -match '^([A-Za-z_][A-Za-z0-9_]*)=(.*)$') {
            $values[$Matches[1]] = $Matches[2]
        }
    }
    return $values
}

$runtimePath = [IO.Path]::GetFullPath((Join-Path $workspaceRoot $RuntimeEnvPath))
$bootstrapPath = [IO.Path]::GetFullPath((Join-Path $workspaceRoot $BootstrapEnvPath))
$adminPath = [IO.Path]::GetFullPath((Join-Path $workspaceRoot $AdminEnvPath))
if (-not (Test-Path -LiteralPath $runtimePath)) { $failures.Add('Missing local runtime environment file') }
$hasBootstrap = Test-Path -LiteralPath $bootstrapPath
$hasAdmin = Test-Path -LiteralPath $adminPath
if ($hasBootstrap -eq $hasAdmin) { $failures.Add('Exactly one local admin credential state must exist: bootstrap or rotated') }

if ($failures.Count -eq 0) {
    $runtime = Read-EnvironmentFile $runtimePath
    $credential = Read-EnvironmentFile $(if ($hasBootstrap) { $bootstrapPath } else { $adminPath })
    foreach ($name in @(
        'COMPOSE_PROJECT_NAME',
        'APP_ENV',
        'DIRECTUS_HOST_PORT',
        'API_HOST_PORT',
        'WORKER_HOST_PORT',
        'MAILPIT_SMTP_HOST_PORT',
        'MAILPIT_UI_HOST_PORT',
        'DB_DATABASE',
        'DB_USER',
        'DB_PASSWORD',
        'REDIS_PASSWORD',
        'API_DB_USER',
        'API_DB_PASSWORD',
        'DIRECTUS_KEY',
        'DIRECTUS_SECRET',
        'DIRECTUS_PUBLIC_URL',
        'DIRECTUS_EMAIL_FROM',
        'DIRECTUS_PASSWORD_RESET_URL_ALLOW_LIST',
        'DIRECTUS_USER_REGISTER_URL_ALLOW_LIST',
        'DIRECTUS_EMAIL_VERIFICATION_TOKEN_TTL',
        'DIRECTUS_ACCESS_TOKEN_TTL',
        'DIRECTUS_REFRESH_TOKEN_TTL',
        'API_SERVICE_NAME',
        'API_PORT',
        'API_DIRECTUS_URL',
        'API_ALLOWED_ORIGINS',
        'API_PASSWORD_RESET_CONSUME_URL',
        'API_PASSWORD_RESET_REDIRECT_URL',
        'API_PASSWORD_RESET_TTL_SECONDS',
        'API_PASSWORD_RESET_MIN_LENGTH',
        'API_EMAIL_VERIFICATION_CONSUME_URL',
        'API_EMAIL_VERIFICATION_REDIRECT_URL',
        'API_EMAIL_VERIFICATION_TTL_SECONDS',
        'API_REGISTRATION_MIN_LENGTH',
        'API_TRAVELER_ROLE_ID',
        'API_SESSION_COOKIE_NAME',
        'API_CSRF_COOKIE_NAME',
        'API_SESSION_SAME_SITE',
        'API_SESSION_TTL_SECONDS',
        'API_USER_SESSION_LIMIT',
        'API_STAFF_SESSION_LIMIT',
        'API_MAX_BODY_BYTES',
        'API_RATE_LIMIT_DEFAULT_MAX',
        'API_RATE_LIMIT_LOGIN_MAX',
        'API_RATE_LIMIT_WINDOW_MS',
        'API_REDIS_TIMEOUT_MS',
        'API_ACCESS_REFRESH_SKEW_MS',
        'API_TRUST_PROXY',
        'API_SESSION_ENCRYPTION_KEY',
        'API_CSRF_SIGNING_KEY',
        'SECURITY_SESSION_RETENTION_DAYS',
        'SECURITY_AUDIT_RETENTION_MONTHS',
        'BILLING_REFERENCE_RETENTION_MONTHS',
        'WORKER_SERVICE_NAME',
        'WORKER_PORT'
    )) {
        if ([string]::IsNullOrWhiteSpace($runtime[$name])) { $failures.Add("Missing runtime value: $name") }
    }
    foreach ($name in @('DIRECTUS_ADMIN_EMAIL', 'DIRECTUS_ADMIN_PASSWORD')) {
        if ([string]::IsNullOrWhiteSpace($credential[$name])) { $failures.Add("Missing local admin value: $name") }
    }
    foreach ($name in @('DB_PASSWORD', 'REDIS_PASSWORD', 'API_DB_PASSWORD', 'DIRECTUS_KEY')) {
        if ([string]$runtime[$name] -and ([string]$runtime[$name]).Length -lt 32) {
            $failures.Add("Runtime secret is shorter than required: $name")
        }
    }
    if ([string]$runtime['DIRECTUS_SECRET'] -and ([string]$runtime['DIRECTUS_SECRET']).Length -lt 64) {
        $failures.Add('Runtime secret is shorter than required: DIRECTUS_SECRET')
    }
    foreach ($name in @('API_SESSION_ENCRYPTION_KEY', 'API_CSRF_SIGNING_KEY')) {
        if ([string]$runtime[$name] -and ([string]$runtime[$name]).Length -lt 43) {
            $failures.Add("Runtime secret is shorter than required: $name")
        }
    }
    if ([string]$credential['DIRECTUS_ADMIN_PASSWORD'] -and ([string]$credential['DIRECTUS_ADMIN_PASSWORD']).Length -lt 24) {
        $failures.Add('Local admin password is shorter than required')
    }
    if (-not [string]::IsNullOrWhiteSpace($runtime['DIRECTUS_LICENSE_KEY']) -and -not [string]::IsNullOrWhiteSpace($runtime['DIRECTUS_LICENSE_TOKEN'])) {
        $failures.Add('DIRECTUS_LICENSE_KEY and DIRECTUS_LICENSE_TOKEN cannot both be set')
    }
    $secretValues = @(
        $runtime['DB_PASSWORD'],
        $runtime['REDIS_PASSWORD'],
        $runtime['API_DB_PASSWORD'],
        $runtime['DIRECTUS_KEY'],
        $runtime['DIRECTUS_SECRET'],
        $runtime['API_SESSION_ENCRYPTION_KEY'],
        $runtime['API_CSRF_SIGNING_KEY'],
        $credential['DIRECTUS_ADMIN_PASSWORD']
    )
    if (@($secretValues | Group-Object | Where-Object Count -gt 1).Count -gt 0) {
        $failures.Add('Generated secret values must be distinct')
    }
    $manifestPath = Join-Path $workspaceRoot 'apps\directus\security\phase3-default-deny.json'
    if (-not (Test-Path -LiteralPath $manifestPath -PathType Leaf)) {
        $failures.Add('Phase 3 security manifest is missing')
    }
    else {
        $manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
        $travelerRole = @($manifest.roles | Where-Object key -eq 'registered_traveler')
        if ($travelerRole.Count -ne 1 -or [string]$runtime['API_TRAVELER_ROLE_ID'] -ne [string]$travelerRole[0].id) {
            $failures.Add('API traveler role does not match the approved security manifest')
        }
    }
    if ([string]$runtime['DIRECTUS_ACCESS_TOKEN_TTL'] -ne '10m') { $failures.Add('Directus access token TTL must match SEC-004') }
    if ([string]$runtime['DIRECTUS_REFRESH_TOKEN_TTL'] -ne '14d') { $failures.Add('Directus refresh token TTL must match SEC-004') }
    if ([int]$runtime['API_SESSION_TTL_SECONDS'] -gt 1209600) { $failures.Add('Application session TTL exceeds SEC-004') }
    if ([int]$runtime['API_USER_SESSION_LIMIT'] -ne 5) { $failures.Add('User session limit must match SEC-004') }
    if ([int]$runtime['API_STAFF_SESSION_LIMIT'] -ne 2) { $failures.Add('Staff session limit must match SEC-004') }
    if ([string]$runtime['API_SESSION_COOKIE_NAME'] -notmatch '^__Host-') { $failures.Add('Session cookie must use __Host- prefix') }
    if ([string]$runtime['API_CSRF_COOKIE_NAME'] -notmatch '^__Host-') { $failures.Add('CSRF cookie must use __Host- prefix') }
    if ([string]$runtime['API_ALLOWED_ORIGINS'] -match '(^|,)\s*\*\s*(,|$)') { $failures.Add('Wildcard API origin is forbidden') }
    if ([string]$runtime['DIRECTUS_PASSWORD_RESET_URL_ALLOW_LIST'] -ne [string]$runtime['API_PASSWORD_RESET_CONSUME_URL']) { $failures.Add('Directus password reset allowlist must match the Application API consume URL') }
    if ([string]$runtime['DIRECTUS_USER_REGISTER_URL_ALLOW_LIST'] -ne [string]$runtime['API_EMAIL_VERIFICATION_CONSUME_URL']) { $failures.Add('Directus registration allowlist must match the Application API verification consume URL') }
    try {
        $consumeUrl = [Uri]$runtime['API_PASSWORD_RESET_CONSUME_URL']
        $redirectUrl = [Uri]$runtime['API_PASSWORD_RESET_REDIRECT_URL']
        if (-not $consumeUrl.IsAbsoluteUri -or -not $redirectUrl.IsAbsoluteUri -or $consumeUrl.Query -or $consumeUrl.Fragment -or $redirectUrl.Query -or $redirectUrl.Fragment) { throw 'invalid' }
        if ($consumeUrl.AbsolutePath -ne '/api/v1/auth/password/consume') { throw 'invalid' }
    }
    catch { $failures.Add('Password reset URLs must be absolute, query-free and use the approved consume path') }
    try {
        $verifyConsumeUrl = [Uri]$runtime['API_EMAIL_VERIFICATION_CONSUME_URL']
        $verifyRedirectUrl = [Uri]$runtime['API_EMAIL_VERIFICATION_REDIRECT_URL']
        if (-not $verifyConsumeUrl.IsAbsoluteUri -or -not $verifyRedirectUrl.IsAbsoluteUri -or $verifyConsumeUrl.Query -or $verifyConsumeUrl.Fragment -or $verifyRedirectUrl.Query -or $verifyRedirectUrl.Fragment) { throw 'invalid' }
        if ($verifyConsumeUrl.AbsolutePath -ne '/api/v1/auth/verification/consume') { throw 'invalid' }
    }
    catch { $failures.Add('Email verification URLs must be absolute, query-free and use the approved consume path') }
    if ([int]$runtime['API_PASSWORD_RESET_TTL_SECONDS'] -lt 300 -or [int]$runtime['API_PASSWORD_RESET_TTL_SECONDS'] -gt 3600) { $failures.Add('Password reset TTL is outside the approved 5-60 minute range') }
    if ([int]$runtime['API_REDIS_TIMEOUT_MS'] -lt 250 -or [int]$runtime['API_REDIS_TIMEOUT_MS'] -gt 10000) { $failures.Add('Redis timeout is outside the approved 250ms-10s range') }
    if ([int]$runtime['API_PASSWORD_RESET_MIN_LENGTH'] -lt 8 -or [int]$runtime['API_PASSWORD_RESET_MIN_LENGTH'] -gt 128) { $failures.Add('Password reset minimum length is outside the approved range') }
    if ([int]$runtime['API_EMAIL_VERIFICATION_TTL_SECONDS'] -lt 300 -or [int]$runtime['API_EMAIL_VERIFICATION_TTL_SECONDS'] -gt 3600) { $failures.Add('Email verification TTL is outside the approved 5-60 minute range') }
    if ([int]$runtime['API_REGISTRATION_MIN_LENGTH'] -lt 8 -or [int]$runtime['API_REGISTRATION_MIN_LENGTH'] -gt 128) { $failures.Add('Registration minimum length is outside the approved range') }
    if ([int]$runtime['SECURITY_SESSION_RETENTION_DAYS'] -ne 90) { $failures.Add('Session/security retention must match DATA-006') }
    if ([int]$runtime['SECURITY_AUDIT_RETENTION_MONTHS'] -ne 12) { $failures.Add('Security audit retention must match DATA-006') }
    if ([int]$runtime['BILLING_REFERENCE_RETENTION_MONTHS'] -ne 24) { $failures.Add('Billing reference retention must match DATA-006') }
}

Push-Location $workspaceRoot
try {
    $credentialRelativePath = if ($hasBootstrap) { $BootstrapEnvPath } else { $AdminEnvPath }
    foreach ($relativePath in @($RuntimeEnvPath, $credentialRelativePath)) {
        git check-ignore $relativePath | Out-Null
        if ($LASTEXITCODE -ne 0) { $failures.Add("Local environment file is not Git-ignored: $relativePath") }
    }
}
finally {
    Pop-Location
}

if ($failures.Count -gt 0) {
    Write-Output "LOCAL_ENV_VALIDATION_FAILED count=$($failures.Count)"
    $failures | ForEach-Object { Write-Output "FAIL $_" }
    exit 1
}

$credentialState = if ($hasBootstrap) { 'bootstrap' } else { 'rotated' }
Write-Output "LOCAL_ENV_VALIDATION_OK secrets_printed=false git_ignored=true credential_state=$credentialState"
