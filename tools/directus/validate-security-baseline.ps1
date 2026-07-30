param(
    [string]$RuntimeEnvPath = '.env.local',
    [string]$ManifestPath = 'apps/directus/security/foundation.json'
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

    foreach ($property in @('roles', 'adminPolicies', 'nonAdminPolicies', 'permissions', 'applicationRoles')) {
        if ([int]$actual.$property -ne [int]$manifest.baseline.$property) {
            throw "Directus security baseline mismatch: $property"
        }
    }
    Write-Output "DIRECTUS_SECURITY_BASELINE_OK roles=$($actual.roles) admin_policies=$($actual.adminPolicies) non_admin_policies=$($actual.nonAdminPolicies) permissions=$($actual.permissions) application_roles=$($actual.applicationRoles)"
}
finally {
    Pop-Location
}
