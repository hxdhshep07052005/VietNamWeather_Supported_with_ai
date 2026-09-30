# Weather, Map and Route verification - 2026-09-30

Latest city-data and Route follow-up: [City weather data audit](CITY_WEATHER_DATA_AUDIT_2026-09-30.md), including 63-city field consistency, rain provenance, corrected provider conditions and final route ETA checks. Earlier snapshots below remain historical evidence.

## Scope

User selected general weather risk for Map/Weather. Vehicle-specific Route assessment remains separate. Missing evidence is retained as unknown, never replaced with safe measurements.

## Fixed causes

- WeatherAPI daily date_epoch was treated as a UTC day and dropped local 00:00-06:00 hours. Normalization now derives local midnight from provider local date/hour epochs. Regression reproduces 51 instead of 72 hourly records before the fix.
- Province weather coordinates are shared between scheduler and UI. Polygon centroids are separate from sampling points.
- Forecast responses merged multiple ingestion runs and could exceed the three-day schema maximum, discarding an otherwise valid bundle. The API selects a coherent latest run and the bounded forecast window. Old snapshots are retained in storage.
- Measurement persistence/query columns were absent in the running database. Applied additive migration 013 and least-privilege column access migration 014. Missing grants previously produced weather_query_failed for every point.
- General weather assessment no longer requires a vehicle or official-alert integration. It requires the core measured wind, temperature and visibility fields, reports missing dimensions, uses the existing conservative numeric thresholds, and treats detected but unclassified thunder as at least caution. Route retains stricter complete-evidence eligibility.
- Persistence mapping version 2 prevents refreshed fields from colliding with older snapshots. Conflict messages now satisfy the existing SQL sanitizer so failed runs can transition out of running.
- Daily average humidity is preserved through normalization, persistence and API output, including a real zero and a genuinely absent value.
- Observation ingestion now runs every ten minutes rather than thirty, within the fifteen-minute freshness window.
- Map/Weather detail metrics and hourly windows use the selected report timestamp. Supported weather condition labels are complete. Vehicle selectors are removed from these pages.
- Route renders backend geometry, all samples, and segment risks. Colors follow risk, not the alternative type. Null/zero weather values and actual ETA are retained. GPS coordinates survive swaps; form edits no longer auto-submit or accept stale results.
- A concurrent bulk province endpoint was retained and integrated with selected target timestamps and general risk labels.

## Live evidence

- Nationwide endpoint: 63 provinces returned at current, +1h, +24h and +48h with zero query failures. Snapshot current levels: 55 low, 3 caution, 5 high. Counts change with weather.
- +72h: all 63 unknown because the provider's three calendar days do not extend to a full 72 hours from now. This is a real coverage limit.
- Hanoi, Lao Cai, Dien Bien and Ho Chi Minh City: +24h report and hourly weather match temperature, humidity, visibility, precipitation probability and wind-unit conversion. Daily dates are unique and begin at 17:00 UTC on the previous day, i.e. midnight Vietnam.
- Hanoi-Hai Phong real route HTTP 200: fastest geometry 796 coordinates, 26 samples, 25 segments; shortest 1185 coordinates, 22 samples, 21 segments. Fifteen samples per alternative have weather coverage. Overall route risk is correctly unknown due missing spatial coverage and official storm/alert evidence.
- Evidence: artifacts/weather-live-provinces.json, artifacts/weather-field-consistency.json, artifacts/weather-live-route.json.

- Final recovery: all four replacement jobs succeeded. Hanoi weather/query returns HTTP 200, status success, no degraded issues; daily humidity 74/77/82 and quality complete for all three dates. Captured in artifacts/weather-live-final-bundle.json.

## Automated checks

- Full workspace build passes. API 191/191, worker 47/47, web 41/41, config 3/3 tests pass with the final worker persistence-key regression checks. Shared province contract tests 5/5 pass.
- Final build/test logs: artifacts/weather-build.log and artifacts/weather-tests.log.

## Verification limits

- Browser access to localhost was denied earlier; no direct browser visual QA is claimed. Component interaction tests and API/DB probes were used.
- Standalone contracts weather-v1.test.mjs cannot load because WEATHER_ERROR_CATALOG is not exported. This pre-existing test-runner/export mismatch is separate from the five passing shared-province registry checks.
- Build warnings about large frontend bundles and existing ESLint configuration incompatibility are outside these fixes.
