# Plan — Split-pane `/map` with real-time province info panel

## Context

Today, [`apps/web/src/pages/MapPage.tsx`](apps/web/src/pages/MapPage.tsx) is a placeholder: a single centered map area surrounded by a hardcoded layer panel, hardcoded 4-swatch risk legend (`riskLow` / `riskCaution` / `riskHigh` / `riskUnknown`), a non-functional GPS button, and a footer that prints `--` for `lastUpdated`. None of it talks to the backend, none of it is interactive, and none of it reflects the production data model.

The user wants the page reshaped as a true split-pane: a left map, a right info pane that drives itself from live backend data, and the right panel must light up when the user hovers over a province on the map. The province's status (current weather, risk level, freshness, advisories) must come from real backend endpoints — no hardcoded values, no fake data. GSAP is the chosen animation toolkit; Three.js is not requested and is not in scope. Realtime must mean actual polling against the running API, not a placeholder timer.

## Constraints carried forward (verbatim)

- No hardcoded location, provider, risk threshold, route weight, quota, price, translation, feature flag, or secret in product code.
- No fake weather/payment/provider data to prove production readiness.
- Frontend only consumes request/response DTOs; no backend rule, credential, or Directus internal may leak into the bundle.
- Architectural/product-gate changes must update the relevant Decision ID, phase document, evidence manifest, status, and README where they affect overview.
- A phase may move to VERIFIED only when reproducible evidence exists.
- All secrets (`DB_PASSWORD`, `REDIS_PASSWORD`, `DIRECTUS_KEY`, `DIRECTUS_SECRET`, `API_SESSION_ENCRYPTION_KEY`, `API_CSRF_SIGNING_KEY`, `WEATHERAPI_API_KEY`, …) stay in `.env.local` / `.env.bootstrap.local` (gitignored); never committed, bundled, or pasted into chat.

## Critical findings from exploration (these shape the plan)

1. **The HTTP API is mostly not registered.** [`apps/api/src/server.ts`](apps/api/src/server.ts:438-522) only mounts `/health/*` and `/api/v1/auth/*`. The service modules exist — `apps/api/src/weather-service.ts`, `apps/api/src/weather-store.ts`, `apps/api/src/weather-cache.ts` live at `src/` root (no `apps/api/src/weather/` directory) alongside `forecast/`, `risk/`, `route/` submodules — but none of `weather.current`, `weather.capabilities`, `weather.forecast`, `risk.capabilities`, `risk.assessment`, `route.calculate` are wired into `createApiServer()`. The frontend's [`apps/web/src/api/client.ts`](apps/web/src/api/client.ts) calls all of these today and would 404.

2. **The contracts package already has every type the right panel needs.** [`packages/contracts/src/weather-v1.ts`](packages/contracts/src/weather-v1.ts) defines `WeatherCapabilities`, `WeatherQueryRequest`, `WeatherQueryResponse`, `CurrentWeatherSection`, `HourlyWeatherSection`, `DailyWeatherSection`, `WeatherFreshness`. [`packages/contracts/src/risk-v1.ts`](packages/contracts/src/risk-v1.ts) defines `RiskAssessmentRequest`, `RiskAssessmentResponse` (with `level`, `color`, `confidence_percent`, `freshness_state`, `triggered_rules_count`, `disclaimer`, `assessed_at`, `rule_set_version`), `RiskCapabilitiesResponse`. [`packages/contracts/src/forecast-v1.ts`](packages/contracts/src/forecast-v1.ts) defines `ForecastSeries`, `FRESHNESS_STATES`. The DB schema (`infra/postgres/init/004-create-phase4-data-model.sql`) maps directly: every field the right panel needs is a real column.

3. **`VietnamMap` does not yet expose `onProvinceHover`.** [`apps/web/src/components/common/VietnamMap.tsx`](apps/web/src/components/common/VietnamMap.tsx:15-19) only accepts `interactive` and `onProvinceClick`. The internal hover state lives at line 89. Lifting or proxying it is a prerequisite.

4. **Frontend types are still `unknown`.** [`apps/web/src/types/api.ts`](apps/web/src/types/api.ts) wraps everything in `data?: unknown`. The right-panel work needs concrete shapes — they should come from `@vietnam-weather/contracts`, not be re-declared.

5. **No SSE/WebSocket in the API.** Realtime = short-interval TanStack Query polling. Existing rate-limit budget: `API_RATE_LIMIT_WEATHER_MAX=20` per `API_RATE_LIMIT_WINDOW_MS=60000`. The right panel can safely poll per-province without breaching the budget (see "Realtime strategy" below).

6. **The 8-region legend in `VietnamMap.tsx:302-335` is hardcoded and Vietnamese-only.** For the right-panel work it stays as-is (it is a region legend, not a status legend). The risk legend must move out of `MapPage.tsx` and into the right panel driven by `RISK_COLORS` from contracts.

## Decision point: backend routes are not yet mounted

Two viable scopes:

| Option | Scope | Risk |
|---|---|---|
| A. Register `weather`, `risk`, `route` (and alerts/advisories) routes in `apps/api/src/server.ts` as part of this work, then wire the right panel to them. | Larger, but the only way to deliver "real backend data, no hardcoding". | Touches a backend file already in Phase 5/6 status. Requires evidence run + decision-id updates. |
| B. Limit the right panel to a strict "data unavailable" skeleton until the backend wires the routes. | Smaller, but violates the user's explicit instruction "luôn cập nhập realtime chứ không được hardcode". | Not acceptable. |

**Recommendation: Option A.** The service modules already exist (`forecast-service.ts`, `risk-service.ts`, `route-service.ts`); the missing piece is registration in `createApiServer()`. Without it, no plan here can honor "realtime, no hardcoding." The plan below includes the route-registration step and notes the evidence artifacts it must produce.

## Deliverables

### Layout: `MapPage` becomes a 2-column CSS grid

- New structure in [`apps/web/src/pages/MapPage.tsx`](apps/web/src/pages/MapPage.tsx): `<main className={styles.split}>` containing `<section className={styles.mapPane}>` (left) and `<aside className={styles.infoPane}>` (right).
- [`apps/web/src/pages/MapPage.module.css`](apps/web/src/pages/MapPage.module.css): change from single-column to `grid-template-columns: minmax(0, 1fr) minmax(360px, 420px)` at `>= 1024px`, single column with `mapPane` first at `< 1024px`. The right pane is `position: sticky; top: var(--header-height); align-self: start; max-height: calc(100vh - var(--header-height)); overflow-y: auto;` so it stays visible during scroll on desktop.
- Keep the existing header (title + search) as a full-width band above the grid. Drop the GPS button, layer panel, and footer; they belong either in the map pane (as floating overlays) or are simply removed for now — the user's brief is map + info pane, not a layer panel.

### `VietnamMap` exposes hover state

In [`apps/web/src/components/common/VietnamMap.tsx`](apps/web/src/components/common/VietnamMap.tsx):

```ts
interface VietnamMapProps {
  className?: string;
  interactive?: boolean;
  onProvinceClick?: (province: { id: string; name: string; code: string; region: string }) => void;
  onProvinceHover?: (province: { id: string; name: string; code: string; region: string } | null) => void;
  selectedProvinceId?: string | null;          // visual selection from the right panel
  highlightProvinceId?: string | null;        // hover highlight
}
```

- `onMouseEnter` on each `<path>` calls `onProvinceHover({...})`; `onMouseLeave` calls `onProvinceHover(null)`.
- Keep the existing internal `hoveredProvince` state for the floating SVG label + tooltip; merge it with the `highlightProvinceId` prop so a province can be highlighted by either hover-from-outside or hover-on-map.
- Drop the in-component region legend (it is now decorative noise relative to the user's request) — the right panel carries risk status; the region palette becomes a background gradient only.

### Right pane: `<ProvinceInfoPanel />`

New component at [`apps/web/src/components/map/ProvinceInfoPanel.tsx`](apps/web/src/components/map/ProvinceInfoPanel.tsx) plus `.module.css`. Sections, top to bottom:

1. **Header** — province name (i18n), official code, region label. Empty state when no province is hovered: a localized "hover a province to see status" placeholder (no hardcoded strings).
2. **Status pill** — risk level (`RISK_LEVELS` → localized label), color from `RISK_COLORS`. Subtitle shows `confidence_percent` and `freshness_state`. Skeleton when loading; explicit "no data" message when the API returns `pending`/`unavailable`/`error` — never a fake value.
3. **Current weather** — temperature, feels-like, humidity, wind speed + direction, precipitation, pressure, visibility, UV, cloud cover, condition code mapped to localized text. Each value rendered with `<Metric label="…" value={…} unit={…} />` so null/missing fields render as a localized em-dash, not as `0`.
4. **Forecast strip** — next 6 hourly points + next 3 daily points pulled from the same `WeatherQueryResponse` when the panel requested `include: ["current","hourly","daily"]`. Use `formatDisplayTime` / `formatDisplayDate` from `forecast-v1.ts` for ICT timestamps.
5. **Risk breakdown** — list of triggered rules from `RiskAssessmentResponse.triggered_rules` (dimension, actual vs threshold, severity). When none triggered, show a localized "no rules triggered" line.
6. **Advisories** — pull `risk.advisories` (see step 3 below for the new endpoint). Each advisory renders title + body (resolved from `translations` rows keyed by `title_translation_key` / `body_translation_key`). Empty state when none.
7. **Attribution + freshness** — `provider` name, `attribution.name` + URL from contracts, `assessed_at` timestamp formatted in ICT, and the standard `RISK_DISCLAIMERS` line per language.

CSS uses CSS variables from [`apps/web/src/styles/`](apps/web/src/styles) — no inline hex codes, no hardcoded colors. Use the existing `--color-risk-low/--color-risk-caution/--color-risk-high/--color-risk-unknown` tokens; add `--color-risk-unknown` if missing.

### Real backend data plumbing

**Step 1 — Replace `apps/web/src/types/api.ts` with concrete contracts.** Delete the `data?: unknown` wrappers in [`apps/web/src/types/api.ts`](apps/web/src/types/api.ts) and re-export the contract shapes that match the eventual API response:

```ts
export type {
  WeatherQueryRequest,
  WeatherQueryResponse,
  WeatherQueryData,
  WeatherCapabilities,
  RiskAssessmentRequest,
  RiskAssessmentResponse,
  RiskCapabilitiesResponse,
} from "@vietnam-weather/contracts";
```

This keeps `ARCH-003` ("frontend only consumes DTOs; no backend imports") satisfied because the contracts package is a published DTO boundary, not a backend import.

**Step 2 — Extend `apps/web/src/api/client.ts` to match the contract shapes.** Replace the current `weatherApi.getCapabilities`/`getCurrentWeather`/`getForecast`, `riskApi.getCapabilities`/`getAssessment`, `routeApi.calculateRoutes` signatures with:

```ts
weatherApi.getCapabilities(): Promise<WeatherCapabilitiesApiResponse>;
weatherApi.query(req: WeatherQueryRequest): Promise<WeatherQueryResponse>;
riskApi.getCapabilities(): Promise<RiskCapabilitiesResponse>;
riskApi.assess(req: RiskAssessmentRequest): Promise<RiskAssessmentResponse>;
riskApi.listAdvisories(locationId: string): Promise<{ status: "success"; data: readonly Advisory[] }>;
routeApi.calculate(req: RouteCalculateRequest): Promise<RouteCalculateResponse>;
```

All `fetch` calls go through the same `ApiClient.request()`; no logic added there. Add a thin `advisoryApi` namespace.

**Step 3 — Register the missing HTTP routes in `apps/api/src/server.ts`.** Concretely, the new routes:

| Method | Path | Service module | Contract |
|---|---|---|---|
| GET | `/api/v1/weather/capabilities` | existing `apps/api/src/weather-service.ts` (wrap in `apps/api/src/weather/index.ts` barrel) | `WeatherCapabilitiesResponse` |
| POST | `/api/v1/weather/query` | same module | `WeatherQueryResponse` |
| GET | `/api/v1/risk/capabilities` | [`apps/api/src/risk/risk-service.ts`](apps/api/src/risk/risk-service.ts) (`getCapabilities()`) | `RiskCapabilitiesResponse` |
| POST | `/api/v1/risk/assessment` | risk-service (`assess()`) | `RiskAssessmentResponse` |
| GET | `/api/v1/risk/advisories?location_id=…` | new `advisory-service.ts` reading `risk_advisories` + `translations` rows | `AdvisoryListResponse` |
| POST | `/api/v1/route/calculate` | route-service | `RouteCalculateResponse` |

Each route uses `requireAuth` (where the user must be logged in) or no auth (capabilities endpoints) per the contract's documented auth posture. Rate-limit defaults apply (`config.defaultRateLimitMax = 120 / 60s`); the `weather/query` and `risk/assessment` routes opt into the tighter `weatherRateLimitMax` (20 / 60s) per existing config.

A new `apps/api/src/weather/` module must be authored — the directory does not exist. It will:

- Own a `WeatherService` that reads from `weather_observations` (current) and `weather_forecasts` (hourly/daily) by `location_id`.
- Map DB rows to the contract shapes (the column names already match: `temperature_celsius`, `wind_speed_mps`, `humidity_percent`, `precipitation_mm`, `wind_direction_degrees`, `pressure_hpa`, `visibility_meters`, `uv_index`, `cloud_cover_percent`, `condition_code`).
- Compute `WeatherFreshness` from `expires_at` vs `assessed_at` per `FreshnessPolicy` in the contract.
- Use the worker health endpoint `:8081/ready` as the upstream source-of-truth — no hardcoded weather.

**Step 4 — Province → location_id lookup.** The right panel needs a `location_id` (UUID) per province to call the API. The 34 provinces in `@xdev-asia/vietnam-map-34-provinces` expose `external_key` strings (e.g. `"VN-HN"`) but not UUIDs. Add a tiny `apps/web/src/data/provinceLocations.ts` that maps `external_key → location_id` and `external_key → {name_vi, name_en, region}`. **The file is data, not code**: it is populated from `select external_key, id, canonical_name, ascii_name from locations where location_type = 'province'` and shipped as a typed JSON module, with a runtime assertion that fetches `/api/v1/locations/provinces` once at app start (new endpoint, see step 3) and warns when the bundled map diverges. No hardcoded IDs in component code.

### TanStack Query hooks

New file [`apps/web/src/hooks/useProvinceData.ts`](apps/web/src/hooks/useProvinceData.ts):

```ts
useProvinceCapabilities(code)        // staleTime 6h
useProvinceWeather(code)             // refetchInterval 30_000ms
useProvinceRisk(code)                 // refetchInterval 60_000ms
useProvinceAdvisories(code)           // refetchInterval 120_000ms
```

`useProvinceWeather` calls `weatherApi.query({ target: { locationId }, include: ["current","hourly","daily"] })`. `useProvinceRisk` calls `riskApi.assess({ location_id, include_triggered_rules: true, language: i18n.language })`. All hooks share a `queryKey` factory `["province", code, "weather"]` etc. so cache invalidation on language change is `queryClient.invalidateQueries({ queryKey: ["province"] })`.

When the response status is `pending` / `unavailable` / `error`, the hook returns a discriminated union that the right panel renders as the explicit empty/error state — never a fabricated fallback.

### Realtime strategy (with budget math)

The API global cap is 120 requests / 60s; the dedicated weather cap is 20 / 60s. A single user hovers at most 2-3 provinces in a 60s window (map hover + click-to-pin + occasional wander). Per-province load:

- Capabilities: 1 call, cached 6h, **not counted toward the per-minute budget** (TanStack Query serves from cache after the first hit).
- Weather query: 1 call every 30s while the panel is mounted.
- Risk assessment: 1 call every 60s.
- Advisories: 1 call every 120s.

For a panel pinned on one province, worst case = `1 + 2 + 1 + 0.5 ≈ 4.5` calls / 60s, well under the 20 cap. When the user hovers 3 provinces in succession, each unmounts its old query (TanStack cancels in-flight) and mounts the new; in practice the panel debounces hover-by-150ms so the user must linger to trigger a fetch, eliminating thrash. Document this in a code comment at the top of `useProvinceData.ts`.

### GSAP animation

Use the already-installed `gsap@3.15.0`. No Three.js — not requested, not appropriate for a 2D panel.

- **Panel mount/transition on province change**: `gsap.fromTo(panelRoot, { autoAlpha: 0, x: 24 }, { autoAlpha: 1, x: 0, duration: 0.32, ease: "power3.out" })`. Trigger on `selectedProvinceId` change.
- **Status pill pop-in**: `gsap.fromTo(pill, { scale: 0.92 }, { scale: 1, duration: 0.45, ease: "back.out(1.7)" })` on every new risk assessment.
- **Map province hover highlight**: keep the existing CSS-driven highlight, but add `gsap.to(pathEl, { fillOpacity: 0.95, duration: 0.18, overwrite: "auto" })` for smoother crossfades when the user sweeps the mouse.
- **Skeleton shimmer**: CSS keyframe (no GSAP needed) for the loading skeleton. No animation library code paths required for skeletons.
- **Reduced motion**: wrap every `gsap.fromTo` / `gsap.to` call in `prefersReducedMotion()` from the new `apps/web/src/hooks/usePrefersReducedMotion.ts`; on `true`, set `duration: 0` and skip.

GSAP registration lives in `apps/web/src/main.tsx` already (per the package's presence in `apps/web/package.json`). No new dependency.

### i18n

Add to both [`apps/web/src/i18n/locales/en.json`](apps/web/src/i18n/locales/en.json) and `vi.json` under `infoPanel.*`:

- `header.placeholder`, `header.code`, `header.region`
- `status.loading`, `status.unavailable`, `status.error`, `status.freshness.{fresh,stale,expired,unavailable}`, `status.confidence`
- `weather.*` (labels and `condition.*` for the condition code map)
- `forecast.hourly`, `forecast.daily`, `forecast.nextHours`, `forecast.nextDays`
- `risk.dimensions.{precipitation,wind,temperature,visibility,storm,alert}`, `risk.none`, `risk.disclaimer`, `risk.assessed`
- `advisories.title`, `advisories.empty`
- `attribution.provider`, `attribution.lastUpdated`

No hardcoded English/Vietnamese strings inside components — every label goes through `t(...)`.

## Critical files to modify

| File | Change |
|---|---|
| [`apps/web/src/pages/MapPage.tsx`](apps/web/src/pages/MapPage.tsx) | Replace placeholder with split-pane shell, hold `hoveredProvince` + `selectedProvinceId` state, pass callbacks into `<VietnamMap>` and `<ProvinceInfoPanel>`. |
| [`apps/web/src/pages/MapPage.module.css`](apps/web/src/pages/MapPage.module.css) | Add 2-column grid + responsive collapse. |
| [`apps/web/src/components/common/VietnamMap.tsx`](apps/web/src/components/common/VietnamMap.tsx) | Add `onProvinceHover`, `selectedProvinceId`, `highlightProvinceId` props; lift hover state; drop in-component legend. |
| [`apps/web/src/components/common/VietnamMap.module.css`](apps/web/src/components/common/VietnamMap.module.css) | Drop `.legend` styles or leave dormant (unused). |
| [`apps/web/src/components/map/ProvinceInfoPanel.tsx`](apps/web/src/components/map/ProvinceInfoPanel.tsx) (new) | The right pane. |
| [`apps/web/src/components/map/ProvinceInfoPanel.module.css`](apps/web/src/components/map/ProvinceInfoPanel.module.css) (new) | Section + metric styling using `--color-*` tokens. |
| [`apps/web/src/api/client.ts`](apps/web/src/api/client.ts) | Replace `unknown` payloads with concrete contracts; add `advisoryApi`. |
| [`apps/web/src/types/api.ts`](apps/web/src/types/api.ts) | Re-export concrete shapes from `@vietnam-weather/contracts`; delete `unknown` envelopes. |
| [`apps/web/src/hooks/useProvinceData.ts`](apps/web/src/hooks/useProvinceData.ts) (new) | TanStack Query hooks with documented polling budget. |
| [`apps/web/src/hooks/usePrefersReducedMotion.ts`](apps/web/src/hooks/usePrefersReducedMotion.ts) (new) | `window.matchMedia('(prefers-reduced-motion: reduce)')` hook. |
| [`apps/web/src/data/provinceLocations.ts`](apps/web/src/data/provinceLocations.ts) (new) | Province → location_id map (data, populated from `/locations/provinces`). |
| [`apps/web/src/i18n/locales/en.json`](apps/web/src/i18n/locales/en.json), `vi.json` | Add `infoPanel.*` keys. |
| [`apps/api/src/server.ts`](apps/api/src/server.ts) | Register `/weather/*`, `/risk/*`, `/route/*`, `/locations/provinces`, `/risk/advisories` routes; honor rate-limit settings. |
| `apps/api/src/weather/index.ts` (new), `apps/api/src/weather/types.ts` (new) | Barrel + typed surface over existing `weather-service.ts` / `weather-store.ts` / `weather-cache.ts` (no rewrite of service logic). |
| `apps/api/src/risk/advisory-service.ts` (new) | New advisory service reading `risk_advisories` + `translations`. |
| `apps/api/src/weather/README.md`, `apps/api/src/risk/README.md`, `apps/api/src/route/README.md` | Update "status: implemented" + add evidence run command per Phase governance. |
| `infra/postgres/init/005-create-phase5-weather-runtime.sql` and related | **No SQL change** — schema is already complete from Phase 4 evidence. Confirm by re-reading; do not duplicate. |
| Top-level `README.md` | Add Phase 9 frontend split-pane to overview if not present. |

## Existing utilities to reuse (do not re-author)

- `@vietnam-weather/contracts` for every DTO (`RISK_LEVELS`, `RISK_COLORS`, `RISK_DISCLAIMERS`, `WeatherQueryResponse`, `RiskAssessmentResponse`, `FreshnessState`, `formatDisplayTime`, `formatDisplayDate`).
- `apps/web/src/api/client.ts` `ApiClient` class — only add methods, do not fork fetch.
- `apps/web/src/components/common/VietnamMap.tsx` d3-geo projection + region palette — only add the props.
- i18next `useTranslation` already in `MapPage.tsx`.
- GSAP — already a dependency.

## Verification

End-to-end checklist (all reproducible from a clean checkout after the changes):

1. **Typecheck** — `pnpm --filter @vietnam-weather/web typecheck` exits 0.
2. **Build** — `pnpm --filter @vietnam-weather/web build` succeeds.
3. **Lint** — `pnpm --filter @vietnam-weather/web lint` clean.
4. **API smoke** — with the local Docker stack up, `curl -s http://localhost:8080/health/ready` returns `status: "ready"`. `curl -s http://localhost:8080/api/v1/weather/capabilities` returns a `WeatherCapabilitiesResponse` (proves new route is mounted). `curl -s -X POST http://localhost:8080/api/v1/risk/assessment -H 'content-type: application/json' -d '{"location_id":"<seeded-id>","language":"en","include_triggered_rules":true}'` returns a `RiskAssessmentResponse` whose `level` is one of the four `RISK_LEVELS` values and whose `color` matches `RISK_COLORS[level]`. `curl -s "http://localhost:8080/api/v1/risk/advisories?location_id=<seeded-id>"` returns a list (empty array allowed; shape validated).
5. **Frontend dev** — `pnpm --filter @vietnam-weather/web dev` (already running on `:3000` with `VITE_API_URL=http://localhost:8080`).
6. **Hover interaction** — Open `http://localhost:3000/map`. Hover Hà Nội: right panel renders "Hà Nội", risk pill animates in (GSAP), current weather shows real values, forecast strip populates, advisories list (or empty). Hover Hồ Chí Minh: panel cross-fades (GSAP). Confirm no console errors. Confirm `lastUpdated` reflects `assessed_at` (no `--`).
7. **Reduced motion** — toggle OS-level reduced motion; verify panels still update but without slide/scale.
8. **Empty states** — point `VITE_API_URL` at a port returning 404; verify right panel shows `infoPanel.status.error` (localized) instead of fabricated values.
9. **Rate-limit compliance** — open DevTools network panel; hover 5 provinces within 60s; count distinct `weather/query` + `risk/assessment` calls. Expect ≤ 5 weather + ≤ 5 risk = 10 calls, well under 20.
10. **No hardcode grep** —
    - `grep -rnE 'riskLow|riskCaution|riskHigh|riskUnknown' apps/web/src` returns no new matches (old `MapPage.tsx` removed).
    - `grep -rnE '#22C55E|#EAB308|#F97316|#9CA3AF' apps/web/src` returns nothing — risk colors must come from `RISK_COLORS`, not literals.
    - `grep -rnE '"--"|"--°C"|"--%"|"-- km/h"' apps/web/src` returns nothing — no placeholder strings.
    - `grep -nE '(API_BASE_URL|baseUrl).*=.*localhost|http://localhost:[0-9]' apps/web/src` — only matches `vite.config.ts` proxy and `import.meta.env.VITE_API_URL` reads; no hardcoded URL in product code.
11. **Evidence artifacts** — `apps/api/src/weather/README.md` and `apps/api/src/risk/README.md` updated with the curl outputs from step 4 (saved as evidence). Decision IDs: `UI-009` (split-pane layout), `UI-010` (hover → panel wiring), `API-009` (weather routes), `API-010` (advisories route) — recorded in `docs/decisions/` if the registry requires.
12. **Phase gate** — only after steps 1-11 succeed, mark Phase 9 frontend as `VERIFIED` in `apps/web/README.md` and any status doc. Do **not** mark VERIFIED before evidence is saved.
