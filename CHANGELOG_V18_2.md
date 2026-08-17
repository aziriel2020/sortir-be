# SORTIR.BE V18.2.1 — Mobile navigation + real map

## Fixed from mobile screenshots

- Mobile bottom dock is now truly fixed flush to the bottom edge of the viewport.
- Event drawer action bar (`Save / Agenda / Share / View event`) is pinned to the real viewport bottom and no longer drifts into the middle of the sheet while scrolling.
- Mobile hero height is now content-driven, so the map is never clipped by the following agenda section.
- Map panel transform animation is disabled on mobile because it was physically shifting the map outside the viewport.

## Real map

The previous hand-built CARTO tile mosaic remains only as a loading/error fallback. Once the real map loads, it is replaced by:

- MapLibre GL JS 5.24.0
- OpenFreeMap `positron` vector style
- OpenStreetMap map data
- No API key required
- Interactive pan / zoom
- Navigation controls
- User geolocation through the existing locate button
- Automatic fit to the currently filtered event markers
- Map marker clicks delegate to the original React event-opening action

The published app already projects Belgian longitude/latitude into marker percentages with the envelope 2.2–6.7°E / 49.3–51.8°N. V18.2 inverts that exact projection to place the existing filtered markers on the real map without changing the React filtering logic.

## QA

- Full responsive render matrix: 104 / 104 PASS
- Mobile map / shell / drawer regression: 14 / 14 PASS
- Filter sticky regression: PASS mobile + desktop
- 390 px map geometry: 370 × 440 px, fully before agenda
- 390 px document scroll width: 390 px (no global horizontal overflow)
- Mobile dock: bottom = viewport bottom
- Drawer action bar: bottom = viewport bottom before and after 700 px internal scroll

## Files added / changed

- `public/assets/sortir-map-v18_2.js`
- `public/assets/index--25enLfP.css`
- `public/index.html`
- `qa/mobile-map-shell-v18_2-regression.py`
- `qa/mobile-map-shell-v18_2-report.json`
- `package.json`
