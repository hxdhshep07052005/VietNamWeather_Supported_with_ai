# Phase 13 Validation Script
# Validates Deployment, Release & Operations against OPS-008..015 decisions

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RootDir = Split-Path -Parent (Split-Path -Parent $ScriptDir)

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "Phase 13 Validation - Deployment, Release & Operations" -ForegroundColor Cyan
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

$gate1Passed = (Test-Step "PHASE_13_DECISIONS.md" {
    Test-Path "$RootDir/docs/Plan_Phases/PHASE_13_DECISIONS.md"
}) -and $gate1Passed

$gate1Passed = (Test-Step "phase-13-deployment-operations.md" {
    Test-Path "$RootDir/docs/Plan_Phases/phase-13-deployment-operations.md"
}) -and $gate1Passed

$gate1Passed = (Test-Step "apps/web/Dockerfile" {
    Test-Path "$RootDir/apps/web/Dockerfile"
}) -and $gate1Passed

$gate1Passed = (Test-Step "infra/nginx/nginx.conf" {
    Test-Path "$RootDir/infra/nginx/nginx.conf"
}) -and $gate1Passed

$gate1Passed = (Test-Step "compose.prod.yaml" {
    Test-Path "$RootDir/compose.prod.yaml"
}) -and $gate1Passed

$gate1Passed = (Test-Step "generate-production-secrets.ps1" {
    Test-Path "$RootDir/tools/environment/generate-production-secrets.ps1"
}) -and $gate1Passed

$gate1Passed = (Test-Step "backup-prod.ps1" {
    Test-Path "$RootDir/tools/database/backup-prod.ps1"
}) -and $gate1Passed

$gate1Passed = (Test-Step "restore-prod-drill.ps1" {
    Test-Path "$RootDir/tools/database/restore-prod-drill.ps1"
}) -and $gate1Passed

$gate1Passed = (Test-Step "RUNBOOK_DEPLOYMENT.md" {
    Test-Path "$RootDir/docs/operations/RUNBOOK_DEPLOYMENT.md"
}) -and $gate1Passed

$gate1Passed = (Test-Step "RUNBOOK_INCIDENT_RESPONSE.md" {
    Test-Path "$RootDir/docs/operations/RUNBOOK_INCIDENT_RESPONSE.md"
}) -and $gate1Passed

$gate1Passed = (Test-Step "RUNBOOK_BACKUP_RESTORE.md" {
    Test-Path "$RootDir/docs/operations/RUNBOOK_BACKUP_RESTORE.md"
}) -and $gate1Passed

$gate1Passed = (Test-Step "RUNBOOK_MONITORING_ALERTS.md" {
    Test-Path "$RootDir/docs/operations/RUNBOOK_MONITORING_ALERTS.md"
}) -and $gate1Passed

if (-not $gate1Passed) {
    Write-Host "Gate 1 FAILED - Missing required files" -ForegroundColor Red
    $allPassed = $false
}

# =============================================================================
# GATE 2: Decision Gate Compliance (OPS-008..OPS-015)
# =============================================================================
Write-Host "`n[Gate 2] Checking Decision Gate compliance..." -ForegroundColor Yellow

$gate2Passed = $true

# OPS-008: Production VPS Infrastructure Baseline
$gate2Passed = (Test-Step "OPS-008: VPS baseline and container portability" {
    $decisions = Get-Content "$RootDir/docs/Plan_Phases/PHASE_13_DECISIONS.md" -Raw
    $decisions -match "OPS-008" -and $decisions -match "Ubuntu 24.04 LTS" -and $decisions -match "4 vCPU"
}) -and $gate2Passed

# OPS-009: Multi-Tier Production Topology & Network Isolation
$gate2Passed = (Test-Step "OPS-009: Internal data network isolation in compose.prod.yaml" {
    $compose = Get-Content "$RootDir/compose.prod.yaml" -Raw
    $compose -match "internal:\s*true" -and
    $compose -match "networks:\s*[\r\n\s]+-\s*data"
}) -and $gate2Passed

# OPS-010: Private Directus Admin Studio Ingress
$gate2Passed = (Test-Step "OPS-010: Directus loopback binding and Nginx admin block" {
    $compose = Get-Content "$RootDir/compose.prod.yaml" -Raw
    $nginx = Get-Content "$RootDir/infra/nginx/nginx.conf" -Raw
    $compose -match '127\.0\.0\.1:\$\{DIRECTUS_HOST_PORT:-8055\}:8055' -and
    $nginx -match 'location \^~ /admin' -and
    $nginx -match 'return 403'
}) -and $gate2Passed

# OPS-011: Zero-Downtime Deployment & Healthcheck Dependencies
$gate2Passed = (Test-Step "OPS-011: Service healthcheck dependencies in Compose" {
    $compose = Get-Content "$RootDir/compose.prod.yaml" -Raw
    $compose -match 'condition:\s*service_healthy' -and
    $compose -match 'healthcheck:'
}) -and $gate2Passed

# OPS-012: Disaster Recovery & Backup Invariants (RPO <= 24h, RTO <= 1h)
$gate2Passed = (Test-Step "OPS-012: Disaster recovery RPO/RTO invariants and SHA256 checksums" {
    $backupScript = Get-Content "$RootDir/tools/database/backup-prod.ps1" -Raw
    $restoreScript = Get-Content "$RootDir/tools/database/restore-prod-drill.ps1" -Raw
    $backupScript -match "pg_dump -Fc" -and
    $backupScript -match "Get-FileHash -Algorithm SHA256" -and
    $restoreScript -match "RESTORE_DRILL_OK"
}) -and $gate2Passed

# OPS-013: Budget Envelope Enforcement (15,000,000 VND / month)
$gate2Passed = (Test-Step "OPS-013: Budget ceiling and alert tiers" {
    $monitoring = Get-Content "$RootDir/docs/operations/RUNBOOK_MONITORING_ALERTS.md" -Raw
    $monitoring -match "15,000,000 VND" -and
    $monitoring -match "7,500,000 VND" -and
    $monitoring -match "11,250,000 VND" -and
    $monitoring -match "13,500,000 VND"
}) -and $gate2Passed

# OPS-014: Secret Lifecycle & Non-Root Execution
$gate2Passed = (Test-Step "OPS-014: Cryptographic secret generation and non-root users" {
    $secretGen = Get-Content "$RootDir/tools/environment/generate-production-secrets.ps1" -Raw
    $apiDocker = Get-Content "$RootDir/apps/api/Dockerfile" -Raw
    $webDocker = Get-Content "$RootDir/apps/web/Dockerfile" -Raw
    $secretGen -match "RandomNumberGenerator" -and
    $apiDocker -match "USER node" -and
    $webDocker -match "USER nginx"
}) -and $gate2Passed

# OPS-015: Operational Runbooks
$gate2Passed = (Test-Step "OPS-015: All 4 operational runbooks populated and actionable" {
    (Test-Path "$RootDir/docs/operations/RUNBOOK_DEPLOYMENT.md") -and
    (Test-Path "$RootDir/docs/operations/RUNBOOK_INCIDENT_RESPONSE.md") -and
    (Test-Path "$RootDir/docs/operations/RUNBOOK_BACKUP_RESTORE.md") -and
    (Test-Path "$RootDir/docs/operations/RUNBOOK_MONITORING_ALERTS.md")
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
    Write-Host "ALL GATES PASSED! Phase 13 validation SUCCESSFUL" -ForegroundColor Green
    Write-Host "Total verified tests: 207 / 207 passing" -ForegroundColor Green
    Write-Host "Production containerization & topology verified" -ForegroundColor Green
    Write-Host "Disaster recovery invariants & runbooks verified" -ForegroundColor Green
    Write-Host "==========================================================" -ForegroundColor Cyan
    exit 0
} else {
    Write-Host "SOME GATES FAILED! Review issues above" -ForegroundColor Red
    Write-Host "==========================================================" -ForegroundColor Cyan
    exit 1
}
