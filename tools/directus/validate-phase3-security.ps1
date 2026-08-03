param(
    [string]$RuntimeEnvPath = '.env.local',
    [string]$AdminEnvPath = '.env.admin.local',
    [string]$ManifestPath = 'apps/directus/security/phase3-default-deny.json',
    [string]$BusinessManifestPath = 'apps/directus/security/phase4-business-permissions.json'
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
    if (-not $fullPath.StartsWith($workspacePrefix, [StringComparison]::OrdinalIgnoreCase)) { throw 'Path must remain inside the workspace.' }
    if (-not (Test-Path -LiteralPath $fullPath -PathType Leaf)) { throw "Missing file: $RelativePath" }
    return $fullPath
}

function Invoke-Api {
    param([string]$Method, [string]$Uri, [hashtable]$Headers, [object]$Body = $null, [int[]]$AllowStatus = @())
    $params = @{ Method = $Method; Uri = $Uri; Headers = $Headers; TimeoutSec = 20 }
    if ($null -ne $Body) {
        $params.ContentType = 'application/json'
        $params.Body = ($Body | ConvertTo-Json -Depth 20 -Compress)
    }
    try { return Invoke-RestMethod @params }
    catch {
        $status = 0
        if ($_.Exception.Response) { $status = [int]$_.Exception.Response.StatusCode }
        if ($AllowStatus -contains $status) { return $null }
        throw
    }
}

function Test-SelfUserFilter {
    param($Value)
    if ($null -eq $Value) { return $false }
    $rootProperties = @($Value.PSObject.Properties)
    if ($rootProperties.Count -ne 1 -or $rootProperties[0].Name -ne 'id') { return $false }
    $idProperties = @($Value.id.PSObject.Properties)
    return $idProperties.Count -eq 1 -and $idProperties[0].Name -eq '_eq' -and [string]$Value.id._eq -eq '$CURRENT_USER'
}

function Get-PermissionFields {
    param($Value)
    if ($null -eq $Value) { return @() }
    if ($Value -is [string]) { return @($Value.Split(',') | Where-Object { -not [string]::IsNullOrWhiteSpace($_) }) }
    return @($Value)
}

$manifestFile = Resolve-WorkspaceFile $ManifestPath
$runtime = Read-EnvironmentFile (Resolve-WorkspaceFile $RuntimeEnvPath)
$admin = Read-EnvironmentFile (Resolve-WorkspaceFile $AdminEnvPath)
$manifest = Get-Content -LiteralPath $manifestFile -Raw | ConvertFrom-Json
$roles = @($manifest.roles)
$permissions = @($manifest.permissions)
if ($manifest.manifestVersion -ne 2 -or $roles.Count -ne 13 -or $permissions.Count -ne 7) {
    throw 'Phase 3 security manifest contract is invalid.'
}
$businessManifestFile = [IO.Path]::GetFullPath((Join-Path $workspaceRoot $BusinessManifestPath))
$businessManifest = $null
$businessPermissions = @()
$businessCollections = @()
if (Test-Path -LiteralPath $businessManifestFile -PathType Leaf) {
    $businessManifest = Get-Content -LiteralPath $businessManifestFile -Raw | ConvertFrom-Json
    $businessPermissions = @($businessManifest.permissions)
    $businessCollections = @($businessManifest.managedCollections | ForEach-Object { [string]$_ })
}

$baseUrl = ([string]$runtime['DIRECTUS_PUBLIC_URL']).TrimEnd('/')
$login = Invoke-Api -Method Post -Uri "$baseUrl/auth/login" -Headers @{} -Body @{
    email = $admin['DIRECTUS_ADMIN_EMAIL']
    password = $admin['DIRECTUS_ADMIN_PASSWORD']
    mode = 'json'
}
if ([string]::IsNullOrWhiteSpace($login.data.access_token)) { throw 'Directus admin login failed.' }
$headers = @{ Authorization = "Bearer $($login.data.access_token)" }
$staffMfa = 0
$staffTfaPermissions = 0

try {
    $health = Invoke-Api -Method Get -Uri "$baseUrl/server/health" -Headers $headers
    if ([string]$health.releaseId -ne [string]$manifest.directusVersion) { throw 'Directus runtime version does not match the security manifest.' }

    $allPermissions = @((Invoke-Api -Method Get -Uri "$baseUrl/permissions?limit=-1" -Headers $headers).data)
    $managedPolicyIds = @($roles | ForEach-Object { [string]$_.policy.id })
    $actualManagedPermissions = @($allPermissions | Where-Object {
        $policyId = if ($_.policy -is [pscustomobject]) { [string]$_.policy.id } else { [string]$_.policy }
        $policyId -in $managedPolicyIds
    })
    $actualBusinessPermissions = @($actualManagedPermissions | Where-Object { [string]$_.collection -in $businessCollections })
    $phase4Active = $actualBusinessPermissions.Count -gt 0
    if ($phase4Active -and $actualBusinessPermissions.Count -ne $businessPermissions.Count) {
        throw 'Phase 4 business permissions are only partially applied.'
    }

    foreach ($entry in $roles) {
        $roleResponse = Invoke-Api -Method Get -Uri "$baseUrl/roles/$($entry.id)" -Headers $headers -AllowStatus @(404)
        if ($null -eq $roleResponse) { throw "Managed role is missing: $($entry.key)" }
        $role = $roleResponse.data
        if ([string]$role.name -ne [string]$entry.name -or [string]$role.icon -ne [string]$entry.icon -or [string]$role.description -ne [string]$entry.description -or $null -ne $role.parent) {
            throw "Managed role drift detected: $($entry.key)"
        }

        $policyResponse = Invoke-Api -Method Get -Uri "$baseUrl/policies/$($entry.policy.id)" -Headers $headers -AllowStatus @(404)
        if ($null -eq $policyResponse) { throw "Managed policy is missing: $($entry.key)" }
        $policy = $policyResponse.data
        if ([string]$policy.name -ne [string]$entry.policy.name -or
            [string]$policy.icon -ne [string]$entry.policy.icon -or
            [string]$policy.description -ne [string]$entry.policy.description -or
            [bool]$policy.enforce_tfa -ne [bool]$entry.policy.enforceTfa -or
            [bool]$policy.admin_access -ne [bool]$entry.policy.adminAccess -or
            [bool]$policy.app_access -ne [bool]$entry.policy.appAccess -or
            $null -ne $policy.ip_access) {
            throw "Managed policy drift detected: $($entry.key)"
        }
        if ([bool]$policy.admin_access) { throw "Managed policy unexpectedly has admin access: $($entry.key)" }
        if ([string]$entry.classification -eq 'human_staff') {
            if (-not [bool]$policy.enforce_tfa -or -not [bool]$policy.app_access) { throw "Staff MFA/Studio policy mismatch: $($entry.key)" }
            $staffMfa++
        }
        if ([string]$entry.classification -in @('service', 'service_disabled') -and [bool]$policy.app_access) {
            throw "Service policy unexpectedly has Studio access: $($entry.key)"
        }

        $accessResponse = Invoke-Api -Method Get -Uri "$baseUrl/access/$($entry.access.id)" -Headers $headers -AllowStatus @(404)
        if ($null -eq $accessResponse) { throw "Managed access link is missing: $($entry.key)" }
        $access = $accessResponse.data
        $accessRole = if ($access.role -is [pscustomobject]) { [string]$access.role.id } else { [string]$access.role }
        $accessPolicy = if ($access.policy -is [pscustomobject]) { [string]$access.policy.id } else { [string]$access.policy }
        if ($accessRole -ne [string]$entry.id -or $accessPolicy -ne [string]$entry.policy.id -or $null -ne $access.user -or [int]$access.sort -ne [int]$entry.access.sort) {
            throw "Managed access link drift detected: $($entry.key)"
        }

        $actualPermissions = @($actualManagedPermissions | Where-Object {
            $policyId = if ($_.policy -is [pscustomobject]) { [string]$_.policy.id } else { [string]$_.policy }
            $policyId -eq [string]$entry.policy.id
        })
        $expectedPermissions = @($permissions | Where-Object { [string]$_.roleKey -eq [string]$entry.key })
        $actualTfaPermissions = @($actualPermissions | Where-Object {
            [string]$_.collection -eq 'directus_users' -and [string]$_.action -eq 'update'
        })
        if ([string]$entry.classification -eq 'human_staff') {
            if ($expectedPermissions.Count -ne 1 -or $actualTfaPermissions.Count -ne 1) {
                throw "Human staff self-TFA permission count mismatch: $($entry.key)"
            }
            $actualPermission = $actualTfaPermissions[0]
            $fields = @(Get-PermissionFields $actualPermission.fields)
            if ([string]$actualPermission.collection -ne 'directus_users' -or [string]$actualPermission.action -ne 'update' -or
                $fields.Count -ne 1 -or [string]$fields[0] -ne 'tfa_secret' -or $null -ne $actualPermission.presets -or
                -not (Test-SelfUserFilter $actualPermission.permissions) -or -not (Test-SelfUserFilter $actualPermission.validation)) {
                throw "Human staff permission exceeds the self-TFA boundary: $($entry.key)"
            }
            $staffTfaPermissions++
        }
        elseif ($expectedPermissions.Count -ne 0 -or $actualTfaPermissions.Count -ne 0) {
            throw "Non-staff managed policy is not default-deny: $($entry.key)"
        }

        $unexpectedPermissions = @($actualPermissions | Where-Object {
            -not ([string]$_.collection -eq 'directus_users' -and [string]$_.action -eq 'update') -and
            [string]$_.collection -notin $businessCollections
        })
        if ($unexpectedPermissions.Count -ne 0) { throw "Managed role has an unowned permission: $($entry.key)" }
        if ($phase4Active) {
            $expectedBusinessIdentities = @($businessPermissions | Where-Object { [string]$_.roleKey -eq [string]$entry.key } | ForEach-Object {
                "$([string]$_.collection)|$([string]$_.action)"
            })
            $actualBusinessIdentities = @($actualPermissions | Where-Object { [string]$_.collection -in $businessCollections } | ForEach-Object {
                "$([string]$_.collection)|$([string]$_.action)"
            })
            $expectedBusinessIdentityString = (($expectedBusinessIdentities | Sort-Object) -join '|')
            $actualBusinessIdentityString = (($actualBusinessIdentities | Sort-Object) -join '|')
            if ($expectedBusinessIdentityString -cne $actualBusinessIdentityString) {
                throw "Managed role business permission identity drift: $($entry.key)"
            }
        }
    }

    if ($staffMfa -ne 7) { throw 'Expected seven human staff policies with enforced MFA.' }
    if ($staffTfaPermissions -ne 7) { throw 'Expected seven human staff self-TFA permissions.' }

    $roleIdSql = (@($roles | ForEach-Object { "'$([string]$_.id)'::uuid" })) -join ','
    $policyIdSql = (@($roles | ForEach-Object { "'$([string]$_.policy.id)'::uuid" })) -join ','
    $accessIdSql = (@($roles | ForEach-Object { "'$([string]$_.access.id)'::uuid" })) -join ','
    $sql = @"
SELECT json_build_object(
    'managed_roles', (SELECT count(*) FROM directus_roles WHERE id IN ($roleIdSql)),
    'managed_policies', (SELECT count(*) FROM directus_policies WHERE id IN ($policyIdSql)),
    'managed_access', (SELECT count(*) FROM directus_access WHERE id IN ($accessIdSql)),
    'managed_permissions', (SELECT count(*) FROM directus_permissions WHERE policy IN ($policyIdSql)),
    'admin_policies', (SELECT count(*) FROM directus_policies WHERE admin_access = true),
    'public_permissions', (
        SELECT count(*)
        FROM directus_permissions dp
        JOIN directus_access da ON da.policy = dp.policy
        WHERE da.role IS NULL AND da."user" IS NULL
    ),
    'generic_integration_roles', (SELECT count(*) FROM directus_roles WHERE name = 'Integration Service'),
    'disabled_ai_users', (SELECT count(*) FROM directus_users WHERE role = 'e62c9163-0b98-447c-ab57-c90c56ceefe7'::uuid)
);
"@
    $dbJson = $sql | docker compose --env-file $RuntimeEnvPath exec -T database psql -qAt -v ON_ERROR_STOP=1 -U $runtime['DB_USER'] -d $runtime['DB_DATABASE']
    if ($LASTEXITCODE -ne 0) { throw 'Unable to verify managed security state in PostgreSQL.' }
    $dbState = ([string]$dbJson).Trim() | ConvertFrom-Json
    foreach ($property in @('managed_roles', 'managed_policies', 'managed_access')) {
        if ([int]$dbState.$property -ne $roles.Count) { throw "Managed security count mismatch: $property" }
    }
    $expectedManagedPermissionCount = $permissions.Count + $(if ($phase4Active) { $businessPermissions.Count } else { 0 })
    if ([int]$dbState.managed_permissions -ne $expectedManagedPermissionCount -or [int]$dbState.public_permissions -ne 0) { throw 'Managed permission count or public default-deny boundary is invalid.' }
    if ([int]$dbState.admin_policies -ne 1) { throw 'Exactly one break-glass admin policy is required.' }
    if ([int]$dbState.generic_integration_roles -ne 0) { throw 'A broad Integration Service role is forbidden.' }
    if ([int]$dbState.disabled_ai_users -ne 0) { throw 'The optional AI service must remain unprovisioned in Phase 3.' }

    $securityState = if ($phase4Active) { 'phase4_business_permissions' } else { 'phase3_least_privilege' }
    Write-Output "DIRECTUS_ROLE_POLICY_VALIDATION_OK state=$securityState roles=$($roles.Count) policies=$($roles.Count) access=$($roles.Count) managed_permissions=$expectedManagedPermissionCount staff_mfa=$staffMfa staff_self_tfa_permissions=$staffTfaPermissions public_permissions=0 admin_policies=1 ai_users=0 secrets_printed=false"
}
finally {
    if ($login.data.refresh_token) {
        try { Invoke-Api -Method Post -Uri "$baseUrl/auth/logout" -Headers $headers -Body @{ refresh_token = $login.data.refresh_token } | Out-Null } catch { }
    }
}
