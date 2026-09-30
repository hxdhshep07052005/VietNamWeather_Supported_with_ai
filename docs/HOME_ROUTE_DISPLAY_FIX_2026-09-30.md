# Home weather, route scores, and province borders

Date: 2026-09-30

## Home hover temperature

Home previously rendered placeholder weather and used an ambiguous province
abbreviation for selection. Ha Giang and Hau Giang both used HG. The displayed
update time was also a local ticking clock rather than a weather source time.

Home now reads the existing bulk province weather query. The SVG joins weather
by GIS ID, selection retains the province identity, and the tooltip shows the
measurement and its actual source time in UTC+7. Zero, loading, missing, older,
and error states are handled explicitly. A failed background refetch clears
the cached ready display instead of leaving stale values looking current.

The live public API and actual VietnamMap component were compared for all 63
provinces at 02:26:53 UTC. All names, temperatures, and source times matched.
Evidence: `artifacts/home-live-component-check.json`.

## Why Low routes can have scores of 64 and 66

The displayed ETA score remains the backend combined route score from the
report: `100 * (0.5 * R + 0.3 * T / max(T) + 0.2 * D / max(D))`.
Lower is better. The color describes weather risk, not a numeric score band.
No backend formula or route result was hardcoded or changed in this follow-up.

The live Hanoi to Lao Cai response at 02:27:35 UTC independently recomputes as:

| Alternative | Weather component | Time component | Distance component | Total |
| --- | ---: | ---: | ---: | ---: |
| Fastest | 16.6667 | 27.6369 | 20.0000 | 64.3036 |
| Shortest | 16.6667 | 30.0000 | 19.3206 | 65.9873 |
| Weather-Safer | 16.6667 | 27.6369 | 20.0000 | 64.3036 |

Weather-Safer uses the Fastest geometry for this request. All observed weather
samples are provisionally Low; strict risk remains Unknown because official
alert and storm evidence is incomplete. This is not a claim of full safety.
The cards now explain the combined score, with the weights in the tooltip and
accessible description. Evidence: `artifacts/route-score-live-check.json`.

## Route province border parity with Map

Route used the shared province geometry but retained static gray borders and
transparent fills without current weather properties. Map and Route now use
`provinceOverlay.ts` for the GIS-ID data join and the same zoom-dependent
fill/border styling. Route receives current general province weather through
`useReportProvinceWeather(0)`. The road line still represents vehicle-specific
weather at each checkpoint's ETA and is drawn above the province layer.

Style restoration now listens before style switches and reads current props.
This fixes both synchronous MapLibre style events and delayed loads after a
toggle or data update. An obsolete effect targeting nonexistent layers was
removed. The shared filtered-fill expression also keeps zoom interpolation at
the top level, as required by MapLibre's expression validator.

## Verification and remaining gap

- Full web suite: 90/90 tests in 14 files passed.
- Installed MapLibre paint validation and fill evaluation: 5/5 tests passed.
  The same regression first failed for Low, Caution, and High filtered fills.
- Targeted API route/provisional score suite: 14/14 tests passed.
- TypeScript and Vite production build passed; existing bundle-size warning.
- Component lifecycle tests cover synchronous/delayed basemap changes, live
  updates, toggle state, and province layers remaining below route layers.
- Two independent read-only source reviews passed after the expression fix
  (`route_overlay_corrected_integrity` and `home_route_source_precision`).
  Neither review claims browser or pixel verification.
- Browser access to localhost was denied earlier. No browser workaround was
  attempted. These are API, component, source, and expression checks; rendered
  pixels, mobile wrapping, and visual parity on the running page remain
  unverified. No visual PASS is claimed.

Logs: `artifacts/home-route-final-tests.log`,
`artifacts/home-route-final-build.log`,
`artifacts/route-score-formula-tests.log`,
`artifacts/province-expression-red.log`, and
`artifacts/province-expression-green.log`.
