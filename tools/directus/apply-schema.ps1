param(
    [string]$RuntimeEnvPath = '.env.local',
    [string]$SnapshotPath = 'apps/directus/schema/foundation.yaml',
    [switch]$Apply
)

$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [Text.Encoding]::UTF8
$workspaceRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$snapshot = [IO.Path]::GetFullPath((Join-Path $workspaceRoot $SnapshotPath))
$workspacePrefix = $workspaceRoot.TrimEnd('\') + '\'
if (-not $snapshot.StartsWith($workspacePrefix, [StringComparison]::OrdinalIgnoreCase)) {
    throw 'Schema snapshot path must remain inside the workspace.'
}
if (-not (Test-Path -LiteralPath $snapshot -PathType Leaf)) { throw 'Schema snapshot is missing.' }

Push-Location $workspaceRoot
try {
    $containerId = (docker compose --env-file $RuntimeEnvPath ps -q directus).Trim()
    if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($containerId)) {
        throw 'Directus container is not running.'
    }

    $remotePath = "/tmp/directus-schema-$([Guid]::NewGuid().ToString('N')).yaml"
    try {
        docker cp $snapshot "${containerId}:$remotePath" | Out-Null
        if ($LASTEXITCODE -ne 0) { throw 'Unable to copy Directus schema snapshot.' }
        if ($Apply) {
            docker compose --env-file $RuntimeEnvPath exec -T directus node cli.js schema apply $remotePath --yes
            if ($LASTEXITCODE -ne 0) { throw 'Directus schema apply failed.' }
            Write-Output 'DIRECTUS_SCHEMA_APPLY_OK mode=apply'
        }
        else {
            docker compose --env-file $RuntimeEnvPath exec -T directus node cli.js schema apply $remotePath --dry-run
            if ($LASTEXITCODE -ne 0) { throw 'Directus schema dry-run failed.' }
            Write-Output 'DIRECTUS_SCHEMA_APPLY_OK mode=dry-run'
        }
    }
    finally {
        docker exec --user 0 $containerId rm -f $remotePath 2>$null | Out-Null
    }
}
finally {
    Pop-Location
}
