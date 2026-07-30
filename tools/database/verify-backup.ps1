param(
    [Parameter(Mandatory = $true)]
    [string]$BackupPath,
    [string]$RuntimeEnvPath = '.env.local'
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

$backup = [IO.Path]::GetFullPath((Join-Path $workspaceRoot $BackupPath))
$allowedRoot = [IO.Path]::GetFullPath((Join-Path $workspaceRoot 'artifacts\phase2\local\backups')).TrimEnd('\') + '\'
if (-not $backup.StartsWith($allowedRoot, [StringComparison]::OrdinalIgnoreCase)) {
    throw 'Backup verification only accepts Phase 2 local backup artifacts.'
}
if (-not (Test-Path -LiteralPath $backup -PathType Leaf)) { throw 'Backup file is missing.' }

$runtime = Read-EnvironmentFile (Join-Path $workspaceRoot $RuntimeEnvPath)
$databaseName = "phase2_restore_$([Guid]::NewGuid().ToString('N').Substring(0, 12))"
$remotePath = "/tmp/$([Guid]::NewGuid().ToString('N')).dump"

Push-Location $workspaceRoot
try {
    $containerId = (docker compose --env-file $RuntimeEnvPath ps -q database).Trim()
    if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($containerId)) { throw 'Database container is not running.' }
    docker cp $backup "${containerId}:$remotePath" | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'Unable to copy backup into database container.' }
    try {
        docker compose --env-file $RuntimeEnvPath exec -T database createdb -U $runtime['DB_USER'] $databaseName
        if ($LASTEXITCODE -ne 0) { throw 'Unable to create isolated restore-verification database.' }
        try {
            docker compose --env-file $RuntimeEnvPath exec -T database pg_restore -U $runtime['DB_USER'] -d $databaseName --no-owner --no-privileges $remotePath
            if ($LASTEXITCODE -ne 0) { throw 'Database restore verification failed.' }

            $verification = docker compose --env-file $RuntimeEnvPath exec -T database psql -qAt -U $runtime['DB_USER'] -d $databaseName -c "SELECT (SELECT count(*) FROM directus_users), (SELECT count(*) FROM app_seed_runs), postgis_version();"
            if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($verification)) { throw 'Restored database content verification failed.' }
            $parts = ([string]$verification).Trim().Split('|')
            if ($parts.Count -ne 3 -or [int]$parts[0] -lt 1 -or [int]$parts[1] -lt 1 -or [string]::IsNullOrWhiteSpace($parts[2])) {
                throw 'Restored database is missing required Directus, seed audit or PostGIS state.'
            }
            Write-Output "DATABASE_RESTORE_VERIFY_OK directus_users=$($parts[0]) seed_runs=$($parts[1]) postgis=true isolated_database=true"
        }
        finally {
            docker compose --env-file $RuntimeEnvPath exec -T database dropdb --if-exists --force -U $runtime['DB_USER'] $databaseName | Out-Null
        }
    }
    finally {
        docker exec --user 0 $containerId rm -f $remotePath 2>$null | Out-Null
    }
}
finally {
    Pop-Location
}
