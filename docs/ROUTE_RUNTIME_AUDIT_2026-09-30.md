# Route runtime audit

Latest city-data and car/motorcycle Route verification: [City weather data audit](CITY_WEATHER_DATA_AUDIT_2026-09-30.md). It supersedes the earlier coverage snapshots below.

## Measured latency

Hanoi to Lao Cai, car: instrumented current API total 31,324 ms, 116 SQL weather reads totaling 28,119 ms, parallel geocoding about 1,697 ms, routing about 1,496 ms. Existing weather indexes indexed geometry, while ST_DWithin queried geography, so they could not accelerate the cast expression.

Added concurrent geography GiST indexes in migration 015. Live route HTTP 200 after the index fix: 3,574 ms. Example uncovered-point EXPLAIN ANALYZE changed from 207 ms (bitmap heap and JIT) to 0.359 ms with weather_forecasts_geography_gix. These are local observations, not guaranteed performance SLAs.

RouteRiskEngine now uses at most four concurrent weather lookups instead of serializing all samples. Every sample and ETA remains associated by its original index. Regression fails on serial implementation and passes with bounded workers.

## ETA risk and safer route

The strict report policy requires six dimensions. Official alert evidence is not integrated and generic thunder codes cannot establish direct/distant storm classes; missing spatial weather coverage also exists between province sampling locations. These conditions still produce null strict aggregate risk. The follow-up repair adds a separate, explicitly provisional vehicle-specific weather score and comparison; it does not change the strict report assessment.

Frontend had mapped checkpoint risk/reasons but omitted them from checkpoint detail JSX. Exposing known evidence and readable missing-data reasons is independent of changing risk policy.

## Named stops

The existing weather samples had no POI names or place IDs. They must not be called rest stops. A separate named OSM highway=rest_area/services source is being verified; unavailable provider access must remain explicit, and nearby POIs do not certify road-side accessibility or an actual driving detour.

## Final live validation

Deployed API returned HTTP 200 in 2,803 ms for Hanoi-Lao Cai: 59/57 samples preserved, strict aggregate risks Unknown, recommendation null. Rest-stop result explicitly unavailable from OpenStreetMap; no fictional names. Source response saved in artifacts/route-runtime-final.json. API 197/197 tests and web 46/46 tests pass; contracts/API/web builds pass. Added separate fastest-route named-rest-stop list with source links, true empty vs unavailable states, and access caveat. Browser visual QA remains unverified due prior access denial.

## Provisional ranking policy (follow-up repair)

`route-weather-provisional-v1` requires fresh/aging covered wind gust, temperature and visibility evidence at each ETA. It takes the maximum available vehicle-specific severity; unclassified thunder establishes at least caution. Missing/stale core evidence stays unknown. Missing official alerts remain explicitly disclosed.

The route provisional score weights adjacent usable endpoint scores by segment distance. Uncovered distance receives score 1 as a conservative ranking penalty, not as an observed hazard. `observed_score` separately excludes gaps; `coverage_percent` measures usable segment distance. No usable segment means no provisional score or recommendation. The report balanced weights (risk 0.5, time 0.3, distance 0.2) select among actual provider candidates using strict score when complete, provisional score otherwise. This missing-data penalty is a new versioned policy, not a formula claimed from the report. Weather-Safer can share geometry with Fastest/Shortest; no extra road is fabricated.

Frontend shows numeric provisional ETA risk, route score, coverage and missing evidence. Strict assessment fields are preserved. API regression suite: 201/201; initial web regression suite: 47/47.

### Live provisional result

Rebuilt and restarted the local API. UTF-8 JSON request for Hanoi-Lao Cai (car) returned HTTP 200 in 3,182 ms. Fastest and Weather-Safer: provisional risk 0.7471 (75/100), observed-only risk 1/3, distance coverage 38%, balanced route score 0.8499 (85/100). Shortest: provisional risk 0.7976, coverage 30%, balanced score 0.8920. Weather-Safer is recommended and shares the Fastest geometry. Strict score remains null; 27/59 fastest-route checkpoints have usable provisional evidence. Named OSM rest stops remain unavailable. Full sanitized route payload: artifacts/route-runtime-provisional.json.

The map colors only provisional segments with both usable endpoints; uncovered endpoints leave the segment gray. UI includes separate balanced Route Score and ETA Risk. Final full web suite 48/48, API 201/201, production builds passed. Browser visual validation remains unverified because browser access was previously denied; component tests verify the displayed score/coverage states.

## Follow-up: gray line and unnamed stops

The live API still provides 27/59 provisional points for Hanoi-Lao Cai; the frontend on port 3000 serves the provisional implementation. Thus the current response is not entirely unknown. Rest-stop retrieval was independently broken: Overpass POST returned HTTP 406, while a bounded GET request returned valid JSON. Switched to GET with a descriptive User-Agent and recognized name:vi/name/name:en (including blank generic name with a valid localized name). Operator-only records remain excluded. The provider also returned a shared-IP rate-limit response for the larger corridor; no further probing after this response, and no invented stop names. Full API suite 201/201 passed after this fix.

Confirmed map lifecycle regression: a delayed 100 ms redraw in the load handler captured the initial gray geometry and could overwrite newer colored geometry. The new component regression fails with the old callback and passes with current refs. Load, delayed redraw and style.load now use latest geometry and synchronization callbacks. Full web suite 49/49 and build passed. The saved live Hanoi-Lao Cai response contains 22 eligible adjacent pairs and 36 uncovered segments, so correct output is mixed green/gray, not all gray. Port 3000 serves the corrected callback; API readiness is 200 after deploying the rest-stop fix. Actual browser rendering is still unverified under the prior browser-access restriction; actual named stops are still blocked by upstream rate limiting.

## Corridor weather refresh repair

Root cause of km25-40 gaps: scheduler populated only province reference points; route assessment only read persisted evidence within15km and never requested missing corridor positions. Added RouteWeatherRefresh using the existing durable WeatherStore/worker ingestion pipeline. Missing or stale gust/temperature/visibility evidence triggers coordinate bundle requests; absent official alerts alone does not. Requests use10km spatial deduplication, rounded coordinates, hashed10min idempotency buckets, max100 anchors and enqueue concurrency4. The15km evidence radius and strict report policy remain intact.

Route response includes weather_refresh pending/unavailable metadata. Frontend keeps interim results, polls at5sec up to6 retries, respects input changes/unmount, charges no extra retry quota, and retains the route on retry failure. Display milestone precision is capped at1 decimal without changing calculations.

Actual16 missing corridor anchors were queued and ingested. Deployed API Hanoi-Lao Cai:59/59 Fastest and57/57 Shortest samples now have provisional ETA weather risk,100% distance coverage. User examples km24.96/29.95/34.94/39.94 now return26.5/25.7/25.7/25.7C, provisional low. Fastest/Weather-Safer provisional risk33/100 and balanced score64/100. Captured response: artifacts/route-corridor-final.json.

Separate live end-to-end refresh: Hanoi-Hai Phong initially50/52% coverage and pending5 requested points; after normal worker ingestion returned100% with23/23 and22/22 usable samples, no pending flag. API208/208 and web53/53 tests passed; contracts/API/web builds passed. Direct browser visual QA remains unverified under prior access restriction. Official alert/storm classification remains incomplete, so scores remain explicitly provisional despite100% core-weather distance coverage.
