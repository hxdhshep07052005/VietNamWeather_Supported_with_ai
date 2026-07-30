param(
    [string]$RuntimeEnvPath = '.env.local',
    [string]$AdminEnvPath = '.env.admin.local'
)

$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [Text.Encoding]::UTF8
$workspaceRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path

function Read-EnvironmentFile {
    param([string]$Path)
    $values = @{}
    Get-Content -LiteralPath $Path | ForEach-Object {
        if ($_ -match '^([A-Za-z_][A-Za-z0-9_]*)=(.*)$') { $values[$Matches[1]] = $Matches[2] }
    }
    return $values
}

$runtime = Read-EnvironmentFile (Join-Path $workspaceRoot $RuntimeEnvPath)
$admin = Read-EnvironmentFile (Join-Path $workspaceRoot $AdminEnvPath)

Push-Location $workspaceRoot
try {
    $deadline = [DateTime]::UtcNow.AddSeconds(90)
    do {
        $services = @(docker compose --env-file $RuntimeEnvPath ps --format json | ConvertFrom-Json)
        if ($LASTEXITCODE -ne 0) { throw 'Unable to inspect Compose services.' }
        $unhealthy = @($services | Where-Object { $_.Health -ne 'healthy' })
        if ($services.Count -eq 5 -and $unhealthy.Count -eq 0) { break }
        Start-Sleep -Seconds 2
    } while ([DateTime]::UtcNow -lt $deadline)
    if ($services.Count -ne 5) { throw 'Expected five Compose services.' }
    $unhealthy = @($services | Where-Object { $_.Health -ne 'healthy' })
    if ($unhealthy.Count -gt 0) { throw "Unhealthy Compose services: $($unhealthy.Service -join ', ')" }

    $expectedImages = @{
        database = 'postgis/postgis@sha256:350d6e4617de2f9bd04e2c4d661c8df2bab8627eefba6119819f43091fb2de47'
        redis = 'redis@sha256:a7859ed111db3c1f5404a973a4747505d559fb5ca32d37e447afc0ef845a2103'
        mailpit = 'axllent/mailpit@sha256:7f33095f80e901f6ad08028f06ca284aa58fe84942be5496008d041d3b9f4d4d'
        directus = 'directus/directus@sha256:27fd291463f4e746a7911139377a1dbc7a5c09ae82ee15b028b97bcc4950c69d'
    }
    foreach ($service in $expectedImages.Keys) {
        $containerId = (docker compose --env-file $RuntimeEnvPath ps -q $service).Trim()
        $imageReference = docker inspect --format '{{.Config.Image}}' $containerId
        if ($LASTEXITCODE -ne 0 -or $imageReference.Trim() -ne $expectedImages[$service]) {
            throw "Runtime image reference mismatch: $service"
        }
    }

    foreach ($service in @('database', 'redis')) {
        $containerId = (docker compose --env-file $RuntimeEnvPath ps -q $service).Trim()
        $bindings = docker inspect --format '{{json .HostConfig.PortBindings}}' $containerId
        if ($bindings -ne '{}' -and $bindings -ne 'null') { throw "Private service has host bindings: $service" }
    }

    $baseUri = "http://127.0.0.1:$($runtime['DIRECTUS_HOST_PORT'])"
    $login = Invoke-RestMethod -Method Post -Uri "$baseUri/auth/login" -ContentType 'application/json' -Body (@{ email = $admin['DIRECTUS_ADMIN_EMAIL']; password = $admin['DIRECTUS_ADMIN_PASSWORD'] } | ConvertTo-Json) -TimeoutSec 15
    if ([string]::IsNullOrWhiteSpace($login.data.access_token)) { throw 'Rotated Directus admin login failed.' }
    $health = Invoke-RestMethod -Method Get -Uri "$baseUri/server/health" -Headers @{ Authorization = "Bearer $($login.data.access_token)" } -TimeoutSec 15
    $healthStatuses = @($health.checks.PSObject.Properties | ForEach-Object { $_.Value } | ForEach-Object { $_ } | ForEach-Object { $_.status })
    if ($health.status -eq 'error' -or @($healthStatuses | Where-Object { $_ -eq 'error' }).Count -gt 0) {
        throw 'Directus authenticated health reported an error.'
    }
    if ([string]$health.releaseId -ne '12.1.1') { throw 'Directus runtime version mismatch.' }

    $worker = Invoke-RestMethod -Method Get -Uri "http://127.0.0.1:$($runtime['WORKER_HOST_PORT'])/health/ready" -TimeoutSec 10
    if ($worker.status -ne 'ready') { throw 'Worker readiness endpoint failed.' }
    $mailpit = Invoke-WebRequest -UseBasicParsing -Uri "http://127.0.0.1:$($runtime['MAILPIT_UI_HOST_PORT'])/readyz" -TimeoutSec 10
    if ($mailpit.StatusCode -ne 200) { throw 'Mailpit readiness endpoint failed.' }

    $postgisVersion = docker compose --env-file $RuntimeEnvPath exec -T database psql -At -U $runtime['DB_USER'] -d $runtime['DB_DATABASE'] -c 'SELECT postgis_version();'
    if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($postgisVersion)) { throw 'PostGIS extension verification failed.' }
    $redisPing = docker compose --env-file $RuntimeEnvPath exec -T redis sh -lc 'REDISCLI_AUTH="$REDIS_PASSWORD" redis-cli ping'
    if ($LASTEXITCODE -ne 0 -or $redisPing.Trim() -ne 'PONG') { throw 'Redis authenticated ping failed.' }

    Write-Output "LOCAL_STACK_VALIDATION_OK services=5 directus_release=$($health.releaseId) directus_checks=$($healthStatuses.Count) postgis=true redis_auth=true private_services=2 secrets_printed=false"
}
finally {
    Pop-Location
}
