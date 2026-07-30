CREATE TABLE IF NOT EXISTS app_seed_runs (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    manifest_key text NOT NULL,
    manifest_version text NOT NULL,
    manifest_checksum char(64) NOT NULL,
    environment text NOT NULL,
    actor text NOT NULL,
    operation_count integer NOT NULL CHECK (operation_count >= 0),
    status text NOT NULL CHECK (status IN ('applied')),
    applied_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (manifest_key, manifest_version, environment)
);

CREATE INDEX IF NOT EXISTS app_seed_runs_applied_at_idx
    ON app_seed_runs (applied_at DESC);

COMMENT ON TABLE app_seed_runs IS
    'Audit records for versioned, environment-scoped seed manifests. No secret values are stored.';
