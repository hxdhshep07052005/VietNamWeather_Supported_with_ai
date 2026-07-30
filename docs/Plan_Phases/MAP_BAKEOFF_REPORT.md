# Map, Geocoding and Routing Provider Report

## 1. Status

| Field | Value |
|---|---|
| Verification date | 2026-07-31 |
| State | LIVE FIXTURE VERIFIED / PRODUCTION CONTROLS DEFERRED |
| Selected stack | MapLibre GL JS + Geoapify Free |
| Decision | `ARCH-012`, `ADR-010` |
| Live provider requests sent | 152 |
| Selection basis | Product simplicity, no-card requirement and verified public terms; not a fabricated performance score |

Geoapify đã được Product Owner chọn làm MVP provider. Quyết định này bỏ comparative Mapbox/Google/HERE bake-off để giảm account, billing và SDK complexity. Vietnam live fixtures và route-objective capability đã được xác minh; browser enforcement, quota-degraded behavior và account reconciliation thuộc implementation/operations phases.

## 2. Verified public evidence

Geoapify official pricing/docs được kiểm tra ngày 2026-07-30:

| Evidence | Verified result |
|---|---|
| Free allowance | 3,000 credits/day |
| Billing setup | No credit card required |
| API keys | Multiple API keys |
| Rate limit | Up to 5 requests/second |
| Commercial use | Limited commercial use allowed with required attribution |
| Product coverage | Map tiles/style, geocoding and routing documentation available |

Official references:

- https://www.geoapify.com/pricing/
- https://apidocs.geoapify.com/docs/maps/map-tiles/
- https://apidocs.geoapify.com/docs/geocoding/forward-geocoding/
- https://apidocs.geoapify.com/docs/routing/

Pricing/terms can change and must be rechecked before production. Credits are not assumed to equal requests; live usage must record endpoint-specific credit consumption.

## 3. Architecture boundary

- MapLibre runs in the browser.
- Browser may call only Geoapify tile/style endpoints with `GEOAPIFY_TILE_API_KEY`.
- Backend uses a separate `GEOAPIFY_SERVER_API_KEY` for geocoding, reverse geocoding and routing.
- Weather, ETA, route scoring, quota and risk remain backend-only.
- Geoapify attribution is mandatory.
- Public Nominatim, public OSM tiles and demo routing services are not production fallback.

## 4. Deferred/rejected options

| Option | Result |
|---|---|
| Mapbox | Rejected for MVP because Product Owner's account flow requires card billing |
| Google Maps Platform | Deferred to avoid billing/account/SDK complexity |
| HERE | Deferred to avoid an additional provider/account/test matrix |
| Self-hosted tiles/geocoder/router | Deferred because operational complexity is disproportionate for solo MVP |

These providers may be reconsidered through a new Decision ID if Geoapify coverage, quota, terms or reliability is insufficient.

## 5. Initial live evidence

A Geoapify account was configured with two distinct local key values. Public plan evidence says no card is required; billing state was not read by the probe. Distinct values prove local separation only; browser-origin restrictions, key permissions and rotation behavior still require implementation evidence.

Accepted probe command, executed without printing either key:

```powershell
powershell -ExecutionPolicy Bypass -File tools/provider-bakeoff/run-geoapify-capability-probe.ps1 `
  -SearchText "Đà Nẵng" `
  -OriginLatitude 21.028511 -OriginLongitude 105.804817 `
  -DestinationLatitude 20.844912 -DestinationLongitude 106.688084 `
  -Mode drive -CountryCode vn -StyleName osm-bright -Language vi
```

Latest accepted execution: `2026-07-30T17:33:58Z` (`2026-07-31` Asia/Bangkok).

| Probe | HTTP | Measured latency | Sanitized result |
|---|---:|---:|---|
| Style | 200 | 141 ms | MapLibre style version 8; 1 source; 111 layers; valid JSON |
| Geocoding | 200 | 726 ms | One city result: `Thành phố Đà Nẵng, Việt Nam`, country `vn`, coordinates `16.068501, 108.2240242` |
| Routing | 200 | 997 ms | One driving route; 131,499 m; 4,567.078 s; 1 leg; geometry array with 897 items |

The runner was executed three times while correcting its sanitized response extractor, so 9 real provider requests were sent in total. No raw provider response was persisted. The final extractor supports Geoapify `results` and GeoJSON `features` response shapes and emits derived fields only.

Observed limitations at the initial-probe point:

- One sample does not establish p50/p95 latency, Vietnam-wide quality or provider reliability.
- No rate-limit, quota or credit-usage headers were present in these responses; credit measurement needs account-dashboard before/after evidence.
- The returned style JSON did not contain source attribution. The frontend must render required Geoapify/OpenStreetMap attribution explicitly and verify it in browser tests.
- Full fixtures and route objectives were tested later and are recorded in Section 6.

## 6. Full fixture and route-objective evidence

[VIETNAM_PROVIDER_FIXTURE_REPORT.md](VIETNAM_PROVIDER_FIXTURE_REPORT.md) records the accepted reproducible suite:

- Forward geocoding: 30/30 Vietnam results; p50 1,030 ms; p95 4,575 ms.
- Reverse geocoding: 6/6 results; p50 577 ms; p95 814 ms.
- Routing: 30/30 expectations matched; 28 routes found and 2 negative open-water fixtures returned no route; p50 852 ms; p95 1,881 ms.
- Driving, bicycle and walking modes returned positive routes where expected.
- `balanced`, `short` and `less_maneuvers` returned distinct live geometries for the same coordinate pair.

Request accounting includes 9 initial-probe requests, 134 Geoapify requests across the packaging-failed and accepted full-suite executions, and 9 route-objective requests: 152 total. Only accepted executions contribute metrics.

Geoapify did not return authoritative credit-consumption headers. Phase 1 therefore does not claim requests equal credits and does not intentionally exhaust the free account. The application request ledger, explicit no-auto-upgrade policy and unavailable/degraded contract are approved here; browser attribution/key restrictions are verified in Phase 9 and account-dashboard reconciliation before production in Phase 13.
