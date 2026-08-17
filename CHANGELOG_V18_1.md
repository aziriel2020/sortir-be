# SORTIR.BE V18.1 — Mobile filter scroll fix

- Fixed the agenda filter panel staying sticky/fixed while scrolling on mobile/tablet.
- Root cause: the later light-theme `.filter-shell { position: sticky }` rule overrode the earlier <=640 px `position: relative` rule.
- New behavior: <=860 px filter panel scrolls naturally with the agenda; >=861 px desktop sticky behavior is preserved.
- Added `qa/filter-scroll-regression.py` to protect this behavior.
