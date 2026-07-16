# M05 Implementation Report

## M05 Result

- Status: PASS
- Acceptance state: `Implementation candidate — pending owner visual acceptance`
- Branch: `feature/m05-find-reservation`
- Commit: the milestone commit containing this report, titled `feat: complete Find Details and reservation` (resolve with `git rev-parse HEAD`)
- Base commit: `ad5b2093fa1866163ebd03406f72d852be51752d`
- Rollback reference: `ad5b2093fa1866163ebd03406f72d852be51752d`

## Repository inspected

- Read the MASTER specification, M05 package, baseline/domain/adapter/identifier/brand/public-shell/Collections documents, M01–M04 reports, validation guide, both public pages and renderers, shared styles, all three protected data registries, validator, helper libraries, and all inherited tests.
- From clean `main`, fetched origin, confirmed `main` and `origin/main` both at `ad5b2093fa1866163ebd03406f72d852be51752d`, confirmed accepted M04 commit `e8fec2ffef2f2d17f40f9171715fd565a75e5fa5` is an ancestor, and passed all 86 inherited tests before editing.
- Confirmed the dependency-free static architecture, five normalized Jewelry Finds, permanent IDs and slugs, numeric routes, availability states, real/missing media paths, Related Finds ordering, general copy-link behavior, QR payload/render/download implementation, responsive shell, and unchanged workflow entry point.

## Find Details implemented

- Normalized source: `window.BETWEEN_US_DATA.findByLegacyId` resolves the existing numeric route to `window.BETWEEN_US_FINDS`.
- Public ID: visible as `Find ID: BU-NNNN` and excluded from internal-only metadata.
- Collection: public label resolves through `window.BETWEEN_US_COLLECTIONS`; Jewelry is not hardcoded as the only possible Collection.
- Price: formatted from normalized amount and ISO currency through browser-native `Intl.NumberFormat`.
- Condition behavior: omitted for null/empty values and displayed only for a real non-empty string.
- Availability: Available, Reserved, and Sold remain readable text labels.
- Gallery: primary-first ordered `photos[]`, preserved `altText`, direct one-photo presentation, and future multi-photo thumbnail buttons with pressed state, native button keyboard behavior, optional arrows, and polite selection announcements.
- Missing-media behavior: exact two-path frozen registry; known unavailable paths render the deliberate fallback without an image `src`; server review recorded no requests for either path; unexpected failures retain runtime fallback.
- Related Finds: normalized `relatedFindIds`, exact order, numeric URLs, standard cards, registry-aware image fallback, and no reservation control inside cards.

## Reservation implemented

- Configuration global: frozen `window.BETWEEN_US_RESERVATION` with the approved six fields.
- Default channel: `share` through the browser-native Web Share boundary.
- Message template: exact approved template with exact normalized title and permanent public ID tokens; current numeric URL is included separately.
- Available behavior: active **Reserve by Message** button.
- Reserved behavior: no active action; exact **This Find is currently reserved.** text.
- Sold behavior: no active action; exact **This Find has been sold.** text.
- Web Share: sends a Between Us reservation-request title, generated message, and current URL; cancellation is neutral.
- Clipboard fallback: copies the complete message and URL after unavailable or non-cancellation Web Share failure, with polite confirmation.
- Manual fallback: reveals a labeled, read-only, selectable complete message after clipboard failure with honest instructions.
- Manual confirmation/cash/pickup copy: exact required statements appear in every reservation panel; no confirmation, guarantee, online payment, or address is implied.

## Files created

- `data/media.js`
- `data/reservation.js`
- `docs/FIND_DETAILS_AND_RESERVATION.md`
- `docs/REPORTS/M05_REPORT.md`
- `scripts/lib/find-detail-contracts.mjs`
- `tests/detail/find-detail.test.mjs`
- `tests/detail/gallery.test.mjs`
- `tests/detail/media-registry.test.mjs`
- `tests/detail/reservation-config.test.mjs`
- `tests/detail/reservation-ui.test.mjs`

## Files modified

- `README.md`
- `app.js`
- `docs/PUBLIC_SHELL.md`
- `docs/VALIDATION.md`
- `index.html`
- `item.html`
- `item.js`
- `scripts/validate-baseline.mjs`
- `styles.css`
- `tests/baseline/legacy-urls.test.mjs` — approved normalized detail harness
- `tests/baseline/page-and-qr-contracts.test.mjs` — approved M05 script order and normalized renderer assertions
- `tests/baseline/static-serving.test.mjs` — adds the two M05 static registries
- `tests/brand/public-shell.test.mjs` — approved M05 detail script order and normalized title assertion
- `tests/discovery/discovery-ui.test.mjs` — adds the media registry to the approved home script order
- Protected files changed: No. `data/items.js`, `data/collections.js`, `data/discovery.js`, `tests/fixtures/legacy-items.snapshot.json`, `docs/IDENTIFIER_REGISTRY.md`, `assets/images/*`, `assets/brand/between-us-mark.svg`, and `.github/workflows/baseline-validation.yml` are unchanged.

## Files removed

- None

## Validation executed

- `git status --short` — PASS; clean preflight on `main`.
- `git branch --show-current` — PASS; `main` at preflight and `feature/m05-find-reservation` for implementation.
- `git fetch origin` — PASS.
- `git rev-parse main` — PASS; `ad5b2093fa1866163ebd03406f72d852be51752d`.
- `git rev-parse origin/main` — PASS; `ad5b2093fa1866163ebd03406f72d852be51752d`.
- `git merge-base --is-ancestor e8fec2ffef2f2d17f40f9171715fd565a75e5fa5 main` — PASS.
- `node --check app.js` — PASS.
- `node --check item.js` — PASS.
- `node --check data/items.js` — PASS.
- `node --check data/collections.js` — PASS.
- `node --check data/discovery.js` — PASS.
- `node --check data/media.js` — PASS.
- `node --check data/reservation.js` — PASS.
- `node --test tests/baseline/*.test.mjs` — PASS; 40 tests.
- `node --test tests/domain/*.test.mjs` — PASS; 15 tests.
- `node --test tests/brand/*.test.mjs` — PASS; 12 tests.
- `node --test tests/discovery/*.test.mjs` — PASS; 21 tests.
- `node --test tests/detail/*.test.mjs` — PASS; 27 tests.
- `node scripts/validate-baseline.mjs` — PASS; 115 total tests across 16 files.
- `git diff --check` — PASS.
- `git diff --cached --check` — PASS after staging.
- `git status --short` — PASS; clean after the milestone commit.
- Existing GitHub Actions workflow — PASS; unchanged and still runs `node scripts/validate-baseline.mjs`.

## Visual validation

- Home Reserve section: PASS at desktop and mobile widths; exact copy/action, accepted M04 order, sticky-anchor offset, and no overflow.
- Desktop detail: PASS at 1440×1000; balanced gallery/information, separate share/QR utility panel, readable metadata, and clean Related Finds spacing.
- Mobile detail: PASS at 390×844; gallery precedes information, navigation wraps without clipping, 46px reservation action, utilities stack, and no horizontal overflow.
- Gallery: PASS; all current one-photo behavior reviewed; multi-photo ordering, selection, pressed state, arrows, live status, and alt text passed the synthetic runtime fixture.
- Missing media: PASS; items 2 and 3 show the deliberate fallback, expose no registered missing `src`, and caused no placeholder requests in local server logs.
- Available: PASS for items 1, 2, and 4; active action and required copy visible.
- Reserved: PASS for item 3; exact inactive text with general share, QR, navigation, and Related Finds retained.
- Sold: PASS for item 5; exact inactive text with general share, QR, navigation, and Related Finds retained.
- Web Share: PASS by focused success/cancel/failure runtime contracts; live in-app browser handoff reached the native boundary but was not completed to a recipient.
- Clipboard fallback: PASS by focused unavailable/failure runtime contracts; manual selectable fallback also passed.
- Related Finds: PASS on every numeric route with exact configured order.
- QR/share: PASS; current numeric URL remains displayed and used as QR payload, QR canvases rendered, the existing controls remained separate, and download implementation contracts passed.
- Invalid Find: PASS for `item.html?id=999` with one page-level heading and Back to Explore.
- Console: PASS; no errors or warnings in final home, valid-detail, missing-media, availability, or invalid-state checks.
- Screenshots created or not created: optional repository screenshots were not created; transient desktop/mobile browser captures were reviewed during validation.

## Compatibility results

- Data parity: exact legacy fixture and normalized Find contracts pass; no protected Find values changed.
- Numeric routes: `item.html?id=1` through `item.html?id=5` and invalid handling remain intact.
- Public IDs/slugs: `BU-0001`–`BU-0005` and all registered slugs remain unchanged.
- Collections/discovery: protected Collection records, editorial references, filtering, order, and home sections remain intact.
- Related Finds: exact original relationships and order remain intact through normalized public-ID resolution.
- Existing share: current URL display and copy-link implementation remain separate from reservation sharing.
- QR/download: current numeric URL payload, qrcodejs rendering/fallback, PNG conversion, and `jewelry-item-N-qr.png` naming remain protected.
- M03/M04 shell: approved mark, palette, typography, voice, semantic shell, discovery order, filtering, and Coming Soon behavior remain intact.
- Responsive behavior: required 600px, 768px, and 900px breakpoints remain; final desktop/mobile views have no horizontal overflow.

## Warnings and known limitations

- Web Share support and available target applications vary by browser and operating system.
- No direct phone, email, messaging account, recipient, or contact destination is configured.
- Reservation remains manual and does not guarantee availability or change status automatically.
- M06 permanent routes are deferred; M05 keeps numeric routes and current QR payloads.
- M07 final media is deferred; the two known unavailable paths remain in protected Find data and in the M05 media registry.
- QR generation still depends on qrcodejs 1.0.0 from cdnjs.
- The in-app browser did not expose a reliable observable download event or Clipboard API result; the unchanged QR download and clipboard paths pass focused implementation/runtime contracts.
- Visual concerns: none blocking; M05 remains pending owner visual acceptance.

## Git status

- Final branch: `feature/m05-find-reservation`
- Final commit hash: the milestone commit containing this report; resolve with `git rev-parse HEAD`.
- Working-tree state: clean after the required milestone commit.
- Push status: not pushed.
- Merge status: not merged.

## Owner visual-review instructions

Run:

```bash
python3 -m http.server 4175 --bind 127.0.0.1
```

Review:

- Home Reserve: `http://127.0.0.1:4175/index.html#reserve`
- Available Find: `http://127.0.0.1:4175/item.html?id=1`
- Reserved Find: `http://127.0.0.1:4175/item.html?id=3`
- Sold Find: `http://127.0.0.1:4175/item.html?id=5`
- Missing-media Find: `http://127.0.0.1:4175/item.html?id=2`

Inspect the five-link navigation, home Reserve copy/action, public ID, Collection label, currency price, gallery placement, one-photo behavior, deliberate missing-media treatment, available/reserved/sold reservation states, manual/cash/pickup statements, Web Share or fallback behavior in the review browser, general copy-link and QR separation, QR rendering/download, Related Finds order, desktop/mobile spacing, focus visibility, and horizontal overflow.

## Recommended next step

Owner visual review and acceptance of M05.

Do not begin M06.
