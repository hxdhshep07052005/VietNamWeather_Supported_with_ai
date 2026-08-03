param(
    [string]$RuntimeEnvPath = '.env.local',
    [string]$AdminEnvPath = '.env.admin.local',
    [switch]$RequireLicensed
)

$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [Text.Encoding]::UTF8
$workspaceRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path

function Resolve-WorkspaceFile {
    param([string]$RelativePath)
    $fullPath = [IO.Path]::GetFullPath((Join-Path $workspaceRoot $RelativePath))
    $workspacePrefix = $workspaceRoot.TrimEnd('\') + '\'
    if (-not $fullPath.StartsWith($workspacePrefix, [StringComparison]::OrdinalIgnoreCase)) { throw 'Path must remain inside the workspace.' }
    if (-not (Test-Path -LiteralPath $fullPath -PathType Leaf)) { throw "Missing file: $RelativePath" }
    return $fullPath
}

function Read-EnvironmentFile {
    param([string]$Path)
    $values = @{}
    Get-Content -LiteralPath $Path | ForEach-Object {
        if ($_ -match '^([A-Za-z_][A-Za-z0-9_]*)=(.*)$') { $values[$Matches[1]] = $Matches[2] }
    }
    return $values
}

function Get-FeatureValue {
    param($Entitlement)
    if ($null -ne $Entitlement.override) { return [bool]$Entitlement.override }
    return [bool]$Entitlement.default
}

function Get-NumericLimit {
    param($Entitlement)
    if ([int]$Entitlement.limit -eq -1 -or [int]$Entitlement.overage -eq -1 -or [int]$Entitlement.addon -eq -1) { return -1 }
    return [int]$Entitlement.limit + [int]$Entitlement.overage + [int]$Entitlement.addon
}

$runtime = Read-EnvironmentFile (Resolve-WorkspaceFile $RuntimeEnvPath)
$admin = Read-EnvironmentFile (Resolve-WorkspaceFile $AdminEnvPath)
$hasKey = -not [string]::IsNullOrWhiteSpace($runtime['DIRECTUS_LICENSE_KEY'])
$hasToken = -not [string]::IsNullOrWhiteSpace($runtime['DIRECTUS_LICENSE_TOKEN'])
if ($hasKey -and $hasToken) { throw 'DIRECTUS_LICENSE_KEY and DIRECTUS_LICENSE_TOKEN cannot both be configured.' }

$baseUrl = ([string]$runtime['DIRECTUS_PUBLIC_URL']).TrimEnd('/')
$login = Invoke-RestMethod -Method Post -Uri "$baseUrl/auth/login" -ContentType 'application/json' -Body (@{
    email = $admin['DIRECTUS_ADMIN_EMAIL']
    password = $admin['DIRECTUS_ADMIN_PASSWORD']
    mode = 'json'
} | ConvertTo-Json) -TimeoutSec 20
if ([string]::IsNullOrWhiteSpace($login.data.access_token)) { throw 'Directus admin login failed.' }
$headers = @{ Authorization = "Bearer $($login.data.access_token)" }

try {
    $license = (Invoke-RestMethod -Method Get -Uri "$baseUrl/license" -Headers $headers -TimeoutSec 20).data
    $source = if ($null -eq $license.source) { 'core' } else { [string]$license.source }
    $customPermissions = Get-FeatureValue $license.entitlements.custom_permission_rules_enabled
    $productionEnabled = Get-FeatureValue $license.entitlements.production_enabled
    $seatLimit = Get-NumericLimit $license.entitlements.seats
    $collectionLimit = Get-NumericLimit $license.entitlements.collections
    $flowLimit = Get-NumericLimit $license.entitlements.flows

    if ($RequireLicensed) {
        if ($source -eq 'core' -or [string]$license.name -eq 'Core') { throw 'Licensed Directus entitlement is required but runtime is using Core.' }
        if ([string]$license.status -ne 'active') { throw "Licensed Directus status is not active: $($license.status)" }
        if (-not $productionEnabled) { throw 'Licensed Directus entitlement does not enable production.' }
        if (-not $customPermissions) { throw 'Licensed Directus entitlement does not enable custom permission rules.' }
    }

    $mode = if ($RequireLicensed) { 'required' } else { 'inspect' }
    Write-Output "DIRECTUS_LICENSE_VALIDATION_OK mode=$mode name=$($license.name) status=$($license.status) source=$source production=$($productionEnabled.ToString().ToLowerInvariant()) custom_permissions=$($customPermissions.ToString().ToLowerInvariant()) seats_limit=$seatLimit collections_limit=$collectionLimit flows_limit=$flowLimit usage_seats=$($license.usage.seats) usage_collections=$($license.usage.collections) usage_flows=$($license.usage.flows) key_configured=$($hasKey.ToString().ToLowerInvariant()) token_configured=$($hasToken.ToString().ToLowerInvariant()) secrets_printed=false"
}
finally {
    if ($login.data.refresh_token) {
        try {
            Invoke-RestMethod -Method Post -Uri "$baseUrl/auth/logout" -Headers $headers -ContentType 'application/json' -Body (@{ refresh_token = $login.data.refresh_token } | ConvertTo-Json) -TimeoutSec 20 | Out-Null
        }
        catch { }
    }
}
