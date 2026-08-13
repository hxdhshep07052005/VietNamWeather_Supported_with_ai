-- Phase 6: Config-Driven Weather Risk Engine
-- Extension cho risk_rule_sets và risk_rules đã được tạo trong Phase 4
-- File này bổ sung evaluation functions và indexes cho risk assessment

BEGIN;

-- =============================================================================
-- SCHEMA: app_risk
-- =============================================================================
CREATE SCHEMA IF NOT EXISTS app_risk;
REVOKE ALL ON SCHEMA app_risk FROM PUBLIC;

-- =============================================================================
-- ROLES: Risk Engine Service Accounts
-- =============================================================================
DO $do$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_risk_api') THEN
        CREATE ROLE app_risk_api NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION INHERIT;
    END IF;
END
$do$;

ALTER ROLE app_risk_api NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION INHERIT;

ALTER DEFAULT PRIVILEGES IN SCHEMA app_risk REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;

-- =============================================================================
-- SEVERITY MAPPING: Risk levels theo RISK-001
-- =============================================================================

-- Drop existing function if exists for idempotent migration
DROP FUNCTION IF EXISTS app_risk.get_severity_score CASCADE;
DROP FUNCTION IF EXISTS app_risk.evaluate_rules CASCADE;
DROP FUNCTION IF EXISTS app_risk.assess_weather_risk CASCADE;
DROP TYPE IF EXISTS app_risk.severity_level CASCADE;

CREATE TYPE app_risk.severity_level AS ENUM (
    'low',      -- 1: Low risk
    'caution',  -- 2: Caution
    'high',     -- 3: High risk
    'unknown'   -- 4: Unknown/insufficient data
);

COMMENT ON TYPE app_risk.severity_level IS 'Risk levels per RISK-001: Low(1), Caution(2), High(3), Unknown(4)';

-- =============================================================================
-- FUNCTION: get_severity_score
-- Maps severity string to numeric score for comparison
-- =============================================================================
CREATE OR REPLACE FUNCTION app_risk.get_severity_score(
    p_severity text
) RETURNS integer
LANGUAGE plpgsql
STABLE
STRICT
AS $$
BEGIN
    RETURN CASE p_severity
        WHEN 'high'    THEN 3
        WHEN 'caution' THEN 2
        WHEN 'low'     THEN 1
        ELSE 0  -- unknown hoặc bất kỳ giá trị nào khác
    END;
END;
$$;

COMMENT ON FUNCTION app_risk.get_severity_score IS
'Evaluates weather observations/forecasts against published risk rules.
Returns severity_level, triggered rules count, and evidence.
Per RISK-005: Uses max severity aggregation.';

GRANT EXECUTE ON FUNCTION app_risk.get_severity_score TO app_risk_api;

-- =============================================================================
-- FUNCTION: evaluate_rules
-- Core rule evaluation logic - reads from risk_rules table
-- =============================================================================
CREATE OR REPLACE FUNCTION app_risk.evaluate_rules(
    p_rule_set_id uuid,
    p_weather jsonb,
    p_dimension text DEFAULT NULL  -- NULL means evaluate all dimensions
) RETURNS TABLE (
    rule_id uuid,
    external_key text,
    dimension text,
    severity integer,
    severity_label text,
    triggered boolean,
    actual_value numeric,
    threshold_value numeric,
    threshold_upper numeric
)
LANGUAGE plpgsql
STABLE
READS SQL DATA
SECURITY DEFINER
SET search_path = app_risk, pg_temp
AS $$
DECLARE
    v_rules record;
    v_field_value numeric;
    v_operator text;
    v_threshold numeric;
    v_threshold_upper numeric;
    v_severity integer;
    v_severity_label text;
    v_triggered boolean;
BEGIN
    -- Iterate through rules for the given rule set
    FOR v_rules IN
        SELECT id, external_key, dimension, field_path, operator,
               threshold_value, threshold_upper_value, severity, weight
          FROM risk_rules
         WHERE rule_set_id = p_rule_set_id
           AND (p_dimension IS NULL OR dimension = p_dimension)
    LOOP
        -- Extract field value from weather JSON using JSON path
        BEGIN
            v_field_value := (p_weather #>> string_to_array(v_rules.field_path, '.'))::numeric;
            v_triggered := FALSE;
        EXCEPTION WHEN OTHERS THEN
            v_field_value := NULL;
            v_triggered := FALSE;
        END;

        v_operator := v_rules.operator;
        v_threshold := v_rules.threshold_value;
        v_threshold_upper := v_rules.threshold_upper_value;
        v_severity := app_risk.get_severity_score(v_rules.severity);
        v_severity_label := v_rules.severity;

        -- Evaluate based on operator
        IF v_field_value IS NOT NULL THEN
            v_triggered := CASE v_operator
                WHEN 'gt'   THEN v_field_value > v_threshold
                WHEN 'gte'  THEN v_field_value >= v_threshold
                WHEN 'lt'   THEN v_field_value < v_threshold
                WHEN 'lte'  THEN v_field_value <= v_threshold
                WHEN 'eq'   THEN v_field_value = v_threshold
                WHEN 'between' THEN v_field_value BETWEEN v_threshold AND v_threshold_upper
                WHEN 'in'   THEN v_field_value = ANY(string_to_array(v_threshold::text, ',')::numeric[])
                WHEN 'missing' THEN FALSE  -- Field is present, not missing
                ELSE FALSE
            END;
        ELSIF v_operator = 'missing' THEN
            v_triggered := TRUE;
        END IF;

        RETURN NEXT;
    END LOOP;

    RETURN;
END;
$$;

COMMENT ON FUNCTION app_risk.evaluate_rules IS
'Evaluates weather data against rules in a rule set.
Returns all rules with triggered status.
Per RISK-005: Uses max severity aggregation.';

GRANT EXECUTE ON FUNCTION app_risk.evaluate_rules TO app_risk_api;

-- =============================================================================
-- FUNCTION: assess_weather_risk
-- Main entry point for risk assessment
-- =============================================================================
CREATE OR REPLACE FUNCTION app_risk.assess_weather_risk(
    p_rule_set_id uuid,
    p_weather jsonb,
    p_freshness_state text DEFAULT 'fresh'  -- 'fresh', 'stale', 'expired'
)
RETURNS app_risk.severity_level
LANGUAGE plpgsql
STABLE
READS SQL DATA
SECURITY DEFINER
SET search_path = app_risk, pg_temp
AS $$
DECLARE
    v_max_severity integer := 0;
    v_severity_label text;
    v_freshness_state text;
BEGIN
    -- Per RISK-006: Stale or expired data always returns 'unknown'
    IF p_freshness_state IN ('stale', 'expired', 'unavailable') THEN
        RETURN 'unknown';
    END IF;

    -- Find the highest severity triggered rule
    SELECT MAX(app_risk.get_severity_score(severity_label))
      INTO v_max_severity
      FROM app_risk.evaluate_rules(p_rule_set_id, p_weather)
     WHERE triggered = TRUE;

    -- If no rules triggered, return 'low'
    IF v_max_severity = 0 OR v_max_severity IS NULL THEN
        RETURN 'low';
    END IF;

    -- Map numeric severity back to label
    v_severity_label := CASE v_max_severity
        WHEN 3 THEN 'high'
        WHEN 2 THEN 'caution'
        WHEN 1 THEN 'low'
        ELSE 'unknown'
    END;

    RETURN v_severity_label::app_risk.severity_level;
END;
$$;

COMMENT ON FUNCTION app_risk.assess_weather_risk IS
'Main risk assessment function.
Per RISK-006: Stale/expired/unavailable data returns unknown.
Per RISK-005: Max severity aggregation.';

GRANT EXECUTE ON FUNCTION app_risk.assess_weather_risk TO app_risk_api;

-- =============================================================================
-- FUNCTION: get_triggered_rules
-- Returns detailed list of triggered rules for evidence
-- =============================================================================
CREATE OR REPLACE FUNCTION app_risk.get_triggered_rules(
    p_rule_set_id uuid,
    p_weather jsonb
) RETURNS TABLE (
    rule_id uuid,
    external_key text,
    dimension text,
    severity text,
    field_value numeric,
    threshold numeric,
    threshold_upper numeric,
    message text
)
LANGUAGE plpgsql
STABLE
READS SQL DATA
SECURITY DEFINER
SET search_path = app_risk, pg_temp
AS $$
BEGIN
    RETURN QUERY
    SELECT
        e.rule_id,
        e.external_key,
        e.dimension,
        e.severity_label,
        e.actual_value,
        e.threshold_value,
        e.threshold_upper,
        format(
            '%s: %s %s %s',
            e.dimension,
            e.actual_value,
            e.external_key,  -- This would ideally be operator symbol
            COALESCE(e.threshold_value::text, '')
        )::text as message
    FROM app_risk.evaluate_rules(p_rule_set_id, p_weather) e
    WHERE e.triggered = TRUE
    ORDER BY app_risk.get_severity_score(e.severity_label) DESC, e.external_key;
END;
$$;

COMMENT ON FUNCTION app_risk.get_triggered_rules IS
'Returns triggered rules for risk assessment evidence.
Ordered by severity descending.';

GRANT EXECUTE ON FUNCTION app_risk.get_triggered_rules TO app_risk_api;

-- =============================================================================
-- FUNCTION: get_active_rule_set
-- Gets the currently active published rule set
-- =============================================================================
CREATE OR REPLACE FUNCTION app_risk.get_active_rule_set()
RETURNS uuid
LANGUAGE plpgsql
STABLE
READS SQL DATA
SECURITY DEFINER
SET search_path = app_risk, pg_temp
AS $$
DECLARE
    v_rule_set_id uuid;
BEGIN
    SELECT id INTO v_rule_set_id
      FROM risk_rule_sets
     WHERE status = 'published'
       AND (effective_from IS NULL OR effective_from <= CURRENT_TIMESTAMP)
       AND (effective_to IS NULL OR effective_to >= CURRENT_TIMESTAMP)
     ORDER BY version DESC
     LIMIT 1;

    RETURN v_rule_set_id;
END;
$$;

COMMENT ON FUNCTION app_risk.get_active_rule_set IS
'Returns the currently active published rule set ID.';

GRANT EXECUTE ON FUNCTION app_risk.get_active_rule_set TO app_risk_api;

-- =============================================================================
-- INDEXES for performance
-- =============================================================================

-- Index for evaluating rules by dimension
CREATE INDEX IF NOT EXISTS risk_rules_dimension_idx
    ON risk_rules (rule_set_id, dimension);

-- Index for finding published rule sets
CREATE INDEX IF NOT EXISTS risk_rule_sets_published_idx
    ON risk_rule_sets (status, effective_from, effective_to)
    WHERE status = 'published';

-- =============================================================================
-- GRANT PERMISSIONS
-- =============================================================================

-- Grant SELECT on risk tables to app_risk_api
GRANT USAGE ON SCHEMA app_risk TO app_risk_api;
GRANT SELECT ON risk_rule_sets TO app_risk_api;
GRANT SELECT ON risk_rules TO app_risk_api;
GRANT SELECT ON risk_rule_translations TO app_risk_api;

-- Grant membership to app_risk_api
DO $do$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'vnwa_api') THEN
        GRANT app_risk_api TO vnwa_api;
    END IF;
END
$do$;

COMMIT;

-- =============================================================================
-- VERIFICATION
-- =============================================================================
-- Run this to verify:
-- SELECT app_risk.get_active_rule_set();
-- SELECT app_risk.assess_weather_risk(
--     'your-rule-set-uuid',
--     '{"temp_c": 40, "wind_speed": 12, "vis_km": 8}'::jsonb,
--     'fresh'
-- );
