param(
    [string]$WorkerImage = 'vietnam_weather_local-worker:latest',
    [string]$OutputPath = 'artifacts/phase2/local/worker-sbom.cdx.json',
    [string]$SyftImage = 'anchore/syft@sha256:1288ea4c8b38767b4e620c1e312c8cb26b6e887a99b4f07ab6cd19fc6f225026'
)

$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [Text.Encoding]::UTF8
$workspaceRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$outputFile = [IO.Path]::GetFullPath((Join-Path $workspaceRoot $OutputPath))
$workspacePrefix = $workspaceRoot.TrimEnd('\') + '\'
if (-not $outputFile.StartsWith($workspacePrefix, [StringComparison]::OrdinalIgnoreCase)) {
    throw 'SBOM output path must remain inside the workspace.'
}
$outputDirectory = Split-Path -Parent $outputFile
$outputName = Split-Path -Leaf $outputFile
New-Item -ItemType Directory -Path $outputDirectory -Force | Out-Null

docker image inspect $WorkerImage | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Worker image is not available locally.' }

docker run --rm --volume /var/run/docker.sock:/var/run/docker.sock --volume "${outputDirectory}:/output" $SyftImage "docker:$WorkerImage" --output "cyclonedx-json=/output/$outputName"
if ($LASTEXITCODE -ne 0) { throw 'Worker SBOM generation failed.' }
if (-not (Test-Path -LiteralPath $outputFile -PathType Leaf)) { throw 'Worker SBOM file was not created.' }

$sbom = Get-Content -LiteralPath $outputFile -Raw | ConvertFrom-Json
$componentCount = @($sbom.components).Count
$checksum = (Get-FileHash -Algorithm SHA256 -LiteralPath $outputFile).Hash.ToLowerInvariant()
Write-Output "WORKER_SBOM_OK format=cyclonedx-json components=$componentCount sha256=$checksum"
