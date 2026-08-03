param(
    [string]$RuntimeEnvPath = '.env.local',
    [switch]$Apply,
    [switch]$ConfirmPurge
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

function Read-PositiveInteger {
    param([hashtable]$Values, [string]$Name)
    $parsed = 0
    if (-not [int]::TryParse([string]$Values[$Name], [ref]$parsed) -or $parsed -lt 1) {
        throw "Retention value must be a positive integer: $Name"
    }
    return $parsed
}

if ($Apply -and -not $ConfirmPurge) {
    throw 'Retention deletion requires both -Apply and -ConfirmPurge.'
}
if ($ConfirmPurge -and -not $Apply) {
    throw '-ConfirmPurge is only valid together with -Apply.'
}

$runtimePath = [IO.Path]::GetFullPath((Join-Path $workspaceRoot $RuntimeEnvPath))
if (-not (Test-Path -LiteralPath $runtimePath -PathType Leaf)) { throw 'Runtime environment file is missing.' }
$runtime = Read-EnvironmentFile $runtimePath
$sessionDays = Read-PositiveInteger $runtime 'SECURITY_SESSION_RETENTION_DAYS'
$auditMonths = Read-PositiveInteger $runtime 'SECURITY_AUDIT_RETENTION_MONTHS'
if ([string]$runtime['API_DB_USER'] -notmatch '^[a-zA-Z0-9_]+$') { throw 'API_DB_USER has an invalid format.' }

$previewSql = @"
WITH cutoffs AS (
    SELECT CURRENT_TIMESTAMP - make_interval(days => $sessionDays) AS session_cutoff,
           CURRENT_TIMESTAMP - make_interval(months => $auditMonths) AS audit_cutoff
)
SELECT (
           SELECT COUNT(*)
             FROM app_security.sessions, cutoffs
            WHERE (revoked_at IS NOT NULL AND revoked_at < cutoffs.session_cutoff)
               OR (revoked_at IS NULL AND expires_at < cutoffs.session_cutoff)
       )::text
       || '|'
       || (
           SELECT COUNT(*)
             FROM app_security.audit_events, cutoffs
            WHERE created_at < cutoffs.audit_cutoff
       )::text
       || '|'
       || has_function_privilege(
              '$($runtime['API_DB_USER'])',
              'app_security.purge_retained_security_data(timestamptz,timestamptz)',
              'EXECUTE'
          )::text;
"@

$applySql = @"
SELECT deleted_sessions::text || '|' || deleted_audit_events::text
  FROM app_security.purge_retained_security_data(
      CURRENT_TIMESTAMP - make_interval(days => $sessionDays),
      CURRENT_TIMESTAMP - make_interval(months => $auditMonths)
  );
"@

Push-Location $workspaceRoot
try {
    $containerId = (docker compose --env-file $RuntimeEnvPath ps -q database).Trim()
    if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($containerId)) {
        throw 'Database container is not running.'
    }

    $preview = docker compose --env-file $RuntimeEnvPath exec -T database psql -At -v ON_ERROR_STOP=1 `
        -U $runtime['DB_USER'] -d $runtime['DB_DATABASE'] -c $previewSql
    if ($LASTEXITCODE -ne 0) { throw 'Unable to preview retained security data.' }
    $previewParts = @(([string]$preview).Trim() -split '\|')
    if ($previewParts.Count -ne 3) { throw 'Unexpected retention preview result.' }
    if ($previewParts[2] -ne 'false') { throw 'Application API database role can execute the retention purge function.' }

    if (-not $Apply) {
        Write-Output "SECURITY_RETENTION_PREVIEW_OK sessions=$($previewParts[0]) audit_events=$($previewParts[1]) api_execute=false secrets_printed=false"
        return
    }

    $result = docker compose --env-file $RuntimeEnvPath exec -T database psql -At -v ON_ERROR_STOP=1 `
        -U $runtime['DB_USER'] -d $runtime['DB_DATABASE'] -c $applySql
    if ($LASTEXITCODE -ne 0) { throw 'Security retention purge failed.' }
    $resultParts = @(([string]$result).Trim() -split '\|')
    if ($resultParts.Count -ne 2) { throw 'Unexpected retention purge result.' }
    Write-Output "SECURITY_RETENTION_PURGE_OK sessions=$($resultParts[0]) audit_events=$($resultParts[1]) api_execute=false secrets_printed=false"
}
finally {
    Pop-Location
}
