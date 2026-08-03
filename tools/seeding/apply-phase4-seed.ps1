param(
    [Parameter(Mandatory = $true)]
    [ValidatePattern('^[A-Za-z0-9][A-Za-z0-9._-]{1,127}$')]
    [string]$Actor,

    [string]$RuntimeEnvPath = '.env.local',
    [string]$AdminEnvPath = '.env.admin.local',
    [string]$ManifestPath = 'apps/directus/seeds/phase4-approved-config.json'
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

function Resolve-WorkspaceFile {
    param([string]$RelativePath)
    $fullPath = [IO.Path]::GetFullPath((Join-Path $workspaceRoot $RelativePath))
    $workspacePrefix = $workspaceRoot.TrimEnd('\') + '\'
    if (-not $fullPath.StartsWith($workspacePrefix, [StringComparison]::OrdinalIgnoreCase)) {
        throw 'Path must remain inside the workspace.'
    }
    if (-not (Test-Path -LiteralPath $fullPath -PathType Leaf)) { throw "Missing file: $RelativePath" }
    return $fullPath
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
        $parameters.Body = ($Body | ConvertTo-Json -Depth 30 -Compress)
    }
    try {
        return Invoke-RestMethod @parameters
    }
    catch {
        $status = 0
        if ($_.Exception.Response) { $status = [int]$_.Exception.Response.StatusCode }
        throw "Directus seed request failed: method=$Method status=$status"
    }
}

function Convert-MatchToFilter {
    param($Match)
    $filter = [ordered]@{}
    foreach ($property in @($Match.PSObject.Properties)) {
        $filter[$property.Name] = @{ _eq = $property.Value }
    }
    return $filter
}

$runtimeFile = Resolve-WorkspaceFile $RuntimeEnvPath
$adminFile = Resolve-WorkspaceFile $AdminEnvPath
$manifestFile = Resolve-WorkspaceFile $ManifestPath
$runtime = Read-EnvironmentFile $runtimeFile
$admin = Read-EnvironmentFile $adminFile
$environment = [string]$runtime['APP_ENV']
if ($environment -notmatch '^[a-z][a-z0-9_-]{1,31}$') { throw 'APP_ENV is missing or invalid.' }

$manifest = Get-Content -LiteralPath $manifestFile -Raw | ConvertFrom-Json
if ($manifest.manifestVersion -ne 2) { throw 'Unsupported Phase 4 seed manifest version.' }
if ([string]$manifest.key -notmatch '^[a-z0-9][a-z0-9._-]{1,127}$') { throw 'Seed manifest key is invalid.' }
if ([string]$manifest.version -notmatch '^[0-9][0-9A-Za-z._-]{1,63}$') { throw 'Seed manifest version is invalid.' }
if (@($manifest.environmentScopes) -notcontains $environment) { throw 'Seed manifest is not approved for this environment.' }
if (@($manifest.provenance).Count -eq 0) { throw 'Seed manifest provenance is required.' }

$allowedCollections = @($manifest.allowedCollections | ForEach-Object { [string]$_ })
if ($allowedCollections.Count -eq 0) { throw 'Seed manifest must define allowed collections.' }
$allowedSet = @{}
foreach ($collection in $allowedCollections) {
    if ($collection -notmatch '^[a-z][a-z0-9_]{1,63}$' -or $allowedSet.ContainsKey($collection)) {
        throw "Invalid or duplicate allowed collection: $collection"
    }
    $allowedSet[$collection] = $true
}

$operations = @($manifest.operations)
if ($operations.Count -eq 0) { throw 'Phase 4 approved-config manifest must contain operations.' }
foreach ($operation in $operations) {
    $collection = [string]$operation.collection
    if (-not $allowedSet.ContainsKey($collection)) { throw "Operation targets an unapproved collection: $collection" }
    if (@($operation.match.PSObject.Properties).Count -eq 0) { throw "Operation match is required: $collection" }
    if (@($operation.values.PSObject.Properties).Count -eq 0) { throw "Operation values are required: $collection" }
    if ([string]$operation.values.id) {
        $parsedId = [Guid]::Empty
        if (-not [Guid]::TryParse([string]$operation.values.id, [ref]$parsedId)) {
            throw "Seed operation id must be a UUID: $collection"
        }
    }
    foreach ($property in @($operation.values.PSObject.Properties)) {
        if ($property.Name -match '(?i)(password|secret|token|credential)') {
            throw "Seed manifest cannot contain credential fields: $collection.$($property.Name)"
        }
    }
    if ($collection -in @('product_plans', 'plan_entitlements', 'usage_policies') -and [string]$operation.values.status -ne 'draft') {
        throw "Governed seed records must start as draft: $collection"
    }
}

$checksum = (Get-FileHash -Algorithm SHA256 -LiteralPath $manifestFile).Hash.ToLowerInvariant()
$seedKey = [string]$manifest.key
$seedVersion = [string]$manifest.version
$existingChecksum = docker compose --env-file $RuntimeEnvPath exec -T database psql -qAt -v ON_ERROR_STOP=1 `
    -U $runtime['DB_USER'] -d $runtime['DB_DATABASE'] `
    -c "SELECT manifest_checksum FROM app_seed_runs WHERE manifest_key = '$seedKey' AND manifest_version = '$seedVersion' AND environment = '$environment';"
if ($LASTEXITCODE -ne 0) { throw 'Unable to inspect seed audit state.' }
if ($null -eq $existingChecksum) { $existingChecksum = '' }
$existingChecksum = ([string]$existingChecksum).Trim()
if (-not [string]::IsNullOrWhiteSpace($existingChecksum)) {
    if ($existingChecksum -ne $checksum) { throw 'Seed manifest version already exists with a different checksum.' }
    Write-Output "PHASE4_SEED_RUN_OK state=skipped key=$seedKey version=$seedVersion environment=$environment operations=$($operations.Count) checksum=$checksum secrets_printed=false"
    exit 0
}

$baseUrl = ([string]$runtime['DIRECTUS_PUBLIC_URL']).TrimEnd('/')
if ([string]::IsNullOrWhiteSpace($baseUrl)) { throw 'DIRECTUS_PUBLIC_URL is missing.' }
if ([string]::IsNullOrWhiteSpace($admin['DIRECTUS_ADMIN_EMAIL']) -or [string]::IsNullOrWhiteSpace($admin['DIRECTUS_ADMIN_PASSWORD'])) {
    throw 'Protected Directus admin credentials are missing.'
}

$login = Invoke-Api -Method Post -Uri "$baseUrl/auth/login" -Headers @{} -Body @{
    email = $admin['DIRECTUS_ADMIN_EMAIL']
    password = $admin['DIRECTUS_ADMIN_PASSWORD']
    mode = 'json'
}
if ([string]::IsNullOrWhiteSpace($login.data.access_token)) { throw 'Directus admin login failed.' }
$headers = @{ Authorization = "Bearer $($login.data.access_token)" }
$created = 0
$updated = 0

try {
    foreach ($operation in $operations) {
        $collection = [string]$operation.collection
        $filter = Convert-MatchToFilter $operation.match
        $filterJson = $filter | ConvertTo-Json -Depth 20 -Compress
        $filterEncoded = [Uri]::EscapeDataString($filterJson)
        $current = @(Invoke-Api -Method Get -Uri "$baseUrl/items/$($collection)?filter=$filterEncoded&limit=2" -Headers $headers).data
        if ($current.Count -gt 1) { throw "Seed match returned multiple items: $collection" }
        if ($current.Count -eq 0) {
            Invoke-Api -Method Post -Uri "$baseUrl/items/$collection" -Headers $headers -Body $operation.values | Out-Null
            $created++
        }
        else {
            Invoke-Api -Method Patch -Uri "$baseUrl/items/$collection/$([string]$current[0].id)" -Headers $headers -Body $operation.values | Out-Null
            $updated++
        }
    }

    $auditSql = Join-Path $workspaceRoot 'tools\seeding\record-seed-run.sql'
    $result = Get-Content -LiteralPath $auditSql | docker compose --env-file $RuntimeEnvPath exec -T database psql -qAt -v ON_ERROR_STOP=1 `
        -U $runtime['DB_USER'] -d $runtime['DB_DATABASE'] `
        -v "seed_key=$seedKey" `
        -v "seed_version=$seedVersion" `
        -v "seed_checksum=$checksum" `
        -v "seed_environment=$environment" `
        -v "seed_actor=$Actor" `
        -v "seed_operation_count=$($operations.Count)"
    if ($LASTEXITCODE -ne 0 -or ([string]$result).Trim() -ne 'applied') { throw 'Phase 4 seed audit transaction failed.' }

    Write-Output "PHASE4_SEED_RUN_OK state=applied key=$seedKey version=$seedVersion environment=$environment operations=$($operations.Count) created=$created updated=$updated checksum=$checksum secrets_printed=false"
}
finally {
    if ($login.data.refresh_token) {
        try { Invoke-Api -Method Post -Uri "$baseUrl/auth/logout" -Headers $headers -Body @{ refresh_token = $login.data.refresh_token } | Out-Null } catch { }
    }
}
