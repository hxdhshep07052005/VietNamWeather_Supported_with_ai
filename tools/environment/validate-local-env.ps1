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
        'WORKER_HOST_PORT',
        'MAILPIT_SMTP_HOST_PORT',
        'MAILPIT_UI_HOST_PORT',
        'DB_DATABASE',
        'DB_USER',
        'DB_PASSWORD',
        'REDIS_PASSWORD',
        'DIRECTUS_KEY',
        'DIRECTUS_SECRET',
        'DIRECTUS_PUBLIC_URL',
        'DIRECTUS_EMAIL_FROM',
        'WORKER_SERVICE_NAME',
        'WORKER_PORT'
    )) {
        if ([string]::IsNullOrWhiteSpace($runtime[$name])) { $failures.Add("Missing runtime value: $name") }
    }
    foreach ($name in @('DIRECTUS_ADMIN_EMAIL', 'DIRECTUS_ADMIN_PASSWORD')) {
        if ([string]::IsNullOrWhiteSpace($credential[$name])) { $failures.Add("Missing local admin value: $name") }
    }
    foreach ($name in @('DB_PASSWORD', 'REDIS_PASSWORD', 'DIRECTUS_KEY')) {
        if ([string]$runtime[$name] -and ([string]$runtime[$name]).Length -lt 32) {
            $failures.Add("Runtime secret is shorter than required: $name")
        }
    }
    if ([string]$runtime['DIRECTUS_SECRET'] -and ([string]$runtime['DIRECTUS_SECRET']).Length -lt 64) {
        $failures.Add('Runtime secret is shorter than required: DIRECTUS_SECRET')
    }
    if ([string]$credential['DIRECTUS_ADMIN_PASSWORD'] -and ([string]$credential['DIRECTUS_ADMIN_PASSWORD']).Length -lt 24) {
        $failures.Add('Local admin password is shorter than required')
    }
    $secretValues = @(
        $runtime['DB_PASSWORD'],
        $runtime['REDIS_PASSWORD'],
        $runtime['DIRECTUS_KEY'],
        $runtime['DIRECTUS_SECRET'],
        $credential['DIRECTUS_ADMIN_PASSWORD']
    )
    if (@($secretValues | Group-Object | Where-Object Count -gt 1).Count -gt 0) {
        $failures.Add('Generated secret values must be distinct')
    }
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
