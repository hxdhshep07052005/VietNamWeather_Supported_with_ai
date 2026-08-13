# Phase 7 Evidence — Forecast & Trend Experience

**Status:** COMPLETED
**Kickoff approval:** `FCAST-001..006`
**Decision baseline:** `FCAST-001`, `FCAST-002`, `FCAST-003`, `FCAST-004`, `FCAST-005`, `FCAST-006`

## Artifacts

| Evidence | Status | Artifact |
|---|---|---|
| Phase 7 Decisions | ✅ DONE | `PHASE_7_DECISIONS.md` |
| Decision Register | ✅ DONE | `DECISIONS.md` (FCAST-001..006) |
| Status Update | ✅ DONE | `STATUS.md` |
| README Update | ✅ DONE | `README.md` |
| Forecast Contracts | ✅ DONE | `packages/contracts/src/forecast-v1.ts` |
| Trend Contracts | ✅ DONE | `packages/contracts/src/trend-v1.ts` |
| Forecast Service | ✅ DONE | `apps/api/src/forecast/forecast-service.ts` |
| Trend Service | ✅ DONE | `apps/api/src/forecast/trend-service.ts` |
| Unit Tests | ✅ DONE | `apps/api/test/forecast-service.test.mjs` |
| Validation Script | ✅ DONE | `tools/validation/validate-stage7.ps1` |

## Decision Gate Compliance

| Decision | Value | Evidence |
|---|---|---|
| `FCAST-001.1` | Hourly max 72h | Per `ARCH-013` |
| `FCAST-001.2` | Daily max 3d | WeatherAPI baseline |
| `FCAST-002.1` | Forecast window only | `FCAST-002` |
| `FCAST-003.1` | Core: temp, precip, wind | `FCAST-003` |
| `FCAST-004.1` | No multi-provider | Single provider per Phase 5 |
| `FCAST-005.1` | Fixed VN timezone | `Asia/Ho_Chi_Minh` |
| `FCAST-006.1` | View-only, no export | MVP scope |

## Implementation Plan

### Phase 7.1 — Contracts
- [ ] `forecast-v1.ts`: HourlyForecast, DailyForecast, ForecastSeries
- [ ] `trend-v1.ts`: TrendDirection, TrendSummary
- [ ] Update `packages/contracts/src/index.ts` exports

### Phase 7.2 — Forecast Service
- [ ] Load hourly/daily from Phase 5 weather data
- [ ] Apply timezone conversion (UTC → Asia/Ho_Chi_Minh)
- [ ] Detect and mark gaps in forecast series
- [ ] Enforce horizon limits (72h hourly, 3d daily)

### Phase 7.3 — Trend Service
- [ ] Calculate temperature trend (increasing/decreasing/stable)
- [ ] Calculate precipitation trend
- [ ] Calculate wind trend
- [ ] Return trend per variable with confidence

### Phase 7.4 — Attribution & Display Metadata
- [ ] Include provider source on every response
- [ ] Include issue time and last updated
- [ ] Include freshness indicator

### Phase 7.5 — Testing
- [ ] Horizon limit tests (verify >72h rejected)
- [ ] Gap detection tests
- [ ] Timezone conversion tests
- [ ] Trend calculation tests

## Forecast Data Flow

```
Phase 5 Weather Store
        ↓
Raw Hourly/Daily Data (UTC)
        ↓
Forecast Service
  ├── Gap Detection
  ├── Horizon Enforcement (72h / 3d)
  └── Timezone Conversion (→ ICT)
        ↓
Trend Service
  └── Calculate Trends
        ↓
Forecast Response DTO
  ├── hourly: HourlyForecast[]
  ├── daily: DailyForecast[]
  ├── trends: TrendSummary[]
  └── attribution: Attribution
```

## Timezone Handling (FCAST-005)

| Storage | Display |
|---------|---------|
| UTC | Asia/Ho_Chi_Minh (ICT) |

Format examples:
- `2026-08-14T00:00:00Z` (UTC) → `00:00 ICT` (display)
- `2026-08-14T07:00:00Z` (UTC) → `14:00 ICT` (display)

## Chart Variables (FCAST-003)

| Variable | Chart Type | Required |
|----------|-----------|----------|
| temp_c | Line | Yes |
| precip_probability | Bar | Yes |
| precip_amount_mm | Bar | Yes |
| wind_speed_m/s | Line | Yes |
| condition_code | Icon | Yes |

## Gap Handling

A gap in forecast data occurs when:
1. Expected interval has no data point
2. Time difference between points > expected interval

Gaps must be:
- Marked with `is_gap: true`
- Not interpolated or filled
- Displayed as break in chart

## Stale Data Handling

Stale forecast data (per `ARCH-013`):
- Mark with `freshness: "stale"`
- Display warning indicator
- Do NOT hide from user

## Test Coverage Targets

| Test Category | Min Cases | Status |
|---|---|---|
| Hourly horizon limit (72h) | 3 | PENDING |
| Daily horizon limit (3d) | 3 | PENDING |
| Timezone conversion | 5 | PENDING |
| Gap detection | 4 | PENDING |
| Temperature trend | 5 | PENDING |
| Precipitation trend | 4 | PENDING |
| Wind trend | 4 | PENDING |
| Attribution metadata | 3 | PENDING |
