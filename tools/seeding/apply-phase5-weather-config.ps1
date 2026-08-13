param(
    [Parameter(Mandatory = $true)]
    [ValidatePattern('^[A-Za-z0-9][A-Za-z0-9._-]{1,127}$')]
    [string]$Actor,

    [string]$RuntimeEnvPath = '.env.local',
    [string]$AdminEnvPath = '.env.admin.local',
    [string]$ManifestPath = 'apps/directus/seeds/phase5-approved-weather-config.json',
    [switch]$DryRun
)

$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [Text.Encoding]::UTF8
$workspaceRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path

function Resolve-WorkspaceFile {
    param([string]$Path)

    if ([string]::IsNullOrWhiteSpace($Path)) { throw 'File path is required.' }
    $candidate = if ([IO.Path]::IsPathRooted($Path)) { $Path } else { Join-Path $workspaceRoot $Path }
    $fullPath = [IO.Path]::GetFullPath($candidate)
    $workspacePrefix = $workspaceRoot.TrimEnd('\', '/') + [IO.Path]::DirectorySeparatorChar
    if (-not $fullPath.StartsWith($workspacePrefix, [StringComparison]::OrdinalIgnoreCase)) {
        throw 'Path must remain inside the workspace.'
    }
    if (-not (Test-Path -LiteralPath $fullPath -PathType Leaf)) { throw "Missing file: $Path" }
    return $fullPath
}

function Assert-IgnoredEnvironmentFile {
    param([string]$Path)

    $relativePath = $Path.Substring($workspaceRoot.Length).TrimStart('\', '/').Replace('\', '/')
    & git -C $workspaceRoot check-ignore --quiet -- $relativePath
    if ($LASTEXITCODE -ne 0) { throw 'Environment file must remain ignored by Git.' }
}

function Read-EnvironmentFile {
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

function Convert-MatchToFilter {
    param($Match)

    $filter = [ordered]@{}
    foreach ($property in @($Match.PSObject.Properties)) {
        $filter[$property.Name] = @{ _eq = $property.Value }
    }
    return $filter
}

function Invoke-Api {
    param(
        [string]$Method,
        [string]$Uri,
        [hashtable]$Headers,
        [object]$Body = $null
    )

    $parameters = @{ Method = $Method; Uri = $Uri; Headers = $Headers; TimeoutSec = 30 }
    if ($null -ne $Body) {
        $parameters.ContentType = 'application/json'
        $parameters.Body = $Body | ConvertTo-Json -Depth 30 -Compress
    }
    try {
        return Invoke-RestMethod @parameters
    }
    catch {
        $status = 0
        if ($_.Exception.Response) { $status = [int]$_.Exception.Response.StatusCode }
        throw "Directus weather-config request failed: method=$Method status=$status"
    }
}

function Assert-NoSecretMaterial {
    param(
        $Value,
        [string]$Path = 'manifest'
    )

    if ($null -eq $Value) { return }
    if ($Value -is [string]) {
        if ($Value -match '(?i)bearer\s+[A-Za-z0-9._~+/-]+' -or
            $Value -match '(?i)[?&](key|token|secret|password)=[^&\s]+' -or
            $Value -match '-----BEGIN [A-Z ]*PRIVATE KEY-----') {
            throw "Seed manifest contains secret-like material: $Path"
        }
        return
    }
    if ($Value -is [Collections.IDictionary]) {
        foreach ($key in $Value.Keys) { Assert-NoSecretMaterial -Value $Value[$key] -Path "$Path.$key" }
        return
    }
    if ($Value -is [Collections.IEnumerable] -and $Value -isnot [pscustomobject]) {
        $index = 0
        foreach ($item in $Value) { Assert-NoSecretMaterial -Value $item -Path "$Path[$index]"; $index++ }
        return
    }
    foreach ($property in @($Value.PSObject.Properties)) {
        if ($property.Name -match '(?i)^(password|secret|token|api_key)$') {
            throw "Seed manifest cannot contain secret fields: $Path.$($property.Name)"
        }
        Assert-NoSecretMaterial -Value $property.Value -Path "$Path.$($property.Name)"
    }
}

function Assert-Manifest {
    param($Manifest)

    if ($Manifest.manifestVersion -ne 2) { throw 'Unsupported Phase 5 seed manifest version.' }
    if ([string]$Manifest.key -notmatch '^[a-z0-9][a-z0-9._-]{1,127}$') { throw 'Seed manifest key is invalid.' }
    if ([string]$Manifest.version -notmatch '^[0-9][0-9A-Za-z._-]{1,63}$') { throw 'Seed manifest version is invalid.' }
    if (@($Manifest.provenance).Count -eq 0) { throw 'Seed manifest provenance is required.' }

    $approvedCollections = @('retention_policies', 'weather_providers')
    $allowedCollections = @($Manifest.allowedCollections | ForEach-Object { [string]$_ } | Sort-Object -Unique)
    if (($allowedCollections -join '|') -ne ($approvedCollections -join '|')) {
        throw 'Phase 5 seed scope must contain only weather_providers and retention_policies.'
    }

    $operations = @($Manifest.operations)
    if ($operations.Count -ne 4) { throw 'Phase 5 weather config must contain one provider and three retention policies.' }
    if (@($operations | Where-Object { [string]$_.collection -eq 'weather_providers' }).Count -ne 1 -or
        @($operations | Where-Object { [string]$_.collection -eq 'retention_policies' }).Count -ne 3) {
        throw 'Phase 5 weather config operation scope is invalid.'
    }

    $ids = @{}
    $identities = @{}
    foreach ($operation in $operations) {
        $collection = [string]$operation.collection
        if ($collection -notin $approvedCollections) { throw "Operation targets an unapproved collection: $collection" }
        if (@($operation.match.PSObject.Properties).Count -eq 0) { throw "Operation match is required: $collection" }
        if (@($operation.values.PSObject.Properties).Count -eq 0) { throw "Operation values are required: $collection" }
        $parsedId = [Guid]::Empty
        if (-not [Guid]::TryParse([string]$operation.values.id, [ref]$parsedId)) { throw "Seed operation id must be a UUID: $collection" }
        if ($ids.ContainsKey([string]$parsedId)) { throw 'Seed operation UUIDs must be unique.' }
        $ids[[string]$parsedId] = $true
        foreach ($property in @($operation.match.PSObject.Properties)) {
            if ([string]$operation.values.($property.Name) -ne [string]$property.Value) {
                throw "Seed match and values disagree: $collection.$($property.Name)"
            }
        }
        $identity = "$collection|$($operation.match | ConvertTo-Json -Compress)"
        if ($identities.ContainsKey($identity)) { throw "Duplicate seed identity: $collection" }
        $identities[$identity] = $true
    }

    $provider = @($operations | Where-Object { [string]$_.collection -eq 'weather_providers' })[0].values
    if ([string]$provider.external_key -ne 'weatherapi' -or
        [string]$provider.base_url -ne 'https://api.weatherapi.com' -or
        [string]$provider.credential_reference -ne 'env:WEATHERAPI_API_KEY' -or
        [string]$provider.terms_url -ne 'https://www.weatherapi.com/terms.aspx' -or
        [string]::IsNullOrWhiteSpace([string]$provider.attribution_text) -or
        [string]$provider.status -ne 'active') {
        throw 'WeatherAPI provider configuration does not match the approved origin, credential reference, terms, attribution, or status.'
    }
    if ($provider.capabilities.current -ne $true -or $provider.capabilities.hourly -ne $true -or
        $provider.capabilities.daily -ne $true -or [int]$provider.capabilities.forecast_days -ne 3 -or
        [int]$provider.capabilities.operational_horizon_hours -ne 72 -or
        $provider.capabilities.day_4_to_7 -ne $false -or [string]$provider.capabilities.fallback -ne 'none' -or
        $provider.capabilities.provider_mixing -ne $false) {
        throw 'WeatherAPI capabilities exceed or omit the approved capability-bounded baseline.'
    }
    if ($null -eq $provider.rate_limit_policy -or [int]$provider.rate_limit_policy.automatic_spend_vnd -ne 0 -or
        $provider.rate_limit_policy.automatic_paid_upgrade -ne $false -or
        [string]$provider.rate_limit_policy.on_rate_limited -ne 'degraded') {
        throw 'WeatherAPI rate policy must fail closed without automatic spend or paid upgrade.'
    }

    $expectedRetention = @{
        'weather_observations' = '1|hours'
        'weather_forecasts' = '24|hours'
        'provider_runs_sanitized_metadata' = '30|days'
    }
    foreach ($operation in @($operations | Where-Object { [string]$_.collection -eq 'retention_policies' })) {
        $values = $operation.values
        $expected = [string]$expectedRetention[[string]$values.data_category]
        $actual = "$([int]$values.retention_value)|$([string]$values.retention_unit)"
        if ([string]::IsNullOrWhiteSpace($expected) -or $actual -ne $expected -or
            [int]$values.version -ne 1 -or [string]$values.purge_strategy -ne 'delete' -or
            $values.legal_hold_supported -ne $false -or [string]$values.status -ne 'draft') {
            throw "Retention policy does not match the approved Phase 5 contract: $([string]$values.data_category)"
        }
    }
    Assert-NoSecretMaterial $Manifest
}

$runtimeFile = Resolve-WorkspaceFile $RuntimeEnvPath
$manifestFile = Resolve-WorkspaceFile $ManifestPath
Assert-IgnoredEnvironmentFile $runtimeFile
$runtime = Read-EnvironmentFile $runtimeFile
$environment = [string]$runtime['APP_ENV']
if ($environment -notmatch '^[a-z][a-z0-9_-]{1,31}$') { throw 'APP_ENV is missing or invalid.' }

$manifest = [IO.File]::ReadAllText($manifestFile) | ConvertFrom-Json
Assert-Manifest $manifest
if (@($manifest.environmentScopes) -notcontains $environment) { throw 'Seed manifest is not approved for this environment.' }
$operations = @($manifest.operations)
$checksum = (Get-FileHash -Algorithm SHA256 -LiteralPath $manifestFile).Hash.ToLowerInvariant()
$seedKey = [string]$manifest.key
$seedVersion = [string]$manifest.version

if ($DryRun) {
    Write-Output "PHASE5_WEATHER_CONFIG_OK state=dry-run key=$seedKey version=$seedVersion environment=$environment operations=$($operations.Count) checksum=$checksum collections=weather_providers,retention_policies secrets_printed=false"
    exit 0
}

foreach ($name in @('DB_USER', 'DB_DATABASE')) {
    if ([string]$runtime[$name] -notmatch '^[A-Za-z0-9_]+$') { throw "Database environment value has an invalid format: $name" }
}

Push-Location $workspaceRoot
try {
    $existingResult = @(docker compose --env-file $runtimeFile exec -T database psql -qAt -v ON_ERROR_STOP=1 `
        -U $runtime['DB_USER'] -d $runtime['DB_DATABASE'] `
        -c "SELECT manifest_checksum FROM app_seed_runs WHERE manifest_key = '$seedKey' AND manifest_version = '$seedVersion' AND environment = '$environment';")
    if ($LASTEXITCODE -ne 0) { throw 'Unable to inspect seed audit state.' }
    $existingChecksum = ([string]::Join('', $existingResult)).Trim()
    if (-not [string]::IsNullOrWhiteSpace($existingChecksum)) {
        if ($existingChecksum -ne $checksum) { throw 'Seed manifest version already exists with a different checksum.' }
        Write-Output "PHASE5_WEATHER_CONFIG_OK state=skipped key=$seedKey version=$seedVersion environment=$environment operations=$($operations.Count) checksum=$checksum secrets_printed=false"
        exit 0
    }

    $adminFile = Resolve-WorkspaceFile $AdminEnvPath
    Assert-IgnoredEnvironmentFile $adminFile
    $admin = Read-EnvironmentFile $adminFile
    if ([string]::IsNullOrWhiteSpace([string]$admin['DIRECTUS_ADMIN_EMAIL']) -or
        [string]::IsNullOrWhiteSpace([string]$admin['DIRECTUS_ADMIN_PASSWORD'])) {
        throw 'Protected Directus admin credentials are missing.'
    }

    $baseUrl = ([string]$runtime['DIRECTUS_PUBLIC_URL']).TrimEnd('/')
    [Uri]$parsedBaseUrl = $null
    if (-not [Uri]::TryCreate($baseUrl, [UriKind]::Absolute, [ref]$parsedBaseUrl) -or
        $parsedBaseUrl.Scheme -notin @('http', 'https') -or -not [string]::IsNullOrWhiteSpace($parsedBaseUrl.UserInfo) -or
        -not [string]::IsNullOrWhiteSpace($parsedBaseUrl.Query) -or -not [string]::IsNullOrWhiteSpace($parsedBaseUrl.Fragment)) {
        throw 'DIRECTUS_PUBLIC_URL is missing or invalid.'
    }

    $login = $null
    $headers = @{}
    $created = 0
    $updated = 0
    try {
        $login = Invoke-Api -Method Post -Uri "$baseUrl/auth/login" -Headers @{} -Body @{
            email = $admin['DIRECTUS_ADMIN_EMAIL']
            password = $admin['DIRECTUS_ADMIN_PASSWORD']
            mode = 'json'
        }
        if ([string]::IsNullOrWhiteSpace([string]$login.data.access_token)) { throw 'Directus admin login failed.' }
        $headers = @{ Authorization = "Bearer $($login.data.access_token)" }

        foreach ($operation in $operations) {
            $collection = [string]$operation.collection
            $filter = Convert-MatchToFilter $operation.match
            $filterEncoded = [Uri]::EscapeDataString(($filter | ConvertTo-Json -Depth 20 -Compress))
            $current = @((Invoke-Api -Method Get -Uri "$baseUrl/items/$collection`?filter=$filterEncoded&limit=2&fields=id" -Headers $headers).data)
            if ($current.Count -gt 1) { throw "Seed match returned multiple items: $collection" }
            if ($current.Count -eq 0) {
                Invoke-Api -Method Post -Uri "$baseUrl/items/$collection" -Headers $headers -Body $operation.values | Out-Null
                $created++
            }
            else {
                if ([string]$current[0].id -ne [string]$operation.values.id) {
                    throw "Stable seed UUID conflicts with an existing item: $collection"
                }
                Invoke-Api -Method Patch -Uri "$baseUrl/items/$collection/$([string]$current[0].id)" -Headers $headers -Body $operation.values | Out-Null
                $updated++
            }
        }

        $auditSql = Resolve-WorkspaceFile 'tools/seeding/record-seed-run.sql'
        $auditResult = @([IO.File]::ReadAllLines($auditSql) | docker compose --env-file $runtimeFile exec -T database psql -qAt -v ON_ERROR_STOP=1 `
            -U $runtime['DB_USER'] -d $runtime['DB_DATABASE'] `
            -v "seed_key=$seedKey" `
            -v "seed_version=$seedVersion" `
            -v "seed_checksum=$checksum" `
            -v "seed_environment=$environment" `
            -v "seed_actor=$Actor" `
            -v "seed_operation_count=$($operations.Count)")
        if ($LASTEXITCODE -ne 0 -or ([string]::Join('', $auditResult)).Trim() -ne 'applied') {
            throw 'Phase 5 weather-config seed audit transaction failed.'
        }

        Write-Output "PHASE5_WEATHER_CONFIG_OK state=applied key=$seedKey version=$seedVersion environment=$environment operations=$($operations.Count) created=$created updated=$updated checksum=$checksum secrets_printed=false"
    }
    finally {
        if ($null -ne $login -and $login.data.refresh_token) {
            try { Invoke-Api -Method Post -Uri "$baseUrl/auth/logout" -Headers $headers -Body @{ refresh_token = $login.data.refresh_token } | Out-Null } catch { }
        }
    }
}
finally {
    Pop-Location
}
