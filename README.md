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

M07B-1 adds a non-public Supabase database, authorization, Storage-policy, migration, and automated-test foundation for future catalog management. The current public catalog still uses the accepted static data. The Seller Catalog Manager is not available yet, and no existing or intake products have been migrated.

The local database workflow requires Node.js, npm, and a running Docker-compatible container runtime. See `docs/SUPABASE_LOCAL_DEVELOPMENT.md`. No hosted project or browser configuration is part of M07B-1.

## Local preview

From the repository root:

```bash
python3 -m http.server 4175 --bind 127.0.0.1
```

Then open `http://127.0.0.1:4175/`.

## Validation

The public catalog has no build step or runtime package dependency. Run the complete compatibility, domain, brand/public-shell, Collections/discovery, Find-detail, reservation, permalink, sharing, Copy Link, QR, content-intake, and static Supabase foundation suite without Docker with:

```bash
node scripts/validate-baseline.mjs
```

Run `npm install` once to install the repository-local Supabase CLI before using the Docker-backed database commands. See `docs/VALIDATION.md` for individual commands and the contracts protected by the suite.
