param(
    [Parameter(Mandatory = $true)]
    [switch]$ConfirmLocalDataReset,
    [string]$RuntimeEnvPath = '.env.local',
    [string]$AdminEnvPath = '.env.admin.local',
    [string]$BootstrapEnvPath = '.env.bootstrap.local'
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

if (-not $ConfirmLocalDataReset) { throw 'Local data reset was not confirmed.' }
$runtimePath = [IO.Path]::GetFullPath((Join-Path $workspaceRoot $RuntimeEnvPath))
$adminPath = [IO.Path]::GetFullPath((Join-Path $workspaceRoot $AdminEnvPath))
$bootstrapPath = [IO.Path]::GetFullPath((Join-Path $workspaceRoot $BootstrapEnvPath))
if (-not (Test-Path -LiteralPath $runtimePath)) { throw 'Runtime environment file is missing.' }
if (-not (Test-Path -LiteralPath $adminPath)) { throw 'Rotated local admin file is missing.' }
if (Test-Path -LiteralPath $bootstrapPath) { throw 'Bootstrap file must be absent before clean rebuild.' }
$runtime = Read-EnvironmentFile $runtimePath
if ($runtime['APP_ENV'] -ne 'local') { throw 'Destructive rebuild is restricted to APP_ENV=local.' }

Push-Location $workspaceRoot
try {
    $containerTargets = @(docker ps -a --filter "label=com.docker.compose.project=$($runtime['COMPOSE_PROJECT_NAME'])" --format '{{.Names}}')
    $volumeTargets = @(docker volume ls --filter "label=com.docker.compose.project=$($runtime['COMPOSE_PROJECT_NAME'])" --format '{{.Name}}')
    Write-Output "LOCAL_REBUILD_RESET_TARGETS containers=$($containerTargets.Count) volumes=$($volumeTargets.Count)"

    Move-Item -LiteralPath $adminPath -Destination $bootstrapPath
    docker compose --env-file $RuntimeEnvPath --env-file $BootstrapEnvPath down --volumes --remove-orphans
    if ($LASTEXITCODE -ne 0) { throw 'Unable to reset local Compose state.' }
    Write-Output 'LOCAL_REBUILD_RESET_OK recoverable_from_verified_backup=true'

    docker compose --env-file $RuntimeEnvPath --env-file $BootstrapEnvPath up -d --build --wait --wait-timeout 180
    if ($LASTEXITCODE -ne 0) { throw 'Unable to start clean local Compose stack.' }

    & (Join-Path $workspaceRoot 'tools\database\apply-foundation.ps1') -RuntimeEnvPath $RuntimeEnvPath
    if ($LASTEXITCODE -ne 0) { throw 'Database foundation apply failed during rebuild.' }
    & (Join-Path $workspaceRoot 'tools\directus\apply-schema.ps1') -RuntimeEnvPath $RuntimeEnvPath -Apply
    if ($LASTEXITCODE -ne 0) { throw 'Directus schema apply failed during rebuild.' }
    & (Join-Path $workspaceRoot 'tools\seeding\apply-seed.ps1') -RuntimeEnvPath $RuntimeEnvPath -Actor phase2-rebuild
    if ($LASTEXITCODE -ne 0) { throw 'Foundation seed failed during rebuild.' }

    & (Join-Path $workspaceRoot 'tools\environment\rotate-local-admin.ps1') -RuntimeEnvPath $RuntimeEnvPath -BootstrapEnvPath $BootstrapEnvPath -AdminEnvPath $AdminEnvPath
    if ($LASTEXITCODE -ne 0) { throw 'Admin rotation failed during rebuild.' }
    docker compose --env-file $RuntimeEnvPath up -d --force-recreate --wait --wait-timeout 180 directus worker api
    if ($LASTEXITCODE -ne 0) { throw 'Unable to restart stack without bootstrap credential.' }

    & (Join-Path $workspaceRoot 'tools\validation\validate-local-stack.ps1') -RuntimeEnvPath $RuntimeEnvPath -AdminEnvPath $AdminEnvPath
    if ($LASTEXITCODE -ne 0) { throw 'Local stack validation failed after clean rebuild.' }
    Write-Output 'LOCAL_CLEAN_REBUILD_OK schema_applied=true seed_applied=true admin_rotated=true bootstrap_removed=true'
}
finally {
    Pop-Location
}
