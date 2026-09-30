# Report Hazard Alignment Implementation Plan

**Goal:** Implement the approved report matrix and honest evidence-driven Weather, Map and Route assessments.

**Architecture:** A versioned backend report ruleset evaluates six discrete dimensions. One database weather-evidence adapter supplies coordinate/time matching to point and route assessments; frontend consumes assessments and never computes hazards. Unknown has severity code 0 and nullable score, never a safe numeric score.

**Tech Stack:** TypeScript, Fastify, PostgreSQL/PostGIS, React, Node test runner, Vitest, pnpm.

**Spec:** `docs/superpowers/specs/2026-09-30-report-hazard-alignment.md` (explicitly approved by user).

**Execution:** Inline execution requested by user; no subagent tool available. No commits. Preserve existing unrelated dirty work. Never read secret files.

## Global constraints

- Table 3.1 thresholds only; no invented severity, weather, thresholds, penalties or confidence.
- Unknown = 0, Low = 1, Caution = 2, High = 3. Unknown score = null.
- Point and route levels use MAX; full-route score requires all eligible samples and strictly increasing distances.
- Route score is distance-weighted trapezoidal severity / 3 (report 2.6), deliberately not the unweighted point average mentioned in 3.5.3.
- Current Fresh <=60 min, Aging <=180 min, Stale >180 min; forecast issue age <=24h; honor record expiration/status as additional eligibility constraints. Aging retains a reduced-reliability label, without numeric penalty.
- Sampling includes endpoints, distance gaps <=5km, time gaps <=15min. ETA matching uses hourly validity intervals and <=15km spatial coverage.
- No city default vehicle; missing vehicle yields Unknown.

## Task 1 — Backend matrix and evidence contract

Files: create `packages/contracts/src/report-hazard-v1.ts`, export from `packages/contracts/src/index.ts`; create `apps/api/src/risk/report-rules-v1.ts`, `apps/api/src/risk/report-hazard.ts`, `apps/api/src/risk/weather-evidence.ts`; test `apps/api/test/report-hazard.test.mjs`.

- [ ] Define `ReportAssessment` with level, severity, nullable normalized/display score, freshness, coverage, reasons, source, ruleset version and six evidence entries; define explicit vehicle and storm classifications.
- [ ] Encode Table 3.1 as versioned configuration, evaluate High before inclusive temperature Caution ranges, and require complete evidence to publish a score.
- [ ] Query actual public weather tables: forecasts containing target ETA, observations only for current/past targets within the report age window, PostGIS geography distance <=15000m. Convert gust m/s to km/h and hourly accumulation to mm/h. Preserve missing alert/storm/forecast visibility.
- [ ] Boundary tests include both vehicles, all rain/gust/visibility/temperature boundaries, explicit none versus unavailable storm/alert, stale, missing ruleset and max aggregation.

## Task 2 — Route aggregation, sampling and real alternatives

Files: modify `packages/contracts/src/route-v1.ts`, `apps/api/src/route/route-risk-engine.ts`, `apps/api/src/route/route-sampler.ts`, `apps/api/src/route/route-service.ts`, `apps/api/src/route/routing-service.ts`, `apps/api/src/route/routes.ts`; test `apps/api/test/report-route.test.mjs`.

- [ ] Pass vehicle into every assessment; attach assessment to every sample. Remove Phase-rule mismatch and all mock risk/weather fallbacks.
- [ ] Interpolate sparse geometry at both report sampling limits, include exact endpoints; reject invalid/zero-length geometry.
- [ ] Aggregate adjacent points by `sum(delta*(s0+s1)/2)/sum(delta)/3`. Validate `[0,10000,30000,40000] / [1,1,2,3] => 13/24`, all Low =>1/3, High=>1, missing=>null.
- [ ] Evaluate provider routes once, label actual fastest/shortest/lowest-risk candidates without altering metrics. Normalize balanced score by maxima across alternatives; exclude Unknown from recommendations.
- [ ] Validate public route input and preserve nullable scores through response schemas.
- [ ] Test fake DB matching/error responses, ETA query parameters, sparse sampling, zero distance, label invariance and unknown recommendations using explicit dependency fixtures.

## Task 3 — Weather/Map integration and frontend evidence

Files: modify `apps/api/src/risk/risk-service.ts`, `apps/web/src/api/client.ts`, `apps/web/src/types/api.ts`, `apps/web/src/data/vietnamGeoJsonWGS84.ts`, `apps/web/src/utils/weatherSimulation.ts`, `apps/web/src/pages/WeatherPage.tsx`, `apps/web/src/pages/MapPage.tsx`, `apps/web/src/pages/RoutePlannerPage.tsx`, `apps/web/src/components/province/ProvinceStatusDetail.tsx`; create `apps/web/src/hooks/useProvinceWeather.ts`, `apps/web/src/utils/reportRisk.ts`, `apps/web/src/utils/reportRisk.test.ts`. Update directly affected rendering consumers if nullable data requires it.

- [ ] Expose validated coordinate/time/optional-vehicle backend report endpoint using the shared adapter; return measurements and evidence with explicit missing reasons.
- [ ] Replace province simulation with real endpoint requests and loading/error/Unknown states. Retain geographic metadata only; city risk has no implicit vehicle.
- [ ] Remove continuous frontend scoring and fabricated timeline/rain probability/weather detail. Render missing values as unavailable.
- [ ] Remove route demo startup and API-error fallback, fabricated checkpoint weather and exposure; display backend Unknown and actual checkpoint counts, never static 0/6, 2/6, 4/6 or absolute-safe claims.
- [ ] Frontend tests cover nullable formatting and risk mapping; source searches verify removed production fallbacks.

## Task 4 — Verification and limitations

Files: create `docs/superpowers/plans/2026-09-30-report-hazard-alignment-verification.md`; update this checklist.

- [ ] Run `pnpm run build` before Node tests importing dist; then `pnpm run typecheck`.
- [ ] Run `node --test apps/api/test/report-hazard.test.mjs apps/api/test/report-route.test.mjs` and relevant existing route/risk tests, distinguishing older Phase contracts from report behavior.
- [ ] Run frontend `pnpm --filter @vietnam-weather/web test` (confirm package script/name before execution).
- [ ] Inspect scoped diff/check whitespace. Record exact results and live DB/provider verification limitations, forecast visibility and alert/storm source gaps, ETA interpolation assumption, and report formula distinction.
