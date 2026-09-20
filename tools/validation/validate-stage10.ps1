# Phase 10 Validation Script
# Validates Monetization, Subscription & Entitlements against MONET-001..008 decisions

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RootDir = Split-Path -Parent (Split-Path -Parent $ScriptDir)

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "Phase 10 Validation - Monetization, Subscriptions & Quotas" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan
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

$gate1Passed = (Test-Step "billing-v1.ts contracts" {
    Test-Path "$RootDir/packages/contracts/src/billing-v1.ts"
}) -and $gate1Passed

$gate1Passed = (Test-Step "quota-service.ts" {
    Test-Path "$RootDir/apps/api/src/billing/quota-service.ts"
}) -and $gate1Passed

$gate1Passed = (Test-Step "payment-adapter.ts" {
    Test-Path "$RootDir/apps/api/src/billing/payment-adapter.ts"
}) -and $gate1Passed

$gate1Passed = (Test-Step "stripe-adapter.ts" {
    Test-Path "$RootDir/apps/api/src/billing/stripe-adapter.ts"
}) -and $gate1Passed

$gate1Passed = (Test-Step "vnpay-adapter.ts" {
    Test-Path "$RootDir/apps/api/src/billing/vnpay-adapter.ts"
}) -and $gate1Passed

$gate1Passed = (Test-Step "billing-service.ts" {
    Test-Path "$RootDir/apps/api/src/billing/billing-service.ts"
}) -and $gate1Passed

$gate1Passed = (Test-Step "billing routes.ts" {
    Test-Path "$RootDir/apps/api/src/billing/routes.ts"
}) -and $gate1Passed

$gate1Passed = (Test-Step "billing/index.ts" {
    Test-Path "$RootDir/apps/api/src/billing/index.ts"
}) -and $gate1Passed

$gate1Passed = (Test-Step "quota-service.test.mjs" {
    Test-Path "$RootDir/apps/api/test/quota-service.test.mjs"
}) -and $gate1Passed

$gate1Passed = (Test-Step "billing-service.test.mjs" {
    Test-Path "$RootDir/apps/api/test/billing-service.test.mjs"
}) -and $gate1Passed

$gate1Passed = (Test-Step "PHASE_10_DECISIONS.md" {
    Test-Path "$RootDir/docs/Plan_Phases/PHASE_10_DECISIONS.md"
}) -and $gate1Passed

if (-not $gate1Passed) {
    Write-Host "Gate 1 FAILED - Missing files" -ForegroundColor Red
    $allPassed = $false
}

# =============================================================================
# GATE 2: Decision Gate Compliance (MONET-001..008)
# =============================================================================
Write-Host "`n[Gate 2] Checking Decision Gate compliance..." -ForegroundColor Yellow

$gate2Passed = $true

# MONET-001: Pricing Baseline & 10-month discount
$gate2Passed = (Test-Step "MONET-001: Free and Pro plans defined" {
    $content = Get-Content "$RootDir/packages/contracts/src/billing-v1.ts" -Raw
    $content -match 'FREE:\s*"free"' -and $content -match 'PRO:\s*"pro"'
}) -and $gate2Passed

$gate2Passed = (Test-Step "MONET-001: Monthly price 99.000 VND / $4.99" {
    $content = Get-Content "$RootDir/packages/contracts/src/billing-v1.ts" -Raw
    $content -match 'amount:\s*99_000' -and $content -match 'amount:\s*499'
}) -and $gate2Passed

$gate2Passed = (Test-Step "MONET-001 / PRODUCT-003: Yearly price equals 10 months (990.000 VND)" {
    $content = Get-Content "$RootDir/packages/contracts/src/billing-v1.ts" -Raw
    $content -match 'amount:\s*990_000' -and $content -match 'amount:\s*4990'
}) -and $gate2Passed

# MONET-002: Dual Payment Providers
$gate2Passed = (Test-Step "MONET-002: Stripe and VNPay providers" {
    $content = Get-Content "$RootDir/packages/contracts/src/billing-v1.ts" -Raw
    $content -match 'STRIPE:\s*"stripe"' -and $content -match 'VNPAY:\s*"vnpay"'
}) -and $gate2Passed

# MONET-004: Atomic Quota Ledger & Reset Timezone
$gate2Passed = (Test-Step "MONET-004: Daily reset at Asia/Ho_Chi_Minh" {
    $content = Get-Content "$RootDir/packages/contracts/src/billing-v1.ts" -Raw
    $content -match 'QUOTA_RESET_TIMEZONE\s*=\s*"Asia/Ho_Chi_Minh"'
}) -and $gate2Passed

$gate2Passed = (Test-Step "MONET-004: Free search=10, route=3; Pro search=200, route=30" {
    $content = Get-Content "$RootDir/packages/contracts/src/billing-v1.ts" -Raw
    $content -match 'dailyLocationSearch:\s*10' -and 
    $content -match 'dailyRouteEvaluation:\s*3' -and 
    $content -match 'dailyLocationSearch:\s*200' -and 
    $content -match 'dailyRouteEvaluation:\s*30'
}) -and $gate2Passed

# MONET-005: Feature Keys
$gate2Passed = (Test-Step "MONET-005: Future timeline and corridors gating" {
    $content = Get-Content "$RootDir/packages/contracts/src/billing-v1.ts" -Raw
    $content -match 'FUTURE_TIMELINE:\s*"feature_weather_future_timeline"' -and 
    $content -match 'ROUTE_ALTERNATIVES:\s*"feature_route_alternatives"'
}) -and $gate2Passed

# MONET-006: Webhook HMAC signature verification
$gate2Passed = (Test-Step "MONET-006: Stripe HMAC-SHA256 verification" {
    $content = Get-Content "$RootDir/apps/api/src/billing/stripe-adapter.ts" -Raw
    $content -match 'createHmac\("sha256"' -and $content -match 'timingSafeEqual'
}) -and $gate2Passed

$gate2Passed = (Test-Step "MONET-006: VNPay HMAC-SHA512 verification" {
    $content = Get-Content "$RootDir/apps/api/src/billing/vnpay-adapter.ts" -Raw
    $content -match 'createHmac\("sha512"' -and $content -match 'timingSafeEqual'
}) -and $gate2Passed

# MONET-008: Admin Overrides & Audit Log
$gate2Passed = (Test-Step "MONET-008: Manual grant/revoke audit logging" {
    $content = Get-Content "$RootDir/apps/api/src/billing/billing-service.ts" -Raw
    $content -match 'manualGrantPro' -and $content -match 'manualRevokePro' -and $content -match 'auditLogs'
}) -and $gate2Passed

if (-not $gate2Passed) {
    Write-Host "Gate 2 FAILED - Decision compliance check failed" -ForegroundColor Red
    $allPassed = $false
}

# =============================================================================
# GATE 3: Unit Tests
# =============================================================================
Write-Host "`n[Gate 3] Running Automated Unit Tests..." -ForegroundColor Yellow

$gate3Passed = (Test-Step "API test suite passes 100%" {
    $output = cmd /c "pnpm --filter @vietnam-weather/api test 2>&1"
    $output -match "pass \d+" -and $output -notmatch "fail [1-9]"
})

if (-not $gate3Passed) {
    Write-Host "Gate 3 FAILED - API tests failed" -ForegroundColor Red
    $allPassed = $false
}

# =============================================================================
# GATE 4: Full Monorepo Typecheck & Lint
# =============================================================================
Write-Host "`n[Gate 4] Verifying Monorepo Typecheck & Lint..." -ForegroundColor Yellow

$gate4Passed = (Test-Step "Monorepo typecheck clean" {
    $output = cmd /c "pnpm run typecheck 2>&1"
    $LASTEXITCODE -eq 0
}) -and (Test-Step "Monorepo lint clean" {
    $output = cmd /c "pnpm run lint 2>&1"
    $LASTEXITCODE -eq 0
})

if (-not $gate4Passed) {
    Write-Host "Gate 4 FAILED - Typecheck or Lint failed" -ForegroundColor Red
    $allPassed = $false
}

# =============================================================================
# Summary
# =============================================================================
Write-Host "`n==========================================================" -ForegroundColor Cyan
if ($allPassed) {
    Write-Host "ALL GATES PASSED! Phase 10 validation SUCCESSFUL" -ForegroundColor Green
    Write-Host "==========================================================" -ForegroundColor Cyan
    exit 0
} else {
    Write-Host "SOME GATES FAILED! Review issues above" -ForegroundColor Red
    Write-Host "==========================================================" -ForegroundColor Cyan
    exit 1
}
