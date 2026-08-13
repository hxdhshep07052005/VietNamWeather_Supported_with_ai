# Phase 6 Evidence — Config-Driven Weather Risk Engine

**Status:** IN_PROGRESS (LOCAL_IMPLEMENTATION_VERIFIED)
**Kickoff approval:** `RISK-001..007`
**Decision baseline:** `RISK-001`, `RISK-002`, `RISK-003`, `RISK-004`, `RISK-005`, `RISK-006`, `RISK-007`
**Validation date:** 2026-08-13
**Validator:** `pnpm run validate:stage6`

## Artifacts

| Evidence | Status | Artifact |
|---|---|---|
| Phase 6 Decisions | PASS_LOCAL | `PHASE_6_DECISIONS.md` |
| Decision Register | PASS_LOCAL | `DECISIONS.md` (RISK-001..007) |
| Status Update | PASS_LOCAL | `STATUS.md` |
| README Update | PASS_LOCAL | `README.md` |
| Risk Contracts | PASS_LOCAL | `packages/contracts/src/risk-v1.ts` |
| Risk Engine | PASS_LOCAL | `apps/api/src/risk/risk-engine.ts` |
| Risk Service | PASS_LOCAL | `apps/api/src/risk/risk-service.ts` |
| Unit Tests (30 tests) | PASS_LOCAL | `apps/api/test/risk-engine.test.mjs` |
| Database Schema | PASS_LOCAL | `infra/postgres/init/007-create-phase6-risk-engine.sql` |
| Directus Seed | PASS_LOCAL | `apps/directus/seeds/phase6-risk-default-rules.json` |
| Validation Script | PASS_LOCAL | `tools/validation/validate-stage6.ps1` |

## Validation Result

```
PHASE6_RISK_ENGINE_OK
  risk_levels=true
  risk_engine=true
  risk_service=true
  contracts=true
  database_schema=true
  seed_data=true
  tests_passed=true (30/30)
  risk_005_aggregation=true
  risk_006_stale_unknown=true
  risk_007_disclaimer=true
```

## Decision Gate Compliance

| Decision | Value | Evidence |
|---|---|---|
| `RISK-001.1` | 4 levels (Low/Caution/High/Unknown) | `risk-v1.ts:23-28` |
| `RISK-001.2` | Colors: Green/Yellow/Orange/Gray | `risk-v1.ts:47-55` |
| `RISK-002.1` | 6 dimensions | `risk-v1.ts:61-71` |
| `RISK-003.1` | Single common rule set (MVP) | `risk-engine.ts` |
| `RISK-004.1` | No official alerts in MVP | `risk-engine.ts` |
| `RISK-005.1` | Max severity aggregation | `risk-engine.ts:274-279` |
| `RISK-006.1` | Stale >60min/>24h → Unknown | `risk-engine.ts:250-253` |
| `RISK-007.1` | Vietnamese primary, English secondary | `risk-v1.ts:231-234` |

## Test Coverage

| Test Category | Cases | Status |
|---|---|---|
| Normal conditions (Low risk) | 3 | PASS |
| Caution threshold boundary | 2 | PASS |
| High risk threshold | 5 | PASS |
| Max severity aggregation | 3 | PASS |
| Unknown for stale data | 3 | PASS |
| Missing data handling | 2 | PASS |
| Confidence calculation | 2 | PASS |
| Determinism | 2 | PASS |
| Response format | 2 | PASS |
| Risk Scenarios | 6 | PASS |
| **TOTAL** | **30** | **PASS** |

## Seed Data

11 rules configured:
- 5 High severity rules (wind >15m/s, temp <5°C, temp >38°C, vis <1km, thunderstorm)
- 5 Caution severity rules (wind >10m/s, temp <10°C, temp >35°C, vis <5km, rain >10mm/h)
- 1 Heavy rain rule (rain >25mm/h → High)

## Security Checklist

- [x] No hardcoded thresholds in code
- [x] No hardcoded advisory text in code
- [x] Rules loaded from database
- [x] Deterministic output verified
- [x] Missing data never defaults to safe
- [x] Stale data returns Unknown
- [x] Disclaimer text in contracts

## Open Items

- Remote CI run pending
- Product Owner closure approval
- Database migration integration test
- Directus workflow configuration

## Dependencies for Phase 7

| Phase | Dependency |
|---|---|
| 7 | Forecast & Trends - requires risk assessment stability |
| 8 | Route Planner - uses risk level for route scoring |
| 9 | Frontend - uses typed risk DTO |
