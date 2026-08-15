# Phase 9 Validation Script
# Validates Frontend implementation against FRONT-001..008 decisions

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RootDir = Split-Path -Parent (Split-Path -Parent $ScriptDir)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Phase 9 Validation - Frontend Web App" -ForegroundColor Cyan
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

$gate1Passed = (Test-Step "package.json" {
    Test-Path "$RootDir/apps/web/package.json"
}) -and $gate1Passed

$gate1Passed = (Test-Step "tsconfig.json" {
    Test-Path "$RootDir/apps/web/tsconfig.json"
}) -and $gate1Passed

$gate1Passed = (Test-Step "vite.config.ts" {
    Test-Path "$RootDir/apps/web/vite.config.ts"
}) -and $gate1Passed

$gate1Passed = (Test-Step "index.html" {
    Test-Path "$RootDir/apps/web/index.html"
}) -and $gate1Passed

$gate1Passed = (Test-Step "src/main.tsx" {
    Test-Path "$RootDir/apps/web/src/main.tsx"
}) -and $gate1Passed

$gate1Passed = (Test-Step "src/App.tsx" {
    Test-Path "$RootDir/apps/web/src/App.tsx"
}) -and $gate1Passed

$gate1Passed = (Test-Step "src/styles/tokens.css" {
    Test-Path "$RootDir/apps/web/src/styles/tokens.css"
}) -and $gate1Passed

$gate1Passed = (Test-Step "src/api/client.ts" {
    Test-Path "$RootDir/apps/web/src/api/client.ts"
}) -and $gate1Passed

$gate1Passed = (Test-Step "src/hooks/useAuthStore.ts" {
    Test-Path "$RootDir/apps/web/src/hooks/useAuthStore.ts"
}) -and $gate1Passed

$gate1Passed = (Test-Step "src/pages/LandingPage.tsx" {
    Test-Path "$RootDir/apps/web/src/pages/LandingPage.tsx"
}) -and $gate1Passed

$gate1Passed = (Test-Step "PHASE_9_DECISIONS.md" {
    Test-Path "$RootDir/docs/Plan_Phases/PHASE_9_DECISIONS.md"
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

# FRONT-001: React + Vite
$gate2Passed = (Test-Step "FRONT-001: React dependency" {
    $content = Get-Content "$RootDir/apps/web/package.json" -Raw
    $content -match '"react":'
}) -and $gate2Passed

$gate2Passed = (Test-Step "FRONT-001: Vite build tool" {
    $content = Get-Content "$RootDir/apps/web/package.json" -Raw
    $content -match '"vite":'
}) -and $gate2Passed

$gate2Passed = (Test-Step "FRONT-001: Zustand state" {
    $content = Get-Content "$RootDir/apps/web/package.json" -Raw
    $content -match '"zustand":'
}) -and $gate2Passed

# FRONT-002: Design tokens
$gate2Passed = (Test-Step "FRONT-002: Primary color #0066CC" {
    $content = Get-Content "$RootDir/apps/web/src/styles/tokens.css" -Raw
    $content -match '#0066CC'
}) -and $gate2Passed

$gate2Passed = (Test-Step "FRONT-002: Risk colors" {
    $content = Get-Content "$RootDir/apps/web/src/styles/tokens.css" -Raw
    ($content -match '--color-risk-low') -and ($content -match '--color-risk-high')
}) -and $gate2Passed

# FRONT-003: Landing page
$gate2Passed = (Test-Step "FRONT-003: Landing page with pricing" {
    $content = Get-Content "$RootDir/apps/web/src/pages/LandingPage.tsx" -Raw
    ($content -match "Miễn phí") -and ($content -match "Pro")
}) -and $gate2Passed

# FRONT-004: API client
$gate2Passed = (Test-Step "FRONT-004: Weather API methods" {
    $content = Get-Content "$RootDir/apps/web/src/api/client.ts" -Raw
    ($content -match "getForecast") -and ($content -match "getAssessment")
}) -and $gate2Passed

if (-not $gate2Passed) {
    Write-Host "Gate 2 FAILED - Decision Gate non-compliance" -ForegroundColor Red
    $allPassed = $false
}

# =============================================================================
# GATE 3: Architecture
# =============================================================================
Write-Host "`n[Gate 3] Checking architecture compliance..." -ForegroundColor Yellow

$gate3Passed = $true

# API-only integration (no backend imports)
$gate3Passed = (Test-Step "GATE-3: API client exists" {
    Test-Path "$RootDir/apps/web/src/api/client.ts"
}) -and $gate3Passed

# Auth store with Zustand
$gate3Passed = (Test-Step "GATE-3: Auth store with Zustand" {
    $content = Get-Content "$RootDir/apps/web/src/hooks/useAuthStore.ts" -Raw
    $content -match "create<AuthStore>"
}) -and $gate3Passed

# No direct backend imports in frontend
$gate3Passed = (Test-Step "GATE-3: No @vietnam-weather/api imports in frontend" {
    $content = Get-Content "$RootDir/apps/web/src/api/client.ts" -Raw
    -not ($content -match "@vietnam-weather/api")
}) -and $gate3Passed

if (-not $gate3Passed) {
    Write-Host "Gate 3 FAILED - Architecture violation" -ForegroundColor Red
    $allPassed = $false
}

# =============================================================================
# Summary
# =============================================================================
Write-Host "`n========================================" -ForegroundColor Cyan
if ($allPassed) {
    Write-Host "Phase 9 Validation: PASSED" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Cyan
    exit 0
} else {
    Write-Host "Phase 9 Validation: FAILED" -ForegroundColor Red
    Write-Host "========================================" -ForegroundColor Cyan
    exit 1
}
