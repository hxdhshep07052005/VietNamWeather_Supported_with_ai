param(
    [string]$Image = 'zricethezav/gitleaks@sha256:c00b6bd0aeb3071cbcb79009cb16a60dd9e0a7c60e2be9ab65d25e6bc8abbb7f'
)

$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [Text.Encoding]::UTF8
$workspaceRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path

Push-Location $workspaceRoot
try {
    $trackedLocalSecrets = @(git ls-files '.env*.local' 'secrets/decrypted/**')
    if ($LASTEXITCODE -ne 0) { throw 'Unable to inspect tracked secret paths.' }
    if ($trackedLocalSecrets.Count -gt 0) { throw 'A local secret path is tracked by Git.' }

    docker run --rm --volume "${workspaceRoot}:/repo:ro" $Image dir /repo --config /repo/.gitleaks.toml --redact=100 --no-banner --no-color
    if ($LASTEXITCODE -ne 0) { throw 'Repository worktree secret scan failed.' }
    docker run --rm --volume "${workspaceRoot}:/repo:ro" $Image git /repo --config /repo/.gitleaks.toml --redact=100 --no-banner --no-color
    if ($LASTEXITCODE -ne 0) { throw 'Repository history secret scan failed.' }
    Write-Output 'SECRET_SCAN_OK engine=gitleaks version=8.30.1 scopes=worktree,history redacted=true'
}
finally {
    Pop-Location
}
