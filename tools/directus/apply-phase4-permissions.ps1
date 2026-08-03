param(
    [string]$RuntimeEnvPath = '.env.local',
    [string]$AdminEnvPath = '.env.admin.local',
    [string]$ManifestPath = 'apps/directus/security/phase4-business-permissions.json',
    [string]$RoleManifestPath = 'apps/directus/security/phase3-default-deny.json',
    [switch]$Apply
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
        $parameters.Body = ($Body | ConvertTo-Json -Depth 40 -Compress)
    }
    try {
        return Invoke-RestMethod @parameters
    }
    catch {
        $status = 0
        if ($_.Exception.Response) { $status = [int]$_.Exception.Response.StatusCode }
        throw "Directus permission request failed: method=$Method status=$status"
    }
}

function Get-PolicyId {
    param($Permission)
    if ($Permission.policy -is [pscustomobject]) { return [string]$Permission.policy.id }
    return [string]$Permission.policy
}

function Get-FieldList {
    param($Value)
    if ($null -eq $Value) { return $null }
    if ($Value -is [string]) {
        if ([string]::IsNullOrWhiteSpace($Value)) { return @() }
        return @($Value.Split(',') | ForEach-Object { $_.Trim() } | Where-Object { $_ })
    }
    return @($Value | ForEach-Object { [string]$_ })
}

function Get-DesiredFieldList {
    param($Entry)
    $hasFields = @($Entry.PSObject.Properties.Name) -contains 'fields'
    if (-not $hasFields -or $null -eq $Entry.fields) {
        if ([string]$Entry.action -eq 'delete') { return $null }
        return @('*')
    }
    return Get-FieldList $Entry.fields
}

function Convert-NormalizedValue {
    param($Value)
    if ($null -eq $Value) { return $null }
    if ($Value -is [string] -or $Value -is [ValueType]) { return $Value }
    if ($Value -is [System.Collections.IDictionary]) {
        $ordered = [ordered]@{}
        foreach ($key in @($Value.Keys | Sort-Object)) { $ordered[[string]$key] = Convert-NormalizedValue $Value[$key] }
        return $ordered
    }
    if ($Value -is [pscustomobject]) {
        $ordered = [ordered]@{}
        foreach ($property in @($Value.PSObject.Properties | Sort-Object Name)) {
            $ordered[$property.Name] = Convert-NormalizedValue $property.Value
        }
        return $ordered
    }
    if ($Value -is [System.Collections.IEnumerable]) {
        return @($Value | ForEach-Object { Convert-NormalizedValue $_ })
    }
    return $Value
}

function Test-Equivalent {
    param($Left, $Right)
    $leftJson = (Convert-NormalizedValue $Left) | ConvertTo-Json -Depth 40 -Compress
    $rightJson = (Convert-NormalizedValue $Right) | ConvertTo-Json -Depth 40 -Compress
    return $leftJson -ceq $rightJson
}

$runtimeFile = Resolve-WorkspaceFile $RuntimeEnvPath
$adminFile = Resolve-WorkspaceFile $AdminEnvPath
$manifestFile = Resolve-WorkspaceFile $ManifestPath
$roleManifestFile = Resolve-WorkspaceFile $RoleManifestPath
$runtime = Read-EnvironmentFile $runtimeFile
$admin = Read-EnvironmentFile $adminFile
$manifest = Get-Content -LiteralPath $manifestFile -Raw | ConvertFrom-Json
$roleManifest = Get-Content -LiteralPath $roleManifestFile -Raw | ConvertFrom-Json

if ($manifest.manifestVersion -ne 1) { throw 'Unsupported Phase 4 permission manifest version.' }
if ([string]$manifest.directusVersion -ne '12.1.1') { throw 'Phase 4 permission manifest Directus version mismatch.' }
if ([string]$manifest.key -notmatch '^[a-z0-9][a-z0-9._-]{1,127}$') { throw 'Permission manifest key is invalid.' }
if ([string]$manifest.version -notmatch '^[0-9][0-9A-Za-z._-]{1,63}$') { throw 'Permission manifest version is invalid.' }
if (@($manifest.provenance).Count -eq 0) { throw 'Permission manifest provenance is required.' }

$roles = @($roleManifest.roles)
$roleByKey = @{}
foreach ($role in $roles) {
    $key = [string]$role.key
    if ($roleByKey.ContainsKey($key)) { throw "Duplicate role key: $key" }
    $roleByKey[$key] = $role
}

$managedCollections = @($manifest.managedCollections | ForEach-Object { [string]$_ })
if ($managedCollections.Count -ne 40) { throw 'Phase 4 must manage exactly 40 approved business collections.' }
$managedCollectionSet = @{}
foreach ($collection in $managedCollections) {
    if ($collection -notmatch '^[a-z][a-z0-9_]{1,63}$' -or $managedCollectionSet.ContainsKey($collection)) {
        throw "Invalid or duplicate managed collection: $collection"
    }
    $managedCollectionSet[$collection] = $true
}

$permissions = @($manifest.permissions)
if ($permissions.Count -eq 0) { throw 'Phase 4 permission manifest is empty.' }
$permissionKeys = @{}
$permissionIdentities = @{}
foreach ($entry in $permissions) {
    $key = [string]$entry.key
    $roleKey = [string]$entry.roleKey
    $collection = [string]$entry.collection
    $action = [string]$entry.action
    if ($key -notmatch '^[a-z0-9][a-z0-9._-]{1,127}$' -or $permissionKeys.ContainsKey($key)) {
        throw "Invalid or duplicate permission key: $key"
    }
    if (-not $roleByKey.ContainsKey($roleKey)) { throw "Unknown role key: $roleKey" }
    if (-not $managedCollectionSet.ContainsKey($collection)) { throw "Permission targets unmanaged collection: $collection" }
    if ($action -notin @('create', 'read', 'update', 'delete')) { throw "Unsupported permission action: $action" }
    $identity = "$roleKey|$collection|$action"
    if ($permissionIdentities.ContainsKey($identity)) { throw "Duplicate role/collection/action permission: $identity" }
    $permissionKeys[$key] = $true
    $permissionIdentities[$identity] = $true

    $fields = Get-DesiredFieldList $entry
    if ($null -ne $fields -and @($fields | Where-Object { $_ -match '(?i)^(password|token|tfa_secret|auth_data)$' }).Count -gt 0) {
        throw "Permission exposes a credential field: $key"
    }
    if ($roleKey -eq 'registered_traveler' -and $collection -in @('user_favorites', 'saved_routes', 'search_history') -and $action -in @('create', 'read', 'update', 'delete')) {
        $permissionJson = $entry.permissions | ConvertTo-Json -Depth 20 -Compress
        if ($permissionJson -notmatch '\$CURRENT_USER' -or $permissionJson -notmatch 'owner_id') {
            throw "Traveler ownership permission is missing owner filter: $key"
        }
    }
    if ($roleKey -eq 'payment_webhook_ingress' -and ($collection -ne 'payment_events' -or $action -ne 'create')) {
        throw "Payment ingress exceeds append-only event permission: $key"
    }
}

if (@($permissions | Where-Object roleKey -eq 'ai_tool_service').Count -ne 0) {
    throw 'AI tool service must remain disabled in Phase 4.'
}

& (Join-Path $workspaceRoot 'tools\directus\validate-license.ps1') `
    -RuntimeEnvPath $RuntimeEnvPath `
    -AdminEnvPath $AdminEnvPath `
    -RequireLicensed

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
$unchanged = 0
$deleted = 0

try {
    $availableCollections = @((Invoke-Api -Method Get -Uri "$baseUrl/collections?limit=-1" -Headers $headers).data | ForEach-Object { [string]$_.collection })
    $missingCollections = @($managedCollections | Where-Object { $_ -notin $availableCollections })
    if ($missingCollections.Count -gt 0) { throw "Directus is missing managed collections: $($missingCollections -join ', ')" }

    $existing = @((Invoke-Api -Method Get -Uri "$baseUrl/permissions?limit=-1" -Headers $headers).data)
    $managedPolicyIds = @($roles | ForEach-Object { [string]$_.policy.id })
    $expected = @{}
    foreach ($entry in $permissions) {
        $policyId = [string]$roleByKey[[string]$entry.roleKey].policy.id
        $identity = "$policyId|$([string]$entry.collection)|$([string]$entry.action)"
        $expected[$identity] = $true
    }

    foreach ($current in $existing) {
        $policyId = Get-PolicyId $current
        if ($policyId -notin $managedPolicyIds -or -not $managedCollectionSet.ContainsKey([string]$current.collection)) { continue }
        $identity = "$policyId|$([string]$current.collection)|$([string]$current.action)"
        if (-not $expected.ContainsKey($identity)) {
            if ($Apply) { Invoke-Api -Method Delete -Uri "$baseUrl/permissions/$([string]$current.id)" -Headers $headers | Out-Null }
            $deleted++
        }
    }

    foreach ($entry in $permissions) {
        $policyId = [string]$roleByKey[[string]$entry.roleKey].policy.id
        $matches = @($existing | Where-Object {
            (Get-PolicyId $_) -eq $policyId -and
            [string]$_.collection -eq [string]$entry.collection -and
            [string]$_.action -eq [string]$entry.action
        })
        if ($matches.Count -gt 1) { throw "Duplicate Directus permission rows: $([string]$entry.key)" }

        $fields = Get-DesiredFieldList $entry
        $desired = [ordered]@{
            collection = [string]$entry.collection
            action = [string]$entry.action
            permissions = $entry.permissions
            validation = $entry.validation
            presets = $entry.presets
            fields = $fields
            policy = $policyId
        }
        if ($matches.Count -eq 0) {
            if ($Apply) { Invoke-Api -Method Post -Uri "$baseUrl/permissions" -Headers $headers -Body $desired | Out-Null }
            $created++
            continue
        }

        $current = $matches[0]
        $currentComparable = [ordered]@{
            collection = [string]$current.collection
            action = [string]$current.action
            permissions = $current.permissions
            validation = $current.validation
            presets = $current.presets
            fields = Get-FieldList $current.fields
            policy = Get-PolicyId $current
        }
        if (Test-Equivalent $currentComparable $desired) {
            $unchanged++
        }
        else {
            if ($Apply) { Invoke-Api -Method Patch -Uri "$baseUrl/permissions/$([string]$current.id)" -Headers $headers -Body $desired | Out-Null }
            $updated++
        }
    }

    $mode = if ($Apply) { 'apply' } else { 'dry-run' }
    Write-Output "PHASE4_PERMISSION_APPLY_OK mode=$mode managed_collections=$($managedCollections.Count) permissions=$($permissions.Count) created=$created updated=$updated unchanged=$unchanged deleted=$deleted ai_disabled=true secrets_printed=false"
}
finally {
    if ($login.data.refresh_token) {
        try { Invoke-Api -Method Post -Uri "$baseUrl/auth/logout" -Headers $headers -Body @{ refresh_token = $login.data.refresh_token } | Out-Null } catch { }
    }
}
