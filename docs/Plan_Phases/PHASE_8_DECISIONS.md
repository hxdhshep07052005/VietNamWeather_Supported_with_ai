# Phase 8 Decision Gate — Weather-Aware Route Planner

**Date:** 2026-08-14
**Status:** APPROVED
**Approved by:** Technical Owner
**Decision IDs:** `ROUTE-001` through `ROUTE-008`

## Decision Gate Summary

Phase 8 implements weather-aware route planning with risk evaluation along routes. This document records all product decisions required before implementation.

---

## ROUTE-001 — Vehicle Type Support

**Ruling:** MVP supports **Car** and **Motorcycle** vehicle types.

**Rationale:** 
- Vietnam has high motorcycle usage (estimated 45+ million motorcycles)
- Car is the second most common vehicle type
- Walking support is deferred to future phase (Phase 9+)

**Supported vehicle types:**
| Vehicle | Transport Mode | Road Types |
|---------|--------------|-----------|
| Car | `driving-car` | highways, major roads |
| Motorcycle | `driving-hgv` or custom profile | Suitable for motorcycles |

**Note:** Geoapify Routing API v8 uses transport modes. Profile selection affects route geometry and duration.

---

## ROUTE-002 — Departure Time Input

**Ruling:** Departure time is **optional**, defaults to **"now"** (current time).

**Implementation:**
- If `departure_time` not provided: use current time
- If provided: must be within 72 hours (per `DATA-004`)
- Past departure times are rejected
- Future departure times allowed up to 72 hours

**Rationale:** Most users want route for immediate travel. Optional parameter with sensible default simplifies MVP.

---

## ROUTE-003 — Route Alternatives

**Ruling:** MVP returns **3 alternatives** when available:
1. **Fastest** - minimum duration
2. **Shortest** - minimum distance
3. **Weather-safer** - minimum weather risk score

**Constraints:**
- If Geoapify provides <3 alternatives, return what's available
- Do NOT claim "optimal global route" if provider doesn't support alternatives
- Each alternative has independent risk evaluation

**Rationale:** Three alternatives give meaningful choice without overwhelming user. `Weather-safer` is based on Phase 6 risk engine output.

---

## ROUTE-004 — Route Scoring Weights

**Ruling:** Balance factors are **configurable via Directus** with MVP defaults:

| Factor | MVP Default Weight | Description |
|--------|-------------------|-------------|
| `risk_weight` | 0.5 | Weather risk score (0-1) |
| `time_weight` | 0.3 | Duration deviation from fastest |
| `distance_weight` | 0.2 | Distance deviation from shortest |

**Scoring formula:**
```
balanced_score = (risk_weight × risk_score) + 
                 (time_weight × normalized_time) + 
                 (distance_weight × normalized_distance)
```

**Rationale:** Configurable weights allow tuning without code changes. Default weights favor safety (risk) while considering practicality (time, distance).

---

## ROUTE-005 — Maximum Route Length

**Ruling:** MVP limits routes to **50 km** maximum distance.

**Constraints:**
- Routes exceeding 50 km are rejected with clear error
- This aligns with Geoapify Free plan limits
- Longer routes can be considered in Phase 10 (Pro tier)

**Rationale:** Geoapify Free has usage limits. 50 km covers most intra-city and many inter-city routes in Vietnam.

**Note:** `DATA-004` already limits risk scoring to 72-hour ETA. Route length adds practical boundary.

---

## ROUTE-006 — Route History/Favorites

**Ruling:** MVP is **stateless** - no route history or favorites storage.

**Rationale:** MVP focuses on core route planning. History/favorites add complexity:
- Data persistence requirements
- User authentication implications
- Storage and retention policies

**Future scope:** Route saving (Phase 9+ with user accounts)

---

## ROUTE-007 — Auto-Reroute Behavior

**Ruling:** MVP **always asks user confirmation** before any reroute (Free and Pro).

**Reroute triggers:**
1. GPS deviation from route > deviation threshold
2. Significant weather change along route
3. User manually requests reroute

**UI flow:**
```
Deviation detected → Show warning → User confirms → Calculate new route
```

**Rationale:** Safety-first principle. Never auto-change user's route without explicit consent. This applies to both Free and Pro tiers.

---

## ROUTE-008 — Deviation Threshold and Reroute Interval

**Ruling:** Deviation threshold and reroute interval are **configurable via Directus**:

| Parameter | MVP Default | Description |
|-----------|------------|-------------|
| `deviation_threshold_meters` | 100 | Minimum distance off-route to trigger |
| `min_reroute_interval_seconds` | 60 | Minimum time between reroute offers |

**Constraints:**
- Deviation < 100m: ignore (GPS noise)
- Deviation >= 100m: show warning, ask confirmation
- After reroute: wait 60s before next reroute offer

**Rationale:** 100m threshold handles GPS accuracy issues. 60s interval prevents notification spam.

---

## Implementation Constraints

### Must include in every route response:
- Route geometry (GeoJSON LineString)
- Total distance (meters) and duration (seconds)
- Turn-by-turn instructions summary
- Risk score and level for entire route
- Per-segment risk breakdown
- Attribution (Geoapify, WeatherAPI)
- ETA at each segment
- Forecast freshness at each sample point

### Must handle explicitly:
- Routes with ETA > 72 hours (limit risk scoring, show warning)
- Routes crossing day 4-7 boundary (show "outlook only" warning)
- Routes with insufficient forecast coverage (mark incomplete)
- Provider timeout/errors (graceful degradation)

### Must NOT:
- Auto-change user's route
- Claim "guaranteed safe route"
- Mix providers in single route assessment
- Store GPS location persistently
- Exceed 50 km route length

---

## Data Flow

```
User Request
    ↓
Geocoding Service (Geoapify)
    ↓
Routing Service (Geoapify)
    ↓
Route Sampler (extract points along geometry)
    ↓
Forecast Service (Phase 7)
    ↓
Risk Engine (Phase 6)
    ↓
Route Scorer (ROUTE-004 weights)
    ↓
Route Response DTO
```

---

## Route Risk Evaluation

### Sample Points
- Sample every **15 minutes** of travel time along route
- Or every **5 km**, whichever is more frequent
- Use interpolation for points between forecast grid

### Risk Calculation
- Run Phase 6 risk engine at each sample point
- Calculate segment risk as max severity along segment
- Route risk = weighted average of segment risks

### Scoring
```
segment_risk = MAX(points_in_segment.risk_severity)
route_risk_score = AVG(all_segments.risk) / MAX_POSSIBLE_RISK
```

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-08-14 | Technical Owner | Initial decisions based on Phase 8 Decision Gate |
