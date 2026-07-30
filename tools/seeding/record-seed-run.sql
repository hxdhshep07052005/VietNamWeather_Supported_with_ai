WITH inserted AS (
    INSERT INTO app_seed_runs (
        manifest_key,
        manifest_version,
        manifest_checksum,
        environment,
        actor,
        operation_count,
        status
    )
    VALUES (
        :'seed_key',
        :'seed_version',
        :'seed_checksum',
        :'seed_environment',
        :'seed_actor',
        :'seed_operation_count'::integer,
        'applied'
    )
    ON CONFLICT (manifest_key, manifest_version, environment) DO NOTHING
    RETURNING manifest_checksum
), recorded AS (
    SELECT manifest_checksum
    FROM app_seed_runs
    WHERE manifest_key = :'seed_key'
      AND manifest_version = :'seed_version'
      AND environment = :'seed_environment'
)
SELECT CASE
    WHEN EXISTS (SELECT 1 FROM inserted) THEN 'applied'
    WHEN (SELECT manifest_checksum FROM recorded) = :'seed_checksum' THEN 'skipped'
    ELSE 'checksum_mismatch'
END;
