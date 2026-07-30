# Provider Bake-off Specification

## 1. Purpose

Chọn provider production bằng dữ liệu đo được tại Việt Nam, không chỉ dựa trên marketing, free tier hoặc cảm nhận trong UI. Bake-off dùng test-only fixtures và không seed benchmark data vào production catalog.

## 2. Candidates

### Weather

- WeatherAPI.com Pro+ candidate.
- OpenWeather One Call 4.0 + Weather Maps 2.0 candidate.
- Tomorrow.io enterprise fallback nếu Weather on Routes/advanced layers có lợi ích đủ lớn.

### Map/geocoding/routing

- MapLibre GL JS + Geoapify Free is the selected MVP baseline under `ARCH-012`.
- Mapbox, Google Maps Platform and HERE are deferred; no comparative MVP integration is required.
- Public Nominatim/OSM tiles are negative control only, not an approved production choice.

### Payment feasibility

- Stripe account/merchant eligibility check.
- VNPay production merchant capability, PAY/IPN/refund and token/renewal check.

## 3. Prerequisites

- Separate development provider accounts/API keys; no secrets in Git.
- Geoapify uses separate tile/browser and server keys; no card or paid auto-upgrade is approved.
- Provider terms, attribution, storage/caching and commercial-use pages saved with access date.
- VNPay sandbox credentials and merchant onboarding contact.
- Stripe account eligibility evidence or explicit feature-disabled result.
- A test runner that records request, response status, latency, cost units, provenance and sanitized error.

## 4. Weather benchmark set

The following are test-only benchmark locations; the runtime location catalog remains Directus-managed:

| Region | Locations |
|---|---|
| North | Hanoi, Hai Phong, Ha Long, Sa Pa, Ha Giang, Cao Bang/Ban Gioc, Dien Bien Phu, Moc Chau, Ninh Binh, Lang Son |
| Central | Dong Hoi, Hue, Da Nang, Hoi An, Quang Ngai, Quy Nhon, Tuy Hoa, Nha Trang, Da Lat, Pleiku |
| South | Ho Chi Minh City, Vung Tau, Phan Thiet, Buon Ma Thuot, Can Tho, Rach Gia, Phu Quoc, Con Dao, Ca Mau, Lao Cai |

For each location, test coordinates and bilingual queries with/without Vietnamese diacritics where the provider supports search.

Required fields: temperature, feels-like, precipitation amount/probability, wind speed/gust/direction, humidity, cloud, visibility, UV, alerts, timezone, `issued_at`, `valid_at` and provider update/fetch behavior.

Benchmark phải tách kết quả theo lead time: `0–24h`, `24–72h`, `>72h–7d` và `>7d` nếu provider có dữ liệu. Chỉ nhóm tới 72 giờ đủ điều kiện đánh giá cho route/risk theo `DATA-004`; các nhóm xa hơn chỉ kiểm tra outlook/display capability.

## 5. Route benchmark set

- 30 routable pairs across urban, inter-city, coastal and mountain contexts.
- 5 expected no-route/unsupported pairs to verify explicit failure state.
- Driving and walking where provider supports both; GPS reroute sample for at least 5 pairs.
- Record distance, duration, geometry quality, alternatives, traffic/incident metadata, waypoint limits and provider reference.
- Sample weather at ETA for each candidate route; record request multiplier and cost.

## 6. Scoring

### Weather score — 100 points

| Criterion | Weight |
|---|---:|
| Vietnam location coverage and bilingual query behavior | 15 |
| Required field completeness | 15 |
| Freshness/update metadata | 10 |
| Hourly/daily forecast usability | 15 |
| Map layers/current/future timestamp alignment | 10 |
| Latency and error/degraded behavior | 10 |
| Commercial terms, attribution, caching and storage | 10 |
| Projected cost under envelope | 10 |
| Documentation/support | 5 |

### Geoapify live validation — pass/fail plus measured evidence

| Criterion | Required evidence |
|---|---|
| Vietnam geocoding relevance | Bilingual/accentless queries and reverse-geocoding samples |
| Routable coverage/no-route correctness | 30 routable pairs plus explicit no-route fixtures |
| Alternatives and route objective support | Actual provider-returned alternatives; no invented geometry |
| Geometry/ETA/segment metadata | DTO/route-sampling compatibility |
| Map performance and attribution | MapLibre tile/style render, attribution and browser allowlist |
| Credit usage | Endpoint-specific credits and 50%/75%/90%/100% daily thresholds |
| Quota exhaustion | Explicit unavailable/degraded state with no paid or public-service fallback |

Any Critical legal, security or data-provenance failure is a hard fail regardless of numeric score.

## 7. Required evidence report

For each candidate record:

- Provider/product/version and documentation URL/date.
- Test fixture version and exact test command.
- Success/error counts and sanitized samples.
- p50/p95 latency, timeout and rate-limit behavior.
- Field completeness and timestamp/freshness results.
- Cost projection under Free/Pro entitlement traffic.
- Attribution/license/storage decision.
- Recommendation, rejected alternatives and rollback/adapter implications.

## 8. Phase 1 gate

Phase 1 verification requires:

1. Weather and Geoapify baselines have reproducible live reports.
2. The Product Owner approves capability-bounded weather and route behavior.
3. Stripe/VNPay unavailable capability fails closed and is recorded.
4. Provider budget ceiling, zero-auto-spend and downstream implementation owners are recorded.

## 9. Current execution evidence

[WEATHER_BAKEOFF_REPORT.md](WEATHER_BAKEOFF_REPORT.md) records the initial probes and accepted 30-location suite. WeatherAPI is selected under `ARCH-013` with current + actual 3-day capability; OpenWeather One Call remains deferred.

[MAP_BAKEOFF_REPORT.md](MAP_BAKEOFF_REPORT.md) and [VIETNAM_PROVIDER_FIXTURE_REPORT.md](VIETNAM_PROVIDER_FIXTURE_REPORT.md) record full live fixtures and route-objective capability. Browser/account controls remain assigned to Phase 9/13.

[PAYMENT_CAPABILITY_REPORT.md](PAYMENT_CAPABILITY_REPORT.md) records the conditional Stripe/VNPay contract. No merchant or payment request was sent; both providers remain disabled until their evidence gate passes.
