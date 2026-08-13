# Phase 7 Validation Script
# Validates Forecast & Trend implementation against FCAST-001..006 decisions

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RootDir = Split-Path -Parent (Split-Path -Parent $ScriptDir)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Phase 7 Validation - Forecast & Trends" -ForegroundColor Cyan
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

$gate1Passed = (Test-Step "forecast-v1.ts contracts" {
    Test-Path "$RootDir/packages/contracts/src/forecast-v1.ts"
}) -and $gate1Passed

$gate1Passed = (Test-Step "trend-v1.ts contracts" {
    Test-Path "$RootDir/packages/contracts/src/trend-v1.ts"
}) -and $gate1Passed

$gate1Passed = (Test-Step "forecast-service.ts" {
    Test-Path "$RootDir/apps/api/src/forecast/forecast-service.ts"
}) -and $gate1Passed

$gate1Passed = (Test-Step "trend-service.ts" {
    Test-Path "$RootDir/apps/api/src/forecast/trend-service.ts"
}) -and $gate1Passed

$gate1Passed = (Test-Step "forecast tests" {
    Test-Path "$RootDir/apps/api/test/forecast-service.test.mjs"
}) -and $gate1Passed

$gate1Passed = (Test-Step "PHASE_7_DECISIONS.md" {
    Test-Path "$RootDir/docs/Plan_Phases/PHASE_7_DECISIONS.md"
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

# FCAST-001: Hourly max 72h, Daily max 3d
$gate2Passed = (Test-Step "FCAST-001: FORECAST_HOURLY_MAX_HOURS = 72" {
    $content = Get-Content "$RootDir/packages/contracts/src/forecast-v1.ts" -Raw
    $content -match "FORECAST_HOURLY_MAX_HOURS\s*=\s*72"
}) -and $gate2Passed

$gate2Passed = (Test-Step "FCAST-001: FORECAST_DAILY_MAX_DAYS = 3" {
    $content = Get-Content "$RootDir/packages/contracts/src/forecast-v1.ts" -Raw
    $content -match "FORECAST_DAILY_MAX_DAYS\s*=\s*3"
}) -and $gate2Passed

# FCAST-002: Trend threshold 2°C
$gate2Passed = (Test-Step "FCAST-002: TEMP_TREND_THRESHOLD_C = 2" {
    $content = Get-Content "$RootDir/packages/contracts/src/trend-v1.ts" -Raw
    $content -match "TEMP_TREND_THRESHOLD_C\s*=\s*2"
}) -and $gate2Passed

# FCAST-003: Chart variables defined
$gate2Passed = (Test-Step "FCAST-003: CHART_VARIABLES defined" {
    $content = Get-Content "$RootDir/packages/contracts/src/forecast-v1.ts" -Raw
    ($content -match "CHART_VARIABLES") -and ($content -match "temperature") -and ($content -match "wind_speed")
}) -and $gate2Passed

# FCAST-005: Vietnam timezone
$gate2Passed = (Test-Step "FCAST-005: DISPLAY_TIMEZONE = Asia/Ho_Chi_Minh" {
    $content = Get-Content "$RootDir/packages/contracts/src/forecast-v1.ts" -Raw
    $content -match "Asia/Ho_Chi_Minh"
}) -and $gate2Passed

$gate2Passed = (Test-Step "FCAST-005: ICT offset = +7" {
    $content = Get-Content "$RootDir/packages/contracts/src/forecast-v1.ts" -Raw
    $content -match "DISPLAY_TIMEZONE_OFFSET_HOURS\s*=\s*7"
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
    $typecheckResult = pnpm run typecheck 2>&1
    $gate3Passed = (Test-Step "TypeScript typecheck" {
        $LASTEXITCODE -eq 0
    })
    if (-not $gate3Passed) {
        Write-Host "TypeScript output: $typecheckResult" -ForegroundColor Yellow
    }
    $buildResult = pnpm run build 2>&1
    $gate3Passed = (Test-Step "TypeScript build" {
        $LASTEXITCODE -eq 0
    }) -and $gate3Passed
    if (-not $gate3Passed) {
        Write-Host "Build output: $buildResult" -ForegroundColor Yellow
    }
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

# Count forecast-related tests
$gate4Passed = (Test-Step "Forecast tests exist" {
    $content = Get-Content "$RootDir/apps/api/test/forecast-service.test.mjs" -Raw
    ($content -match "formatDisplayTime") -and ($content -match "formatDisplayDate")
}) -and $gate4Passed

$gate4Passed = (Test-Step "Timezone tests (FCAST-005)" {
    $content = Get-Content "$RootDir/apps/api/test/forecast-service.test.mjs" -Raw
    ($content -match "ICT") -and ($content -match "timezone|Timezone")
}) -and $gate4Passed

$gate4Passed = (Test-Step "Horizon limit tests (FCAST-001)" {
    $content = Get-Content "$RootDir/apps/api/test/forecast-service.test.mjs" -Raw
    ($content -match "72") -and ($content -match "3")
}) -and $gate4Passed

$gate4Passed = (Test-Step "Trend direction tests (FCAST-002)" {
    $content = Get-Content "$RootDir/apps/api/test/forecast-service.test.mjs" -Raw
    ($content -match "increasing|decreasing|stable")
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

$gate5Passed = (Test-Step "HourlyForecastPoint interface" {
    $content = Get-Content "$RootDir/packages/contracts/src/forecast-v1.ts" -Raw
    ($content -match "interface HourlyForecastPoint") -and ($content -match "time:") -and ($content -match "temp_c:")
}) -and $gate5Passed

$gate5Passed = (Test-Step "DailyForecastPoint interface" {
    $content = Get-Content "$RootDir/packages/contracts/src/forecast-v1.ts" -Raw
    ($content -match "interface DailyForecastPoint") -and ($content -match "max_temp_c:") -and ($content -match "min_temp_c:")
}) -and $gate5Passed

$gate5Passed = (Test-Step "ForecastSeries interface with attribution" {
    $content = Get-Content "$RootDir/packages/contracts/src/forecast-v1.ts" -Raw
    ($content -match "interface ForecastSeries") -and ($content -match "attribution:") -and ($content -match "freshness:")
}) -and $gate5Passed

$gate5Passed = (Test-Step "TrendSummary interface" {
    $content = Get-Content "$RootDir/packages/contracts/src/trend-v1.ts" -Raw
    ($content -match "interface TrendSummary") -and ($content -match "variable_trends:")
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

$gate6Passed = (Test-Step "PHASE_7_DECISIONS.md has FCAST-001..006" {
    $content = Get-Content "$RootDir/docs/Plan_Phases/PHASE_7_DECISIONS.md" -Raw
    ($content -match "FCAST-001") -and ($content -match "FCAST-006")
}) -and $gate6Passed

$gate6Passed = (Test-Step "DECISIONS.md updated" {
    $content = Get-Content "$RootDir/docs/Plan_Phases/DECISIONS.md" -Raw
    ($content -match "FCAST-001")
}) -and $gate6Passed

$gate6Passed = (Test-Step "STATUS.md shows Phase 7 IN_PROGRESS" {
    $content = Get-Content "$RootDir/docs/Plan_Phases/STATUS.md" -Raw
    ($content -match "Phase 7") -and ($content -match "IN_PROGRESS")
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
    Write-Host "Phase 7 Validation: PASSED" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Cyan
    exit 0
} else {
    Write-Host "Phase 7 Validation: FAILED" -ForegroundColor Red
    Write-Host "========================================" -ForegroundColor Cyan
    exit 1
}
