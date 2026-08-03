BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE SCHEMA IF NOT EXISTS app_governance;

CREATE TABLE IF NOT EXISTS supported_locales (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    external_key varchar(32) NOT NULL UNIQUE,
    display_name varchar(128) NOT NULL,
    enabled boolean NOT NULL DEFAULT true,
    is_default boolean NOT NULL DEFAULT false,
    sort integer NOT NULL DEFAULT 0,
    user_created uuid NULL REFERENCES directus_users(id) ON DELETE SET NULL,
    date_created timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    user_updated uuid NULL REFERENCES directus_users(id) ON DELETE SET NULL,
    date_updated timestamptz NULL,
    CONSTRAINT supported_locales_external_key_ck CHECK (external_key ~ '^[a-z][a-z0-9_-]{1,31}$')
);

CREATE UNIQUE INDEX IF NOT EXISTS supported_locales_one_default_idx
    ON supported_locales (is_default) WHERE is_default;

CREATE TABLE IF NOT EXISTS reference_sources (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    external_key varchar(128) NOT NULL UNIQUE,
    name varchar(255) NOT NULL,
    publisher varchar(255) NOT NULL,
    source_url text NOT NULL,
    publication_version varchar(128) NOT NULL,
    publication_date date NULL,
    license_name varchar(255) NULL,
    license_url text NULL,
    checksum_sha256 char(64) NULL,
    status varchar(32) NOT NULL DEFAULT 'draft',
    approved_by uuid NULL REFERENCES directus_users(id) ON DELETE SET NULL,
    approved_at timestamptz NULL,
    notes text NULL,
    user_created uuid NULL REFERENCES directus_users(id) ON DELETE SET NULL,
    date_created timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    user_updated uuid NULL REFERENCES directus_users(id) ON DELETE SET NULL,
    date_updated timestamptz NULL,
    CONSTRAINT reference_sources_external_key_ck CHECK (external_key ~ '^[a-z0-9][a-z0-9._-]{1,127}$'),
    CONSTRAINT reference_sources_checksum_ck CHECK (checksum_sha256 IS NULL OR checksum_sha256 ~ '^[0-9a-f]{64}$'),
    CONSTRAINT reference_sources_status_ck CHECK (status IN ('draft', 'approved', 'retired')),
    CONSTRAINT reference_sources_approval_ck CHECK ((status = 'draft') OR (approved_by IS NOT NULL AND approved_at IS NOT NULL))
);

CREATE TABLE IF NOT EXISTS administrative_versions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    external_key varchar(128) NOT NULL UNIQUE,
    reference_source_id uuid NOT NULL REFERENCES reference_sources(id) ON DELETE RESTRICT,
    version_label varchar(128) NOT NULL,
    effective_from date NOT NULL,
    effective_to date NULL,
    checksum_sha256 char(64) NOT NULL,
    status varchar(32) NOT NULL DEFAULT 'draft',
    approved_by uuid NULL REFERENCES directus_users(id) ON DELETE SET NULL,
    approved_at timestamptz NULL,
    user_created uuid NULL REFERENCES directus_users(id) ON DELETE SET NULL,
    date_created timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    user_updated uuid NULL REFERENCES directus_users(id) ON DELETE SET NULL,
    date_updated timestamptz NULL,
    CONSTRAINT administrative_versions_external_key_ck CHECK (external_key ~ '^[a-z0-9][a-z0-9._-]{1,127}$'),
    CONSTRAINT administrative_versions_dates_ck CHECK (effective_to IS NULL OR effective_to >= effective_from),
    CONSTRAINT administrative_versions_checksum_ck CHECK (checksum_sha256 ~ '^[0-9a-f]{64}$'),
    CONSTRAINT administrative_versions_status_ck CHECK (status IN ('draft', 'approved', 'retired')),
    CONSTRAINT administrative_versions_approval_ck CHECK ((status = 'draft') OR (approved_by IS NOT NULL AND approved_at IS NOT NULL))
);

CREATE TABLE IF NOT EXISTS administrative_units (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    administrative_version_id uuid NOT NULL REFERENCES administrative_versions(id) ON DELETE RESTRICT,
    parent_id uuid NULL REFERENCES administrative_units(id) ON DELETE RESTRICT,
    external_key varchar(128) NOT NULL,
    official_code varchar(64) NULL,
    country_code char(2) NOT NULL,
    unit_type varchar(32) NOT NULL,
    canonical_name varchar(255) NOT NULL,
    ascii_name varchar(255) NULL,
    centroid geometry(Point, 4326) NULL,
    boundary geometry(MultiPolygon, 4326) NULL,
    valid_from date NOT NULL,
    valid_to date NULL,
    status varchar(32) NOT NULL DEFAULT 'active',
    sort integer NOT NULL DEFAULT 0,
    user_created uuid NULL REFERENCES directus_users(id) ON DELETE SET NULL,
    date_created timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    user_updated uuid NULL REFERENCES directus_users(id) ON DELETE SET NULL,
    date_updated timestamptz NULL,
    CONSTRAINT administrative_units_external_key_ck CHECK (external_key ~ '^[a-z0-9][a-z0-9._-]{1,127}$'),
    CONSTRAINT administrative_units_country_code_ck CHECK (country_code ~ '^[A-Z]{2}$'),
    CONSTRAINT administrative_units_type_ck CHECK (unit_type IN (
        'country', 'province', 'municipality', 'district', 'urban_district', 'rural_district',
        'provincial_city', 'town', 'ward', 'commune', 'township', 'other'
    )),
    CONSTRAINT administrative_units_dates_ck CHECK (valid_to IS NULL OR valid_to >= valid_from),
    CONSTRAINT administrative_units_status_ck CHECK (status IN ('active', 'retired')),
    CONSTRAINT administrative_units_version_key_uq UNIQUE (administrative_version_id, external_key),
    CONSTRAINT administrative_units_version_code_uq UNIQUE (administrative_version_id, official_code)
);

DO $do$
BEGIN
    IF EXISTS (
        SELECT 1
          FROM pg_constraint
         WHERE conrelid = 'administrative_units'::regclass
           AND conname = 'administrative_units_version_code_uq'
           AND pg_get_constraintdef(oid) ILIKE '%NULLS NOT DISTINCT%'
    ) THEN
        ALTER TABLE administrative_units DROP CONSTRAINT administrative_units_version_code_uq;
        ALTER TABLE administrative_units
            ADD CONSTRAINT administrative_units_version_code_uq UNIQUE (administrative_version_id, official_code);
    END IF;
END
$do$;

CREATE INDEX IF NOT EXISTS administrative_units_parent_idx ON administrative_units (parent_id);
CREATE INDEX IF NOT EXISTS administrative_units_version_type_idx ON administrative_units (administrative_version_id, unit_type, status);
CREATE INDEX IF NOT EXISTS administrative_units_centroid_gix ON administrative_units USING gist (centroid);
CREATE INDEX IF NOT EXISTS administrative_units_boundary_gix ON administrative_units USING gist (boundary);

CREATE TABLE IF NOT EXISTS locations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    external_key varchar(128) NOT NULL UNIQUE,
    administrative_unit_id uuid NULL REFERENCES administrative_units(id) ON DELETE RESTRICT,
    reference_source_id uuid NULL REFERENCES reference_sources(id) ON DELETE RESTRICT,
    location_type varchar(32) NOT NULL,
    canonical_name varchar(255) NOT NULL,
    coordinates geometry(Point, 4326) NOT NULL,
    timezone varchar(64) NULL,
    elevation_meters numeric(10, 2) NULL,
    status varchar(32) NOT NULL DEFAULT 'draft',
    submitted_by uuid NULL REFERENCES directus_users(id) ON DELETE SET NULL,
    submitted_at timestamptz NULL,
    approved_by uuid NULL REFERENCES directus_users(id) ON DELETE SET NULL,
    approved_at timestamptz NULL,
    published_by uuid NULL REFERENCES directus_users(id) ON DELETE SET NULL,
    published_at timestamptz NULL,
    user_created uuid NULL REFERENCES directus_users(id) ON DELETE SET NULL,
    date_created timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    user_updated uuid NULL REFERENCES directus_users(id) ON DELETE SET NULL,
    date_updated timestamptz NULL,
    CONSTRAINT locations_external_key_ck CHECK (external_key ~ '^[a-z0-9][a-z0-9._-]{1,127}$'),
    CONSTRAINT locations_type_ck CHECK (location_type IN (
        'administrative', 'tourist_attraction', 'city_center', 'airport', 'station',
        'beach', 'mountain', 'island', 'park', 'other'
    )),
    CONSTRAINT locations_status_ck CHECK (status IN ('draft', 'review', 'approved', 'published', 'retired'))
);

CREATE INDEX IF NOT EXISTS locations_admin_status_idx ON locations (administrative_unit_id, status);
CREATE INDEX IF NOT EXISTS locations_coordinates_gix ON locations USING gist (coordinates);

CREATE TABLE IF NOT EXISTS location_aliases (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    location_id uuid NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
    locale_id uuid NULL REFERENCES supported_locales(id) ON DELETE RESTRICT,
    reference_source_id uuid NULL REFERENCES reference_sources(id) ON DELETE RESTRICT,
    alias varchar(255) NOT NULL,
    normalized_alias varchar(255) NOT NULL,
    alias_type varchar(32) NOT NULL DEFAULT 'common',
    user_created uuid NULL REFERENCES directus_users(id) ON DELETE SET NULL,
    date_created timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    user_updated uuid NULL REFERENCES directus_users(id) ON DELETE SET NULL,
    date_updated timestamptz NULL,
    CONSTRAINT location_aliases_type_ck CHECK (alias_type IN ('official', 'common', 'historical', 'provider')),
    CONSTRAINT location_aliases_unique_uq UNIQUE NULLS NOT DISTINCT (location_id, locale_id, normalized_alias)
);

CREATE INDEX IF NOT EXISTS location_aliases_search_idx ON location_aliases (normalized_alias);

CREATE TABLE IF NOT EXISTS location_provider_mappings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    location_id uuid NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
    reference_source_id uuid NULL REFERENCES reference_sources(id) ON DELETE RESTRICT,
    provider_domain varchar(32) NOT NULL,
    provider_key varchar(128) NOT NULL,
    provider_location_id varchar(255) NOT NULL,
    valid_from timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    valid_to timestamptz NULL,
    metadata jsonb NULL,
    user_created uuid NULL REFERENCES directus_users(id) ON DELETE SET NULL,
    date_created timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    user_updated uuid NULL REFERENCES directus_users(id) ON DELETE SET NULL,
    date_updated timestamptz NULL,
    CONSTRAINT location_provider_mappings_domain_ck CHECK (provider_domain IN ('weather', 'geocoding', 'routing', 'map')),
    CONSTRAINT location_provider_mappings_dates_ck CHECK (valid_to IS NULL OR valid_to >= valid_from),
    CONSTRAINT location_provider_mappings_provider_uq UNIQUE (provider_domain, provider_key, provider_location_id)
);

CREATE TABLE IF NOT EXISTS weather_providers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    external_key varchar(128) NOT NULL UNIQUE,
    display_name varchar(255) NOT NULL,
    base_url text NOT NULL,
    credential_reference varchar(255) NOT NULL,
    terms_url text NULL,
    attribution_text text NULL,
    capabilities jsonb NOT NULL DEFAULT '{}'::jsonb,
    rate_limit_policy jsonb NULL,
    last_verified_at timestamptz NULL,
    status varchar(32) NOT NULL DEFAULT 'disabled',
    user_created uuid NULL REFERENCES directus_users(id) ON DELETE SET NULL,
    date_created timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    user_updated uuid NULL REFERENCES directus_users(id) ON DELETE SET NULL,
    date_updated timestamptz NULL,
    CONSTRAINT weather_providers_external_key_ck CHECK (external_key ~ '^[a-z0-9][a-z0-9._-]{1,127}$'),
    CONSTRAINT weather_providers_status_ck CHECK (status IN ('disabled', 'testing', 'active', 'degraded', 'retired')),
    CONSTRAINT weather_providers_no_inline_secret_ck CHECK (credential_reference !~* '(api[_-]?key|secret|token)=[^& ]+')
);

CREATE TABLE IF NOT EXISTS provider_runs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_id uuid NOT NULL REFERENCES weather_providers(id) ON DELETE RESTRICT,
    run_type varchar(32) NOT NULL,
    idempotency_key varchar(255) NOT NULL,
    status varchar(32) NOT NULL DEFAULT 'pending',
    parser_version varchar(128) NOT NULL,
    requested_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    started_at timestamptz NULL,
    completed_at timestamptz NULL,
    records_received integer NOT NULL DEFAULT 0,
    records_written integer NOT NULL DEFAULT 0,
    error_code varchar(128) NULL,
    error_message text NULL,
    sanitized_metadata jsonb NULL,
    user_created uuid NULL REFERENCES directus_users(id) ON DELETE SET NULL,
    date_created timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    user_updated uuid NULL REFERENCES directus_users(id) ON DELETE SET NULL,
    date_updated timestamptz NULL,
    CONSTRAINT provider_runs_type_ck CHECK (run_type IN ('current', 'forecast', 'backfill', 'capability_probe')),
    CONSTRAINT provider_runs_status_ck CHECK (status IN ('pending', 'running', 'succeeded', 'partial', 'failed', 'cancelled')),
    CONSTRAINT provider_runs_counts_ck CHECK (records_received >= 0 AND records_written >= 0 AND records_written <= records_received),
    CONSTRAINT provider_runs_dates_ck CHECK (completed_at IS NULL OR started_at IS NOT NULL AND completed_at >= started_at),
    CONSTRAINT provider_runs_idempotency_uq UNIQUE (provider_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS provider_runs_status_started_idx ON provider_runs (status, started_at DESC);

CREATE TABLE IF NOT EXISTS weather_observations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_id uuid NOT NULL REFERENCES weather_providers(id) ON DELETE RESTRICT,
    provider_run_id uuid NULL REFERENCES provider_runs(id) ON DELETE RESTRICT,
    location_id uuid NOT NULL REFERENCES locations(id) ON DELETE RESTRICT,
    idempotency_key varchar(255) NOT NULL,
    provider_record_id varchar(255) NULL,
    observed_at timestamptz NOT NULL,
    fetched_at timestamptz NOT NULL,
    expires_at timestamptz NOT NULL,
    parser_version varchar(128) NOT NULL,
    condition_code varchar(128) NULL,
    temperature_celsius numeric(7, 3) NULL,
    feels_like_celsius numeric(7, 3) NULL,
    humidity_percent numeric(6, 3) NULL,
    precipitation_mm numeric(10, 3) NULL,
    wind_speed_mps numeric(10, 3) NULL,
    wind_gust_mps numeric(10, 3) NULL,
    wind_direction_degrees numeric(7, 3) NULL,
    pressure_hpa numeric(10, 3) NULL,
    visibility_meters numeric(12, 3) NULL,
    source_quality varchar(32) NOT NULL DEFAULT 'reported',
    status varchar(32) NOT NULL DEFAULT 'valid',
    user_created uuid NULL REFERENCES directus_users(id) ON DELETE SET NULL,
    date_created timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT weather_observations_times_ck CHECK (fetched_at >= observed_at AND expires_at >= fetched_at),
    CONSTRAINT weather_observations_humidity_ck CHECK (humidity_percent IS NULL OR humidity_percent BETWEEN 0 AND 100),
    CONSTRAINT weather_observations_precip_ck CHECK (precipitation_mm IS NULL OR precipitation_mm >= 0),
    CONSTRAINT weather_observations_wind_ck CHECK ((wind_speed_mps IS NULL OR wind_speed_mps >= 0) AND (wind_gust_mps IS NULL OR wind_gust_mps >= 0)),
    CONSTRAINT weather_observations_direction_ck CHECK (wind_direction_degrees IS NULL OR wind_direction_degrees BETWEEN 0 AND 360),
    CONSTRAINT weather_observations_quality_ck CHECK (source_quality IN ('reported', 'derived', 'estimated')),
    CONSTRAINT weather_observations_status_ck CHECK (status IN ('valid', 'stale', 'invalid', 'superseded')),
    CONSTRAINT weather_observations_idempotency_uq UNIQUE (provider_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS weather_observations_location_time_idx ON weather_observations (location_id, observed_at DESC);
CREATE INDEX IF NOT EXISTS weather_observations_provider_fetched_idx ON weather_observations (provider_id, fetched_at DESC);
CREATE INDEX IF NOT EXISTS weather_observations_expiry_idx ON weather_observations (expires_at);

CREATE TABLE IF NOT EXISTS weather_forecasts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_id uuid NOT NULL REFERENCES weather_providers(id) ON DELETE RESTRICT,
    provider_run_id uuid NULL REFERENCES provider_runs(id) ON DELETE RESTRICT,
    location_id uuid NOT NULL REFERENCES locations(id) ON DELETE RESTRICT,
    idempotency_key varchar(255) NOT NULL,
    provider_record_id varchar(255) NULL,
    horizon_kind varchar(32) NOT NULL,
    issued_at timestamptz NULL,
    valid_from timestamptz NOT NULL,
    valid_to timestamptz NOT NULL,
    fetched_at timestamptz NOT NULL,
    expires_at timestamptz NOT NULL,
    parser_version varchar(128) NOT NULL,
    condition_code varchar(128) NULL,
    temperature_celsius numeric(7, 3) NULL,
    temperature_min_celsius numeric(7, 3) NULL,
    temperature_max_celsius numeric(7, 3) NULL,
    precipitation_mm numeric(10, 3) NULL,
    precipitation_probability_percent numeric(6, 3) NULL,
    wind_speed_mps numeric(10, 3) NULL,
    wind_gust_mps numeric(10, 3) NULL,
    confidence_percent numeric(6, 3) NULL,
    status varchar(32) NOT NULL DEFAULT 'valid',
    user_created uuid NULL REFERENCES directus_users(id) ON DELETE SET NULL,
    date_created timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT weather_forecasts_horizon_ck CHECK (horizon_kind IN ('current', 'hourly', 'daily', 'outlook')),
    CONSTRAINT weather_forecasts_times_ck CHECK (valid_to >= valid_from AND fetched_at <= expires_at),
    CONSTRAINT weather_forecasts_probability_ck CHECK (precipitation_probability_percent IS NULL OR precipitation_probability_percent BETWEEN 0 AND 100),
    CONSTRAINT weather_forecasts_confidence_ck CHECK (confidence_percent IS NULL OR confidence_percent BETWEEN 0 AND 100),
    CONSTRAINT weather_forecasts_status_ck CHECK (status IN ('valid', 'stale', 'unsupported_horizon', 'invalid', 'superseded')),
    CONSTRAINT weather_forecasts_idempotency_uq UNIQUE (provider_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS weather_forecasts_location_valid_idx ON weather_forecasts (location_id, valid_from, valid_to);
CREATE INDEX IF NOT EXISTS weather_forecasts_provider_issued_idx ON weather_forecasts (provider_id, issued_at DESC);
CREATE INDEX IF NOT EXISTS weather_forecasts_expiry_idx ON weather_forecasts (expires_at);

CREATE TABLE IF NOT EXISTS risk_rule_sets (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    external_key varchar(128) NOT NULL,
    version integer NOT NULL,
    name varchar(255) NOT NULL,
    description text NOT NULL,
    reference_source_id uuid NOT NULL REFERENCES reference_sources(id) ON DELETE RESTRICT,
    status varchar(32) NOT NULL DEFAULT 'draft',
    effective_from timestamptz NULL,
    effective_to timestamptz NULL,
    submitted_by uuid NULL REFERENCES directus_users(id) ON DELETE SET NULL,
    submitted_at timestamptz NULL,
    approved_by uuid NULL REFERENCES directus_users(id) ON DELETE SET NULL,
    approved_at timestamptz NULL,
    published_by uuid NULL REFERENCES directus_users(id) ON DELETE SET NULL,
    published_at timestamptz NULL,
    user_created uuid NULL REFERENCES directus_users(id) ON DELETE SET NULL,
    date_created timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    user_updated uuid NULL REFERENCES directus_users(id) ON DELETE SET NULL,
    date_updated timestamptz NULL,
    CONSTRAINT risk_rule_sets_external_key_ck CHECK (external_key ~ '^[a-z0-9][a-z0-9._-]{1,127}$'),
    CONSTRAINT risk_rule_sets_version_ck CHECK (version > 0),
    CONSTRAINT risk_rule_sets_status_ck CHECK (status IN ('draft', 'review', 'approved', 'published', 'retired')),
    CONSTRAINT risk_rule_sets_dates_ck CHECK (effective_to IS NULL OR effective_from IS NOT NULL AND effective_to >= effective_from),
    CONSTRAINT risk_rule_sets_key_version_uq UNIQUE (external_key, version)
);

CREATE TABLE IF NOT EXISTS risk_rules (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_set_id uuid NOT NULL REFERENCES risk_rule_sets(id) ON DELETE RESTRICT,
    external_key varchar(128) NOT NULL,
    sort integer NOT NULL DEFAULT 0,
    enabled boolean NOT NULL DEFAULT true,
    input_key varchar(128) NOT NULL,
    operator varchar(32) NOT NULL,
    threshold_value numeric(18, 6) NULL,
    threshold_upper_value numeric(18, 6) NULL,
    threshold_unit varchar(64) NULL,
    severity varchar(32) NOT NULL,
    weight numeric(10, 6) NOT NULL DEFAULT 1,
    condition jsonb NULL,
    explanation_key varchar(255) NOT NULL,
    source_reference text NOT NULL,
    notes text NULL,
    user_created uuid NULL REFERENCES directus_users(id) ON DELETE SET NULL,
    date_created timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    user_updated uuid NULL REFERENCES directus_users(id) ON DELETE SET NULL,
    date_updated timestamptz NULL,
    CONSTRAINT risk_rules_external_key_ck CHECK (external_key ~ '^[a-z0-9][a-z0-9._-]{1,127}$'),
    CONSTRAINT risk_rules_operator_ck CHECK (operator IN ('gt', 'gte', 'lt', 'lte', 'between', 'eq', 'in', 'missing')),
    CONSTRAINT risk_rules_threshold_unit_ck CHECK ((threshold_value IS NULL AND threshold_upper_value IS NULL) OR threshold_unit IS NOT NULL),
    CONSTRAINT risk_rules_between_ck CHECK (operator <> 'between' OR threshold_value IS NOT NULL AND threshold_upper_value IS NOT NULL AND threshold_upper_value >= threshold_value),
    CONSTRAINT risk_rules_severity_ck CHECK (severity IN ('unknown', 'low', 'moderate', 'high', 'severe')),
    CONSTRAINT risk_rules_weight_ck CHECK (weight >= 0),
    CONSTRAINT risk_rules_set_key_uq UNIQUE (rule_set_id, external_key)
);

CREATE INDEX IF NOT EXISTS risk_rules_set_sort_idx ON risk_rules (rule_set_id, sort);

CREATE TABLE IF NOT EXISTS risk_assessments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    idempotency_key varchar(255) NOT NULL UNIQUE,
    rule_set_id uuid NOT NULL REFERENCES risk_rule_sets(id) ON DELETE RESTRICT,
    location_id uuid NULL REFERENCES locations(id) ON DELETE RESTRICT,
    assessed_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    horizon_end timestamptz NULL,
    level varchar(32) NOT NULL,
    score numeric(12, 6) NULL,
    confidence_percent numeric(6, 3) NULL,
    explanation_code varchar(255) NOT NULL,
    status varchar(32) NOT NULL DEFAULT 'complete',
    evidence_summary jsonb NULL,
    user_created uuid NULL REFERENCES directus_users(id) ON DELETE SET NULL,
    date_created timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT risk_assessments_level_ck CHECK (level IN ('unknown', 'low', 'moderate', 'high', 'severe')),
    CONSTRAINT risk_assessments_confidence_ck CHECK (confidence_percent IS NULL OR confidence_percent BETWEEN 0 AND 100),
    CONSTRAINT risk_assessments_status_ck CHECK (status IN ('complete', 'incomplete', 'unsupported_horizon', 'failed'))
);

CREATE INDEX IF NOT EXISTS risk_assessments_location_time_idx ON risk_assessments (location_id, assessed_at DESC);

CREATE TABLE IF NOT EXISTS risk_assessment_evidence (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    risk_assessment_id uuid NOT NULL REFERENCES risk_assessments(id) ON DELETE CASCADE,
    weather_observation_id uuid NULL REFERENCES weather_observations(id) ON DELETE RESTRICT,
    weather_forecast_id uuid NULL REFERENCES weather_forecasts(id) ON DELETE RESTRICT,
    sequence integer NOT NULL DEFAULT 0,
    valid_at timestamptz NOT NULL,
    freshness_state varchar(32) NOT NULL,
    evidence_role varchar(32) NOT NULL DEFAULT 'input',
    user_created uuid NULL REFERENCES directus_users(id) ON DELETE SET NULL,
    date_created timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT risk_assessment_evidence_source_ck CHECK (
        (weather_observation_id IS NOT NULL)::integer + (weather_forecast_id IS NOT NULL)::integer = 1
    ),
    CONSTRAINT risk_assessment_evidence_freshness_ck CHECK (freshness_state IN ('fresh', 'stale', 'mismatch', 'unknown')),
    CONSTRAINT risk_assessment_evidence_role_ck CHECK (evidence_role IN ('input', 'trigger', 'context')),
    CONSTRAINT risk_assessment_evidence_sequence_uq UNIQUE (risk_assessment_id, sequence)
);

CREATE TABLE IF NOT EXISTS risk_advisories (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    external_key varchar(128) NOT NULL,
    version integer NOT NULL,
    administrative_unit_id uuid NULL REFERENCES administrative_units(id) ON DELETE RESTRICT,
    location_id uuid NULL REFERENCES locations(id) ON DELETE RESTRICT,
    rule_set_id uuid NULL REFERENCES risk_rule_sets(id) ON DELETE RESTRICT,
    reference_source_id uuid NOT NULL REFERENCES reference_sources(id) ON DELETE RESTRICT,
    title_translation_key varchar(255) NOT NULL,
    body_translation_key varchar(255) NOT NULL,
    official_url text NOT NULL,
    status varchar(32) NOT NULL DEFAULT 'draft',
    effective_from timestamptz NULL,
    effective_to timestamptz NULL,
    submitted_by uuid NULL REFERENCES directus_users(id) ON DELETE SET NULL,
    submitted_at timestamptz NULL,
    approved_by uuid NULL REFERENCES directus_users(id) ON DELETE SET NULL,
    approved_at timestamptz NULL,
    published_by uuid NULL REFERENCES directus_users(id) ON DELETE SET NULL,
    published_at timestamptz NULL,
    user_created uuid NULL REFERENCES directus_users(id) ON DELETE SET NULL,
    date_created timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    user_updated uuid NULL REFERENCES directus_users(id) ON DELETE SET NULL,
    date_updated timestamptz NULL,
    CONSTRAINT risk_advisories_external_key_ck CHECK (external_key ~ '^[a-z0-9][a-z0-9._-]{1,127}$'),
    CONSTRAINT risk_advisories_version_ck CHECK (version > 0),
    CONSTRAINT risk_advisories_scope_ck CHECK (administrative_unit_id IS NOT NULL OR location_id IS NOT NULL),
    CONSTRAINT risk_advisories_status_ck CHECK (status IN ('draft', 'review', 'approved', 'published', 'retired')),
    CONSTRAINT risk_advisories_dates_ck CHECK (effective_to IS NULL OR effective_from IS NOT NULL AND effective_to >= effective_from),
    CONSTRAINT risk_advisories_key_version_uq UNIQUE (external_key, version)
);

CREATE TABLE IF NOT EXISTS route_requests (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id uuid NOT NULL REFERENCES directus_users(id) ON DELETE CASCADE,
    idempotency_key varchar(255) NOT NULL,
    provider_key varchar(128) NOT NULL,
    provider_request_reference varchar(255) NULL,
    origin_coordinates geometry(Point, 4326) NOT NULL,
    destination_coordinates geometry(Point, 4326) NOT NULL,
    departure_at timestamptz NOT NULL,
    travel_mode varchar(32) NOT NULL,
    status varchar(32) NOT NULL DEFAULT 'pending',
    history_expires_at timestamptz NOT NULL,
    error_code varchar(128) NULL,
    user_created uuid NULL REFERENCES directus_users(id) ON DELETE SET NULL,
    date_created timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    user_updated uuid NULL REFERENCES directus_users(id) ON DELETE SET NULL,
    date_updated timestamptz NULL,
    CONSTRAINT route_requests_mode_ck CHECK (travel_mode IN ('drive', 'motorcycle', 'bicycle', 'walk')),
    CONSTRAINT route_requests_status_ck CHECK (status IN ('pending', 'running', 'complete', 'no_route', 'failed', 'expired')),
    CONSTRAINT route_requests_retention_ck CHECK (history_expires_at > date_created),
    CONSTRAINT route_requests_owner_idempotency_uq UNIQUE (owner_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS route_requests_owner_created_idx ON route_requests (owner_id, date_created DESC);
CREATE INDEX IF NOT EXISTS route_requests_expiry_idx ON route_requests (history_expires_at);
CREATE INDEX IF NOT EXISTS route_requests_origin_gix ON route_requests USING gist (origin_coordinates);
CREATE INDEX IF NOT EXISTS route_requests_destination_gix ON route_requests USING gist (destination_coordinates);

CREATE TABLE IF NOT EXISTS route_options (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    route_request_id uuid NOT NULL REFERENCES route_requests(id) ON DELETE CASCADE,
    provider_option_reference varchar(255) NOT NULL,
    option_index integer NOT NULL,
    objective varchar(32) NOT NULL,
    distance_meters numeric(14, 3) NOT NULL,
    duration_seconds integer NOT NULL,
    geometry geometry(LineString, 4326) NOT NULL,
    geometry_checksum_sha256 char(64) NOT NULL,
    status varchar(32) NOT NULL DEFAULT 'valid',
    user_created uuid NULL REFERENCES directus_users(id) ON DELETE SET NULL,
    date_created timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT route_options_index_ck CHECK (option_index >= 0),
    CONSTRAINT route_options_objective_ck CHECK (objective IN ('provider', 'fastest', 'shortest', 'weather_safer', 'balanced')),
    CONSTRAINT route_options_metrics_ck CHECK (distance_meters >= 0 AND duration_seconds >= 0),
    CONSTRAINT route_options_checksum_ck CHECK (geometry_checksum_sha256 ~ '^[0-9a-f]{64}$'),
    CONSTRAINT route_options_status_ck CHECK (status IN ('valid', 'invalid', 'expired')),
    CONSTRAINT route_options_request_provider_uq UNIQUE (route_request_id, provider_option_reference),
    CONSTRAINT route_options_request_index_uq UNIQUE (route_request_id, option_index)
);

CREATE INDEX IF NOT EXISTS route_options_geometry_gix ON route_options USING gist (geometry);

CREATE TABLE IF NOT EXISTS route_samples (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    route_option_id uuid NOT NULL REFERENCES route_options(id) ON DELETE CASCADE,
    sequence integer NOT NULL,
    coordinates geometry(Point, 4326) NOT NULL,
    eta timestamptz NOT NULL,
    cumulative_distance_meters numeric(14, 3) NOT NULL,
    weather_observation_id uuid NULL REFERENCES weather_observations(id) ON DELETE RESTRICT,
    weather_forecast_id uuid NULL REFERENCES weather_forecasts(id) ON DELETE RESTRICT,
    freshness_state varchar(32) NOT NULL,
    user_created uuid NULL REFERENCES directus_users(id) ON DELETE SET NULL,
    date_created timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT route_samples_sequence_ck CHECK (sequence >= 0),
    CONSTRAINT route_samples_distance_ck CHECK (cumulative_distance_meters >= 0),
    CONSTRAINT route_samples_weather_source_ck CHECK (
        (weather_observation_id IS NOT NULL)::integer + (weather_forecast_id IS NOT NULL)::integer <= 1
    ),
    CONSTRAINT route_samples_freshness_ck CHECK (freshness_state IN ('fresh', 'stale', 'mismatch', 'unknown', 'unavailable')),
    CONSTRAINT route_samples_option_sequence_uq UNIQUE (route_option_id, sequence)
);

CREATE INDEX IF NOT EXISTS route_samples_coordinates_gix ON route_samples USING gist (coordinates);

CREATE TABLE IF NOT EXISTS route_assessments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    route_option_id uuid NOT NULL REFERENCES route_options(id) ON DELETE CASCADE,
    risk_assessment_id uuid NOT NULL REFERENCES risk_assessments(id) ON DELETE RESTRICT,
    objective varchar(32) NOT NULL,
    overall_score numeric(12, 6) NULL,
    rank integer NULL,
    explanation_code varchar(255) NOT NULL,
    user_created uuid NULL REFERENCES directus_users(id) ON DELETE SET NULL,
    date_created timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT route_assessments_objective_ck CHECK (objective IN ('weather_safer', 'balanced', 'diagnostic')),
    CONSTRAINT route_assessments_rank_ck CHECK (rank IS NULL OR rank > 0),
    CONSTRAINT route_assessments_option_objective_uq UNIQUE (route_option_id, objective)
);

CREATE TABLE IF NOT EXISTS content_pages (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    external_key varchar(128) NOT NULL,
    version integer NOT NULL,
    content_type varchar(32) NOT NULL,
    slug varchar(255) NOT NULL,
    status varchar(32) NOT NULL DEFAULT 'draft',
    effective_from timestamptz NULL,
    effective_to timestamptz NULL,
    submitted_by uuid NULL REFERENCES directus_users(id) ON DELETE SET NULL,
    submitted_at timestamptz NULL,
    approved_by uuid NULL REFERENCES directus_users(id) ON DELETE SET NULL,
    approved_at timestamptz NULL,
    published_by uuid NULL REFERENCES directus_users(id) ON DELETE SET NULL,
    published_at timestamptz NULL,
    user_created uuid NULL REFERENCES directus_users(id) ON DELETE SET NULL,
    date_created timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    user_updated uuid NULL REFERENCES directus_users(id) ON DELETE SET NULL,
    date_updated timestamptz NULL,
    CONSTRAINT content_pages_external_key_ck CHECK (external_key ~ '^[a-z0-9][a-z0-9._-]{1,127}$'),
    CONSTRAINT content_pages_version_ck CHECK (version > 0),
    CONSTRAINT content_pages_type_ck CHECK (content_type IN ('marketing', 'legal', 'advisory', 'pricing', 'help')),
    CONSTRAINT content_pages_status_ck CHECK (status IN ('draft', 'review', 'approved', 'published', 'retired')),
    CONSTRAINT content_pages_dates_ck CHECK (effective_to IS NULL OR effective_from IS NOT NULL AND effective_to >= effective_from),
    CONSTRAINT content_pages_key_version_uq UNIQUE (external_key, version),
    CONSTRAINT content_pages_slug_version_uq UNIQUE (slug, version)
);

CREATE TABLE IF NOT EXISTS translations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    namespace varchar(128) NOT NULL,
    translation_key varchar(255) NOT NULL,
    locale_id uuid NOT NULL REFERENCES supported_locales(id) ON DELETE RESTRICT,
    release_version integer NOT NULL,
    content_page_id uuid NULL REFERENCES content_pages(id) ON DELETE RESTRICT,
    value text NOT NULL,
    status varchar(32) NOT NULL DEFAULT 'draft',
    effective_from timestamptz NULL,
    effective_to timestamptz NULL,
    submitted_by uuid NULL REFERENCES directus_users(id) ON DELETE SET NULL,
    submitted_at timestamptz NULL,
    approved_by uuid NULL REFERENCES directus_users(id) ON DELETE SET NULL,
    approved_at timestamptz NULL,
    published_by uuid NULL REFERENCES directus_users(id) ON DELETE SET NULL,
    published_at timestamptz NULL,
    user_created uuid NULL REFERENCES directus_users(id) ON DELETE SET NULL,
    date_created timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    user_updated uuid NULL REFERENCES directus_users(id) ON DELETE SET NULL,
    date_updated timestamptz NULL,
    CONSTRAINT translations_namespace_ck CHECK (namespace ~ '^[a-z0-9][a-z0-9._-]{1,127}$'),
    CONSTRAINT translations_key_ck CHECK (translation_key ~ '^[a-z0-9][a-z0-9._-]{1,254}$'),
    CONSTRAINT translations_release_version_ck CHECK (release_version > 0),
    CONSTRAINT translations_status_ck CHECK (status IN ('draft', 'review', 'approved', 'published', 'retired')),
    CONSTRAINT translations_dates_ck CHECK (effective_to IS NULL OR effective_from IS NOT NULL AND effective_to >= effective_from),
    CONSTRAINT translations_release_uq UNIQUE (namespace, translation_key, locale_id, release_version)
);

CREATE TABLE IF NOT EXISTS app_settings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    external_key varchar(128) NOT NULL,
    version integer NOT NULL,
    value_type varchar(32) NOT NULL,
    value jsonb NOT NULL,
    description text NOT NULL,
    reference_source_id uuid NULL REFERENCES reference_sources(id) ON DELETE RESTRICT,
    status varchar(32) NOT NULL DEFAULT 'draft',
    effective_from timestamptz NULL,
    effective_to timestamptz NULL,
    submitted_by uuid NULL REFERENCES directus_users(id) ON DELETE SET NULL,
    submitted_at timestamptz NULL,
    approved_by uuid NULL REFERENCES directus_users(id) ON DELETE SET NULL,
    approved_at timestamptz NULL,
    published_by uuid NULL REFERENCES directus_users(id) ON DELETE SET NULL,
    published_at timestamptz NULL,
    user_created uuid NULL REFERENCES directus_users(id) ON DELETE SET NULL,
    date_created timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    user_updated uuid NULL REFERENCES directus_users(id) ON DELETE SET NULL,
    date_updated timestamptz NULL,
    CONSTRAINT app_settings_external_key_ck CHECK (external_key ~ '^[a-z0-9][a-z0-9._-]{1,127}$'),
    CONSTRAINT app_settings_version_ck CHECK (version > 0),
    CONSTRAINT app_settings_value_type_ck CHECK (value_type IN ('boolean', 'integer', 'decimal', 'string', 'duration', 'json')),
    CONSTRAINT app_settings_status_ck CHECK (status IN ('draft', 'review', 'approved', 'published', 'retired')),
    CONSTRAINT app_settings_dates_ck CHECK (effective_to IS NULL OR effective_from IS NOT NULL AND effective_to >= effective_from),
    CONSTRAINT app_settings_key_version_uq UNIQUE (external_key, version)
);

CREATE TABLE IF NOT EXISTS feature_flags (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    external_key varchar(128) NOT NULL,
    version integer NOT NULL,
    enabled boolean NOT NULL DEFAULT false,
    rollout_percentage numeric(6, 3) NOT NULL DEFAULT 0,
    targeting_rules jsonb NULL,
    description text NOT NULL,
    status varchar(32) NOT NULL DEFAULT 'draft',
    effective_from timestamptz NULL,
    effective_to timestamptz NULL,
    submitted_by uuid NULL REFERENCES directus_users(id) ON DELETE SET NULL,
    submitted_at timestamptz NULL,
    approved_by uuid NULL REFERENCES directus_users(id) ON DELETE SET NULL,
    approved_at timestamptz NULL,
    published_by uuid NULL REFERENCES directus_users(id) ON DELETE SET NULL,
    published_at timestamptz NULL,
    user_created uuid NULL REFERENCES directus_users(id) ON DELETE SET NULL,
    date_created timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    user_updated uuid NULL REFERENCES directus_users(id) ON DELETE SET NULL,
    date_updated timestamptz NULL,
    CONSTRAINT feature_flags_external_key_ck CHECK (external_key ~ '^[a-z0-9][a-z0-9._-]{1,127}$'),
    CONSTRAINT feature_flags_version_ck CHECK (version > 0),
    CONSTRAINT feature_flags_rollout_ck CHECK (rollout_percentage BETWEEN 0 AND 100),
    CONSTRAINT feature_flags_status_ck CHECK (status IN ('draft', 'review', 'approved', 'published', 'retired')),
    CONSTRAINT feature_flags_dates_ck CHECK (effective_to IS NULL OR effective_from IS NOT NULL AND effective_to >= effective_from),
    CONSTRAINT feature_flags_key_version_uq UNIQUE (external_key, version)
);

CREATE TABLE IF NOT EXISTS retention_policies (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    external_key varchar(128) NOT NULL,
    version integer NOT NULL,
    data_category varchar(128) NOT NULL,
    retention_value integer NOT NULL,
    retention_unit varchar(16) NOT NULL,
    purge_strategy varchar(32) NOT NULL,
    legal_hold_supported boolean NOT NULL DEFAULT false,
    description text NOT NULL,
    status varchar(32) NOT NULL DEFAULT 'draft',
    effective_from timestamptz NULL,
    effective_to timestamptz NULL,
    submitted_by uuid NULL REFERENCES directus_users(id) ON DELETE SET NULL,
    submitted_at timestamptz NULL,
    approved_by uuid NULL REFERENCES directus_users(id) ON DELETE SET NULL,
    approved_at timestamptz NULL,
    published_by uuid NULL REFERENCES directus_users(id) ON DELETE SET NULL,
    published_at timestamptz NULL,
    user_created uuid NULL REFERENCES directus_users(id) ON DELETE SET NULL,
    date_created timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    user_updated uuid NULL REFERENCES directus_users(id) ON DELETE SET NULL,
    date_updated timestamptz NULL,
    CONSTRAINT retention_policies_external_key_ck CHECK (external_key ~ '^[a-z0-9][a-z0-9._-]{1,127}$'),
    CONSTRAINT retention_policies_version_ck CHECK (version > 0),
    CONSTRAINT retention_policies_value_ck CHECK (retention_value > 0),
    CONSTRAINT retention_policies_unit_ck CHECK (retention_unit IN ('hours', 'days', 'months', 'years')),
    CONSTRAINT retention_policies_strategy_ck CHECK (purge_strategy IN ('delete', 'anonymize', 'aggregate', 'legal_hold')),
    CONSTRAINT retention_policies_status_ck CHECK (status IN ('draft', 'review', 'approved', 'published', 'retired')),
    CONSTRAINT retention_policies_dates_ck CHECK (effective_to IS NULL OR effective_from IS NOT NULL AND effective_to >= effective_from),
    CONSTRAINT retention_policies_key_version_uq UNIQUE (external_key, version)
);

CREATE TABLE IF NOT EXISTS product_plans (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    external_key varchar(128) NOT NULL,
    version integer NOT NULL,
    name_translation_key varchar(255) NOT NULL,
    description_translation_key varchar(255) NOT NULL,
    billing_interval varchar(16) NOT NULL DEFAULT 'none',
    sort integer NOT NULL DEFAULT 0,
    status varchar(32) NOT NULL DEFAULT 'draft',
    effective_from timestamptz NULL,
    effective_to timestamptz NULL,
    submitted_by uuid NULL REFERENCES directus_users(id) ON DELETE SET NULL,
    submitted_at timestamptz NULL,
    approved_by uuid NULL REFERENCES directus_users(id) ON DELETE SET NULL,
    approved_at timestamptz NULL,
    published_by uuid NULL REFERENCES directus_users(id) ON DELETE SET NULL,
    published_at timestamptz NULL,
    user_created uuid NULL REFERENCES directus_users(id) ON DELETE SET NULL,
    date_created timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    user_updated uuid NULL REFERENCES directus_users(id) ON DELETE SET NULL,
    date_updated timestamptz NULL,
    CONSTRAINT product_plans_external_key_ck CHECK (external_key ~ '^[a-z0-9][a-z0-9._-]{1,127}$'),
    CONSTRAINT product_plans_version_ck CHECK (version > 0),
    CONSTRAINT product_plans_interval_ck CHECK (billing_interval IN ('none', 'month', 'year')),
    CONSTRAINT product_plans_status_ck CHECK (status IN ('draft', 'review', 'approved', 'published', 'retired')),
    CONSTRAINT product_plans_dates_ck CHECK (effective_to IS NULL OR effective_from IS NOT NULL AND effective_to >= effective_from),
    CONSTRAINT product_plans_key_version_uq UNIQUE (external_key, version)
);

CREATE TABLE IF NOT EXISTS plan_prices (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    external_key varchar(128) NOT NULL,
    version integer NOT NULL,
    plan_id uuid NOT NULL REFERENCES product_plans(id) ON DELETE RESTRICT,
    billing_interval varchar(16) NOT NULL,
    currency char(3) NOT NULL,
    amount_minor bigint NOT NULL,
    provider_key varchar(128) NULL,
    provider_price_reference varchar(255) NULL,
    status varchar(32) NOT NULL DEFAULT 'draft',
    effective_from timestamptz NULL,
    effective_to timestamptz NULL,
    submitted_by uuid NULL REFERENCES directus_users(id) ON DELETE SET NULL,
    submitted_at timestamptz NULL,
    approved_by uuid NULL REFERENCES directus_users(id) ON DELETE SET NULL,
    approved_at timestamptz NULL,
    published_by uuid NULL REFERENCES directus_users(id) ON DELETE SET NULL,
    published_at timestamptz NULL,
    user_created uuid NULL REFERENCES directus_users(id) ON DELETE SET NULL,
    date_created timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    user_updated uuid NULL REFERENCES directus_users(id) ON DELETE SET NULL,
    date_updated timestamptz NULL,
    CONSTRAINT plan_prices_external_key_ck CHECK (external_key ~ '^[a-z0-9][a-z0-9._-]{1,127}$'),
    CONSTRAINT plan_prices_version_ck CHECK (version > 0),
    CONSTRAINT plan_prices_interval_ck CHECK (billing_interval IN ('month', 'year')),
    CONSTRAINT plan_prices_currency_ck CHECK (currency ~ '^[A-Z]{3}$'),
    CONSTRAINT plan_prices_amount_ck CHECK (amount_minor >= 0),
    CONSTRAINT plan_prices_provider_reference_ck CHECK (
        (provider_key IS NULL AND provider_price_reference IS NULL) OR
        (provider_key IS NOT NULL AND provider_price_reference IS NOT NULL)
    ),
    CONSTRAINT plan_prices_status_ck CHECK (status IN ('draft', 'review', 'approved', 'published', 'retired')),
    CONSTRAINT plan_prices_dates_ck CHECK (effective_to IS NULL OR effective_from IS NOT NULL AND effective_to >= effective_from),
    CONSTRAINT plan_prices_key_version_uq UNIQUE (external_key, version),
    CONSTRAINT plan_prices_plan_interval_version_uq UNIQUE (plan_id, billing_interval, currency, version)
);

CREATE TABLE IF NOT EXISTS product_features (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    external_key varchar(128) NOT NULL UNIQUE,
    value_type varchar(32) NOT NULL,
    unit varchar(64) NULL,
    description_translation_key varchar(255) NOT NULL,
    status varchar(32) NOT NULL DEFAULT 'draft',
    user_created uuid NULL REFERENCES directus_users(id) ON DELETE SET NULL,
    date_created timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    user_updated uuid NULL REFERENCES directus_users(id) ON DELETE SET NULL,
    date_updated timestamptz NULL,
    CONSTRAINT product_features_external_key_ck CHECK (external_key ~ '^[a-z0-9][a-z0-9._-]{1,127}$'),
    CONSTRAINT product_features_value_type_ck CHECK (value_type IN ('boolean', 'count', 'duration', 'enum', 'json')),
    CONSTRAINT product_features_unit_ck CHECK (value_type IN ('boolean', 'enum', 'json') OR unit IS NOT NULL),
    CONSTRAINT product_features_status_ck CHECK (status IN ('draft', 'active', 'retired'))
);

CREATE TABLE IF NOT EXISTS plan_entitlements (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    external_key varchar(128) NOT NULL,
    version integer NOT NULL,
    plan_id uuid NOT NULL REFERENCES product_plans(id) ON DELETE RESTRICT,
    feature_id uuid NOT NULL REFERENCES product_features(id) ON DELETE RESTRICT,
    value jsonb NOT NULL,
    status varchar(32) NOT NULL DEFAULT 'draft',
    effective_from timestamptz NULL,
    effective_to timestamptz NULL,
    submitted_by uuid NULL REFERENCES directus_users(id) ON DELETE SET NULL,
    submitted_at timestamptz NULL,
    approved_by uuid NULL REFERENCES directus_users(id) ON DELETE SET NULL,
    approved_at timestamptz NULL,
    published_by uuid NULL REFERENCES directus_users(id) ON DELETE SET NULL,
    published_at timestamptz NULL,
    user_created uuid NULL REFERENCES directus_users(id) ON DELETE SET NULL,
    date_created timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    user_updated uuid NULL REFERENCES directus_users(id) ON DELETE SET NULL,
    date_updated timestamptz NULL,
    CONSTRAINT plan_entitlements_external_key_ck CHECK (external_key ~ '^[a-z0-9][a-z0-9._-]{1,127}$'),
    CONSTRAINT plan_entitlements_version_ck CHECK (version > 0),
    CONSTRAINT plan_entitlements_status_ck CHECK (status IN ('draft', 'review', 'approved', 'published', 'retired')),
    CONSTRAINT plan_entitlements_dates_ck CHECK (effective_to IS NULL OR effective_from IS NOT NULL AND effective_to >= effective_from),
    CONSTRAINT plan_entitlements_key_version_uq UNIQUE (external_key, version),
    CONSTRAINT plan_entitlements_plan_feature_version_uq UNIQUE (plan_id, feature_id, version)
);

CREATE TABLE IF NOT EXISTS usage_policies (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    external_key varchar(128) NOT NULL,
    version integer NOT NULL,
    plan_id uuid NOT NULL REFERENCES product_plans(id) ON DELETE RESTRICT,
    feature_id uuid NOT NULL REFERENCES product_features(id) ON DELETE RESTRICT,
    limit_value integer NOT NULL,
    period_unit varchar(16) NOT NULL,
    period_timezone varchar(64) NULL,
    reset_time time NULL,
    status varchar(32) NOT NULL DEFAULT 'draft',
    effective_from timestamptz NULL,
    effective_to timestamptz NULL,
    submitted_by uuid NULL REFERENCES directus_users(id) ON DELETE SET NULL,
    submitted_at timestamptz NULL,
    approved_by uuid NULL REFERENCES directus_users(id) ON DELETE SET NULL,
    approved_at timestamptz NULL,
    published_by uuid NULL REFERENCES directus_users(id) ON DELETE SET NULL,
    published_at timestamptz NULL,
    user_created uuid NULL REFERENCES directus_users(id) ON DELETE SET NULL,
    date_created timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    user_updated uuid NULL REFERENCES directus_users(id) ON DELETE SET NULL,
    date_updated timestamptz NULL,
    CONSTRAINT usage_policies_external_key_ck CHECK (external_key ~ '^[a-z0-9][a-z0-9._-]{1,127}$'),
    CONSTRAINT usage_policies_version_ck CHECK (version > 0),
    CONSTRAINT usage_policies_limit_ck CHECK (limit_value >= 0),
    CONSTRAINT usage_policies_period_ck CHECK (period_unit IN ('request', 'day', 'month', 'lifetime')),
    CONSTRAINT usage_policies_period_config_ck CHECK ((period_unit <> 'day') OR (period_timezone IS NOT NULL AND reset_time IS NOT NULL)),
    CONSTRAINT usage_policies_status_ck CHECK (status IN ('draft', 'review', 'approved', 'published', 'retired')),
    CONSTRAINT usage_policies_dates_ck CHECK (effective_to IS NULL OR effective_from IS NOT NULL AND effective_to >= effective_from),
    CONSTRAINT usage_policies_key_version_uq UNIQUE (external_key, version),
    CONSTRAINT usage_policies_plan_feature_version_uq UNIQUE (plan_id, feature_id, version)
);

CREATE TABLE IF NOT EXISTS usage_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NULL REFERENCES directus_users(id) ON DELETE SET NULL,
    usage_policy_id uuid NOT NULL REFERENCES usage_policies(id) ON DELETE RESTRICT,
    idempotency_key varchar(255) NOT NULL UNIQUE,
    occurred_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    period_start timestamptz NOT NULL,
    period_end timestamptz NOT NULL,
    quantity integer NOT NULL DEFAULT 1,
    outcome varchar(32) NOT NULL,
    correlation_hash char(64) NULL,
    metadata jsonb NULL,
    user_created uuid NULL REFERENCES directus_users(id) ON DELETE SET NULL,
    date_created timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT usage_events_period_ck CHECK (period_end > period_start AND occurred_at >= period_start AND occurred_at < period_end),
    CONSTRAINT usage_events_quantity_ck CHECK (quantity > 0),
    CONSTRAINT usage_events_outcome_ck CHECK (outcome IN ('consumed', 'rejected', 'reversed')),
    CONSTRAINT usage_events_correlation_ck CHECK (correlation_hash IS NULL OR correlation_hash ~ '^[0-9a-f]{64}$')
);

CREATE INDEX IF NOT EXISTS usage_events_user_period_idx ON usage_events (user_id, period_start, period_end);
CREATE INDEX IF NOT EXISTS usage_events_policy_occurred_idx ON usage_events (usage_policy_id, occurred_at DESC);

CREATE TABLE IF NOT EXISTS usage_counters (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES directus_users(id) ON DELETE CASCADE,
    usage_policy_id uuid NOT NULL REFERENCES usage_policies(id) ON DELETE RESTRICT,
    period_start timestamptz NOT NULL,
    period_end timestamptz NOT NULL,
    consumed_count integer NOT NULL DEFAULT 0,
    lock_version integer NOT NULL DEFAULT 0,
    date_updated timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT usage_counters_period_ck CHECK (period_end > period_start),
    CONSTRAINT usage_counters_count_ck CHECK (consumed_count >= 0 AND lock_version >= 0),
    CONSTRAINT usage_counters_user_policy_period_uq UNIQUE (user_id, usage_policy_id, period_start)
);

CREATE TABLE IF NOT EXISTS billing_customers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NULL REFERENCES directus_users(id) ON DELETE SET NULL,
    provider_key varchar(128) NOT NULL,
    provider_customer_reference varchar(255) NOT NULL,
    status varchar(32) NOT NULL DEFAULT 'active',
    user_created uuid NULL REFERENCES directus_users(id) ON DELETE SET NULL,
    date_created timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    user_updated uuid NULL REFERENCES directus_users(id) ON DELETE SET NULL,
    date_updated timestamptz NULL,
    CONSTRAINT billing_customers_status_ck CHECK (status IN ('active', 'inactive', 'deleted', 'anonymized')),
    CONSTRAINT billing_customers_provider_reference_uq UNIQUE (provider_key, provider_customer_reference),
    CONSTRAINT billing_customers_user_provider_uq UNIQUE NULLS NOT DISTINCT (user_id, provider_key)
);

CREATE TABLE IF NOT EXISTS subscriptions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    billing_customer_id uuid NOT NULL REFERENCES billing_customers(id) ON DELETE RESTRICT,
    plan_id uuid NOT NULL REFERENCES product_plans(id) ON DELETE RESTRICT,
    provider_subscription_reference varchar(255) NOT NULL,
    status varchar(32) NOT NULL,
    billing_interval varchar(16) NOT NULL,
    started_at timestamptz NOT NULL,
    current_period_start timestamptz NOT NULL,
    current_period_end timestamptz NOT NULL,
    grace_until timestamptz NULL,
    cancelled_at timestamptz NULL,
    ended_at timestamptz NULL,
    projection_version integer NOT NULL DEFAULT 1,
    user_created uuid NULL REFERENCES directus_users(id) ON DELETE SET NULL,
    date_created timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    user_updated uuid NULL REFERENCES directus_users(id) ON DELETE SET NULL,
    date_updated timestamptz NULL,
    CONSTRAINT subscriptions_status_ck CHECK (status IN ('pending', 'active', 'past_due', 'grace', 'cancelled', 'expired', 'refunded')),
    CONSTRAINT subscriptions_interval_ck CHECK (billing_interval IN ('month', 'year')),
    CONSTRAINT subscriptions_period_ck CHECK (current_period_end > current_period_start),
    CONSTRAINT subscriptions_projection_version_ck CHECK (projection_version > 0),
    CONSTRAINT subscriptions_provider_reference_uq UNIQUE (provider_subscription_reference)
);

CREATE INDEX IF NOT EXISTS subscriptions_customer_status_idx ON subscriptions (billing_customer_id, status);

CREATE TABLE IF NOT EXISTS payment_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_key varchar(128) NOT NULL,
    provider_event_id varchar(255) NOT NULL,
    idempotency_key varchar(255) NOT NULL UNIQUE,
    event_type varchar(128) NOT NULL,
    status varchar(32) NOT NULL DEFAULT 'received',
    occurred_at timestamptz NOT NULL,
    received_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    processed_at timestamptz NULL,
    billing_customer_id uuid NULL REFERENCES billing_customers(id) ON DELETE RESTRICT,
    subscription_id uuid NULL REFERENCES subscriptions(id) ON DELETE RESTRICT,
    amount_minor bigint NULL,
    currency char(3) NULL,
    payload_checksum_sha256 char(64) NOT NULL,
    sanitized_reference jsonb NULL,
    error_code varchar(128) NULL,
    user_created uuid NULL REFERENCES directus_users(id) ON DELETE SET NULL,
    date_created timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    user_updated uuid NULL REFERENCES directus_users(id) ON DELETE SET NULL,
    date_updated timestamptz NULL,
    CONSTRAINT payment_events_status_ck CHECK (status IN ('received', 'verified', 'processed', 'rejected', 'failed')),
    CONSTRAINT payment_events_amount_ck CHECK (amount_minor IS NULL OR amount_minor >= 0),
    CONSTRAINT payment_events_currency_ck CHECK (currency IS NULL OR currency ~ '^[A-Z]{3}$'),
    CONSTRAINT payment_events_checksum_ck CHECK (payload_checksum_sha256 ~ '^[0-9a-f]{64}$'),
    CONSTRAINT payment_events_provider_event_uq UNIQUE (provider_key, provider_event_id)
);

CREATE INDEX IF NOT EXISTS payment_events_status_received_idx ON payment_events (status, received_at);

CREATE TABLE IF NOT EXISTS refund_references (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    subscription_id uuid NULL REFERENCES subscriptions(id) ON DELETE RESTRICT,
    payment_event_id uuid NOT NULL REFERENCES payment_events(id) ON DELETE RESTRICT,
    provider_refund_reference varchar(255) NOT NULL UNIQUE,
    amount_minor bigint NOT NULL,
    currency char(3) NOT NULL,
    status varchar(32) NOT NULL DEFAULT 'requested',
    reason_code varchar(128) NULL,
    requested_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at timestamptz NULL,
    user_created uuid NULL REFERENCES directus_users(id) ON DELETE SET NULL,
    date_created timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    user_updated uuid NULL REFERENCES directus_users(id) ON DELETE SET NULL,
    date_updated timestamptz NULL,
    CONSTRAINT refund_references_amount_ck CHECK (amount_minor >= 0),
    CONSTRAINT refund_references_currency_ck CHECK (currency ~ '^[A-Z]{3}$'),
    CONSTRAINT refund_references_status_ck CHECK (status IN ('requested', 'pending', 'succeeded', 'failed', 'cancelled')),
    CONSTRAINT refund_references_dates_ck CHECK (completed_at IS NULL OR completed_at >= requested_at)
);

CREATE TABLE IF NOT EXISTS entitlement_overrides (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NULL REFERENCES directus_users(id) ON DELETE SET NULL,
    feature_id uuid NOT NULL REFERENCES product_features(id) ON DELETE RESTRICT,
    value jsonb NOT NULL,
    reason text NOT NULL,
    status varchar(32) NOT NULL DEFAULT 'active',
    effective_from timestamptz NOT NULL,
    expires_at timestamptz NULL,
    approved_by uuid NOT NULL REFERENCES directus_users(id) ON DELETE RESTRICT,
    revoked_by uuid NULL REFERENCES directus_users(id) ON DELETE SET NULL,
    revoked_at timestamptz NULL,
    user_created uuid NULL REFERENCES directus_users(id) ON DELETE SET NULL,
    date_created timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    user_updated uuid NULL REFERENCES directus_users(id) ON DELETE SET NULL,
    date_updated timestamptz NULL,
    CONSTRAINT entitlement_overrides_status_ck CHECK (status IN ('active', 'revoked', 'expired')),
    CONSTRAINT entitlement_overrides_dates_ck CHECK (expires_at IS NULL OR expires_at > effective_from),
    CONSTRAINT entitlement_overrides_revoke_ck CHECK (status <> 'revoked' OR revoked_by IS NOT NULL AND revoked_at IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS entitlement_overrides_user_active_idx ON entitlement_overrides (user_id, feature_id, effective_from, expires_at);

CREATE TABLE IF NOT EXISTS user_favorites (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id uuid NOT NULL REFERENCES directus_users(id) ON DELETE CASCADE,
    location_id uuid NOT NULL REFERENCES locations(id) ON DELETE RESTRICT,
    label varchar(255) NULL,
    user_created uuid NULL REFERENCES directus_users(id) ON DELETE SET NULL,
    date_created timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    user_updated uuid NULL REFERENCES directus_users(id) ON DELETE SET NULL,
    date_updated timestamptz NULL,
    CONSTRAINT user_favorites_owner_location_uq UNIQUE (owner_id, location_id)
);

CREATE TABLE IF NOT EXISTS saved_routes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id uuid NOT NULL REFERENCES directus_users(id) ON DELETE CASCADE,
    label varchar(255) NOT NULL,
    origin_location_id uuid NULL REFERENCES locations(id) ON DELETE RESTRICT,
    destination_location_id uuid NULL REFERENCES locations(id) ON DELETE RESTRICT,
    origin_coordinates geometry(Point, 4326) NOT NULL,
    destination_coordinates geometry(Point, 4326) NOT NULL,
    last_route_option_id uuid NULL REFERENCES route_options(id) ON DELETE SET NULL,
    user_created uuid NULL REFERENCES directus_users(id) ON DELETE SET NULL,
    date_created timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    user_updated uuid NULL REFERENCES directus_users(id) ON DELETE SET NULL,
    date_updated timestamptz NULL
);

CREATE INDEX IF NOT EXISTS saved_routes_owner_created_idx ON saved_routes (owner_id, date_created DESC);

CREATE TABLE IF NOT EXISTS search_history (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id uuid NOT NULL REFERENCES directus_users(id) ON DELETE CASCADE,
    query_text varchar(500) NOT NULL,
    selected_location_id uuid NULL REFERENCES locations(id) ON DELETE SET NULL,
    provider_key varchar(128) NULL,
    provider_reference varchar(255) NULL,
    occurred_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at timestamptz NOT NULL,
    user_created uuid NULL REFERENCES directus_users(id) ON DELETE SET NULL,
    date_created timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT search_history_expiry_ck CHECK (expires_at > occurred_at)
);

CREATE INDEX IF NOT EXISTS search_history_owner_occurred_idx ON search_history (owner_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS search_history_expiry_idx ON search_history (expires_at);

CREATE OR REPLACE FUNCTION app_governance.validate_administrative_parent()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    parent_version uuid;
BEGIN
    IF NEW.parent_id IS NULL THEN
        RETURN NEW;
    END IF;
    IF NEW.parent_id = NEW.id THEN
        RAISE EXCEPTION 'Administrative unit cannot be its own parent';
    END IF;
    SELECT administrative_version_id INTO parent_version
      FROM administrative_units
     WHERE id = NEW.parent_id;
    IF parent_version IS DISTINCT FROM NEW.administrative_version_id THEN
        RAISE EXCEPTION 'Administrative parent must belong to the same version';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS administrative_units_parent_guard ON administrative_units;
CREATE TRIGGER administrative_units_parent_guard
BEFORE INSERT OR UPDATE OF parent_id, administrative_version_id ON administrative_units
FOR EACH ROW EXECUTE FUNCTION app_governance.validate_administrative_parent();

CREATE OR REPLACE FUNCTION app_governance.enforce_governed_workflow()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    separation_required boolean := COALESCE(TG_ARGV[0], 'shared') = 'separate';
    old_business jsonb;
    new_business jsonb;
BEGIN
    IF TG_OP = 'INSERT' THEN
        IF NEW.status <> 'draft' THEN
            RAISE EXCEPTION 'Governed records must start in draft status';
        END IF;
        RETURN NEW;
    END IF;

    IF NEW.status IS DISTINCT FROM OLD.status AND NOT (
        (OLD.status = 'draft' AND NEW.status IN ('draft', 'review', 'retired')) OR
        (OLD.status = 'review' AND NEW.status IN ('draft', 'review', 'approved', 'retired')) OR
        (OLD.status = 'approved' AND NEW.status IN ('approved', 'published', 'retired')) OR
        (OLD.status = 'published' AND NEW.status IN ('published', 'retired')) OR
        (OLD.status = 'retired' AND NEW.status = 'retired')
    ) THEN
        RAISE EXCEPTION 'Invalid governed status transition: % -> %', OLD.status, NEW.status;
    END IF;

    old_business := to_jsonb(OLD) - ARRAY[
        'status', 'submitted_by', 'submitted_at', 'approved_by', 'approved_at',
        'published_by', 'published_at', 'user_updated', 'date_updated'
    ];
    new_business := to_jsonb(NEW) - ARRAY[
        'status', 'submitted_by', 'submitted_at', 'approved_by', 'approved_at',
        'published_by', 'published_at', 'user_updated', 'date_updated'
    ];
    IF OLD.status <> 'draft' AND old_business IS DISTINCT FROM new_business THEN
        RAISE EXCEPTION 'Governed business fields are immutable after draft submission';
    END IF;

    IF NEW.status IN ('review', 'approved', 'published') AND (NEW.submitted_by IS NULL OR NEW.submitted_at IS NULL) THEN
        RAISE EXCEPTION 'Submitted actor and timestamp are required';
    END IF;
    IF NEW.status IN ('approved', 'published') AND (NEW.approved_by IS NULL OR NEW.approved_at IS NULL) THEN
        RAISE EXCEPTION 'Approval actor and timestamp are required';
    END IF;
    IF NEW.status = 'published' AND (NEW.published_by IS NULL OR NEW.published_at IS NULL) THEN
        RAISE EXCEPTION 'Publisher actor and timestamp are required';
    END IF;
    IF separation_required AND NEW.status IN ('approved', 'published') AND NEW.approved_by = NEW.user_created THEN
        RAISE EXCEPTION 'Maker-checker separation forbids self-approval';
    END IF;
    RETURN NEW;
END;
$$;

DO $do$
DECLARE
    table_name text;
BEGIN
    FOREACH table_name IN ARRAY ARRAY[
        'locations', 'content_pages', 'translations', 'app_settings', 'feature_flags',
        'retention_policies', 'product_plans', 'plan_prices', 'plan_entitlements', 'usage_policies'
    ] LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS %I_workflow_guard ON %I', table_name, table_name);
        EXECUTE format(
            'CREATE TRIGGER %I_workflow_guard BEFORE INSERT OR UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION app_governance.enforce_governed_workflow(''shared'')',
            table_name,
            table_name
        );
    END LOOP;
    FOREACH table_name IN ARRAY ARRAY['risk_rule_sets', 'risk_advisories'] LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS %I_workflow_guard ON %I', table_name, table_name);
        EXECUTE format(
            'CREATE TRIGGER %I_workflow_guard BEFORE INSERT OR UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION app_governance.enforce_governed_workflow(''separate'')',
            table_name,
            table_name
        );
    END LOOP;
END
$do$;

CREATE OR REPLACE FUNCTION app_governance.guard_risk_rule_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    parent_status varchar(32);
    parent_id uuid;
BEGIN
    parent_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.rule_set_id ELSE NEW.rule_set_id END;
    SELECT status INTO parent_status FROM risk_rule_sets WHERE id = parent_id;
    IF parent_status <> 'draft' THEN
        RAISE EXCEPTION 'Risk rules can only change while the rule set is draft';
    END IF;
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS risk_rules_parent_status_guard ON risk_rules;
CREATE TRIGGER risk_rules_parent_status_guard
BEFORE INSERT OR UPDATE OR DELETE ON risk_rules
FOR EACH ROW EXECUTE FUNCTION app_governance.guard_risk_rule_mutation();

CREATE OR REPLACE FUNCTION app_governance.guard_immutable_event_identity()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'Immutable event rows can only be removed by an approved retention procedure';
    END IF;
    IF TG_TABLE_NAME = 'usage_events' THEN
        IF NEW.user_id IS DISTINCT FROM OLD.user_id OR
            NEW.usage_policy_id IS DISTINCT FROM OLD.usage_policy_id OR
            NEW.idempotency_key IS DISTINCT FROM OLD.idempotency_key OR
            NEW.occurred_at IS DISTINCT FROM OLD.occurred_at OR
            NEW.quantity IS DISTINCT FROM OLD.quantity OR
            NEW.outcome IS DISTINCT FROM OLD.outcome THEN
            RAISE EXCEPTION 'Usage event identity is immutable';
        END IF;
    ELSIF TG_TABLE_NAME = 'payment_events' THEN
        IF NEW.provider_key IS DISTINCT FROM OLD.provider_key OR
            NEW.provider_event_id IS DISTINCT FROM OLD.provider_event_id OR
            NEW.idempotency_key IS DISTINCT FROM OLD.idempotency_key OR
            NEW.occurred_at IS DISTINCT FROM OLD.occurred_at OR
            NEW.amount_minor IS DISTINCT FROM OLD.amount_minor OR
            NEW.currency IS DISTINCT FROM OLD.currency OR
            NEW.payload_checksum_sha256 IS DISTINCT FROM OLD.payload_checksum_sha256 THEN
            RAISE EXCEPTION 'Payment event identity is immutable';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS usage_events_immutable_guard ON usage_events;
CREATE TRIGGER usage_events_immutable_guard
BEFORE UPDATE OR DELETE ON usage_events
FOR EACH ROW EXECUTE FUNCTION app_governance.guard_immutable_event_identity();

DROP TRIGGER IF EXISTS payment_events_immutable_guard ON payment_events;
CREATE TRIGGER payment_events_immutable_guard
BEFORE UPDATE OR DELETE ON payment_events
FOR EACH ROW EXECUTE FUNCTION app_governance.guard_immutable_event_identity();

CREATE TEMP TABLE phase4_collection_meta (
    collection varchar(64) PRIMARY KEY,
    icon varchar(64) NOT NULL,
    note text NOT NULL,
    display_template varchar(255) NULL,
    archive_field varchar(64) NULL,
    archive_value varchar(255) NULL,
    unarchive_value varchar(255) NULL,
    sort_field varchar(64) NULL,
    sort integer NOT NULL
) ON COMMIT DROP;

INSERT INTO phase4_collection_meta VALUES
('supported_locales', 'language', 'Approved business-content locales. UI system keys remain frontend-owned.', '{{display_name}} ({{external_key}})', NULL, NULL, NULL, 'sort', 10),
('reference_sources', 'source', 'Versioned provenance and license records. No secret or raw provider payload.', '{{name}} - {{publication_version}}', 'status', 'retired', 'draft', NULL, 20),
('administrative_versions', 'history', 'Official administrative dataset releases with checksum and effective dates.', '{{version_label}}', 'status', 'retired', 'draft', NULL, 30),
('administrative_units', 'account_tree', 'Versioned administrative hierarchy; district and lower levels are optional.', '{{canonical_name}}', 'status', 'retired', 'active', 'sort', 40),
('locations', 'place', 'Curated canonical locations. No location record is seeded without approved provenance.', '{{canonical_name}}', 'status', 'retired', 'draft', NULL, 50),
('location_aliases', 'alternate_email', 'Search aliases linked to canonical locations and optional locale/source.', '{{alias}}', NULL, NULL, NULL, NULL, 60),
('location_provider_mappings', 'link', 'Provider identifiers mapped to canonical locations without credential values.', '{{provider_key}}: {{provider_location_id}}', NULL, NULL, NULL, NULL, 70),
('weather_providers', 'cloud', 'Non-secret provider configuration and verified capability metadata.', '{{display_name}}', 'status', 'retired', 'disabled', NULL, 100),
('provider_runs', 'sync', 'Auditable provider jobs with idempotency, parser version and sanitized errors.', '{{run_type}} - {{status}}', 'status', 'cancelled', 'pending', NULL, 110),
('weather_observations', 'thermostat', 'Normalized observations with explicit units, source and freshness timestamps.', '{{observed_at}}', 'status', 'superseded', 'valid', NULL, 120),
('weather_forecasts', 'calendar_month', 'Normalized forecast intervals with provider and parser provenance.', '{{valid_from}} - {{valid_to}}', 'status', 'superseded', 'valid', NULL, 130),
('risk_rule_sets', 'rule', 'Versioned maker-checker risk rule releases with official evidence.', '{{name}} v{{version}}', 'status', 'retired', 'draft', NULL, 200),
('risk_rules', 'checklist', 'Deterministic rules belonging to a draft rule-set version.', '{{external_key}}', NULL, NULL, NULL, 'sort', 210),
('risk_assessments', 'health_and_safety', 'Risk results traceable to rule-set and weather evidence.', '{{level}} - {{assessed_at}}', 'status', 'failed', 'complete', NULL, 220),
('risk_assessment_evidence', 'fact_check', 'Ordered weather evidence used by a risk assessment.', '{{freshness_state}}', NULL, NULL, NULL, 'sequence', 230),
('risk_advisories', 'warning', 'Versioned advisories with maker-checker publish workflow.', '{{external_key}} v{{version}}', 'status', 'retired', 'draft', NULL, 240),
('route_requests', 'route', 'User-owned route requests with bounded retention and idempotency.', '{{departure_at}} - {{status}}', 'status', 'expired', 'pending', NULL, 300),
('route_options', 'alt_route', 'Provider-returned route alternatives; geometry is never fabricated.', '{{objective}} - {{distance_meters}} m', 'status', 'expired', 'valid', NULL, 310),
('route_samples', 'timeline', 'Deterministic route samples with ETA and weather evidence linkage.', '{{sequence}} - {{eta}}', NULL, NULL, NULL, 'sequence', 320),
('route_assessments', 'compare_arrows', 'Weather-risk ranking attached to a provider route option.', '{{objective}} - rank {{rank}}', NULL, NULL, NULL, NULL, 330),
('content_pages', 'article', 'Versioned business, legal, pricing and advisory content releases.', '{{external_key}} v{{version}}', 'status', 'retired', 'draft', NULL, 400),
('translations', 'translate', 'Versioned vi/en business content. Frontend system messages are not stored here.', '{{namespace}}.{{translation_key}}', 'status', 'retired', 'draft', NULL, 410),
('app_settings', 'settings', 'Versioned non-secret application settings; values are not product-code constants.', '{{external_key}} v{{version}}', 'status', 'retired', 'draft', NULL, 420),
('feature_flags', 'flag', 'Versioned feature flags and rollout policy.', '{{external_key}} v{{version}}', 'status', 'retired', 'draft', NULL, 430),
('retention_policies', 'policy', 'Versioned retention and deletion policy; scheduler execution belongs to operations.', '{{data_category}} - {{retention_value}} {{retention_unit}}', 'status', 'retired', 'draft', NULL, 440),
('product_plans', 'workspace_premium', 'Versioned product plans without provider/payment credentials.', '{{external_key}} v{{version}}', 'status', 'retired', 'draft', 'sort', 500),
('plan_prices', 'sell', 'Versioned monthly/yearly price references; no payment credential is stored.', '{{external_key}} v{{version}}', 'status', 'retired', 'draft', NULL, 510),
('product_features', 'extension', 'Stable capability keys and value types.', '{{external_key}}', 'status', 'retired', 'draft', NULL, 520),
('plan_entitlements', 'verified', 'Versioned plan-to-feature entitlement values.', '{{external_key}} v{{version}}', 'status', 'retired', 'draft', NULL, 530),
('usage_policies', 'speed', 'Versioned backend quota periods and limits.', '{{external_key}} v{{version}}', 'status', 'retired', 'draft', NULL, 540),
('usage_events', 'receipt_long', 'Immutable idempotent usage ledger; contains no raw request or credential.', '{{occurred_at}} - {{outcome}}', NULL, NULL, NULL, NULL, 550),
('usage_counters', 'countertops', 'Atomic per-user usage projection for one policy period.', '{{period_start}} - {{consumed_count}}', NULL, NULL, NULL, NULL, 560),
('billing_customers', 'person_pin', 'Minimal provider customer references; no card number or CVV.', '{{provider_key}}: {{provider_customer_reference}}', 'status', 'anonymized', 'active', NULL, 600),
('subscriptions', 'subscriptions', 'Auditable subscription projection; entitlement remains server-authoritative.', '{{provider_subscription_reference}} - {{status}}', 'status', 'expired', 'active', NULL, 610),
('payment_events', 'payments', 'Idempotent payment events with checksum and sanitized references only.', '{{provider_key}}: {{provider_event_id}}', 'status', 'rejected', 'received', NULL, 620),
('refund_references', 'currency_exchange', 'Refund references without payment credentials.', '{{provider_refund_reference}} - {{status}}', 'status', 'cancelled', 'requested', NULL, 630),
('entitlement_overrides', 'tune', 'Audited temporary entitlement overrides with explicit expiry/revocation.', '{{reason}}', 'status', 'revoked', 'active', NULL, 640),
('user_favorites', 'favorite', 'User-owned saved locations.', '{{label}}', NULL, NULL, NULL, NULL, 700),
('saved_routes', 'bookmark', 'User-owned saved route references and endpoints.', '{{label}}', NULL, NULL, NULL, NULL, 710),
('search_history', 'history', 'User-owned search history with explicit expiry.', '{{query_text}}', NULL, NULL, NULL, NULL, 720);

INSERT INTO directus_collections (
    collection, icon, note, display_template, hidden, singleton, archive_field,
    archive_app_filter, archive_value, unarchive_value, sort_field, accountability,
    sort, collapse, versioning, status
)
SELECT collection, icon, note, display_template, false, false, archive_field,
       true, archive_value, unarchive_value, sort_field, 'all', sort, 'open', false, 'active'
FROM phase4_collection_meta
ON CONFLICT (collection) DO UPDATE SET
    icon = EXCLUDED.icon,
    note = EXCLUDED.note,
    display_template = EXCLUDED.display_template,
    hidden = EXCLUDED.hidden,
    singleton = EXCLUDED.singleton,
    archive_field = EXCLUDED.archive_field,
    archive_app_filter = EXCLUDED.archive_app_filter,
    archive_value = EXCLUDED.archive_value,
    unarchive_value = EXCLUDED.unarchive_value,
    sort_field = EXCLUDED.sort_field,
    accountability = EXCLUDED.accountability,
    sort = EXCLUDED.sort,
    collapse = EXCLUDED.collapse,
    versioning = EXCLUDED.versioning,
    status = EXCLUDED.status;

INSERT INTO directus_fields (
    collection, field, special, interface, options, display, display_options,
    readonly, hidden, sort, width, note, required, searchable
)
SELECT
    c.table_name,
    c.column_name,
    CASE
        WHEN c.column_name = 'id' AND c.udt_name = 'uuid' THEN 'uuid'
        WHEN c.column_name = 'user_created' THEN 'user-created'
        WHEN c.column_name = 'date_created' THEN 'date-created'
        WHEN c.column_name = 'user_updated' THEN 'user-updated'
        WHEN c.column_name = 'date_updated' THEN 'date-updated'
        ELSE NULL
    END,
    CASE
        WHEN c.udt_name = 'geometry' THEN 'map'
        WHEN c.data_type IN ('json', 'jsonb') THEN 'input-code'
        WHEN c.data_type = 'boolean' THEN 'boolean'
        WHEN c.data_type IN ('timestamp with time zone', 'timestamp without time zone', 'date', 'time without time zone') THEN 'datetime'
        WHEN c.column_name IN ('status', 'unit_type', 'location_type', 'provider_domain', 'run_type', 'horizon_kind', 'operator', 'severity', 'freshness_state', 'evidence_role', 'travel_mode', 'objective', 'content_type', 'value_type', 'retention_unit', 'purge_strategy', 'billing_interval', 'period_unit', 'outcome', 'alias_type', 'source_quality') THEN 'select-dropdown'
        WHEN c.data_type = 'text' OR c.column_name IN ('description', 'notes', 'error_message', 'query_text', 'reason') THEN 'input-multiline'
        ELSE 'input'
    END,
    CASE WHEN c.data_type IN ('json', 'jsonb') THEN '{"language":"json"}'::json ELSE NULL END,
    CASE WHEN c.udt_name = 'geometry' THEN 'map' ELSE NULL END,
    NULL,
    c.column_name IN ('id', 'user_created', 'date_created', 'user_updated', 'date_updated'),
    c.column_name IN ('id', 'user_created', 'date_created', 'user_updated', 'date_updated'),
    c.ordinal_position,
    CASE WHEN c.column_name IN ('description', 'notes', 'value', 'condition', 'metadata', 'sanitized_metadata', 'sanitized_reference', 'targeting_rules', 'capabilities', 'rate_limit_policy', 'evidence_summary') THEN 'full' ELSE 'half' END,
    NULL,
    c.is_nullable = 'NO' AND c.column_default IS NULL AND c.column_name <> 'id',
    c.column_name NOT IN ('id', 'user_created', 'user_updated')
FROM information_schema.columns c
JOIN phase4_collection_meta m ON m.collection = c.table_name
WHERE c.table_schema = 'public'
  AND NOT EXISTS (
      SELECT 1 FROM directus_fields f
       WHERE f.collection = c.table_name AND f.field = c.column_name
  );

UPDATE directus_fields f
SET special = CASE
        WHEN f.field = 'user_created' THEN 'user-created'
        WHEN f.field = 'user_updated' THEN 'user-updated'
        ELSE 'm2o'
    END,
    interface = 'select-dropdown-m2o',
    display = 'related-values',
    width = 'half'
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
JOIN phase4_collection_meta m ON m.collection = tc.table_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND f.collection = tc.table_name
  AND f.field = kcu.column_name;

INSERT INTO directus_relations (
    many_collection, many_field, one_collection, one_field, one_collection_field,
    one_allowed_collections, junction_field, sort_field, one_deselect_action
)
SELECT
    tc.table_name,
    kcu.column_name,
    ccu.table_name,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    'nullify'
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage ccu
  ON tc.constraint_name = ccu.constraint_name AND tc.table_schema = ccu.table_schema
JOIN phase4_collection_meta m ON m.collection = tc.table_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND NOT EXISTS (
      SELECT 1 FROM directus_relations r
       WHERE r.many_collection = tc.table_name AND r.many_field = kcu.column_name
  );

UPDATE directus_fields
SET options = '{"choices":[{"text":"Draft","value":"draft"},{"text":"Review","value":"review"},{"text":"Approved","value":"approved"},{"text":"Published","value":"published"},{"text":"Retired","value":"retired"}]}'::json
WHERE field = 'status' AND collection IN (
    'locations', 'risk_rule_sets', 'risk_advisories', 'content_pages', 'translations',
    'app_settings', 'feature_flags', 'retention_policies', 'product_plans',
    'plan_prices', 'plan_entitlements', 'usage_policies'
);

UPDATE directus_fields
SET options = '{"choices":[{"text":"Country","value":"country"},{"text":"Province","value":"province"},{"text":"Municipality","value":"municipality"},{"text":"District","value":"district"},{"text":"Urban district","value":"urban_district"},{"text":"Rural district","value":"rural_district"},{"text":"Provincial city","value":"provincial_city"},{"text":"Town","value":"town"},{"text":"Ward","value":"ward"},{"text":"Commune","value":"commune"},{"text":"Township","value":"township"},{"text":"Other","value":"other"}]}'::json
WHERE collection = 'administrative_units' AND field = 'unit_type';

UPDATE directus_fields
SET options = '{"choices":[{"text":"Administrative","value":"administrative"},{"text":"Tourist attraction","value":"tourist_attraction"},{"text":"City center","value":"city_center"},{"text":"Airport","value":"airport"},{"text":"Station","value":"station"},{"text":"Beach","value":"beach"},{"text":"Mountain","value":"mountain"},{"text":"Island","value":"island"},{"text":"Park","value":"park"},{"text":"Other","value":"other"}]}'::json
WHERE collection = 'locations' AND field = 'location_type';

INSERT INTO directus_dashboards (id, name, icon, note, color)
VALUES (
    '3fb99f1e-3848-41f3-a57d-28a55b7a2e26',
    'Phase 4 Operations',
    'monitor_heart',
    'Provider failure, stale forecast and governance review indicators. Panels show real database state only.',
    '#0B7285'
)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    icon = EXCLUDED.icon,
    note = EXCLUDED.note,
    color = EXCLUDED.color;

INSERT INTO directus_panels (
    id, dashboard, name, icon, color, show_header, note, type,
    position_x, position_y, width, height, options
)
VALUES
(
    '5aac223d-c4ae-472c-a070-d08324a02221',
    '3fb99f1e-3848-41f3-a57d-28a55b7a2e26',
    'Failed Provider Runs', 'error', '#C92A2A', true,
    'Count of real provider runs currently marked failed.', 'metric',
    1, 1, 6, 6,
    '{"collection":"provider_runs","field":"id","function":"count","filter":{"status":{"_eq":"failed"}}}'::json
),
(
    '97b0e487-38f8-4c86-9621-ed2e63f6dbe2',
    '3fb99f1e-3848-41f3-a57d-28a55b7a2e26',
    'Stale Forecast Records', 'schedule', '#E67700', true,
    'Count of normalized forecast rows explicitly marked stale.', 'metric',
    7, 1, 6, 6,
    '{"collection":"weather_forecasts","field":"id","function":"count","filter":{"status":{"_eq":"stale"}}}'::json
),
(
    '1c7010b0-4db7-4234-907a-bd835752286f',
    '3fb99f1e-3848-41f3-a57d-28a55b7a2e26',
    'Risk Rule Sets Awaiting Review', 'approval', '#5F3DC4', true,
    'Count of risk rule-set versions submitted for independent review.', 'metric',
    1, 7, 6, 6,
    '{"collection":"risk_rule_sets","field":"id","function":"count","filter":{"status":{"_eq":"review"}}}'::json
),
(
    '35c8be20-65c3-45ff-ac71-a8159630db12',
    '3fb99f1e-3848-41f3-a57d-28a55b7a2e26',
    'Approved Advisories Not Published', 'campaign', '#1971C2', true,
    'Count of approved advisories waiting for publication.', 'metric',
    7, 7, 6, 6,
    '{"collection":"risk_advisories","field":"id","function":"count","filter":{"status":{"_eq":"approved"}}}'::json
)
ON CONFLICT (id) DO UPDATE SET
    dashboard = EXCLUDED.dashboard,
    name = EXCLUDED.name,
    icon = EXCLUDED.icon,
    color = EXCLUDED.color,
    show_header = EXCLUDED.show_header,
    note = EXCLUDED.note,
    type = EXCLUDED.type,
    position_x = EXCLUDED.position_x,
    position_y = EXCLUDED.position_y,
    width = EXCLUDED.width,
    height = EXCLUDED.height,
    options = EXCLUDED.options;

DELETE FROM directus_presets WHERE bookmark LIKE 'Phase 4 - %';
INSERT INTO directus_presets (bookmark, role, collection, layout, layout_query, filter, icon, color)
VALUES
('Phase 4 - Published locations', 'defe9820-db53-4796-8703-2d33f5b210ca', 'locations', 'tabular', '{"tabular":{"fields":["canonical_name","location_type","status","administrative_unit_id","date_updated"]}}'::json, '{"status":{"_eq":"published"}}'::json, 'place', '#0B7285'),
('Phase 4 - Failed provider runs', 'c32c47a7-dddc-4569-a97c-ade309aee05a', 'provider_runs', 'tabular', '{"tabular":{"fields":["provider_id","run_type","status","started_at","completed_at","error_code"]}}'::json, '{"status":{"_eq":"failed"}}'::json, 'error', '#C92A2A'),
('Phase 4 - My draft risk sets', '01929767-a1ad-4008-abc0-d2798f74291a', 'risk_rule_sets', 'tabular', '{"tabular":{"fields":["external_key","version","name","status","date_updated"]}}'::json, '{"status":{"_eq":"draft"}}'::json, 'edit_note', '#5F3DC4'),
('Phase 4 - Risk sets awaiting review', '8d941c93-96f1-4d3b-823e-a645cdbe73b1', 'risk_rule_sets', 'tabular', '{"tabular":{"fields":["external_key","version","name","submitted_by","submitted_at"]}}'::json, '{"status":{"_eq":"review"}}'::json, 'approval', '#5F3DC4'),
('Phase 4 - Draft content releases', 'db20acc9-0592-483f-9d91-a6689de9b39b', 'content_pages', 'tabular', '{"tabular":{"fields":["external_key","version","content_type","slug","status"]}}'::json, '{"status":{"_eq":"draft"}}'::json, 'article', '#1971C2'),
('Phase 4 - Draft product plans', '839e7f3c-2cc7-43d0-a97f-1d1940e9d9de', 'product_plans', 'tabular', '{"tabular":{"fields":["external_key","version","billing_interval","status","effective_from"]}}'::json, '{"status":{"_eq":"draft"}}'::json, 'workspace_premium', '#2B8A3E'),
('Phase 4 - Recent payment events', 'abffc5cc-8fef-4525-92c7-4168b6e2ceed', 'payment_events', 'tabular', '{"tabular":{"fields":["provider_key","provider_event_id","event_type","status","received_at"]}}'::json, NULL, 'fact_check', '#495057');

REVOKE ALL ON SCHEMA app_governance FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA app_governance FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM PUBLIC;

COMMIT;
