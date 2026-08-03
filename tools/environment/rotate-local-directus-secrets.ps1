param([string]$RuntimeEnvPath = '.env.local')

$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [Text.Encoding]::UTF8
$workspaceRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$runtimePath = [IO.Path]::GetFullPath((Join-Path $workspaceRoot $RuntimeEnvPath))
$workspacePrefix = $workspaceRoot.TrimEnd('\') + '\'
if (-not $runtimePath.StartsWith($workspacePrefix, [StringComparison]::OrdinalIgnoreCase)) { throw 'Runtime environment path must remain inside the workspace.' }
if (-not (Test-Path -LiteralPath $runtimePath -PathType Leaf)) { throw 'Runtime environment file is missing.' }

function New-RandomBase64Url {
    param([ValidateRange(16, 128)][int]$ByteCount)
    $bytes = New-Object byte[] $ByteCount
    $generator = [Security.Cryptography.RandomNumberGenerator]::Create()
    try { $generator.GetBytes($bytes) } finally { $generator.Dispose() }
    return [Convert]::ToBase64String($bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_')
}

$replacement = @{
    DIRECTUS_KEY = New-RandomBase64Url 32
    DIRECTUS_SECRET = New-RandomBase64Url 64
}
$seen = @{}
$lines = @(Get-Content -LiteralPath $runtimePath | ForEach-Object {
    if ($_ -match '^([A-Za-z_][A-Za-z0-9_]*)=(.*)$' -and $replacement.ContainsKey($Matches[1])) {
        $name = $Matches[1]
        if ($seen.ContainsKey($name)) { throw "Duplicate runtime setting: $name" }
        $seen[$name] = $true
        "$name=$($replacement[$name])"
    }
    else { $_ }
})
foreach ($name in $replacement.Keys) {
    if (-not $seen.ContainsKey($name)) { throw "Missing runtime setting: $name" }
}

$utf8NoBom = New-Object Text.UTF8Encoding -ArgumentList $false
[IO.File]::WriteAllText($runtimePath, (($lines -join "`n") + "`n"), $utf8NoBom)

Push-Location $workspaceRoot
try {
    docker compose --env-file $RuntimeEnvPath up -d --force-recreate directus | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'Unable to recreate Directus after secret rotation.' }
    $deadline = [DateTime]::UtcNow.AddSeconds(90)
    do {
        $service = @(docker compose --env-file $RuntimeEnvPath ps directus --format json | ConvertFrom-Json)
        if ($LASTEXITCODE -ne 0) { throw 'Unable to inspect Directus after secret rotation.' }
        if ($service.Count -eq 1 -and $service[0].Health -eq 'healthy') { break }
        Start-Sleep -Seconds 2
    } while ([DateTime]::UtcNow -lt $deadline)
    if ($service.Count -ne 1 -or $service[0].Health -ne 'healthy') { throw 'Directus did not become healthy after secret rotation.' }
    Write-Output 'LOCAL_DIRECTUS_SECRET_ROTATION_OK directus_recreated=true sessions_invalidated=true secrets_printed=false'
}
finally {
    Pop-Location
}
