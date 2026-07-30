# Between Us Platform

Between Us is a mobile-first local discovery catalog for curated, distinctive, and honestly priced Finds. The public experience is presented as **Between Us Finds** under the tagline **Hidden Gems. Honest Prices.**

The platform evolved from the QR Jewelry Catalog MVP. Its five original jewelry records, numeric detail URLs, QR codes, share links, availability states, relationships, and image fallbacks remain protected compatibility contracts while the public brand expands.

## Current experience

- Branded Home, Collections, Featured, Latest, Find of the Week, Explore, and About sections
- Data-driven Collection previews with Jewelry active and five honest Coming Soon Collections
- Accessible All Finds and Jewelry filtering with a live result summary
- Editorial Featured, Latest, and Find of the Week views sourced from the same Find catalog
- Responsive Find cards and detail pages
- Permanent static-safe `find.html?id=BU-NNNN` detail links with exact registered-slug aliases
- Normalized Find Details with permanent public IDs, Collection labels, currency-aware prices, and accessible photo galleries
- Static-first hybrid catalog loading with RLS-protected eligible remote Finds and an automatic five-Find fallback
- Authenticated, confirmed, and final-state-verified Manager publication and unpublication
- Manual Reserve by Message for available Finds, using browser sharing with clipboard and selectable-text fallbacks
- Canonical Share Find, Copy Link, reservation, and QR payloads with accessible manual and QR-failure recovery
- Local Between Us SVG mark and system-font visual language
- Five protected static Jewelry Finds in their original order, always available even when Supabase is not
- Available, Reserved, and Sold states
- Protected numeric `item.html?id=N` routes for every existing shared link and QR destination
- Accessible missing-image and invalid-Find states
- Direct fallback for the two registered unavailable photo paths, avoiding preventable browser requests

Reserve by Message does not complete or guarantee a reservation. The owner confirms availability manually; payment is cash, and local pickup details are arranged by message after confirmation. No direct recipient, customer data storage, public backend connection, or online payment is configured.

Collections with eligible public Finds become active; empty Collections remain **Coming Soon** without fake links or counts. Latest Finds is currently an editorial order rather than timestamp-derived chronology. Search, advanced filtering, clean-path routing, and broader inventory remain deferred to their approved milestones.

New public links use the immutable public ID, for example `find.html?id=BU-0001`. A registered slug such as `find.html?slug=gold-twisted-rope-bracelet` resolves as an alias, while its canonical metadata, sharing, reservation, and QR actions all use the public-ID URL. The query-based route works under GitHub Pages project subpaths without rewrite rules.

## Content intake

M07A adds a private staging workspace under `content-intake/` for owner-supplied Find records and photographs. Intake files are validated and summarized locally; they are not published, assigned permanent public IDs, or copied into the live catalog automatically. See `docs/CONTENT_INTAKE_WORKFLOW.md` before preparing owner content.

## Supabase foundation

M07B adds the remote Supabase database, authorization, Storage policies, controlled migration, and authenticated Seller Catalog Manager. M08 adds the accepted static-first public read path for published, non-archived Finds while preserving the five accepted repository records as authoritative. Explicit SQL column grants and RLS are the anonymous data boundary. `find-images` is private; eligible photographs are downloaded through Storage RLS and rendered with page-local blob URLs.

The production Manager is a publicly reachable static route whose privacy and authorization come from Supabase Auth, the exact `owner`/`editor` role probe, RLS, and Storage policies. It connects to remote Supabase only after an authenticated sign-in. Its project URL, project reference, and publishable browser key are public browser configuration, not privileged secrets. The public catalog configuration contains only the URL and publishable key. Privileged keys, database passwords, access tokens, owner identifiers, and sessions must never be exposed. Temporary owner-activation and M07B-3 migration pages remain local maintenance history and are excluded from the Pages artifact.

M08 Controlled Dynamic Publishing is complete and accepted. The reviewed migration and implementation are deployed. The approved `BU-0006` canary was published, anonymously verified, and unpublished without deleting its record, photographs, or private Storage objects. `BU-0006` through `BU-0009` are active, hidden, and unpublished; the public catalog contains exactly the five protected static Finds. See `docs/CONTROLLED_DYNAMIC_PUBLISHING.md` and `docs/REPORTS/M08_CONTROLLED_DYNAMIC_PUBLISHING_ACCEPTANCE.md`.

The complete local database workflow requires Node.js, npm, and a running Docker-compatible container runtime. See `docs/SUPABASE_LOCAL_DEVELOPMENT.md`.

## Local preview

Build and validate the exact deployment artifact with fictional browser configuration, then serve only that artifact on loopback:

```bash
npm ci
npm run pages:check
npm run pages:serve
```

The server prints the exact public and Manager preview URLs and never serves repository internals. The fictional Manager configuration used by `pages:check` is for structural preview only and cannot authenticate to the real project.

## Validation

Run the complete M08 validation, including actual local RLS and Storage tests, with:

```bash
npm run m08:check
```

For a Docker-free, tracked-only clean-checkout check:

```bash
npm run m08:check:ci
```

The inherited deployment-only validation remains:

```bash
npm run pages:check
```

The public source itself has no runtime package dependency; Node dependencies are used only to validate and assemble the allowlisted artifact and bundle the Manager. Run `npm install` once before Docker-backed database commands. See `docs/VALIDATION.md` for individual commands and protected contracts. The next milestone is `M09 — Browser-Assisted Validation`, which remains planning-only.
