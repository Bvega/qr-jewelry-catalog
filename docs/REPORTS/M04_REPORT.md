# M04 Implementation Report

## M04 Result

- Status: PASS
- Acceptance state: `Implementation candidate — pending owner visual acceptance`
- Branch: `feature/m04-collections-discovery`
- Commit: the milestone commit containing this report, titled `feat: add Collections and discovery` (resolve with `git rev-parse HEAD`)
- Base commit: `ec4593330f00581a390e1b7a636e8eec6584c901`
- Rollback reference: `ec4593330f00581a390e1b7a636e8eec6584c901`

## Repository inspected

- Read the MASTER specification, M04 package, M01–M03 behavior/domain/compatibility/identifier/brand/public-shell documents and reports, validation guide, both public pages and renderers, shared styles, normalized catalog data, validator libraries, and all inherited tests.
- Freshly fetched origin from a clean `main`, confirmed `main` and `origin/main` both at `ec4593330f00581a390e1b7a636e8eec6584c901`, confirmed accepted M03 commit `34981ca` is an ancestor, and passed all 63 inherited tests before editing.
- Confirmed the dependency-free static architecture, five normalized Jewelry Finds, permanent IDs, numeric routes, three real photographs, two known missing-image paths, related Finds, availability states, share/copy behavior, QR behavior, local brand assets, and unchanged workflow entry point.

## Collection system implemented

- Registry global: read-only `window.BETWEEN_US_COLLECTIONS` from `data/collections.js`.
- Collection records: exact Jewelry, Vintage, Home & Decor, Kitchen, Collectibles, and New Items records with approved descriptions, statuses, and order.
- Active Collection: Jewelry only, with an **Explore Jewelry** anchor to `#explore`.
- Coming Soon Collections: five explicit, noninteractive cards with no fake links, enabled filters, icons, or counts.
- Filter behavior: **All Finds** and every active Collection are generated automatically; M04 exposes All Finds and Jewelry, both preserving the five-Find catalog order and numeric detail URLs.
- Empty state: reusable approved copy for future active Collections without Finds.

## Discovery system implemented

- Discovery global: read-only `window.BETWEEN_US_DISCOVERY` from `data/discovery.js`, containing public-ID references only.
- Featured Finds: `BU-0001`, `BU-0004`, `BU-0005` in exact configured order.
- Latest Finds: `BU-0004`, `BU-0005`, `BU-0001` in exact configured order.
- Find of the Week: `BU-0001`, with image/fallback, title, public ID, description, price, availability, and numeric View Find action.
- Editorial-order limitation: Latest is explicitly documented as editorial, not timestamp-derived; no dates or history were invented.

## Files created

- `data/collections.js`
- `data/discovery.js`
- `docs/COLLECTIONS_AND_DISCOVERY.md`
- `docs/REPORTS/M04_REPORT.md`
- `docs/REPORTS/M04_HOME_DESKTOP.png`
- `docs/REPORTS/M04_HOME_MOBILE.png`
- `docs/REPORTS/M04_FILTER_DESKTOP.png`
- `docs/REPORTS/M04_WEEKLY_MOBILE.png`
- `scripts/lib/discovery-contracts.mjs`
- `tests/discovery/collections.test.mjs`
- `tests/discovery/discovery-config.test.mjs`
- `tests/discovery/discovery-ui.test.mjs`

## Files modified

- `README.md`
- `index.html`
- `app.js`
- `styles.css`
- `scripts/validate-baseline.mjs`
- `docs/VALIDATION.md`
- `docs/PUBLIC_SHELL.md`
- `tests/baseline/page-and-qr-contracts.test.mjs` — approved M04 script-order expectation
- `tests/baseline/static-serving.test.mjs` — adds both new static data resources
- `tests/brand/public-shell.test.mjs` — updates the Collection preview contract from static M03 markup to the M04 registry renderer
- Protected files changed: No. `data/items.js`, `item.html`, `item.js`, the legacy fixture, identifier registry, images, brand mark, and workflow are unchanged.

## Files removed

- None

## Validation executed

- `git status --short` — PASS; clean preflight on `main`
- `git branch --show-current` — PASS; `main` at preflight and `feature/m04-collections-discovery` for implementation
- `git fetch origin` — PASS
- `git rev-parse main` — PASS; `ec4593330f00581a390e1b7a636e8eec6584c901`
- `git rev-parse origin/main` — PASS; `ec4593330f00581a390e1b7a636e8eec6584c901`
- `git merge-base --is-ancestor 34981ca main` — PASS
- `node --check app.js` — PASS
- `node --check item.js` — PASS
- `node --check data/items.js` — PASS
- `node --check data/collections.js` — PASS
- `node --check data/discovery.js` — PASS
- `node --test tests/baseline/*.test.mjs` — PASS; 38 tests
- `node --test tests/domain/*.test.mjs` — PASS; 15 tests
- `node --test tests/brand/*.test.mjs` — PASS; 12 tests
- `node --test tests/discovery/*.test.mjs` — PASS; 21 tests
- `node scripts/validate-baseline.mjs` — PASS; 86 total tests across 11 test files
- `git diff --check` — PASS
- `git diff --cached --check` — PASS
- `git status --short` — PASS after the milestone commit; clean branch
- Existing GitHub Actions workflow — PASS; unchanged and still runs `node scripts/validate-baseline.mjs`

## Visual validation

- Desktop home — PASS at a 1440×1000 review viewport; section hierarchy, grids, shared cards, content width, and horizontal overflow checked.
- Mobile home — PASS at a 390×844 review viewport; header, hero, one-column discovery grids, two-column Explore grid, touch targets, and horizontal overflow checked.
- Collections — PASS; six exact registry cards, approved descriptions, one active action, and five noninteractive Coming Soon states.
- Filters — PASS; All Finds and Jewelry controls, 44px targets, visible and programmatic selected state, focus preservation, result summary, order, and five results.
- Featured — PASS; exact numeric links 1, 4, 5 and shared cards.
- Latest — PASS; exact numeric links 4, 5, 1 and shared cards.
- Weekly — PASS; responsive stacked mobile and balanced desktop presentation for `BU-0001`.
- Detail routes — PASS; browser-reviewed `item.html?id=1` and `item.html?id=2`; all five numeric routes remain covered by automated tests.
- Missing image — PASS; items 2 and 3 show the visible **No photo yet** fallback.
- Availability states — PASS; Available, Reserved, and Sold remain visible text labels.
- Navigation anchors — PASS; `#collections`, `#featured`, `#latest`, `#weekly`, and `#explore` align below the sticky header after data-driven rendering; Explore Jewelry scrolls to Explore.
- Console — PASS; no errors or warnings in final desktop, mobile, real-image detail, or missing-image detail checks.
- Screenshots — created: `M04_HOME_DESKTOP.png`, `M04_HOME_MOBILE.png`, `M04_FILTER_DESKTOP.png`, and `M04_WEEKLY_MOBILE.png`.

## Compatibility results

- Data parity: exact legacy fixture and normalized Find contracts pass; no Find values changed.
- Numeric routes: original `item.html?id=N` format and IDs 1–5 remain intact.
- Public IDs/slugs: `BU-0001`–`BU-0005` and registered slugs remain unchanged.
- Related Finds: original public and numeric relationships and ordering remain intact.
- QR/share: detail share values and QR payloads remain the complete current numeric URL; QR rendering passed in the browser.
- Image fallback: three real images remain available and both known missing paths retain their visible fallback.
- M03 brand shell: approved mark, palette, typography, voice, navigation, About, detail shell, and footer remain intact.
- Responsive behavior: required breakpoints, touch targets, mobile stacking, filter wrapping, and no-horizontal-overflow checks pass.

## Warnings and known limitations

- Only Jewelry is currently active and contains Finds.
- Vintage, Home & Decor, Kitchen, Collectibles, and New Items remain Coming Soon.
- Latest is editorial, not timestamp-derived; no dates were invented.
- Search, sorting, price, condition, and other advanced filtering remain deferred.
- Reservation messaging remains deferred to M05.
- QR generation still depends on qrcodejs 1.0.0 from cdnjs.
- The active GitHub Pages source setting remains external and unverified.
- Remaining visual concerns: none blocking; final presentation remains pending owner visual acceptance.

## Git status

- Final branch: `feature/m04-collections-discovery`
- Final commit hash: the commit containing this report; obtain with `git rev-parse HEAD`
- Working-tree state: clean after commit
- Push status: not pushed; nothing merged

## Owner visual-review instructions

Run:

```bash
python3 -m http.server 4175 --bind 127.0.0.1
```

Review:

- Home: `http://127.0.0.1:4175/`
- Collections: `http://127.0.0.1:4175/index.html#collections`
- Featured: `http://127.0.0.1:4175/index.html#featured`
- Latest: `http://127.0.0.1:4175/index.html#latest`
- Weekly: `http://127.0.0.1:4175/index.html#weekly`
- Explore and filters: `http://127.0.0.1:4175/index.html#explore`
- Real-image Find: `http://127.0.0.1:4175/item.html?id=1`
- Missing-image Find: `http://127.0.0.1:4175/item.html?id=2`

Inspect the Collection descriptions and Coming Soon honesty, Explore Jewelry anchor, filter selected state and live count, configured Featured and Latest ordering, weekly balance, shared-card consistency, mobile wrapping and stacking, image fallback, availability labels, numeric detail links, QR/share behavior, header anchor offsets, and footer continuity.

## Recommended next step

Owner visual review and acceptance of M04.

Do not begin M05.
