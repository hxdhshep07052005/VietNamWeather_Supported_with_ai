param(
    [string]$RuntimeEnvPath = '.env.local',
    [string]$BootstrapEnvPath = '.env.bootstrap.local',
    [string]$AdminEnvPath = '.env.admin.local'
)

$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [Text.Encoding]::UTF8
$workspaceRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path

function Resolve-WorkspacePath {
    param([string]$Path)
    $fullPath = [IO.Path]::GetFullPath((Join-Path $workspaceRoot $Path))
    $workspacePrefix = $workspaceRoot.TrimEnd('\') + '\'
    if (-not $fullPath.StartsWith($workspacePrefix, [StringComparison]::OrdinalIgnoreCase)) {
        throw 'Credential path must remain inside the workspace.'
    }
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

function New-RandomBase64Url {
    param([ValidateRange(16, 128)][int]$ByteCount)
    $bytes = New-Object byte[] $ByteCount
    $generator = [Security.Cryptography.RandomNumberGenerator]::Create()
    try { $generator.GetBytes($bytes) }
    finally { $generator.Dispose() }
    return [Convert]::ToBase64String($bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_')
}

$runtimePath = Resolve-WorkspacePath $RuntimeEnvPath
$bootstrapPath = Resolve-WorkspacePath $BootstrapEnvPath
$adminPath = Resolve-WorkspacePath $AdminEnvPath
$pendingPath = "$adminPath.pending"
if (-not (Test-Path -LiteralPath $runtimePath)) { throw 'Runtime environment file is missing.' }
if (-not (Test-Path -LiteralPath $bootstrapPath)) { throw 'Bootstrap credential file is missing.' }
if (Test-Path -LiteralPath $adminPath) { throw 'Rotated local admin file already exists.' }
if (Test-Path -LiteralPath $pendingPath) { throw 'A pending admin recovery file already exists; resolve it before retrying.' }

$runtime = Read-EnvironmentFile $runtimePath
$bootstrap = Read-EnvironmentFile $bootstrapPath
$email = [string]$bootstrap['DIRECTUS_ADMIN_EMAIL']
$oldPassword = [string]$bootstrap['DIRECTUS_ADMIN_PASSWORD']
$newPassword = New-RandomBase64Url 32
$baseUri = "http://127.0.0.1:$($runtime['DIRECTUS_HOST_PORT'])"
$utf8NoBom = New-Object Text.UTF8Encoding -ArgumentList $false
$credentialText = "DIRECTUS_ADMIN_EMAIL=$email`nDIRECTUS_ADMIN_PASSWORD=$newPassword`n"

$passwordChanged = $false
try {
    [IO.File]::WriteAllText($pendingPath, $credentialText, $utf8NoBom)
    $login = Invoke-RestMethod -Method Post -Uri "$baseUri/auth/login" -ContentType 'application/json' -Body (@{ email = $email; password = $oldPassword } | ConvertTo-Json) -TimeoutSec 15
    if ([string]::IsNullOrWhiteSpace($login.data.access_token)) { throw 'Bootstrap login failed.' }

    Invoke-RestMethod -Method Patch -Uri "$baseUri/users/me" -Headers @{ Authorization = "Bearer $($login.data.access_token)" } -ContentType 'application/json' -Body (@{ password = $newPassword } | ConvertTo-Json) -TimeoutSec 15 | Out-Null
    $passwordChanged = $true

    $verification = Invoke-RestMethod -Method Post -Uri "$baseUri/auth/login" -ContentType 'application/json' -Body (@{ email = $email; password = $newPassword } | ConvertTo-Json) -TimeoutSec 15
    if ([string]::IsNullOrWhiteSpace($verification.data.access_token)) { throw 'Rotated admin login verification failed.' }

    $oldCredentialRejected = $false
    try {
        Invoke-RestMethod -Method Post -Uri "$baseUri/auth/login" -ContentType 'application/json' -Body (@{ email = $email; password = $oldPassword } | ConvertTo-Json) -TimeoutSec 15 | Out-Null
    }
    catch {
        if ($_.Exception.Response -and [int]$_.Exception.Response.StatusCode -in @(400, 401, 403)) {
            $oldCredentialRejected = $true
        }
        else { throw }
    }
    if (-not $oldCredentialRejected) { throw 'Bootstrap credential remained valid after rotation.' }

    Move-Item -LiteralPath $pendingPath -Destination $adminPath
    Remove-Item -LiteralPath $bootstrapPath
    Write-Output 'LOCAL_ADMIN_ROTATION_OK bootstrap_removed=true old_credential_rejected=true secrets_printed=false'
}
catch {
    if (-not $passwordChanged -and (Test-Path -LiteralPath $pendingPath)) {
        Remove-Item -LiteralPath $pendingPath -Force
    }
    throw
}
