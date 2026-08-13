# Phase 5 Evidence — Weather Provider Integration

**Status:** IN_PROGRESS
**Kickoff approval:** `PRODUCT-017`
**Decision baseline:** `DATA-008`, `ARCH-016`, `ARCH-013`

## Artifacts

| Evidence | Status | Artifact |
|---|---|---|
| Weather provider adapter | PASS_LOCAL | `apps/worker/src/weather/weatherapi.ts` |
| Response normalization | PASS_LOCAL | `apps/worker/src/weather/normalize.ts` |
| Worker durable runtime | PASS_LOCAL | `apps/worker/src/runtime/runtime.ts` |
| Weather service (API) | PASS_LOCAL | `apps/api/src/weather-service.ts` |
| Weather store | PASS_LOCAL | `apps/api/src/weather-store.ts` |
| Weather cache | PASS_LOCAL | `apps/api/src/weather-cache.ts` |
| Database schema | PASS_LOCAL | `infra/postgres/init/005-create-phase5-weather-runtime.sql` |
| Worker security | PASS_LOCAL | `infra/postgres/init/006-create-weather-worker-security.sh` |
| TypeScript contracts | PASS_LOCAL | `packages/contracts/src/weather-v1.ts` |
| OpenAPI documentation | PASS_LOCAL | `packages/contracts/src/openapi-v1.ts` |
| Approved config seed | PASS_LOCAL | `apps/directus/seeds/phase5-approved-weather-config.json` |
| Unit tests | PASS_LOCAL | `apps/worker/test/*.test.mjs`, `apps/api/test/weather-service.test.mjs` |
| Integration tests | PASS_LOCAL | `tools/database/test-phase5-weather-runtime.ps1` |

## Reproducible validation

Chạy:

```powershell
pnpm run validate:stage5
```

Expected terminal marker:

```text
STAGE5_WEATHER_INTEGRATION_OK provider_adapter=true normalization=true worker_runtime=true weather_service=true cache=true database_schema=true security=true contracts=true openapi=true seed=true retention_policy=true tests_passed=true no_raw_payload=true no_fake_weather=true secrets_printed=false
```

Các gate bên trong:

- WeatherAPI adapter rejects non-whitelisted endpoints, validates API key format, classifies provider errors correctly.
- Normalization maps 80+ WeatherAPI condition codes to canonical weather conditions, converts km/h to m/s, validates temporal ordering.
- Worker durable runtime implements circuit breaker (3 failures threshold, 60s reset), exponential backoff with jitter, lease-based heartbeat.
- Weather service returns validated provider-neutral response, marks stale data degraded, excludes coordinates/credentials from errors.
- Redis cache stores contract-valid responses only with TTL boundary.
- Database schema has 4 tables (`provider_runs`, `weather_observations`, `weather_hourly_forecasts`, `weather_daily_forecasts`), 10 indexes, 8 constraints, sanitized metadata check.
- Worker role (`app_weather_worker`) has least-privilege: SELECT/INSERT/UPDATE on weather tables, EXECUTE on worker functions only.
- TypeScript contracts validate all request/response shapes with JSON Schema.
- OpenAPI document exposes 2 paths (`/capabilities`, `/query`) with complete schemas.
- Approved config seed contains WeatherAPI.com provider and 3 retention policies (60 min, 24 hours, 30 days).
- Retention enforcement: current weather max 60 minutes, forecasts max 24 hours, sanitized metadata max 30 days.
- All tests pass (weatherapi-adapter, weather-normalization, runtime-durable, weather-service).
- No raw provider payload stored in database or logs.
- No fake weather data in business tables.

## Current local data evidence

At Phase 5 validation date:

- `weather_observations=0`
- `weather_forecasts=0`
- `weather_hourly_forecasts=0`
- `weather_daily_forecasts=0`
- `provider_runs` contains only test fixtures (cleaned up)

Current Phase 5 rows from approved seed:

- `weather_providers`: 1 row (WeatherAPI.com, active)
- `retention_policies`: 3 rows (normalized-current, normalized-forecast, sanitized-provider-run-metadata)

## Decision gate compliance

| Decision | Value | Evidence |
|---|---|---|
| `DATA-008.1` | WeatherAPI primary; fallback `none` | `phase5-approved-weather-config.json`, `weatherapi.ts:9` |
| `DATA-008.2` | MVP: current + hourly 1h + daily 1d, max 72h operational | `weather-v1.ts:86-88`, `phase-05-weather-integration.md:60` |
| `DATA-008.3` | Current fresh 15 min, forecast fresh 6h | `weather-service.ts:228, 292-293` |
| `DATA-008.4` | Stale display: 60 min / 24h; stale not for risk/route | `weather-service.ts:145-148` |
| `DATA-008.5` | No raw payload stored; retention: 60m / 24h / 30d | `005-create-phase5-weather-runtime.sql`, `normalize.ts:27-28` |
| `DATA-008.6` | UTC storage, metric SI, `Asia/Ho_Chi_Minh` timezone | `weather-v1.ts:21-29`, `weather-service.ts:399` |
| `ARCH-016.1` | Worker/API/Redis/PostgreSQL boundary | `runtime.ts`, `weather-service.ts` |
| `ARCH-016.2` | SSRF allowlist, production-operations split | `weatherapi.ts:32-59`, `006-create-weather-worker-security.sh` |

## Open evidence

- Phase 5 `VERIFIED` pending:
  - Remote CI run chưa chạy
  - Live capability probe với replacement API key
  - Product Owner closure approval

## Dependencies unblocked by Phase 5

| Phase | Dependency |
|---|---|
| 6 | Risk Engine — uses normalized weather with freshness/eligibility |
| 7 | Forecast & Trends — uses hourly/daily series with timezone metadata |
| 8 | Route Planner — uses point/time-window weather lookup |
| 9 | Frontend — uses typed DTO, errors, attribution |
| 10 | Monetization — uses capability ceiling |
| 11 | AI Chatbot — uses bounded weather tool DTO |
| 12 | Quality & Hardening — uses contract fixtures |
| 13 | Deployment & Ops — uses worker commands, metrics, retry/DLQ |

## Security verification checklist

- [x] No API key in source code
- [x] No raw coordinates in error responses
- [x] No raw provider payload in database
- [x] No provider URL/credential in logs
- [x] Sanitized metadata constraint validated
- [x] SSRF allowlist enforced
- [x] Worker least privilege verified
- [x] API weather role boundary verified
- [x] Retention enforcement verified

## Test coverage summary

| Test file | Lines | Status | Coverage |
|---|---|---|---|
| `weatherapi-adapter.test.mjs` | 269 | PASS | SSRF, error classification, response parsing |
| `weather-normalization.test.mjs` | 229 | PASS | Condition codes, unit conversion, quality |
| `runtime-durable.test.mjs` | 701 | PASS | State machine, lease, retry, circuit breaker |
| `weather-service.test.mjs` | 183 | PASS | Capabilities, query, cache, enqueue |
| `security.test.mjs` | 589 | PASS | Auth, CSRF, rate limit, session |
