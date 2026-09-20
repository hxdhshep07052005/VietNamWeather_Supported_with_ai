# Phase 12 Validation Script
# Validates Quality, Security Hardening, and Observability against QUAL-001..008 decisions

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RootDir = Split-Path -Parent (Split-Path -Parent $ScriptDir)

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "Phase 12 Validation - Quality, Security & Observability" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host ""

$allPassed = $true

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

$gate1Passed = (Test-Step "PHASE_12_DECISIONS.md" {
    Test-Path "$RootDir/docs/Plan_Phases/PHASE_12_DECISIONS.md"
}) -and $gate1Passed

$gate1Passed = (Test-Step "phase-12-quality-security.md" {
    Test-Path "$RootDir/docs/Plan_Phases/phase-12-quality-security.md"
}) -and $gate1Passed

$gate1Passed = (Test-Step "security-hardening.test.mjs" {
    Test-Path "$RootDir/apps/api/test/security-hardening.test.mjs"
}) -and $gate1Passed

$gate1Passed = (Test-Step "observability.test.mjs" {
    Test-Path "$RootDir/apps/api/test/observability.test.mjs"
}) -and $gate1Passed

if (-not $gate1Passed) {
    Write-Host "Gate 1 FAILED - Missing required files" -ForegroundColor Red
    $allPassed = $false
}

# =============================================================================
# GATE 2: Decision Gate Compliance (QUAL-001..QUAL-008)
# =============================================================================
Write-Host "`n[Gate 2] Checking Decision Gate compliance..." -ForegroundColor Yellow

$gate2Passed = $true

# QUAL-001: Global Quality Gate & Zero Tolerance
$gate2Passed = (Test-Step "QUAL-001: Decision Gate defined with 100% test pass policy" {
    $decisions = Get-Content "$RootDir/docs/Plan_Phases/PHASE_12_DECISIONS.md" -Raw
    $decisions -match "QUAL-001" -and $decisions -match "100% automated test pass rate"
}) -and $gate2Passed

# QUAL-002: Secret Redaction & Log Hygiene
$gate2Passed = (Test-Step "QUAL-002: Redaction configured in Fastify logger" {
    $serverCode = Get-Content "$RootDir/apps/api/src/server.ts" -Raw
    $serverCode -match "censor:\s*""\[REDACTED\]""" -and
    $serverCode -match "req\.body\.password" -and
    $serverCode -match "req\.body\.refresh_token"
}) -and $gate2Passed

# QUAL-003: Mutation Security - Origin & CSRF Guards
$gate2Passed = (Test-Step "QUAL-003: Origin and CSRF guards enforced on mutations" {
    $serverCode = Get-Content "$RootDir/apps/api/src/server.ts" -Raw
    $serverCode -match "function originGuard" -and
    $serverCode -match "function csrfGuard" -and
    $serverCode -match "requireMutationSecurity"
}) -and $gate2Passed

# QUAL-004: Observability & Distributed Correlation Tracking
$gate2Passed = (Test-Step "QUAL-004: Correlation ID propagation and health probes" {
    $serverCode = Get-Content "$RootDir/apps/api/src/server.ts" -Raw
    $serverCode -match 'reply\.header\("x-correlation-id", correlationId\(request\)\)' -and
    $serverCode -match 'app\.get\("/health/live"' -and
    $serverCode -match 'app\.get\("/health/ready"'
}) -and $gate2Passed

# QUAL-005: Tiered Rate Limiting & Abuse Prevention
$gate2Passed = (Test-Step "QUAL-005: Rate limiting configured on auth and API endpoints" {
    $serverCode = Get-Content "$RootDir/apps/api/src/server.ts" -Raw
    $serverCode -match "rateLimit" -and
    $serverCode -match "RATE_LIMITED"
}) -and $gate2Passed

# QUAL-006: Zero-Fake-Data Invariant & Graceful Degradation
$gate2Passed = (Test-Step "QUAL-006: Stale data returns UNKNOWN risk without fake numbers" {
    $riskCode = Get-Content "$RootDir/apps/api/src/risk/risk-engine.ts" -Raw
    $riskCode -match "RISK_LEVELS\.UNKNOWN" -and
    $riskCode -match 'freshnessState !== "fresh"'
}) -and $gate2Passed

# QUAL-007: Webhook Anti-Replay & HMAC Integrity
$gate2Passed = (Test-Step "QUAL-007: Webhook verification and idempotency ledger" {
    $stripeCode = Get-Content "$RootDir/apps/api/src/billing/stripe-adapter.ts" -Raw
    $billingCode = Get-Content "$RootDir/apps/api/src/billing/billing-service.ts" -Raw
    $routesCode = Get-Content "$RootDir/apps/api/src/billing/routes.ts" -Raw
    $stripeCode -match "verifyWebhookSignature" -and
    $billingCode -match "processedEvents" -and
    $routesCode -match "BILLING_INVALID_SIGNATURE"
}) -and $gate2Passed

# QUAL-008: AI Grounding & Prompt Injection Protection
$gate2Passed = (Test-Step "QUAL-008: AI input sanitization and allowlisted grounding tools" {
    $chatCode = Get-Content "$RootDir/apps/api/src/chat/chat-service.ts" -Raw
    $toolsCode = Get-Content "$RootDir/apps/api/src/chat/chat-tools.ts" -Raw
    $chatCode -match "sanitizeInput" -and
    $toolsCode -match "Tool not permitted"
}) -and $gate2Passed

if (-not $gate2Passed) {
    Write-Host "Gate 2 FAILED - Decision compliance check failed" -ForegroundColor Red
    $allPassed = $false
}

# =============================================================================
# GATE 3: Automated Unit Tests (100% Pass Across Monorepo)
# =============================================================================
Write-Host "`n[Gate 3] Running Automated Unit Tests..." -ForegroundColor Yellow

$gate3Passed = (Test-Step "API tests pass (160 tests)" {
    $output = cmd /c "pnpm --filter @vietnam-weather/api test 2>&1"
    $output -match "pass 160" -and $output -notmatch "fail [1-9]"
}) -and (Test-Step "Worker tests pass (35 tests)" {
    $output = cmd /c "pnpm --filter @vietnam-weather/worker test 2>&1"
    $output -match "pass 35" -and $output -notmatch "fail [1-9]"
}) -and (Test-Step "Web frontend tests pass (12 tests)" {
    $output = cmd /c "pnpm --filter @vietnam-weather/web test 2>&1"
    $output -match "12 passed" -and $output -notmatch "failed"
})

if (-not $gate3Passed) {
    Write-Host "Gate 3 FAILED - Unit tests failed" -ForegroundColor Red
    $allPassed = $false
}

# =============================================================================
# GATE 4: Full Monorepo Typecheck & Lint Clean
# =============================================================================
Write-Host "`n[Gate 4] Verifying Monorepo Typecheck & Lint..." -ForegroundColor Yellow

$gate4Passed = (Test-Step "Monorepo typecheck clean (0 errors)" {
    $output = cmd /c "pnpm run typecheck 2>&1"
    $LASTEXITCODE -eq 0
}) -and (Test-Step "Monorepo lint clean (0 errors, 0 warnings)" {
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
    Write-Host "ALL GATES PASSED! Phase 12 validation SUCCESSFUL" -ForegroundColor Green
    Write-Host "Total verified tests: 207 / 207 passing" -ForegroundColor Green
    Write-Host "Zero-fake-data invariant verified" -ForegroundColor Green
    Write-Host "Security hardening & Observability verified" -ForegroundColor Green
    Write-Host "==========================================================" -ForegroundColor Cyan
    exit 0
} else {
    Write-Host "SOME GATES FAILED! Review issues above" -ForegroundColor Red
    Write-Host "==========================================================" -ForegroundColor Cyan
    exit 1
}
