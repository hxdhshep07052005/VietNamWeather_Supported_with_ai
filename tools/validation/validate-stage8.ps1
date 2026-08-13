# Phase 8 Validation Script
# Validates Route Planner implementation against ROUTE-001..008 decisions

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RootDir = Split-Path -Parent (Split-Path -Parent $ScriptDir)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Phase 8 Validation - Route Planner" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$allPassed = $true

# Helper function
function Test-Step {
    param(
        [string]$Name,
        [scriptblock]$Test
    )
    Write-Host "Testing: $Name..." -NoNewline
    try {
        $result = & $Test
        if ($result) {
            Write-Host " PASS" -ForegroundColor Green
            return $true
        } else {
            Write-Host " FAIL" -ForegroundColor Red
            return $false
        }
    } catch {
        Write-Host " FAIL: $_" -ForegroundColor Red
        return $false
    }
}

# =============================================================================
# GATE 1: File Existence
# =============================================================================
Write-Host "`n[Gate 1] Checking file existence..." -ForegroundColor Yellow

$gate1Passed = $true

$gate1Passed = (Test-Step "route-v1.ts contracts" {
    Test-Path "$RootDir/packages/contracts/src/route-v1.ts"
}) -and $gate1Passed

$gate1Passed = (Test-Step "geocoding-service.ts" {
    Test-Path "$RootDir/apps/api/src/route/geocoding-service.ts"
}) -and $gate1Passed

$gate1Passed = (Test-Step "routing-service.ts" {
    Test-Path "$RootDir/apps/api/src/route/routing-service.ts"
}) -and $gate1Passed

$gate1Passed = (Test-Step "route-sampler.ts" {
    Test-Path "$RootDir/apps/api/src/route/route-sampler.ts"
}) -and $gate1Passed

$gate1Passed = (Test-Step "route-risk-engine.ts" {
    Test-Path "$RootDir/apps/api/src/route/route-risk-engine.ts"
}) -and $gate1Passed

$gate1Passed = (Test-Step "route-service.ts" {
    Test-Path "$RootDir/apps/api/src/route/route-service.ts"
}) -and $gate1Passed

$gate1Passed = (Test-Step "route tests" {
    Test-Path "$RootDir/apps/api/test/route-service.test.mjs"
}) -and $gate1Passed

$gate1Passed = (Test-Step "PHASE_8_DECISIONS.md" {
    Test-Path "$RootDir/docs/Plan_Phases/PHASE_8_DECISIONS.md"
}) -and $gate1Passed

if (-not $gate1Passed) {
    Write-Host "Gate 1 FAILED - Missing files" -ForegroundColor Red
    $allPassed = $false
}

# =============================================================================
# GATE 2: Decision Gate Compliance
# =============================================================================
Write-Host "`n[Gate 2] Checking Decision Gate compliance..." -ForegroundColor Yellow

$gate2Passed = $true

# ROUTE-001: Vehicle types
$gate2Passed = (Test-Step "ROUTE-001: CAR vehicle type" {
    $content = Get-Content "$RootDir/packages/contracts/src/route-v1.ts" -Raw
    $content -match 'CAR:\s*"car"'
}) -and $gate2Passed

$gate2Passed = (Test-Step "ROUTE-001: MOTORCYCLE vehicle type" {
    $content = Get-Content "$RootDir/packages/contracts/src/route-v1.ts" -Raw
    $content -match 'MOTORCYCLE:\s*"motorcycle"'
}) -and $gate2Passed

# ROUTE-003: Route alternatives
$gate2Passed = (Test-Step "ROUTE-003: FASTEST alternative" {
    $content = Get-Content "$RootDir/packages/contracts/src/route-v1.ts" -Raw
    $content -match 'FASTEST:\s*"fastest"'
}) -and $gate2Passed

$gate2Passed = (Test-Step "ROUTE-003: WEATHER_SAFER alternative" {
    $content = Get-Content "$RootDir/packages/contracts/src/route-v1.ts" -Raw
    $content -match 'WEATHER_SAFER:\s*"weather_safer"'
}) -and $gate2Passed

# ROUTE-005: Max route length 50km
$gate2Passed = (Test-Step "ROUTE-005: MAX_ROUTE_LENGTH_METERS = 50000" {
    $content = Get-Content "$RootDir/packages/contracts/src/route-v1.ts" -Raw
    $content -match "MAX_ROUTE_LENGTH_METERS\s*=\s*50000"
}) -and $gate2Passed

# ROUTE-008: Deviation threshold
$gate2Passed = (Test-Step "ROUTE-008: DEVIATION_THRESHOLD_METERS = 100" {
    $content = Get-Content "$RootDir/packages/contracts/src/route-v1.ts" -Raw
    $content -match "DEVIATION_THRESHOLD_METERS\s*=\s*100"
}) -and $gate2Passed

if (-not $gate2Passed) {
    Write-Host "Gate 2 FAILED - Decision Gate non-compliance" -ForegroundColor Red
    $allPassed = $false
}

# =============================================================================
# GATE 3: TypeScript Compilation
# =============================================================================
Write-Host "`n[Gate 3] Checking TypeScript compilation..." -ForegroundColor Yellow

Push-Location $RootDir
try {
    $gate3Passed = $true
    $null = pnpm run typecheck 2>$null
    $gate3Passed = (Test-Step "TypeScript typecheck" {
        $LASTEXITCODE -eq 0
    }) -and $gate3Passed
    $null = pnpm run build 2>$null
    $gate3Passed = (Test-Step "TypeScript build" {
        $LASTEXITCODE -eq 0
    }) -and $gate3Passed
} finally {
    Pop-Location
}

if (-not $gate3Passed) {
    Write-Host "Gate 3 FAILED - TypeScript compilation errors" -ForegroundColor Red
    $allPassed = $false
}

# =============================================================================
# GATE 4: Test Coverage
# =============================================================================
Write-Host "`n[Gate 4] Checking test coverage..." -ForegroundColor Yellow

$gate4Passed = $true

$gate4Passed = (Test-Step "Route constants tests" {
    $content = Get-Content "$RootDir/apps/api/test/route-service.test.mjs" -Raw
    ($content -match "VEHICLE_TYPES") -and ($content -match "ROUTE_ALTERNATIVES")
}) -and $gate4Passed

$gate4Passed = (Test-Step "Max route length tests" {
    $content = Get-Content "$RootDir/apps/api/test/route-service.test.mjs" -Raw
    $content -match "50000"
}) -and $gate4Passed

$gate4Passed = (Test-Step "Risk integration tests" {
    $content = Get-Content "$RootDir/apps/api/test/route-service.test.mjs" -Raw
    $content -match "Risk Integration"
}) -and $gate4Passed

$gate4Passed = (Test-Step "Balanced scoring tests" {
    $content = Get-Content "$RootDir/apps/api/test/route-service.test.mjs" -Raw
    $content -match "Balanced Scoring"
}) -and $gate4Passed

if (-not $gate4Passed) {
    Write-Host "Gate 4 FAILED - Insufficient test coverage" -ForegroundColor Red
    $allPassed = $false
}

# =============================================================================
# GATE 5: API Contract Validation
# =============================================================================
Write-Host "`n[Gate 5] Checking API contracts..." -ForegroundColor Yellow

$gate5Passed = $true

$gate5Passed = (Test-Step "RouteRequest interface" {
    $content = Get-Content "$RootDir/packages/contracts/src/route-v1.ts" -Raw
    ($content -match "interface RouteRequest") -and ($content -match "origin:") -and ($content -match "destination:")
}) -and $gate5Passed

$gate5Passed = (Test-Step "RouteResponse interface" {
    $content = Get-Content "$RootDir/packages/contracts/src/route-v1.ts" -Raw
    ($content -match "interface RouteResponse") -and ($content -match "alternatives:") -and ($content -match "attribution:")
}) -and $gate5Passed

$gate5Passed = (Test-Step "SamplePoint interface" {
    $content = Get-Content "$RootDir/packages/contracts/src/route-v1.ts" -Raw
    ($content -match "interface SamplePoint") -and ($content -match "eta:") -and ($content -match "coordinates:")
}) -and $gate5Passed

$gate5Passed = (Test-Step "SegmentRisk interface" {
    $content = Get-Content "$RootDir/packages/contracts/src/route-v1.ts" -Raw
    ($content -match "interface SegmentRisk") -and ($content -match "risk_level:") -and ($content -match "severity:")
}) -and $gate5Passed

if (-not $gate5Passed) {
    Write-Host "Gate 5 FAILED - Missing API contracts" -ForegroundColor Red
    $allPassed = $false
}

# =============================================================================
# GATE 6: Documentation
# =============================================================================
Write-Host "`n[Gate 6] Checking documentation..." -ForegroundColor Yellow

$gate6Passed = $true

$gate6Passed = (Test-Step "PHASE_8_DECISIONS.md has ROUTE-001..008" {
    $content = Get-Content "$RootDir/docs/Plan_Phases/PHASE_8_DECISIONS.md" -Raw
    ($content -match "ROUTE-001") -and ($content -match "ROUTE-008")
}) -and $gate6Passed

$gate6Passed = (Test-Step "DECISIONS.md updated" {
    $content = Get-Content "$RootDir/docs/Plan_Phases/DECISIONS.md" -Raw
    ($content -match "ROUTE-001")
}) -and $gate6Passed

$gate6Passed = (Test-Step "STATUS.md shows Phase 8 IN_PROGRESS" {
    $content = Get-Content "$RootDir/docs/Plan_Phases/STATUS.md" -Raw
    ($content -match "Phase 8") -and ($content -match "IN_PROGRESS")
}) -and $gate6Passed

if (-not $gate6Passed) {
    Write-Host "Gate 6 FAILED - Documentation incomplete" -ForegroundColor Red
    $allPassed = $false
}

# =============================================================================
# Summary
# =============================================================================
Write-Host "`n========================================" -ForegroundColor Cyan
if ($allPassed) {
    Write-Host "Phase 8 Validation: PASSED" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Cyan
    exit 0
} else {
    Write-Host "Phase 8 Validation: FAILED" -ForegroundColor Red
    Write-Host "========================================" -ForegroundColor Cyan
    exit 1
}
