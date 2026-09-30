-- Apply after 005-create-phase5-weather-runtime.sql using the existing table/function
-- owner (or an administrative migration role). Existing rows remain NULL; only
-- newly ingested normalized measurements populate these columns.
BEGIN;

ALTER TABLE public.weather_observations
    ADD COLUMN IF NOT EXISTS uv_index numeric(6, 3) NULL,
    ADD COLUMN IF NOT EXISTS cloud_cover_percent numeric(6, 3) NULL;

ALTER TABLE public.weather_forecasts
    ADD COLUMN IF NOT EXISTS feels_like_celsius numeric(7, 3) NULL,
    ADD COLUMN IF NOT EXISTS humidity_percent numeric(6, 3) NULL,
    ADD COLUMN IF NOT EXISTS wind_direction_degrees numeric(7, 3) NULL,
    ADD COLUMN IF NOT EXISTS pressure_hpa numeric(10, 3) NULL,
    ADD COLUMN IF NOT EXISTS visibility_meters numeric(12, 3) NULL,
    ADD COLUMN IF NOT EXISTS uv_index numeric(6, 3) NULL,
    ADD COLUMN IF NOT EXISTS cloud_cover_percent numeric(6, 3) NULL;

-- Definitions below are based on 005. CREATE OR REPLACE retains existing owners
-- and EXECUTE grants, including later grants; no role/table permissions change.
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
                     'uv_index', 'cloud_cover_percent',
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
                     'feels_like_celsius', 'humidity_percent', 'wind_direction_degrees',
                     'pressure_hpa', 'visibility_meters', 'uv_index', 'cloud_cover_percent',
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
              uv_index numeric(6, 3),
              cloud_cover_percent numeric(6, 3),
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
            uv_index, cloud_cover_percent,
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
            v_observation.visibility_meters, v_observation.uv_index, v_observation.cloud_cover_percent,
            COALESCE(v_observation.source_quality, 'reported'),
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
              feels_like_celsius numeric(7, 3),
              humidity_percent numeric(6, 3),
              wind_direction_degrees numeric(7, 3),
              pressure_hpa numeric(10, 3),
              visibility_meters numeric(12, 3),
              uv_index numeric(6, 3),
              cloud_cover_percent numeric(6, 3),
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
            wind_speed_mps, wind_gust_mps, feels_like_celsius, humidity_percent,
            wind_direction_degrees, pressure_hpa, visibility_meters, uv_index, cloud_cover_percent,
            confidence_percent, status
        ) VALUES (
            v_run.provider_id, v_run.id, v_run.target_location_id, v_run.target_coordinates,
            v_forecast.idempotency_key, v_forecast.normalized_payload_checksum_sha256,
            v_forecast.provider_record_id, v_forecast.horizon_kind, v_forecast.provider_issued_at,
            v_forecast.valid_from, v_forecast.valid_to, v_forecast.fetched_at,
            v_forecast.expires_at, v_run.parser_version, v_forecast.condition_code,
            v_forecast.temperature_celsius, v_forecast.temperature_min_celsius,
            v_forecast.temperature_max_celsius, v_forecast.precipitation_mm,
            v_forecast.precipitation_probability_percent, v_forecast.wind_speed_mps,
            v_forecast.wind_gust_mps, v_forecast.feels_like_celsius, v_forecast.humidity_percent,
            v_forecast.wind_direction_degrees, v_forecast.pressure_hpa, v_forecast.visibility_meters,
            v_forecast.uv_index, v_forecast.cloud_cover_percent, v_forecast.confidence_percent,
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

-- fetch_weather_bundle_public in 005 delegates to this function after checking
-- published locations / the approved Vietnam boundary. Keep that wrapper intact.
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
               'uv_index', observation.uv_index,
               'cloud_cover_percent', observation.cloud_cover_percent,
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
                     'feels_like_celsius', forecast.feels_like_celsius,
                     'humidity_percent', forecast.humidity_percent,
                     'wind_direction_degrees', forecast.wind_direction_degrees,
                     'pressure_hpa', forecast.pressure_hpa,
                     'visibility_meters', forecast.visibility_meters,
                     'uv_index', forecast.uv_index,
                     'cloud_cover_percent', forecast.cloud_cover_percent,
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

COMMIT;
