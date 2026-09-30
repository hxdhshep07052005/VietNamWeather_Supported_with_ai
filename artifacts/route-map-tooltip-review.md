# Route map checkpoint popup - 2026-09-30

The supplied screenshot showed a single 300px-tall text block combining the
point name, temperature, full ETA, risk, and technical evidence reasons.

## Current presentation

- A compact tooltip separates point name and temperature, short arrival
  time/date, risk label, and provisional status.
- Full ETA, measurements, coverage and evidence remain in the weather
  timeline details; the map does not repeat the technical reasons.
- All displayed values remain from the selected checkpoint. Zero and missing
  temperatures are distinct. Unknown risk is never labelled safe.
- A 16px colored dot has a 44px button target. Marker transforms belong to
  MapLibre; removed legacy chip CSS cannot shift the geographic anchor.
- The tooltip clamps horizontally and flips vertically within the map,
  updating after map rendering. Long text wraps; small containers bound both
  dimensions without changing the route geometry.
- Hover, focus and selection reveal it. Escape dismisses hover-only and
  focused popups. Selection preserves focus when markers are rebuilt,
  including a focused checkpoint outside the usual sampled marker subset.

## Validation

- Failing-first popup integration regression: route-map-tooltip-red.log.
- Failing-first selection/focus regression: route-map-tooltip-focus-red.log.
- Full web suite: 106/106 tests in 16 files passed:
  route-map-tooltip-tests.log.
- TypeScript and Vite production build passed:
  route-map-tooltip-build.log. Existing bundle-size warning remains.
- DOM tests exercise actual popup construction, data propagation, short/full
  ETA preservation, safe text insertion, zero/missing measurements, risk
  variants, focus/hover/Escape, controlled selection and mocked map-edge
  rectangles. They do not prove browser pixels or layout.

## Remaining verification limit

Localhost browser access was denied earlier and was not bypassed. Only the
user's before screenshot was inspected. No post-change browser screenshot,
real rendered responsive verification, or visual PASS is claimed.
