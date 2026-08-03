param([string]$RuntimeEnvPath = '.env.local')

$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [Text.Encoding]::UTF8
$workspaceRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path

function Read-EnvironmentFile {
    param([string]$Path)
    $values = @{}
    Get-Content -LiteralPath $Path | ForEach-Object {
        if ($_ -match '^([A-Za-z_][A-Za-z0-9_]*)=(.*)$') { $values[$Matches[1]] = $Matches[2] }
    }
    return $values
}

function New-Id { return [Guid]::NewGuid().ToString() }

$runtime = Read-EnvironmentFile (Join-Path $workspaceRoot $RuntimeEnvPath)
if ([string]$runtime['DB_USER'] -notmatch '^[A-Za-z0-9_]+$' -or [string]$runtime['DB_DATABASE'] -notmatch '^[A-Za-z0-9_]+$') {
    throw 'Database environment values have an invalid format.'
}

$adminId = [string](docker compose --env-file $RuntimeEnvPath exec -T database psql -qAt -v ON_ERROR_STOP=1 -U $runtime['DB_USER'] -d $runtime['DB_DATABASE'] -c "SELECT id FROM directus_users LIMIT 1;")
if ($LASTEXITCODE -ne 0 -or $adminId.Trim() -notmatch '^[0-9a-fA-F-]{36}$') { throw 'A Directus actor is required for governance fixtures.' }
$adminId = $adminId.Trim()

$sourceId = New-Id
$versionOneId = New-Id
$versionTwoId = New-Id
$parentUnitId = New-Id
$childUnitId = New-Id
$crossVersionUnitId = New-Id
$contentId = New-Id
$ruleSetId = New-Id
$riskRuleId = New-Id
$advisoryId = New-Id
$planId = New-Id
$featureId = New-Id
$usagePolicyId = New-Id
$usageEventId = New-Id
$paymentEventId = New-Id
$suffix = [Guid]::NewGuid().ToString('N')
$sourceKey = "phase4-test-source-$suffix"
$versionOneKey = "phase4-test-admin-v1-$suffix"
$versionTwoKey = "phase4-test-admin-v2-$suffix"
$contentKey = "phase4-test-content-$suffix"
$ruleSetKey = "phase4-test-rules-$suffix"
$advisoryKey = "phase4-test-advisory-$suffix"
$planKey = "phase4-test-plan-$suffix"
$featureKey = "phase4-test-feature-$suffix"
$usagePolicyKey = "phase4-test-usage-$suffix"
$usageKey = "phase4-test-usage-event-$suffix"
$paymentKey = "phase4-test-payment-$suffix"

$sql = @"
BEGIN;

DO `$test`$
DECLARE
    invalid_parent boolean := false;
    invalid_workflow boolean := false;
    invalid_rule_mutation boolean := false;
    self_approval_rule boolean := false;
    self_approval_advisory boolean := false;
    immutable_usage_update boolean := false;
    immutable_usage_delete boolean := false;
    immutable_payment_update boolean := false;
    immutable_payment_delete boolean := false;
BEGIN
    INSERT INTO reference_sources (
        id, external_key, name, publisher, source_url, publication_version, status, user_created
    ) VALUES (
        '$sourceId', '$sourceKey', 'Phase 4 ephemeral source', 'test',
        'https://example.invalid/phase4-test', 'fixture', 'draft', '$adminId'
    );

    INSERT INTO administrative_versions (
        id, external_key, reference_source_id, version_label, effective_from, checksum_sha256, status, user_created
    ) VALUES
    ('$versionOneId', '$versionOneKey', '$sourceId', 'fixture-v1', CURRENT_DATE, repeat('a', 64), 'draft', '$adminId'),
    ('$versionTwoId', '$versionTwoKey', '$sourceId', 'fixture-v2', CURRENT_DATE, repeat('b', 64), 'draft', '$adminId');

    INSERT INTO administrative_units (
        id, administrative_version_id, external_key, country_code, unit_type, canonical_name, valid_from, status, user_created
    ) VALUES
    ('$parentUnitId', '$versionOneId', 'phase4-test-parent-$suffix', 'ZZ', 'province', 'Ephemeral parent', CURRENT_DATE, 'active', '$adminId'),
    ('$childUnitId', '$versionOneId', 'phase4-test-child-$suffix', 'ZZ', 'district', 'Ephemeral child', CURRENT_DATE, 'active', '$adminId');

    UPDATE administrative_units SET parent_id = '$parentUnitId' WHERE id = '$childUnitId';
    BEGIN
        INSERT INTO administrative_units (
            id, administrative_version_id, parent_id, external_key, country_code, unit_type, canonical_name, valid_from, status, user_created
        ) VALUES (
            '$crossVersionUnitId', '$versionTwoId', '$parentUnitId', 'phase4-test-cross-version-$suffix', 'ZZ', 'district', 'Invalid cross-version child', CURRENT_DATE, 'active', '$adminId'
        );
    EXCEPTION WHEN OTHERS THEN
        IF SQLERRM NOT LIKE '%Administrative parent must belong to the same version%' THEN RAISE; END IF;
        invalid_parent := true;
    END;

    INSERT INTO content_pages (
        id, external_key, version, content_type, slug, status, user_created
    ) VALUES ('$contentId', '$contentKey', 1, 'help', '$contentKey', 'draft', '$adminId');
    BEGIN
        UPDATE content_pages SET status = 'approved', approved_by = '$adminId', approved_at = CURRENT_TIMESTAMP WHERE id = '$contentId';
    EXCEPTION WHEN OTHERS THEN
        IF SQLERRM NOT LIKE '%Invalid governed status transition%' THEN RAISE; END IF;
        invalid_workflow := true;
    END;

    INSERT INTO risk_rule_sets (
        id, external_key, version, name, description, reference_source_id, status, user_created
    ) VALUES ('$ruleSetId', '$ruleSetKey', 1, 'Ephemeral rule set', 'Fixture only', '$sourceId', 'draft', '$adminId');
    INSERT INTO risk_rules (
        id, rule_set_id, external_key, input_key, operator, threshold_value, threshold_unit,
        severity, explanation_key, source_reference, user_created
    ) VALUES (
        '$riskRuleId', '$ruleSetId', 'phase4-test-rule-$suffix', 'fixture.value', 'gte', 1, 'unit',
        'low', 'phase4.test.rule', 'fixture', '$adminId'
    );
    UPDATE risk_rule_sets
       SET status = 'review', submitted_by = '$adminId', submitted_at = CURRENT_TIMESTAMP
     WHERE id = '$ruleSetId';
    BEGIN
        UPDATE risk_rules SET notes = 'must be rejected' WHERE id = '$riskRuleId';
    EXCEPTION WHEN OTHERS THEN
        IF SQLERRM NOT LIKE '%Risk rules can only change while the rule set is draft%' THEN RAISE; END IF;
        invalid_rule_mutation := true;
    END;
    BEGIN
        UPDATE risk_rule_sets
           SET status = 'approved', approved_by = '$adminId', approved_at = CURRENT_TIMESTAMP
         WHERE id = '$ruleSetId';
    EXCEPTION WHEN OTHERS THEN
        IF SQLERRM NOT LIKE '%Maker-checker separation forbids self-approval%' THEN RAISE; END IF;
        self_approval_rule := true;
    END;

    INSERT INTO risk_advisories (
        id, external_key, version, administrative_unit_id, rule_set_id, reference_source_id,
        title_translation_key, body_translation_key, official_url, status, user_created
    ) VALUES (
        '$advisoryId', '$advisoryKey', 1, '$parentUnitId', '$ruleSetId', '$sourceId',
        'phase4.test.title', 'phase4.test.body', 'https://example.invalid/advisory', 'draft', '$adminId'
    );
    UPDATE risk_advisories
       SET status = 'review', submitted_by = '$adminId', submitted_at = CURRENT_TIMESTAMP
     WHERE id = '$advisoryId';
    BEGIN
        UPDATE risk_advisories
           SET status = 'approved', approved_by = '$adminId', approved_at = CURRENT_TIMESTAMP
         WHERE id = '$advisoryId';
    EXCEPTION WHEN OTHERS THEN
        IF SQLERRM NOT LIKE '%Maker-checker separation forbids self-approval%' THEN RAISE; END IF;
        self_approval_advisory := true;
    END;

    INSERT INTO product_plans (
        id, external_key, version, name_translation_key, description_translation_key, billing_interval, status, user_created
    ) VALUES ('$planId', '$planKey', 1, 'phase4.test.plan.name', 'phase4.test.plan.description', 'none', 'draft', '$adminId');
    INSERT INTO product_features (
        id, external_key, value_type, unit, description_translation_key, status, user_created
    ) VALUES ('$featureId', '$featureKey', 'count', 'requests', 'phase4.test.feature', 'draft', '$adminId');
    INSERT INTO usage_policies (
        id, external_key, version, plan_id, feature_id, limit_value, period_unit, status, user_created
    ) VALUES ('$usagePolicyId', '$usagePolicyKey', 1, '$planId', '$featureId', 10, 'request', 'draft', '$adminId');
    INSERT INTO usage_events (
        id, user_id, usage_policy_id, idempotency_key, occurred_at, period_start, period_end, quantity, outcome, user_created
    ) VALUES (
        '$usageEventId', '$adminId', '$usagePolicyId', '$usageKey', CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP - interval '1 minute', CURRENT_TIMESTAMP + interval '1 hour', 1, 'consumed', '$adminId'
    );
    BEGIN
        UPDATE usage_events SET quantity = 2 WHERE id = '$usageEventId';
    EXCEPTION WHEN OTHERS THEN
        IF SQLERRM NOT LIKE '%Usage event identity is immutable%' THEN RAISE; END IF;
        immutable_usage_update := true;
    END;
    BEGIN
        DELETE FROM usage_events WHERE id = '$usageEventId';
    EXCEPTION WHEN OTHERS THEN
        IF SQLERRM NOT LIKE '%Immutable event rows can only be removed by an approved retention procedure%' THEN RAISE; END IF;
        immutable_usage_delete := true;
    END;

    INSERT INTO payment_events (
        id, provider_key, provider_event_id, idempotency_key, event_type, occurred_at,
        amount_minor, currency, payload_checksum_sha256, user_created
    ) VALUES (
        '$paymentEventId', 'phase4-test-provider', '$paymentKey', '$paymentKey', 'fixture.received',
        CURRENT_TIMESTAMP, 1, 'USD', repeat('c', 64), '$adminId'
    );
    BEGIN
        UPDATE payment_events SET provider_event_id = 'phase4-test-mutated-$suffix' WHERE id = '$paymentEventId';
    EXCEPTION WHEN OTHERS THEN
        IF SQLERRM NOT LIKE '%Payment event identity is immutable%' THEN RAISE; END IF;
        immutable_payment_update := true;
    END;
    BEGIN
        DELETE FROM payment_events WHERE id = '$paymentEventId';
    EXCEPTION WHEN OTHERS THEN
        IF SQLERRM NOT LIKE '%Immutable event rows can only be removed by an approved retention procedure%' THEN RAISE; END IF;
        immutable_payment_delete := true;
    END;

    IF NOT invalid_parent OR NOT invalid_workflow OR NOT invalid_rule_mutation OR
       NOT self_approval_rule OR NOT self_approval_advisory OR
       NOT immutable_usage_update OR NOT immutable_usage_delete OR
       NOT immutable_payment_update OR NOT immutable_payment_delete THEN
        RAISE EXCEPTION 'Phase 4 governance guard did not reject all invalid operations';
    END IF;
END
`$test`$;

SELECT 'PHASE4_DATA_MODEL_DB_TEST_OK administrative_parent_guard=true workflow_guard=true risk_rule_parent_guard=true maker_checker_rule=true maker_checker_advisory=true immutable_usage=true immutable_payment=true fixtures_rolled_back=true secrets_printed=false';
ROLLBACK;
"@

Push-Location $workspaceRoot
try {
    $containerId = (docker compose --env-file $RuntimeEnvPath ps -q database).Trim()
    if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($containerId)) { throw 'Database container is not running.' }
    $result = docker compose --env-file $RuntimeEnvPath exec -T database psql -qAt -v ON_ERROR_STOP=1 `
        -U $runtime['DB_USER'] -d $runtime['DB_DATABASE'] -c $sql
    if ($LASTEXITCODE -ne 0) { throw 'Phase 4 data-model database test failed.' }
    $marker = @($result | Where-Object { $_ -like 'PHASE4_DATA_MODEL_DB_TEST_*' })
    if ($marker.Count -ne 1 -or $marker[0] -notlike 'PHASE4_DATA_MODEL_DB_TEST_OK*') { throw 'Phase 4 data-model marker is missing or invalid.' }
    Write-Output $marker[0]
}
finally { Pop-Location }
