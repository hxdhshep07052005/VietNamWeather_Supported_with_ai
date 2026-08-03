param(
    [string]$RuntimeEnvPath = '.env.local',
    [string]$AdminEnvPath = '.env.admin.local',
    [string]$RoleManifestPath = 'apps/directus/security/phase3-default-deny.json'
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
    param([string]$Method, [string]$Uri, [hashtable]$Headers, [object]$Body = $null)
    $parameters = @{ Method = $Method; Uri = $Uri; Headers = $Headers; TimeoutSec = 30 }
    if ($null -ne $Body) {
        $parameters.ContentType = 'application/json'
        $parameters.Body = ($Body | ConvertTo-Json -Depth 20 -Compress)
    }
    return Invoke-RestMethod @parameters
}

function Get-HttpStatus {
    param([string]$Method, [string]$Uri, [hashtable]$Headers, [object]$Body = $null)
    $parameters = @{ UseBasicParsing = $true; Method = $Method; Uri = $Uri; Headers = $Headers; TimeoutSec = 30 }
    if ($null -ne $Body) {
        $parameters.ContentType = 'application/json'
        $parameters.Body = ($Body | ConvertTo-Json -Depth 20 -Compress)
    }
    try {
        $response = Invoke-WebRequest @parameters
        return [int]$response.StatusCode
    }
    catch {
        if ($_.Exception.Response) { return [int]$_.Exception.Response.StatusCode }
        throw
    }
}

function New-RandomToken {
    $bytes = New-Object byte[] 32
    $rng = [Security.Cryptography.RandomNumberGenerator]::Create()
    try { $rng.GetBytes($bytes) } finally { $rng.Dispose() }
    return ([BitConverter]::ToString($bytes) -replace '-', '').ToLowerInvariant()
}

$runtime = Read-EnvironmentFile (Resolve-WorkspaceFile $RuntimeEnvPath)
$admin = Read-EnvironmentFile (Resolve-WorkspaceFile $AdminEnvPath)
$roleManifest = Get-Content -LiteralPath (Resolve-WorkspaceFile $RoleManifestPath) -Raw | ConvertFrom-Json
$travelerRoles = @($roleManifest.roles | Where-Object { [string]$_.key -eq 'registered_traveler' })
if ($travelerRoles.Count -ne 1) { throw 'Registered traveler role is missing from the Phase 3 manifest.' }
$travelerRoleId = [string]$travelerRoles[0].id
$baseUrl = ([string]$runtime['DIRECTUS_PUBLIC_URL']).TrimEnd('/')
if ([string]::IsNullOrWhiteSpace($baseUrl)) { throw 'DIRECTUS_PUBLIC_URL is missing.' }

$login = Invoke-Api -Method Post -Uri "$baseUrl/auth/login" -Headers @{} -Body @{
    email = $admin['DIRECTUS_ADMIN_EMAIL']
    password = $admin['DIRECTUS_ADMIN_PASSWORD']
    mode = 'json'
}
if ([string]::IsNullOrWhiteSpace($login.data.access_token)) { throw 'Directus admin login failed.' }
$adminHeaders = @{ Authorization = "Bearer $($login.data.access_token)" }
$adminUser = Invoke-Api -Method Get -Uri "$baseUrl/users/me" -Headers $adminHeaders
$adminUserId = [string]$adminUser.data.id

$suffix = [Guid]::NewGuid().ToString('N')
$locationId = [Guid]::NewGuid().ToString()
$locationKey = "phase4-test-location-$suffix"
$userIds = [System.Collections.Generic.List[string]]::new()
$favoriteIds = [System.Collections.Generic.List[string]]::new()
$savedRouteIds = [System.Collections.Generic.List[string]]::new()
$userAToken = New-RandomToken
$userBToken = New-RandomToken
$userAHeaders = @{ Authorization = "Bearer $userAToken" }
$userBHeaders = @{ Authorization = "Bearer $userBToken" }

Push-Location $workspaceRoot
try {
    foreach ($fixture in @(
        @{ Email = "phase4-a-$suffix@example.com"; Token = $userAToken },
        @{ Email = "phase4-b-$suffix@example.com"; Token = $userBToken }
    )) {
        $created = Invoke-Api -Method Post -Uri "$baseUrl/users" -Headers $adminHeaders -Body @{
            email = $fixture.Email
            first_name = 'Phase4'
            last_name = 'Ephemeral'
            status = 'active'
            provider = 'default'
            role = $travelerRoleId
            token = $fixture.Token
        }
        $fixtureId = [string]$created.data.id
        if ($fixtureId -notmatch '^[0-9a-fA-F-]{36}$') { throw 'Unable to create an ephemeral traveler fixture.' }
        $userIds.Add($fixtureId)
    }

    $locationSql = @"
BEGIN;
INSERT INTO locations (
    id, external_key, location_type, canonical_name, coordinates, status, user_created
) VALUES (
    '$locationId', '$locationKey', 'other', 'Phase 4 ephemeral permission fixture',
    ST_SetSRID(ST_MakePoint(0, 0), 4326), 'draft', '$adminUserId'
);
UPDATE locations SET status = 'review', submitted_by = '$adminUserId', submitted_at = CURRENT_TIMESTAMP WHERE id = '$locationId';
UPDATE locations SET status = 'approved', approved_by = '$adminUserId', approved_at = CURRENT_TIMESTAMP WHERE id = '$locationId';
UPDATE locations SET status = 'published', published_by = '$adminUserId', published_at = CURRENT_TIMESTAMP WHERE id = '$locationId';
COMMIT;
"@
    docker compose --env-file $RuntimeEnvPath exec -T database psql -q -v ON_ERROR_STOP=1 `
        -U $runtime['DB_USER'] -d $runtime['DB_DATABASE'] -c $locationSql
    if ($LASTEXITCODE -ne 0) { throw 'Unable to create the ephemeral location fixture.' }

    $visibleLocation = Invoke-Api -Method Get -Uri "$baseUrl/items/locations/$locationId" -Headers $userAHeaders
    if ([string]$visibleLocation.data.id -ne $locationId -or [string]$visibleLocation.data.status -ne 'published') {
        throw 'Traveler cannot read a published location.'
    }

    Invoke-Api -Method Post -Uri "$baseUrl/items/user_favorites" -Headers $userAHeaders -Body @{
        location_id = $locationId
        label = 'Ephemeral favorite'
    } | Out-Null
    $favoriteId = [string](docker compose --env-file $RuntimeEnvPath exec -T database psql -qAt -v ON_ERROR_STOP=1 `
        -U $runtime['DB_USER'] -d $runtime['DB_DATABASE'] -c "SELECT id FROM user_favorites WHERE owner_id = '$($userIds[0])';")
    $favoriteId = $favoriteId.Trim()
    $favoriteOwner = [string](docker compose --env-file $RuntimeEnvPath exec -T database psql -qAt -v ON_ERROR_STOP=1 `
        -U $runtime['DB_USER'] -d $runtime['DB_DATABASE'] -c "SELECT owner_id FROM user_favorites WHERE id = '$favoriteId';")
    if ($LASTEXITCODE -ne 0 -or $favoriteId -notmatch '^[0-9a-fA-F-]{36}$' -or $favoriteOwner.Trim() -ne $userIds[0]) {
        throw 'Favorite owner preset did not bind to the current traveler.'
    }
    $favoriteIds.Add($favoriteId)

    if ((Get-HttpStatus -Method Get -Uri "$baseUrl/items/user_favorites/$favoriteId" -Headers $userAHeaders) -ne 200) {
        throw 'Traveler cannot read its own favorite.'
    }
    $crossFavoriteList = @(Invoke-Api -Method Get -Uri "$baseUrl/items/user_favorites?limit=-1" -Headers $userBHeaders).data
    if ($crossFavoriteList.Count -ne 0) { throw 'Traveler can enumerate another traveler favorite.' }
    foreach ($status in @(
        (Get-HttpStatus -Method Get -Uri "$baseUrl/items/user_favorites/$favoriteId" -Headers $userBHeaders),
        (Get-HttpStatus -Method Patch -Uri "$baseUrl/items/user_favorites/$favoriteId" -Headers $userBHeaders -Body @{ label = 'Denied' }),
        (Get-HttpStatus -Method Delete -Uri "$baseUrl/items/user_favorites/$favoriteId" -Headers $userBHeaders)
    )) {
        if ($status -notin @(401, 403, 404)) { throw "Cross-user favorite access was allowed: status=$status" }
    }
    Invoke-Api -Method Patch -Uri "$baseUrl/items/user_favorites/$favoriteId" -Headers $userAHeaders -Body @{ label = 'Ephemeral favorite updated' } | Out-Null

    Invoke-Api -Method Post -Uri "$baseUrl/items/saved_routes" -Headers $userAHeaders -Body @{
        label = 'Ephemeral route'
        origin_coordinates = @{ type = 'Point'; coordinates = @(0.0, 0.0) }
        destination_coordinates = @{ type = 'Point'; coordinates = @(0.1, 0.1) }
    } | Out-Null
    $savedRouteId = [string](docker compose --env-file $RuntimeEnvPath exec -T database psql -qAt -v ON_ERROR_STOP=1 `
        -U $runtime['DB_USER'] -d $runtime['DB_DATABASE'] -c "SELECT id FROM saved_routes WHERE owner_id = '$($userIds[0])';")
    $savedRouteId = $savedRouteId.Trim()
    $savedRouteOwner = [string](docker compose --env-file $RuntimeEnvPath exec -T database psql -qAt -v ON_ERROR_STOP=1 `
        -U $runtime['DB_USER'] -d $runtime['DB_DATABASE'] -c "SELECT owner_id FROM saved_routes WHERE id = '$savedRouteId';")
    if ($LASTEXITCODE -ne 0 -or $savedRouteId -notmatch '^[0-9a-fA-F-]{36}$' -or $savedRouteOwner.Trim() -ne $userIds[0]) {
        throw 'Saved-route owner preset did not bind to the current traveler.'
    }
    $savedRouteIds.Add($savedRouteId)

    if ((Get-HttpStatus -Method Get -Uri "$baseUrl/items/saved_routes/$savedRouteId" -Headers $userAHeaders) -ne 200) {
        throw 'Traveler cannot read its own saved route.'
    }
    $crossRouteList = @(Invoke-Api -Method Get -Uri "$baseUrl/items/saved_routes?limit=-1" -Headers $userBHeaders).data
    if ($crossRouteList.Count -ne 0) { throw 'Traveler can enumerate another traveler saved route.' }
    foreach ($status in @(
        (Get-HttpStatus -Method Get -Uri "$baseUrl/items/saved_routes/$savedRouteId" -Headers $userBHeaders),
        (Get-HttpStatus -Method Patch -Uri "$baseUrl/items/saved_routes/$savedRouteId" -Headers $userBHeaders -Body @{ label = 'Denied' }),
        (Get-HttpStatus -Method Delete -Uri "$baseUrl/items/saved_routes/$savedRouteId" -Headers $userBHeaders)
    )) {
        if ($status -notin @(401, 403, 404)) { throw "Cross-user saved-route access was allowed: status=$status" }
    }
    Invoke-Api -Method Patch -Uri "$baseUrl/items/saved_routes/$savedRouteId" -Headers $userAHeaders -Body @{ label = 'Ephemeral route updated' } | Out-Null

    Invoke-Api -Method Delete -Uri "$baseUrl/items/user_favorites/$favoriteId" -Headers $userAHeaders | Out-Null
    Invoke-Api -Method Delete -Uri "$baseUrl/items/saved_routes/$savedRouteId" -Headers $userAHeaders | Out-Null
    $favoriteIds.Clear()
    $savedRouteIds.Clear()

    foreach ($userId in @($userIds)) {
        Invoke-Api -Method Delete -Uri "$baseUrl/users/$userId" -Headers $adminHeaders | Out-Null
    }
    $userIds.Clear()
    docker compose --env-file $RuntimeEnvPath exec -T database psql -q -v ON_ERROR_STOP=1 `
        -U $runtime['DB_USER'] -d $runtime['DB_DATABASE'] -c "DELETE FROM locations WHERE id = '$locationId';"
    if ($LASTEXITCODE -ne 0) { throw 'Unable to remove the ephemeral location fixture.' }

    $remaining = [string](docker compose --env-file $RuntimeEnvPath exec -T database psql -qAt -v ON_ERROR_STOP=1 `
        -U $runtime['DB_USER'] -d $runtime['DB_DATABASE'] `
        -c "SELECT (SELECT count(*) FROM locations WHERE id = '$locationId') + (SELECT count(*) FROM directus_users WHERE email LIKE 'phase4-%-$suffix@example.com') + (SELECT count(*) FROM user_favorites WHERE id = '$favoriteId') + (SELECT count(*) FROM saved_routes WHERE id = '$savedRouteId');")
    if ($LASTEXITCODE -ne 0 -or $remaining.Trim() -ne '0') { throw 'Ephemeral Phase 4 permission fixtures remain after cleanup.' }

    Write-Output 'PHASE4_BUSINESS_PERMISSION_TEST_OK published_location_read=true favorite_positive=true favorite_cross_user_denied=true saved_route_positive=true saved_route_cross_user_denied=true ephemeral_rows_remaining=0 secrets_printed=false'
}
finally {
    foreach ($favoriteId in @($favoriteIds)) {
        try { Invoke-Api -Method Delete -Uri "$baseUrl/items/user_favorites/$favoriteId" -Headers $adminHeaders | Out-Null } catch { }
    }
    foreach ($savedRouteId in @($savedRouteIds)) {
        try { Invoke-Api -Method Delete -Uri "$baseUrl/items/saved_routes/$savedRouteId" -Headers $adminHeaders | Out-Null } catch { }
    }
    foreach ($userId in @($userIds)) {
        try { Invoke-Api -Method Delete -Uri "$baseUrl/users/$userId" -Headers $adminHeaders | Out-Null } catch { }
    }
    try {
        docker compose --env-file $RuntimeEnvPath exec -T database psql -q -v ON_ERROR_STOP=1 `
            -U $runtime['DB_USER'] -d $runtime['DB_DATABASE'] -c "DELETE FROM locations WHERE id = '$locationId';" | Out-Null
    } catch { }
    if ($login.data.refresh_token) {
        try { Invoke-Api -Method Post -Uri "$baseUrl/auth/logout" -Headers $adminHeaders -Body @{ refresh_token = $login.data.refresh_token } | Out-Null } catch { }
    }
    Pop-Location
}
