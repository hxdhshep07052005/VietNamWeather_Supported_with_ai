param([string]$RuntimeEnvPath = '.env.local')

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

Push-Location $workspaceRoot
try {
    $runtime = Read-EnvironmentFile ([IO.Path]::GetFullPath((Join-Path $workspaceRoot $RuntimeEnvPath)))
    $containerId = (docker compose --env-file $RuntimeEnvPath ps -q database).Trim()
    if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($containerId)) {
        throw 'Database container is not running.'
    }

    $scripts = @(Get-ChildItem -LiteralPath (Join-Path $workspaceRoot 'infra\postgres\init') -File |
        Where-Object Extension -in @('.sql', '.sh') |
        Sort-Object Name)
    if ($scripts.Count -eq 0) { throw 'No database foundation scripts were found.' }
    foreach ($script in $scripts) {
        $remotePath = "/tmp/$([Guid]::NewGuid().ToString('N'))-$($script.Name)"
        try {
            docker cp $script.FullName "${containerId}:$remotePath" | Out-Null
            if ($LASTEXITCODE -ne 0) { throw "Unable to copy database script: $($script.Name)" }
            if ($script.Extension -eq '.sql') {
                docker compose --env-file $RuntimeEnvPath exec -T database psql -v ON_ERROR_STOP=1 -U $runtime['DB_USER'] -d $runtime['DB_DATABASE'] -f $remotePath
            }
            elseif ($script.Extension -eq '.sh') {
                docker compose --env-file $RuntimeEnvPath exec -T database sh $remotePath
            }
            else {
                throw "Unsupported database foundation script: $($script.Name)"
            }
            if ($LASTEXITCODE -ne 0) { throw "Database foundation script failed: $($script.Name)" }
            Write-Output "DATABASE_FOUNDATION_STEP_OK script=$($script.Name)"
        }
        finally {
            docker exec $containerId rm -f $remotePath 2>$null | Out-Null
        }
    }
    Write-Output "DATABASE_FOUNDATION_OK scripts=$($scripts.Count)"
}
finally {
    Pop-Location
}
