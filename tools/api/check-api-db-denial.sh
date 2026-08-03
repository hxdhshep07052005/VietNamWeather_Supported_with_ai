#!/bin/sh
set -eu

if PGPASSWORD="$API_DB_PASSWORD" psql -v ON_ERROR_STOP=1 \
  -U "$API_DB_USER" -d "$POSTGRES_DB" \
  -c 'SELECT password FROM directus_users LIMIT 1' >/dev/null 2>&1; then
  echo 'Application API database role can read Directus credential columns' >&2
  exit 1
fi

if PGPASSWORD="$API_DB_PASSWORD" psql -v ON_ERROR_STOP=1 \
  -U "$API_DB_USER" -d "$POSTGRES_DB" \
  -c 'DELETE FROM app_security.audit_events WHERE false' >/dev/null 2>&1; then
  echo 'Application API database role can delete immutable security audit events' >&2
  exit 1
fi

retention_privilege="$(PGPASSWORD="$API_DB_PASSWORD" psql -At -v ON_ERROR_STOP=1 \
  -U "$API_DB_USER" -d "$POSTGRES_DB" \
  -c "SELECT has_function_privilege(current_user, 'app_security.purge_retained_security_data(timestamptz,timestamptz)', 'EXECUTE')")"
if [ "$retention_privilege" != 'f' ]; then
  echo 'Application API database role can execute the retention purge function' >&2
  exit 1
fi

echo 'API_DATABASE_CREDENTIAL_DENIAL_OK directus_credentials=true audit_delete=true retention_execute=true secrets_printed=false'
