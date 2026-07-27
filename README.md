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
- Manual Reserve by Message for available Finds, using browser sharing with clipboard and selectable-text fallbacks
- Canonical Share Find, Copy Link, reservation, and QR payloads with accessible manual and QR-failure recovery
- Local Between Us SVG mark and system-font visual language
- Five current Jewelry Finds in their original order
- Available, Reserved, and Sold states
- Protected numeric `item.html?id=N` routes for every existing shared link and QR destination
- Accessible missing-image and invalid-Find states
- Direct fallback for the two registered unavailable photo paths, avoiding preventable browser requests

Reserve by Message does not complete or guarantee a reservation. The owner confirms availability manually; payment is cash, and local pickup details are arranged by message after confirmation. No direct recipient, customer data storage, public backend connection, or online payment is configured.

Future collections are shown as **Coming Soon** without fake links or counts. Latest Finds is currently an editorial order rather than timestamp-derived chronology. Search, advanced filtering, clean-path routing, and broader inventory remain deferred to their approved milestones.

New public links use the immutable public ID, for example `find.html?id=BU-0001`. A registered slug such as `find.html?slug=gold-twisted-rope-bracelet` resolves as an alias, while its canonical metadata, sharing, reservation, and QR actions all use the public-ID URL. The query-based route works under GitHub Pages project subpaths without rewrite rules.

## Content intake

M07A adds a private staging workspace under `content-intake/` for owner-supplied Find records and photographs. Intake files are validated and summarized locally; they are not published, assigned permanent public IDs, or copied into the live catalog automatically. See `docs/CONTENT_INTAKE_WORKFLOW.md` before preparing owner content.

## Supabase foundation

M07B adds the remote Supabase database, authorization, Storage policies, controlled migration, and authenticated Seller Catalog Manager. The public catalog deliberately remains on the five accepted static repository records. The four imported Finds, `BU-0006` through `BU-0009`, remain remote, hidden, and unfeatured; M07B-4 does not publish them or add a public Supabase read path.

The production Manager is a publicly reachable static route whose privacy and authorization come from Supabase Auth, the exact `owner`/`editor` role probe, RLS, and Storage policies. It connects to remote Supabase only after an authenticated sign-in. Its project URL, project reference, and publishable browser key are public browser configuration, not privileged secrets. A secret key, `service_role` key, database password, or access token must never be used. Temporary owner-activation and M07B-3 migration pages remain local maintenance history and are excluded from the Pages artifact.

The local database workflow requires Node.js, npm, and a running Docker-compatible container runtime. See `docs/SUPABASE_LOCAL_DEVELOPMENT.md`.

## Local preview

Build and validate the exact deployment artifact with fictional browser configuration, then serve only that artifact on loopback:

```bash
npm ci
npm run pages:check
npm run pages:serve
```

The server prints the exact public and Manager preview URLs and never serves repository internals. The fictional Manager configuration used by `pages:check` is for structural preview only and cannot authenticate to the real project.

## Validation

Run the complete inherited and deployment validation without Docker with:

```bash
npm run pages:check
```

The public source itself has no runtime package dependency; Node dependencies are used only to validate and assemble the allowlisted artifact and bundle the Manager. Run `npm install` once before Docker-backed database commands. See `docs/VALIDATION.md` for individual commands and protected contracts, and `docs/M07B4_DEPLOYMENT_ACCEPTANCE_RUNBOOK.md` for controlled Stage B deployment and rollback.
