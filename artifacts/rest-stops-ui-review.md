# Rest stops presentation review - 2026-09-30

## Changes

- Separate named OpenStreetMap rest stops from weather samples. Rest stops
  remain explicitly scoped to the fastest route and do not invent ETA data.
- Show name, rounded distance from departure, and a map link. Three stops
  appear initially; a native disclosure reveals additional real stops.
- Keep unavailable and successful empty responses distinct with short copy.
- Weather rows show location, distance, arrival time/date, temperature and
  written risk. Provisional and insufficient-data status remain visible.
- Closed details retain full ETA, rain, wind, score, route coverage, and
  original evidence notes. Opening details does not select the map point.
- Replace clickable divs with actual buttons; preserve the existing theme,
  focus, type, spacing and risk palettes. Narrow containers stack the row.

## Evidence

- Route integration tests first failed 3 cases against the old presentation:
  `artifacts/rest-stops-ui-red.log`.
- Full web suite: 95/95 tests in 15 files passed:
  `artifacts/rest-stops-ui-tests.log`.
- TypeScript and Vite production build passed:
  `artifacts/rest-stops-ui-build.log`. Existing bundle-size warning remains.
- Tests exercise disclosure visibility, additional stops, missing data,
  zero values, point selection/deselection, keyboard tab order, and Enter on
  the point-selection button. The installed user-event library does not
  synthesize native summary activation on Enter; summary open/close is
  checked via clicks, retaining the browser-native implementation.
- Independent content/layout source review passed, including calculated
  contrast above 4.5:1 for risk labels in both themes. Its adjacent tooltip
  wording finding was corrected from a rest stop to a weather point.

## Verification limit

Browser localhost access was denied earlier. No workaround was attempted.
DOM/source review does not verify rendered layout, real browser keyboard
disclosure activation, or pixels at desktop/mobile widths. No rendered
visual PASS or Lighthouse result is claimed.
