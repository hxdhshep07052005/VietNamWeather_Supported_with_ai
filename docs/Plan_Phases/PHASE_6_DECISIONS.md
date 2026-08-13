# Phase 6 Decision Gate — Weather Risk Engine

**Date:** 2026-08-13
**Status:** APPROVED
**Approved by:** Product Owner
**Decision IDs:** `RISK-001` through `RISK-007`

## Decision Gate Summary

Phase 6 implements a config-driven weather risk engine. This document records all product decisions required before implementation. Decisions are binding and cannot be changed without a new decision ID and migration plan.

---

## RISK-001 — Risk Levels

| Level | Display Name | Color | Semantic Meaning |
|-------|--------------|-------|-----------------|
| 1 | Low | 🟢 Green `#22C55E` | Weather conditions are favorable for travel |
| 2 | Caution | 🟡 Yellow `#EAB308` | Be aware of weather conditions; minor disruptions possible |
| 3 | High | 🟠 Orange `#F97316` | Significant weather impact expected; reconsider travel |
| 4 | Unknown | ⚪ Gray `#9CA3AF` | Insufficient data or data quality too poor to assess |

**Ruling:** 4 levels (Low/Caution/High/Unknown) — no "Safe" or "Danger" absolute statements.
**Source:** WHO travel health guidelines, common industry practice.
**Trade-off:** Unknown is not Low; missing data never defaults to safe.

---

## RISK-002 — Risk Dimensions

| Dimension | Weather Fields | Unit | Notes |
|-----------|---------------|------|-------|
| Precipitation | rain, drizzle, snow, thunderstorm | mm/h | Heaviest condition wins |
| Wind | wind_speed | m/s | Gusts considered if available |
| Temperature | temp_c | °C | Extreme cold (<5°C) and extreme heat (>38°C) |
| Visibility | vis_km | km | <1km is High risk |
| Storm | thunderstorm presence | boolean | Immediate High risk |
| Official Alert | NCHMF/VNDMC alerts | N/A | If available, overrides to High |

**Ruling:** MVP uses these 6 dimensions; official alerts deferred to Phase 10+.
**Source:** WeatherAPI capabilities + Vietnam climate norms.

---

## RISK-003 — Activity/Context Classification

**Ruling:** MVP uses a **single common rule set** for all travel contexts.
**Rationale:** Simpler to implement, validate, and maintain. Activity-specific rules can be added in a future phase if user research shows need.
**Future scope:** City travel, Beach, Mountain, Road travel contexts (not in MVP).

---

## RISK-004 — Official Authority Alerts

**Ruling:** MVP does **NOT** integrate official alerts from NCHMF/VNDMC.
**Rationale:** MVP focuses on weather data; official alert integration requires legal agreements and API access that are out of scope.
**Future scope:** Phase 10+ if needed.

---

## RISK-005 — Aggregation Method

**Ruling:** **Priority-based max severity** — the highest severity triggered rule wins.
**Formula:**
```
risk_level = MAX(triggered_rules.severity)
```
**Tie-breaker:** Higher priority number wins (lower number = higher priority).
**Rationale:** Deterministic, easy to explain, aligns with "worst case" safety principle.
**Trade-off:** Does not provide weighted scores; each dimension is binary pass/fail.

---

## RISK-006 — Unknown/Unknown Threshold

| Data State | Risk Level | Rationale |
|------------|------------|-----------|
| Fresh data, all fields present | Normal evaluation | Use triggered rules |
| Fresh data, some fields missing | Elevated level + evidence note | Confidence reduced |
| Stale data (>60min current, >24h forecast) | Unknown | Cannot trust stale data |
| No data / service unavailable | Unknown | No basis for assessment |

**Ruling:** Missing or stale data never defaults to Low/Caution — it escalates to Unknown.
**Rationale:** Safety-first principle; better to say "unknown" than give false confidence.

---

## RISK-007 — Disclaimer and Advisory Language

**Ruling:**
- Primary language: **Vietnamese** (`vi`)
- Secondary language: **English** (`en`)
- Display location: Shown on every risk/weather response
- Disclaimer text (Vietnamese):
  > "Thông tin thời tiết chỉ mang tính tham khảo. Không thay thế cảnh báo chính thức từ cơ quan chức năng. Quyết định du lịch cuối cùng thuộc về bạn."
- Disclaimer text (English):
  > "Weather information is for reference only. Does not replace official advisories from authorities. Final travel decisions are yours."

**Rationale:** WeatherAPI free tier requires attribution; Vietnam regulations require safety disclaimers.

---

## Implementation Constraints

### Must NOT contain in code:
- Hardcoded thresholds (all thresholds in Directus `risk_rules` table)
- Advisory text (all text in Directus `risk_rule_translations`)
- Business logic about what constitutes "High" risk

### Must contain in code:
- Evaluation engine that reads rules from database
- Aggregation logic (max severity)
- Freshness checking (delegate to Phase 5 contracts)
- Audit logging for rule evaluation

### Data flow:
```
Weather Data (Phase 5) → Risk Engine → Risk Assessment
                              ↓
                    Directus risk_rules (config)
                              ↓
                    Risk Assessment Output (DTO)
```

---

## Baseline Thresholds (MVP)

These are **example defaults only** — final values will be in Directus seed:

| Dimension | Operator | Threshold | Severity |
|-----------|----------|-----------|----------|
| wind_speed | > | 15 m/s | High (3) |
| wind_speed | > | 10 m/s | Caution (2) |
| temp_c | < | 5 | High (3) |
| temp_c | > | 38 | High (3) |
| temp_c | < | 10 | Caution (2) |
| temp_c | > | 35 | Caution (2) |
| vis_km | < | 1 | High (3) |
| vis_km | < | 5 | Caution (2) |
| thunderstorm | = true | - | High (3) |
| rain | > | 10 mm/h | Caution (2) |
| rain | > | 25 mm/h | High (3) |

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-08-13 | Technical Owner | Initial decisions based on Phase 6 Decision Gate |
