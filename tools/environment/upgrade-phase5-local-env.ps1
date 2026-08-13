param(
    [string]$RuntimeEnvPath = '.env.local',
    [string]$BakeoffEnvPath = '.env.bakeoff.local',
    [Security.SecureString]$WeatherApiApiKey,
    [switch]$Force,
    [switch]$DryRun
)

$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [Text.Encoding]::UTF8
$workspaceRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$utf8NoBom = New-Object Text.UTF8Encoding -ArgumentList $false

function Resolve-WorkspacePath {
    param(
        [string]$Path,
        [bool]$MustExist
    )

    if ([string]::IsNullOrWhiteSpace($Path)) { throw 'Environment path is required.' }
    $candidate = if ([IO.Path]::IsPathRooted($Path)) { $Path } else { Join-Path $workspaceRoot $Path }
    $fullPath = [IO.Path]::GetFullPath($candidate)
    $workspacePrefix = $workspaceRoot.TrimEnd('\', '/') + [IO.Path]::DirectorySeparatorChar
    if (-not $fullPath.StartsWith($workspacePrefix, [StringComparison]::OrdinalIgnoreCase)) {
        throw 'Environment path must remain inside the workspace.'
    }
    if ($MustExist -and -not (Test-Path -LiteralPath $fullPath -PathType Leaf)) {
        throw 'Runtime environment file is missing.'
    }
    return $fullPath
}

function Assert-IgnoredEnvironmentFile {
    param([string]$Path)

    $relativePath = $Path.Substring($workspaceRoot.Length).TrimStart('\', '/').Replace('\', '/')
    & git -C $workspaceRoot check-ignore --quiet -- $relativePath
    if ($LASTEXITCODE -ne 0) {
        throw 'Environment file must remain ignored by Git.'
    }
}

function Read-EnvironmentDocument {
    param([string]$Path)

    $lines = [Collections.Generic.List[string]]::new()
    $indices = @{}
    $values = @{}
    foreach ($line in [IO.File]::ReadAllLines($Path)) {
        $index = $lines.Count
        $lines.Add($line)
        if ($line -match '^([A-Za-z_][A-Za-z0-9_]*)=(.*)$') {
            $name = $Matches[1]
            if ($indices.ContainsKey($name)) { throw "Duplicate environment variable: $name" }
            $indices[$name] = $index
            $values[$name] = $Matches[2]
        }
    }
    return [pscustomobject]@{ Lines = $lines; Indices = $indices; Values = $values }
}

function Read-EnvironmentValues {
    param([string]$Path)

    $values = @{}
    foreach ($line in [IO.File]::ReadAllLines($Path)) {
        if ($line -match '^([A-Za-z_][A-Za-z0-9_]*)=(.*)$') {
            $name = $Matches[1]
            if ($values.ContainsKey($name)) { throw "Duplicate environment variable: $name" }
            $values[$name] = $Matches[2]
        }
    }
    return $values
}

function ConvertFrom-ProtectedString {
    param([Security.SecureString]$Value)

    if ($null -eq $Value) { return $null }
    $pointer = [IntPtr]::Zero
    try {
        $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($Value)
        return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
    }
    finally {
        if ($pointer -ne [IntPtr]::Zero) {
            [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
        }
    }
}

function New-RandomBase64Url {
    param([ValidateRange(16, 128)][int]$ByteCount)

    $bytes = New-Object byte[] $ByteCount
    $generator = [Security.Cryptography.RandomNumberGenerator]::Create()
    try { $generator.GetBytes($bytes) } finally { $generator.Dispose() }
    return [Convert]::ToBase64String($bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_')
}

function Write-EnvironmentFile {
    param(
        [string]$Path,
        [string]$Text
    )

    $temporaryPath = Join-Path ([IO.Path]::GetDirectoryName($Path)) (
        [IO.Path]::GetFileName($Path) + '.' + [Guid]::NewGuid().ToString('N') + '.tmp'
    )
    $backupPath = Join-Path ([IO.Path]::GetDirectoryName($Path)) (
        [IO.Path]::GetFileName($Path) + '.' + [Guid]::NewGuid().ToString('N') + '.backup'
    )
    Assert-IgnoredEnvironmentFile $temporaryPath
    Assert-IgnoredEnvironmentFile $backupPath
    try {
        [IO.File]::WriteAllText($temporaryPath, $Text, $utf8NoBom)
        [IO.File]::Replace($temporaryPath, $Path, $backupPath)
    }
    finally {
        if (Test-Path -LiteralPath $temporaryPath) { Remove-Item -LiteralPath $temporaryPath -Force }
        if (Test-Path -LiteralPath $backupPath) { Remove-Item -LiteralPath $backupPath -Force }
    }
}

function Test-WeatherApiKey {
    param([string]$Value)

    if ([string]::IsNullOrWhiteSpace($Value) -or $Value.Length -lt 8 -or $Value.Length -gt 256 -or $Value.Trim() -ne $Value) {
        return $false
    }
    foreach ($character in $Value.ToCharArray()) {
        $code = [int]$character
        if ($code -le 31 -or $code -eq 127) { return $false }
    }
    return $true
}

function Assert-IntegerValue {
    param(
        [hashtable]$Values,
        [string]$Name,
        [int64]$Minimum,
        [int64]$Maximum
    )

    $parsed = 0L
    if (-not [int64]::TryParse([string]$Values[$Name], [ref]$parsed) -or $parsed -lt $Minimum -or $parsed -gt $Maximum) {
        throw "Phase 5 environment value is invalid: $Name"
    }
    return $parsed
}

function New-DistinctWorkerUser {
    param([hashtable]$Values)

    $reserved = @(
        [string]$Values['DB_USER'],
        [string]$Values['API_DB_USER'],
        'app_weather_api',
        'app_weather_worker'
    ) | Where-Object { -not [string]::IsNullOrWhiteSpace($_) }
    $candidate = 'vnwa_weather_worker'
    if ($reserved -notcontains $candidate) { return $candidate }
    if ($DryRun) { return 'vnwa_weather_worker_phase5' }
    do { $candidate = 'vnwa_weather_worker_' + (New-RandomBase64Url 6).Replace('-', '').Replace('_', '').ToLowerInvariant() } while ($reserved -contains $candidate)
    return $candidate
}

$runtimePath = Resolve-WorkspacePath -Path $RuntimeEnvPath -MustExist $true
$bakeoffPath = Resolve-WorkspacePath -Path $BakeoffEnvPath -MustExist $false
Assert-IgnoredEnvironmentFile $runtimePath
if (Test-Path -LiteralPath $bakeoffPath) {
    if (-not (Test-Path -LiteralPath $bakeoffPath -PathType Leaf)) { throw 'Bake-off environment path must be a file.' }
    Assert-IgnoredEnvironmentFile $bakeoffPath
}

$document = Read-EnvironmentDocument $runtimePath
$existingRuntimeKey = [string]$document.Values['WEATHERAPI_API_KEY']
$needsWeatherKey = $Force -or [string]::IsNullOrWhiteSpace($existingRuntimeKey)
$weatherKey = $existingRuntimeKey
$credentialSource = 'existing'

if ($needsWeatherKey) {
    if ($PSBoundParameters.ContainsKey('WeatherApiApiKey')) {
        $weatherKey = ConvertFrom-ProtectedString $WeatherApiApiKey
        $credentialSource = 'parameter'
    }
    elseif (Test-Path -LiteralPath $bakeoffPath -PathType Leaf) {
        $bakeoff = Read-EnvironmentValues $bakeoffPath
        if (-not [string]::IsNullOrWhiteSpace([string]$bakeoff['WEATHERAPI_API_KEY'])) {
            $weatherKey = [string]$bakeoff['WEATHERAPI_API_KEY']
            $credentialSource = 'bakeoff'
        }
    }

    if ([string]::IsNullOrWhiteSpace($weatherKey)) {
        if ($DryRun) {
            $weatherKey = 'dry-run-required-secure-value'
            $credentialSource = 'required'
        }
        else {
            $weatherKey = ConvertFrom-ProtectedString (Read-Host -Prompt 'Enter WEATHERAPI_API_KEY' -AsSecureString)
            $credentialSource = 'interactive'
        }
    }
}

if (-not (Test-WeatherApiKey $weatherKey)) {
    throw 'WEATHERAPI_API_KEY is missing or invalid. Pass a SecureString or configure the ignored bake-off environment file.'
}

$workerUser = [string]$document.Values['WEATHER_WORKER_DB_USER']
if ($Force -or [string]::IsNullOrWhiteSpace($workerUser)) {
    $workerUser = New-DistinctWorkerUser $document.Values
}
$workerPassword = [string]$document.Values['WEATHER_WORKER_DB_PASSWORD']
if ($Force -or [string]::IsNullOrWhiteSpace($workerPassword)) {
    $workerPassword = if ($DryRun) { 'dry-run-generated-weather-worker-password' } else { New-RandomBase64Url 32 }
}

$desired = [ordered]@{
    WEATHER_WORKER_DB_USER = $workerUser
    WEATHER_WORKER_DB_PASSWORD = $workerPassword
    WEATHERAPI_API_KEY = $weatherKey
    WEATHER_PROVIDER_KEY = 'weatherapi'
    WEATHER_PROVIDER_TIMEOUT_MS = '5000'
    WEATHER_PARSER_VERSION = 'weatherapi-forecast-v1'
    API_RATE_LIMIT_WEATHER_MAX = '20'
    API_WEATHER_CACHE_TTL_SECONDS = '30'
    API_WEATHER_PENDING_RETRY_SECONDS = '2'
    WEATHER_WORKER_ID = 'weather-worker.local'
    WEATHER_WORKER_POLL_INTERVAL_MS = '1000'
    WEATHER_WORKER_LEASE_DURATION_MS = '60000'
    WEATHER_WORKER_HEARTBEAT_INTERVAL_MS = '20000'
    WEATHER_WORKER_RETRY_BASE_DELAY_MS = '1000'
    WEATHER_WORKER_RETRY_MAX_DELAY_MS = '300000'
    WEATHER_WORKER_RETRY_JITTER_RATIO = '0.2'
    WEATHER_PROVIDER_CIRCUIT_FAILURE_THRESHOLD = '3'
    WEATHER_PROVIDER_CIRCUIT_RESET_MS = '60000'
    WEATHERAPI_FORECAST_DAYS = '3'
}

$added = 0
$updated = 0
$preserved = 0
foreach ($entry in $desired.GetEnumerator()) {
    $name = [string]$entry.Key
    $value = [string]$entry.Value
    $exists = $document.Indices.ContainsKey($name)
    $hasValue = $exists -and -not [string]::IsNullOrWhiteSpace([string]$document.Values[$name])
    if (-not $Force -and $hasValue) {
        $preserved++
        continue
    }
    if ($exists) {
        if ([string]$document.Values[$name] -ne $value) { $updated++ }
        $document.Lines[$document.Indices[$name]] = "$name=$value"
    }
    else {
        $document.Indices[$name] = $document.Lines.Count
        $document.Lines.Add("$name=$value")
        $added++
    }
    $document.Values[$name] = $value
}

$final = $document.Values
if ([string]$final['WEATHER_WORKER_DB_USER'] -notmatch '^[A-Za-z][A-Za-z0-9_]{1,62}$') {
    throw 'WEATHER_WORKER_DB_USER has an invalid format.'
}
if ([string]$final['WEATHER_WORKER_DB_USER'] -in @(
    [string]$final['DB_USER'], [string]$final['API_DB_USER'], 'app_weather_api', 'app_weather_worker'
)) {
    throw 'WEATHER_WORKER_DB_USER must be distinct from database, API, and capability roles. Use -Force to replace it.'
}
if ([string]::IsNullOrWhiteSpace([string]$final['WEATHER_WORKER_DB_PASSWORD'])) {
    throw 'WEATHER_WORKER_DB_PASSWORD is missing.'
}
if ([string]$final['WEATHER_PROVIDER_KEY'] -ne 'weatherapi') { throw 'WEATHER_PROVIDER_KEY must be weatherapi. Use -Force to restore the approved value.' }
if ([string]$final['WEATHER_WORKER_ID'] -notmatch '^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$') { throw 'WEATHER_WORKER_ID is invalid.' }

$poll = Assert-IntegerValue $final 'WEATHER_WORKER_POLL_INTERVAL_MS' 10 60000
$lease = Assert-IntegerValue $final 'WEATHER_WORKER_LEASE_DURATION_MS' 5000 900000
$heartbeat = Assert-IntegerValue $final 'WEATHER_WORKER_HEARTBEAT_INTERVAL_MS' 250 300000
$providerTimeout = Assert-IntegerValue $final 'WEATHER_PROVIDER_TIMEOUT_MS' 1 60000
$retryBase = Assert-IntegerValue $final 'WEATHER_WORKER_RETRY_BASE_DELAY_MS' 100 3600000
$retryMaximum = Assert-IntegerValue $final 'WEATHER_WORKER_RETRY_MAX_DELAY_MS' 100 86400000
$forecastDays = Assert-IntegerValue $final 'WEATHERAPI_FORECAST_DAYS' 3 3
$jitter = 0.0
if (-not [double]::TryParse(
    [string]$final['WEATHER_WORKER_RETRY_JITTER_RATIO'],
    [Globalization.NumberStyles]::Float,
    [Globalization.CultureInfo]::InvariantCulture,
    [ref]$jitter
) -or $jitter -lt 0 -or $jitter -gt 0.5) {
    throw 'WEATHER_WORKER_RETRY_JITTER_RATIO is invalid.'
}
if ($heartbeat -ge $lease) { throw 'Weather worker heartbeat must be shorter than its lease.' }
if ($retryMaximum -lt $retryBase) { throw 'Weather worker retry maximum must not be shorter than its base delay.' }

$changed = $added + $updated
if (-not $DryRun -and $changed -gt 0) {
    $text = ([string]::Join("`n", $document.Lines)) + "`n"
    Write-EnvironmentFile -Path $runtimePath -Text $text
}

$state = if ($DryRun) { 'dry-run' } elseif ($changed -eq 0) { 'unchanged' } else { 'applied' }
Write-Output "PHASE5_LOCAL_ENV_UPGRADE_OK state=$state added=$added updated=$updated preserved=$preserved credential_source=$credentialSource worker_db_user_distinct=true provider_allowlist=true forecast_days=$forecastDays secrets_printed=false"

$weatherKey = $null
$workerPassword = $null
