param([string]$RuntimeEnvPath = '.env.local')

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

function Get-Sha256Hex {
    param([string]$Value)
    $bytes = [Text.Encoding]::UTF8.GetBytes($Value)
    $algorithm = [Security.Cryptography.SHA256]::Create()
    try {
        $hash = $algorithm.ComputeHash($bytes)
    }
    finally {
        $algorithm.Dispose()
    }
    return [BitConverter]::ToString($hash).Replace('-', '').ToLowerInvariant()
}

$runtime = Read-EnvironmentFile (Join-Path $workspaceRoot $RuntimeEnvPath)
$sessionDays = 0
$auditMonths = 0
if (-not [int]::TryParse([string]$runtime['SECURITY_SESSION_RETENTION_DAYS'], [ref]$sessionDays) -or $sessionDays -lt 1) {
    throw 'SECURITY_SESSION_RETENTION_DAYS must be a positive integer.'
}
if (-not [int]::TryParse([string]$runtime['SECURITY_AUDIT_RETENTION_MONTHS'], [ref]$auditMonths) -or $auditMonths -lt 1) {
    throw 'SECURITY_AUDIT_RETENTION_MONTHS must be a positive integer.'
}
if ([string]$runtime['API_DB_USER'] -notmatch '^[a-zA-Z0-9_]+$') { throw 'API_DB_USER has an invalid format.' }

$userId = [Guid]::NewGuid().ToString()
$roleId = [Guid]::NewGuid().ToString()
$familyOld = [Guid]::NewGuid().ToString()
$familyRecent = [Guid]::NewGuid().ToString()
$oldHash = Get-Sha256Hex ([Guid]::NewGuid().ToString())
$recentHash = Get-Sha256Hex ([Guid]::NewGuid().ToString())
$correlationOld = "retention-old-$([Guid]::NewGuid().ToString('N'))"
$correlationRecent = "retention-recent-$([Guid]::NewGuid().ToString('N'))"

$sql = @"
BEGIN;

DO `$guard`$
DECLARE
    future_cutoff_rejected boolean := false;
BEGIN
    BEGIN
        PERFORM * FROM app_security.purge_retained_security_data(
            CURRENT_TIMESTAMP + interval '1 day',
            CURRENT_TIMESTAMP
        );
    EXCEPTION WHEN OTHERS THEN
        future_cutoff_rejected := true;
    END;
    IF NOT future_cutoff_rejected THEN
        RAISE EXCEPTION 'Future retention cutoff was accepted';
    END IF;
END
`$guard`$;

INSERT INTO app_security.sessions (
    session_id_hash, session_family_id, user_id, role_id,
    directus_access_token_ciphertext, directus_refresh_token_ciphertext,
    access_token_expires_at, created_at, last_seen_at, expires_at,
    revoked_at, revoke_reason
) VALUES
(
    '$oldHash', '$familyOld', '$userId', '$roleId',
    'v1.retention-test', 'v1.retention-test',
    CURRENT_TIMESTAMP - make_interval(days => $sessionDays + 2),
    CURRENT_TIMESTAMP - make_interval(days => $sessionDays + 3),
    CURRENT_TIMESTAMP - make_interval(days => $sessionDays + 3),
    CURRENT_TIMESTAMP - make_interval(days => $sessionDays + 2),
    CURRENT_TIMESTAMP - make_interval(days => $sessionDays + 1),
    'retention_test'
),
(
    '$recentHash', '$familyRecent', '$userId', '$roleId',
    'v1.retention-test', 'v1.retention-test',
    CURRENT_TIMESTAMP + interval '1 hour',
    CURRENT_TIMESTAMP - interval '1 hour',
    CURRENT_TIMESTAMP - interval '1 hour',
    CURRENT_TIMESTAMP + interval '1 day',
    NULL,
    NULL
);

INSERT INTO app_security.audit_events (
    event_type, result, actor_user_id, session_family_id, correlation_id, created_at
) VALUES
('retention.test', 'success', '$userId', '$familyOld', '$correlationOld', CURRENT_TIMESTAMP - make_interval(months => $auditMonths + 1)),
('retention.test', 'success', '$userId', '$familyRecent', '$correlationRecent', CURRENT_TIMESTAMP);

DO `$test`$
DECLARE
    purged record;
    retained_sessions bigint;
    retained_audits bigint;
BEGIN
    SELECT * INTO purged
      FROM app_security.purge_retained_security_data(
          CURRENT_TIMESTAMP - make_interval(days => $sessionDays),
          CURRENT_TIMESTAMP - make_interval(months => $auditMonths)
      );
    IF purged.deleted_sessions <> 1 OR purged.deleted_audit_events <> 1 THEN
        RAISE EXCEPTION 'Unexpected purge counts: sessions=%, audits=%', purged.deleted_sessions, purged.deleted_audit_events;
    END IF;

    SELECT COUNT(*) INTO retained_sessions
      FROM app_security.sessions
     WHERE session_id_hash = '$recentHash';
    SELECT COUNT(*) INTO retained_audits
      FROM app_security.audit_events
     WHERE correlation_id = '$correlationRecent';
    IF retained_sessions <> 1 OR retained_audits <> 1 THEN
        RAISE EXCEPTION 'Retention purge removed in-policy records';
    END IF;
END
`$test`$;

SELECT CASE
    WHEN (
        SELECT COUNT(*)
          FROM pg_trigger
         WHERE tgname = 'app_security_revoke_sessions_on_identity_change'
           AND NOT tgisinternal
    ) = 1
    AND NOT has_function_privilege(
        '$($runtime['API_DB_USER'])',
        'app_security.purge_retained_security_data(timestamptz,timestamptz)',
        'EXECUTE'
    )
    THEN 'PHASE3_SECURITY_RETENTION_DB_TEST_OK identity_trigger=true old_rows_purged=true recent_rows_retained=true future_cutoff_denied=true api_execute=false fixtures_rolled_back=true secrets_printed=false'
    ELSE 'PHASE3_SECURITY_RETENTION_DB_TEST_FAILED'
END;

ROLLBACK;
"@

Push-Location $workspaceRoot
try {
    $containerId = (docker compose --env-file $RuntimeEnvPath ps -q database).Trim()
    if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($containerId)) {
        throw 'Database container is not running.'
    }
    $result = docker compose --env-file $RuntimeEnvPath exec -T database psql -At -v ON_ERROR_STOP=1 `
        -U $runtime['DB_USER'] -d $runtime['DB_DATABASE'] -c $sql
    if ($LASTEXITCODE -ne 0) { throw 'Phase 3 security retention database test failed.' }
    $marker = @($result | Where-Object { $_ -like 'PHASE3_SECURITY_RETENTION_DB_TEST_*' })
    if ($marker.Count -ne 1 -or $marker[0] -notlike 'PHASE3_SECURITY_RETENTION_DB_TEST_OK*') {
        throw 'Phase 3 security retention database marker is missing or invalid.'
    }
    Write-Output $marker[0]
}
finally {
    Pop-Location
}
