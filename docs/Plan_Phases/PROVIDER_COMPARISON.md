# Provider Comparison and Feasibility Matrix

## 1. Document control

| Field | Value |
|---|---|
| Checked on | 2026-07-29 |
| Status | SHORTLIST_READY / FINAL_SELECTION_PENDING_PHASE_1 |
| Scope | Weather, weather overlays, maps, geocoding, routing, payment and Directus license |
| Rule | Pricing/terms are a dated snapshot, not a merchant contract |

No provider is hardcoded by this document. Final selection requires account-level pricing/terms, API-key tests and written merchant capability where applicable.

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
| WeatherAPI.com | Realtime, hourly/daily, alerts, search, weather maps; commercial use listed on all plans | Free: 100K calls/month, 3-day forecast. Starter: USD 7/month, 3M calls, 7 days. Pro+: USD 25/month, 5M calls, future/forecast up to 300 days. Business: USD 65/month, 10M calls, 99.9% stated uptime; SLA only Enterprise | Low entry cost, simple API, map capability, generous calls | Free plan cannot satisfy app Free entitlement of 7 days; long-range output must not be presented as high-confidence safety forecast; Vietnam accuracy/map layers need bake-off | SHORTLIST A |
| OpenWeather One Call 4.0 + Weather Maps 2.0 | Current; 1-minute next hour; 15-minute next 48h; hourly next 48h; daily timeline up to 1.5 years; national alerts; model update every 10 minutes. Maps 2.0: 15 layers, current, 10-day forecast at 3-hour steps and historical maps | One Call 4.0 includes 1,000 calls/day free, pay per call above limit. Weather Maps subscription/call pricing must be confirmed on account/pricing page | Strong timeline, alerts, dedicated current/future overlay API, explicit timestamps | One Call and map products may be separate cost surfaces; daily long-range horizon is not equivalent to reliable travel-safety forecast; SLA/redistribution terms require plan review | SHORTLIST B |
| Tomorrow.io | Realtime, 60+ layers, timelines, maps, monitoring and Weather on Routes | Free product page lists 5-day forecast. Enterprise lists 14-day forecast, custom SLA, Weather on Routes and advanced map/data layers; price by contact | Rich risk-relevant data and route-specific product | Core Free entitlement needs 7 days; route/maps required for this product appear Enterprise; cost and contract less transparent | RESERVE/ENTERPRISE |

### Weather recommendation for Phase 1 bake-off

Test two candidates, without committing in code:

1. `WeatherAPI.com Pro+` for low-cost normalized point forecasts and included weather maps.
2. `OpenWeather One Call 4.0 + Weather Maps 2.0` for current/forecast timelines and advanced overlays.

Tomorrow.io remains an enterprise fallback if its Weather on Routes capability materially reduces implementation/risk and fits the budget.

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
| Mapbox | Pricing page shows free tiers around 50K web map loads/month, 100K Directions requests/month, 100K temporary geocoding requests/month and 100K Map Matching requests/month | `alternatives=true` may return up to two alternatives in addition to the main route; alternatives are significantly different but close in time to fastest and may not always exist | One integrated web map/search/directions stack; fits requested maximum of three displayed routes; transparent usage meters | “Shortest” is only the lowest-distance route among returned alternatives, not a guaranteed globally shortest path; storage differs between temporary/permanent geocoding; Vietnam result quality needs testing | RECOMMENDED BAKE-OFF DEFAULT |
| Google Maps Platform | 2026 pricing page lists Starter USD 100/month for 50K calls focused on Dynamic Maps + Geocoding; Essentials USD 275/month for 100K calls across popular Maps/Routes/Places/Environment products | Supports alternative routes depending on API/mode, but product must still rank only returned candidates | Strong Places ecosystem, coverage and documentation; integrated Maps/Routes/Weather options | Higher predictable cost, SKU/billing complexity and provider lock-in; storage/attribution restrictions require careful design | ALTERNATIVE |
| HERE | Maps, geocoding/search, routing, traffic, map rendering and documented coverage/SLA surfaces | Routing product supports advanced transport/traffic use cases; exact alternatives/objectives must be confirmed in current account/API reference | Strong automotive/routing focus and possible advanced route constraints | Public pricing page is not sufficiently detailed in captured content; contract/usage costs and Vietnam result quality require account test | ALTERNATIVE |
| Public OpenStreetMap services | OSM data is reusable under ODbL with attribution, but public Nominatim and `tile.openstreetmap.org` have strict usage policies | Public services do not provide the production routing contract required by this product | Open data; self-hosting/commercial derived providers remain possible | Public Nominatim max 1 request/second, forbids client autocomplete and warns commercial apps about withdrawal; public tiles are best-effort with no SLA and prohibit bulk/offline prefetch | NOT APPROVED AS SOLE PRODUCTION INFRASTRUCTURE |

### Map/routing recommendation for Phase 1 bake-off

Start the provider adapter spike with Mapbox because its free tiers, three-route maximum and web map stack match the MVP. Keep DTOs provider-neutral and compare at least one of Google/HERE before final approval.

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

The official Directus license page checked on 2026-07-29 identifies the current license as **Monospace Sustainable Core License 1.0 (`MSCL-1.0-GPL`)**. It permits use for purposes other than a competing use and grants GPL-3.0 after the stated four-year conversion period for a release.

This product uses Directus as an internal backend/admin component and does not sell Directus itself as a competing standalone service. Self-hosting is therefore a viable technical candidate, but Phase 1 must:

- Pin the exact Directus image/version and retain its included license text.
- Recheck license terms for that exact version/release before production.
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

## 8. Phase 1 decision gate generated by this comparison

Phase 1 must ask Product Owner to approve:

1. Weather bake-off winner and paid plan.
2. Map/geocoding/routing bake-off winner.
3. Approved operational forecast horizon for risk/route versus long-range outlook.
4. Stripe merchant eligibility status.
5. VNPay recurring capability: auto-renew or manual renewal.
6. Monthly provider call budgets and hard cost alerts.
