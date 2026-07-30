param([string]$BootstrapEnvPath = '.env.bootstrap.local')

$ErrorActionPreference = 'Stop'
$workspaceRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$bootstrapPath = [IO.Path]::GetFullPath((Join-Path $workspaceRoot $BootstrapEnvPath))
$workspacePrefix = $workspaceRoot.TrimEnd('\') + '\'
if (-not $bootstrapPath.StartsWith($workspacePrefix, [StringComparison]::OrdinalIgnoreCase)) {
    throw 'Bootstrap path must remain inside the workspace.'
}
if (-not (Test-Path -LiteralPath $bootstrapPath)) {
    Write-Output 'LOCAL_BOOTSTRAP_ALREADY_ABSENT'
    exit 0
}

Remove-Item -LiteralPath $bootstrapPath
Write-Output 'LOCAL_BOOTSTRAP_REMOVED recoverable=false'
