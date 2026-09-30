# Route display and recommendation follow-up

## Confirmed from screenshot and live API

Hanoi to Lao Cai, car, leave now returns two distinct provider routes. Fastest: 289544 m, 2682 geometry vertices, 59 risk samples (27 with weather coverage). Shortest: 279708 m, 4074 vertices, 57 samples (21 with coverage). Both overall assessments are Unknown and recommended_alternative is null. Saved response: artifacts/route-hanoi-laocai-before.json.

The map created a permanent name/temperature label for every intermediate sample. Preserving all risk samples in the prior fix exposed this marker presentation defect. Samples were also incorrectly called rest stops and the alternatives badge was fixed at three.

## Report comparison

- report/vi/chapters/chapter3_architecture.tex:295 and :368 require spatial <=5 km and temporal <=15 minute sampling. This controls risk calculation density, not persistent map label density.
- :345-351 define Weather-Safer recommendation as the minimum balanced score: 0.5 normalized risk + 0.3 normalized duration + 0.2 normalized distance. Backend previously selected the Weather-Safer label by minimum risk alone while recommending by balanced score. Regression reproduced the disagreement; selection now uses balanced score for both.
- :220 requires Unknown for stale/unavailable evidence. The previously agreed report-alignment specification also forbids ranking incomplete routes as safe. The missing safer result in this real route is a data limitation, not permission to fabricate a third geometry or low score.
- The report describes three routing candidates from OSRM, while the deployed application requests two preferences from Geoapify. Actual distinct candidates are counted; Weather-Safer is an assessment of a real candidate and can share its geometry with Fastest/Shortest.

## Verification

Backend 192/192 tests pass, including a failing-first regression where the lowest risk route loses the balanced objective to a much shorter/faster route. API service rebuilt and restarted.

Direct browser access remained unavailable under the earlier denial. The attached screenshot, component interaction tests, marker selection tests and actual API response are the verification surfaces; no post-change browser screenshot is claimed.

Frontend build and 45/45 web tests pass. Intermediate markers are capped at six, labels appear on hover/focus/selection, and all computation samples and risk segments are preserved. Dynamic alternative counts, missing-safer explanation, same-geometry note and backend recommendation selection are covered.
