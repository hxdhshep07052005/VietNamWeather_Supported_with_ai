# Phase 7 Decision Gate — Forecast & Trend Experience

**Date:** 2026-08-14
**Status:** APPROVED
**Approved by:** Technical Owner
**Decision IDs:** `FCAST-001` through `FCAST-006`

## Decision Gate Summary

Phase 7 implements forecast and trend visualization for the weather product. This document records all product decisions required before implementation.

---

## FCAST-001 — Forecast Horizon

**Ruling:** MVP uses limited horizon based on WeatherAPI baseline:
- **Hourly forecast:** 72 hours maximum
- **Daily forecast:** 3 days maximum

**Rationale:** WeatherAPI Free plan provides hourly up to 72h and daily up to 3 days. Day 4-7 capability is disabled per `ARCH-013` until live evidence verifies data completeness.

**Constraints:**
- No display of >72h hourly data
- No display of >3d daily data
- Horizon limited by account capability and provider coverage

---

## FCAST-002 — Trend Definition

**Ruling:** MVP defines "trend" as change within the forecast window only.

**Trend calculation:**
- Temperature trend: `increasing` (>2°C rise), `decreasing` (>2°C drop), `stable` (within ±2°C)
- Precipitation trend: `increasing`, `decreasing`, `stable`
- Wind trend: `increasing`, `decreasing`, `stable`

**Ruling:** Historical climatology analysis is **NOT** in MVP scope.

**Rationale:** Historical data requires long-term storage and different data sources. MVP focuses on forecast window trends only.

---

## FCAST-003 — Chart Variables

**Ruling:** MVP chart displays these core variables for travel decisions:

| Variable | Chart Type | Display Priority |
|----------|------------|-----------------|
| Temperature (temp_c) | Line chart | Primary |
| Precipitation probability (%) | Bar chart | Primary |
| Precipitation amount (mm) | Bar chart | Secondary |
| Wind speed (m/s) | Line chart | Secondary |
| Weather condition | Icon/emoji | Tertiary |

**Variables in detail screen only:**
- Humidity (%)
- UV index
- Visibility (km)
- Sunrise/sunset

**Rationale:** Core travel variables are temperature, rain, and wind. Detail screen for additional fields.

---

## FCAST-004 — Multi-Provider Comparison

**Ruling:** MVP does **NOT** support multi-provider comparison.

**Rationale:** Phase 5 baseline uses WeatherAPI as single provider. No mixing of providers in forecast display.

**Future scope:** Multi-provider comparison (Phase 10+ if needed).

---

## FCAST-005 — Timezone Display

**Ruling:** Timezone display is **fixed to Vietnam (`Asia/Ho_Chi_Minh`)**.

**Implementation:**
- All timestamps stored in UTC
- Display converted to `Asia/Ho_Chi_Minh` timezone
- Time shown as "HH:mm ICT" format
- Date shown as "DD MMM" or "DD/MM" per locale

**Rationale:** Product targets Vietnam users primarily. Fixed timezone simplifies implementation. Per `DATA-008` canonical timezone is `Asia/Ho_Chi_Minh`.

**Note:** User timezone preference (device timezone) is deferred to future phase.

---

## FCAST-006 — Export/Share Capability

**Ruling:** MVP is **view-only** - no export or share functionality.

**Rationale:** MVP focuses on core forecast display. Export/share adds complexity (PDF generation, image export, deep links) that is not critical for initial release.

**Future scope:** Image export, CSV export, deep link sharing (Phase 9+).

---

## Implementation Constraints

### Must display on every chart:
- Provider source attribution
- Issue time (when forecast was generated)
- Last updated time
- Data freshness indicator

### Must handle explicitly:
- Missing intervals (show gap, don't interpolate)
- Stale data (mark as stale, don't hide)
- Out-of-horizon data (don't display)

### Must NOT:
- Interpolate missing intervals
- Hide stale data
- Display >72h hourly data
- Display >3d daily data
- Show raw provider payload

---

## Data Flow

```
Phase 5 Weather Service
        ↓
Hourly/Daily Forecast Data
        ↓
Phase 7 Forecast Service (formatting, gaps)
        ↓
Trend Calculation Service
        ↓
Forecast API Response (DTO)
```

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-08-14 | Technical Owner | Initial decisions based on Phase 7 Decision Gate |
