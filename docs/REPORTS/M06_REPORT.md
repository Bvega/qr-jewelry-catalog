# M06 Implementation Report

## M06 Result

- Status: PASS
- Acceptance state: `Implementation candidate — pending owner visual acceptance`
- Branch: `feature/m06-qr-permalinks`
- Commit: the milestone commit containing this report, titled `feat: add permanent Find links and harden QR sharing` (resolve with `git rev-parse HEAD`)
- Base commit: `90c4f94316996992146adaa6562a0c95de4add2b`
- Rollback reference: `90c4f94316996992146adaa6562a0c95de4add2b`

## Repository inspected

- Read the MASTER specification, M06 package, baseline/domain/adapter/identifier/brand/public-shell/Collections/Find Details documents, M01–M05 reports, validation guide, both existing pages and renderers, shared styles, all protected data registries, validator, helper libraries, and all inherited tests.
- From clean `main`, fetched origin, confirmed `main` and `origin/main` both at `90c4f94316996992146adaa6562a0c95de4add2b`, confirmed accepted M05 commit `d92853aab80a9486327766fbb7ded4698631f733` is an ancestor, and passed all 115 inherited tests before editing.
- Confirmed the dependency-free static architecture, five normalized Finds, exact immutable identifiers/slugs, all numeric routes, existing QR destinations, protected data/media/brand/workflow files, approved reservation wording, and unchanged qrcodejs 1.0.0 source.

## Permalinks implemented

- Runtime global: frozen `window.BETWEEN_US_PERMALINKS` with `findByRoute`, `permalinkFor`, `legacyUrlFor`, `slugAliasFor`, and `currentCanonicalUrl`.
- Canonical route format: absolute deployment-safe `find.html?id={publicId}`.
- Public-ID resolution: exact uppercase `BU-0001` through `BU-0005` resolution through the normalized registry.
- Slug alias: all exact registered slugs resolve through `find.html?slug={slug}` and canonicalize to public ID.
- Legacy numeric resolution: `item.html?id=1` through `item.html?id=5` remain direct, functional routes without redirects.
- Base-path behavior: current origin and directory are preserved; existing query values and hashes are removed; no domain or repository is hardcoded.
- Canonical metadata: one canonical-link element on each detail page; valid permanent, alias, and numeric routes converge on the public-ID URL; invalid routes remove the canonical claim.
- Link migration: Explore, Featured, Latest, Find of the Week, and Related Finds use public-ID URLs without data or order changes.

## Sharing and Copy Link implemented

- Share payload: exact Find title plus Between Us, concise sharing text, and canonical public-ID URL.
- Cancellation behavior: general Web Share cancellation reports `Share was canceled.` neutrally and does not copy.
- Copy hierarchy: Clipboard API, browser copy-command fallback, then manual selection.
- Manual fallback: labeled, read-only, selectable canonical link plus `Select and copy this link manually.` with polite live status.
- Reservation URL migration: exact M05 template and channel behavior preserved; only the separately included URL now uses the canonical permalink.
- Accessible statuses: share, copy, reservation, QR, and download states use visible text and polite live regions without false success.

## QR hardening implemented

- Payload: absolute canonical public-ID permalink on permanent, slug, and numeric routes.
- Library readiness: constructor presence is checked before use; a blocked or missing library does not throw.
- Rendering lifecycle: stale output is cleared before render/retry; resolution precedes QR creation; one qrcodejs output set remains after retry.
- Duplicate prevention: repeated controlled rendering clears the previous canvas/image pair before replacement.
- Download outputs: canvas PNG and qrcodejs image output are supported; conversion is attempted when needed; valid-image manual-save fallback is available without false success.
- Filename: exact `between-us-{publicId}-qr.png`.
- Failure behavior: accessible generation/download messages preserve the QR when available and direct visitors to Copy Link; retry remains available for generation failure.
- Legacy QR compatibility: all five numeric destinations still resolve and generate new canonical QR payloads.

## Files created

- `data/permalinks.js`
- `docs/PERMALINKS_QR_AND_SHARING.md`
- `docs/REPORTS/M06_REPORT.md`
- `find.html`
- `scripts/lib/permalink-contracts.mjs`
- `tests/permalinks/permalink-runtime.test.mjs`
- `tests/permalinks/permanent-routes.test.mjs`
- `tests/permalinks/sharing-and-copy.test.mjs`
- `tests/permalinks/qr-hardening.test.mjs`

## Files modified

- `README.md`
- `app.js`
- `docs/COLLECTIONS_AND_DISCOVERY.md`
- `docs/FIND_DETAILS_AND_RESERVATION.md`
- `docs/PUBLIC_SHELL.md`
- `docs/VALIDATION.md`
- `index.html`
- `item.html`
- `item.js`
- `scripts/lib/discovery-contracts.mjs`
- `scripts/lib/find-detail-contracts.mjs`
- `scripts/validate-baseline.mjs`
- `styles.css`
- `tests/baseline/legacy-urls.test.mjs`
- `tests/baseline/page-and-qr-contracts.test.mjs`
- `tests/baseline/static-serving.test.mjs`
- `tests/brand/public-shell.test.mjs`
- `tests/detail/find-detail.test.mjs`
- `tests/detail/reservation-ui.test.mjs`
- `tests/discovery/discovery-ui.test.mjs`
- Protected files changed: No. `data/items.js`, `data/collections.js`, `data/discovery.js`, `data/media.js`, `data/reservation.js`, the legacy fixture, identifier registry, images, brand mark, and workflow are unchanged.

## Files removed

- None

## Validation executed

- `node --check app.js` — PASS
- `node --check item.js` — PASS
- `node --check data/items.js` — PASS
- `node --check data/collections.js` — PASS
- `node --check data/discovery.js` — PASS
- `node --check data/media.js` — PASS
- `node --check data/reservation.js` — PASS
- `node --check data/permalinks.js` — PASS
- `node --test tests/baseline/*.test.mjs` — PASS; 47 tests
- `node --test tests/domain/*.test.mjs` — PASS; 15 tests
- `node --test tests/brand/*.test.mjs` — PASS; 12 tests
- `node --test tests/discovery/*.test.mjs` — PASS; 21 tests
- `node --test tests/detail/*.test.mjs` — PASS; 27 tests
- `node --test tests/permalinks/*.test.mjs` — PASS; 31 tests
- `node scripts/validate-baseline.mjs` — PASS; 153 total tests across 20 files
- `git diff --check` — PASS
- `git diff --cached --check` — PASS after staging
- `git status --short` — PASS; clean after the milestone commit
- Existing GitHub Actions workflow — PASS; unchanged and still invokes `node scripts/validate-baseline.mjs`

## Visual validation

- Home links: PASS; all Explore, Featured, Latest, and weekly actions use public-ID URLs in exact order.
- Canonical detail: PASS for `BU-0001` through `BU-0005`; content, canonical metadata, link display, QR, and actions resolve correctly.
- Slug alias: PASS for `gold-twisted-rope-bracelet`; content matches and canonical metadata uses `BU-0001`.
- Legacy detail: PASS for numeric IDs 1–5; content matches canonical routes and new outward URLs use public IDs.
- Desktop: PASS at 1440×1000; utility panel is balanced, URL fits, QR and actions remain distinct, and no horizontal overflow appears.
- Mobile: PASS at 390×844; URL wraps safely, QR remains centered, all actions are at least 44px, and no horizontal overflow appears.
- Share: PASS by visible control/payload inspection and focused success/cancel/failure contracts; native recipient handoff was not completed.
- Copy Link: PASS by live status and focused Clipboard/secondary/manual contracts.
- Manual fallback: PASS in a controlled mobile runtime; selectable link, instruction, and status remain readable without dominating the panel.
- Reservation link: PASS; rendered fallback message uses the exact M05 wording and canonical URL on permanent and numeric routes.
- QR: PASS; qrcodejs renders one visible 160px image plus its hidden canvas source and reports ready state.
- QR retry: PASS by controlled runtime contract; prior output is cleared and the visible failure state offers Retry QR.
- QR download: PASS by visible prepared status and automated canvas/image/filename contracts; the in-app browser did not expose a download event.
- QR-library failure: PASS in a controlled mobile runtime; accessible Copy Link guidance, retry, disabled download, stable layout, and no overflow.
- Missing media: PASS for `BU-0002` and `BU-0003`; deliberate fallback appears and registered missing paths are not requested in the main preview.
- Availability states: PASS for Available, Reserved, and Sold; only Available exposes the reservation action.
- Related Finds: PASS with exact permanent-link order and responsive cards.
- Invalid routes: PASS for permanent and numeric unknown routes; no canonical claim, QR, Share, Copy, or Reserve action.
- Console: PASS; no errors or warnings in the main home, valid, alias, legacy, missing-media, availability, or invalid-route review.
- Screenshots created or not created: optional repository screenshots were not created; transient desktop/mobile and controlled-failure captures were reviewed.

## Compatibility results

- Data parity: exact normalized and legacy fixture contracts pass; no Find values changed.
- Legacy numeric routes: all five remain operational without redirects.
- Public IDs/slugs: exact registered IDs and slugs remain unchanged and resolve deterministically.
- Collections/Discovery: records, editorial order, filtering, and visible content remain exact; only public link targets migrated.
- Find Details: normalized metadata, gallery, image fallback, availability, and invalid behavior remain intact.
- Reservation: configuration and exact message template remain unchanged; URL inclusion migrated to canonical.
- Related Finds: exact relationships and order remain intact with public-ID links.
- Existing legacy QR destinations: all numeric routes still resolve the same normalized Finds.
- M03–M05 shell: approved brand, navigation, discovery order, reservation states, and public vocabulary remain intact.
- Responsive behavior: required breakpoints, focus visibility, touch targets, wrapping, centered mobile QR, and no-overflow checks pass.

## Warnings and known limitations

- The canonical route remains the approved static query form `find.html?id={publicId}`.
- Clean-path routing remains deferred because no hosting rewrite is approved.
- Web Share availability, target applications, and cancellation UI vary by browser and operating system.
- Clipboard API availability and permissions vary; secondary and manual fallbacks remain required.
- Find QR generation still depends on the external qrcodejs 1.0.0 CDN resource.
- Brand QR and postcard integration remain deferred to M07.
- Broader SEO and social previews remain deferred to M08.
- The in-app browser did not expose a reliable QR download event or readable Clipboard result; focused runtime contracts and visible statuses passed.
- Visual concerns: none blocking; M06 remains pending owner visual acceptance.

## Git status

- Final branch: `feature/m06-qr-permalinks`
- Final commit hash: the milestone commit containing this report; resolve with `git rev-parse HEAD`
- Working-tree state: clean after the required milestone commit
- Push status: not pushed
- Merge status: not merged

## Owner visual-review instructions

Run:

```bash
python3 -m http.server 4175 --bind 127.0.0.1
```

Review:

- Home: `http://127.0.0.1:4175/`
- Canonical public-ID Find: `http://127.0.0.1:4175/find.html?id=BU-0001`
- Slug alias: `http://127.0.0.1:4175/find.html?slug=gold-twisted-rope-bracelet`
- Matching legacy Find: `http://127.0.0.1:4175/item.html?id=1`
- Missing-media Find: `http://127.0.0.1:4175/find.html?id=BU-0002`
- Reserved Find: `http://127.0.0.1:4175/find.html?id=BU-0003`
- Sold Find: `http://127.0.0.1:4175/find.html?id=BU-0005`
- Invalid Find: `http://127.0.0.1:4175/find.html?id=BU-9999`

Inspect permanent home/card links, identical canonical/alias/legacy content, canonical metadata, selectable URL wrapping, Share Find, Copy Link and fallback behavior, exact reservation message link, QR scan payload, retry/failure recovery, QR download name, missing-media treatment, availability states, Related Finds, invalid-route action removal, desktop/mobile balance, focus visibility, and horizontal overflow.

## Recommended next step

Owner visual review and acceptance of M06.

Do not begin M07.
