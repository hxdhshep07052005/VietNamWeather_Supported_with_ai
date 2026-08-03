param(
    [string]$RuntimeEnvPath = '.env.local',
    [string]$ManifestPath = 'apps/directus/security/foundation.json',
    [string]$Phase3ManifestPath = 'apps/directus/security/phase3-default-deny.json'
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

$manifest = Get-Content -LiteralPath (Join-Path $workspaceRoot $ManifestPath) -Raw | ConvertFrom-Json
if ($manifest.manifestVersion -ne 1) { throw 'Unsupported security baseline manifest version.' }
$phase3ManifestFile = Join-Path $workspaceRoot $Phase3ManifestPath
$phase3Manifest = $null
if (Test-Path -LiteralPath $phase3ManifestFile -PathType Leaf) {
    $phase3Manifest = Get-Content -LiteralPath $phase3ManifestFile -Raw | ConvertFrom-Json
    if ($phase3Manifest.manifestVersion -ne 2 -or @($phase3Manifest.permissions).Count -ne 7) {
        throw 'Unsupported Phase 3 security manifest.'
    }
}
$runtime = Read-EnvironmentFile (Join-Path $workspaceRoot $RuntimeEnvPath)

Push-Location $workspaceRoot
try {
    $query = @'
SELECT json_build_object(
    'roles', (SELECT count(*) FROM directus_roles),
    'adminPolicies', (SELECT count(*) FROM directus_policies WHERE admin_access = true AND app_access = true),
    'nonAdminPolicies', (SELECT count(*) FROM directus_policies WHERE admin_access = false),
    'permissions', (SELECT count(*) FROM directus_permissions),
    'applicationRoles', (
        SELECT count(DISTINCT r.id)
        FROM directus_roles r
        JOIN directus_access a ON a.role = r.id
        JOIN directus_policies p ON p.id = a.policy
        WHERE p.admin_access = false
    )
);
'@
    $actualJson = $query | docker compose --env-file $RuntimeEnvPath exec -T database psql -qAt -v ON_ERROR_STOP=1 -U $runtime['DB_USER'] -d $runtime['DB_DATABASE']
    if ($LASTEXITCODE -ne 0) { throw 'Unable to query Directus security baseline.' }
    $actual = ([string]$actualJson).Trim() | ConvertFrom-Json

    $properties = @('roles', 'adminPolicies', 'nonAdminPolicies', 'permissions', 'applicationRoles')
    $foundationMatches = $true
    foreach ($property in $properties) {
        if ([int]$actual.$property -ne [int]$manifest.baseline.$property) { $foundationMatches = $false }
    }

    $state = 'foundation'
    if (-not $foundationMatches) {
        if ($null -eq $phase3Manifest) { throw 'Directus security baseline mismatch and no approved Phase 3 manifest exists.' }
        $phase3Roles = @($phase3Manifest.roles)
        $expected = @{
            roles = [int]$manifest.baseline.roles + $phase3Roles.Count
            adminPolicies = [int]$manifest.baseline.adminPolicies + @($phase3Roles | Where-Object { [bool]$_.policy.adminAccess }).Count
            nonAdminPolicies = [int]$manifest.baseline.nonAdminPolicies + @($phase3Roles | Where-Object { -not [bool]$_.policy.adminAccess }).Count
            permissions = [int]$manifest.baseline.permissions + @($phase3Manifest.permissions).Count
            applicationRoles = [int]$manifest.baseline.applicationRoles + $phase3Roles.Count
        }
        foreach ($property in $properties) {
            if ([int]$actual.$property -ne [int]$expected[$property]) {
                throw "Directus security baseline mismatch: $property"
            }
        }
        $state = 'phase3_least_privilege'
    }
    Write-Output "DIRECTUS_SECURITY_BASELINE_OK state=$state roles=$($actual.roles) admin_policies=$($actual.adminPolicies) non_admin_policies=$($actual.nonAdminPolicies) permissions=$($actual.permissions) application_roles=$($actual.applicationRoles)"
}
finally {
    Pop-Location
}
