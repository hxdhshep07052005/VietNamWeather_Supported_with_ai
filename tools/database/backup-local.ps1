param(
    [string]$RuntimeEnvPath = '.env.local',
    [string]$OutputDirectory = 'artifacts/phase2/local/backups'
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

$outputRoot = [IO.Path]::GetFullPath((Join-Path $workspaceRoot $OutputDirectory))
$workspacePrefix = $workspaceRoot.TrimEnd('\') + '\'
if (-not $outputRoot.StartsWith($workspacePrefix, [StringComparison]::OrdinalIgnoreCase)) {
    throw 'Backup output path must remain inside the workspace.'
}
New-Item -ItemType Directory -Path $outputRoot -Force | Out-Null
$backupName = "directus-$([DateTime]::UtcNow.ToString('yyyyMMddTHHmmssZ'))-$([Guid]::NewGuid().ToString('N').Substring(0, 8)).dump"
$backupPath = Join-Path $outputRoot $backupName
$remotePath = "/tmp/$backupName"
$runtime = Read-EnvironmentFile (Join-Path $workspaceRoot $RuntimeEnvPath)

Push-Location $workspaceRoot
try {
    $containerId = (docker compose --env-file $RuntimeEnvPath ps -q database).Trim()
    if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($containerId)) { throw 'Database container is not running.' }
    try {
        docker compose --env-file $RuntimeEnvPath exec -T database pg_dump -Fc -U $runtime['DB_USER'] -d $runtime['DB_DATABASE'] -f $remotePath
        if ($LASTEXITCODE -ne 0) { throw 'Database backup failed.' }
        docker cp "${containerId}:$remotePath" $backupPath | Out-Null
        if ($LASTEXITCODE -ne 0) { throw 'Unable to copy database backup.' }
    }
    finally {
        docker exec --user 0 $containerId rm -f $remotePath 2>$null | Out-Null
    }
    $checksum = (Get-FileHash -Algorithm SHA256 -LiteralPath $backupPath).Hash.ToLowerInvariant()
    Write-Output "DATABASE_BACKUP_OK path=$OutputDirectory/$backupName sha256=$checksum"
}
finally {
    Pop-Location
}
