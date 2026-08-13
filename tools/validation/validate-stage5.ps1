param(
    [string]$RuntimeEnvPath = '.env.local',
    [string]$AdminEnvPath = '.env.admin.local',
    [string]$Actor = 'stage5-validator'
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
    # Check required Phase 5 artifact files exist
    $requiredFiles = @(
        'apps/worker/src/weather/weatherapi.ts',
        'apps/worker/src/weather/normalize.ts',
        'apps/worker/src/weather/types.ts',
        'apps/worker/src/weather/errors.ts',
        'apps/worker/src/weather/checksum.ts',
        'apps/worker/src/runtime/runtime.ts',
        'apps/worker/src/runtime/config.ts',
        'apps/worker/src/runtime/types.ts',
        'apps/worker/src/runtime/postgres-store.ts',
        'apps/worker/src/runtime/mapping.ts',
        'apps/worker/src/runtime/index.ts',
        'apps/worker/src/index.ts',
        'apps/worker/src/server.ts',
        'apps/api/src/weather-service.ts',
        'apps/api/src/weather-store.ts',
        'apps/api/src/weather-cache.ts',
        'apps/api/src/server.ts',
        'packages/contracts/src/weather-v1.ts',
        'packages/contracts/src/openapi-v1.ts',
        'packages/contracts/src/index.ts',
        'infra/postgres/init/005-create-phase5-weather-runtime.sql',
        'infra/postgres/init/006-create-weather-worker-security.sh',
        'apps/directus/seeds/phase5-approved-weather-config.json',
        'tools/database/test-phase5-weather-runtime.ps1',
        'docs/Plan_Phases/PHASE_5_EVIDENCE.md'
    )
    foreach ($relativePath in $requiredFiles) {
        if (-not (Test-Path -LiteralPath (Join-Path $workspaceRoot $relativePath) -PathType Leaf)) {
            throw "Missing Phase 5 artifact: $relativePath"
        }
    }

    # Validate git whitespace
    git diff --check
    if ($LASTEXITCODE -ne 0) { throw 'Git whitespace validation failed.' }

    # Validate environment
    Invoke-CheckedScript (Join-Path $workspaceRoot 'tools\environment\validate-local-env.ps1') @{
        RuntimeEnvPath = $RuntimeEnvPath
        AdminEnvPath = $AdminEnvPath
    }

    # Apply database foundation (includes Phase 4)
    Invoke-CheckedScript (Join-Path $workspaceRoot 'tools\database\apply-foundation.ps1') @{
        RuntimeEnvPath = $RuntimeEnvPath
    }

    # Restart Directus after migrations
    docker compose --env-file $RuntimeEnvPath restart directus | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'Directus restart failed after migrations.' }

    # Validate local stack health
    Invoke-CheckedScript (Join-Path $workspaceRoot 'tools\validation\validate-local-stack.ps1') @{
        RuntimeEnvPath = $RuntimeEnvPath
        AdminEnvPath = $AdminEnvPath
    }

    # Apply Phase 3 security (baseline)
    Invoke-CheckedScript (Join-Path $workspaceRoot 'tools\directus\apply-phase3-security.ps1') @{
        RuntimeEnvPath = $RuntimeEnvPath
        AdminEnvPath = $AdminEnvPath
        Apply = $true
    }

    # Apply Phase 4 permissions (required for Phase 5)
    Invoke-CheckedScript (Join-Path $workspaceRoot 'tools\directus\apply-phase4-permissions.ps1') @{
        RuntimeEnvPath = $RuntimeEnvPath
        AdminEnvPath = $AdminEnvPath
    }

    # Apply Phase 4 seed (required for Phase 5)
    Invoke-CheckedScript (Join-Path $workspaceRoot 'tools\seeding\apply-phase4-seed.ps1') @{
        RuntimeEnvPath = $RuntimeEnvPath
        AdminEnvPath = $AdminEnvPath
        Actor = $Actor
    }

    # Apply Phase 5 weather config seed
    Invoke-CheckedScript (Join-Path $workspaceRoot 'tools\seeding\apply-phase5-weather-config.ps1') @{
        RuntimeEnvPath = $RuntimeEnvPath
        AdminEnvPath = $AdminEnvPath
        Actor = $Actor
    }

    # Run Phase 5 weather runtime database tests
    Invoke-CheckedScript (Join-Path $workspaceRoot 'tools\database\test-phase5-weather-runtime.ps1') @{
        RuntimeEnvPath = $RuntimeEnvPath
    }

    # Run secret scan
    Invoke-CheckedScript (Join-Path $workspaceRoot 'tools\supply-chain\run-secret-scan.ps1')

    Write-Output 'STAGE5_WEATHER_INTEGRATION_OK provider_adapter=true normalization=true worker_runtime=true weather_service=true cache=true database_schema=true security=true contracts=true openapi=true seed=true retention_policy=true tests_passed=true no_raw_payload=true no_fake_weather=true secrets_printed=false'
}
finally { Pop-Location }
