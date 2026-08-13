#!/bin/sh
set -eu

case "${API_DB_USER:-}" in
  ''|*[!a-zA-Z0-9_]* ) echo 'API_DB_USER must contain only letters, numbers and underscores' >&2; exit 1 ;;
esac
if [ -z "${API_DB_PASSWORD:-}" ]; then
  echo 'API_DB_PASSWORD is required' >&2
  exit 1
fi
if [ "${API_DB_USER}" = 'app_weather_api' ] || [ "${API_DB_USER}" = 'app_weather_worker' ]; then
  echo 'API_DB_USER cannot use a reserved weather capability role name' >&2
  exit 1
fi

worker_configured=false
if [ -n "${WEATHER_WORKER_DB_USER:-}" ] || [ -n "${WEATHER_WORKER_DB_PASSWORD:-}" ]; then
  case "${WEATHER_WORKER_DB_USER:-}" in
    ''|*[!a-zA-Z0-9_]* ) echo 'WEATHER_WORKER_DB_USER must contain only letters, numbers and underscores' >&2; exit 1 ;;
  esac
  if [ -z "${WEATHER_WORKER_DB_PASSWORD:-}" ]; then
    echo 'WEATHER_WORKER_DB_PASSWORD is required when WEATHER_WORKER_DB_USER is set' >&2
    exit 1
  fi
  if [ "${WEATHER_WORKER_DB_USER}" = "${API_DB_USER}" ] || \
     [ "${WEATHER_WORKER_DB_USER}" = 'app_weather_api' ] || \
     [ "${WEATHER_WORKER_DB_USER}" = 'app_weather_worker' ]; then
    echo 'WEATHER_WORKER_DB_USER must be distinct from API and capability roles' >&2
    exit 1
  fi
  worker_configured=true
fi

export PGPASSWORD="$POSTGRES_PASSWORD"
psql -q -v ON_ERROR_STOP=1 \
  -v api_role="$API_DB_USER" \
  -v api_password="$API_DB_PASSWORD" \
  -U "$POSTGRES_USER" -d "$POSTGRES_DB" <<'SQL'
DO $do$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_weather_api' AND NOT rolcanlogin) OR
       NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_weather_worker' AND NOT rolcanlogin) THEN
        RAISE EXCEPTION 'Phase 5 weather capability roles are missing';
    END IF;
END
$do$;

SELECT format('CREATE ROLE %I LOGIN PASSWORD %L', :'api_role', :'api_password')
 WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = :'api_role')\gexec
SELECT format(
    'ALTER ROLE %I LOGIN PASSWORD %L NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION INHERIT',
    :'api_role', :'api_password'
)\gexec
SELECT format('REVOKE app_weather_worker FROM %I', :'api_role')\gexec
SELECT format('GRANT app_weather_api TO %I', :'api_role')\gexec
SELECT format('GRANT CONNECT ON DATABASE %I TO %I', current_database(), :'api_role')\gexec
SELECT format('REVOKE ALL ON ALL TABLES IN SCHEMA public FROM %I', :'api_role')\gexec
SELECT format('REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM %I', :'api_role')\gexec
SELECT format('REVOKE ALL ON ALL FUNCTIONS IN SCHEMA app_weather FROM %I', :'api_role')\gexec
SELECT set_config('app.phase5_api_role', :'api_role', false);

DO $do$
DECLARE
    checked_role name := current_setting('app.phase5_api_role');
BEGIN
    IF EXISTS (
        SELECT 1
          FROM pg_class AS relation
          JOIN pg_namespace AS namespace ON namespace.oid = relation.relnamespace
         WHERE namespace.nspname = 'public'
           AND relation.relkind IN ('r', 'p', 'v', 'm')
           AND has_table_privilege(
               checked_role,
               format('%I.%I', namespace.nspname, relation.relname),
               'INSERT,UPDATE,DELETE,TRUNCATE'
           )
    ) THEN
        RAISE EXCEPTION 'API database role has direct public-table mutation privileges';
    END IF;
    IF NOT has_function_privilege(
        checked_role,
        'app_weather.enqueue_weather_run(uuid,text,text,text,uuid,double precision,double precision,integer,timestamptz,jsonb)',
        'EXECUTE'
    ) OR NOT has_function_privilege(
        checked_role,
        'app_weather.enqueue_weather_run_by_provider_key(text,text,text,text,uuid,double precision,double precision,integer,timestamptz,jsonb)',
        'EXECUTE'
    ) OR NOT has_function_privilege(
        checked_role,
        'app_weather.fetch_weather_capabilities(text)',
        'EXECUTE'
    ) OR NOT has_function_privilege(
        checked_role,
        'app_weather.fetch_weather_bundle_public(uuid,double precision,double precision,timestamp with time zone)',
        'EXECUTE'
    ) OR has_function_privilege(
        checked_role,
        'app_weather.fetch_weather_bundle(uuid,double precision,double precision,timestamp with time zone)',
        'EXECUTE'
    ) OR has_function_privilege(checked_role, 'app_weather.claim_weather_run(text,interval)', 'EXECUTE') THEN
        RAISE EXCEPTION 'API weather function boundary is invalid';
    END IF;
END
$do$;
SQL

if [ "$worker_configured" = 'true' ]; then
  psql -q -v ON_ERROR_STOP=1 \
    -v worker_role="$WEATHER_WORKER_DB_USER" \
    -v worker_password="$WEATHER_WORKER_DB_PASSWORD" \
    -U "$POSTGRES_USER" -d "$POSTGRES_DB" <<'SQL'
SELECT format('CREATE ROLE %I LOGIN PASSWORD %L', :'worker_role', :'worker_password')
 WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = :'worker_role')\gexec
SELECT format(
    'ALTER ROLE %I LOGIN PASSWORD %L NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION INHERIT',
    :'worker_role', :'worker_password'
)\gexec
SELECT format('REVOKE app_weather_api FROM %I', :'worker_role')\gexec
SELECT format('GRANT app_weather_worker TO %I', :'worker_role')\gexec
SELECT format('GRANT CONNECT ON DATABASE %I TO %I', current_database(), :'worker_role')\gexec
SELECT format('REVOKE ALL ON SCHEMA app_security FROM %I', :'worker_role')
 WHERE to_regnamespace('app_security') IS NOT NULL\gexec
SELECT format('REVOKE ALL ON ALL TABLES IN SCHEMA app_security FROM %I', :'worker_role')
 WHERE to_regnamespace('app_security') IS NOT NULL\gexec
SELECT format('REVOKE ALL ON ALL SEQUENCES IN SCHEMA app_security FROM %I', :'worker_role')
 WHERE to_regnamespace('app_security') IS NOT NULL\gexec
SELECT format('REVOKE ALL ON ALL TABLES IN SCHEMA public FROM %I', :'worker_role')\gexec
SELECT format('REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM %I', :'worker_role')\gexec
SELECT format('REVOKE ALL ON ALL FUNCTIONS IN SCHEMA app_weather FROM %I', :'worker_role')\gexec
SELECT set_config('app.phase5_worker_role', :'worker_role', false);

DO $do$
DECLARE
    checked_role name := current_setting('app.phase5_worker_role');
BEGIN
    IF EXISTS (
        SELECT 1
          FROM pg_class AS relation
          JOIN pg_namespace AS namespace ON namespace.oid = relation.relnamespace
         WHERE namespace.nspname IN ('public', 'app_security')
           AND relation.relkind IN ('r', 'p', 'v', 'm')
           AND has_table_privilege(
               checked_role,
               format('%I.%I', namespace.nspname, relation.relname),
               'SELECT,INSERT,UPDATE,DELETE,TRUNCATE'
           )
    ) THEN
        RAISE EXCEPTION 'Weather worker role has direct business-table privileges';
    END IF;
    IF NOT has_function_privilege(checked_role, 'app_weather.claim_weather_run(text,interval)', 'EXECUTE') OR
       NOT has_function_privilege(checked_role, 'app_weather.persist_weather_bundle(uuid,uuid,jsonb,jsonb)', 'EXECUTE') OR
       has_function_privilege(
           checked_role,
           'app_weather.enqueue_weather_run(uuid,text,text,text,uuid,double precision,double precision,integer,timestamptz,jsonb)',
           'EXECUTE'
       ) OR
       has_function_privilege(checked_role, 'app_weather.purge_weather_runtime(timestamptz)', 'EXECUTE') THEN
        RAISE EXCEPTION 'Weather worker function boundary is invalid';
    END IF;
END
$do$;
SQL
  echo 'DATABASE_WEATHER_SECURITY_OK api_role_configured=true worker_login_configured=true direct_business_crud=false secrets_printed=false'
else
  psql -q -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" <<'SQL'
DO $do$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_roles
         WHERE rolname = 'app_weather_worker'
           AND NOT rolcanlogin
           AND NOT rolsuper
           AND NOT rolcreatedb
           AND NOT rolcreaterole
    ) OR NOT has_function_privilege('app_weather_worker', 'app_weather.claim_weather_run(text,interval)', 'EXECUTE') OR
       has_function_privilege('app_weather_worker', 'app_weather.enqueue_weather_run(uuid,text,text,text,uuid,double precision,double precision,integer,timestamptz,jsonb)', 'EXECUTE') OR
       has_function_privilege('app_weather_worker', 'app_weather.purge_weather_runtime(timestamptz)', 'EXECUTE') THEN
        RAISE EXCEPTION 'Deferred weather worker capability boundary is invalid';
    END IF;
    IF EXISTS (
        SELECT 1
          FROM pg_class AS relation
          JOIN pg_namespace AS namespace ON namespace.oid = relation.relnamespace
         WHERE namespace.nspname IN ('public', 'app_security')
           AND relation.relkind IN ('r', 'p', 'v', 'm')
           AND has_table_privilege(
               'app_weather_worker',
               format('%I.%I', namespace.nspname, relation.relname),
               'SELECT,INSERT,UPDATE,DELETE,TRUNCATE'
           )
    ) THEN
        RAISE EXCEPTION 'Deferred weather worker capability role has direct business-table privileges';
    END IF;
END
$do$;
SQL
  echo 'DATABASE_WEATHER_SECURITY_OK api_role_configured=true worker_login_configured=false worker_login_deferred=missing_env direct_business_crud=false secrets_printed=false'
fi
