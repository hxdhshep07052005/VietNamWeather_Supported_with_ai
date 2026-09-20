# Phase 11 Validation Script
# Validates AI Chatbot implementation against AI-001..007 decisions

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RootDir = Split-Path -Parent (Split-Path -Parent $ScriptDir)

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "Phase 11 Validation - AI Chatbot & Grounding Architecture" -ForegroundColor Cyan
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

$gate1Passed = (Test-Step "chat-v1.ts contracts" {
    Test-Path "$RootDir/packages/contracts/src/chat-v1.ts"
}) -and $gate1Passed

$gate1Passed = (Test-Step "chat-tools.ts" {
    Test-Path "$RootDir/apps/api/src/chat/chat-tools.ts"
}) -and $gate1Passed

$gate1Passed = (Test-Step "llm-adapter.ts" {
    Test-Path "$RootDir/apps/api/src/chat/llm-adapter.ts"
}) -and $gate1Passed

$gate1Passed = (Test-Step "chat-service.ts" {
    Test-Path "$RootDir/apps/api/src/chat/chat-service.ts"
}) -and $gate1Passed

$gate1Passed = (Test-Step "chat routes.ts" {
    Test-Path "$RootDir/apps/api/src/chat/routes.ts"
}) -and $gate1Passed

$gate1Passed = (Test-Step "chat/index.ts" {
    Test-Path "$RootDir/apps/api/src/chat/index.ts"
}) -and $gate1Passed

$gate1Passed = (Test-Step "chat-service.test.mjs" {
    Test-Path "$RootDir/apps/api/test/chat-service.test.mjs"
}) -and $gate1Passed

$gate1Passed = (Test-Step "FloatingChatWidget.tsx" {
    Test-Path "$RootDir/apps/web/src/components/chat/FloatingChatWidget.tsx"
}) -and $gate1Passed

$gate1Passed = (Test-Step "FloatingChatWidget.module.css" {
    Test-Path "$RootDir/apps/web/src/components/chat/FloatingChatWidget.module.css"
}) -and $gate1Passed

$gate1Passed = (Test-Step "PHASE_11_DECISIONS.md" {
    Test-Path "$RootDir/docs/Plan_Phases/PHASE_11_DECISIONS.md"
}) -and $gate1Passed

if (-not $gate1Passed) {
    Write-Host "Gate 1 FAILED - Missing files" -ForegroundColor Red
    $allPassed = $false
}

# =============================================================================
# GATE 2: Decision Gate Compliance (AI-001..007)
# =============================================================================
Write-Host "`n[Gate 2] Checking Decision Gate compliance..." -ForegroundColor Yellow

$gate2Passed = $true

# AI-001: Grounding Tool Allowlist
$gate2Passed = (Test-Step "AI-001: 5 grounding tools defined" {
    $content = Get-Content "$RootDir/packages/contracts/src/chat-v1.ts" -Raw
    $content -match 'SEARCH_LOCATION:\s*"tool_search_location"' -and 
    $content -match 'GET_CURRENT_WEATHER:\s*"tool_get_current_weather"' -and 
    $content -match 'GET_FORECAST:\s*"tool_get_forecast"' -and 
    $content -match 'ASSESS_TRAVEL_RISK:\s*"tool_assess_travel_risk"' -and 
    $content -match 'EVALUATE_ROUTE:\s*"tool_evaluate_route"'
}) -and $gate2Passed

# AI-002: Daily Quotas (Free=3, Pro=30)
$gate2Passed = (Test-Step "AI-002: Free=3 and Pro=30 daily quotas" {
    $content = Get-Content "$RootDir/packages/contracts/src/chat-v1.ts" -Raw
    $content -match 'free:\s*\{\s*dailyMessages:\s*3\s*\}' -and 
    $content -match 'pro:\s*\{\s*dailyMessages:\s*30\s*\}'
}) -and $gate2Passed

# AI-004: Session Scoping & History Limit
$gate2Passed = (Test-Step "AI-004: History turns capped at 10" {
    $content = Get-Content "$RootDir/packages/contracts/src/chat-v1.ts" -Raw
    $content -match 'CHAT_MAX_HISTORY_TURNS\s*=\s*10'
}) -and $gate2Passed

# AI-005: Input Sanitization & Max Message Length
$gate2Passed = (Test-Step "AI-005: Message length 1000 and sanitization" {
    $content = Get-Content "$RootDir/packages/contracts/src/chat-v1.ts" -Raw
    $serviceContent = Get-Content "$RootDir/apps/api/src/chat/chat-service.ts" -Raw
    $content -match 'CHAT_MAX_MESSAGE_LENGTH\s*=\s*1000' -and
    $serviceContent -match 'sanitizeInput'
}) -and $gate2Passed

# AI-006: Safety Disclaimers
$gate2Passed = (Test-Step "AI-006: Mandatory safety disclaimer" {
    $adapterContent = Get-Content "$RootDir/apps/api/src/chat/llm-adapter.ts" -Raw
    $adapterContent -match 'MANDATORY_DISCLAIMER'
}) -and $gate2Passed

# AI-007: Floating Chat Widget UI
$gate2Passed = (Test-Step "AI-007: FloatingChatWidget mounted in ProtectedLayout" {
    $layoutContent = Get-Content "$RootDir/apps/web/src/components/layout/ProtectedLayout.tsx" -Raw
    $layoutContent -match 'FloatingChatWidget'
}) -and $gate2Passed

if (-not $gate2Passed) {
    Write-Host "Gate 2 FAILED - Decision compliance check failed" -ForegroundColor Red
    $allPassed = $false
}

# =============================================================================
# GATE 3: Automated Unit Tests
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
    Write-Host "ALL GATES PASSED! Phase 11 validation SUCCESSFUL" -ForegroundColor Green
    Write-Host "==========================================================" -ForegroundColor Cyan
    exit 0
} else {
    Write-Host "SOME GATES FAILED! Review issues above" -ForegroundColor Red
    Write-Host "==========================================================" -ForegroundColor Cyan
    exit 1
}
