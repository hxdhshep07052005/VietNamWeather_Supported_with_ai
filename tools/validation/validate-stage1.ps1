param(
    [string]$WorkspaceRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
)

$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

function Add-Failure {
    param([string]$Message)
    $script:Failures.Add($Message)
}

$Failures = New-Object System.Collections.Generic.List[string]
$PlanRoot = Join-Path $WorkspaceRoot 'docs\Plan_Phases'
$DecisionPath = Join-Path $PlanRoot 'DECISIONS.md'
$LocalSecretPath = Join-Path $WorkspaceRoot '.env.bakeoff.local'
$GeoapifyProbePath = Join-Path $WorkspaceRoot 'tools\provider-bakeoff\run-geoapify-capability-probe.ps1'
$FixtureRunnerPath = Join-Path $WorkspaceRoot 'tools\provider-bakeoff\run-vietnam-provider-fixtures.ps1'
$FixturePath = Join-Path $WorkspaceRoot 'tools\provider-bakeoff\fixtures\vietnam-stage1.json'

if (-not (Test-Path -LiteralPath $PlanRoot)) {
    throw "Plan root does not exist: $PlanRoot"
}

Write-Output 'CHECK relative Markdown links'
$trackedMarkdown = @(git -C $WorkspaceRoot ls-files -- '*.md')
if ($LASTEXITCODE -ne 0) { throw 'Unable to list tracked Markdown files.' }
$trackedMarkdown | ForEach-Object {
        $file = Get-Item -LiteralPath (Join-Path $WorkspaceRoot $_)
        $content = Get-Content -Raw -Encoding UTF8 -LiteralPath $file.FullName
        [regex]::Matches($content, '(?<!\!)\[[^\]]+\]\(([^)]+)\)') | ForEach-Object {
            $target = $_.Groups[1].Value.Trim().Trim('<', '>')
            if ($target -match '^(https?:|mailto:|#)') {
                return
            }

            $pathPart = ($target -split '#', 2)[0]
            if ($pathPart -and -not (Test-Path -LiteralPath (Join-Path $file.DirectoryName $pathPart))) {
                Add-Failure "Missing link target in $($file.FullName): $target"
            }
        }
    }

Write-Output 'CHECK decision definitions and references'
$decisionText = Get-Content -Raw -Encoding UTF8 -LiteralPath $DecisionPath
$definitions = [regex]::Matches(
    $decisionText,
    '(?m)^###\s+((?:PRODUCT|ARCH|SEC|DATA|OPS|AI)-\d{3})\b'
) | ForEach-Object { $_.Groups[1].Value }

$definitions | Group-Object | Where-Object Count -gt 1 | ForEach-Object {
    Add-Failure "Duplicate Decision ID: $($_.Name)"
}

$allMarkdown = ($trackedMarkdown | ForEach-Object {
    Get-Content -Raw -Encoding UTF8 -LiteralPath (Join-Path $WorkspaceRoot $_)
}) -join "`n"

$references = [regex]::Matches(
    $allMarkdown,
    '(?<![A-Z0-9-])(?:PRODUCT|ARCH|SEC|DATA|OPS|AI)-\d{3}\b'
) | ForEach-Object { $_.Value } | Sort-Object -Unique

$references | Where-Object { $_ -notin $definitions } | ForEach-Object {
    Add-Failure "Undefined Decision ID reference: $_"
}

Write-Output 'CHECK ADR required sections'
$requiredAdrHeadingPrefixes = @(
    '## B',
    '## Quy',
    '## Ph',
    '## Trade-off',
    '## Security impact',
    '## Chi ph',
    '## Migration',
    '## Evidence'
)

Get-ChildItem -LiteralPath (Join-Path $PlanRoot 'adr') -Filter 'ADR-*.md' | ForEach-Object {
    $content = Get-Content -Raw -Encoding UTF8 -LiteralPath $_.FullName
    foreach ($headingPrefix in $requiredAdrHeadingPrefixes) {
        if ($content -notmatch ('(?m)^' + [regex]::Escape($headingPrefix))) {
            Add-Failure "$($_.Name) missing heading prefix: $headingPrefix"
        }
    }
}

Write-Output 'CHECK phase status consistency'
$phase0 = Get-Content -Raw -Encoding UTF8 -LiteralPath (Join-Path $PlanRoot 'phase-00-discovery.md')
$phase1 = Get-Content -Raw -Encoding UTF8 -LiteralPath (Join-Path $PlanRoot 'phase-01-architecture.md')
$phase2 = Get-Content -Raw -Encoding UTF8 -LiteralPath (Join-Path $PlanRoot 'phase-02-directus-foundation.md')
$index = Get-Content -Raw -Encoding UTF8 -LiteralPath (Join-Path $PlanRoot 'index.md')
$status = Get-Content -Raw -Encoding UTF8 -LiteralPath (Join-Path $PlanRoot 'STATUS.md')

if ($phase0 -notmatch '\*\*Status:\*\* VERIFIED') { Add-Failure 'Phase 0 file is not VERIFIED' }
if ($phase1 -notmatch '\*\*Status:\*\* VERIFIED') { Add-Failure 'Phase 1 file is not VERIFIED' }
if ($phase2 -notmatch '\*\*Status:\*\* (?:AWAITING_DECISION|IN_PROGRESS(?:\s+—.*)?|VERIFIED)') { Add-Failure 'Phase 2 file has an invalid post-Phase-1 status' }
if ($index -notmatch '\| 0 \|.*\| VERIFIED \|') { Add-Failure 'Index Phase 0 status mismatch' }
if ($index -notmatch '\| 1 \|.*\| VERIFIED \|') { Add-Failure 'Index Phase 1 status mismatch' }
if ($index -notmatch '\| 2 \|.*\| (?:AWAITING_DECISION|IN_PROGRESS(?:\s+—.*)?|VERIFIED) \|') { Add-Failure 'Index Phase 2 status mismatch' }
if ($status -notmatch '\| 2\. Directus Foundation \| (?:AWAITING_DECISION|IN_PROGRESS(?:\s+\([^)]*\))?|VERIFIED) \|') { Add-Failure 'STATUS.md Phase 2 status mismatch' }
if ($status -notmatch '\| 1\. Architecture \| VERIFIED \|') { Add-Failure 'STATUS.md Phase 1 status mismatch' }

Write-Output 'CHECK evidence report guardrails'
$reportRules = @(
    @('WEATHER_BAKEOFF_REPORT.md', 'Winner | WeatherAPI.com'),
    @('WEATHER_BAKEOFF_REPORT.md', 'SELECTED BASELINE / CAPABILITY-BOUNDED TO LIVE ACCOUNT'),
    @('WEATHER_BAKEOFF_REPORT.md', 'Provider requests sent | 66'),
    @('MAP_BAKEOFF_REPORT.md', 'Live provider requests sent | 152'),
    @('MAP_BAKEOFF_REPORT.md', 'LIVE FIXTURE VERIFIED / PRODUCTION CONTROLS DEFERRED'),
    @('PAYMENT_CAPABILITY_REPORT.md', 'Sandbox/production payment requests sent | 0'),
    @('PAYMENT_CAPABILITY_REPORT.md', 'CONDITIONAL CONTRACT APPROVED / MERCHANT ENABLEMENT DEFERRED'),
    @('VIETNAM_PROVIDER_FIXTURE_REPORT.md', 'ACCEPTED LIVE FIXTURE / PRODUCTION CONTROL EVIDENCE DEFERRED'),
    @('VIETNAM_PROVIDER_FIXTURE_REPORT.md', '7f21321c774ced224919c68e2023456c5162808a299b1c13451dbe40da3b757b'),
    @('PHASE_1_EVIDENCE.md', '**Phase:** VERIFIED'),
    @('PHASE_1_EVIDENCE.md', '`PRODUCT-012`')
)

foreach ($rule in $reportRules) {
    $reportPath = Join-Path $PlanRoot $rule[0]
    if (-not (Test-Path -LiteralPath $reportPath)) {
        Add-Failure "Missing report: $($rule[0])"
        continue
    }

    $reportContent = Get-Content -Raw -Encoding UTF8 -LiteralPath $reportPath
    if (-not $reportContent.Contains($rule[1])) {
        Add-Failure "$($rule[0]) missing guardrail: $($rule[1])"
    }
}

Write-Output 'CHECK full provider fixture guardrails'
if (-not (Test-Path -LiteralPath $FixtureRunnerPath)) {
    Add-Failure 'Missing Vietnam provider fixture runner'
}
if (-not (Test-Path -LiteralPath $FixturePath)) {
    Add-Failure 'Missing Vietnam provider fixture data'
}
else {
    $fixture = Get-Content -Raw -Encoding UTF8 -LiteralPath $FixturePath | ConvertFrom-Json
    if (@($fixture.locations).Count -lt 30) { Add-Failure 'Provider fixture has fewer than 30 locations' }
    if (@($fixture.routes).Count -lt 30) { Add-Failure 'Provider fixture has fewer than 30 routes' }
    $fixtureHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $FixturePath).Hash.ToLowerInvariant()
    if ($fixtureHash -ne '7f21321c774ced224919c68e2023456c5162808a299b1c13451dbe40da3b757b') {
        Add-Failure "Provider fixture hash changed without evidence update: $fixtureHash"
    }
}

if (Test-Path -LiteralPath $FixtureRunnerPath) {
    $fixtureRunner = Get-Content -Raw -Encoding UTF8 -LiteralPath $FixtureRunnerPath
    foreach ($token in @('GEOAPIFY_SERVER_API_KEY', 'WEATHERAPI_API_KEY', 'raw_response_persisted = $false')) {
        if (-not $fixtureRunner.Contains($token)) {
            Add-Failure "Provider fixture runner missing guardrail: $token"
        }
    }
    $nonAsciiFixtureRunnerBytes = [System.IO.File]::ReadAllBytes($FixtureRunnerPath) | Where-Object { $_ -gt 127 }
    if ($nonAsciiFixtureRunnerBytes.Count -gt 0) {
        Add-Failure 'Provider fixture runner must remain ASCII-only'
    }
}

Write-Output 'CHECK Geoapify probe guardrails'
if (-not (Test-Path -LiteralPath $GeoapifyProbePath)) {
    Add-Failure 'Missing Geoapify capability probe'
}
else {
    $geoapifyProbe = Get-Content -Raw -Encoding UTF8 -LiteralPath $GeoapifyProbePath
    $geoapifyRequiredTokens = @(
        'GEOAPIFY_TILE_API_KEY',
        'GEOAPIFY_SERVER_API_KEY',
        "throw 'Geoapify tile and server credentials must use separate keys.'",
        'raw_response_persisted = $false',
        'ConvertTo-Json'
    )

    foreach ($token in $geoapifyRequiredTokens) {
        if (-not $geoapifyProbe.Contains($token)) {
            Add-Failure "Geoapify probe missing guardrail: $token"
        }
    }

    $nonAsciiBytes = [System.IO.File]::ReadAllBytes($GeoapifyProbePath) | Where-Object { $_ -gt 127 }
    if ($nonAsciiBytes.Count -gt 0) {
        Add-Failure 'Geoapify capability probe must remain ASCII-only'
    }
}

Write-Output 'CHECK local secret isolation'
if (Test-Path -LiteralPath $LocalSecretPath) {
    Push-Location $WorkspaceRoot
    try {
        git check-ignore .env.bakeoff.local | Out-Null
        if ($LASTEXITCODE -ne 0) {
            Add-Failure '.env.bakeoff.local is not ignored by Git'
        }
    }
    finally {
        Pop-Location
    }

    $secretValues = New-Object System.Collections.Generic.List[string]
    Get-Content -LiteralPath $LocalSecretPath | ForEach-Object {
        if (($_ -match '^([A-Za-z_][A-Za-z0-9_]*)=(.*)$') -and -not [string]::IsNullOrWhiteSpace($Matches[2])) {
            $secretValues.Add($Matches[2])
        }
    }

    Get-ChildItem -LiteralPath $WorkspaceRoot -Recurse -File -Force |
        Where-Object {
            $_.FullName -notmatch '\\.git\\' -and
            $_.FullName -notmatch '\\node_modules\\' -and
            $_.FullName -notmatch '\\artifacts\\phase2\\local\\' -and
            $_.FullName -notmatch '\\secrets\\decrypted\\' -and
            $_.FullName -notmatch '\\.env(?:\..*)?\.local$' -and
            $_.FullName -ne $LocalSecretPath
        } |
        ForEach-Object {
            $file = $_
            try {
                $content = Get-Content -Raw -LiteralPath $file.FullName -ErrorAction Stop
            }
            catch {
                return
            }

            foreach ($secret in $secretValues) {
                if ($content.Contains($secret)) {
                    Add-Failure "Secret value found outside ignored local file: $($file.FullName)"
                }
            }
        }
}

Write-Output 'CHECK Git whitespace errors'
Push-Location $WorkspaceRoot
try {
    $previousErrorAction = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    $diffCheck = @(git diff --check 2>&1)
    $gitExitCode = $LASTEXITCODE
    $ErrorActionPreference = $previousErrorAction
    if ($gitExitCode -ne 0) {
        $diffCheck |
            Where-Object { $_ -notmatch '^warning: in the working copy of' } |
            ForEach-Object { Add-Failure "git diff --check: $_" }
    }
}
finally {
    Pop-Location
}

if ($Failures.Count -gt 0) {
    Write-Output "STAGE1_VALIDATION_FAILED count=$($Failures.Count)"
    $Failures | ForEach-Object { Write-Output "FAIL $_" }
    exit 1
}

Write-Output "STAGE1_VALIDATION_OK decisions=$($definitions.Count) references=$($references.Count) adrs=$((Get-ChildItem -LiteralPath (Join-Path $PlanRoot 'adr') -Filter 'ADR-*.md').Count)"
