BEGIN;

CREATE SCHEMA IF NOT EXISTS app_weather;
REVOKE ALL ON SCHEMA app_weather FROM PUBLIC;

DO $do$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_weather_api') THEN
        CREATE ROLE app_weather_api NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION INHERIT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_weather_worker') THEN
        CREATE ROLE app_weather_worker NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION INHERIT;
    END IF;
    ALTER ROLE app_weather_api NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION INHERIT;
    ALTER ROLE app_weather_worker NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION INHERIT;
END
$do$;

ALTER DEFAULT PRIVILEGES IN SCHEMA app_weather REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;

ALTER TABLE public.provider_runs
    ADD COLUMN IF NOT EXISTS request_kind varchar(32),
    ADD COLUMN IF NOT EXISTS target_location_id uuid,
    ADD COLUMN IF NOT EXISTS target_coordinates geometry(Point, 4326),
    ADD COLUMN IF NOT EXISTS attempt_count integer NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS max_attempts integer NOT NULL DEFAULT 3,
    ADD COLUMN IF NOT EXISTS available_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ADD COLUMN IF NOT EXISTS last_attempt_at timestamptz,
    ADD COLUMN IF NOT EXISTS lease_owner varchar(128),
    ADD COLUMN IF NOT EXISTS lease_token uuid,
    ADD COLUMN IF NOT EXISTS lease_expires_at timestamptz,
    ADD COLUMN IF NOT EXISTS last_heartbeat_at timestamptz,
    ADD COLUMN IF NOT EXISTS retry_at timestamptz,
    ADD COLUMN IF NOT EXISTS dead_lettered_at timestamptz;

UPDATE public.provider_runs
   SET request_kind = CASE run_type
       WHEN 'current' THEN 'current'
       WHEN 'capability_probe' THEN 'capability_probe'
       ELSE 'bundle'
   END
 WHERE request_kind IS NULL;

ALTER TABLE public.provider_runs
    ALTER COLUMN request_kind SET DEFAULT 'bundle',
    ALTER COLUMN request_kind SET NOT NULL;

ALTER TABLE public.provider_runs DROP CONSTRAINT IF EXISTS provider_runs_status_ck;
ALTER TABLE public.provider_runs DROP CONSTRAINT IF EXISTS provider_runs_request_kind_ck;
ALTER TABLE public.provider_runs DROP CONSTRAINT IF EXISTS provider_runs_attempts_ck;
ALTER TABLE public.provider_runs DROP CONSTRAINT IF EXISTS provider_runs_target_ck;
ALTER TABLE public.provider_runs DROP CONSTRAINT IF EXISTS provider_runs_runtime_state_ck;
ALTER TABLE public.provider_runs DROP CONSTRAINT IF EXISTS provider_runs_sanitized_metadata_ck;

DO $do$
BEGIN
    IF NOT EXISTS (
        SELECT 1
          FROM pg_constraint
         WHERE conrelid = 'public.provider_runs'::regclass
           AND conname = 'provider_runs_target_location_id_fkey'
    ) THEN
        ALTER TABLE public.provider_runs
            ADD CONSTRAINT provider_runs_target_location_id_fkey
            FOREIGN KEY (target_location_id) REFERENCES public.locations(id) ON DELETE RESTRICT;
    END IF;
END
$do$;

-- Legacy active runs have no durable target or lease and cannot be recovered safely.
UPDATE public.provider_runs
   SET status = 'failed',
       started_at = COALESCE(started_at, requested_at),
       completed_at = COALESCE(completed_at, CURRENT_TIMESTAMP),
       error_code = COALESCE(error_code, 'legacy_target_missing'),
       error_message = COALESCE(error_message, 'Run predates the durable weather target boundary'),
       lease_owner = NULL,
       lease_token = NULL,
       lease_expires_at = NULL,
       last_heartbeat_at = NULL,
       retry_at = NULL
 WHERE target_coordinates IS NULL
   AND status IN ('pending', 'running', 'retry_wait');

UPDATE public.provider_runs
   SET max_attempts = GREATEST(max_attempts, attempt_count, 1),
       available_at = COALESCE(available_at, requested_at, CURRENT_TIMESTAMP)
 WHERE max_attempts < GREATEST(attempt_count, 1)
    OR available_at IS NULL;

UPDATE public.provider_runs
   SET status = 'retry_wait',
       retry_at = COALESCE(retry_at, CURRENT_TIMESTAMP),
       available_at = COALESCE(retry_at, CURRENT_TIMESTAMP),
       completed_at = NULL,
       lease_owner = NULL,
       lease_token = NULL,
       lease_expires_at = NULL,
       last_heartbeat_at = NULL
 WHERE status = 'running'
   AND (lease_owner IS NULL OR lease_token IS NULL OR lease_expires_at IS NULL);

UPDATE public.provider_runs
   SET started_at = COALESCE(started_at, requested_at),
       completed_at = COALESCE(completed_at, requested_at, CURRENT_TIMESTAMP),
       dead_lettered_at = CASE
           WHEN status = 'dead_letter' THEN COALESCE(dead_lettered_at, completed_at, CURRENT_TIMESTAMP)
           ELSE NULL
       END,
       retry_at = NULL,
       lease_owner = NULL,
       lease_token = NULL,
       lease_expires_at = NULL,
       last_heartbeat_at = NULL
 WHERE status IN ('succeeded', 'partial', 'failed', 'dead_letter', 'cancelled');

UPDATE public.provider_runs
   SET completed_at = NULL,
       dead_lettered_at = NULL,
       retry_at = CASE WHEN status = 'retry_wait' THEN COALESCE(retry_at, available_at) ELSE NULL END,
       lease_owner = CASE WHEN status = 'running' THEN lease_owner ELSE NULL END,
       lease_token = CASE WHEN status = 'running' THEN lease_token ELSE NULL END,
       lease_expires_at = CASE WHEN status = 'running' THEN lease_expires_at ELSE NULL END,
       last_heartbeat_at = CASE WHEN status = 'running' THEN last_heartbeat_at ELSE NULL END
 WHERE status IN ('pending', 'running', 'retry_wait');

ALTER TABLE public.provider_runs
    ADD CONSTRAINT provider_runs_status_ck CHECK (status IN (
        'pending', 'running', 'retry_wait', 'succeeded', 'partial',
        'failed', 'dead_letter', 'cancelled'
    )),
    ADD CONSTRAINT provider_runs_request_kind_ck CHECK (request_kind IN (
        'current', 'hourly', 'daily', 'bundle', 'capability_probe'
    )),
    ADD CONSTRAINT provider_runs_attempts_ck CHECK (
        attempt_count >= 0 AND max_attempts > 0 AND attempt_count <= max_attempts
    ),
    ADD CONSTRAINT provider_runs_target_ck CHECK (target_coordinates IS NOT NULL) NOT VALID,
    ADD CONSTRAINT provider_runs_runtime_state_ck CHECK (
        (status IN ('pending', 'running', 'retry_wait') AND completed_at IS NULL OR
         status IN ('succeeded', 'partial', 'failed', 'dead_letter', 'cancelled') AND completed_at IS NOT NULL)
        AND (status = 'running' OR
             lease_owner IS NULL AND lease_token IS NULL AND lease_expires_at IS NULL AND last_heartbeat_at IS NULL)
        AND (status <> 'running' OR
             lease_owner IS NOT NULL AND lease_token IS NOT NULL AND lease_expires_at IS NOT NULL AND last_heartbeat_at IS NOT NULL)
        AND (status = 'retry_wait' OR retry_at IS NULL)
        AND (status <> 'retry_wait' OR retry_at IS NOT NULL)
        AND (status = 'dead_letter' OR dead_lettered_at IS NULL)
        AND (status <> 'dead_letter' OR dead_lettered_at IS NOT NULL)
    ),
    ADD CONSTRAINT provider_runs_sanitized_metadata_ck CHECK (
        sanitized_metadata IS NULL OR (
            jsonb_typeof(sanitized_metadata) = 'object'
            AND pg_column_size(sanitized_metadata) <= 8192
            AND sanitized_metadata::text !~* '"[^"]*(raw|payload|response|request[_-]?url|coordinates?|latitude|longitude|token|secret|password|api[_-]?key|credential|user|email|account|identity|owner|session)[^"]*"[[:space:]]*:'
            AND sanitized_metadata::text !~* '(https?://|[?&][A-Za-z0-9_-]+[[:space:]]*=|bearer[[:space:]]+[A-Za-z0-9._~+/-]+)'
        )
    ) NOT VALID;

DO $do$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.provider_runs WHERE target_coordinates IS NULL) THEN
        ALTER TABLE public.provider_runs VALIDATE CONSTRAINT provider_runs_target_ck;
    END IF;
    IF NOT EXISTS (
        SELECT 1
          FROM public.provider_runs
         WHERE sanitized_metadata IS NOT NULL
           AND (
               jsonb_typeof(sanitized_metadata) <> 'object'
               OR pg_column_size(sanitized_metadata) > 8192
               OR sanitized_metadata::text ~* '"[^"]*(raw|payload|response|request[_-]?url|coordinates?|latitude|longitude|token|secret|password|api[_-]?key|credential|user|email|account|identity|owner|session)[^"]*"[[:space:]]*:'
               OR sanitized_metadata::text ~* '(https?://|[?&][A-Za-z0-9_-]+[[:space:]]*=|bearer[[:space:]]+[A-Za-z0-9._~+/-]+)'
           )
    ) THEN
        ALTER TABLE public.provider_runs VALIDATE CONSTRAINT provider_runs_sanitized_metadata_ck;
    END IF;
END
$do$;

CREATE INDEX IF NOT EXISTS provider_runs_claim_idx
    ON public.provider_runs (available_at, requested_at, id)
    WHERE status IN ('pending', 'retry_wait');
CREATE INDEX IF NOT EXISTS provider_runs_expired_lease_idx
    ON public.provider_runs (lease_expires_at, id)
    WHERE status = 'running';
CREATE INDEX IF NOT EXISTS provider_runs_target_location_idx
    ON public.provider_runs (target_location_id, request_kind, requested_at DESC)
    WHERE target_location_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS provider_runs_target_coordinates_gix
    ON public.provider_runs USING gist (target_coordinates);

CREATE OR REPLACE FUNCTION app_weather.enqueue_weather_run(
    p_provider_id uuid,
    p_idempotency_key text,
    p_request_kind text,
    p_parser_version text,
    p_target_location_id uuid DEFAULT NULL,
    p_longitude double precision DEFAULT NULL,
    p_latitude double precision DEFAULT NULL,
    p_max_attempts integer DEFAULT 3,
    p_available_at timestamptz DEFAULT CURRENT_TIMESTAMP,
    p_sanitized_metadata jsonb DEFAULT NULL
)
RETURNS TABLE(run_id uuid, run_status varchar(32), inserted boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
    v_target geometry(Point, 4326);
    v_run public.provider_runs%ROWTYPE;
    v_inserted boolean := false;
    v_run_type varchar(32);
BEGIN
    IF p_provider_id IS NULL THEN
        RAISE EXCEPTION 'Provider is required' USING ERRCODE = '22023';
    END IF;
    IF p_idempotency_key IS NULL OR btrim(p_idempotency_key) = '' OR length(p_idempotency_key) > 255 THEN
        RAISE EXCEPTION 'Idempotency key must contain 1 to 255 characters' USING ERRCODE = '22023';
    END IF;
    IF p_request_kind IS NULL OR p_request_kind NOT IN ('current', 'hourly', 'daily', 'bundle', 'capability_probe') THEN
        RAISE EXCEPTION 'Unsupported weather request kind' USING ERRCODE = '22023';
    END IF;
    IF p_parser_version IS NULL OR btrim(p_parser_version) = '' OR length(p_parser_version) > 128 THEN
        RAISE EXCEPTION 'Parser version must contain 1 to 128 characters' USING ERRCODE = '22023';
    END IF;
    IF p_max_attempts < 1 OR p_max_attempts > 20 THEN
        RAISE EXCEPTION 'Maximum attempts must be between 1 and 20' USING ERRCODE = '22023';
    END IF;
    IF p_available_at IS NULL THEN
        RAISE EXCEPTION 'Availability timestamp is required' USING ERRCODE = '22023';
    END IF;
    IF p_sanitized_metadata IS NOT NULL AND (
        jsonb_typeof(p_sanitized_metadata) <> 'object'
        OR pg_column_size(p_sanitized_metadata) > 8192
        OR p_sanitized_metadata::text ~* '"[^"]*(raw|payload|response|request[_-]?url|coordinates?|latitude|longitude|token|secret|password|api[_-]?key|credential|user|email|account|identity|owner|session)[^"]*"[[:space:]]*:'
        OR p_sanitized_metadata::text ~* '(https?://|[?&][A-Za-z0-9_-]+[[:space:]]*=|bearer[[:space:]]+[A-Za-z0-9._~+/-]+)'
    ) THEN
        RAISE EXCEPTION 'Weather run metadata is not sanitized' USING ERRCODE = '22023';
    END IF;

    PERFORM 1
      FROM public.weather_providers
     WHERE id = p_provider_id
       AND status IN ('testing', 'active', 'degraded');
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Weather provider is unavailable' USING ERRCODE = '22023';
    END IF;

    IF p_target_location_id IS NOT NULL THEN
        IF p_longitude IS NOT NULL OR p_latitude IS NOT NULL THEN
            RAISE EXCEPTION 'Specify a location or coordinates, not both' USING ERRCODE = '22023';
        END IF;
        SELECT coordinates INTO v_target
          FROM public.locations
         WHERE id = p_target_location_id
           AND status <> 'retired';
        IF v_target IS NULL THEN
            RAISE EXCEPTION 'Weather target location does not exist' USING ERRCODE = '22023';
        END IF;
    ELSE
        IF p_longitude IS NULL OR p_latitude IS NULL OR
           p_longitude NOT BETWEEN -180 AND 180 OR p_latitude NOT BETWEEN -90 AND 90 THEN
            RAISE EXCEPTION 'Valid longitude and latitude are required' USING ERRCODE = '22023';
        END IF;
        v_target := public.ST_SetSRID(public.ST_MakePoint(p_longitude, p_latitude), 4326);
        IF NOT EXISTS (
            SELECT 1
              FROM public.administrative_units AS unit
             WHERE unit.country_code = 'VN'
               AND unit.status = 'active'
               AND unit.boundary IS NOT NULL
               AND public.ST_Covers(unit.boundary, v_target)
        ) THEN
            RAISE EXCEPTION 'Weather coordinate is outside the approved Vietnam boundary or boundary data is unavailable'
                USING ERRCODE = '22023';
        END IF;
        v_target := public.ST_SetSRID(public.ST_MakePoint(
            round(p_longitude::numeric, 3)::double precision,
            round(p_latitude::numeric, 3)::double precision
        ), 4326);
    END IF;

    v_run_type := CASE
        WHEN p_request_kind = 'current' THEN 'current'
        WHEN p_request_kind = 'capability_probe' THEN 'capability_probe'
        ELSE 'forecast'
    END;

    INSERT INTO public.provider_runs (
        provider_id, run_type, request_kind, idempotency_key, status, parser_version,
        target_location_id, target_coordinates, attempt_count, max_attempts,
        available_at, sanitized_metadata
    ) VALUES (
        p_provider_id, v_run_type, p_request_kind, p_idempotency_key, 'pending', p_parser_version,
        p_target_location_id, v_target, 0, p_max_attempts,
        p_available_at, p_sanitized_metadata
    )
    ON CONFLICT (provider_id, idempotency_key) DO NOTHING
    RETURNING * INTO v_run;

    IF FOUND THEN
        v_inserted := true;
    ELSE
        SELECT * INTO v_run
          FROM public.provider_runs
         WHERE provider_id = p_provider_id
           AND idempotency_key = p_idempotency_key;

        IF v_run.request_kind IS DISTINCT FROM p_request_kind OR
           v_run.parser_version IS DISTINCT FROM p_parser_version OR
           v_run.target_location_id IS DISTINCT FROM p_target_location_id OR
           v_run.max_attempts IS DISTINCT FROM p_max_attempts OR
           NOT COALESCE(public.ST_Equals(v_run.target_coordinates, v_target), false) THEN
            RAISE EXCEPTION 'Weather enqueue idempotency collision' USING ERRCODE = '23505';
        END IF;
    END IF;

    RETURN QUERY SELECT v_run.id, v_run.status, v_inserted;
END;
$function$;

CREATE OR REPLACE FUNCTION app_weather.enqueue_weather_run_by_provider_key(
    p_provider_key text,
    p_idempotency_key text,
    p_request_kind text,
    p_parser_version text,
    p_target_location_id uuid DEFAULT NULL,
    p_longitude double precision DEFAULT NULL,
    p_latitude double precision DEFAULT NULL,
    p_max_attempts integer DEFAULT 3,
    p_available_at timestamptz DEFAULT CURRENT_TIMESTAMP,
    p_sanitized_metadata jsonb DEFAULT NULL
)
RETURNS TABLE(run_id uuid, run_status varchar(32), inserted boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
    v_provider_id uuid;
BEGIN
    IF p_provider_key IS NULL OR p_provider_key !~ '^[a-z0-9][a-z0-9._-]{1,127}$' THEN
        RAISE EXCEPTION 'Weather provider key is invalid' USING ERRCODE = '22023';
    END IF;
    SELECT id INTO v_provider_id
      FROM public.weather_providers
     WHERE external_key = p_provider_key
       AND status IN ('testing', 'active', 'degraded');
    IF v_provider_id IS NULL THEN
        RAISE EXCEPTION 'Weather provider is unavailable' USING ERRCODE = '22023';
    END IF;
    IF p_target_location_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM public.locations
         WHERE id = p_target_location_id
           AND status = 'published'
    ) THEN
        RAISE EXCEPTION 'Published weather target location does not exist' USING ERRCODE = '22023';
    END IF;
    RETURN QUERY SELECT * FROM app_weather.enqueue_weather_run(
        v_provider_id,
        p_idempotency_key,
        p_request_kind,
        p_parser_version,
        p_target_location_id,
        p_longitude,
        p_latitude,
        p_max_attempts,
        p_available_at,
        p_sanitized_metadata
    );
END;
$function$;

CREATE OR REPLACE FUNCTION app_weather.fetch_weather_capabilities(
    p_provider_key text
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
    SELECT jsonb_build_object(
        'source', jsonb_build_object(
            'provider_key', provider.external_key,
            'display_name', provider.display_name,
            'attribution_text', provider.attribution_text,
            'terms_url', provider.terms_url
        ),
        'last_verified_at', provider.last_verified_at,
        'capabilities', provider.capabilities
    )
      FROM public.weather_providers AS provider
     WHERE provider.external_key = p_provider_key
       AND provider.status IN ('testing', 'active', 'degraded');
$function$;

CREATE OR REPLACE FUNCTION app_weather.claim_weather_run(
    p_worker_id text,
    p_lease_duration interval DEFAULT interval '1 minute'
)
RETURNS TABLE(
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
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
    v_now timestamptz := clock_timestamp();
    v_run public.provider_runs%ROWTYPE;
BEGIN
    IF p_worker_id IS NULL OR p_worker_id !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$' THEN
        RAISE EXCEPTION 'Worker identifier has an invalid format' USING ERRCODE = '22023';
    END IF;
    IF p_lease_duration IS NULL OR p_lease_duration < interval '5 seconds' OR p_lease_duration > interval '15 minutes' THEN
        RAISE EXCEPTION 'Lease duration must be between 5 seconds and 15 minutes' USING ERRCODE = '22023';
    END IF;

    UPDATE public.provider_runs AS expired
       SET status = 'dead_letter',
           completed_at = v_now,
           dead_lettered_at = v_now,
           error_code = COALESCE(expired.error_code, 'lease_attempts_exhausted'),
           error_message = COALESCE(expired.error_message, 'Worker lease expired after the final attempt'),
           lease_owner = NULL,
           lease_token = NULL,
           lease_expires_at = NULL,
           last_heartbeat_at = NULL,
           retry_at = NULL,
           date_updated = v_now
     WHERE expired.status = 'running'
       AND expired.lease_expires_at <= v_now
       AND expired.attempt_count >= expired.max_attempts;

    WITH candidate AS (
        SELECT queued.id
          FROM public.provider_runs AS queued
         WHERE (
                   queued.status IN ('pending', 'retry_wait')
                   AND queued.available_at <= v_now
               ) OR (
                   queued.status = 'running'
                   AND queued.lease_expires_at <= v_now
                   AND queued.attempt_count < queued.max_attempts
               )
         ORDER BY queued.available_at, queued.requested_at, queued.id
         FOR UPDATE SKIP LOCKED
         LIMIT 1
    )
    UPDATE public.provider_runs AS claimed
       SET status = 'running',
           attempt_count = claimed.attempt_count + 1,
           started_at = COALESCE(claimed.started_at, v_now),
           last_attempt_at = v_now,
           lease_owner = p_worker_id,
           lease_token = gen_random_uuid(),
           lease_expires_at = v_now + p_lease_duration,
           last_heartbeat_at = v_now,
           retry_at = NULL,
           completed_at = NULL,
           date_updated = v_now
      FROM candidate
     WHERE claimed.id = candidate.id
    RETURNING claimed.* INTO v_run;

    IF v_run.id IS NULL THEN
        RETURN;
    END IF;

    RETURN QUERY
    SELECT v_run.id,
           provider.id,
           provider.external_key,
           provider.base_url,
           provider.credential_reference,
           v_run.request_kind,
           v_run.target_location_id,
           public.ST_X(v_run.target_coordinates),
           public.ST_Y(v_run.target_coordinates),
           v_run.parser_version,
           v_run.attempt_count,
           v_run.max_attempts,
           v_run.lease_token,
           v_run.lease_expires_at,
           v_run.sanitized_metadata
      FROM public.weather_providers AS provider
     WHERE provider.id = v_run.provider_id;
END;
$function$;

CREATE OR REPLACE FUNCTION app_weather.heartbeat_weather_run(
    p_run_id uuid,
    p_lease_token uuid,
    p_worker_id text,
    p_lease_duration interval DEFAULT interval '1 minute'
)
RETURNS timestamptz
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
    v_expires_at timestamptz;
BEGIN
    IF p_worker_id IS NULL OR p_worker_id !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$' THEN
        RAISE EXCEPTION 'Worker identifier has an invalid format' USING ERRCODE = '22023';
    END IF;
    IF p_lease_duration IS NULL OR p_lease_duration < interval '5 seconds' OR p_lease_duration > interval '15 minutes' THEN
        RAISE EXCEPTION 'Lease duration must be between 5 seconds and 15 minutes' USING ERRCODE = '22023';
    END IF;

    UPDATE public.provider_runs
       SET lease_expires_at = clock_timestamp() + p_lease_duration,
           last_heartbeat_at = clock_timestamp(),
           date_updated = clock_timestamp()
     WHERE id = p_run_id
       AND status = 'running'
       AND lease_token = p_lease_token
       AND lease_owner = p_worker_id
       AND lease_expires_at > clock_timestamp()
    RETURNING lease_expires_at INTO v_expires_at;

    IF v_expires_at IS NULL THEN
        RAISE EXCEPTION 'Weather run lease is missing, expired, or owned by another worker' USING ERRCODE = '55000';
    END IF;
    RETURN v_expires_at;
END;
$function$;

CREATE OR REPLACE FUNCTION app_weather.persist_weather_bundle(
    p_run_id uuid,
    p_lease_token uuid,
    p_observations jsonb DEFAULT '[]'::jsonb,
    p_forecasts jsonb DEFAULT '[]'::jsonb
)
RETURNS TABLE(
    observations_inserted integer,
    observations_existing integer,
    forecasts_inserted integer,
    forecasts_existing integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
    v_run public.provider_runs%ROWTYPE;
    v_observation record;
    v_forecast record;
    v_inserted_id uuid;
    v_existing_checksum char(64);
    v_observations_inserted integer := 0;
    v_observations_existing integer := 0;
    v_forecasts_inserted integer := 0;
    v_forecasts_existing integer := 0;
BEGIN
    IF p_observations IS NULL OR jsonb_typeof(p_observations) <> 'array' OR
       p_forecasts IS NULL OR jsonb_typeof(p_forecasts) <> 'array' THEN
        RAISE EXCEPTION 'Normalized observations and forecasts must be JSON arrays' USING ERRCODE = '22023';
    END IF;
    IF jsonb_array_length(p_observations) > 1000 OR jsonb_array_length(p_forecasts) > 1000 THEN
        RAISE EXCEPTION 'A weather persistence batch cannot exceed 1000 records per kind' USING ERRCODE = '22023';
    END IF;
    IF EXISTS (
        SELECT 1
          FROM jsonb_array_elements(p_observations) AS item(value)
         WHERE jsonb_typeof(item.value) <> 'object'
            OR EXISTS (
                SELECT 1 FROM jsonb_object_keys(item.value) AS key(name)
                 WHERE NOT (key.name = ANY (ARRAY[
                     'idempotency_key', 'normalized_payload_checksum_sha256', 'provider_record_id',
                     'observed_at', 'fetched_at', 'expires_at', 'condition_code',
                     'temperature_celsius', 'feels_like_celsius', 'humidity_percent',
                     'precipitation_mm', 'wind_speed_mps', 'wind_gust_mps',
                     'wind_direction_degrees', 'pressure_hpa', 'visibility_meters',
                     'source_quality', 'status'
                 ]))
            )
    ) THEN
        RAISE EXCEPTION 'Observation batch contains a non-normalized field' USING ERRCODE = '22023';
    END IF;
    IF EXISTS (
        SELECT 1
          FROM jsonb_array_elements(p_forecasts) AS item(value)
         WHERE jsonb_typeof(item.value) <> 'object'
            OR EXISTS (
                SELECT 1 FROM jsonb_object_keys(item.value) AS key(name)
                 WHERE NOT (key.name = ANY (ARRAY[
                     'idempotency_key', 'normalized_payload_checksum_sha256', 'provider_record_id',
                     'horizon_kind', 'provider_issued_at', 'valid_from', 'valid_to',
                     'fetched_at', 'expires_at', 'condition_code', 'temperature_celsius',
                     'temperature_min_celsius', 'temperature_max_celsius', 'precipitation_mm',
                     'precipitation_probability_percent', 'wind_speed_mps', 'wind_gust_mps',
                     'confidence_percent', 'status'
                 ]))
            )
    ) THEN
        RAISE EXCEPTION 'Forecast batch contains a non-normalized field' USING ERRCODE = '22023';
    END IF;

    SELECT * INTO v_run
      FROM public.provider_runs
     WHERE id = p_run_id
     FOR UPDATE;
    IF v_run.id IS NULL OR v_run.status <> 'running' OR
       v_run.lease_token IS DISTINCT FROM p_lease_token OR
       v_run.lease_expires_at <= clock_timestamp() THEN
        RAISE EXCEPTION 'A current weather run lease is required for persistence' USING ERRCODE = '55000';
    END IF;

    FOR v_observation IN
        SELECT *
          FROM jsonb_to_recordset(p_observations) AS normalized(
              idempotency_key text,
              normalized_payload_checksum_sha256 text,
              provider_record_id varchar(255),
              observed_at timestamptz,
              fetched_at timestamptz,
              expires_at timestamptz,
              condition_code varchar(128),
              temperature_celsius numeric(7, 3),
              feels_like_celsius numeric(7, 3),
              humidity_percent numeric(6, 3),
              precipitation_mm numeric(10, 3),
              wind_speed_mps numeric(10, 3),
              wind_gust_mps numeric(10, 3),
              wind_direction_degrees numeric(7, 3),
              pressure_hpa numeric(10, 3),
              visibility_meters numeric(12, 3),
              source_quality varchar(32),
              status varchar(32)
          )
    LOOP
        IF v_observation.idempotency_key IS NULL OR btrim(v_observation.idempotency_key) = '' OR
           length(v_observation.idempotency_key) > 255 OR
           v_observation.normalized_payload_checksum_sha256 IS NULL OR
           v_observation.normalized_payload_checksum_sha256 !~ '^[0-9a-f]{64}$' OR
           v_observation.observed_at IS NULL OR v_observation.fetched_at IS NULL OR v_observation.expires_at IS NULL THEN
            RAISE EXCEPTION 'Observation is missing a valid logical key, checksum, or timestamp' USING ERRCODE = '22023';
        END IF;
        IF v_observation.expires_at > v_observation.fetched_at + interval '15 minutes' THEN
            RAISE EXCEPTION 'Observation freshness cannot exceed 15 minutes' USING ERRCODE = '22023';
        END IF;

        v_inserted_id := NULL;
        INSERT INTO public.weather_observations (
            provider_id, provider_run_id, location_id, coordinates, idempotency_key,
            normalized_payload_checksum_sha256, provider_record_id, observed_at, fetched_at,
            expires_at, parser_version, condition_code, temperature_celsius,
            feels_like_celsius, humidity_percent, precipitation_mm, wind_speed_mps,
            wind_gust_mps, wind_direction_degrees, pressure_hpa, visibility_meters,
            source_quality, status
        ) VALUES (
            v_run.provider_id, v_run.id, v_run.target_location_id, v_run.target_coordinates,
            v_observation.idempotency_key, v_observation.normalized_payload_checksum_sha256,
            v_observation.provider_record_id, v_observation.observed_at, v_observation.fetched_at,
            v_observation.expires_at, v_run.parser_version, v_observation.condition_code,
            v_observation.temperature_celsius, v_observation.feels_like_celsius,
            v_observation.humidity_percent, v_observation.precipitation_mm,
            v_observation.wind_speed_mps, v_observation.wind_gust_mps,
            v_observation.wind_direction_degrees, v_observation.pressure_hpa,
            v_observation.visibility_meters, COALESCE(v_observation.source_quality, 'reported'),
            COALESCE(v_observation.status, 'valid')
        )
        ON CONFLICT (provider_id, idempotency_key) DO NOTHING
        RETURNING id INTO v_inserted_id;

        IF v_inserted_id IS NULL THEN
            SELECT normalized_payload_checksum_sha256 INTO v_existing_checksum
              FROM public.weather_observations
             WHERE provider_id = v_run.provider_id
               AND idempotency_key = v_observation.idempotency_key
             FOR UPDATE;
            IF v_existing_checksum IS DISTINCT FROM v_observation.normalized_payload_checksum_sha256::char(64) THEN
                RAISE EXCEPTION 'Weather observation checksum collision for logical key %', v_observation.idempotency_key
                    USING ERRCODE = '23505';
            END IF;
            v_observations_existing := v_observations_existing + 1;
        ELSE
            v_observations_inserted := v_observations_inserted + 1;
        END IF;
    END LOOP;

    FOR v_forecast IN
        SELECT *
          FROM jsonb_to_recordset(p_forecasts) AS normalized(
              idempotency_key text,
              normalized_payload_checksum_sha256 text,
              provider_record_id varchar(255),
              horizon_kind varchar(32),
              provider_issued_at timestamptz,
              valid_from timestamptz,
              valid_to timestamptz,
              fetched_at timestamptz,
              expires_at timestamptz,
              condition_code varchar(128),
              temperature_celsius numeric(7, 3),
              temperature_min_celsius numeric(7, 3),
              temperature_max_celsius numeric(7, 3),
              precipitation_mm numeric(10, 3),
              precipitation_probability_percent numeric(6, 3),
              wind_speed_mps numeric(10, 3),
              wind_gust_mps numeric(10, 3),
              confidence_percent numeric(6, 3),
              status varchar(32)
          )
    LOOP
        IF v_forecast.idempotency_key IS NULL OR btrim(v_forecast.idempotency_key) = '' OR
           length(v_forecast.idempotency_key) > 255 OR
           v_forecast.normalized_payload_checksum_sha256 IS NULL OR
           v_forecast.normalized_payload_checksum_sha256 !~ '^[0-9a-f]{64}$' OR
           v_forecast.horizon_kind IS NULL OR v_forecast.valid_from IS NULL OR
           v_forecast.valid_to IS NULL OR v_forecast.fetched_at IS NULL OR v_forecast.expires_at IS NULL THEN
            RAISE EXCEPTION 'Forecast is missing a valid logical key, checksum, horizon, or timestamp' USING ERRCODE = '22023';
        END IF;
        IF v_forecast.expires_at > v_forecast.fetched_at + interval '6 hours' THEN
            RAISE EXCEPTION 'Forecast freshness cannot exceed 6 hours' USING ERRCODE = '22023';
        END IF;

        v_inserted_id := NULL;
        INSERT INTO public.weather_forecasts (
            provider_id, provider_run_id, location_id, coordinates, idempotency_key,
            normalized_payload_checksum_sha256, provider_record_id, horizon_kind,
            provider_issued_at, valid_from, valid_to, fetched_at, expires_at, parser_version,
            condition_code, temperature_celsius, temperature_min_celsius,
            temperature_max_celsius, precipitation_mm, precipitation_probability_percent,
            wind_speed_mps, wind_gust_mps, confidence_percent, status
        ) VALUES (
            v_run.provider_id, v_run.id, v_run.target_location_id, v_run.target_coordinates,
            v_forecast.idempotency_key, v_forecast.normalized_payload_checksum_sha256,
            v_forecast.provider_record_id, v_forecast.horizon_kind, v_forecast.provider_issued_at,
            v_forecast.valid_from, v_forecast.valid_to, v_forecast.fetched_at,
            v_forecast.expires_at, v_run.parser_version, v_forecast.condition_code,
            v_forecast.temperature_celsius, v_forecast.temperature_min_celsius,
            v_forecast.temperature_max_celsius, v_forecast.precipitation_mm,
            v_forecast.precipitation_probability_percent, v_forecast.wind_speed_mps,
            v_forecast.wind_gust_mps, v_forecast.confidence_percent,
            COALESCE(v_forecast.status, 'valid')
        )
        ON CONFLICT (provider_id, idempotency_key) DO NOTHING
        RETURNING id INTO v_inserted_id;

        IF v_inserted_id IS NULL THEN
            SELECT normalized_payload_checksum_sha256 INTO v_existing_checksum
              FROM public.weather_forecasts
             WHERE provider_id = v_run.provider_id
               AND idempotency_key = v_forecast.idempotency_key
             FOR UPDATE;
            IF v_existing_checksum IS DISTINCT FROM v_forecast.normalized_payload_checksum_sha256::char(64) THEN
                RAISE EXCEPTION 'Weather forecast checksum collision for logical key %', v_forecast.idempotency_key
                    USING ERRCODE = '23505';
            END IF;
            v_forecasts_existing := v_forecasts_existing + 1;
        ELSE
            v_forecasts_inserted := v_forecasts_inserted + 1;
        END IF;
    END LOOP;

    RETURN QUERY SELECT
        v_observations_inserted,
        v_observations_existing,
        v_forecasts_inserted,
        v_forecasts_existing;
END;
$function$;

CREATE OR REPLACE FUNCTION app_weather.complete_weather_run(
    p_run_id uuid,
    p_lease_token uuid,
    p_status text,
    p_records_received integer,
    p_records_written integer,
    p_error_code text DEFAULT NULL,
    p_error_message text DEFAULT NULL
)
RETURNS varchar(32)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
    v_status varchar(32);
BEGIN
    IF p_status NOT IN ('succeeded', 'partial') THEN
        RAISE EXCEPTION 'Completion status must be succeeded or partial' USING ERRCODE = '22023';
    END IF;
    IF p_records_received < 0 OR p_records_written < 0 OR p_records_written > p_records_received THEN
        RAISE EXCEPTION 'Weather completion counts are invalid' USING ERRCODE = '22023';
    END IF;
    IF p_error_code IS NOT NULL AND (length(p_error_code) > 128 OR p_error_code !~ '^[a-z0-9][a-z0-9._-]*$') THEN
        RAISE EXCEPTION 'Weather error code is not sanitized' USING ERRCODE = '22023';
    END IF;
    IF p_error_message IS NOT NULL AND (
        length(p_error_message) > 1000 OR
        p_error_message ~* '(https?://|api[_-]?key|token|secret|password|credential|coordinates?|latitude|longitude|email|user[_ -]?id|identity|session|[?&][A-Za-z0-9_-]+=)'
    ) THEN
        RAISE EXCEPTION 'Weather error message is not sanitized' USING ERRCODE = '22023';
    END IF;
    IF p_status = 'succeeded' AND (p_error_code IS NOT NULL OR p_error_message IS NOT NULL) THEN
        RAISE EXCEPTION 'Succeeded weather runs cannot retain an error' USING ERRCODE = '22023';
    END IF;

    UPDATE public.provider_runs
       SET status = p_status,
           completed_at = clock_timestamp(),
           records_received = p_records_received,
           records_written = p_records_written,
           error_code = p_error_code,
           error_message = p_error_message,
           lease_owner = NULL,
           lease_token = NULL,
           lease_expires_at = NULL,
           last_heartbeat_at = NULL,
           retry_at = NULL,
           dead_lettered_at = NULL,
           date_updated = clock_timestamp()
     WHERE id = p_run_id
       AND status = 'running'
       AND lease_token = p_lease_token
       AND lease_expires_at > clock_timestamp()
    RETURNING status INTO v_status;

    IF v_status IS NULL THEN
        RAISE EXCEPTION 'A current weather run lease is required for completion' USING ERRCODE = '55000';
    END IF;
    RETURN v_status;
END;
$function$;

CREATE OR REPLACE FUNCTION app_weather.retry_weather_run(
    p_run_id uuid,
    p_lease_token uuid,
    p_retry_at timestamptz,
    p_error_code text,
    p_error_message text DEFAULT NULL
)
RETURNS TABLE(run_status varchar(32), available_at timestamptz, dead_lettered_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
    v_run public.provider_runs%ROWTYPE;
    v_now timestamptz := clock_timestamp();
BEGIN
    IF p_retry_at IS NULL THEN
        RAISE EXCEPTION 'Retry timestamp is required' USING ERRCODE = '22023';
    END IF;
    IF p_error_code IS NULL OR length(p_error_code) > 128 OR p_error_code !~ '^[a-z0-9][a-z0-9._-]*$' THEN
        RAISE EXCEPTION 'Weather error code is not sanitized' USING ERRCODE = '22023';
    END IF;
    IF p_error_message IS NOT NULL AND (
        length(p_error_message) > 1000 OR
        p_error_message ~* '(https?://|api[_-]?key|token|secret|password|credential|coordinates?|latitude|longitude|email|user[_ -]?id|identity|session|[?&][A-Za-z0-9_-]+=)'
    ) THEN
        RAISE EXCEPTION 'Weather error message is not sanitized' USING ERRCODE = '22023';
    END IF;

    SELECT * INTO v_run
      FROM public.provider_runs
     WHERE id = p_run_id
     FOR UPDATE;
    IF v_run.id IS NULL OR v_run.status <> 'running' OR
       v_run.lease_token IS DISTINCT FROM p_lease_token OR v_run.lease_expires_at <= v_now THEN
        RAISE EXCEPTION 'A current weather run lease is required for retry' USING ERRCODE = '55000';
    END IF;

    IF v_run.attempt_count >= v_run.max_attempts THEN
        UPDATE public.provider_runs
           SET status = 'dead_letter',
               completed_at = v_now,
               dead_lettered_at = v_now,
               error_code = p_error_code,
               error_message = p_error_message,
               lease_owner = NULL,
               lease_token = NULL,
               lease_expires_at = NULL,
               last_heartbeat_at = NULL,
               retry_at = NULL,
               date_updated = v_now
         WHERE id = p_run_id;
    ELSE
        UPDATE public.provider_runs
           SET status = 'retry_wait',
               available_at = GREATEST(p_retry_at, v_now),
               retry_at = GREATEST(p_retry_at, v_now),
               error_code = p_error_code,
               error_message = p_error_message,
               lease_owner = NULL,
               lease_token = NULL,
               lease_expires_at = NULL,
               last_heartbeat_at = NULL,
               completed_at = NULL,
               date_updated = v_now
         WHERE id = p_run_id;
    END IF;

    RETURN QUERY
    SELECT status, public.provider_runs.available_at, public.provider_runs.dead_lettered_at
      FROM public.provider_runs
     WHERE id = p_run_id;
END;
$function$;

CREATE OR REPLACE FUNCTION app_weather.fail_weather_run(
    p_run_id uuid,
    p_lease_token uuid,
    p_error_code text,
    p_error_message text DEFAULT NULL
)
RETURNS varchar(32)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
    v_status varchar(32);
BEGIN
    IF p_error_code IS NULL OR length(p_error_code) > 128 OR p_error_code !~ '^[a-z0-9][a-z0-9._-]*$' THEN
        RAISE EXCEPTION 'Weather error code is not sanitized' USING ERRCODE = '22023';
    END IF;
    IF p_error_message IS NOT NULL AND (
        length(p_error_message) > 1000 OR
        p_error_message ~* '(https?://|api[_-]?key|token|secret|password|credential|coordinates?|latitude|longitude|email|user[_ -]?id|identity|session|[?&][A-Za-z0-9_-]+=)'
    ) THEN
        RAISE EXCEPTION 'Weather error message is not sanitized' USING ERRCODE = '22023';
    END IF;

    UPDATE public.provider_runs
       SET status = 'failed',
           completed_at = clock_timestamp(),
           error_code = p_error_code,
           error_message = p_error_message,
           lease_owner = NULL,
           lease_token = NULL,
           lease_expires_at = NULL,
           last_heartbeat_at = NULL,
           retry_at = NULL,
           dead_lettered_at = NULL,
           date_updated = clock_timestamp()
     WHERE id = p_run_id
       AND status = 'running'
       AND lease_token = p_lease_token
       AND lease_expires_at > clock_timestamp()
    RETURNING status INTO v_status;

    IF v_status IS NULL THEN
        RAISE EXCEPTION 'A current weather run lease is required for failure' USING ERRCODE = '55000';
    END IF;
    RETURN v_status;
END;
$function$;

CREATE OR REPLACE FUNCTION app_weather.fetch_weather_bundle(
    p_target_location_id uuid DEFAULT NULL,
    p_longitude double precision DEFAULT NULL,
    p_latitude double precision DEFAULT NULL,
    p_as_of timestamptz DEFAULT CURRENT_TIMESTAMP
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
    v_target geometry(Point, 4326);
    v_provider_id uuid;
    v_observation jsonb;
    v_forecasts jsonb := '[]'::jsonb;
    v_source jsonb;
BEGIN
    IF p_as_of IS NULL THEN
        RAISE EXCEPTION 'Weather bundle timestamp is required' USING ERRCODE = '22023';
    END IF;
    IF p_target_location_id IS NOT NULL THEN
        IF p_longitude IS NOT NULL OR p_latitude IS NOT NULL THEN
            RAISE EXCEPTION 'Specify a location or coordinates, not both' USING ERRCODE = '22023';
        END IF;
        SELECT coordinates INTO v_target FROM public.locations WHERE id = p_target_location_id AND status <> 'retired';
        IF v_target IS NULL THEN
            RAISE EXCEPTION 'Weather target location does not exist' USING ERRCODE = '22023';
        END IF;
    ELSE
        IF p_longitude IS NULL OR p_latitude IS NULL OR
           p_longitude NOT BETWEEN -180 AND 180 OR p_latitude NOT BETWEEN -90 AND 90 THEN
            RAISE EXCEPTION 'Valid longitude and latitude are required' USING ERRCODE = '22023';
        END IF;
        v_target := public.ST_SetSRID(public.ST_MakePoint(
            round(p_longitude::numeric, 3)::double precision,
            round(p_latitude::numeric, 3)::double precision
        ), 4326);
    END IF;

    SELECT available.provider_id INTO v_provider_id
      FROM (
          SELECT observation.provider_id, observation.fetched_at
            FROM public.weather_observations AS observation
           WHERE observation.status IN ('valid', 'stale')
             AND observation.fetched_at BETWEEN p_as_of - interval '60 minutes' AND p_as_of
             AND ((p_target_location_id IS NOT NULL AND observation.location_id = p_target_location_id) OR
                  (p_target_location_id IS NULL AND public.ST_Equals(observation.coordinates, v_target)))
          UNION ALL
          SELECT forecast.provider_id, forecast.fetched_at
            FROM public.weather_forecasts AS forecast
           WHERE forecast.status IN ('valid', 'stale')
             AND forecast.fetched_at BETWEEN p_as_of - interval '24 hours' AND p_as_of
             AND forecast.valid_to >= p_as_of
             AND forecast.valid_from <= p_as_of + interval '72 hours'
             AND ((p_target_location_id IS NOT NULL AND forecast.location_id = p_target_location_id) OR
                  (p_target_location_id IS NULL AND public.ST_Equals(forecast.coordinates, v_target)))
      ) AS available
     ORDER BY available.fetched_at DESC
     LIMIT 1;

    IF v_provider_id IS NULL THEN
        RETURN jsonb_build_object(
            'status', 'unavailable',
            'as_of', p_as_of,
            'observation', NULL,
            'forecasts', '[]'::jsonb
        );
    END IF;

    SELECT jsonb_build_object(
               'id', observation.id,
               'observed_at', observation.observed_at,
               'fetched_at', observation.fetched_at,
               'expires_at', observation.expires_at,
               'freshness', CASE WHEN observation.expires_at >= p_as_of THEN 'fresh' ELSE 'stale' END,
               'risk_route_eligible', observation.expires_at >= p_as_of,
               'parser_version', observation.parser_version,
               'condition_code', observation.condition_code,
               'temperature_celsius', observation.temperature_celsius,
               'feels_like_celsius', observation.feels_like_celsius,
               'humidity_percent', observation.humidity_percent,
               'precipitation_mm', observation.precipitation_mm,
               'wind_speed_mps', observation.wind_speed_mps,
               'wind_gust_mps', observation.wind_gust_mps,
               'wind_direction_degrees', observation.wind_direction_degrees,
               'pressure_hpa', observation.pressure_hpa,
               'visibility_meters', observation.visibility_meters,
               'source_quality', observation.source_quality
           ) INTO v_observation
      FROM public.weather_observations AS observation
     WHERE observation.provider_id = v_provider_id
       AND observation.status IN ('valid', 'stale')
       AND observation.fetched_at BETWEEN p_as_of - interval '60 minutes' AND p_as_of
       AND ((p_target_location_id IS NOT NULL AND observation.location_id = p_target_location_id) OR
            (p_target_location_id IS NULL AND public.ST_Equals(observation.coordinates, v_target)))
     ORDER BY observation.fetched_at DESC, observation.observed_at DESC
     LIMIT 1;

    SELECT COALESCE(jsonb_agg(normalized.value ORDER BY normalized.valid_from, normalized.horizon_kind), '[]'::jsonb)
      INTO v_forecasts
      FROM (
          SELECT DISTINCT ON (forecast.horizon_kind, forecast.valid_from, forecast.valid_to)
                 forecast.valid_from,
                 forecast.horizon_kind,
                 jsonb_build_object(
                     'id', forecast.id,
                     'horizon_kind', forecast.horizon_kind,
                     'provider_issued_at', forecast.provider_issued_at,
                     'valid_from', forecast.valid_from,
                     'valid_to', forecast.valid_to,
                     'fetched_at', forecast.fetched_at,
                     'expires_at', forecast.expires_at,
                     'freshness', CASE WHEN forecast.expires_at >= p_as_of THEN 'fresh' ELSE 'stale' END,
                     'risk_route_eligible', forecast.expires_at >= p_as_of,
                     'parser_version', forecast.parser_version,
                     'condition_code', forecast.condition_code,
                     'temperature_celsius', forecast.temperature_celsius,
                     'temperature_min_celsius', forecast.temperature_min_celsius,
                     'temperature_max_celsius', forecast.temperature_max_celsius,
                     'precipitation_mm', forecast.precipitation_mm,
                     'precipitation_probability_percent', forecast.precipitation_probability_percent,
                     'wind_speed_mps', forecast.wind_speed_mps,
                     'wind_gust_mps', forecast.wind_gust_mps,
                     'confidence_percent', forecast.confidence_percent
                 ) AS value
            FROM public.weather_forecasts AS forecast
           WHERE forecast.provider_id = v_provider_id
             AND forecast.status IN ('valid', 'stale')
             AND forecast.fetched_at BETWEEN p_as_of - interval '24 hours' AND p_as_of
             AND forecast.valid_to >= p_as_of
             AND forecast.valid_from <= p_as_of + interval '72 hours'
             AND ((p_target_location_id IS NOT NULL AND forecast.location_id = p_target_location_id) OR
                  (p_target_location_id IS NULL AND public.ST_Equals(forecast.coordinates, v_target)))
           ORDER BY forecast.horizon_kind, forecast.valid_from, forecast.valid_to, forecast.fetched_at DESC
      ) AS normalized;

    SELECT jsonb_build_object(
               'provider_key', provider.external_key,
               'display_name', provider.display_name,
               'attribution_text', provider.attribution_text,
               'terms_url', provider.terms_url
           ) INTO v_source
      FROM public.weather_providers AS provider
     WHERE provider.id = v_provider_id;

    RETURN jsonb_build_object(
        'status', 'available',
        'as_of', p_as_of,
        'source', v_source,
        'observation', v_observation,
        'forecasts', v_forecasts
    );
END;
$function$;

CREATE OR REPLACE FUNCTION app_weather.fetch_weather_bundle_public(
    p_target_location_id uuid DEFAULT NULL,
    p_longitude double precision DEFAULT NULL,
    p_latitude double precision DEFAULT NULL,
    p_as_of timestamptz DEFAULT CURRENT_TIMESTAMP
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
    v_target geometry(Point, 4326);
BEGIN
    IF p_target_location_id IS NOT NULL THEN
        IF p_longitude IS NOT NULL OR p_latitude IS NOT NULL OR NOT EXISTS (
            SELECT 1 FROM public.locations
             WHERE id = p_target_location_id
               AND status = 'published'
        ) THEN
            RAISE EXCEPTION 'Published weather target location does not exist' USING ERRCODE = '22023';
        END IF;
    ELSE
        IF p_longitude IS NULL OR p_latitude IS NULL OR
           p_longitude NOT BETWEEN -180 AND 180 OR p_latitude NOT BETWEEN -90 AND 90 THEN
            RAISE EXCEPTION 'Valid longitude and latitude are required' USING ERRCODE = '22023';
        END IF;
        v_target := public.ST_SetSRID(public.ST_MakePoint(p_longitude, p_latitude), 4326);
        IF NOT EXISTS (
            SELECT 1
              FROM public.administrative_units AS unit
             WHERE unit.country_code = 'VN'
               AND unit.status = 'active'
               AND unit.boundary IS NOT NULL
               AND public.ST_Covers(unit.boundary, v_target)
        ) THEN
            RAISE EXCEPTION 'Weather coordinate is outside the approved Vietnam boundary or boundary data is unavailable'
                USING ERRCODE = '22023';
        END IF;
    END IF;
    RETURN app_weather.fetch_weather_bundle(
        p_target_location_id,
        p_longitude,
        p_latitude,
        p_as_of
    );
END;
$function$;

INSERT INTO directus_fields (
    collection, field, special, interface, options, display, display_options,
    readonly, hidden, sort, width, note, required, searchable
)
SELECT
    column_info.table_name,
    column_info.column_name,
    CASE
        WHEN column_info.udt_name = 'geometry' THEN 'cast-json'
        ELSE NULL
    END,
    CASE
        WHEN column_info.udt_name = 'geometry' THEN 'map'
        WHEN column_info.data_type = 'boolean' THEN 'boolean'
        WHEN column_info.data_type = 'timestamp with time zone' THEN 'datetime'
        WHEN column_info.column_name IN ('request_kind', 'status') THEN 'select-dropdown'
        ELSE 'input'
    END,
    NULL,
    CASE WHEN column_info.udt_name = 'geometry' THEN 'map' ELSE NULL END,
    NULL,
    column_info.column_name IN ('attempt_count', 'lease_owner', 'lease_token', 'lease_expires_at', 'last_heartbeat_at', 'dead_lettered_at'),
    column_info.column_name IN ('lease_token'),
    column_info.ordinal_position,
    'half',
    CASE
        WHEN column_info.column_name = 'target_coordinates' THEN 'Coordinate target is snapped to the approved privacy grid before persistence.'
        WHEN column_info.column_name = 'sanitized_metadata' THEN 'Sanitized operational metadata only; no raw payload, URL, credential, user identity or precise coordinate.'
        ELSE NULL
    END,
    column_info.is_nullable = 'NO' AND column_info.column_default IS NULL,
    column_info.column_name NOT IN ('lease_token', 'target_coordinates')
FROM information_schema.columns AS column_info
WHERE column_info.table_schema = 'public'
  AND column_info.table_name = 'provider_runs'
  AND NOT EXISTS (
      SELECT 1 FROM directus_fields AS field_meta
       WHERE field_meta.collection = column_info.table_name
         AND field_meta.field = column_info.column_name
  );

INSERT INTO directus_relations (
    many_collection, many_field, one_collection, one_field, one_collection_field,
    one_allowed_collections, junction_field, sort_field, one_deselect_action
)
SELECT 'provider_runs', 'target_location_id', 'locations', NULL, NULL, NULL, NULL, NULL, 'nullify'
WHERE NOT EXISTS (
    SELECT 1 FROM directus_relations
     WHERE many_collection = 'provider_runs'
       AND many_field = 'target_location_id'
);

UPDATE directus_panels
   SET options = '{"collection":"provider_runs","field":"id","function":"count","filter":{"status":{"_in":["failed","dead_letter"]}}}'::json,
       note = 'Count of terminal failed or dead-letter provider runs.'
 WHERE id = '5aac223d-c4ae-472c-a070-d08324a02221';

UPDATE directus_presets
   SET filter = '{"status":{"_in":["failed","dead_letter"]}}'::json
 WHERE bookmark = 'Phase 4 - Failed provider runs'
   AND collection = 'provider_runs';

DROP FUNCTION IF EXISTS app_weather.purge_weather_runtime(timestamptz);
CREATE FUNCTION app_weather.purge_weather_runtime(
    p_reference_time timestamptz DEFAULT CURRENT_TIMESTAMP
)
RETURNS TABLE(
    deleted_observations bigint,
    deleted_forecasts bigint,
    deleted_runs bigint,
    deleted_evidence bigint,
    released_route_samples bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
    v_deleted_observations bigint;
    v_deleted_forecasts bigint;
    v_deleted_runs bigint;
    v_deleted_evidence bigint := 0;
    v_released_route_samples bigint := 0;
    v_affected bigint;
BEGIN
    IF p_reference_time IS NULL OR p_reference_time > clock_timestamp() THEN
        RAISE EXCEPTION 'Retention reference time must not be in the future' USING ERRCODE = '22023';
    END IF;

    DELETE FROM public.risk_assessment_evidence AS evidence
     USING public.weather_observations AS observation
     WHERE evidence.weather_observation_id = observation.id
       AND observation.fetched_at < p_reference_time - interval '60 minutes';
    GET DIAGNOSTICS v_deleted_evidence = ROW_COUNT;

    DELETE FROM public.risk_assessment_evidence AS evidence
     USING public.weather_forecasts AS forecast
     WHERE evidence.weather_forecast_id = forecast.id
       AND forecast.fetched_at < p_reference_time - interval '24 hours';
    GET DIAGNOSTICS v_affected = ROW_COUNT;
    v_deleted_evidence := v_deleted_evidence + v_affected;

    UPDATE public.route_samples AS sample
       SET weather_observation_id = NULL,
           freshness_state = 'unavailable'
      FROM public.weather_observations AS observation
     WHERE sample.weather_observation_id = observation.id
       AND observation.fetched_at < p_reference_time - interval '60 minutes';
    GET DIAGNOSTICS v_released_route_samples = ROW_COUNT;

    UPDATE public.route_samples AS sample
       SET weather_forecast_id = NULL,
           freshness_state = 'unavailable'
      FROM public.weather_forecasts AS forecast
     WHERE sample.weather_forecast_id = forecast.id
       AND forecast.fetched_at < p_reference_time - interval '24 hours';
    GET DIAGNOSTICS v_affected = ROW_COUNT;
    v_released_route_samples := v_released_route_samples + v_affected;

    DELETE FROM public.weather_observations AS observation
     WHERE observation.fetched_at < p_reference_time - interval '60 minutes';
    GET DIAGNOSTICS v_deleted_observations = ROW_COUNT;

    DELETE FROM public.weather_forecasts AS forecast
     WHERE forecast.fetched_at < p_reference_time - interval '24 hours';
    GET DIAGNOSTICS v_deleted_forecasts = ROW_COUNT;

    UPDATE public.weather_observations AS observation
       SET provider_run_id = NULL
      FROM public.provider_runs AS run
     WHERE observation.provider_run_id = run.id
       AND run.status IN ('succeeded', 'partial', 'failed', 'dead_letter', 'cancelled')
       AND COALESCE(run.completed_at, run.requested_at) < p_reference_time - interval '30 days';

    UPDATE public.weather_forecasts AS forecast
       SET provider_run_id = NULL
      FROM public.provider_runs AS run
     WHERE forecast.provider_run_id = run.id
       AND run.status IN ('succeeded', 'partial', 'failed', 'dead_letter', 'cancelled')
       AND COALESCE(run.completed_at, run.requested_at) < p_reference_time - interval '30 days';

    DELETE FROM public.provider_runs AS run
     WHERE run.status IN ('succeeded', 'partial', 'failed', 'dead_letter', 'cancelled')
       AND COALESCE(run.completed_at, run.requested_at) < p_reference_time - interval '30 days';
    GET DIAGNOSTICS v_deleted_runs = ROW_COUNT;

    RETURN QUERY SELECT
        v_deleted_observations,
        v_deleted_forecasts,
        v_deleted_runs,
        v_deleted_evidence,
        v_released_route_samples;
END;
$function$;

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM app_weather_api, app_weather_worker;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM app_weather_api, app_weather_worker;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA app_weather FROM PUBLIC, app_weather_api, app_weather_worker;
GRANT USAGE ON SCHEMA app_weather TO app_weather_api, app_weather_worker;

GRANT EXECUTE ON FUNCTION app_weather.enqueue_weather_run(
    uuid, text, text, text, uuid, double precision, double precision, integer, timestamptz, jsonb
) TO app_weather_api;
GRANT EXECUTE ON FUNCTION app_weather.enqueue_weather_run_by_provider_key(
    text, text, text, text, uuid, double precision, double precision, integer, timestamptz, jsonb
) TO app_weather_api;
GRANT EXECUTE ON FUNCTION app_weather.fetch_weather_capabilities(text) TO app_weather_api;
GRANT EXECUTE ON FUNCTION app_weather.fetch_weather_bundle(
    uuid, double precision, double precision, timestamptz
) TO app_weather_worker;
GRANT EXECUTE ON FUNCTION app_weather.fetch_weather_bundle_public(
    uuid, double precision, double precision, timestamptz
) TO app_weather_api;

GRANT EXECUTE ON FUNCTION app_weather.claim_weather_run(text, interval) TO app_weather_worker;
GRANT EXECUTE ON FUNCTION app_weather.heartbeat_weather_run(uuid, uuid, text, interval) TO app_weather_worker;
GRANT EXECUTE ON FUNCTION app_weather.persist_weather_bundle(uuid, uuid, jsonb, jsonb) TO app_weather_worker;
GRANT EXECUTE ON FUNCTION app_weather.complete_weather_run(uuid, uuid, text, integer, integer, text, text) TO app_weather_worker;
GRANT EXECUTE ON FUNCTION app_weather.retry_weather_run(uuid, uuid, timestamptz, text, text) TO app_weather_worker;
GRANT EXECUTE ON FUNCTION app_weather.fail_weather_run(uuid, uuid, text, text) TO app_weather_worker;

REVOKE ALL ON FUNCTION app_weather.purge_weather_runtime(timestamptz) FROM PUBLIC, app_weather_api, app_weather_worker;

COMMIT;
