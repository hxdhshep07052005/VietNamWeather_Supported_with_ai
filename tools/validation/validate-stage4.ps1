param(
    [string]$RuntimeEnvPath = '.env.local',
    [string]$AdminEnvPath = '.env.admin.local',
    [string]$Actor = 'stage4-validator'
)

$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [Text.Encoding]::UTF8
$workspaceRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path

function Invoke-CheckedScript {
    param([string]$Path, [hashtable]$Arguments = @{})
    & $Path @Arguments
    if ($LASTEXITCODE -ne 0) { throw "Validation script failed: $Path" }
}

Push-Location $workspaceRoot
try {
    $requiredFiles = @(
        'infra/postgres/init/004-create-phase4-data-model.sql',
        'apps/directus/schema/foundation.yaml',
        'apps/directus/security/phase4-business-permissions.json',
        'apps/directus/seeds/phase4-approved-config.json',
        'tools/directus/apply-phase4-permissions.ps1',
        'tools/directus/validate-phase4-model.ps1',
        'tools/directus/test-phase4-business-permissions.ps1',
        'tools/database/test-phase4-data-model.ps1',
        'tools/seeding/apply-phase4-seed.ps1',
        'docs/Plan_Phases/PHASE_4_ERD.md',
        'docs/Plan_Phases/PHASE_4_DATA_DICTIONARY.md',
        'docs/Plan_Phases/PHASE_4_PERMISSION_MATRIX.md',
        'docs/Plan_Phases/PHASE_4_RETENTION_MATRIX.md',
        'docs/Plan_Phases/PHASE_4_ADMIN_WALKTHROUGH.md',
        'docs/Plan_Phases/PHASE_4_EVIDENCE.md'
    )
    foreach ($relativePath in $requiredFiles) {
        if (-not (Test-Path -LiteralPath (Join-Path $workspaceRoot $relativePath) -PathType Leaf)) {
            throw "Missing Phase 4 artifact: $relativePath"
        }
    }

    git diff --check
    if ($LASTEXITCODE -ne 0) { throw 'Git whitespace validation failed.' }

    Invoke-CheckedScript (Join-Path $workspaceRoot 'tools\environment\validate-local-env.ps1') @{
        RuntimeEnvPath = $RuntimeEnvPath
        AdminEnvPath = $AdminEnvPath
    }
    Invoke-CheckedScript (Join-Path $workspaceRoot 'tools\database\apply-foundation.ps1') @{
        RuntimeEnvPath = $RuntimeEnvPath
    }

    docker compose --env-file $RuntimeEnvPath restart directus | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'Directus restart failed after the Phase 4 metadata migration.' }
    Invoke-CheckedScript (Join-Path $workspaceRoot 'tools\validation\validate-local-stack.ps1') @{
        RuntimeEnvPath = $RuntimeEnvPath
        AdminEnvPath = $AdminEnvPath
    }

    Invoke-CheckedScript (Join-Path $workspaceRoot 'tools\directus\apply-phase3-security.ps1') @{
        RuntimeEnvPath = $RuntimeEnvPath
        AdminEnvPath = $AdminEnvPath
        Apply = $true
    }
    Invoke-CheckedScript (Join-Path $workspaceRoot 'tools\directus\apply-phase4-permissions.ps1') @{
        RuntimeEnvPath = $RuntimeEnvPath
        AdminEnvPath = $AdminEnvPath
        Apply = $true
    }
    Invoke-CheckedScript (Join-Path $workspaceRoot 'tools\directus\apply-phase4-permissions.ps1') @{
        RuntimeEnvPath = $RuntimeEnvPath
        AdminEnvPath = $AdminEnvPath
    }
    Invoke-CheckedScript (Join-Path $workspaceRoot 'tools\seeding\apply-phase4-seed.ps1') @{
        RuntimeEnvPath = $RuntimeEnvPath
        AdminEnvPath = $AdminEnvPath
        Actor = $Actor
    }

    Invoke-CheckedScript (Join-Path $workspaceRoot 'tools\directus\validate-license.ps1') @{
        RuntimeEnvPath = $RuntimeEnvPath
        AdminEnvPath = $AdminEnvPath
        RequireLicensed = $true
    }
    Invoke-CheckedScript (Join-Path $workspaceRoot 'tools\directus\validate-security-baseline.ps1') @{
        RuntimeEnvPath = $RuntimeEnvPath
    }
    Invoke-CheckedScript (Join-Path $workspaceRoot 'tools\directus\validate-phase3-security.ps1') @{
        RuntimeEnvPath = $RuntimeEnvPath
        AdminEnvPath = $AdminEnvPath
    }
    Invoke-CheckedScript (Join-Path $workspaceRoot 'tools\directus\check-schema-drift.ps1') @{
        RuntimeEnvPath = $RuntimeEnvPath
    }
    Invoke-CheckedScript (Join-Path $workspaceRoot 'tools\directus\validate-phase4-model.ps1') @{
        RuntimeEnvPath = $RuntimeEnvPath
    }
    Invoke-CheckedScript (Join-Path $workspaceRoot 'tools\database\test-phase4-data-model.ps1') @{
        RuntimeEnvPath = $RuntimeEnvPath
    }
    Invoke-CheckedScript (Join-Path $workspaceRoot 'tools\directus\test-phase4-business-permissions.ps1') @{
        RuntimeEnvPath = $RuntimeEnvPath
        AdminEnvPath = $AdminEnvPath
    }
    Invoke-CheckedScript (Join-Path $workspaceRoot 'tools\supply-chain\run-secret-scan.ps1')

    Write-Output 'STAGE4_DATA_MODEL_ADMIN_OK collections=40 schema_drift=none seed_idempotent=true no_hardcoded_business_data=true no_fake_business_rows=true governance=true maker_checker=true immutable_events=true ownership_positive=true cross_user_denied=true api_db_direct_access=false dashboard=true presets=true secrets_printed=false'
}
finally { Pop-Location }
