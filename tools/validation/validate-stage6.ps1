# Phase 6 Validation Script
# Config-Driven Weather Risk Engine

param(
    [string]$RuntimeEnvPath = '.env.local',
    [string]$AdminEnvPath = '.env.admin.local',
    [string]$Actor = 'stage6-validator'
)

$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [Text.Encoding]::UTF8
$workspaceRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path

function Write-Status {
    param([string]$Message)
    Write-Host "[Phase 6] $Message" -ForegroundColor Cyan
}

function Run-Command {
    param([string]$Cmd, [string]$Desc)
    Write-Status "Running: $Desc..."
    $output = & pwsh -Command $Cmd 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Error output: $output" -ForegroundColor Red
        throw "$Desc failed"
    }
    Write-Status "$Desc completed"
    return $output
}

Push-Location $workspaceRoot
try {
    Write-Status "Starting Phase 6 Risk Engine validation..."

    # =========================================================================
    # 1. Check required Phase 6 artifact files exist
    # =========================================================================
    Write-Status "Checking Phase 6 artifacts..."

    $requiredFiles = @(
        'apps/api/src/risk/risk-engine.ts',
        'apps/api/src/risk/risk-service.ts',
        'apps/api/src/risk/index.ts',
        'apps/api/test/risk-engine.test.mjs',
        'packages/contracts/src/risk-v1.ts',
        'infra/postgres/init/007-create-phase6-risk-engine.sql',
        'apps/directus/seeds/phase6-risk-default-rules.json',
        'docs/Plan_Phases/PHASE_6_DECISIONS.md',
        'docs/Plan_Phases/PHASE_6_EVIDENCE.md'
    )

    foreach ($relativePath in $requiredFiles) {
        $fullPath = Join-Path $workspaceRoot $relativePath
        if (-not (Test-Path -LiteralPath $fullPath -PathType Leaf)) {
            throw "Missing Phase 6 artifact: $relativePath"
        }
    }
    Write-Status "All Phase 6 artifacts present"

    # =========================================================================
    # 2. TypeScript Compilation
    # =========================================================================
    Run-Command "cd '$workspaceRoot'; pnpm run typecheck" "TypeScript compilation"

    # =========================================================================
    # 3. Build
    # =========================================================================
    Run-Command "cd '$workspaceRoot'; pnpm run build" "Build"

    # =========================================================================
    # 4. Unit Tests - Risk Engine
    # =========================================================================
    Run-Command "cd '$workspaceRoot/apps/api'; pnpm exec node --test test/risk-engine.test.mjs" "Risk Engine tests (30 tests)"

    # =========================================================================
    # 5. Verify risk contracts exports
    # =========================================================================
    Write-Status "Verifying risk contracts..."

    $contractsIndex = Get-Content (Join-Path $workspaceRoot 'packages/contracts/src/index.ts') -Raw
    if (-not $contractsIndex.Contains('RISK_LEVELS')) { throw "RISK_LEVELS not exported" }
    if (-not $contractsIndex.Contains('RISK_COLORS')) { throw "RISK_COLORS not exported" }
    if (-not $contractsIndex.Contains('RiskAssessmentResponse')) { throw "RiskAssessmentResponse not exported" }
    Write-Status "Risk contracts: OK"

    # =========================================================================
    # 6. Verify database schema functions
    # =========================================================================
    Write-Status "Verifying database schema..."

    $sqlContent = Get-Content (Join-Path $workspaceRoot 'infra/postgres/init/007-create-phase6-risk-engine.sql') -Raw
    if (-not $sqlContent.Contains('app_risk.get_severity_score')) { throw "Missing get_severity_score" }
    if (-not $sqlContent.Contains('app_risk.assess_weather_risk')) { throw "Missing assess_weather_risk" }
    Write-Status "Database schema: OK"

    # =========================================================================
    # 7. Verify seed data
    # =========================================================================
    Write-Status "Verifying seed data..."

    $seedPath = Join-Path $workspaceRoot 'apps/directus/seeds/phase6-risk-default-rules.json'
    $seedContent = Get-Content $seedPath -Raw | ConvertFrom-Json

    if ($seedContent.collections.'risk_rule_sets'.Count -eq 0) { throw "No risk_rule_sets in seed" }
    if ($seedContent.collections.'risk_rules'.Count -eq 0) { throw "No risk_rules in seed" }

    $highRules = $seedContent.collections.'risk_rules' | Where-Object { $_.severity -eq 'high' }
    if ($highRules.Count -lt 4) { throw "Expected at least 4 high severity rules" }
    Write-Status "Seed data: OK ($($seedContent.collections.'risk_rules'.Count) rules)"

    # =========================================================================
    # 8. Verify RISK-001 compliance (4 levels)
    # =========================================================================
    Write-Status "Verifying RISK-001 compliance..."

    $engineContent = Get-Content (Join-Path $workspaceRoot 'apps/api/src/risk/risk-engine.ts') -Raw
    # Check that all 4 levels are defined in contracts
    $riskContractsContent = Get-Content (Join-Path $workspaceRoot 'packages/contracts/src/risk-v1.ts') -Raw
    if (-not $riskContractsContent.Contains('LOW: "low"')) { throw "RISK_LEVELS.LOW missing" }
    if (-not $riskContractsContent.Contains('CAUTION: "caution"')) { throw "RISK_LEVELS.CAUTION missing" }
    if (-not $riskContractsContent.Contains('HIGH: "high"')) { throw "RISK_LEVELS.HIGH missing" }
    if (-not $riskContractsContent.Contains('UNKNOWN: "unknown"')) { throw "RISK_LEVELS.UNKNOWN missing" }
    # Check that levels are used in engine
    if (-not $engineContent.Contains('RISK_LEVELS.LOW')) { throw "RISK_LEVELS.LOW not used" }
    if (-not $engineContent.Contains('RISK_LEVELS.UNKNOWN')) { throw "RISK_LEVELS.UNKNOWN not used" }
    Write-Status "RISK-001 (4 levels): OK"

    # =========================================================================
    # 9. Verify RISK-005 (max severity aggregation)
    # =========================================================================
    if (-not $engineContent.Contains('highestSeverityScore')) { throw "Max severity not implemented" }
    Write-Status "RISK-005 (max severity): OK"

    # =========================================================================
    # 10. Verify RISK-006 (stale → Unknown)
    # =========================================================================
    if (-not $engineContent.Contains('freshnessState !== "fresh"')) { throw "Stale check not implemented" }
    if (-not $engineContent.Contains('RISK_LEVELS.UNKNOWN')) { throw "Unknown level not used" }
    Write-Status "RISK-006 (stale → Unknown): OK"

    # =========================================================================
    # 11. Verify RISK-007 (disclaimer)
    # =========================================================================
    $riskContractsContent = Get-Content (Join-Path $workspaceRoot 'packages/contracts/src/risk-v1.ts') -Raw
    if (-not $riskContractsContent.Contains("Thông tin thời tiết chỉ mang tính tham khảo")) { throw "VI disclaimer missing" }
    if (-not $riskContractsContent.Contains("Weather information is for reference only")) { throw "EN disclaimer missing" }
    Write-Status "RISK-007 (disclaimer): OK"

    # =========================================================================
    # SUCCESS
    # =========================================================================
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "PHASE6_RISK_ENGINE_OK" -ForegroundColor Green
    Write-Host "  risk_levels=true" -ForegroundColor Green
    Write-Host "  risk_engine=true" -ForegroundColor Green
    Write-Host "  risk_service=true" -ForegroundColor Green
    Write-Host "  contracts=true" -ForegroundColor Green
    Write-Host "  database_schema=true" -ForegroundColor Green
    Write-Host "  seed_data=true" -ForegroundColor Green
    Write-Host "  tests_passed=true" -ForegroundColor Green
    Write-Host "  risk_005_aggregation=true" -ForegroundColor Green
    Write-Host "  risk_006_stale_unknown=true" -ForegroundColor Green
    Write-Host "  risk_007_disclaimer=true" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green

    exit 0

} catch {
    Write-Host "[Phase 6] ERROR: $_" -ForegroundColor Red
    exit 1
} finally {
    Pop-Location
}
