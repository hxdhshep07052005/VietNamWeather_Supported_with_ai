param(
    [string]$RuntimeEnvPath = '.env.local',
    [string]$SnapshotPath = 'apps/directus/schema/foundation.yaml'
)

$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [Text.Encoding]::UTF8
$workspaceRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$expectedPath = [IO.Path]::GetFullPath((Join-Path $workspaceRoot $SnapshotPath))
if (-not (Test-Path -LiteralPath $expectedPath -PathType Leaf)) {
    throw 'Directus schema baseline is missing.'
}

Push-Location $workspaceRoot
try {
    $containerId = (docker compose --env-file $RuntimeEnvPath ps -q directus).Trim()
    if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($containerId)) {
        throw 'Directus container is not running.'
    }

    $nonce = [Guid]::NewGuid().ToString('N')
    $remotePath = "/tmp/directus-schema-$nonce.yaml"
    $localPath = Join-Path ([IO.Path]::GetTempPath()) "directus-schema-$nonce.yaml"
    try {
        docker compose --env-file $RuntimeEnvPath exec -T directus node cli.js schema snapshot $remotePath --format yaml --yes | Out-Null
        if ($LASTEXITCODE -ne 0) { throw 'Directus schema snapshot command failed.' }
        docker cp "${containerId}:$remotePath" $localPath | Out-Null
        if ($LASTEXITCODE -ne 0) { throw 'Unable to copy current Directus schema snapshot.' }

        $expectedHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $expectedPath).Hash.ToLowerInvariant()
        $currentHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $localPath).Hash.ToLowerInvariant()
        if ($expectedHash -ne $currentHash) {
            Write-Output "DIRECTUS_SCHEMA_DRIFT expected=$expectedHash current=$currentHash"
            exit 1
        }
        Write-Output "DIRECTUS_SCHEMA_DRIFT_OK sha256=$expectedHash"
    }
    finally {
        docker exec --user 0 $containerId rm -f $remotePath 2>$null | Out-Null
        if (Test-Path -LiteralPath $localPath) { Remove-Item -LiteralPath $localPath -Force }
    }
}
finally {
    Pop-Location
}
