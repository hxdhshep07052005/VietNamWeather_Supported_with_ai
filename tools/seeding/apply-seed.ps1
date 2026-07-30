param(
    [Parameter(Mandatory = $true)]
    [ValidatePattern('^[A-Za-z0-9][A-Za-z0-9._-]{1,127}$')]
    [string]$Actor,

    [string]$RuntimeEnvPath = '.env.local',
    [string]$ManifestPath = 'apps/directus/seeds/foundation.json'
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

$manifestFile = [IO.Path]::GetFullPath((Join-Path $workspaceRoot $ManifestPath))
$workspacePrefix = $workspaceRoot.TrimEnd('\') + '\'
if (-not $manifestFile.StartsWith($workspacePrefix, [StringComparison]::OrdinalIgnoreCase)) {
    throw 'Seed manifest path must remain inside the workspace.'
}
if (-not (Test-Path -LiteralPath $manifestFile -PathType Leaf)) { throw 'Seed manifest is missing.' }

$runtime = Read-EnvironmentFile ([IO.Path]::GetFullPath((Join-Path $workspaceRoot $RuntimeEnvPath)))
$environment = [string]$runtime['APP_ENV']
if ($environment -notmatch '^[a-z][a-z0-9_-]{1,31}$') { throw 'APP_ENV is missing or invalid.' }

$manifest = Get-Content -LiteralPath $manifestFile -Raw | ConvertFrom-Json
if ($manifest.manifestVersion -ne 1) { throw 'Unsupported seed manifest version.' }
if ([string]$manifest.key -notmatch '^[a-z0-9][a-z0-9._-]{1,127}$') { throw 'Seed manifest key is invalid.' }
if ([string]$manifest.version -notmatch '^[0-9][0-9A-Za-z._-]{1,63}$') { throw 'Seed manifest version is invalid.' }
if (@($manifest.environmentScopes) -notcontains $environment) { throw 'Seed manifest is not approved for this environment.' }
if (@($manifest.provenance).Count -eq 0) { throw 'Seed manifest provenance is required.' }

$operations = @($manifest.operations)
if ($operations.Count -gt 0) {
    throw 'This Phase 2 runner has no approved business-operation handler; refusing to ignore manifest operations.'
}

$checksum = (Get-FileHash -Algorithm SHA256 -LiteralPath $manifestFile).Hash.ToLowerInvariant()
$auditSql = Join-Path $workspaceRoot 'tools\seeding\record-seed-run.sql'

Push-Location $workspaceRoot
try {
    $result = Get-Content -LiteralPath $auditSql | docker compose --env-file $RuntimeEnvPath exec -T database psql -qAt -v ON_ERROR_STOP=1 -U $runtime['DB_USER'] -d $runtime['DB_DATABASE'] -v "seed_key=$($manifest.key)" -v "seed_version=$($manifest.version)" -v "seed_checksum=$checksum" -v "seed_environment=$environment" -v "seed_actor=$Actor" -v "seed_operation_count=$($operations.Count)"
    if ($LASTEXITCODE -ne 0) { throw 'Seed audit transaction failed.' }
    $state = ([string]$result).Trim()
    if ($state -eq 'checksum_mismatch') { throw 'Seed manifest version already exists with a different checksum.' }
    if ($state -notin @('applied', 'skipped')) { throw 'Seed audit returned an unexpected state.' }
    Write-Output "SEED_RUN_OK state=$state key=$($manifest.key) version=$($manifest.version) environment=$environment operations=$($operations.Count) checksum=$checksum"
}
finally {
    Pop-Location
}
