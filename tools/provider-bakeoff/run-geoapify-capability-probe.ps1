param(
    [Parameter(Mandatory = $true)]
    [ValidateNotNullOrEmpty()]
    [string]$SearchText,

    [Parameter(Mandatory = $true)]
    [ValidateRange(-90, 90)]
    [double]$OriginLatitude,

    [Parameter(Mandatory = $true)]
    [ValidateRange(-180, 180)]
    [double]$OriginLongitude,

    [Parameter(Mandatory = $true)]
    [ValidateRange(-90, 90)]
    [double]$DestinationLatitude,

    [Parameter(Mandatory = $true)]
    [ValidateRange(-180, 180)]
    [double]$DestinationLongitude,

    [ValidateSet('drive', 'truck', 'bicycle', 'walk', 'transit', 'approximated_transit')]
    [string]$Mode = 'drive',

    [ValidateSet('balanced', 'short', 'less_maneuvers')]
    [string]$RouteType = 'balanced',

    [ValidatePattern('^[A-Za-z]{2}$')]
    [string]$CountryCode = 'vn',

    [ValidatePattern('^[A-Za-z0-9_-]+$')]
    [string]$StyleName = 'osm-bright',

    [ValidatePattern('^[A-Za-z-]+$')]
    [string]$Language = 'vi',

    [string]$EnvFile = ''
)

$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

if ([string]::IsNullOrWhiteSpace($EnvFile)) {
    $scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Definition
    $EnvFile = Join-Path $scriptRoot '..\..\.env.bakeoff.local'
}

if (-not (Test-Path -LiteralPath $EnvFile)) {
    throw 'Local bake-off environment file does not exist.'
}

$values = @{}
Get-Content -LiteralPath $EnvFile | ForEach-Object {
    if ($_ -match '^([A-Za-z_][A-Za-z0-9_]*)=(.*)$') {
        $values[$Matches[1]] = $Matches[2].Trim()
    }
}

$tileKey = $values['GEOAPIFY_TILE_API_KEY']
$serverKey = $values['GEOAPIFY_SERVER_API_KEY']
if ([string]::IsNullOrWhiteSpace($tileKey) -or [string]::IsNullOrWhiteSpace($serverKey)) {
    throw 'Geoapify tile and server credentials are required in the local environment file.'
}

if ($tileKey -eq $serverKey) {
    throw 'Geoapify tile and server credentials must use separate keys.'
}

function Remove-SecretText {
    param(
        [AllowNull()]
        $Value,
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

function Get-UsageHeaders {
    param(
        [System.Net.Http.HttpResponseMessage]$Response,
        [string[]]$SecretValues
    )

    $usageHeaders = [ordered]@{}
    $allHeaders = @($Response.Headers.GetEnumerator()) + @($Response.Content.Headers.GetEnumerator())
    foreach ($header in $allHeaders) {
        if ($header.Key -match '(?i)(rate|quota|credit|limit|remaining|reset)') {
            $headerValue = Remove-SecretText (($header.Value | ForEach-Object { [string]$_ }) -join ',') $SecretValues
            $usageHeaders[$header.Key.ToLowerInvariant()] = $headerValue
        }
    }

    return [pscustomobject]$usageHeaders
}

function Invoke-JsonProbe {
    param(
        [string]$Name,
        [string]$Uri,
        [string[]]$SecretValues,
        [System.Net.Http.HttpClient]$Client
    )

    $timer = [Diagnostics.Stopwatch]::StartNew()
    try {
        $response = $Client.GetAsync($Uri).GetAwaiter().GetResult()
        $body = $response.Content.ReadAsStringAsync().GetAwaiter().GetResult()
        $bodyBytes = [Text.Encoding]::UTF8.GetByteCount($body)
        $status = [int]$response.StatusCode
        $contentType = if ($response.Content.Headers.ContentType) {
            [string]$response.Content.Headers.ContentType.MediaType
        }
        else {
            $null
        }
        $usageHeaders = Get-UsageHeaders $response $SecretValues
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
            usage_headers = [pscustomobject]@{}
            json_parsed = $false
            json = $null
        }
    }

    $timer.Stop()
    $json = $null
    try {
        $json = $body | ConvertFrom-Json
    }
    catch {
        $json = $null
    }

    $providerCode = $null
    $message = $null
    if ($json) {
        if ($null -ne $json.statusCode) {
            $providerCode = $json.statusCode
        }
        elseif ($null -ne $json.error_code) {
            $providerCode = $json.error_code
        }

        if ($null -ne $json.message) {
            $message = [string]$json.message
        }
        elseif ($null -ne $json.error) {
            $message = [string]$json.error
        }
    }

    [pscustomobject]@{
        name = $Name
        http_status = $status
        elapsed_ms = $timer.ElapsedMilliseconds
        content_type = $contentType
        response_body_bytes = $bodyBytes
        provider_code = $providerCode
        message = Remove-SecretText $message $SecretValues
        usage_headers = $usageHeaders
        json_parsed = ($null -ne $json)
        json = $json
    }
}

function Get-PropertyCount {
    param([AllowNull()]$Value)

    if ($null -eq $Value) {
        return 0
    }

    return @($Value.PSObject.Properties).Count
}

function Get-TopLevelFields {
    param([AllowNull()]$Value)

    if ($null -eq $Value) {
        return @()
    }

    if ($Value -is [System.Array]) {
        return @('top_level_array')
    }

    return @($Value.PSObject.Properties.Name | Sort-Object)
}

function Get-ValueSha256 {
    param([AllowNull()]$Value)

    if ($null -eq $Value) {
        return $null
    }

    $json = $Value | ConvertTo-Json -Depth 50 -Compress
    $bytes = [Text.Encoding]::UTF8.GetBytes($json)
    $sha256 = [Security.Cryptography.SHA256]::Create()
    try {
        $hash = $sha256.ComputeHash($bytes)
    }
    finally {
        $sha256.Dispose()
    }
    return ([BitConverter]::ToString($hash)).Replace('-', '').ToLowerInvariant()
}

Add-Type -AssemblyName System.Net.Http
$client = New-Object System.Net.Http.HttpClient
$client.Timeout = [TimeSpan]::FromSeconds(30)
$client.DefaultRequestHeaders.UserAgent.ParseAdd('VietNamWeather-Stage1-Geoapify-Probe/1.0')

$invariant = [Globalization.CultureInfo]::InvariantCulture
$originLatitudeText = $OriginLatitude.ToString('0.########', $invariant)
$originLongitudeText = $OriginLongitude.ToString('0.########', $invariant)
$destinationLatitudeText = $DestinationLatitude.ToString('0.########', $invariant)
$destinationLongitudeText = $DestinationLongitude.ToString('0.########', $invariant)
$countryCodeValue = $CountryCode.ToLowerInvariant()

$styleUri = 'https://maps.geoapify.com/v1/styles/{0}/style.json?apiKey={1}' -f `
    [Uri]::EscapeDataString($StyleName),
    [Uri]::EscapeDataString($tileKey)
$geocodeUri = 'https://api.geoapify.com/v1/geocode/search?text={0}&filter=countrycode:{1}&lang={2}&limit=5&format=json&apiKey={3}' -f `
    [Uri]::EscapeDataString($SearchText),
    [Uri]::EscapeDataString($countryCodeValue),
    [Uri]::EscapeDataString($Language),
    [Uri]::EscapeDataString($serverKey)
$waypoints = '{0},{1}|{2},{3}' -f `
    $originLatitudeText,
    $originLongitudeText,
    $destinationLatitudeText,
    $destinationLongitudeText
$routingUri = 'https://api.geoapify.com/v1/routing?waypoints={0}&mode={1}&type={2}&format=json&apiKey={3}' -f `
    [Uri]::EscapeDataString($waypoints),
    [Uri]::EscapeDataString($Mode),
    [Uri]::EscapeDataString($RouteType),
    [Uri]::EscapeDataString($serverKey)

$secretValues = @($tileKey, $serverKey)
try {
    $style = Invoke-JsonProbe 'geoapify_style' $styleUri $secretValues $client
    $geocode = Invoke-JsonProbe 'geoapify_geocoding' $geocodeUri $secretValues $client
    $routing = Invoke-JsonProbe 'geoapify_routing' $routingUri $secretValues $client
}
finally {
    $client.Dispose()
}

$styleSources = if ($style.json) { $style.json.sources } else { $null }
$styleLayers = if ($style.json -and $style.json.layers) { @($style.json.layers) } else { @() }
$hasAttribution = $false
if ($styleSources) {
    foreach ($sourceProperty in $styleSources.PSObject.Properties) {
        if ($sourceProperty.Value -and -not [string]::IsNullOrWhiteSpace([string]$sourceProperty.Value.attribution)) {
            $hasAttribution = $true
            break
        }
    }
}

$geocodeResultSource = 'none'
$geocodeResults = @()
if ($geocode.json) {
    if ($null -ne $geocode.json.results) {
        $geocodeResultSource = 'results'
        $geocodeResults = @($geocode.json.results)
    }
    elseif ($null -ne $geocode.json.features) {
        $geocodeResultSource = 'features'
        $geocodeResults = @($geocode.json.features | ForEach-Object { $_.properties })
    }
    elseif ($geocode.json -is [System.Array]) {
        $geocodeResultSource = 'top_level_array'
        $geocodeResults = @($geocode.json)
    }
}
$firstGeocodeResult = if ($geocodeResults.Count -gt 0) { $geocodeResults[0] } else { $null }

$routeResultSource = 'none'
$routeItems = @()
if ($routing.json) {
    if ($null -ne $routing.json.features) {
        $routeResultSource = 'features'
        $routeItems = @($routing.json.features)
    }
    elseif ($null -ne $routing.json.results) {
        $routeResultSource = 'results'
        $routeItems = @($routing.json.results)
    }
    elseif ($routing.json -is [System.Array]) {
        $routeResultSource = 'top_level_array'
        $routeItems = @($routing.json)
    }
}
$firstRoute = if ($routeItems.Count -gt 0) { $routeItems[0] } else { $null }
$routeProperties = if ($firstRoute -and $null -ne $firstRoute.properties) {
    $firstRoute.properties
}
else {
    $firstRoute
}
$routeGeometry = if ($firstRoute -and $null -ne $firstRoute.geometry) {
    $firstRoute.geometry
}
elseif ($routeProperties -and $null -ne $routeProperties.geometry) {
    $routeProperties.geometry
}
else {
    $null
}
$routeGeometryType = $null
$routeGeometryItemCount = 0
$routeGeometrySha256 = $null
if ($null -ne $routeGeometry) {
    $routeGeometrySha256 = Get-ValueSha256 $routeGeometry
    if ($routeGeometry -is [System.Array]) {
        $routeGeometryType = 'array'
        $routeGeometryItemCount = @($routeGeometry).Count
    }
    elseif ($null -ne $routeGeometry.PSObject.Properties['type']) {
        $routeGeometryType = [string]$routeGeometry.type
    }
    else {
        $routeGeometryType = $routeGeometry.GetType().Name
    }
}

$results = @(
    [pscustomobject]@{
        probe = $style.name
        http_status = $style.http_status
        elapsed_ms = $style.elapsed_ms
        content_type = $style.content_type
        response_body_bytes = $style.response_body_bytes
        provider_code = $style.provider_code
        message = $style.message
        usage_headers = $style.usage_headers
        json_parsed = $style.json_parsed
        top_level_fields = @(Get-TopLevelFields $style.json)
        style_version = if ($style.json) { $style.json.version } else { $null }
        source_count = Get-PropertyCount $styleSources
        layer_count = $styleLayers.Count
        has_source_attribution_in_style_json = $hasAttribution
    },
    [pscustomobject]@{
        probe = $geocode.name
        http_status = $geocode.http_status
        elapsed_ms = $geocode.elapsed_ms
        content_type = $geocode.content_type
        response_body_bytes = $geocode.response_body_bytes
        provider_code = $geocode.provider_code
        message = $geocode.message
        usage_headers = $geocode.usage_headers
        json_parsed = $geocode.json_parsed
        top_level_fields = @(Get-TopLevelFields $geocode.json)
        result_source = $geocodeResultSource
        result_count = $geocodeResults.Count
        first_result = if ($firstGeocodeResult) {
            [pscustomobject]@{
                formatted = $firstGeocodeResult.formatted
                result_type = $firstGeocodeResult.result_type
                country_code = $firstGeocodeResult.country_code
                latitude = $firstGeocodeResult.lat
                longitude = $firstGeocodeResult.lon
            }
        }
        else {
            $null
        }
    },
    [pscustomobject]@{
        probe = $routing.name
        http_status = $routing.http_status
        elapsed_ms = $routing.elapsed_ms
        content_type = $routing.content_type
        response_body_bytes = $routing.response_body_bytes
        provider_code = $routing.provider_code
        message = $routing.message
        usage_headers = $routing.usage_headers
        json_parsed = $routing.json_parsed
        top_level_fields = @(Get-TopLevelFields $routing.json)
        result_source = $routeResultSource
        route_count = $routeItems.Count
        first_route = if ($firstRoute) {
            [pscustomobject]@{
                distance_m = $routeProperties.distance
                duration_s = $routeProperties.time
                mode = $routeProperties.mode
                route_type = $RouteType
                leg_count = if ($routeProperties.legs) { @($routeProperties.legs).Count } else { 0 }
                geometry_container_type = $routeGeometryType
                geometry_item_count = $routeGeometryItemCount
                geometry_sha256 = $routeGeometrySha256
            }
        }
        else {
            $null
        }
    }
)

[pscustomobject]@{
    executed_at_utc = (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ')
    provider = 'Geoapify'
    key_values_distinct = ($tileKey -ne $serverKey)
    request = [pscustomobject]@{
        search_text = $SearchText
        country_code = $countryCodeValue
        language = $Language
        style_name = $StyleName
        route_mode = $Mode
        route_type = $RouteType
        origin = [pscustomobject]@{
            latitude = $OriginLatitude
            longitude = $OriginLongitude
        }
        destination = [pscustomobject]@{
            latitude = $DestinationLatitude
            longitude = $DestinationLongitude
        }
    }
    provider_requests_sent = 3
    raw_response_persisted = $false
    results = $results
} | ConvertTo-Json -Depth 10
