# City weather and route data audit - 2026-09-30

## Confirmed causes and fixes

- Current observations contain precipitation in millimetres, but the provider does not define its accumulation interval. The risk reader previously returned no hourly rate for every current city. It now supplements this field with a valid hourly forecast at the same persisted sampling point and provider, covering the selected time. Observed accumulation is preserved separately. The UI explicitly labels the rate as forecast rain.
- Nearby samples were ordered by retrieval time before distance. New route samples could replace a city's closer reference sample. Selection now prioritizes usable evidence, then distance, then recency. Eligibility includes status, expiry, issue/observation age and no future retrievals. Returned sampling coordinates and distance allow this selection to be checked.
- WeatherAPI condition 1012 (Haze) was missing from the normalized vocabulary. This affected current Tuyen Quang, Yen Bai, Phu Tho and Vinh Phuc, plus route forecasts. All 60 codes in the provider catalog now map. Six additional categories distinguish haze, dust, smoke, smog, dust storms and sandstorms; ice pellets map to sleet instead of hail. Unrecognized future codes remain unknown.
- Wind unit conversion exposes values such as 17.7012 km/h. Display now rounds to one decimal; scoring retains full precision so rounding cannot move evidence across a threshold.
- Rainfall supplements reject expired data, future retrievals and forecasts issued more than 24 hours ago. A supplement query failure preserves the available current measurements and reports the missing rain evidence.
- Persistence identity version 4 permits corrected normalized snapshots without replacing immutable old rows. Local API/worker containers were rebuilt, and twelve affected city/corridor positions were refreshed through the normal worker queue.

## Runtime verification

- Nationwide endpoint returned all 63 cities at current, +1h, +24h and +48h. No missing temperature, wind gust, visibility, precipitation, hourly rain rate, humidity or condition; no stale evidence and no unknown conditions at these four checked times. Every rain risk value identifies its hourly forecast source.
- Compared twelve fields at each of those four times against all 63 city weather bundles: 3,024 checks, zero mismatches. All bundles returned success; all three local forecast days start at 17:00 UTC (midnight UTC+7). The first rapid query batch reached the local 20-request/minute limit; the remaining checks were paced across later windows, with all requests eventually HTTP 200. Results: `artifacts/city-weather-consistency-final.json`.
- Snapshot risk levels at current time: 58 low, 1 caution, 4 high. These are partial general weather assessments and change with weather; they are not official safety certifications.
- Final Hanoi-Lao Cai car request: 59/59 Fastest and 57/57 Shortest samples usable, 100% core-weather distance coverage, provisional ETA risk 33/100, balanced scores 64/100 and 66/100. Weather-Safer selects the Fastest candidate.
- Motorcycle request initially queued seven missing corridor positions. After ingestion: 65/65 Fastest and 60/60 Shortest samples usable, 100% coverage, provisional ETA risk 33/100, balanced scores 66/100 and 65/100. Weather-Safer selects the Shortest candidate.
- Both vehicle requests have zero forecast interval/ETA mismatches and zero unknown conditions. Maximum selected sample distances are below 15km. Final local response times were 6.45s (car) and 5.16s (motorcycle), including the unavailable rest-stop provider.
- Exact snapshots and route summaries: `artifacts/city-weather-audit-final-summary.json`, `artifacts/city-weather-final-*.json`, `artifacts/city-weather-route-final-summary.json` and `artifacts/city-weather-route-final-*.json`.

## Regression verification

- API: 212/212 tests. Worker: 60/60. Web: 58/58. Focused condition/province contracts: 6/6. Package builds and focused lint pass.
- Seven PostgreSQL cases run the actual production queries against transaction-local fixtures. Four cases failed before fixing early wind rounding and incomplete age-based ordering; all seven now pass. No stored weather is modified by this check.
- Repeat the database regression after building the API image: `docker exec -i vietnam_weather_local-api-1 node --input-type=module < tools/validation/validate-weather-evidence.mjs` (Git Bash).
- Regression artifacts: `artifacts/weather-evidence-postgres-red.json`, `artifacts/weather-evidence-postgres-green.json`, `artifacts/city-weather-api-final-tests.txt`, `artifacts/city-weather-worker-final-tests.txt`, `artifacts/weather-condition-tests.log`, `artifacts/weather-condition-build.log`.

## Limits retained explicitly

- Official alerts are not integrated. WeatherAPI ingestion currently requests `alerts=no`; an empty provider alert list would not establish complete official-alert coverage or Vietnam hazard levels. No level zero is invented.
- A generic weather condition cannot establish distant versus direct thunderstorm classification. Actual conditions are displayed independently, with missing classification explained. Strict six-dimension route assessment therefore remains incomplete; route comparisons use the separate disclosed provisional policy.
- `matched_coordinates` is the persisted requested sampling position, not a provider weather-station coordinate. The provider may return a nearby grid/location; station-level spatial accuracy is not claimed.
- Named OpenStreetMap rest-stop retrieval remains unavailable upstream. No stop names are invented.
- Direct browser visual QA remains unverified because localhost browser access was denied earlier. Component tests and live API/DB checks are the evidence for this change.
- Existing unrelated contract test export failure (`WEATHER_ERROR_CATALOG`) and frontend large-bundle warning remain. Pre-existing whitespace findings elsewhere in the shared worktree are unchanged.

Provider references: https://www.weatherapi.com/docs/ and https://www.weatherapi.com/docs/weather_conditions.json.

## Follow-up: omitted rain probability and misleading Storm value

The earlier 3,024-field comparison did not include precipitation probability. The user's follow-up correctly exposed another omission: all 63 current reports returned null probability even when their matching hourly forecast contained it. The hourly supplement now reads rain amount and probability independently, preserves zero, and returns `precipitation_probability_source` for the selected hour. A missing amount does not discard a known probability, and observed temperature/humidity/wind remain unchanged.

Weather card/table/modal labels now identify hourly rain chance. Missing probability displays a dash without a percent sign, while actual zero displays `0%`. Sorting keeps missing values after known probabilities. Fog is shown as a weather condition, never substituted into the Storm evidence card. Unknown storm classification and disconnected official alerts remain explicit.

Live examples at the checked current hour: An Giang humidity79%, wind8.6km/h, gust17.4km/h, UV0, rain chance19%; Tien Giang and Long An temperature25C, wind4.3km/h, gust4.4km/h, fog, visibility2000m, rain chance34%. UV0 is a provided night-time value. Wind speed and gust are distinct fields; the two sets of pasted figures correspond to different city measurements in this snapshot.

Deployed API:63/63 provinces have probability and hourly provenance at current/+1h/+24h/+48h, with zero interval mismatches. Hanoi-Lao Cai car:59/59 Fastest and57/57 Shortest samples have probability,100% core-weather coverage, ETA risk33/100, balanced scores64/66 and a Weather-Safer recommendation. API216/216 tests, web63/63 and all10 real PostgreSQL fixture cases pass; builds and focused backend lint pass. Direct browser visual QA remains unverified under the existing localhost access restriction.

Evidence: `artifacts/weather-probability-live-summary.json`, `artifacts/weather-probability-live-*.json`, `artifacts/weather-probability-route.json`, `artifacts/weather-probability-api-red.txt`, `artifacts/weather-probability-api-green.txt`, `artifacts/weather-probability-sql-red.json`, `artifacts/weather-probability-sql-green.json`, `artifacts/weather-chance-before.log`, `artifacts/weather-chance-tests.log`, `artifacts/weather-chance-build.log`.
