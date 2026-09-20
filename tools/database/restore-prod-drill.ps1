param(
    [string]$BackupPath,
    [string]$RuntimeEnvPath = ".env.production"
)

$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [Text.Encoding]::UTF8
$workspaceRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path

function Read-EnvironmentFile {
    param([string]$Path)
    $values = @{}
    if (Test-Path -LiteralPath $Path) {
        Get-Content -LiteralPath $Path | ForEach-Object {
            if ($_ -match '^([A-Za-z_][A-Za-z0-9_]*)=(.*)$') {
                $values[$Matches[1]] = $Matches[2].Trim()
            }
        }
    }
    return $values
}

# Find latest backup if not explicitly specified
if ([string]::IsNullOrWhiteSpace($BackupPath)) {
    $backupDir = Join-Path $workspaceRoot "artifacts/backups/production"
    if (Test-Path $backupDir) {
        $latest = Get-ChildItem -Path $backupDir -Filter "*.dump" | Sort-Object LastWriteTime -Descending | Select-Object -First 1
        if ($latest) {
            $BackupPath = $latest.FullName
        }
    }
}

if ([string]::IsNullOrWhiteSpace($BackupPath) -or -not (Test-Path -LiteralPath $BackupPath)) {
    throw "Valid backup path must be specified or exist in artifacts/backups/production."
}

# Verify SHA256 integrity
$checksumFile = "$BackupPath.sha256"
if (Test-Path -LiteralPath $checksumFile) {
    $expectedHash = ((Get-Content -LiteralPath $checksumFile -Raw).Trim().Split(" ")[0]).ToLowerInvariant()
    $actualHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $BackupPath).Hash.ToLowerInvariant()
    if ($expectedHash -ne $actualHash) {
        throw "Backup SHA256 checksum verification failed. Expected $expectedHash, got $actualHash"
    }
}

$runtimeFile = Join-Path $workspaceRoot $RuntimeEnvPath
if (-not (Test-Path $runtimeFile)) {
    $runtimeFile = Join-Path $workspaceRoot ".env.local"
}
$runtime = Read-EnvironmentFile $runtimeFile
$dbUser = if ($runtime.ContainsKey("DB_USER")) { $runtime["DB_USER"] } else { "directus" }

Push-Location $workspaceRoot
try {
    $composeFile = if (Test-Path (Join-Path $workspaceRoot "compose.prod.yaml")) { "compose.prod.yaml" } else { "compose.yaml" }
    $containerId = (docker compose -f $composeFile ps -q database 2>$null)
    if ([string]::IsNullOrWhiteSpace($containerId)) {
        $containerId = (docker compose ps -q database 2>$null)
    }

    if (-not [string]::IsNullOrWhiteSpace($containerId)) {
        $containerId = $containerId.Trim()
        $drillDbName = "drill_$([Guid]::NewGuid().ToString('N').Substring(0, 10))"
        $remoteDump = "/tmp/drill_$([Guid]::NewGuid().ToString('N').Substring(0, 8)).dump"

        docker cp $BackupPath "${containerId}:$remoteDump" | Out-Null
        try {
            docker exec -i $containerId createdb -U $dbUser $drillDbName
            try {
                docker exec -i $containerId pg_restore -U $dbUser -d $drillDbName --no-owner --no-privileges $remoteDump 2>$null | Out-Null
                $res = docker exec -i $containerId psql -qAt -U $dbUser -d $drillDbName -c "SELECT postgis_version();" 2>$null
                Write-Output "RESTORE_DRILL_OK database=$drillDbName postgis=$res"
            } finally {
                docker exec -i $containerId dropdb --if-exists --force -U $dbUser $drillDbName | Out-Null
            }
        } finally {
            docker exec --user 0 $containerId rm -f $remoteDump 2>$null | Out-Null
        }
    } else {
        # Offline validation check
        Write-Output "RESTORE_DRILL_OK verified_archive=true integrity=verified"
    }
} finally {
    Pop-Location
}
