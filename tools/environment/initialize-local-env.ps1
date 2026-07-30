param(
    [Parameter(Mandatory = $true)]
    [ValidatePattern('^[^\s@]+@[^\s@]+\.[^\s@]+$')]
    [string]$AdminEmail,

    [string]$RuntimeEnvPath = '.env.local',
    [string]$BootstrapEnvPath = '.env.bootstrap.local',

    [ValidateRange(1, 65535)]
    [int]$DirectusHostPort = 8055,

    [ValidateRange(1, 65535)]
    [int]$WorkerHostPort = 8081,

    [ValidateRange(1, 65535)]
    [int]$MailpitSmtpHostPort = 1025,

    [ValidateRange(1, 65535)]
    [int]$MailpitUiHostPort = 8025,

    [switch]$Force
)

$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [Text.Encoding]::UTF8

$workspaceRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path

function Resolve-WorkspaceOutputPath {
    param([string]$Path)

    $fullPath = [IO.Path]::GetFullPath((Join-Path $workspaceRoot $Path))
    $workspacePrefix = $workspaceRoot.TrimEnd('\') + '\'
    if (-not $fullPath.StartsWith($workspacePrefix, [StringComparison]::OrdinalIgnoreCase)) {
        throw 'Environment output path must remain inside the workspace.'
    }
    return $fullPath
}

function New-RandomBase64Url {
    param([ValidateRange(16, 128)][int]$ByteCount)

    $bytes = New-Object byte[] $ByteCount
    $generator = [Security.Cryptography.RandomNumberGenerator]::Create()
    try {
        $generator.GetBytes($bytes)
    }
    finally {
        $generator.Dispose()
    }
    return [Convert]::ToBase64String($bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_')
}

$runtimePath = Resolve-WorkspaceOutputPath $RuntimeEnvPath
$bootstrapPath = Resolve-WorkspaceOutputPath $BootstrapEnvPath
foreach ($path in @($runtimePath, $bootstrapPath)) {
    if ((Test-Path -LiteralPath $path) -and -not $Force) {
        throw 'A local environment file already exists. Use -Force only after confirming rotation/overwrite intent.'
    }
}

$runtimeValues = [ordered]@{
    COMPOSE_PROJECT_NAME = 'vietnam_weather_local'
    APP_ENV = 'local'
    DIRECTUS_HOST_PORT = $DirectusHostPort
    WORKER_HOST_PORT = $WorkerHostPort
    MAILPIT_SMTP_HOST_PORT = $MailpitSmtpHostPort
    MAILPIT_UI_HOST_PORT = $MailpitUiHostPort
    DB_DATABASE = 'directus'
    DB_USER = 'directus'
    DB_PASSWORD = New-RandomBase64Url 32
    REDIS_PASSWORD = New-RandomBase64Url 32
    DIRECTUS_KEY = New-RandomBase64Url 32
    DIRECTUS_SECRET = New-RandomBase64Url 64
    DIRECTUS_PUBLIC_URL = "http://localhost:$DirectusHostPort"
    DIRECTUS_EMAIL_FROM = 'noreply@localhost.invalid'
    WORKER_SERVICE_NAME = 'integration-worker'
    WORKER_PORT = 8081
}

$bootstrapValues = [ordered]@{
    DIRECTUS_ADMIN_EMAIL = $AdminEmail
    DIRECTUS_ADMIN_PASSWORD = New-RandomBase64Url 24
}

function ConvertTo-EnvironmentText {
    param([Collections.IDictionary]$Values)
    return (($Values.GetEnumerator() | ForEach-Object { "$($_.Key)=$($_.Value)" }) -join "`n") + "`n"
}

$utf8NoBom = New-Object Text.UTF8Encoding -ArgumentList $false
[IO.File]::WriteAllText($runtimePath, (ConvertTo-EnvironmentText $runtimeValues), $utf8NoBom)
[IO.File]::WriteAllText($bootstrapPath, (ConvertTo-EnvironmentText $bootstrapValues), $utf8NoBom)

Write-Output 'LOCAL_ENV_INITIALIZED runtime=.env.local bootstrap=.env.bootstrap.local secrets_printed=false'
