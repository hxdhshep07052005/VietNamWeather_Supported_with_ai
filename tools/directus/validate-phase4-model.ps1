param(
    [string]$RuntimeEnvPath = '.env.local',
    [string]$PermissionManifestPath = 'apps/directus/security/phase4-business-permissions.json',
    [string]$RoleManifestPath = 'apps/directus/security/phase3-default-deny.json',
    [string]$SeedManifestPath = 'apps/directus/seeds/phase4-approved-config.json',
    [string]$MigrationPath = 'infra/postgres/init/004-create-phase4-data-model.sql'
)

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

function Resolve-WorkspaceFile {
    param([string]$RelativePath)
    $fullPath = [IO.Path]::GetFullPath((Join-Path $workspaceRoot $RelativePath))
    $workspacePrefix = $workspaceRoot.TrimEnd('\') + '\'
    if (-not $fullPath.StartsWith($workspacePrefix, [StringComparison]::OrdinalIgnoreCase)) { throw 'Path must remain inside the workspace.' }
    if (-not (Test-Path -LiteralPath $fullPath -PathType Leaf)) { throw "Missing file: $RelativePath" }
    return $fullPath
}

function Convert-ToSqlList {
    param([string[]]$Values)
    return (@($Values | ForEach-Object { "'$($_.Replace("'", "''"))'" }) -join ',')
}

$runtime = Read-EnvironmentFile (Resolve-WorkspaceFile $RuntimeEnvPath)
$permissionFile = Resolve-WorkspaceFile $PermissionManifestPath
$roleFile = Resolve-WorkspaceFile $RoleManifestPath
$seedFile = Resolve-WorkspaceFile $SeedManifestPath
$migrationFile = Resolve-WorkspaceFile $MigrationPath
$permissionManifest = Get-Content -LiteralPath $permissionFile -Raw | ConvertFrom-Json
$roleManifest = Get-Content -LiteralPath $roleFile -Raw | ConvertFrom-Json
$seedManifest = Get-Content -LiteralPath $seedFile -Raw | ConvertFrom-Json
$migration = Get-Content -LiteralPath $migrationFile -Raw

$managedCollections = @($permissionManifest.managedCollections | ForEach-Object { [string]$_ })
if ($managedCollections.Count -ne 40 -or @($managedCollections | Sort-Object -Unique).Count -ne 40) {
    throw 'Phase 4 must define exactly 40 unique business collections.'
}
$permissions = @($permissionManifest.permissions)
if ($permissions.Count -lt 1) { throw 'Phase 4 permission manifest is empty.' }
$permissionIdentities = @($permissions | ForEach-Object { "$([string]$_.roleKey)|$([string]$_.collection)|$([string]$_.action)" })
if (@($permissionIdentities | Sort-Object -Unique).Count -ne $permissions.Count) { throw 'Phase 4 permission identities are not unique.' }
if (@($permissions | Where-Object roleKey -eq 'ai_tool_service').Count -ne 0) { throw 'AI tool service must remain disabled in Phase 4.' }

$approvedSeedCollections = @('supported_locales', 'product_plans', 'product_features', 'plan_entitlements', 'usage_policies')
$actualSeedCollections = @($seedManifest.allowedCollections | ForEach-Object { [string]$_ } | Sort-Object)
if (($actualSeedCollections -join '|') -ne (($approvedSeedCollections | Sort-Object) -join '|')) {
    throw 'Phase 4 seed scope exceeds the approved configuration collections.'
}
$forbiddenSeedCollections = @(
    'reference_sources', 'administrative_versions', 'administrative_units', 'locations',
    'location_aliases', 'location_provider_mappings', 'weather_providers', 'provider_runs',
    'weather_observations', 'weather_forecasts', 'risk_assessments', 'payment_events',
    'billing_customers', 'subscriptions', 'user_favorites', 'saved_routes', 'search_history'
)
if (@($seedManifest.operations | Where-Object { [string]$_.collection -in $forbiddenSeedCollections }).Count -ne 0) {
    throw 'Phase 4 seed manifest contains unapproved business or user data.'
}
if ($migration -match '(?im)^\s*INSERT\s+INTO\s+(administrative_units|locations|weather_providers|provider_runs|weather_observations|weather_forecasts|payment_events|billing_customers|subscriptions)\b') {
    throw 'Phase 4 migration contains hardcoded business records.'
}

$indexNames = @([regex]::Matches($migration, '(?im)^CREATE\s+(?:UNIQUE\s+)?INDEX\s+IF\s+NOT\s+EXISTS\s+([a-z0-9_]+)') | ForEach-Object { $_.Groups[1].Value } | Sort-Object -Unique)
$constraintNames = @([regex]::Matches($migration, '(?im)\bCONSTRAINT\s+([a-z0-9_]+)\s+') | ForEach-Object { $_.Groups[1].Value } | Sort-Object -Unique)
$workflowTables = @(
    'locations', 'content_pages', 'translations', 'app_settings', 'feature_flags',
    'retention_policies', 'product_plans', 'plan_prices', 'plan_entitlements', 'usage_policies',
    'risk_rule_sets', 'risk_advisories'
)
$triggerNames = @(
    'administrative_units_parent_guard', 'risk_rules_parent_status_guard',
    'usage_events_immutable_guard', 'payment_events_immutable_guard'
) + @($workflowTables | ForEach-Object { "${_}_workflow_guard" })

$rolePolicyIds = @($roleManifest.roles | ForEach-Object { [string]$_.policy.id })
$aiRoles = @($roleManifest.roles | Where-Object { [string]$_.key -eq 'ai_tool_service' })
if ($aiRoles.Count -ne 1) { throw 'AI service role is missing from the role manifest.' }
$apiDbUser = [string]$runtime['API_DB_USER']
if ($apiDbUser -notmatch '^[A-Za-z0-9_]+$') { throw 'API_DB_USER has an invalid format.' }
$seedChecksum = (Get-FileHash -Algorithm SHA256 -LiteralPath $seedFile).Hash.ToLowerInvariant()
$appEnvironment = [string]$runtime['APP_ENV']
if ($appEnvironment -notmatch '^[a-z][a-z0-9_-]{1,31}$') { throw 'APP_ENV has an invalid format.' }

$tableSql = Convert-ToSqlList $managedCollections
$indexSql = Convert-ToSqlList $indexNames
$constraintSql = Convert-ToSqlList $constraintNames
$triggerSql = Convert-ToSqlList $triggerNames
$policySql = Convert-ToSqlList $rolePolicyIds
$aiPolicySql = Convert-ToSqlList @([string]$aiRoles[0].policy.id)
$seedKey = ([string]$seedManifest.key).Replace("'", "''")
$seedVersion = ([string]$seedManifest.version).Replace("'", "''")
$seedEnvironment = $appEnvironment.Replace("'", "''")

$sql = @"
DO `$validate`$
DECLARE
    actual_count bigint;
BEGIN
    SELECT count(*) INTO actual_count
      FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name IN ($tableSql);
    IF actual_count <> 40 THEN RAISE EXCEPTION 'Expected 40 business tables, found %', actual_count; END IF;

    SELECT count(*) INTO actual_count FROM directus_collections WHERE collection IN ($tableSql);
    IF actual_count <> 40 THEN RAISE EXCEPTION 'Expected 40 Directus collections, found %', actual_count; END IF;

    SELECT count(*) INTO actual_count FROM pg_indexes WHERE schemaname = 'public' AND indexname IN ($indexSql);
    IF actual_count <> $($indexNames.Count) THEN RAISE EXCEPTION 'Missing Phase 4 indexes: expected %, found %', $($indexNames.Count), actual_count; END IF;

    SELECT count(*) INTO actual_count FROM pg_constraint WHERE conname IN ($constraintSql);
    IF actual_count <> $($constraintNames.Count) THEN RAISE EXCEPTION 'Missing Phase 4 constraints: expected %, found %', $($constraintNames.Count), actual_count; END IF;

    SELECT count(*) INTO actual_count FROM pg_trigger WHERE NOT tgisinternal AND tgname IN ($triggerSql);
    IF actual_count <> $($triggerNames.Count) THEN RAISE EXCEPTION 'Missing Phase 4 governance triggers: expected %, found %', $($triggerNames.Count), actual_count; END IF;

    SELECT count(*) INTO actual_count
      FROM directus_permissions
     WHERE policy IN ($policySql) AND collection IN ($tableSql);
    IF actual_count <> $($permissions.Count) THEN RAISE EXCEPTION 'Permission count mismatch: expected %, found %', $($permissions.Count), actual_count; END IF;

    SELECT count(*) INTO actual_count
      FROM directus_permissions
     WHERE policy IN ($aiPolicySql) AND collection IN ($tableSql);
    IF actual_count <> 0 THEN RAISE EXCEPTION 'AI service received Phase 4 business permissions'; END IF;

    SELECT count(*) INTO actual_count FROM directus_dashboards WHERE id = '3fb99f1e-3848-41f3-a57d-28a55b7a2e26';
    IF actual_count <> 1 THEN RAISE EXCEPTION 'Phase 4 dashboard is missing'; END IF;
    SELECT count(*) INTO actual_count FROM directus_panels WHERE dashboard = '3fb99f1e-3848-41f3-a57d-28a55b7a2e26';
    IF actual_count <> 4 THEN RAISE EXCEPTION 'Expected four Phase 4 dashboard panels, found %', actual_count; END IF;
    SELECT count(*) INTO actual_count FROM directus_presets WHERE bookmark LIKE 'Phase 4 - %';
    IF actual_count <> 7 THEN RAISE EXCEPTION 'Expected seven Phase 4 role presets, found %', actual_count; END IF;

    SELECT count(*) INTO actual_count
      FROM unnest(ARRAY[$tableSql]) AS managed(table_name)
     WHERE has_table_privilege('$apiDbUser', format('public.%I', table_name), 'SELECT')
        OR has_table_privilege('$apiDbUser', format('public.%I', table_name), 'INSERT')
        OR has_table_privilege('$apiDbUser', format('public.%I', table_name), 'UPDATE')
        OR has_table_privilege('$apiDbUser', format('public.%I', table_name), 'DELETE');
    IF actual_count <> 0 THEN RAISE EXCEPTION 'Application API database role has direct business-table privileges'; END IF;

    SELECT count(*) INTO actual_count
      FROM app_seed_runs
     WHERE manifest_key = '$seedKey'
       AND manifest_version = '$seedVersion'
       AND environment = '$seedEnvironment'
       AND manifest_checksum = '$seedChecksum';
    IF actual_count <> 1 THEN RAISE EXCEPTION 'Approved Phase 4 seed audit record is missing or has checksum drift'; END IF;

    SELECT
        (SELECT count(*) FROM locations WHERE external_key LIKE 'phase4-test-%') +
        (SELECT count(*) FROM reference_sources WHERE external_key LIKE 'phase4-test-%') +
        (SELECT count(*) FROM administrative_versions WHERE external_key LIKE 'phase4-test-%') +
        (SELECT count(*) FROM administrative_units WHERE external_key LIKE 'phase4-test-%') +
        (SELECT count(*) FROM risk_rule_sets WHERE external_key LIKE 'phase4-test-%') +
        (SELECT count(*) FROM risk_advisories WHERE external_key LIKE 'phase4-test-%') +
        (SELECT count(*) FROM product_plans WHERE external_key LIKE 'phase4-test-%') +
        (SELECT count(*) FROM product_features WHERE external_key LIKE 'phase4-test-%') +
        (SELECT count(*) FROM usage_policies WHERE external_key LIKE 'phase4-test-%') +
        (SELECT count(*) FROM usage_events WHERE idempotency_key LIKE 'phase4-test-%') +
        (SELECT count(*) FROM payment_events WHERE idempotency_key LIKE 'phase4-test-%') +
        (SELECT count(*) FROM directus_users WHERE email LIKE 'phase4-%@example.com')
      INTO actual_count;
    IF actual_count <> 0 THEN RAISE EXCEPTION 'Ephemeral Phase 4 fixtures remain in the database'; END IF;
END
`$validate`$;

SELECT concat_ws('|',
    (SELECT count(*) FROM administrative_units),
    (SELECT count(*) FROM locations),
    (SELECT count(*) FROM weather_observations),
    (SELECT count(*) FROM weather_forecasts),
    (SELECT count(*) FROM payment_events)
);
"@

Push-Location $workspaceRoot
try {
    $result = @(docker compose --env-file $RuntimeEnvPath exec -T database psql -qAt -v ON_ERROR_STOP=1 `
        -U $runtime['DB_USER'] -d $runtime['DB_DATABASE'] -c $sql)
    if ($LASTEXITCODE -ne 0) { throw 'Phase 4 schema and metadata validation failed.' }
    $counts = [string]$result[-1]
    if ($counts -notmatch '^\d+\|\d+\|\d+\|\d+\|\d+$') { throw 'Phase 4 business-row count marker is invalid.' }
    $parts = $counts.Split('|')
    Write-Output "PHASE4_MODEL_VALIDATION_OK collections=40 permissions=$($permissions.Count) indexes=$($indexNames.Count) constraints=$($constraintNames.Count) triggers=$($triggerNames.Count) dashboard_panels=4 presets=7 api_db_business_privileges=0 fixture_rows=0 administrative_units=$($parts[0]) locations=$($parts[1]) observations=$($parts[2]) forecasts=$($parts[3]) payment_events=$($parts[4]) secrets_printed=false"
}
finally { Pop-Location }
