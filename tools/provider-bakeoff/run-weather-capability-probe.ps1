param(
    [Parameter(Mandatory = $true)]
    [double]$Latitude,

    [Parameter(Mandatory = $true)]
    [double]$Longitude,

    [ValidateRange(1, 14)]
    [int]$WeatherApiDays = 7,

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
        $values[$Matches[1]] = $Matches[2]
    }
}

$weatherKey = $values['WEATHERAPI_API_KEY']
$openWeatherKey = $values['OPENWEATHER_API_KEY']
if ([string]::IsNullOrWhiteSpace($weatherKey) -or [string]::IsNullOrWhiteSpace($openWeatherKey)) {
    throw 'Weather provider credentials are missing from the local environment file.'
}

Add-Type -AssemblyName System.Net.Http
$client = New-Object System.Net.Http.HttpClient
$client.Timeout = [TimeSpan]::FromSeconds(30)

function Invoke-Probe {
    param(
        [string]$Name,
        [string]$Uri,
        [string[]]$SecretValues
    )

    $timer = [Diagnostics.Stopwatch]::StartNew()
    try {
        $response = $client.GetAsync($Uri).GetAwaiter().GetResult()
        $body = $response.Content.ReadAsStringAsync().GetAwaiter().GetResult()
        $status = [int]$response.StatusCode
    }
    catch {
        $timer.Stop()
        return [pscustomobject]@{
            name = $Name
            http_status = 'transport_error'
            elapsed_ms = $timer.ElapsedMilliseconds
            provider_code = $null
            message = 'httpclient_request_failed'
            json = $null
        }
    }

    $timer.Stop()
    foreach ($secret in $SecretValues) {
        if ($secret) { $body = $body.Replace($secret, '[REDACTED]') }
    }

    $json = $null
    try { $json = $body | ConvertFrom-Json } catch { }
    $providerCode = $null
    $message = $null
    if ($json) {
        if ($null -ne $json.error) {
            $providerCode = $json.error.code
            $message = [string]$json.error.message
        }
        elseif ($null -ne $json.message) {
            $providerCode = $json.cod
            $message = [string]$json.message
        }
    }
    if ($message) {
        foreach ($secret in $SecretValues) {
            if ($secret) { $message = $message.Replace($secret, '[REDACTED]') }
        }
    }

    [pscustomobject]@{
        name = $Name
        http_status = $status
        elapsed_ms = $timer.ElapsedMilliseconds
        provider_code = $providerCode
        message = $message
        json = $json
    }
}

$secretValues = @($weatherKey, $openWeatherKey)
$weatherUri = "https://api.weatherapi.com/v1/forecast.json?key=$weatherKey&q=$Latitude,$Longitude&days=$WeatherApiDays&aqi=no&alerts=yes"
$oneCallUri = "https://api.openweathermap.org/data/4.0/onecall/current?lat=$Latitude&lon=$Longitude&units=metric&lang=vi&appid=$openWeatherKey"
$currentUri = "https://api.openweathermap.org/data/2.5/weather?lat=$Latitude&lon=$Longitude&units=metric&lang=vi&appid=$openWeatherKey"

try {
    $weather = Invoke-Probe 'weatherapi_forecast' $weatherUri $secretValues
    $oneCall = Invoke-Probe 'openweather_onecall_4_current' $oneCallUri $secretValues
    $current = Invoke-Probe 'openweather_current_2_5' $currentUri $secretValues
}
finally {
    $client.Dispose()
}

$forecastDays = 0
$firstDayHours = 0
if ($weather.json -and $weather.json.forecast -and $weather.json.forecast.forecastday) {
    $forecastDays = @($weather.json.forecast.forecastday).Count
    if ($forecastDays -gt 0 -and $weather.json.forecast.forecastday[0].hour) {
        $firstDayHours = @($weather.json.forecast.forecastday[0].hour).Count
    }
}

$oneCallFields = $null
if ($oneCall.json) { $oneCallFields = @($oneCall.json.PSObject.Properties.Name) -join ',' }

$results = @(
    [pscustomobject]@{
        probe = $weather.name
        http_status = $weather.http_status
        elapsed_ms = $weather.elapsed_ms
        provider_code = $weather.provider_code
        message = $weather.message
        location = if ($weather.json) { $weather.json.location.name } else { $null }
        country = if ($weather.json) { $weather.json.location.country } else { $null }
        timezone = if ($weather.json) { $weather.json.location.tz_id } else { $null }
        forecast_days = $forecastDays
        first_day_hours = $firstDayHours
        has_current = [bool]($weather.json -and $null -ne $weather.json.current)
        has_alerts_property = [bool]($weather.json -and $null -ne $weather.json.alerts)
    },
    [pscustomobject]@{
        probe = $oneCall.name
        http_status = $oneCall.http_status
        elapsed_ms = $oneCall.elapsed_ms
        provider_code = $oneCall.provider_code
        message = $oneCall.message
        top_level_fields = $oneCallFields
        timezone = if ($oneCall.json) { $oneCall.json.timezone } else { $null }
    },
    [pscustomobject]@{
        probe = $current.name
        http_status = $current.http_status
        elapsed_ms = $current.elapsed_ms
        provider_code = $current.provider_code
        message = $current.message
        location = if ($current.json) { $current.json.name } else { $null }
        timestamp = if ($current.json) { $current.json.dt } else { $null }
        timezone_offset = if ($current.json) { $current.json.timezone } else { $null }
        has_temp = [bool]($current.json -and $null -ne $current.json.main.temp)
        has_wind = [bool]($current.json -and $null -ne $current.json.wind.speed)
        has_visibility = [bool]($current.json -and $null -ne $current.json.visibility)
    }
)

[pscustomobject]@{
    executed_at_utc = (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ')
    latitude = $Latitude
    longitude = $Longitude
    requested_weatherapi_days = $WeatherApiDays
    provider_requests_sent = 3
    results = $results
} | ConvertTo-Json -Depth 8
