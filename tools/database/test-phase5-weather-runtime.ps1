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

function New-Id { return [Guid]::NewGuid().ToString() }

$runtimePath = [IO.Path]::GetFullPath((Join-Path $workspaceRoot $RuntimeEnvPath))
if (-not (Test-Path -LiteralPath $runtimePath -PathType Leaf)) { throw 'Runtime environment file is missing.' }
$runtime = Read-EnvironmentFile $runtimePath
foreach ($name in @('DB_USER', 'DB_DATABASE', 'API_DB_USER')) {
    if ([string]$runtime[$name] -notmatch '^[A-Za-z0-9_]+$') { throw "Database environment value has an invalid format: $name" }
}
$workerLogin = [string]$runtime['WEATHER_WORKER_DB_USER']
if ($workerLogin -and $workerLogin -notmatch '^[A-Za-z0-9_]+$') {
    throw 'WEATHER_WORKER_DB_USER has an invalid format.'
}

$providerId = New-Id
$locationId = New-Id
$suffix = [Guid]::NewGuid().ToString('N')
$retryKey = "phase5-retry-$suffix"
$persistKey = "phase5-persist-$suffix"
$failedKey = "phase5-failed-$suffix"
$observationKey = "phase5-observation-$suffix"
$forecastKey = "phase5-forecast-$suffix"
$atomicKey = "phase5-atomic-$suffix"
$oldObservationKey = "phase5-old-observation-$suffix"
$oldForecastKey = "phase5-old-forecast-$suffix"
$workerLoginSql = if ($workerLogin) { "'$workerLogin'" } else { 'NULL' }

$sql = @"
BEGIN;

INSERT INTO public.weather_providers (
    id, external_key, display_name, base_url, credential_reference,
    terms_url, attribution_text, capabilities, status
) VALUES (
    '$providerId', 'phase5-provider-$suffix', 'Phase 5 ephemeral provider',
    'https://phase5.example.invalid', 'env:PHASE5_TEST_CREDENTIAL',
    'https://phase5.example.invalid/terms', 'Phase 5 test attribution',
    jsonb_build_object('current', true, 'hourly', true, 'daily', true), 'active'
);

INSERT INTO public.locations (
    id, external_key, location_type, canonical_name, coordinates, timezone, status
) VALUES (
    '$locationId', 'phase5-location-$suffix', 'city_center', 'Phase 5 ephemeral location',
    public.ST_SetSRID(public.ST_MakePoint(106.700000, 10.775000), 4326),
    'Asia/Ho_Chi_Minh', 'draft'
);

CREATE TEMP TABLE phase5_enqueue_result (
    run_id uuid,
    run_status varchar(32),
    inserted boolean
) ON COMMIT DROP;
GRANT ALL ON phase5_enqueue_result TO app_weather_api;

SET LOCAL ROLE app_weather_api;
INSERT INTO phase5_enqueue_result
SELECT * FROM app_weather.enqueue_weather_run(
    '$providerId', '$retryKey', 'bundle', 'phase5-test-v1', '$locationId',
    NULL, NULL, 2, '1900-01-01 00:00:00+00', jsonb_build_object('correlation_id', 'phase5-test')
);
INSERT INTO phase5_enqueue_result
SELECT * FROM app_weather.enqueue_weather_run(
    '$providerId', '$retryKey', 'bundle', 'phase5-test-v1', '$locationId',
    NULL, NULL, 2, '1900-01-01 00:00:00+00', jsonb_build_object('correlation_id', 'phase5-test')
);
RESET ROLE;

DO `$test`$
BEGIN
    IF (SELECT COUNT(*) FROM phase5_enqueue_result) <> 2 OR
       (SELECT COUNT(DISTINCT run_id) FROM phase5_enqueue_result) <> 1 OR
       (SELECT COUNT(*) FROM phase5_enqueue_result WHERE inserted) <> 1 OR
       (SELECT COUNT(*) FROM phase5_enqueue_result WHERE NOT inserted) <> 1 OR
       (SELECT COUNT(*) FROM public.provider_runs WHERE provider_id = '$providerId' AND idempotency_key = '$retryKey') <> 1 THEN
        RAISE EXCEPTION 'Idempotent weather enqueue did not return one durable run';
    END IF;
END
`$test`$;

CREATE TEMP TABLE phase5_claim_result (
    run_id uuid,
    provider_id uuid,
    provider_key varchar(128),
    provider_base_url text,
    credential_reference varchar(255),
    request_kind varchar(32),
    target_location_id uuid,
    target_longitude double precision,
    target_latitude double precision,
    parser_version varchar(128),
    attempt_count integer,
    max_attempts integer,
    lease_token uuid,
    lease_expires_at timestamptz,
    sanitized_metadata jsonb
) ON COMMIT DROP;
GRANT ALL ON phase5_claim_result TO app_weather_worker;

SET LOCAL ROLE app_weather_worker;
INSERT INTO phase5_claim_result SELECT * FROM app_weather.claim_weather_run('phase5-worker', interval '1 minute');
SELECT app_weather.heartbeat_weather_run(run_id, lease_token, 'phase5-worker', interval '2 minutes')
  FROM phase5_claim_result;
SELECT * FROM app_weather.retry_weather_run(
    (SELECT run_id FROM phase5_claim_result),
    (SELECT lease_token FROM phase5_claim_result),
    CURRENT_TIMESTAMP,
    'provider_timeout',
    'Sanitized retryable timeout'
);
RESET ROLE;

DO `$test`$
BEGIN
    IF (SELECT COUNT(*) FROM phase5_claim_result) <> 1 OR
       (SELECT attempt_count FROM phase5_claim_result) <> 1 OR
       (SELECT lease_token IS NULL OR lease_expires_at <= CURRENT_TIMESTAMP FROM phase5_claim_result) OR
       (SELECT status FROM public.provider_runs WHERE id = (SELECT run_id FROM phase5_claim_result)) <> 'retry_wait' THEN
        RAISE EXCEPTION 'Weather lease claim, heartbeat, or retry state is invalid';
    END IF;
END
`$test`$;

UPDATE public.provider_runs
   SET available_at = '1900-01-01 00:00:00+00',
       retry_at = '1900-01-01 00:00:00+00'
 WHERE id = (SELECT run_id FROM phase5_claim_result);
TRUNCATE phase5_claim_result;
SET LOCAL ROLE app_weather_worker;
INSERT INTO phase5_claim_result SELECT * FROM app_weather.claim_weather_run('phase5-worker', interval '1 minute');
SELECT * FROM app_weather.retry_weather_run(
    (SELECT run_id FROM phase5_claim_result),
    (SELECT lease_token FROM phase5_claim_result),
    CURRENT_TIMESTAMP + interval '1 minute',
    'provider_timeout',
    'Sanitized final timeout'
);
RESET ROLE;

DO `$test`$
BEGIN
    IF (SELECT attempt_count FROM phase5_claim_result) <> 2 OR
       (SELECT status FROM public.provider_runs WHERE id = (SELECT run_id FROM phase5_claim_result)) <> 'dead_letter' OR
       (SELECT dead_lettered_at IS NULL FROM public.provider_runs WHERE id = (SELECT run_id FROM phase5_claim_result)) THEN
        RAISE EXCEPTION 'Weather retry did not enter dead-letter state at the attempt limit';
    END IF;
END
`$test`$;

TRUNCATE phase5_enqueue_result;
SET LOCAL ROLE app_weather_api;
INSERT INTO phase5_enqueue_result
SELECT * FROM app_weather.enqueue_weather_run(
    '$providerId', '$persistKey', 'bundle', 'phase5-test-v1', '$locationId',
    NULL, NULL, 3, '1900-01-01 00:00:00+00', NULL
);
RESET ROLE;

TRUNCATE phase5_claim_result;
SET LOCAL ROLE app_weather_worker;
INSERT INTO phase5_claim_result SELECT * FROM app_weather.claim_weather_run('phase5-worker', interval '5 minutes');
RESET ROLE;

CREATE TEMP TABLE phase5_persist_result (
    observations_inserted integer,
    observations_existing integer,
    forecasts_inserted integer,
    forecasts_existing integer
) ON COMMIT DROP;
GRANT ALL ON phase5_persist_result TO app_weather_worker;

SET LOCAL ROLE app_weather_worker;
INSERT INTO phase5_persist_result
SELECT * FROM app_weather.persist_weather_bundle(
    (SELECT run_id FROM phase5_claim_result),
    (SELECT lease_token FROM phase5_claim_result),
    jsonb_build_array(jsonb_build_object(
        'idempotency_key', '$observationKey',
        'normalized_payload_checksum_sha256', repeat('a', 64),
        'provider_record_id', 'observation-fixture',
        'observed_at', CURRENT_TIMESTAMP - interval '2 minutes',
        'fetched_at', CURRENT_TIMESTAMP - interval '1 minute',
        'expires_at', CURRENT_TIMESTAMP + interval '14 minutes',
        'condition_code', 'clear',
        'temperature_celsius', 30.125,
        'humidity_percent', 70.500,
        'source_quality', 'reported'
    )),
    jsonb_build_array(jsonb_build_object(
        'idempotency_key', '$forecastKey',
        'normalized_payload_checksum_sha256', repeat('b', 64),
        'provider_record_id', 'forecast-fixture',
        'horizon_kind', 'hourly',
        'provider_issued_at', CURRENT_TIMESTAMP - interval '2 hours',
        'valid_from', CURRENT_TIMESTAMP,
        'valid_to', CURRENT_TIMESTAMP + interval '1 hour',
        'fetched_at', CURRENT_TIMESTAMP - interval '1 minute',
        'expires_at', CURRENT_TIMESTAMP + interval '5 hours',
        'condition_code', 'cloudy',
        'temperature_celsius', 29.500,
        'precipitation_probability_percent', 20.000
    ))
);
INSERT INTO phase5_persist_result
SELECT * FROM app_weather.persist_weather_bundle(
    (SELECT run_id FROM phase5_claim_result),
    (SELECT lease_token FROM phase5_claim_result),
    jsonb_build_array(jsonb_build_object(
        'idempotency_key', '$observationKey',
        'normalized_payload_checksum_sha256', repeat('a', 64),
        'observed_at', CURRENT_TIMESTAMP - interval '2 minutes',
        'fetched_at', CURRENT_TIMESTAMP - interval '1 minute',
        'expires_at', CURRENT_TIMESTAMP + interval '14 minutes'
    )),
    jsonb_build_array(jsonb_build_object(
        'idempotency_key', '$forecastKey',
        'normalized_payload_checksum_sha256', repeat('b', 64),
        'horizon_kind', 'hourly',
        'valid_from', CURRENT_TIMESTAMP,
        'valid_to', CURRENT_TIMESTAMP + interval '1 hour',
        'fetched_at', CURRENT_TIMESTAMP - interval '1 minute',
        'expires_at', CURRENT_TIMESTAMP + interval '5 hours'
    ))
);
RESET ROLE;

DO `$test`$
DECLARE
    checksum_collision boolean := false;
    raw_field_rejected boolean := false;
BEGIN
    IF (SELECT COUNT(*) FROM phase5_persist_result) <> 2 OR
       (SELECT COUNT(*) FROM phase5_persist_result WHERE observations_inserted = 1 AND forecasts_inserted = 1) <> 1 OR
       (SELECT COUNT(*) FROM phase5_persist_result WHERE observations_existing = 1 AND forecasts_existing = 1) <> 1 OR
       (SELECT COUNT(*) FROM public.weather_observations WHERE provider_id = '$providerId' AND idempotency_key = '$observationKey') <> 1 OR
       (SELECT COUNT(*) FROM public.weather_forecasts WHERE provider_id = '$providerId' AND idempotency_key = '$forecastKey') <> 1 THEN
        RAISE EXCEPTION 'Normalized weather persistence is not idempotent';
    END IF;

    BEGIN
        PERFORM * FROM app_weather.persist_weather_bundle(
            (SELECT run_id FROM phase5_claim_result),
            (SELECT lease_token FROM phase5_claim_result),
            jsonb_build_array(
                jsonb_build_object(
                    'idempotency_key', '$atomicKey',
                    'normalized_payload_checksum_sha256', repeat('d', 64),
                    'observed_at', CURRENT_TIMESTAMP - interval '2 minutes',
                    'fetched_at', CURRENT_TIMESTAMP - interval '1 minute',
                    'expires_at', CURRENT_TIMESTAMP + interval '14 minutes'
                ),
                jsonb_build_object(
                    'idempotency_key', '$observationKey',
                    'normalized_payload_checksum_sha256', repeat('c', 64),
                    'observed_at', CURRENT_TIMESTAMP - interval '2 minutes',
                    'fetched_at', CURRENT_TIMESTAMP - interval '1 minute',
                    'expires_at', CURRENT_TIMESTAMP + interval '14 minutes'
                )
            ),
            '[]'::jsonb
        );
    EXCEPTION WHEN unique_violation THEN
        checksum_collision := true;
    END;

    IF NOT checksum_collision OR
       EXISTS (SELECT 1 FROM public.weather_observations WHERE provider_id = '$providerId' AND idempotency_key = '$atomicKey') THEN
        RAISE EXCEPTION 'Checksum collision was not rejected atomically';
    END IF;

    BEGIN
        PERFORM * FROM app_weather.persist_weather_bundle(
            (SELECT run_id FROM phase5_claim_result),
            (SELECT lease_token FROM phase5_claim_result),
            jsonb_build_array(jsonb_build_object(
                'idempotency_key', 'phase5-raw-rejected-$suffix',
                'normalized_payload_checksum_sha256', repeat('d', 64),
                'observed_at', CURRENT_TIMESTAMP - interval '2 minutes',
                'fetched_at', CURRENT_TIMESTAMP - interval '1 minute',
                'expires_at', CURRENT_TIMESTAMP + interval '14 minutes',
                'raw_payload', jsonb_build_object('unexpected', true)
            )),
            '[]'::jsonb
        );
    EXCEPTION WHEN invalid_parameter_value THEN
        raw_field_rejected := true;
    END;
    IF NOT raw_field_rejected THEN
        RAISE EXCEPTION 'Weather persistence accepted a raw payload field';
    END IF;
END
`$test`$;

CREATE TEMP TABLE phase5_bundle_result(document jsonb) ON COMMIT DROP;
GRANT ALL ON phase5_bundle_result TO app_weather_worker;
SET LOCAL ROLE app_weather_worker;
INSERT INTO phase5_bundle_result
SELECT app_weather.fetch_weather_bundle('$locationId', NULL, NULL, CURRENT_TIMESTAMP);
RESET ROLE;

DO `$test`$
BEGIN
    IF (SELECT document ->> 'status' FROM phase5_bundle_result) <> 'available' OR
       (SELECT document -> 'observation' ->> 'freshness' FROM phase5_bundle_result) <> 'fresh' OR
       (SELECT jsonb_array_length(document -> 'forecasts') FROM phase5_bundle_result) <> 1 OR
       (SELECT document::text ~* '(raw_payload|raw_response|request_url|credential_reference)' FROM phase5_bundle_result) THEN
        RAISE EXCEPTION 'Normalized weather bundle is unavailable or exposes an internal field';
    END IF;
END
`$test`$;

SET LOCAL ROLE app_weather_worker;
SELECT app_weather.complete_weather_run(
    (SELECT run_id FROM phase5_claim_result),
    (SELECT lease_token FROM phase5_claim_result),
    'succeeded', 2, 2, NULL, NULL
);
RESET ROLE;

UPDATE public.provider_runs
   SET requested_at = '1999-01-01 00:00:00+00',
       started_at = '1999-01-01 00:01:00+00',
       last_attempt_at = '1999-01-01 00:01:00+00',
       completed_at = '1999-01-01 00:02:00+00'
 WHERE id = (SELECT run_id FROM phase5_claim_result);

INSERT INTO public.weather_observations (
    provider_id, location_id, coordinates, idempotency_key,
    normalized_payload_checksum_sha256, observed_at, fetched_at, expires_at,
    parser_version, status
) VALUES (
    '$providerId', '$locationId', public.ST_SetSRID(public.ST_MakePoint(106.700000, 10.775000), 4326),
    '$oldObservationKey', repeat('e', 64),
    '1999-12-31 21:59:00+00', '1999-12-31 22:00:00+00',
    '1999-12-31 22:15:00+00', 'phase5-test-v1', 'valid'
);
INSERT INTO public.weather_forecasts (
    provider_id, location_id, coordinates, idempotency_key,
    normalized_payload_checksum_sha256, horizon_kind, provider_issued_at,
    valid_from, valid_to, fetched_at, expires_at, parser_version, status
) VALUES (
    '$providerId', '$locationId', public.ST_SetSRID(public.ST_MakePoint(106.700000, 10.775000), 4326),
    '$oldForecastKey', repeat('f', 64), 'hourly', '1999-12-30 21:00:00+00',
    '1999-12-30 22:00:00+00', '1999-12-30 23:00:00+00',
    '1999-12-30 23:00:00+00', '1999-12-31 05:00:00+00',
    'phase5-test-v1', 'valid'
);

CREATE TEMP TABLE phase5_retention_result (
    deleted_observations bigint,
    deleted_forecasts bigint,
    deleted_runs bigint,
    deleted_evidence bigint,
    released_route_samples bigint
) ON COMMIT DROP;
INSERT INTO phase5_retention_result
SELECT * FROM app_weather.purge_weather_runtime('2000-01-01 00:00:00+00');

DO `$test`$
BEGIN
    IF (SELECT deleted_observations FROM phase5_retention_result) <> 1 OR
       (SELECT deleted_forecasts FROM phase5_retention_result) <> 1 OR
       (SELECT deleted_runs FROM phase5_retention_result) <> 1 OR
       EXISTS (SELECT 1 FROM public.weather_observations WHERE idempotency_key = '$oldObservationKey') OR
       EXISTS (SELECT 1 FROM public.weather_forecasts WHERE idempotency_key = '$oldForecastKey') OR
       NOT EXISTS (SELECT 1 FROM public.weather_observations WHERE idempotency_key = '$observationKey' AND provider_run_id IS NULL) OR
       NOT EXISTS (SELECT 1 FROM public.weather_forecasts WHERE idempotency_key = '$forecastKey' AND provider_run_id IS NULL) THEN
        RAISE EXCEPTION 'Weather retention did not enforce 60m, 24h, and 30d cutoffs safely';
    END IF;
END
`$test`$;

TRUNCATE phase5_enqueue_result;
SET LOCAL ROLE app_weather_api;
INSERT INTO phase5_enqueue_result
SELECT * FROM app_weather.enqueue_weather_run(
    '$providerId', '$failedKey', 'current', 'phase5-test-v1', '$locationId',
    NULL, NULL, 1, '1900-01-01 00:00:00+00', NULL
);
RESET ROLE;
TRUNCATE phase5_claim_result;
SET LOCAL ROLE app_weather_worker;
INSERT INTO phase5_claim_result SELECT * FROM app_weather.claim_weather_run('phase5-worker', interval '1 minute');
SELECT app_weather.fail_weather_run(
    (SELECT run_id FROM phase5_claim_result),
    (SELECT lease_token FROM phase5_claim_result),
    'provider_schema_invalid',
    'Sanitized terminal failure'
);
RESET ROLE;

DO `$test`$
DECLARE
    api_role name := '$($runtime['API_DB_USER'])';
    configured_worker name := $workerLoginSql;
    insecure_function_count integer;
    raw_column_count integer;
    missing_state_count integer;
BEGIN
    IF (SELECT status FROM public.provider_runs WHERE id = (SELECT run_id FROM phase5_claim_result)) <> 'failed' THEN
        RAISE EXCEPTION 'Terminal worker failure was not persisted';
    END IF;

    SELECT COUNT(*) INTO insecure_function_count
      FROM pg_proc AS procedure
      JOIN pg_namespace AS namespace ON namespace.oid = procedure.pronamespace
     WHERE namespace.nspname = 'app_weather'
       AND (NOT procedure.prosecdef OR
            procedure.proconfig IS NULL OR
            NOT EXISTS (SELECT 1 FROM unnest(procedure.proconfig) AS setting WHERE setting = 'search_path=pg_catalog, public') OR
            has_function_privilege('public', procedure.oid, 'EXECUTE'));
    IF insecure_function_count <> 0 THEN
        RAISE EXCEPTION 'Weather runtime contains an insecure function boundary';
    END IF;

    SELECT COUNT(*) INTO raw_column_count
      FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name IN ('provider_runs', 'weather_observations', 'weather_forecasts')
       AND column_name ~* '(^|_)(raw|raw_payload|raw_response|provider_payload|provider_response|request_url)(_|$)';
    IF raw_column_count <> 0 THEN
        RAISE EXCEPTION 'A raw weather payload/request column exists';
    END IF;

    SELECT COUNT(*) INTO missing_state_count
      FROM unnest(ARRAY[
          'pending', 'running', 'retry_wait', 'succeeded', 'partial',
          'failed', 'dead_letter', 'cancelled'
      ]) AS required(state)
     WHERE NOT EXISTS (
         SELECT 1
           FROM pg_constraint
          WHERE conrelid = 'public.provider_runs'::regclass
            AND conname = 'provider_runs_status_ck'
            AND pg_get_constraintdef(oid) LIKE '%' || quote_literal(required.state) || '%'
     );
    IF missing_state_count <> 0 OR NOT EXISTS (
        SELECT 1 FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = 'provider_runs' AND column_name = 'lease_token'
    ) OR NOT EXISTS (
        SELECT 1 FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = 'provider_runs' AND column_name = 'target_coordinates'
    ) THEN
        RAISE EXCEPTION 'Provider run durable state schema is incomplete';
    END IF;

    IF NOT pg_has_role(api_role, 'app_weather_api', 'member') OR
       NOT has_function_privilege(api_role, 'app_weather.enqueue_weather_run(uuid,text,text,text,uuid,double precision,double precision,integer,timestamptz,jsonb)', 'EXECUTE') OR
       NOT has_function_privilege(api_role, 'app_weather.fetch_weather_bundle_public(uuid,double precision,double precision,timestamp with time zone)', 'EXECUTE') OR
       has_function_privilege(api_role, 'app_weather.claim_weather_run(text,interval)', 'EXECUTE') OR
       has_function_privilege(api_role, 'app_weather.persist_weather_bundle(uuid,uuid,jsonb,jsonb)', 'EXECUTE') OR
       has_function_privilege(api_role, 'app_weather.purge_weather_runtime(timestamptz)', 'EXECUTE') THEN
        RAISE EXCEPTION 'API weather role privilege boundary is invalid';
    END IF;

    IF NOT has_function_privilege('app_weather_worker', 'app_weather.claim_weather_run(text,interval)', 'EXECUTE') OR
       NOT has_function_privilege('app_weather_worker', 'app_weather.persist_weather_bundle(uuid,uuid,jsonb,jsonb)', 'EXECUTE') OR
       has_function_privilege('app_weather_worker', 'app_weather.enqueue_weather_run(uuid,text,text,text,uuid,double precision,double precision,integer,timestamptz,jsonb)', 'EXECUTE') OR
       has_function_privilege('app_weather_worker', 'app_weather.fetch_weather_bundle_public(uuid,double precision,double precision,timestamp with time zone)', 'EXECUTE') OR
       has_function_privilege('app_weather_worker', 'app_weather.purge_weather_runtime(timestamptz)', 'EXECUTE') THEN
        RAISE EXCEPTION 'Worker weather function privilege boundary is invalid';
    END IF;

    IF EXISTS (
        SELECT 1
          FROM unnest(ARRAY[api_role, 'app_weather_api'::name, 'app_weather_worker'::name, configured_worker]) AS checked(role_name)
          CROSS JOIN pg_class AS relation
          JOIN pg_namespace AS namespace ON namespace.oid = relation.relnamespace
         WHERE namespace.nspname = 'public'
           AND relation.relkind IN ('r', 'p', 'v', 'm')
           AND has_table_privilege(
               checked.role_name,
               format('%I.%I', namespace.nspname, relation.relname),
               'SELECT,INSERT,UPDATE,DELETE,TRUNCATE'
           )
    ) THEN
        RAISE EXCEPTION 'API or worker has direct CRUD on a public business table';
    END IF;

    IF configured_worker IS NOT NULL AND (
        NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = configured_worker AND rolcanlogin) OR
        NOT pg_has_role(configured_worker, 'app_weather_worker', 'member') OR
        pg_has_role(configured_worker, 'app_weather_api', 'member') OR
        has_table_privilege(configured_worker, 'public.provider_runs', 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE')
    ) THEN
        RAISE EXCEPTION 'Configured worker login does not satisfy least privilege';
    END IF;

    IF has_function_privilege(api_role, 'app_weather.purge_weather_runtime(timestamptz)', 'EXECUTE') OR
       has_function_privilege('app_weather_worker', 'app_weather.purge_weather_runtime(timestamptz)', 'EXECUTE') OR
       position('60 minutes' IN pg_get_functiondef('app_weather.purge_weather_runtime(timestamptz)'::regprocedure)) = 0 OR
       position('24 hours' IN pg_get_functiondef('app_weather.purge_weather_runtime(timestamptz)'::regprocedure)) = 0 OR
       position('30 days' IN pg_get_functiondef('app_weather.purge_weather_runtime(timestamptz)'::regprocedure)) = 0 THEN
        RAISE EXCEPTION 'Owner-only weather retention boundary or approved cutoffs are invalid';
    END IF;
END
`$test`$;

SELECT 'PHASE5_WEATHER_RUNTIME_DB_TEST_OK enqueue_duplicate=true claim_lease=true heartbeat=true retry_deadletter=true persistence_atomic=true upsert_duplicate=true checksum_conflict=true normalized_bundle=true role_boundary=true no_raw_fields=true retention_60m_24h_30d=true scheduler_deferred=true fixtures_rolled_back=true secrets_printed=false';
ROLLBACK;
"@

Push-Location $workspaceRoot
try {
    $containerId = (docker compose --env-file $RuntimeEnvPath ps -q database).Trim()
    if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($containerId)) {
        throw 'Database container is not running.'
    }
    $result = docker compose --env-file $RuntimeEnvPath exec -T database psql -qAt -v ON_ERROR_STOP=1 `
        -U $runtime['DB_USER'] -d $runtime['DB_DATABASE'] -c $sql
    if ($LASTEXITCODE -ne 0) { throw 'Phase 5 weather runtime database test failed.' }
    $marker = @($result | Where-Object { $_ -like 'PHASE5_WEATHER_RUNTIME_DB_TEST_*' })
    if ($marker.Count -ne 1 -or $marker[0] -notlike 'PHASE5_WEATHER_RUNTIME_DB_TEST_OK*') {
        throw 'Phase 5 weather runtime database marker is missing or invalid.'
    }
    Write-Output $marker[0]
}
finally {
    Pop-Location
}
