param(
    [string]$RuntimeEnvPath = '.env.local',
    [string]$AdminEnvPath = '.env.admin.local'
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
        'apps/directus/security/phase3-default-deny.json',
        'tools/directus/apply-phase3-security.ps1',
        'tools/directus/validate-license.ps1',
        'tools/directus/validate-phase3-security.ps1',
        'tools/directus/test-phase3-negative-permissions.ps1',
        'tools/directus/test-phase3-mfa.ps1',
        'tools/directus/apply-phase3-registration.ps1',
        'apps/api/src/server.ts',
        'apps/api/src/auth-service.ts',
        'apps/api/src/session-store.ts',
        'apps/api/src/email-verification.ts',
        'apps/api/src/verification-store.ts',
        'apps/api/src/rotate-encryption-key.ts',
        'apps/api/test/security.test.mjs',
        'infra/postgres/init/003-create-api-security.sh',
        'tools/database/run-security-retention.ps1',
        'tools/database/test-phase3-security-retention.ps1',
        'tools/api/test-phase3-auth-runtime.ps1',
        'tools/api/test-phase3-password-recovery.ps1',
        'tools/api/test-phase3-email-verification.ps1',
        'tools/api/test-phase3-encryption-key-rotation.ps1',
        'tools/api/test-phase3-redis-failure.ps1',
        'tools/api/check-api-db-denial.sh',
        'docs/Plan_Phases/PHASE_3_AUTH_SESSION_CONTRACT.md',
        'docs/Plan_Phases/PHASE_3_ROLE_POLICY_MATRIX.md',
        'docs/Plan_Phases/PHASE_3_RUNTIME_SECURITY.md',
        'docs/Plan_Phases/PHASE_3_SECURITY_OPERATIONS.md',
        'docs/Plan_Phases/THREAT_MODEL.md',
        'docs/Plan_Phases/PHASE_3_EVIDENCE.md'
    )
    foreach ($relativePath in $requiredFiles) {
        if (-not (Test-Path -LiteralPath (Join-Path $workspaceRoot $relativePath) -PathType Leaf)) {
            throw "Missing Phase 3 artifact: $relativePath"
        }
    }

    git diff --check
    if ($LASTEXITCODE -ne 0) { throw 'Git whitespace validation failed.' }

    Invoke-CheckedScript (Join-Path $workspaceRoot 'tools\validation\validate-stage1.ps1')
    Invoke-CheckedScript (Join-Path $workspaceRoot 'tools\environment\validate-local-env.ps1') @{ RuntimeEnvPath = $RuntimeEnvPath; AdminEnvPath = $AdminEnvPath }
    Invoke-CheckedScript (Join-Path $workspaceRoot 'tools\database\apply-foundation.ps1') @{ RuntimeEnvPath = $RuntimeEnvPath }
    Invoke-CheckedScript (Join-Path $workspaceRoot 'tools\database\run-security-retention.ps1') @{ RuntimeEnvPath = $RuntimeEnvPath }
    Invoke-CheckedScript (Join-Path $workspaceRoot 'tools\database\test-phase3-security-retention.ps1') @{ RuntimeEnvPath = $RuntimeEnvPath }
    Invoke-CheckedScript (Join-Path $workspaceRoot 'tools\validation\validate-local-stack.ps1') @{ RuntimeEnvPath = $RuntimeEnvPath; AdminEnvPath = $AdminEnvPath }
    Invoke-CheckedScript (Join-Path $workspaceRoot 'tools\directus\apply-phase3-security.ps1') @{ RuntimeEnvPath = $RuntimeEnvPath; AdminEnvPath = $AdminEnvPath; Apply = $true }
    $licenseValidator = Join-Path $workspaceRoot 'tools\directus\validate-license.ps1'
    Invoke-CheckedScript $licenseValidator @{ RuntimeEnvPath = $RuntimeEnvPath; AdminEnvPath = $AdminEnvPath; RequireLicensed = $true }
    Invoke-CheckedScript (Join-Path $workspaceRoot 'tools\directus\validate-security-baseline.ps1') @{ RuntimeEnvPath = $RuntimeEnvPath }
    Invoke-CheckedScript (Join-Path $workspaceRoot 'tools\directus\validate-phase3-security.ps1') @{ RuntimeEnvPath = $RuntimeEnvPath; AdminEnvPath = $AdminEnvPath }
    Invoke-CheckedScript (Join-Path $workspaceRoot 'tools\directus\test-phase3-negative-permissions.ps1') @{ RuntimeEnvPath = $RuntimeEnvPath; AdminEnvPath = $AdminEnvPath }
    Invoke-CheckedScript (Join-Path $workspaceRoot 'tools\directus\validate-phase3-security.ps1') @{ RuntimeEnvPath = $RuntimeEnvPath; AdminEnvPath = $AdminEnvPath }
    Invoke-CheckedScript (Join-Path $workspaceRoot 'tools\directus\test-phase3-mfa.ps1') @{ RuntimeEnvPath = $RuntimeEnvPath; AdminEnvPath = $AdminEnvPath }
    Invoke-CheckedScript (Join-Path $workspaceRoot 'tools\directus\apply-phase3-registration.ps1') @{ RuntimeEnvPath = $RuntimeEnvPath; AdminEnvPath = $AdminEnvPath; Apply = $true }

    pnpm --filter '@vietnam-weather/api' build
    if ($LASTEXITCODE -ne 0) { throw 'Application API build failed.' }
    pnpm --filter '@vietnam-weather/api' test
    if ($LASTEXITCODE -ne 0) { throw 'Application API security tests failed.' }
    docker compose --env-file $RuntimeEnvPath build api
    if ($LASTEXITCODE -ne 0) { throw 'Application API image build failed.' }
    docker compose --env-file $RuntimeEnvPath up -d --no-deps --force-recreate api
    if ($LASTEXITCODE -ne 0) { throw 'Application API recreate failed.' }
    Invoke-CheckedScript (Join-Path $workspaceRoot 'tools\validation\validate-local-stack.ps1') @{ RuntimeEnvPath = $RuntimeEnvPath; AdminEnvPath = $AdminEnvPath }
    Invoke-CheckedScript (Join-Path $workspaceRoot 'tools\api\test-phase3-auth-runtime.ps1') @{ RuntimeEnvPath = $RuntimeEnvPath; AdminEnvPath = $AdminEnvPath }
    Invoke-CheckedScript (Join-Path $workspaceRoot 'tools\api\test-phase3-password-recovery.ps1') @{ RuntimeEnvPath = $RuntimeEnvPath; AdminEnvPath = $AdminEnvPath }
    Invoke-CheckedScript (Join-Path $workspaceRoot 'tools\api\test-phase3-email-verification.ps1') @{ RuntimeEnvPath = $RuntimeEnvPath; AdminEnvPath = $AdminEnvPath }
    Invoke-CheckedScript (Join-Path $workspaceRoot 'tools\api\test-phase3-encryption-key-rotation.ps1') @{ RuntimeEnvPath = $RuntimeEnvPath; AdminEnvPath = $AdminEnvPath; SkipBuild = $true }
    Invoke-CheckedScript (Join-Path $workspaceRoot 'tools\api\test-phase3-redis-failure.ps1') @{ RuntimeEnvPath = $RuntimeEnvPath }
    Invoke-CheckedScript (Join-Path $workspaceRoot 'tools\supply-chain\run-secret-scan.ps1')

    Write-Output 'STAGE3_SECURITY_RUNTIME_BASELINE_OK default_deny=true least_privilege_self_tfa=true negative_tests=true auth_runtime=true password_recovery=true email_verification=true redis_failure=true csrf=true session_rotation=true identity_revoke=true encryption_key_rotation=true retention=true admin_mfa=true staff_mfa=true license_gate=pass secrets_printed=false'
}
finally {
    Pop-Location
}
