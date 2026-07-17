# Repository Validation

## Prerequisites

- Run commands from the repository root.
- Use Node.js 22 or a compatible newer release with the built-in Node test runner.
- No package installation, package manager, browser driver, or third-party project dependency is required.

## Primary command

Run the complete M01–M06 compatibility, domain, brand, discovery, Find-detail, gallery, media, reservation, permalink, sharing, Copy Link, and QR suite with:

```bash
node scripts/validate-baseline.mjs
```

The command checks JavaScript syntax, runs every `tests/baseline/*.test.mjs`, `tests/domain/*.test.mjs`, `tests/brand/*.test.mjs`, `tests/discovery/*.test.mjs`, `tests/detail/*.test.mjs`, and `tests/permalinks/*.test.mjs` contract, prints known warnings in a separate section, and returns exit code `0` only when every required contract passes. A failed syntax check or test produces a nonzero exit code.

## Individual commands

Use these commands when isolating a failure or completing a milestone review:

```bash
node --check app.js
node --check item.js
node --check data/items.js
node --check data/collections.js
node --check data/discovery.js
node --check data/media.js
node --check data/reservation.js
node --check data/permalinks.js
node --test tests/baseline/*.test.mjs
node --test tests/domain/*.test.mjs
node --test tests/brand/*.test.mjs
node --test tests/discovery/*.test.mjs
node --test tests/detail/*.test.mjs
node --test tests/permalinks/*.test.mjs
node scripts/validate-baseline.mjs
git diff --check
git diff --cached --check
git status --short
```

The GitHub Actions workflow at `.github/workflows/baseline-validation.yml` runs the same primary validation command on pushes to `migration/**` and `feature/**` branches and on pull requests targeting `main`.

## What the validation checks

### JavaScript syntax

Node parses `app.js`, `item.js`, `data/items.js`, `data/collections.js`, `data/discovery.js`, `data/media.js`, `data/reservation.js`, and `data/permalinks.js` without executing the browser application.

### Data contracts

The suite evaluates `data/items.js` in an isolated Node context and verifies:

- `window.JEWELRY_ITEMS` is an array;
- baseline numeric IDs 1 through 5 remain present and unique;
- fields required by the current renderers exist and have compatible types;
- prices are finite, nonnegative numbers;
- availability is limited to `available`, `reserved`, or `sold`;
- every related ID is numeric and resolves to an existing item;
- provided image paths are nonempty strings;
- the three known real images exist; and
- the two known missing placeholder paths remain explicit baseline warnings.

### Find domain and adapter contracts

The suite evaluates `data/items.js` in an isolated Node context and verifies:

- `window.BETWEEN_US_FINDS`, `window.JEWELRY_ITEMS`, and `window.BETWEEN_US_DATA` exist;
- all five Finds contain the required normalized fields;
- public IDs, legacy IDs, and registered slugs have exact mappings, formats, uniqueness, and deterministic order;
- collections, availability, prices, currency, media, alt text, nullable fields, and related public IDs follow the M02 model;
- lookup by public ID, legacy ID, and slug returns the normalized record or `null`;
- normalized records and the lookup surface are read-only;
- legacy fields are derived from normalized fields, including numeric related-ID translation; and
- the adapter has exact parity with `tests/fixtures/legacy-items.snapshot.json`.

### Static page contracts

The suite verifies that `index.html`, `find.html`, and `item.html` exist, retain `#catalogGrid` and `#itemDetail`, load `styles.css`, and load the required scripts in their current order. It also protects the current responsive grid and detail-layout breakpoints.

### Brand and public-shell contracts

The suite verifies:

- the local SVG mark, accessible title, scalable view box, circle, `BU` monogram, and four-point gold sparkle;
- the absence of embedded raster images and external logo dependencies;
- Between Us titles, descriptions, shared semantic landmarks, brand assets, and favicon links;
- Home, Collections, Explore, About, and Reserve by Message anchors and navigation;
- approved hero, collection, Explore, About, detail, Related Finds, and invalid-state language;
- the current Jewelry collection and five noninteractive Coming Soon labels;
- approved color and font tokens, visible focus styling, existing responsive breakpoints, and reduced-motion handling; and
- the absence of external font imports.

### Collection and discovery contracts

The suite verifies:

- the exact six Collection records, approved labels, descriptions, statuses, and stable order;
- Jewelry as the only active Collection, unique IDs, valid statuses, read-only records, and the absence of duplicated Find fields or product icons;
- the exact Featured, Latest, and weekly public-ID references and order;
- resolution of every editorial reference without mutating Finds, `featured`, or nullable timestamps;
- item, Collection, Discovery, and media script order before `app.js`;
- the required Home, Collections, Featured, Latest, Weekly, Explore, About, and Reserve section order and copy;
- data-driven Collection cards, an active Jewelry action, and noninteractive Coming Soon cards;
- All Finds and Jewelry results, original ordering, permanent public-ID detail links, accessible selected state, and live summaries;
- exclusion of inactive and unknown Collection filters plus the reusable future empty state;
- exact Featured, Latest, and weekly rendering through normalized Finds;
- the shared standard card path, image fallback, prices, availability, and permanent detail URLs; and
- visible focus, wrapping filters, visible selected text, and 44px filter targets.

### Legacy URL contracts

The catalog renderer is executed in an isolated DOM stub to prove that new cards create `find.html?id=BU-NNNN` URLs. The detail renderer is executed once for every protected numeric ID to prove that `item.html?id=N` still resolves the same normalized Find, publishes the public-ID canonical URL, and retains the branded invalid-route response for missing, nonnumeric, and unknown IDs.

### Find Details and gallery contracts

The detail suite verifies:

- numeric resolution through `window.BETWEEN_US_DATA.findByLegacyId`;
- normalized title, public ID, Collection label, price amount/currency, availability, description, and optional condition;
- dynamic page titles and branded invalid-Find behavior;
- exact Related Find public-ID resolution, order, and numeric links;
- primary-first photo ordering with normalized remaining order;
- no empty rail for one-photo Finds;
- accessible multi-photo thumbnail labels, pressed state, click behavior, optional arrow behavior, live announcements, and alt text;
- meaningful runtime image-error fallback; and
- no package, carousel, autoplay, or new dependency.

### Media registry contracts

The suite loads `window.BETWEEN_US_MEDIA` and verifies that its frozen registry contains exactly the two accepted missing paths, excludes all three real paths, duplicates no Find fields, and is used by both standard cards and Find Details. Known unavailable paths must render the deliberate fallback without appearing in an image `src`; the protected Find records keep their original path values.

### Reservation contracts

The suite verifies:

- the frozen six-field `window.BETWEEN_US_RESERVATION` configuration and exact approved message template;
- default `share` channel, URL inclusion, manual confirmation, cash payment, and local-arrangement pickup mode;
- absence of any invented phone, email, messaging account, recipient, or pickup address;
- the home `#reserve` section and both navigation links;
- active Available, inactive Reserved, and inactive Sold behavior;
- exact title, public ID, and canonical public-ID URL in the reservation flow;
- native Web Share success and neutral cancellation;
- clipboard fallback after unavailable or failed Web Share;
- selectable manual text after clipboard failure; and
- polite live status, visible focus, minimum mobile target, and textual unavailable states.

### Static resource smoke checks

The dependency-free smoke test resolves static request paths using the same path/query behavior expected from a static host. It reads `/`, `/index.html`, `find.html`, every `find.html?id=BU-NNNN` and `item.html?id=N` route, the stylesheet, both application scripts, all six data scripts, and every real image. It does not pretend that known missing image files exist.

### Permalink and canonical-route contracts

The suite verifies the frozen `window.BETWEEN_US_PERMALINKS` namespace, normalized-registry reuse, exact public-ID, slug, and numeric resolution, project-subpath-safe absolute URL generation, query/hash removal, browser-native encoding, and safe rejection of malformed, unknown, missing, ambiguous, duplicated, extra, or unsupported inputs. It renders all five public-ID routes, every exact slug alias, and all five numeric routes through the shared detail renderer. Both detail pages retain one canonical-link element; valid aliases and numeric routes point to the public-ID URL, while invalid routes claim none.

Home runtime contracts verify permanent links for Explore, Featured, Latest, Find of the Week, and Related Finds without changing records or order. Static smoke checks include `find.html`, `data/permalinks.js`, and queried permanent routes.

### QR and sharing contracts

The suite protects the approved qrcodejs 1.0.0 CDN reference and its position before `item.js`. It verifies canonical Share Find payloads, neutral cancellation, unsupported and failed Web Share recovery, primary clipboard and secondary copy paths, labeled/selectable manual fallback, honest status language, and no false copy success. Reservation contracts retain the exact M05 wording while requiring the same canonical URL from permanent and legacy routes.

QR contracts verify the canonical payload, constructor readiness, controlled failure text, Copy Link availability, stale-output clearing, duplicate prevention, retry, accessible canvas/image treatment, canvas PNG output, image output/conversion or valid-image fallback, exact `between-us-{publicId}-qr.png` naming, and honest download failure states.

### Repository workflow contract

The suite reviews the workflow's required branch triggers, official Node setup action, Node version, primary command, lack of package-install steps, and lack of deployment behavior.

## Warnings versus failures

A **failure** means a required compatibility contract was broken. The primary command exits nonzero and the change must not be accepted until the failure is resolved or an authorized future milestone intentionally replaces the contract.

A **warning** records an accepted but unresolved baseline condition. Warnings do not change the exit code. The M01 warnings are:

- item 2 references `assets/images/placeholder-ring-silver.jpg`, which is absent and registered for direct fallback;
- item 3 references `assets/images/placeholder-earrings-pearl.jpg`, which is absent and registered for direct fallback;
- QR generation depends on an external CDN resource; and
- the active GitHub Pages source branch/folder settings cannot be verified from repository files.

## Adding or changing a contract

1. Add or update a focused `*.test.mjs` file under `tests/baseline/` for existing public behavior, `tests/domain/` for normalized model and adapter behavior, `tests/brand/` for Between Us assets and public-shell behavior, `tests/discovery/` for Collections and discovery behavior, `tests/detail/` for Find Details, gallery, media, and reservation behavior, or `tests/permalinks/` for routing, sharing, Copy Link, canonical, and QR behavior.
2. Reuse `scripts/lib/baseline-contracts.mjs` for public compatibility and project paths, `scripts/lib/find-contracts.mjs` for normalized data fixtures and identifier constants, `scripts/lib/discovery-contracts.mjs` for fixed Collection and editorial expectations, `scripts/lib/find-detail-contracts.mjs` for detail runtime fixtures and DOM stubs, and `scripts/lib/permalink-contracts.mjs` for M06 routing fixtures.
3. Give the test a name that describes public behavior rather than implementation trivia.
4. Add a fixed baseline value when removal or silent change must be detected; do not derive both the expected and actual value from the same source.
5. Run the primary command and the individual review commands above.
6. Update the relevant domain, compatibility, baseline, deployment, and milestone documentation when its contract changes.

Future milestones must change tests intentionally in the same commit as an approved behavior change. A test must not be weakened merely to make a new implementation pass. Legacy numeric URLs and QR behavior remain mandatory migration contracts even after new routes or models are introduced.
