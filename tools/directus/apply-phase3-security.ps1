param(
    [string]$RuntimeEnvPath = '.env.local',
    [string]$AdminEnvPath = '.env.admin.local',
    [string]$ManifestPath = 'apps/directus/security/phase3-default-deny.json',
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
        throw 'Manifest path must remain inside the workspace.'
    }
    if (-not (Test-Path -LiteralPath $fullPath -PathType Leaf)) { throw "Missing file: $RelativePath" }
    return $fullPath
}

function Invoke-Api {
    param(
        [string]$Method,
        [string]$Uri,
        [hashtable]$Headers,
        [object]$Body = $null,
        [int[]]$AllowStatus = @()
    )
    $params = @{ Method = $Method; Uri = $Uri; Headers = $Headers; TimeoutSec = 20 }
    if ($null -ne $Body) {
        $params.ContentType = 'application/json'
        $params.Body = ($Body | ConvertTo-Json -Depth 20 -Compress)
    }
    try {
        return Invoke-RestMethod @params
    }
    catch {
        $status = 0
        if ($_.Exception.Response) { $status = [int]$_.Exception.Response.StatusCode }
        if ($AllowStatus -contains $status) { return $null }
        throw "Directus API request failed: $Method $Uri status=$status"
    }
}

function Assert-ValidGuid {
    param([string]$Value, [string]$Label)
    $parsed = [Guid]::Empty
    if (-not [Guid]::TryParse($Value, [ref]$parsed)) { throw "$Label must be a UUID." }
}

function Test-SelfUserFilter {
    param($Value)
    if ($null -eq $Value) { return $false }
    $rootProperties = @($Value.PSObject.Properties)
    if ($rootProperties.Count -ne 1 -or $rootProperties[0].Name -ne 'id') { return $false }
    $idProperties = @($Value.id.PSObject.Properties)
    return $idProperties.Count -eq 1 -and $idProperties[0].Name -eq '_eq' -and [string]$Value.id._eq -eq '$CURRENT_USER'
}

function Get-PermissionPolicyId {
    param($Permission)
    if ($Permission.policy -is [pscustomobject]) { return [string]$Permission.policy.id }
    return [string]$Permission.policy
}

function Get-PermissionFields {
    param($Value)
    if ($null -eq $Value) { return @() }
    if ($Value -is [string]) { return @($Value.Split(',') | Where-Object { -not [string]::IsNullOrWhiteSpace($_) }) }
    return @($Value)
}

$manifestFile = Resolve-WorkspaceFile $ManifestPath
$runtimeFile = Resolve-WorkspaceFile $RuntimeEnvPath
$adminFile = Resolve-WorkspaceFile $AdminEnvPath
$runtime = Read-EnvironmentFile $runtimeFile
$admin = Read-EnvironmentFile $adminFile
$manifest = Get-Content -LiteralPath $manifestFile -Raw | ConvertFrom-Json

if ($manifest.manifestVersion -ne 2) { throw 'Unsupported security manifest version.' }
if ([string]$manifest.directusVersion -ne '12.1.1') { throw 'Security manifest Directus version mismatch.' }
if ([string]$manifest.key -notmatch '^[a-z0-9][a-z0-9._-]{1,127}$') { throw 'Security manifest key is invalid.' }
if ([string]$manifest.version -notmatch '^[0-9][0-9A-Za-z._-]{1,63}$') { throw 'Security manifest version is invalid.' }

$roles = @($manifest.roles)
$permissions = @($manifest.permissions)
if ($roles.Count -ne 13) { throw 'Phase 3 manifest must define exactly 13 managed roles.' }
if ($permissions.Count -ne 7) { throw 'Phase 3 manifest must define exactly seven staff self-TFA permissions.' }
$roleIds = @{}
$policyIds = @{}
$accessIds = @{}
$roleNames = @{}
$policyNames = @{}
foreach ($entry in $roles) {
    Assert-ValidGuid $entry.id "role $($entry.key) id"
    Assert-ValidGuid $entry.policy.id "policy $($entry.key) id"
    Assert-ValidGuid $entry.access.id "access $($entry.key) id"
    if ($roleIds.ContainsKey([string]$entry.id) -or $policyIds.ContainsKey([string]$entry.policy.id) -or $accessIds.ContainsKey([string]$entry.access.id)) {
        throw "Duplicate managed security ID in role $($entry.key)."
    }
    if ($roleNames.ContainsKey([string]$entry.name) -or $policyNames.ContainsKey([string]$entry.policy.name)) {
        throw "Duplicate managed security name in role $($entry.key)."
    }
    if ([bool]$entry.policy.adminAccess) { throw "Managed policy $($entry.policy.name) cannot have admin access." }
    if ([string]$entry.classification -eq 'human_staff' -and -not [bool]$entry.policy.enforceTfa) {
        throw "Human staff policy $($entry.policy.name) must enforce MFA."
    }
    if ([string]$entry.classification -in @('service', 'service_disabled') -and [bool]$entry.policy.appAccess) {
        throw "Service policy $($entry.policy.name) cannot have Studio app access."
    }
    $roleIds[[string]$entry.id] = $true
    $policyIds[[string]$entry.policy.id] = $true
    $accessIds[[string]$entry.access.id] = $true
    $roleNames[[string]$entry.name] = $true
    $policyNames[[string]$entry.policy.name] = $true
}

$permissionKeys = @{}
foreach ($entry in $permissions) {
    if ([string]$entry.key -notmatch '^[a-z0-9][a-z0-9._-]{1,127}$' -or $permissionKeys.ContainsKey([string]$entry.key)) {
        throw "Invalid or duplicate managed permission key: $($entry.key)"
    }
    $permissionKeys[[string]$entry.key] = $true
    $permissionRole = @($roles | Where-Object { [string]$_.key -eq [string]$entry.roleKey })
    if ($permissionRole.Count -ne 1 -or [string]$permissionRole[0].classification -ne 'human_staff') {
        throw "Managed permission must target exactly one human staff role: $($entry.key)"
    }
    $fields = @(Get-PermissionFields $entry.fields)
    if ([string]$entry.collection -ne 'directus_users' -or [string]$entry.action -ne 'update' -or
        $fields.Count -ne 1 -or [string]$fields[0] -ne 'tfa_secret' -or $null -ne $entry.presets -or
        -not (Test-SelfUserFilter $entry.permissions) -or -not (Test-SelfUserFilter $entry.validation)) {
        throw "Managed permission exceeds the approved self-TFA boundary: $($entry.key)"
    }
}
foreach ($staffRole in @($roles | Where-Object classification -eq 'human_staff')) {
    if (@($permissions | Where-Object { [string]$_.roleKey -eq [string]$staffRole.key }).Count -ne 1) {
        throw "Human staff role must have exactly one self-TFA permission: $($staffRole.key)"
    }
}

$baseUrl = ([string]$runtime['DIRECTUS_PUBLIC_URL']).TrimEnd('/')
if ([string]::IsNullOrWhiteSpace($baseUrl)) { throw 'DIRECTUS_PUBLIC_URL is missing.' }
if ([string]::IsNullOrWhiteSpace($admin['DIRECTUS_ADMIN_EMAIL']) -or [string]::IsNullOrWhiteSpace($admin['DIRECTUS_ADMIN_PASSWORD'])) {
    throw 'Admin credentials are missing from the protected local admin environment.'
}

$login = Invoke-Api -Method Post -Uri "$baseUrl/auth/login" -Headers @{} -Body @{
    email = $admin['DIRECTUS_ADMIN_EMAIL']
    password = $admin['DIRECTUS_ADMIN_PASSWORD']
    mode = 'json'
}
if ([string]::IsNullOrWhiteSpace($login.data.access_token)) { throw 'Directus admin login failed.' }
$headers = @{ Authorization = "Bearer $($login.data.access_token)" }
$policyCreated = 0
$policyUpdated = 0
$policyUnchanged = 0
$roleCreated = 0
$roleUpdated = 0
$roleUnchanged = 0
$accessCreated = 0
$accessUpdated = 0
$accessUnchanged = 0
$permissionCreated = 0
$permissionUpdated = 0
$permissionUnchanged = 0
$permissionDeleted = 0
$existingRoles = @()
$existingPolicies = @()
$existingAccess = @()
$existingPermissions = @()

function Get-ManagedItem {
    param([string]$Endpoint, [string]$Id)
    $items = switch ($Endpoint) {
        'roles' { $script:existingRoles }
        'policies' { $script:existingPolicies }
        'access' { $script:existingAccess }
        default { throw "Unsupported managed endpoint: $Endpoint" }
    }
    $match = @($items | Where-Object { [string]$_.id -eq $Id })
    if ($match.Count -eq 0) { return $null }
    if ($match.Count -ne 1) { throw "Duplicate managed item ID in Directus: $Endpoint/$Id" }
    return $match[0]
}

function New-UpdateBody {
    param([System.Collections.IDictionary]$Desired)
    $body = [ordered]@{}
    foreach ($key in $Desired.Keys) {
        if ($key -ne 'id') { $body[$key] = $Desired[$key] }
    }
    return $body
}

function Upsert-Policy {
    param($Entry)
    $desired = [ordered]@{
        id = [string]$Entry.policy.id
        name = [string]$Entry.policy.name
        icon = [string]$Entry.policy.icon
        description = [string]$Entry.policy.description
        ip_access = $null
        enforce_tfa = [bool]$Entry.policy.enforceTfa
        admin_access = [bool]$Entry.policy.adminAccess
        app_access = [bool]$Entry.policy.appAccess
    }
    $current = Get-ManagedItem 'policies' $desired.id
    if ($null -eq $current) {
        if ($Apply) { Invoke-Api -Method Post -Uri "$baseUrl/policies" -Headers $headers -Body $desired | Out-Null }
        $script:policyCreated++
        return
    }
    $changed = ([string]$current.name -ne $desired.name) -or
        ([string]$current.icon -ne $desired.icon) -or
        ([string]$current.description -ne $desired.description) -or
        ([bool]$current.enforce_tfa -ne $desired.enforce_tfa) -or
        ([bool]$current.admin_access -ne $desired.admin_access) -or
        ([bool]$current.app_access -ne $desired.app_access) -or
        ($null -ne $current.ip_access)
    if ($changed) {
        if ($Apply) { Invoke-Api -Method Patch -Uri "$baseUrl/policies/$($desired.id)" -Headers $headers -Body (New-UpdateBody $desired) | Out-Null }
        $script:policyUpdated++
    }
    else { $script:policyUnchanged++ }
}

function Upsert-Role {
    param($Entry)
    $desired = [ordered]@{
        id = [string]$Entry.id
        name = [string]$Entry.name
        icon = [string]$Entry.icon
        description = [string]$Entry.description
        parent = $null
    }
    $current = Get-ManagedItem 'roles' $desired.id
    if ($null -eq $current) {
        if ($Apply) { Invoke-Api -Method Post -Uri "$baseUrl/roles" -Headers $headers -Body $desired | Out-Null }
        $script:roleCreated++
        return
    }
    $changed = ([string]$current.name -ne $desired.name) -or
        ([string]$current.icon -ne $desired.icon) -or
        ([string]$current.description -ne $desired.description) -or
        ($null -ne $current.parent)
    if ($changed) {
        if ($Apply) { Invoke-Api -Method Patch -Uri "$baseUrl/roles/$($desired.id)" -Headers $headers -Body (New-UpdateBody $desired) | Out-Null }
        $script:roleUpdated++
    }
    else { $script:roleUnchanged++ }
}

function Upsert-Access {
    param($Entry)
    $desired = [ordered]@{
        id = [string]$Entry.access.id
        role = [string]$Entry.id
        user = $null
        policy = [string]$Entry.policy.id
        sort = [int]$Entry.access.sort
    }
    $current = Get-ManagedItem 'access' $desired.id
    if ($null -eq $current) {
        if ($Apply) { Invoke-Api -Method Post -Uri "$baseUrl/access" -Headers $headers -Body $desired | Out-Null }
        $script:accessCreated++
        return
    }
    $currentRole = if ($current.role -is [pscustomobject]) { [string]$current.role.id } else { [string]$current.role }
    $currentPolicy = if ($current.policy -is [pscustomobject]) { [string]$current.policy.id } else { [string]$current.policy }
    $currentUser = if ($null -eq $current.user) { $null } elseif ($current.user -is [pscustomobject]) { [string]$current.user.id } else { [string]$current.user }
    $changed = ($currentRole -ne $desired.role) -or ($currentPolicy -ne $desired.policy) -or ($null -ne $currentUser) -or ([int]$current.sort -ne $desired.sort)
    if ($changed) {
        if ($Apply) { Invoke-Api -Method Patch -Uri "$baseUrl/access/$($desired.id)" -Headers $headers -Body (New-UpdateBody $desired) | Out-Null }
        $script:accessUpdated++
    }
    else { $script:accessUnchanged++ }
}

function Upsert-Permission {
    param($Entry)
    $role = @($roles | Where-Object { [string]$_.key -eq [string]$Entry.roleKey })
    if ($role.Count -ne 1) { throw "Managed permission role could not be resolved: $($Entry.key)" }
    $desired = [ordered]@{
        collection = [string]$Entry.collection
        action = [string]$Entry.action
        permissions = $Entry.permissions
        validation = $Entry.validation
        presets = $null
        fields = @(Get-PermissionFields $Entry.fields)
        policy = [string]$role[0].policy.id
    }
    $matches = @($script:existingPermissions | Where-Object {
        (Get-PermissionPolicyId $_) -eq $desired.policy -and
        [string]$_.collection -eq $desired.collection -and
        [string]$_.action -eq $desired.action
    })
    if ($matches.Count -gt 1) { throw "Duplicate managed permission in Directus: $($Entry.key)" }
    if ($matches.Count -eq 0) {
        if ($Apply) { Invoke-Api -Method Post -Uri "$baseUrl/permissions" -Headers $headers -Body $desired | Out-Null }
        $script:permissionCreated++
        return
    }
    $current = $matches[0]
    $currentFields = @(Get-PermissionFields $current.fields)
    $changed = $currentFields.Count -ne 1 -or [string]$currentFields[0] -ne 'tfa_secret' -or
        $null -ne $current.presets -or -not (Test-SelfUserFilter $current.permissions) -or
        -not (Test-SelfUserFilter $current.validation)
    if ($changed) {
        if ($Apply) { Invoke-Api -Method Patch -Uri "$baseUrl/permissions/$($current.id)" -Headers $headers -Body $desired | Out-Null }
        $script:permissionUpdated++
    }
    else { $script:permissionUnchanged++ }
}

try {
    $script:existingRoles = @(Invoke-Api -Method Get -Uri "$baseUrl/roles?limit=-1" -Headers $headers).data
    $script:existingPolicies = @(Invoke-Api -Method Get -Uri "$baseUrl/policies?limit=-1" -Headers $headers).data
    $script:existingAccess = @(Invoke-Api -Method Get -Uri "$baseUrl/access?limit=-1" -Headers $headers).data
    $script:existingPermissions = @(Invoke-Api -Method Get -Uri "$baseUrl/permissions?limit=-1" -Headers $headers).data
    foreach ($entry in $roles) {
        $roleCollision = @($script:existingRoles | Where-Object { [string]$_.name -eq [string]$entry.name -and [string]$_.id -ne [string]$entry.id })
        if ($roleCollision.Count -gt 0) { throw "Role name collision: $($entry.name)" }
        $policyCollision = @($script:existingPolicies | Where-Object { [string]$_.name -eq [string]$entry.policy.name -and [string]$_.id -ne [string]$entry.policy.id })
        if ($policyCollision.Count -gt 0) { throw "Policy name collision: $($entry.policy.name)" }
    }
    foreach ($entry in $roles) { Upsert-Policy $entry }
    foreach ($entry in $roles) { Upsert-Role $entry }
    foreach ($entry in $roles) { Upsert-Access $entry }
    $expectedPermissionIdentities = @{}
    $managedPermissionScopes = @{}
    foreach ($entry in $permissions) {
        $role = @($roles | Where-Object { [string]$_.key -eq [string]$entry.roleKey })
        $identity = "$([string]$role[0].policy.id)|$([string]$entry.collection)|$([string]$entry.action)"
        $expectedPermissionIdentities[$identity] = $true
        $scope = "$([string]$entry.collection)|$([string]$entry.action)"
        $managedPermissionScopes[$scope] = $true
    }
    foreach ($current in $script:existingPermissions) {
        $currentPolicyId = Get-PermissionPolicyId $current
        $scope = "$([string]$current.collection)|$([string]$current.action)"
        if (-not $policyIds.ContainsKey($currentPolicyId) -or -not $managedPermissionScopes.ContainsKey($scope)) { continue }
        $identity = "$currentPolicyId|$([string]$current.collection)|$([string]$current.action)"
        if (-not $expectedPermissionIdentities.ContainsKey($identity)) {
            if ($Apply) { Invoke-Api -Method Delete -Uri "$baseUrl/permissions/$($current.id)" -Headers $headers | Out-Null }
            $permissionDeleted++
        }
    }
    foreach ($entry in $permissions) { Upsert-Permission $entry }
    $mode = if ($Apply) { 'apply' } else { 'dry-run' }
    Write-Output "DIRECTUS_ROLE_POLICY_APPLY_OK mode=$mode roles=$($roles.Count) permissions=$($permissions.Count) policy_created=$policyCreated policy_updated=$policyUpdated policy_unchanged=$policyUnchanged role_created=$roleCreated role_updated=$roleUpdated role_unchanged=$roleUnchanged access_created=$accessCreated access_updated=$accessUpdated access_unchanged=$accessUnchanged permission_created=$permissionCreated permission_updated=$permissionUpdated permission_unchanged=$permissionUnchanged permission_deleted=$permissionDeleted secrets_printed=false"
}
finally {
    if ($login.data.refresh_token) {
        try {
            Invoke-Api -Method Post -Uri "$baseUrl/auth/logout" -Headers $headers -Body @{ refresh_token = $login.data.refresh_token } | Out-Null
        }
        catch { }
    }
}
