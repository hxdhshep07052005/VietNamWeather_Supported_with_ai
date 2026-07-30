# Vietnam Provider Fixture Report

## 1. Status

| Field | Value |
|---|---|
| Verification date | 2026-07-31 |
| State | ACCEPTED LIVE FIXTURE / PRODUCTION CONTROL EVIDENCE DEFERRED |
| Fixture | `tools/provider-bakeoff/fixtures/vietnam-stage1.json` |
| Fixture SHA-256 | `7f21321c774ced224919c68e2023456c5162808a299b1c13451dbe40da3b757b` |
| Accepted execution | `2026-07-30T17:49:15Z` |
| Accepted-run requests | 97 |
| Raw provider responses persisted | No |

The fixture is versioned test configuration, not product data. Location coordinates used by the positive route and weather cases were resolved from live Geoapify geocoding during the run; they were not embedded into product code.

## 2. Reproducible command

```powershell
powershell -ExecutionPolicy Bypass -File tools/provider-bakeoff/run-vietnam-provider-fixtures.ps1 `
  -OutputPath artifacts/provider-bakeoff/local/vietnam-stage1-2026-07-31.json
```

The local artifact is sanitized and Git-ignored. It contains derived fields and case-level status only; API keys, request URLs containing keys and raw response bodies are not persisted.

## 3. Request accounting

The first full-suite execution completed its provider calls but failed while converting Windows PowerShell generic lists into the local artifact. That run is excluded from latency/result metrics but included in usage accounting. The corrected execution then completed successfully.

| Provider/capability | First packaging-failed run | Accepted run | Total requests |
|---|---:|---:|---:|
| Geoapify style/geocoding/reverse/routing | 67 | 67 | 134 |
| WeatherAPI forecast | 30 | 30 | 60 |
| **Total** | **97** | **97** | **194** |

Request count is not treated as Geoapify credit count because the responses did not expose authoritative credit-consumption headers.

## 4. Geoapify accepted results

| Capability | Result | p50 | p95 |
|---|---:|---:|---:|
| Forward geocoding | 30/30 returned a Vietnam result | 1,030 ms | 4,575 ms |
| Reverse geocoding | 6/6 returned a result | 577 ms | 814 ms |
| Routing fixtures | 30/30 matched the versioned expectation | 852 ms | 1,881 ms |

Routing details:

- 28 positive fixtures returned a route.
- 2 negative open-water fixtures returned HTTP 200 with zero routes.
- Driving, bicycle and walking modes returned valid route results for their positive fixtures.
- Style endpoint returned HTTP 200, MapLibre style version 8, 1 source and 111 layers.

The geocoding p95 exceeds the application provider-backed target of 3 seconds. Application API behavior therefore uses a 3-second provider deadline, cached canonical locations for common searches and explicit degraded/unavailable responses; it must not wait indefinitely or fabricate search results.

## 5. Route-objective capability

A separate live probe used the same coordinate pair with the official Geoapify route types. All three returned HTTP 200 and distinct geometry hashes:

| Type | Distance | Duration | Geometry items |
|---|---:|---:|---:|
| `balanced` | 131,499 m | 4,567.078 s | 897 |
| `short` | 108,265 m | 5,544.309 s | 1,523 |
| `less_maneuvers` | 123,602 m | 4,498.637 s | 877 |

These types provide distinct candidate geometries; they do not themselves provide a weather-safety guarantee. The backend may compare provider-returned candidates with versioned weather-risk rules in Phase 8. It must label objectives accurately and never call one route universally safest.

## 6. WeatherAPI accepted results

| Capability | Result |
|---|---|
| Vietnam locations | 30/30 HTTP 200 with current and forecast data |
| Requested forecast | 7 days |
| Returned forecast | Exactly 3 days at all 30 locations |
| Latency | p50 86 ms; p95 310 ms |
| Provider timezone labels | 19 `Asia/Ho_Chi_Minh`, 9 `Asia/Bangkok`, 2 `Asia/Phnom_Penh` |

The provider timezone variance proves that provider location/timezone labels are metadata, not authoritative product identity. Canonical location and timezone come from the application reference/configuration layer.

## 7. Stage 1 conclusion

- Geoapify has sufficient initial Vietnam capability for the MapLibre/geocoding/routing adapter baseline.
- WeatherAPI is technically usable for current plus the account's actual 3-day forecast capability.
- Neither provider result justifies hardcoding availability, horizon, timezone, location labels, credits or route guarantees.
- Browser attribution/key restriction tests, quota-exhaustion behavior and account-dashboard usage reconciliation are implementation/operations evidence assigned to Phases 8, 9 and 13, not reasons to fabricate a live exhaustion test in Phase 1.
