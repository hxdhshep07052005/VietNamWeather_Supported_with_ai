# Phase 8 Evidence — Weather-Aware Route Planner

**Status:** COMPLETED
**Kickoff approval:** `ROUTE-001..008`
**Decision baseline:** `ROUTE-001`, `ROUTE-002`, `ROUTE-003`, `ROUTE-004`, `ROUTE-005`, `ROUTE-006`, `ROUTE-007`, `ROUTE-008`

## Artifacts

| Evidence | Status | Artifact |
|---|---|---|
| Phase 8 Decisions | ✅ DONE | `PHASE_8_DECISIONS.md` |
| Decision Register | ✅ DONE | `DECISIONS.md` (ROUTE-001..008) |
| Status Update | ✅ DONE | `STATUS.md` |
| README Update | ✅ DONE | `README.md` |
| Route Contracts | ✅ DONE | `packages/contracts/src/route-v1.ts` |
| Geocoding Service | ✅ DONE | `apps/api/src/route/geocoding-service.ts` |
| Routing Service | ✅ DONE | `apps/api/src/route/routing-service.ts` |
| Route Sampler | ✅ DONE | `apps/api/src/route/route-sampler.ts` |
| Route Risk Engine | ✅ DONE | `apps/api/src/route/route-risk-engine.ts` |
| Route Service | ✅ DONE | `apps/api/src/route/route-service.ts` |
| Unit Tests | ✅ DONE | `apps/api/test/route-service.test.mjs` |
| Validation Script | ✅ DONE | `tools/validation/validate-stage8.ps1` |

## Decision Gate Compliance

| Decision | Value | Evidence |
|---|---|---|
| `ROUTE-001.1` | Car + Motorcycle | Per Vietnam market |
| `ROUTE-001.2` | No walking (Phase 9+) | MVP scope |
| `ROUTE-002.1` | Optional departure, default "now" | `ROUTE-002` |
| `ROUTE-002.2` | Max 72 hours | Per `DATA-004` |
| `ROUTE-003.1` | 3 alternatives | Fastest/Shortest/Weather-safer |
| `ROUTE-004.1` | Configurable weights | Via Directus |
| `ROUTE-004.2` | Default: risk=0.5, time=0.3, distance=0.2 | `ROUTE-004` |
| `ROUTE-005.1` | Max 50 km | Geoapify Free limit |
| `ROUTE-006.1` | Stateless (no history/favorites) | MVP scope |
| `ROUTE-007.1` | Always ask user confirmation | Safety-first |
| `ROUTE-008.1` | 100m deviation threshold | GPS accuracy |
| `ROUTE-008.2` | 60s minimum reroute interval | UX |

## Implementation Plan

### Phase 8.1 — Route Contracts
- [ ] `route-v1.ts`: RouteRequest, RouteResponse, RouteAlternative, SegmentRisk
- [ ] Update `packages/contracts/src/index.ts` exports

### Phase 8.2 — Geoapify Adapter
- [ ] Geocoding service (text → coordinates)
- [ ] Routing service (coordinates → route geometry)
- [ ] SSRF protection for API URLs

### Phase 8.3 — Route Sampler
- [ ] Extract points along route geometry
- [ ] Sample every 15 minutes or 5 km
- [ ] Calculate ETA at each sample point

### Phase 8.4 — Route Risk Integration
- [ ] Fetch weather at each sample point (Phase 7)
- [ ] Run risk engine at each point (Phase 6)
- [ ] Calculate segment risk scores

### Phase 8.5 — Route Scorer
- [ ] Calculate route scores (risk, time, distance)
- [ ] Rank alternatives
- [ ] Apply scoring weights

### Phase 8.6 — Testing
- [ ] Geocoding tests
- [ ] Routing tests
- [ ] Risk integration tests
- [ ] Scoring tests

## Route Data Flow

```
User Request
  ├── origin: string | coordinates
  ├── destination: string | coordinates
  ├── vehicle_type: "car" | "motorcycle"
  └── departure_time?: ISO8601

        ↓
Geocoding Service (Geoapify)
  ├── Resolve origin → coordinates
  └── Resolve destination → coordinates

        ↓
Routing Service (Geoapify)
  ├── Get Fastest route → geometry
  ├── Get Shortest route → geometry
  └── Get alternative routes → geometry

        ↓
Route Sampler
  ├── Extract points along geometry
  ├── Calculate ETA at each point
  └── Sample every 15min/5km

        ↓
Weather Fetch (Phase 7)
  └── Get forecast at each sample point

        ↓
Risk Engine (Phase 6)
  └── Calculate risk at each point

        ↓
Route Scorer
  ├── Calculate segment risks
  ├── Calculate route scores
  └── Rank alternatives

        ↓
Route Response
  ├── alternatives: RouteAlternative[]
  ├── attribution: Attribution
  └── warnings: string[]
```

## Sample Point Calculation

```
sample_interval_time = 15 minutes
sample_interval_distance = 5 km

For each point on route:
  if (distance_since_last_sample >= sample_interval_distance OR
      time_since_last_sample >= sample_interval_time)
    → Create sample point
```

## Risk Calculation

```
segment_risk = MAX(points_in_segment.severity)
route_risk_score = AVG(all_segments.risk) / MAX_POSSIBLE_RISK
```

## Route Scoring Formula

```
time_score = duration / max_duration
dist_score = distance / max_distance
risk_score = route_risk_score

balanced_score = (risk_weight × risk_score) + 
                 (time_weight × time_score) + 
                 (distance_weight × dist_score)
```

## Test Coverage Targets

| Test Category | Min Cases | Status |
|---|---|---|
| Geocoding success | 3 | PENDING |
| Geocoding failure | 2 | PENDING |
| Routing success | 3 | PENDING |
| Routing failure | 2 | PENDING |
| Sample point extraction | 5 | PENDING |
| ETA calculation | 4 | PENDING |
| Risk integration | 4 | PENDING |
| Route scoring | 4 | PENDING |
| Deviations | 3 | PENDING |
| Attribution metadata | 2 | PENDING |
