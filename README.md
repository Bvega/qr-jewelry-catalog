# Between Us Platform

Between Us is a mobile-first local discovery catalog for curated, distinctive, and honestly priced Finds. The public experience is presented as **Between Us Finds** under the tagline **Hidden Gems. Honest Prices.**

The platform evolved from the QR Jewelry Catalog MVP. Its five original jewelry records, numeric detail URLs, QR codes, share links, availability states, relationships, and image fallbacks remain protected compatibility contracts while the public brand expands.

## Current experience

- Branded Home, Collections, Featured, Latest, Find of the Week, Explore, and About sections
- Data-driven Collection previews with Jewelry active and five honest Coming Soon Collections
- Accessible All Finds and Jewelry filtering with a live result summary
- Editorial Featured, Latest, and Find of the Week views sourced from the same Find catalog
- Responsive Find cards and detail pages
- Normalized Find Details with permanent public IDs, Collection labels, currency-aware prices, and accessible photo galleries
- Manual Reserve by Message for available Finds, using browser sharing with clipboard and selectable-text fallbacks
- Local Between Us SVG mark and system-font visual language
- Five current Jewelry Finds in their original order
- Available, Reserved, and Sold states
- Numeric `item.html?id=N` routes with QR and copy-link behavior
- Accessible missing-image and invalid-Find states
- Direct fallback for the two registered unavailable photo paths, avoiding preventable browser requests

Reserve by Message does not complete or guarantee a reservation. The owner confirms availability manually; payment is cash, and local pickup details are arranged by message after confirmation. No direct recipient, customer data storage, backend, or online payment is configured.

Future collections are shown as **Coming Soon** without fake links or counts. Latest Finds is currently an editorial order rather than timestamp-derived chronology. Search, advanced filtering, permanent Find routes, and broader inventory remain deferred to their approved milestones.

## Local preview

From the repository root:

```bash
python3 -m http.server 4175 --bind 127.0.0.1
```

Then open `http://127.0.0.1:4175/`.

## Validation

The project has no package-manager or build dependency. Run the complete compatibility, domain, brand/public-shell, Collections/discovery, Find-detail, gallery, media, and reservation suite with:

```bash
node scripts/validate-baseline.mjs
```

See `docs/VALIDATION.md` for individual commands and the contracts protected by the suite.
