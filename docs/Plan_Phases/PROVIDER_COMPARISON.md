# Provider Comparison and Feasibility Matrix

## 1. Document control

| Field | Value |
|---|---|
| Checked on | 2026-07-29 |
| Status | FINAL BASELINES APPROVED (`PRODUCT-012`) |
| Scope | Weather, weather overlays, maps, geocoding, routing, payment and Directus license |
| Rule | Pricing/terms are a dated snapshot, not a merchant contract |

The selected architecture baselines remain provider-neutral in product code: adapter identity, capability, horizon, quota and availability are configuration/backend outputs rather than frontend hardcodes. Merchant methods still require provider-specific evidence before enablement.

## 2. Evaluation criteria

- Coverage and result quality across Vietnam.
- Current/forecast fields, update frequency, horizon, alerts and weather map layers.
- Route alternatives, road modes, geometry, segment metadata and rerouting support.
- Geocoding relevance for Vietnamese/English place names and diacritics.
- Commercial use, attribution, caching/storage restrictions, SLA and support.
- Transparent pricing, quota controls and fit within `OPS-002`.
- Backend-only credentials, auditability and adapter portability.

## 3. Weather provider shortlist

| Provider | Verified capabilities | Pricing snapshot | Strengths | Risks/constraints | Status |
|---|---|---|---|---|---|
| WeatherAPI.com | Realtime, hourly/daily, alerts, search, weather maps; live 30-location suite returned current + exactly 3 days at all locations | Free: 100K calls/month, 3-day forecast. Starter: USD 7/month, 3M calls, 7 days. Pro+: USD 25/month, 5M calls, future/forecast up to 300 days. Business: USD 65/month, 10M calls, 99.9% stated uptime; SLA only Enterprise | Low entry cost, simple API, live account works without a new paid dependency | Current account cannot expose day 4–7; provider labels/timezones are not authoritative; meteorological accuracy needs ongoing comparison | SELECTED — `ARCH-013` |
| OpenWeather One Call 4.0 + Weather Maps 2.0 | Current; 1-minute next hour; 15-minute next 48h; hourly next 48h; daily timeline up to 1.5 years; national alerts; model update every 10 minutes. Maps 2.0: 15 layers, current, 10-day forecast at 3-hour steps and historical maps | One Call 4.0 includes 1,000 calls/day free, pay per call above limit. Weather Maps subscription/call pricing must be confirmed on account/pricing page | Strong timeline, alerts, dedicated current/future overlay API, explicit timestamps | One Call and map products may be separate cost surfaces; daily long-range horizon is not equivalent to reliable travel-safety forecast; SLA/redistribution terms require plan review | SHORTLIST B |
| Tomorrow.io | Realtime, 60+ layers, timelines, maps, monitoring and Weather on Routes | Free product page lists 5-day forecast. Enterprise lists 14-day forecast, custom SLA, Weather on Routes and advanced map/data layers; price by contact | Rich risk-relevant data and route-specific product | Core Free entitlement needs 7 days; route/maps required for this product appear Enterprise; cost and contract less transparent | RESERVE/ENTERPRISE |

### Weather decision

Use WeatherAPI as the initial capability-bounded point-weather adapter under `ARCH-013`. Do not expose day 4–7 under the current account, do not silently mix OpenWeather Current 2.5 into WeatherAPI forecast provenance, and require a new decision before any paid upgrade or secondary provider. OpenWeather One Call and Tomorrow.io remain deferred candidates.

### Weather bake-off dataset

- At least 30 locations across North/Central/South, urban/coastal/mountain/island contexts.
- Vietnamese and English names, accented and unaccented queries.
- Verify current fields, hourly/daily completeness, alert availability, update timestamps, timezone and missing-data behavior.
- Compare precipitation, wind/gust, visibility, temperature, UV, cloud and severe-weather fields needed by risk rules.
- Test current/future overlay tile alignment and animation timestamps.
- Record p50/p95 latency, response size, call count and projected monthly cost.

Provider accuracy cannot be approved only from marketing claims. Phase 1 needs a reproducible golden-set report and, where possible, comparison with official Vietnamese observations/advisories.

## 4. Map, geocoding and routing shortlist

| Provider | Verified capabilities/pricing | Route-alternative behavior | Strengths | Risks/constraints | Status |
|---|---|---|---|---|---|
| Geoapify Free + MapLibre | Official pricing checked 2026-07-30: 3,000 credits/day, no card required, multiple API keys, up to 5 requests/second, limited commercial use with attribution; initial live style/geocoding/routing passed 2026-07-31 | Exact alternatives/modes still require full fixture validation | One provider, open-source renderer, no automatic card charge and lower MVP complexity | Best-effort/free quota may be insufficient; credit cost varies by endpoint; Vietnam-wide route quality remains unproven | SELECTED — `ARCH-012` |
| Mapbox | Product Owner's account flow requires card billing | Supports route alternatives depending on profile/request | Integrated stack | Card/billing setup conflicts with current no-card requirement | REJECTED FOR MVP |
| Google Maps Platform | Strong maps/routes/geocoding product family | Supports alternative routes depending on API/mode | Broad ecosystem and documentation | Adds billing/account/SDK complexity | DEFERRED |
| HERE | Maps, geocoding/search and routing products | Requires account/API validation | Strong routing focus | Adds another account/provider/test matrix | DEFERRED |
| Public OpenStreetMap services | OSM data is reusable under ODbL with attribution, but public Nominatim and `tile.openstreetmap.org` have strict usage policies | Public services do not provide the production routing contract required by this product | Open data; self-hosting/commercial derived providers remain possible | Public Nominatim max 1 request/second, forbids client autocomplete and warns commercial apps about withdrawal; public tiles are best-effort with no SLA and prohibit bulk/offline prefetch | NOT APPROVED AS SOLE PRODUCTION INFRASTRUCTURE |

### Map/routing recommendation for Phase 1 bake-off

Use MapLibre + Geoapify Free for MVP under `ARCH-012`. Keep DTOs provider-neutral, use separate browser/server keys and require live Vietnam route/credit validation. Do not add another provider unless Geoapify fails the acceptance gate or a new Decision ID approves the complexity.

### Route/geocoding bake-off dataset

- At least 30 origin/destination pairs: inner-city, inter-city, mountain passes, coastal roads and locations with no valid driving route.
- Search queries in `vi`/`en`, with accents, missing accents, administrative names and tourist POIs.
- Verify route geometry, distance, duration, alternatives, transport mode, no-route behavior and attribution.
- Confirm provider can return enough geometry/metadata for sampling and ETA weather analysis.
- Measure route and geocoding cost under Free/Pro quotas plus cache assumptions.
- “Shortest”, “Fastest” and “Weather-safer” remain rankings inside provider alternatives, never guarantees.

## 5. Payment feasibility

| Provider | Official evidence checked | Feasibility conclusion | Required action |
|---|---|---|---|
| Stripe | Global availability page lists supported account-registration countries; Vietnam was not present on 2026-07-29. Stripe Billing supports subscriptions for eligible accounts | International subscription capability is technically suitable, but a Vietnam-only merchant entity must not be assumed eligible | Before Phase 10, provide an eligible legal entity/account or keep Stripe feature-disabled. Do not use another person’s account or misrepresent business location |
| VNPay PAY | Public sandbox docs show redirect payment URL, Return URL, server-to-server IPN, query/refund API, HMAC/checksum, VND and `vi`/`en`; bank codes include QR, domestic bank and international card | Suitable candidate for Vietnam checkout and prepaid monthly/yearly Pro periods | Obtain production merchant contract, fees, domain approval, IPN/refund rules and test credentials |
| VNPay Token | Public docs show token creation, saved-card payment and token deletion; payment flow describes bank OTP/authentication | Token support exists, but unattended/off-session auto-renew without user action is not proven by public docs | Obtain written confirmation. If unavailable, VNPay uses manual renewal/prepaid periods and must not imitate recurring billing |

Payment adapters must support provider-specific capability without changing entitlement rules. Checkout only shows methods returned as available by backend.

## 6. Directus self-hosting feasibility

The official Directus sources were rechecked on 2026-07-30 for exact release `12.1.1`. npm and GitHub identify `12.1.1` as the current stable release; Docker Hub manifest digest is `sha256:27fd291463f4e746a7911139377a1dbc7a5c09ae82ee15b028b97bcc4950c69d`. The included license file is **Monospace Sustainable Core License 1.0 (`MSCL-1.0-GPL`)**. It permits use for purposes other than a competing use and grants GPL-3.0 after the stated four-year conversion period for a release.

This product uses Directus as an internal backend/admin component and does not sell Directus itself as a competing standalone service. Self-hosting is therefore a viable technical baseline. `ARCH-011` and [DIRECTUS_BASELINE.md](DIRECTUS_BASELINE.md) record the exact pin. The project must:

- Keep the exact Directus image/version and included license evidence.
- Recheck license terms, security advisories and supported patch before production.
- Avoid removing/circumventing licensed functionality.
- Obtain legal clarification if the business model changes toward providing Directus as a service.

## 7. Official sources

### Weather

- WeatherAPI pricing: https://www.weatherapi.com/pricing.aspx
- OpenWeather One Call 4.0: https://openweathermap.org/api/one-call-4
- OpenWeather Weather Maps 2.0: https://openweathermap.org/api/weather-map-2
- OpenWeather pricing: https://openweathermap.org/price
- Tomorrow.io Weather API: https://www.tomorrow.io/weather-api/pricing/
- Tomorrow.io docs: https://docs.tomorrow.io/reference/welcome

### Map, geocoding and routing

- Geoapify pricing: https://www.geoapify.com/pricing/
- Geoapify map tiles: https://apidocs.geoapify.com/docs/maps/map-tiles/
- Geoapify geocoding: https://apidocs.geoapify.com/docs/geocoding/forward-geocoding/
- Geoapify routing: https://apidocs.geoapify.com/docs/routing/
- Mapbox pricing: https://www.mapbox.com/pricing
- Mapbox Directions alternatives: https://docs.mapbox.com/api/navigation/directions/
- Google Maps Platform pricing: https://mapsplatform.google.com/pricing/
- HERE pricing: https://www.here.com/get-started/pricing
- HERE docs: https://www.here.com/docs/routing/docs
- Nominatim policy: https://operations.osmfoundation.org/policies/nominatim/
- OSM tile policy: https://operations.osmfoundation.org/policies/tiles/

### Payment and backend

- Stripe global availability: https://stripe.com/global
- Stripe Billing: https://docs.stripe.com/billing
- VNPay PAY: https://sandbox.vnpayment.vn/apis/docs/thanh-toan-pay/pay.html
- VNPay token payments: https://sandbox.vnpayment.vn/apis/docs/thanh-toan-token/token.html
- VNPay query/refund: https://sandbox.vnpayment.vn/apis/docs/truy-van-hoan-tien/querydr&refund.html
- Directus license: https://directus.io/bsl
- Directus self-hosting: https://directus.com/docs/self-hosting/overview
- Directus `v12.1.1` release: https://github.com/directus/directus/releases/tag/v12.1.1
- Directus `v12.1.1` license file: https://github.com/directus/directus/blob/v12.1.1/license

## 8. Phase 1 decision gate generated by this comparison

Phase 1 approvals are recorded in `ARCH-010`, `ARCH-012`, `ARCH-013`, `OPS-006` and `PRODUCT-012`:

1. WeatherAPI is selected with no paid upgrade and capability-bounded horizon.
2. Stripe remains disabled without an eligible merchant entity.
3. VNPay remains disabled until onboarding, then manual/prepaid renewal unless recurring is proven.
4. Current automatic provider spend is 0 VND; request ledger and fail-closed limits are mandatory.

Operational forecast horizon đã được phê duyệt tại `DATA-004`: tối đa 72 giờ cho route/risk; ngày 4–7 chỉ là outlook.

Map/geocoding/routing stack đã được phê duyệt tại `ARCH-012`: MapLibre + Geoapify Free. Full live fixture and route-objective evidence is recorded; production browser/quota/account controls remain assigned to implementation and operations phases.
