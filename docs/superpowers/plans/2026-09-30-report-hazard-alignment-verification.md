# Hazard alignment — verification

## Commands executed against current source

- `cmd /c pnpm run test`: PASS. This builds all workspaces before running tests importing dist.
- API: 172 passed, including 12 report hazard/route tests.
- Worker: 35 passed.
- Frontend: 15 passed, including 2 report presentation tests.
- Config: 3 passed.
- Total: 225 passed.
- `cmd /c pnpm run typecheck`: PASS.

Initial build identified the geography-only VietnamMap model still excluding Unknown and unavailable temperature. Its type now permits Unknown and a display placeholder. Build and tests subsequently passed.

## Formula checks

Report boundary tests exercise Table 3.1 for both vehicles, storm/alert evidence, freshness and unavailable inputs. Route tests verify unequal-distance trapezoidal integration: distances [0,10000,30000,40000], severity [1,1,2,3] yield 13/24 normalized risk, 54 display points and High maximum. Low remains 1/3, never 0.14. Tests cover endpoint sampling, geometry preservation and Unknown exclusion from recommendations.

## Outstanding integration limitations

- These are source build/unit/dependency-fixture checks, not live DB/provider or browser end-to-end validation.
- Report thresholds are currently a versioned backend configuration in `apps/api/src/risk/report-rules-v1.ts`, not yet a published Directus ruleset. Directus-configurable rule publication remains incomplete relative to the approved spec.
- The persisted observation schema does not establish a precipitation measurement interval, so the adapter does not invent an hourly rate. The forecast query currently has no visibility field.
- Official alert evidence is not integrated, and provider condition codes do not distinguish distant versus direct thunderstorms. The adapter preserves these as unavailable. Consequently fully qualified six-dimensional scores remain Unknown with current inputs, even where some measurements exist.
- Legacy Phase 6 evaluator/tests and chatbot fallback behavior are not evidence that every risk consumer in the repository now follows the report. The report-specific weather/map/route path is separate.
- Report (2.6) distance weighting is used per approved spec rather than the different arithmetic point average in section 3.5.3. Report experimental values below 1/3 are not reproduced by invented scaling.

No claim of production readiness or complete removal of every mock elsewhere in the repository is made.
