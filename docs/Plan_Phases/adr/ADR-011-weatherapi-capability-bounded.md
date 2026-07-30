# ADR-011 — WeatherAPI Capability-Bounded Baseline

**Status:** Accepted  
**Date:** 2026-07-31  
**Decision:** `ARCH-013`

## Bối cảnh

The current WeatherAPI account returns current data and exactly 3 forecast days even when 7 days are requested. The current OpenWeather key returns Current Weather 2.5 but One Call 4.0 returns HTTP 401 because that product requires a separate subscription. The project must avoid purchasing or pretending to have unavailable capability merely to close architecture planning.

## Quyết định

Use WeatherAPI as the initial primary point-weather adapter. Expose only capability and forecast coverage actually returned by the provider/account. `DATA-004` remains a maximum operational horizon, not a promise that every account response covers 72 rolling hours. Day 4–7 outlook stays capability-disabled until account-level evidence proves it is available.

OpenWeather Current 2.5 is not a production fallback because mixing current data with a different forecast model would create provenance and consistency risks. OpenWeather One Call may be reconsidered through a new decision after subscription, terms and live Vietnam evidence exist.

## Phương án đã xem xét

- **WeatherAPI current account:** selected because live 30-location evidence passed for current plus 3-day forecast and no new paid dependency is required.
- **WeatherAPI paid upgrade:** deferred; may enable 7-day outlook only after account evidence and cost approval.
- **OpenWeather One Call 4.0:** deferred because the current key lacks the required subscription.
- **OpenWeather Current 2.5 fallback:** rejected as a silent fallback because it cannot replace the selected forecast contract.
- **Fabricated or extrapolated day 4–7 data:** prohibited.

## Trade-off và hệ quả

- Development remains simple and low-cost.
- The MVP cannot advertise guaranteed 7-day forecasts under the current account capability.
- Operational risk/route evaluation uses the intersection of configured maximum horizon and provider-valid coverage.
- Provider-neutral DTOs and provenance fields preserve a later migration path.

## Security impact

WeatherAPI credentials remain server-side and are read only from environment/secret injection. Provider payloads are untrusted input and must pass schema, timestamp, range and freshness validation before persistence or scoring.

## Chi phí và vận hành

No paid weather upgrade is approved by this ADR. Request ledger, cache metrics and provider-account usage are monitored. A paid plan, secondary provider or higher horizon requires a new cost/architecture decision and regression evidence.

## Migration và rollback

The application API exposes normalized capability/provenance DTOs rather than WeatherAPI payloads. A new adapter can dual-run against stored fixture coordinates before cutover. Rollback disables the failing adapter or serves valid cached data within policy; it never invents current or forecast values.

## Evidence cần có

`WEATHER_BAKEOFF_REPORT.md` and `VIETNAM_PROVIDER_FIXTURE_REPORT.md` record the live account behavior, 30-location results, latency and 3-day limit. Phase 5 must add contract tests, freshness validation, persistence policy and provider-error degraded behavior.
