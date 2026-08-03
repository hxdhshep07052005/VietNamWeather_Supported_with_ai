param(
    [string]$RuntimeEnvPath = '.env.local'
)

$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [Text.Encoding]::UTF8
$workspaceRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
if ([IO.Path]::GetFileName($RuntimeEnvPath) -ne '.env.local') {
    throw 'Redis failure drill is restricted to .env.local.'
}

function Get-HttpResult {
    param([string]$Uri)
    $marker = "`n__HTTP_STATUS__"
    $raw = (curl.exe -sS --max-time 8 -w "$marker%{http_code}" $Uri 2>$null) -join "`n"
    $markerIndex = $raw.LastIndexOf($marker, [StringComparison]::Ordinal)
    if ($markerIndex -lt 0) { throw "HTTP probe did not return a status: $Uri" }
    $content = $raw.Substring(0, $markerIndex)
    $statusText = $raw.Substring($markerIndex + $marker.Length).Trim()
    return [pscustomobject]@{ StatusCode = [int]$statusText; Content = $content }
}

Push-Location $workspaceRoot
$redisStopped = $false
try {
    docker compose --env-file $RuntimeEnvPath stop redis | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'Unable to stop Redis for the failure drill.' }
    $redisStopped = $true

    $ready = $null
    for ($attempt = 0; $attempt -lt 10; $attempt++) {
        $ready = Get-HttpResult 'http://localhost:8080/health/ready'
        if ($ready.StatusCode -eq 503) { break }
        Start-Sleep -Milliseconds 500
    }
    if ($null -eq $ready -or $ready.StatusCode -ne 503) { throw 'API readiness did not fail closed when Redis was stopped.' }
    $readyBody = $ready.Content | ConvertFrom-Json
    if ([string]$readyBody.status -ne 'not_ready') { throw 'Readiness response did not report not_ready during Redis outage.' }

    $csrf = Get-HttpResult 'http://localhost:8080/api/v1/auth/csrf'
    if ($csrf.StatusCode -ne 503) { throw "Redis-backed API route returned an unexpected outage status=$($csrf.StatusCode)." }
    $csrfBody = $csrf.Content | ConvertFrom-Json
    if ([string]$csrfBody.error.code -ne 'UPSTREAM_UNAVAILABLE' -or $csrfBody.error.retryable -ne $true) {
        throw 'Redis-backed API route did not return a retryable dependency error.'
    }

    Write-Output 'PHASE3_REDIS_FAILURE_RUNTIME_TEST_OK ready_fail_closed=true readiness_not_ready=true rate_limit_dependency_denied=true retryable_error=true secrets_printed=false'
}
finally {
    if ($redisStopped) {
        try { docker compose --env-file $RuntimeEnvPath up -d redis | Out-Null } catch {}
        for ($attempt = 0; $attempt -lt 30; $attempt++) {
            try {
                $probe = Get-HttpResult 'http://localhost:8080/health/ready'
                if ($probe.StatusCode -eq 200) { break }
            }
            catch {}
            Start-Sleep -Milliseconds 500
        }
    }
    Pop-Location
}
