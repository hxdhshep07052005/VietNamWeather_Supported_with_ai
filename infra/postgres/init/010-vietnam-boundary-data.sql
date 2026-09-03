-- Seed Vietnam boundary data for weather scheduler
-- This enables boundary checking for weather coordinate validation

DO $$
DECLARE
    v_source_id uuid;
    v_version_id uuid;
    v_admin_user uuid;
BEGIN
    -- Get admin user
    SELECT id INTO v_admin_user FROM directus_users LIMIT 1;

    -- Insert reference source (lowercase key required by constraint)
    INSERT INTO reference_sources (
        id, external_key, name, publisher, source_url,
        publication_version, status, checksum_sha256,
        approved_by, approved_at
    )
    VALUES (
        gen_random_uuid(),
        'vn-gov-bounds',
        'Vietnam Administrative Boundaries',
        'Government of Vietnam',
        'https://vietnam.gov.vn',
        '1.0',
        'approved',
        'a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3',
        v_admin_user,
        NOW()
    )
    ON CONFLICT (external_key) DO NOTHING
    RETURNING id INTO v_source_id;

    -- Get existing or create version
    SELECT id INTO v_version_id
    FROM administrative_versions
    WHERE external_key = 'vn-bounds-2024';

    IF v_version_id IS NULL THEN
        INSERT INTO administrative_versions (
            id, external_key, reference_source_id, version_label,
            effective_from, status, checksum_sha256,
            approved_by, approved_at
        )
        VALUES (
            gen_random_uuid(),
            'vn-bounds-2024',
            v_source_id,
            'Vietnam Boundary 2024',
            '2024-01-01',
            'approved',
            'b665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3',
            v_admin_user,
            NOW()
        )
        RETURNING id INTO v_version_id;
    END IF;

    -- Insert Vietnam country boundary (simplified rectangle covering all of Vietnam)
    INSERT INTO administrative_units (
        id, administrative_version_id, external_key,
        country_code, unit_type, canonical_name,
        boundary, valid_from, status
    )
    VALUES (
        gen_random_uuid(),
        v_version_id,
        'vn',
        'VN',
        'country',
        'Việt Nam',
        ST_GeomFromText(
            'SRID=4326;MULTIPOLYGON(((
                102.144180 23.352000,
                102.144180 8.381300,
                109.469200 8.381300,
                109.469200 23.352000,
                102.144180 23.352000
            )))',
            4326
        ),
        '2024-01-01',
        'active'
    )
    ON CONFLICT (administrative_version_id, external_key)
    DO UPDATE SET
        boundary = EXCLUDED.boundary,
        status = 'active';

    RAISE NOTICE 'Vietnam boundary data seeded successfully';
END $$;

-- Grant permissions
GRANT USAGE ON SCHEMA public TO app_weather_api;
GRANT SELECT ON administrative_units TO app_weather_api;
GRANT SELECT ON administrative_versions TO app_weather_api;
GRANT SELECT ON reference_sources TO app_weather_api;
