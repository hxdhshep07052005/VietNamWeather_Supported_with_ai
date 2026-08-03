param(
    [string]$RuntimeEnvPath = '.env.local',
    [string]$AdminEnvPath = '.env.admin.local',
    [string]$ManifestPath = 'apps/directus/security/phase3-default-deny.json'
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
    $params = @{ Method = $Method; Uri = $Uri; Headers = $Headers; TimeoutSec = 20 }
    if ($null -ne $Body) {
        $params.ContentType = 'application/json'
        $params.Body = ($Body | ConvertTo-Json -Depth 20 -Compress)
    }
    return Invoke-RestMethod @params
}

function Get-StatusCode {
    param([string]$Uri, [hashtable]$Headers = @{})
    try {
        $response = Invoke-WebRequest -UseBasicParsing -Method Get -Uri $Uri -Headers $Headers -TimeoutSec 20
        return [int]$response.StatusCode
    }
    catch {
        if ($_.Exception.Response) { return [int]$_.Exception.Response.StatusCode }
        throw
    }
}

function Get-WriteStatusCode {
    param([string]$Method, [string]$Uri, [hashtable]$Headers, [hashtable]$Body)
    try {
        $response = Invoke-WebRequest -UseBasicParsing -Method $Method -Uri $Uri -Headers $Headers -TimeoutSec 20 `
            -ContentType 'application/json' -Body ($Body | ConvertTo-Json -Depth 10 -Compress)
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

$manifest = Get-Content -LiteralPath (Resolve-WorkspaceFile $ManifestPath) -Raw | ConvertFrom-Json
$roles = @($manifest.roles)
$runtime = Read-EnvironmentFile (Resolve-WorkspaceFile $RuntimeEnvPath)
$admin = Read-EnvironmentFile (Resolve-WorkspaceFile $AdminEnvPath)
$baseUrl = ([string]$runtime['DIRECTUS_PUBLIC_URL']).TrimEnd('/')
$login = Invoke-Api -Method Post -Uri "$baseUrl/auth/login" -Headers @{} -Body @{
    email = $admin['DIRECTUS_ADMIN_EMAIL']
    password = $admin['DIRECTUS_ADMIN_PASSWORD']
    mode = 'json'
}
if ([string]::IsNullOrWhiteSpace($login.data.access_token)) { throw 'Directus admin login failed.' }
$adminHeaders = @{ Authorization = "Bearer $($login.data.access_token)" }
$adminMe = Invoke-Api -Method Get -Uri "$baseUrl/users/me" -Headers $adminHeaders
$adminUserId = [string]$adminMe.data.id
$adminRoleId = if ($adminMe.data.role -is [pscustomobject]) { [string]$adminMe.data.role.id } else { [string]$adminMe.data.role }
if ([string]::IsNullOrWhiteSpace($adminUserId) -or [string]::IsNullOrWhiteSpace($adminRoleId)) { throw 'Unable to resolve the protected admin identity.' }
$fixtureIds = [System.Collections.Generic.List[string]]::new()
$anonymousDenied = 0
$roleDenied = 0
$staffSelfMetadata = 0
$staffTfaBoundaryChecks = 0
$anonymousEndpoints = @(
    '/users?limit=1',
    '/roles?limit=1',
    '/policies?limit=1',
    '/permissions?limit=1',
    '/access?limit=1',
    '/items/directus_users?limit=1'
)
$alwaysDeniedEndpoints = @(
    '/policies?limit=1',
    '/permissions?limit=1',
    '/access?limit=1',
    '/items/directus_users?limit=1',
    "/users/$adminUserId",
    "/roles/$adminRoleId"
)

try {
    foreach ($endpoint in $anonymousEndpoints) {
        $status = Get-StatusCode -Uri "$baseUrl$endpoint"
        if ($status -notin @(401, 403, 404)) { throw "Anonymous access unexpectedly allowed: $endpoint status=$status" }
        $anonymousDenied++
    }

    foreach ($entry in $roles) {
        $fixtureEmail = "p3$([guid]::NewGuid().ToString('N'))@example.com"
        $fixtureToken = New-RandomToken
        $fixture = Invoke-Api -Method Post -Uri "$baseUrl/users" -Headers $adminHeaders -Body @{
            email = $fixtureEmail
            first_name = 'Phase3'
            last_name = 'Ephemeral'
            status = 'active'
            provider = 'default'
            role = [string]$entry.id
            token = $fixtureToken
        }
        $fixtureId = [string]$fixture.data.id
        if ([string]::IsNullOrWhiteSpace($fixtureId)) { throw "Unable to create ephemeral fixture for $($entry.key)." }
        $fixtureIds.Add($fixtureId)
        $headers = @{ Authorization = "Bearer $fixtureToken" }
        foreach ($endpoint in $alwaysDeniedEndpoints) {
            $status = Get-StatusCode -Uri "$baseUrl$endpoint" -Headers $headers
            if ($status -notin @(401, 403, 404)) { throw "Managed role unexpectedly allowed restricted access: role=$($entry.key) endpoint=$endpoint status=$status" }
            $roleDenied++
        }
        if ([bool]$entry.policy.appAccess) {
            $selfUsersResponse = Invoke-Api -Method Get -Uri "$baseUrl/users?limit=-1" -Headers $headers
            $selfUsers = @($selfUsersResponse.data)
            if ($selfUsers.Count -ne 1 -or [string]$selfUsers[0].id -ne $fixtureId) {
                throw "Studio role can enumerate users beyond itself: role=$($entry.key)"
            }
            if ($null -ne $selfUsers[0].password -or $null -ne $selfUsers[0].tfa_secret -or
                $selfUsers[0].PSObject.Properties.Name -contains 'token' -or
                $selfUsers[0].PSObject.Properties.Name -contains 'auth_data') {
                throw "Studio self metadata exposes a credential field: role=$($entry.key)"
            }
            $ownRolesResponse = Invoke-Api -Method Get -Uri "$baseUrl/roles?limit=-1" -Headers $headers
            $ownRoles = @($ownRolesResponse.data)
            if ($ownRoles.Count -ne 1 -or [string]$ownRoles[0].id -ne [string]$entry.id) {
                throw "Studio role can enumerate roles beyond itself: role=$($entry.key)"
            }
            $staffSelfMetadata += 2

            $manualTfaStatus = Get-WriteStatusCode -Method Patch -Uri "$baseUrl/users/$fixtureId" -Headers $headers -Body @{
                tfa_secret = New-RandomToken
            }
            if ($manualTfaStatus -ne 400) {
                throw "Studio role bypassed the verified TFA enrollment endpoint: role=$($entry.key) status=$manualTfaStatus"
            }
            $staffTfaBoundaryChecks++

            $roleMutationStatus = Get-WriteStatusCode -Method Patch -Uri "$baseUrl/users/$fixtureId" -Headers $headers -Body @{
                role = [string]$entry.id
            }
            if ($roleMutationStatus -notin @(401, 403, 404)) {
                throw "Studio role can mutate its own authorization fields: role=$($entry.key) status=$roleMutationStatus"
            }
            $staffTfaBoundaryChecks++

            $crossUserTfaStatus = Get-WriteStatusCode -Method Patch -Uri "$baseUrl/users/$adminUserId" -Headers $headers -Body @{
                tfa_secret = New-RandomToken
            }
            if ($crossUserTfaStatus -notin @(401, 403, 404)) {
                throw "Studio role can mutate another user's TFA state: role=$($entry.key) status=$crossUserTfaStatus"
            }
            $staffTfaBoundaryChecks++
        }
        else {
            foreach ($endpoint in @('/users?limit=-1', '/roles?limit=-1')) {
                $status = Get-StatusCode -Uri "$baseUrl$endpoint" -Headers $headers
                if ($status -notin @(401, 403, 404)) { throw "Non-Studio role unexpectedly received system metadata: role=$($entry.key) endpoint=$endpoint status=$status" }
                $roleDenied++
            }
        }
        Invoke-Api -Method Delete -Uri "$baseUrl/users/$fixtureId" -Headers $adminHeaders | Out-Null
    }

    foreach ($fixtureId in $fixtureIds) {
        try { Invoke-Api -Method Delete -Uri "$baseUrl/users/$fixtureId" -Headers $adminHeaders | Out-Null } catch { }
    }

    $fixtureIdSql = (@($fixtureIds | ForEach-Object { "'$([string]$_)'::uuid" })) -join ','
    $remaining = docker compose --env-file $RuntimeEnvPath exec -T database psql -qAt -v ON_ERROR_STOP=1 -U $runtime['DB_USER'] -d $runtime['DB_DATABASE'] -c "SELECT count(*) FROM directus_users WHERE id IN ($fixtureIdSql);"
    if ($LASTEXITCODE -ne 0) { throw 'Unable to verify ephemeral fixture cleanup.' }
    $remaining = [int]([string]$remaining).Trim()
    if ($remaining -ne 0) { throw 'Ephemeral security fixtures remain after cleanup.' }
    Write-Output "DIRECTUS_NEGATIVE_PERMISSION_TEST_OK roles=$($roles.Count) restricted_endpoints=$($alwaysDeniedEndpoints.Count) anonymous_denials=$anonymousDenied role_denials=$roleDenied staff_self_metadata_checks=$staffSelfMetadata staff_tfa_boundary_checks=$staffTfaBoundaryChecks ephemeral_users_remaining=0 secrets_printed=false"
}
finally {
    foreach ($fixtureId in $fixtureIds) {
        try { Invoke-Api -Method Delete -Uri "$baseUrl/users/$fixtureId" -Headers $adminHeaders | Out-Null } catch { }
    }
    if ($login.data.refresh_token) {
        try { Invoke-Api -Method Post -Uri "$baseUrl/auth/logout" -Headers $adminHeaders -Body @{ refresh_token = $login.data.refresh_token } | Out-Null } catch { }
    }
}
