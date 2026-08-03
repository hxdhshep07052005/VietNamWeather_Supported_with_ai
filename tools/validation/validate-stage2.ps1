$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [Text.Encoding]::UTF8
$workspaceRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path

function Invoke-CheckedScript {
    param([string]$Path, [hashtable]$Arguments = @{})
    & $Path @Arguments
    if ($LASTEXITCODE -ne 0) { throw "Validation script failed: $Path" }
}

$requiredFiles = @(
    'compose.yaml',
    'apps/worker/Dockerfile',
    'apps/directus/schema/foundation.yaml',
    'apps/directus/security/foundation.json',
    'apps/directus/seeds/foundation.json',
    'infra/postgres/init/001-enable-postgis.sql',
    'infra/postgres/init/002-create-seed-audit.sql',
    '.github/workflows/ci.yml',
    '.gitleaks.toml',
    'docs/Plan_Phases/ENVIRONMENT_MATRIX.md',
    'docs/Plan_Phases/SECRETS_BOOTSTRAP_RUNBOOK.md',
    'docs/Plan_Phases/PHASE_2_EVIDENCE.md'
)
foreach ($relativePath in $requiredFiles) {
    if (-not (Test-Path -LiteralPath (Join-Path $workspaceRoot $relativePath) -PathType Leaf)) {
        throw "Missing Phase 2 artifact: $relativePath"
    }
}

Push-Location $workspaceRoot
try {
    $trackedSecrets = @(git ls-files '.env*.local' 'secrets/decrypted/**')
    if ($LASTEXITCODE -ne 0) { throw 'Unable to inspect tracked secret paths.' }
    if ($trackedSecrets.Count -gt 0) { throw 'A local or decrypted secret file is tracked by Git.' }
    if (Test-Path -LiteralPath '.env.bootstrap.local') { throw 'Bootstrap credential must be absent after rotation.' }

    $imageLines = @(Select-String -Path 'compose.yaml' -Pattern '^\s+image:\s+(.+)$')
    if ($imageLines.Count -ne 4) { throw 'Compose must define four externally sourced runtime images.' }
    foreach ($line in $imageLines) {
        if ($line.Matches[0].Groups[1].Value -notmatch '@sha256:[0-9a-f]{64}$') {
            throw 'A Compose runtime image is not pinned by SHA-256 digest.'
        }
    }
    $dockerfileBaseLines = @(Select-String -Path 'apps/worker/Dockerfile' -Pattern '^FROM\s+(.+)$')
    if ($dockerfileBaseLines.Count -ne 2 -or @($dockerfileBaseLines | Where-Object { $_.Matches[0].Groups[1].Value -notmatch '@sha256:[0-9a-f]{64}\s+AS\s+' }).Count -gt 0) {
        throw 'Worker Dockerfile base images are not pinned by digest.'
    }

    Invoke-CheckedScript (Join-Path $workspaceRoot 'tools\environment\validate-local-env.ps1')
    docker compose --env-file .env.local config --quiet
    if ($LASTEXITCODE -ne 0) { throw 'Compose configuration validation failed.' }
    Write-Output 'COMPOSE_CONFIG_OK secrets_printed=false'

    pnpm run lint
    if ($LASTEXITCODE -ne 0) { throw 'Lint failed.' }
    pnpm run typecheck
    if ($LASTEXITCODE -ne 0) { throw 'Type-check failed.' }
    pnpm run test
    if ($LASTEXITCODE -ne 0) { throw 'Tests failed.' }

    docker run --rm --volume "${workspaceRoot}:/repo:ro" rhysd/actionlint@sha256:b1934ee5f1c509618f2508e6eb47ee0d3520686341fec936f3b79331f9315667 /repo/.github/workflows/ci.yml
    if ($LASTEXITCODE -ne 0) { throw 'GitHub Actions workflow validation failed.' }
    Write-Output 'GITHUB_WORKFLOW_SYNTAX_OK actionlint=1.7.12'

    Invoke-CheckedScript (Join-Path $workspaceRoot 'tools\supply-chain\run-secret-scan.ps1')
    Invoke-CheckedScript (Join-Path $workspaceRoot 'tools\validation\validate-local-stack.ps1')
    Invoke-CheckedScript (Join-Path $workspaceRoot 'tools\database\apply-foundation.ps1')
    Invoke-CheckedScript (Join-Path $workspaceRoot 'tools\directus\apply-schema.ps1')
    Invoke-CheckedScript (Join-Path $workspaceRoot 'tools\directus\check-schema-drift.ps1')
    Invoke-CheckedScript (Join-Path $workspaceRoot 'tools\directus\validate-security-baseline.ps1')
    Invoke-CheckedScript (Join-Path $workspaceRoot 'tools\seeding\apply-seed.ps1') @{ Actor = 'phase2-validator' }
    Invoke-CheckedScript (Join-Path $workspaceRoot 'tools\seeding\apply-seed.ps1') @{ Actor = 'phase2-validator' }

    $runtime = @{}
    Get-Content -LiteralPath '.env.local' | ForEach-Object {
        if ($_ -match '^([A-Za-z_][A-Za-z0-9_]*)=(.*)$') { $runtime[$Matches[1]] = $Matches[2] }
    }
    $seedRows = docker compose --env-file .env.local exec -T database psql -qAt -U $runtime['DB_USER'] -d $runtime['DB_DATABASE'] -c "SELECT count(*) FROM app_seed_runs WHERE manifest_key = 'foundation-baseline' AND manifest_version = '2026.07.31.1' AND environment = 'local';"
    if ($LASTEXITCODE -ne 0 -or $seedRows.Trim() -ne '1') { throw 'Seed idempotency verification failed.' }
    Write-Output 'SEED_IDEMPOTENCY_OK audit_rows=1 repeated_runs=true'

    Invoke-CheckedScript (Join-Path $workspaceRoot 'tools\supply-chain\generate-worker-sbom.ps1')
    Invoke-CheckedScript (Join-Path $workspaceRoot 'tools\database\backup-local.ps1')
    $backup = Get-ChildItem -LiteralPath 'artifacts\phase2\local\backups' -Filter '*.dump' | Sort-Object LastWriteTimeUtc -Descending | Select-Object -First 1
    if (-not $backup) { throw 'Database backup artifact was not created.' }
    Invoke-CheckedScript (Join-Path $workspaceRoot 'tools\database\verify-backup.ps1') @{ BackupPath = "artifacts\phase2\local\backups\$($backup.Name)" }

    Write-Output 'STAGE2_LOCAL_VALIDATION_OK remote_github_ci=use_validate-stage2-remote.ps1'
}
finally {
    Pop-Location
}
