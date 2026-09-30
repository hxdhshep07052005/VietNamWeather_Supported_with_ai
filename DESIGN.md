# Vietnam Weather Design System

## 1. Atmosphere & Identity

An information-dense weather dashboard with blue navigation, rounded panels,
and explicit weather risk colors. Preserve the existing visual language when
improving individual components. Weather values and their units should be easy
to scan independently of the risk assessment.

## 2. Color

The source palette is `apps/web/src/styles/tokens.css`; dark surface and text
overrides live in `apps/web/src/styles/global.css`.

- Surfaces: `--color-surface`, `--color-background`, `--color-background-alt`.
- Text: `--color-text-primary`, `--color-text-secondary`.
- Borders: `--color-border`; primary action: `--color-primary`.
- Weather warning rows reuse the existing WeatherPage badge palette through
  component-scoped tokens: `--warning-text`, `--warning-surface`,
  `--warning-border`, and `--warning-accent`.
- Caution: light text #a16207, surface #fef9c3, border #fde047; dark text
  #fbbf24 with #f59e0b at 15% / 35% for surface / border.
- High risk: light text #b91c1c, surface #fee2e2, border #fca5a5; dark text
  #fca5a5 with #ef4444 at 15% / 35% for surface / border. The lighter dark-mode
  text keeps small badges above the 4.5:1 contrast target.
- Each severity has a written label as well as color. Unknown evidence is
  never shown as safe.

## 3. Typography

Retain the existing `--font-sans` and `--font-mono` families. Use the existing
type scale: `--font-size-xs` for badges, `--font-size-sm` for metric labels and
units, and `--font-size-lg` for warning values. Use `--font-weight-medium`,
`--font-weight-semibold`, and `--font-weight-bold` for hierarchy. Numeric values
use tabular figures. Line heights use the tight and normal tokens.

## 4. Spacing & Layout

Use the existing four-pixel spacing scale. Warning rows use `--space-2` gaps,
`--space-3` padding, and `--radius-xl`. Lists fill their parent without imposing
a minimum width. At narrow container widths, the severity badge moves below
the metric instead of compressing or clipping the value. Labels and free-text
values can wrap; numbers stay attached to their units.

## 5. Components

### Existing Button

`apps/web/src/components/ui/Button` owns primary, secondary, ghost,
and danger variants, size, loading and disabled states. Keep its keyboard
focus treatment and native button semantics.

### RiskEvidenceWarnings

- Shared by Weather cards, Weather details, province details, and Location
  advisories. Renders an accessible list of existing caution/high evidence.
- Anatomy: dimension icon, label, measured value with unit, severity badge.
- States: caution, high risk, multiple warnings, missing measurement, empty
  evidence. Empty lists render nothing; absent/nonfinite values use a dash
  without a unit. Preserve real zero and hourly forecast provenance.
- English and Vietnamese labels follow the parent page language.
- Rows are informational: no hover animation, focus stop, or clickable styling.
- Inline container query handles narrow map panels and mobile cards. The page
  or panel retains scroll ownership.

### Travel Alternatives and RouteScore

- Follow the user's compact Travel Alternatives reference: route type and
  selection on top, one three-column Distance / Duration / ETA score row, then
  a short route summary. No separate large score panel or ETA risk field.
- ETA score is the user-requested display label for the existing backend
  balanced score (lower is better); this layout change does not change its
  calculation. Color and the Low / Caution / Dangerous description show risk, not numeric bands
  of the balanced score. Unknown evidence remains neutral.
- A provisional route uses the highest available checkpoint risk, matching the
  map's observed evidence. Label it as observed risk and show the provisional
  status and weather coverage; incomplete coverage is not a safety guarantee.
- The compact score pill uses `--font-size-xs`, tabular figures, and
  `--font-weight-bold`. The shared metrics row uses `--space-2` / `--space-3`,
  `--radius-lg`, a subtle surface fill, and `--score-accent` / `--score-text`.
- Low uses #22c55e with #15803d light / #86efac dark text. Caution uses #eab308
  with #a16207 light / #fbbf24 dark text. Dangerous uses #ef4444 with #b91c1c
  light / #fca5a5 dark text. Neutral uses existing secondary-text and border
  tokens. Risk descriptions remain available as a tooltip and screen-reader
  text; provisional status and coverage use one compact line below the metrics.
- Route-type pills and the Applied label use a light tint. The selected
  Weather-Safer card has the green border shown in the user's reference;
  keyboard focus stays blue and separate from score risk colors.
- Route-type tokens `--route-accent` / `--route-text`: Fastest #0ea5e9 with
  #0369a1 light / #7dd3fc dark text; Weather-Safer #10b981 with #047857 light /
  #6ee7b7 dark text; Shortest #8b5cf6 with #6d28d9 light / #c4b5fd dark text.
  Clear Route reuses the existing red warning palette. The header count is a
  short neutral pill containing the actual alternative count.
  Cards support pointer selection, Enter, and Space. All three metrics
  stay side by side on mobile. Keep the visible card copy short; longer
  explanations stay available through the score tooltip and assistive text.
- `--route-selection` uses primary blue in light mode and `#60a5fa` in dark
  mode. The alternatives section inherits it as `--focus-ring-color` in dark
  mode so every keyboard indicator remains visible against the navy surface.
- Explain the balanced score once above the compact cards: lower is better,
  and color represents weather risk. The tooltip gives the report's 50/30/20
  risk/time/distance weights; equally Low routes may have different totals.
- Map and Route share province GeoJSON properties and zoom-dependent fill and
  border styling. Province colors show current general weather; the road line
  continues to show vehicle-specific weather at each checkpoint's ETA.

### Route Rest Stops and Weather Timeline

- Rest stops have their own panel above the weather timeline. Show actual
  OpenStreetMap names, distance from departure, and a map link. Explicitly
  scope them to the fastest route; do not invent arrival times or locations.
- Show three stops initially, with a native disclosure for remaining stops.
  Unavailable data and a successful empty result each use one calm sentence.
- Weather samples remain a separate named list. A row shows the location,
  rounded kilometer, arrival time/date, temperature, and written risk level.
  Provisional and unknown status remain visible; never call missing data safe.
- Full ETA, rain, wind, score, route coverage, and source limitations live in
  a closed-by-default details disclosure. A real button selects the point on
  the map; opening details must not change the selected point.
- Reuse surface/border/type/spacing tokens and the RouteScore risk palette.
  Rows use --space-3 padding, --space-2 gaps, --radius-lg, and tabular figures.
  Wrap long names, risk labels, and metadata in narrow panels. Buttons and
  summaries retain visible focus and touch targets of at least 44px.
- Route map checkpoint tooltips use the same compact content: point name and
  temperature, short arrival time/date, then written risk and provisional
  status. Keep technical reasons and coverage in the timeline details.
- Map tooltips retain the existing dark floating surface using gray-900,
  gray-300 and white tokens, --space-3 padding, --radius-lg and --shadow-lg.
  Use RouteScore's dark risk text colors and map marker accents. Bound the
  card to 15rem and the viewport; wrap long names. A 16px dot has a 44px hit
  target. MapLibre owns marker positioning; do not transform the root on hover.
- Tooltips appear on hover, focus or selection, support Escape to dismiss,
  and remain visible while the marker is focused. Their short descriptions
  are linked to the marker button for assistive technology.

## 6. Motion & Interaction

Retain existing `--transition-fast`, `--transition-normal`, focus rings, and
reduced-motion behavior. Static warning evidence needs no additional motion.

## 7. Depth & Surface

Keep the existing mixed system: panels use subtle borders and surface changes;
warnings use a lightly tinted border/background with a stronger badge. Do not
add shadows inside weather cards or advisory panels.

## 8. Accessibility Constraints & Accepted Debt

Keep severity explicit in text, icons decorative, and values readable in both
themes. Preserve units and numeric precision from the existing formatter.
Verify zero, missing data, forecast labels, and localization in component tests.
Browser visual checks for the affected pages remain unverified while access
to localhost is denied; source and DOM checks are not screenshot evidence.
