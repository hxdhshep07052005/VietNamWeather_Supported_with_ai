#!/bin/sh
set -eu

case "${API_DB_USER:-}" in
  ''|*[!a-zA-Z0-9_]* ) echo 'API_DB_USER must contain only letters, numbers and underscores' >&2; exit 1 ;;
esac
if [ -z "${API_DB_PASSWORD:-}" ]; then
  echo 'API_DB_PASSWORD is required' >&2
  exit 1
fi

export PGPASSWORD="$POSTGRES_PASSWORD"
psql -v ON_ERROR_STOP=1 \
  -v api_role="$API_DB_USER" \
  -v api_password="$API_DB_PASSWORD" \
  -U "$POSTGRES_USER" -d "$POSTGRES_DB" <<'SQL'
SELECT format('CREATE ROLE %I LOGIN PASSWORD %L', :'api_role', :'api_password')
 WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = :'api_role')\gexec
SELECT format('ALTER ROLE %I LOGIN PASSWORD %L', :'api_role', :'api_password')\gexec

CREATE SCHEMA IF NOT EXISTS app_security;
REVOKE ALL ON SCHEMA app_security FROM PUBLIC;

CREATE TABLE IF NOT EXISTS app_security.sessions (
    session_id_hash char(64) PRIMARY KEY CHECK (session_id_hash ~ '^[0-9a-f]{64}$'),
    session_family_id uuid NOT NULL,
    user_id uuid NOT NULL,
    role_id uuid NOT NULL,
    directus_access_token_ciphertext text NOT NULL,
    directus_refresh_token_ciphertext text NOT NULL,
    access_token_expires_at timestamptz NOT NULL,
    created_at timestamptz NOT NULL,
    last_seen_at timestamptz NOT NULL,
    expires_at timestamptz NOT NULL,
    rotated_from_hash char(64) NULL CHECK (rotated_from_hash IS NULL OR rotated_from_hash ~ '^[0-9a-f]{64}$'),
    rotation_counter integer NOT NULL DEFAULT 0 CHECK (rotation_counter >= 0),
    revoked_at timestamptz NULL,
    revoke_reason text NULL,
    user_agent_hash char(64) NULL CHECK (user_agent_hash IS NULL OR user_agent_hash ~ '^[0-9a-f]{64}$'),
    ip_address_hash char(64) NULL CHECK (ip_address_hash IS NULL OR ip_address_hash ~ '^[0-9a-f]{64}$'),
    CHECK (expires_at >= created_at),
    CHECK (last_seen_at >= created_at)
);

CREATE INDEX IF NOT EXISTS sessions_user_active_idx
    ON app_security.sessions (user_id, expires_at)
    WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS sessions_family_idx
    ON app_security.sessions (session_family_id);

CREATE TABLE IF NOT EXISTS app_security.audit_events (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    event_type text NOT NULL,
    result text NOT NULL CHECK (result IN ('success', 'denied', 'error')),
    actor_user_id uuid NULL,
    session_family_id uuid NULL,
    correlation_id text NOT NULL,
    reason_code text NULL,
    ip_address_hash char(64) NULL CHECK (ip_address_hash IS NULL OR ip_address_hash ~ '^[0-9a-f]{64}$'),
    user_agent_hash char(64) NULL CHECK (user_agent_hash IS NULL OR user_agent_hash ~ '^[0-9a-f]{64}$'),
    created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS audit_events_created_at_idx
    ON app_security.audit_events (created_at DESC);
CREATE INDEX IF NOT EXISTS audit_events_actor_idx
    ON app_security.audit_events (actor_user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS app_security.password_recovery_tokens (
    recovery_handle_hash char(64) PRIMARY KEY CHECK (recovery_handle_hash ~ '^[0-9a-f]{64}$'),
    directus_reset_token_ciphertext text NOT NULL,
    created_at timestamptz NOT NULL,
    expires_at timestamptz NOT NULL,
    consumed_at timestamptz NULL,
    CHECK (expires_at >= created_at)
);

CREATE INDEX IF NOT EXISTS password_recovery_tokens_expiry_idx
    ON app_security.password_recovery_tokens (expires_at)
    WHERE consumed_at IS NULL;

CREATE TABLE IF NOT EXISTS app_security.email_verification_tokens (
    verification_handle_hash char(64) PRIMARY KEY CHECK (verification_handle_hash ~ '^[0-9a-f]{64}$'),
    directus_verification_token_ciphertext text NOT NULL,
    created_at timestamptz NOT NULL,
    expires_at timestamptz NOT NULL,
    consumed_at timestamptz NULL,
    CHECK (expires_at >= created_at)
);

CREATE INDEX IF NOT EXISTS email_verification_tokens_expiry_idx
    ON app_security.email_verification_tokens (expires_at)
    WHERE consumed_at IS NULL;

CREATE OR REPLACE FUNCTION app_security.revoke_sessions_on_identity_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, app_security
AS $$
DECLARE
    old_identity jsonb;
    new_identity jsonb;
    affected_user_id uuid;
    revoke_code text;
BEGIN
    IF TG_OP = 'DELETE' THEN
        affected_user_id := OLD.id;
        revoke_code := 'identity_deleted';
    ELSE
        old_identity := to_jsonb(OLD);
        new_identity := to_jsonb(NEW);
        affected_user_id := NEW.id;

        IF old_identity -> 'password' IS DISTINCT FROM new_identity -> 'password' THEN
            revoke_code := 'identity_password_changed';
        ELSIF old_identity -> 'role' IS DISTINCT FROM new_identity -> 'role' THEN
            revoke_code := 'identity_role_changed';
        ELSIF old_identity -> 'status' IS DISTINCT FROM new_identity -> 'status' THEN
            revoke_code := 'identity_status_changed';
        ELSIF old_identity -> 'tfa_secret' IS DISTINCT FROM new_identity -> 'tfa_secret' THEN
            revoke_code := 'identity_mfa_changed';
        ELSE
            RETURN NEW;
        END IF;
    END IF;

    UPDATE app_security.sessions
       SET revoked_at = CURRENT_TIMESTAMP,
           revoke_reason = revoke_code
     WHERE user_id = affected_user_id
       AND revoked_at IS NULL;

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION app_security.purge_retained_security_data(
    session_cutoff timestamptz,
    audit_cutoff timestamptz
)
RETURNS TABLE(deleted_sessions bigint, deleted_audit_events bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, app_security
AS $$
DECLARE
    session_count bigint;
    audit_count bigint;
BEGIN
    IF session_cutoff IS NULL OR audit_cutoff IS NULL THEN
        RAISE EXCEPTION 'Retention cutoffs are required';
    END IF;
    IF session_cutoff > CURRENT_TIMESTAMP OR audit_cutoff > CURRENT_TIMESTAMP THEN
        RAISE EXCEPTION 'Retention cutoffs cannot be in the future';
    END IF;

    DELETE FROM app_security.sessions
     WHERE (revoked_at IS NOT NULL AND revoked_at < session_cutoff)
        OR (revoked_at IS NULL AND expires_at < session_cutoff);
    GET DIAGNOSTICS session_count = ROW_COUNT;

    DELETE FROM app_security.audit_events
     WHERE created_at < audit_cutoff;
    GET DIAGNOSTICS audit_count = ROW_COUNT;

    RETURN QUERY SELECT session_count, audit_count;
END;
$$;

REVOKE ALL ON FUNCTION app_security.revoke_sessions_on_identity_change() FROM PUBLIC;
REVOKE ALL ON FUNCTION app_security.purge_retained_security_data(timestamptz, timestamptz) FROM PUBLIC;

DO $do$
BEGIN
    IF to_regclass('public.directus_users') IS NOT NULL THEN
        DROP TRIGGER IF EXISTS app_security_revoke_sessions_on_identity_change ON public.directus_users;
        CREATE TRIGGER app_security_revoke_sessions_on_identity_change
        AFTER UPDATE OR DELETE ON public.directus_users
        FOR EACH ROW
        EXECUTE FUNCTION app_security.revoke_sessions_on_identity_change();
    END IF;
END
$do$;

REVOKE ALL ON ALL TABLES IN SCHEMA app_security FROM PUBLIC;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA app_security FROM PUBLIC;
SELECT format('GRANT CONNECT ON DATABASE %I TO %I', current_database(), :'api_role')\gexec
SELECT format('GRANT USAGE ON SCHEMA app_security TO %I', :'api_role')\gexec
SELECT format('GRANT SELECT, INSERT, UPDATE, DELETE ON app_security.sessions TO %I', :'api_role')\gexec
SELECT format('GRANT INSERT ON app_security.audit_events TO %I', :'api_role')\gexec
SELECT format('GRANT SELECT, INSERT, UPDATE, DELETE ON app_security.password_recovery_tokens TO %I', :'api_role')\gexec
SELECT format('GRANT SELECT, INSERT, UPDATE, DELETE ON app_security.email_verification_tokens TO %I', :'api_role')\gexec
SELECT format('GRANT USAGE, SELECT ON SEQUENCE app_security.audit_events_id_seq TO %I', :'api_role')\gexec
SELECT format('REVOKE ALL ON FUNCTION app_security.revoke_sessions_on_identity_change() FROM %I', :'api_role')\gexec
SELECT format('REVOKE ALL ON FUNCTION app_security.purge_retained_security_data(timestamptz, timestamptz) FROM %I', :'api_role')\gexec
SQL

echo 'DATABASE_API_SECURITY_OK tables=sessions,audit_events,password_recovery_tokens,email_verification_tokens identity_revoke=true retention_function=true secrets_printed=false'
