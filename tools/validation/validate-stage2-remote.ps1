param(
    [string]$ExpectedCommit = '',
    [string]$Workflow = 'ci.yml',
    [string]$Branch = 'main'
)

$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [Text.Encoding]::UTF8
$workspaceRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path

Push-Location $workspaceRoot
try {
    if (-not (Get-Command gh -ErrorAction SilentlyContinue)) { throw 'GitHub CLI is required.' }
    gh auth status 2>$null | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'GitHub CLI is not authenticated.' }

    if ([string]::IsNullOrWhiteSpace($ExpectedCommit)) {
        $ExpectedCommit = (git rev-parse "origin/$Branch").Trim()
        if ($LASTEXITCODE -ne 0) { throw 'Unable to resolve the expected remote commit.' }
    }
    if ($ExpectedCommit -notmatch '^[0-9a-f]{40}$') { throw 'Expected commit SHA is invalid.' }

    $repository = (gh repo view --json nameWithOwner --jq '.nameWithOwner').Trim()
    if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($repository)) { throw 'Unable to resolve GitHub repository.' }

    $runs = gh run list --workflow $Workflow --branch $Branch --limit 20 --json databaseId,headSha,status,conclusion,url | ConvertFrom-Json
    if ($LASTEXITCODE -ne 0) { throw 'Unable to list GitHub Actions runs.' }
    $run = @($runs | Where-Object { $_.headSha -eq $ExpectedCommit } | Select-Object -First 1)
    if ($run.Count -ne 1) { throw 'No workflow run exists for the expected commit.' }
    if ($run[0].status -ne 'completed' -or $run[0].conclusion -ne 'success') {
        throw 'The workflow run for the expected commit is not successful.'
    }

    $details = gh run view $run[0].databaseId --json jobs | ConvertFrom-Json
    if ($LASTEXITCODE -ne 0) { throw 'Unable to inspect GitHub Actions jobs.' }
    foreach ($jobName in @('quality', 'worker-image')) {
        $job = @($details.jobs | Where-Object { $_.name -eq $jobName })
        if ($job.Count -ne 1 -or $job[0].status -ne 'completed' -or $job[0].conclusion -ne 'success') {
            throw "Required GitHub Actions job did not pass: $jobName"
        }
    }

    $artifacts = gh api -H 'Accept: application/vnd.github+json' "/repos/$repository/actions/runs/$($run[0].databaseId)/artifacts" | ConvertFrom-Json
    if ($LASTEXITCODE -ne 0) { throw 'Unable to inspect workflow artifacts.' }
    $artifactName = "source-sbom-$ExpectedCommit"
    $artifact = @($artifacts.artifacts | Where-Object { $_.name -eq $artifactName -and -not $_.expired })
    if ($artifact.Count -ne 1 -or [int64]$artifact[0].size_in_bytes -le 0) { throw 'Source SBOM artifact is missing, expired or empty.' }

    $logs = [string](gh run view $run[0].databaseId --log)
    if ($LASTEXITCODE -ne 0) { throw 'Unable to inspect workflow logs.' }
    $imageTag = "ghcr.io/$($repository.Split('/')[0].ToLowerInvariant())/vietnam-weather-worker:$ExpectedCommit"
    if (-not $logs.Contains($imageTag)) { throw 'Immutable GHCR image tag is absent from workflow logs.' }
    $digestMatch = [regex]::Match($logs, [regex]::Escape($imageTag) + '@(sha256:[0-9a-f]{64})')
    if (-not $digestMatch.Success) { throw 'Published GHCR manifest digest is absent from workflow logs.' }

    Write-Output "STAGE2_REMOTE_VALIDATION_OK run=$($run[0].databaseId) commit=$ExpectedCommit jobs=2 sbom_artifact_bytes=$($artifact[0].size_in_bytes) image_digest=$($digestMatch.Groups[1].Value)"
}
finally {
    Pop-Location
}
