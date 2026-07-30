param(
    [string]$FixtureFile = '',
    [string]$EnvFile = '',
    [string]$OutputPath = '',
    [ValidateRange(200, 5000)]
    [int]$GeoapifyDelayMs = 250,
    [ValidateRange(0, 5000)]
    [int]$WeatherDelayMs = 100
)

$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Definition
if ([string]::IsNullOrWhiteSpace($FixtureFile)) {
    $FixtureFile = Join-Path $scriptRoot 'fixtures\vietnam-stage1.json'
}
if ([string]::IsNullOrWhiteSpace($EnvFile)) {
    $EnvFile = Join-Path $scriptRoot '..\..\.env.bakeoff.local'
}

if (-not (Test-Path -LiteralPath $FixtureFile)) {
    throw 'Provider fixture file does not exist.'
}
if (-not (Test-Path -LiteralPath $EnvFile)) {
    throw 'Local bake-off environment file does not exist.'
}

$fixture = Get-Content -Raw -Encoding UTF8 -LiteralPath $FixtureFile | ConvertFrom-Json
$locations = @($fixture.locations)
$routes = @($fixture.routes)
if ($locations.Count -lt 30 -or $routes.Count -lt 30) {
    throw 'The Stage 1 provider fixture requires at least 30 locations and 30 routes.'
}

$locationIds = @($locations | ForEach-Object { [string]$_.id })
$duplicateLocationIds = @($locationIds | Group-Object | Where-Object Count -gt 1)
if ($duplicateLocationIds.Count -gt 0) {
    throw 'The provider fixture contains duplicate location IDs.'
}

$values = @{}
Get-Content -LiteralPath $EnvFile | ForEach-Object {
    if ($_ -match '^([A-Za-z_][A-Za-z0-9_]*)=(.*)$') {
        $values[$Matches[1]] = $Matches[2].Trim()
    }
}

$tileKey = $values['GEOAPIFY_TILE_API_KEY']
$serverKey = $values['GEOAPIFY_SERVER_API_KEY']
$weatherApiKey = $values['WEATHERAPI_API_KEY']
if ([string]::IsNullOrWhiteSpace($tileKey) -or
    [string]::IsNullOrWhiteSpace($serverKey) -or
    [string]::IsNullOrWhiteSpace($weatherApiKey)) {
    throw 'Geoapify tile/server keys and the WeatherAPI key are required.'
}
if ($tileKey -eq $serverKey) {
    throw 'Geoapify tile and server credentials must use separate keys.'
}

function Remove-SecretText {
    param(
        [AllowNull()]$Value,
        [string[]]$SecretValues
    )

    if ($null -eq $Value) {
        return $null
    }

    $safeValue = [string]$Value
    foreach ($secret in $SecretValues) {
        if (-not [string]::IsNullOrWhiteSpace($secret)) {
            $safeValue = $safeValue.Replace($secret, '[REDACTED]')
        }
    }
    return $safeValue
}

function Invoke-ProviderRequest {
    param(
        [string]$Name,
        [string]$Uri,
        [System.Net.Http.HttpClient]$Client,
        [string[]]$SecretValues
    )

    $timer = [Diagnostics.Stopwatch]::StartNew()
    try {
        $response = $Client.GetAsync($Uri).GetAwaiter().GetResult()
        $body = $response.Content.ReadAsStringAsync().GetAwaiter().GetResult()
        $status = [int]$response.StatusCode
        $contentType = if ($response.Content.Headers.ContentType) {
            [string]$response.Content.Headers.ContentType.MediaType
        }
        else {
            $null
        }
    }
    catch {
        $timer.Stop()
        return [pscustomobject]@{
            name = $Name
            http_status = 'transport_error'
            elapsed_ms = $timer.ElapsedMilliseconds
            content_type = $null
            response_body_bytes = 0
            provider_code = $null
            message = 'httpclient_request_failed'
            json = $null
        }
    }

    $timer.Stop()
    $json = $null
    try { $json = $body | ConvertFrom-Json } catch { }

    $providerCode = $null
    $message = $null
    if ($json) {
        if ($null -ne $json.statusCode) { $providerCode = $json.statusCode }
        elseif ($null -ne $json.error_code) { $providerCode = $json.error_code }
        elseif ($null -ne $json.error.code) { $providerCode = $json.error.code }

        if ($null -ne $json.message) { $message = $json.message }
        elseif ($null -ne $json.error.message) { $message = $json.error.message }
        elseif ($null -ne $json.error) { $message = $json.error }
    }

    return [pscustomobject]@{
        name = $Name
        http_status = $status
        elapsed_ms = $timer.ElapsedMilliseconds
        content_type = $contentType
        response_body_bytes = [Text.Encoding]::UTF8.GetByteCount($body)
        provider_code = $providerCode
        message = Remove-SecretText $message $SecretValues
        json = $json
    }
}

function Get-Percentile {
    param(
        [long[]]$Values,
        [ValidateRange(0.01, 1.0)]
        [double]$Percentile
    )

    $sorted = @($Values | Sort-Object)
    if ($sorted.Count -eq 0) {
        return $null
    }
    $index = [Math]::Ceiling($sorted.Count * $Percentile) - 1
    if ($index -lt 0) { $index = 0 }
    return $sorted[$index]
}

function Get-CoordinateText {
    param([double]$Value)
    return $Value.ToString('0.########', [Globalization.CultureInfo]::InvariantCulture)
}

function Get-RouteCoordinates {
    param(
        $Route,
        [hashtable]$ResolvedLocations
    )

    if ($null -ne $Route.origin_coordinates -and $null -ne $Route.destination_coordinates) {
        return [pscustomobject]@{
            origin_latitude = [double]$Route.origin_coordinates[0]
            origin_longitude = [double]$Route.origin_coordinates[1]
            destination_latitude = [double]$Route.destination_coordinates[0]
            destination_longitude = [double]$Route.destination_coordinates[1]
            source = 'fixture_coordinates'
        }
    }

    $originId = [string]$Route.origin
    $destinationId = [string]$Route.destination
    if (-not $ResolvedLocations.ContainsKey($originId) -or -not $ResolvedLocations.ContainsKey($destinationId)) {
        return $null
    }

    return [pscustomobject]@{
        origin_latitude = [double]$ResolvedLocations[$originId].latitude
        origin_longitude = [double]$ResolvedLocations[$originId].longitude
        destination_latitude = [double]$ResolvedLocations[$destinationId].latitude
        destination_longitude = [double]$ResolvedLocations[$destinationId].longitude
        source = 'live_geocoding'
    }
}

Add-Type -AssemblyName System.Net.Http
$client = New-Object System.Net.Http.HttpClient
$client.Timeout = [TimeSpan]::FromSeconds(30)
$client.DefaultRequestHeaders.UserAgent.ParseAdd('VietNamWeather-Stage1-Fixtures/1.0')

$secretValues = @($tileKey, $serverKey, $weatherApiKey)
$countryCode = ([string]$fixture.country_code).ToLowerInvariant()
$language = [string]$fixture.language
$fixtureHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $FixtureFile).Hash.ToLowerInvariant()
$resolvedLocations = @{}
$geocodingResults = New-Object System.Collections.Generic.List[object]
$reverseResults = New-Object System.Collections.Generic.List[object]
$routingResults = New-Object System.Collections.Generic.List[object]
$weatherResults = New-Object System.Collections.Generic.List[object]
$providerRequestsSent = 0

try {
    $styleUri = 'https://maps.geoapify.com/v1/styles/osm-bright/style.json?apiKey={0}' -f [Uri]::EscapeDataString($tileKey)
    $style = Invoke-ProviderRequest 'geoapify_style' $styleUri $client $secretValues
    $providerRequestsSent++
    $styleLayers = if ($style.json -and $style.json.layers) { @($style.json.layers).Count } else { 0 }
    $styleSources = if ($style.json -and $style.json.sources) { @($style.json.sources.PSObject.Properties).Count } else { 0 }
    $styleResult = [pscustomobject]@{
        http_status = $style.http_status
        elapsed_ms = $style.elapsed_ms
        json_parsed = ($null -ne $style.json)
        style_version = if ($style.json) { $style.json.version } else { $null }
        source_count = $styleSources
        layer_count = $styleLayers
    }

    foreach ($location in $locations) {
        $geocodeUri = 'https://api.geoapify.com/v1/geocode/search?text={0}&filter=countrycode:{1}&lang={2}&limit=5&format=json&apiKey={3}' -f `
            [Uri]::EscapeDataString([string]$location.query),
            [Uri]::EscapeDataString($countryCode),
            [Uri]::EscapeDataString($language),
            [Uri]::EscapeDataString($serverKey)
        $response = Invoke-ProviderRequest "geoapify_geocode_$($location.id)" $geocodeUri $client $secretValues
        $providerRequestsSent++
        $items = @()
        if ($response.json -and $null -ne $response.json.results) {
            $items = @($response.json.results)
        }
        $first = if ($items.Count -gt 0) { $items[0] } else { $null }
        $countryMatched = [bool]($first -and ([string]$first.country_code).ToLowerInvariant() -eq $countryCode)
        if ($first -and $null -ne $first.lat -and $null -ne $first.lon) {
            $resolvedLocations[[string]$location.id] = [pscustomobject]@{
                latitude = [double]$first.lat
                longitude = [double]$first.lon
                formatted = [string]$first.formatted
                result_type = [string]$first.result_type
                country_code = [string]$first.country_code
            }
        }
        $geocodingResults.Add([pscustomobject]@{
            id = [string]$location.id
            query = [string]$location.query
            http_status = $response.http_status
            elapsed_ms = $response.elapsed_ms
            result_count = $items.Count
            country_matched = $countryMatched
            first_result = if ($first) {
                [pscustomobject]@{
                    formatted = [string]$first.formatted
                    result_type = [string]$first.result_type
                    country_code = [string]$first.country_code
                    latitude = $first.lat
                    longitude = $first.lon
                }
            }
            else { $null }
            provider_code = $response.provider_code
            message = $response.message
        })
        Start-Sleep -Milliseconds $GeoapifyDelayMs
    }

    foreach ($locationId in @($fixture.reverse_geocoding_location_ids)) {
        if (-not $resolvedLocations.ContainsKey([string]$locationId)) {
            $reverseResults.Add([pscustomobject]@{
                id = [string]$locationId
                skipped = $true
                reason = 'location_not_resolved'
            })
            continue
        }
        $location = $resolvedLocations[[string]$locationId]
        $reverseUri = 'https://api.geoapify.com/v1/geocode/reverse?lat={0}&lon={1}&lang={2}&format=json&apiKey={3}' -f `
            (Get-CoordinateText $location.latitude),
            (Get-CoordinateText $location.longitude),
            [Uri]::EscapeDataString($language),
            [Uri]::EscapeDataString($serverKey)
        $response = Invoke-ProviderRequest "geoapify_reverse_$locationId" $reverseUri $client $secretValues
        $providerRequestsSent++
        $items = @()
        if ($response.json -and $null -ne $response.json.results) {
            $items = @($response.json.results)
        }
        $first = if ($items.Count -gt 0) { $items[0] } else { $null }
        $reverseResults.Add([pscustomobject]@{
            id = [string]$locationId
            skipped = $false
            http_status = $response.http_status
            elapsed_ms = $response.elapsed_ms
            result_count = $items.Count
            first_result = if ($first) {
                [pscustomobject]@{
                    formatted = [string]$first.formatted
                    result_type = [string]$first.result_type
                    country_code = [string]$first.country_code
                }
            }
            else { $null }
            provider_code = $response.provider_code
            message = $response.message
        })
        Start-Sleep -Milliseconds $GeoapifyDelayMs
    }

    foreach ($route in $routes) {
        $coordinates = Get-RouteCoordinates $route $resolvedLocations
        if ($null -eq $coordinates) {
            $routingResults.Add([pscustomobject]@{
                id = [string]$route.id
                expected = [string]$route.expected
                mode = [string]$route.mode
                skipped = $true
                reason = 'route_location_not_resolved'
            })
            continue
        }

        $waypoints = '{0},{1}|{2},{3}' -f `
            (Get-CoordinateText $coordinates.origin_latitude),
            (Get-CoordinateText $coordinates.origin_longitude),
            (Get-CoordinateText $coordinates.destination_latitude),
            (Get-CoordinateText $coordinates.destination_longitude)
        $routingUri = 'https://api.geoapify.com/v1/routing?waypoints={0}&mode={1}&format=json&apiKey={2}' -f `
            [Uri]::EscapeDataString($waypoints),
            [Uri]::EscapeDataString([string]$route.mode),
            [Uri]::EscapeDataString($serverKey)
        $response = Invoke-ProviderRequest "geoapify_route_$($route.id)" $routingUri $client $secretValues
        $providerRequestsSent++
        $items = @()
        if ($response.json -and $null -ne $response.json.results) {
            $items = @($response.json.results)
        }
        $first = if ($items.Count -gt 0) { $items[0] } else { $null }
        $routeFound = $items.Count -gt 0
        $expectationMatched = if ([string]$route.expected -eq 'routable') { $routeFound } else { -not $routeFound }
        $routingResults.Add([pscustomobject]@{
            id = [string]$route.id
            expected = [string]$route.expected
            mode = [string]$route.mode
            coordinate_source = $coordinates.source
            skipped = $false
            http_status = $response.http_status
            elapsed_ms = $response.elapsed_ms
            route_count = $items.Count
            route_found = $routeFound
            expectation_matched = $expectationMatched
            first_route = if ($first) {
                [pscustomobject]@{
                    distance_m = $first.distance
                    duration_s = $first.time
                    mode = $first.mode
                    leg_count = if ($first.legs) { @($first.legs).Count } else { 0 }
                    geometry_item_count = if ($first.geometry) { @($first.geometry).Count } else { 0 }
                }
            }
            else { $null }
            provider_code = $response.provider_code
            message = $response.message
        })
        Start-Sleep -Milliseconds $GeoapifyDelayMs
    }

    foreach ($location in $locations) {
        $locationId = [string]$location.id
        if (-not $resolvedLocations.ContainsKey($locationId)) {
            $weatherResults.Add([pscustomobject]@{
                id = $locationId
                skipped = $true
                reason = 'location_not_resolved'
            })
            continue
        }
        $resolved = $resolvedLocations[$locationId]
        $weatherUri = 'https://api.weatherapi.com/v1/forecast.json?key={0}&q={1},{2}&days={3}&aqi=no&alerts=yes' -f `
            [Uri]::EscapeDataString($weatherApiKey),
            (Get-CoordinateText $resolved.latitude),
            (Get-CoordinateText $resolved.longitude),
            [int]$fixture.weatherapi_days_requested
        $response = Invoke-ProviderRequest "weatherapi_$locationId" $weatherUri $client $secretValues
        $providerRequestsSent++
        $forecastDays = if ($response.json -and $response.json.forecast -and $response.json.forecast.forecastday) {
            @($response.json.forecast.forecastday).Count
        }
        else { 0 }
        $firstDayHours = if ($forecastDays -gt 0) { @($response.json.forecast.forecastday[0].hour).Count } else { 0 }
        $weatherResults.Add([pscustomobject]@{
            id = $locationId
            skipped = $false
            http_status = $response.http_status
            elapsed_ms = $response.elapsed_ms
            forecast_days = $forecastDays
            first_day_hours = $firstDayHours
            has_current = [bool]($response.json -and $null -ne $response.json.current)
            has_alerts_property = [bool]($response.json -and $null -ne $response.json.alerts)
            provider_location_label = if ($response.json) { [string]$response.json.location.name } else { $null }
            provider_timezone = if ($response.json) { [string]$response.json.location.tz_id } else { $null }
            provider_code = $response.provider_code
            message = $response.message
        })
        Start-Sleep -Milliseconds $WeatherDelayMs
    }
}
finally {
    $client.Dispose()
}

$geocodeSuccess = @($geocodingResults | Where-Object { $_.http_status -eq 200 -and $_.result_count -gt 0 -and $_.country_matched })
$reverseSuccess = @($reverseResults | Where-Object { -not $_.skipped -and $_.http_status -eq 200 -and $_.result_count -gt 0 })
$routeExecuted = @($routingResults | Where-Object { -not $_.skipped })
$routeMatched = @($routeExecuted | Where-Object { $_.http_status -eq 200 -and $_.expectation_matched })
$weatherExecuted = @($weatherResults | Where-Object { -not $_.skipped })
$weatherSuccess = @($weatherExecuted | Where-Object { $_.http_status -eq 200 -and $_.has_current -and $_.forecast_days -gt 0 })
$forecastDayCounts = @($weatherSuccess | ForEach-Object { [int]$_.forecast_days })

$summary = [pscustomobject]@{
    fixture_version = [string]$fixture.version
    fixture_sha256 = $fixtureHash
    executed_at_utc = (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ')
    key_values_distinct = ($tileKey -ne $serverKey)
    provider_requests_sent = $providerRequestsSent
    raw_response_persisted = $false
    style = $styleResult
    geocoding = [pscustomobject]@{
        total = $geocodingResults.Count
        successful_vietnam_results = $geocodeSuccess.Count
        p50_ms = Get-Percentile @($geocodingResults | ForEach-Object { [long]$_.elapsed_ms }) 0.50
        p95_ms = Get-Percentile @($geocodingResults | ForEach-Object { [long]$_.elapsed_ms }) 0.95
    }
    reverse_geocoding = [pscustomobject]@{
        total = $reverseResults.Count
        successful = $reverseSuccess.Count
        p50_ms = Get-Percentile @($reverseResults | Where-Object { -not $_.skipped } | ForEach-Object { [long]$_.elapsed_ms }) 0.50
        p95_ms = Get-Percentile @($reverseResults | Where-Object { -not $_.skipped } | ForEach-Object { [long]$_.elapsed_ms }) 0.95
    }
    routing = [pscustomobject]@{
        total = $routingResults.Count
        executed = $routeExecuted.Count
        expectation_matched = $routeMatched.Count
        routes_found = @($routeExecuted | Where-Object route_found).Count
        no_route_results = @($routeExecuted | Where-Object { -not $_.route_found }).Count
        p50_ms = Get-Percentile @($routeExecuted | ForEach-Object { [long]$_.elapsed_ms }) 0.50
        p95_ms = Get-Percentile @($routeExecuted | ForEach-Object { [long]$_.elapsed_ms }) 0.95
    }
    weatherapi = [pscustomobject]@{
        total = $weatherResults.Count
        executed = $weatherExecuted.Count
        successful = $weatherSuccess.Count
        requested_days = [int]$fixture.weatherapi_days_requested
        minimum_returned_days = if ($forecastDayCounts.Count -gt 0) { ($forecastDayCounts | Measure-Object -Minimum).Minimum } else { 0 }
        maximum_returned_days = if ($forecastDayCounts.Count -gt 0) { ($forecastDayCounts | Measure-Object -Maximum).Maximum } else { 0 }
        p50_ms = Get-Percentile @($weatherExecuted | ForEach-Object { [long]$_.elapsed_ms }) 0.50
        p95_ms = Get-Percentile @($weatherExecuted | ForEach-Object { [long]$_.elapsed_ms }) 0.95
    }
}

$fullResult = [pscustomobject]@{
    summary = $summary
    details = [pscustomobject]@{
        geocoding = $geocodingResults.ToArray()
        reverse_geocoding = $reverseResults.ToArray()
        routing = $routingResults.ToArray()
        weatherapi = $weatherResults.ToArray()
    }
}
$fullJson = $fullResult | ConvertTo-Json -Depth 12

if (-not [string]::IsNullOrWhiteSpace($OutputPath)) {
    $absoluteOutputPath = [IO.Path]::GetFullPath($OutputPath)
    $outputDirectory = Split-Path -Parent $absoluteOutputPath
    if (-not (Test-Path -LiteralPath $outputDirectory)) {
        New-Item -ItemType Directory -Force -Path $outputDirectory | Out-Null
    }
    $utf8NoBom = New-Object System.Text.UTF8Encoding -ArgumentList $false
    [IO.File]::WriteAllText($absoluteOutputPath, $fullJson, $utf8NoBom)
}

$summary | ConvertTo-Json -Depth 8
