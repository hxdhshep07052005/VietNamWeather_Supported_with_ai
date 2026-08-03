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

function Invoke-Directus {
    param(
        [string]$Method,
        [string]$Uri,
        [hashtable]$Headers,
        [object]$Body = $null
    )
    $params = @{ Method = $Method; Uri = $Uri; Headers = $Headers; TimeoutSec = 20 }
    if ($null -ne $Body) {
        $params.ContentType = 'application/json'
        $params.Body = ($Body | ConvertTo-Json -Depth 20 -Compress)
    }
    return Invoke-RestMethod @params
}

$runtimePath = Join-Path $workspaceRoot $RuntimeEnvPath
$adminPath = Join-Path $workspaceRoot $AdminEnvPath
$manifestPath = Join-Path $workspaceRoot $ManifestPath
if (-not (Test-Path -LiteralPath $runtimePath -PathType Leaf)) { throw "Missing runtime environment: $RuntimeEnvPath" }
if (-not (Test-Path -LiteralPath $adminPath -PathType Leaf)) { throw "Missing admin environment: $AdminEnvPath" }
if (-not (Test-Path -LiteralPath $manifestPath -PathType Leaf)) { throw "Missing security manifest: $ManifestPath" }

$runtime = Read-EnvironmentFile $runtimePath
$admin = Read-EnvironmentFile $adminPath
$manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
$travelerRoles = @($manifest.roles | Where-Object key -eq 'registered_traveler')
if ($travelerRoles.Count -ne 1) { throw 'Registered Traveler role is missing or duplicated.' }
$travelerRoleId = [string]$travelerRoles[0].id
$baseUrl = ([string]$runtime['DIRECTUS_PUBLIC_URL']).TrimEnd('/')
if ([string]::IsNullOrWhiteSpace($baseUrl)) { throw 'DIRECTUS_PUBLIC_URL is missing.' }

$login = $null
try {
    $login = Invoke-Directus -Method Post -Uri "$baseUrl/auth/login" -Headers @{} -Body @{
        email = $admin['DIRECTUS_ADMIN_EMAIL']
        password = $admin['DIRECTUS_ADMIN_PASSWORD']
        mode = 'json'
    }
    $headers = @{ Authorization = "Bearer $($login.data.access_token)" }
    $current = (Invoke-Directus -Method Get -Uri "$baseUrl/settings?fields=public_registration,public_registration_verify_email,public_registration_role" -Headers $headers).data
    $currentRole = if ($current.public_registration_role -is [pscustomobject]) { [string]$current.public_registration_role.id } else { [string]$current.public_registration_role }
    $changed = (-not [bool]$current.public_registration) -or (-not [bool]$current.public_registration_verify_email) -or ($currentRole -ne $travelerRoleId)
    if ($changed -and $Apply) {
        Invoke-Directus -Method Patch -Uri "$baseUrl/settings" -Headers $headers -Body @{
            public_registration = $true
            public_registration_verify_email = $true
            public_registration_role = $travelerRoleId
        } | Out-Null
        $current = (Invoke-Directus -Method Get -Uri "$baseUrl/settings?fields=public_registration,public_registration_verify_email,public_registration_role" -Headers $headers).data
        $currentRole = if ($current.public_registration_role -is [pscustomobject]) { [string]$current.public_registration_role.id } else { [string]$current.public_registration_role }
        $changed = (-not [bool]$current.public_registration) -or (-not [bool]$current.public_registration_verify_email) -or ($currentRole -ne $travelerRoleId)
    }
    if ($changed) { throw 'Directus public registration settings are not at the approved Phase 3 baseline.' }
    $mode = if ($Apply) { 'apply' } else { 'inspect' }
    Write-Output "DIRECTUS_REGISTRATION_POLICY_OK mode=$mode public_registration=true verify_email=true role_configured=true secrets_printed=false"
}
finally {
    if ($null -ne $login -and $login.data.refresh_token) {
        try { Invoke-Directus -Method Post -Uri "$baseUrl/auth/logout" -Headers @{} -Body @{ refresh_token = $login.data.refresh_token; mode = 'json' } | Out-Null } catch {}
    }
}
