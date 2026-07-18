# M07A Implementation Report

## M07A Result

- Status: PASS
- Acceptance state: `Implementation candidate — pending MASTER acceptance`
- Branch: `content/m07a-intake-foundation`
- Commit: the milestone commit containing this report, titled `feat: add content intake foundation` (resolve with `git rev-parse HEAD`)
- Base commit: `c850e88700ac32f5ce3eaa148730ea2b9ce85e1f`
- Rollback reference: `c850e88700ac32f5ce3eaa148730ea2b9ce85e1f`

## Repository inspected

- Baseline and protected files confirmed: read the M07A package, MASTER specification, current architecture and validation documentation, M06 report, runtime data, validation entry point, and helper libraries. From clean `main`, fetched origin, confirmed local and remote `main` at `c850e88700ac32f5ce3eaa148730ea2b9ce85e1f`, confirmed accepted M06 commit `1b2a0ae2439a743748b507c6864faf62d60c5c62` is an ancestor, and passed all 153 inherited tests before editing.

## Intake foundation implemented

- Workspace: added one private staging workspace with tracked `photos/`, `archive/`, and `examples/` structure.
- Inventory template: exact approved 14-column UTF-8 CSV header, one clearly labeled non-production sample, required/optional metadata, enums, and internal-notes boundary.
- Photo manifest: exact approved eight-column CSV structure with role, sequence, orientation, approval, and internal-note rules.
- Schema: shared machine-readable contract for headers, required/optional fields, enums, keys, prices, filenames, relationships, boolean behavior, and notes.
- Naming standard: lowercase ASCII `{intake-key}-{sequence}.{extension}` contract, two-digit sequencing, `01` primary, allowed public extensions, source preservation, and HEIC conversion boundary.
- Owner workflow: exact preparation, validation, summary, review, and M07B handoff steps plus clear required/optional metadata.
- Raw-photo protection: raw contents under `content-intake/photos/` and `content-intake/archive/` are ignored; `.gitkeep` remains tracked; public `assets/images/` is not ignored or changed.

## Validation tooling implemented

- Validator: dependency-free, read-only CSV/schema validator with default owner-file discovery, tracked-example fallback, and `--finds`/`--photos` overrides.
- Summary: dependency-free, read-only counts for proposed Finds, Collection, availability, condition, photo readiness, relationships, ready records, and blocked records.
- Error behavior: missing/duplicate headers, malformed rows, missing required values, duplicate or invalid intake keys, invalid enums/booleans/prices/currency/filenames/sequences, duplicate photos, unresolved manifest keys, and primary/additional manifest mismatches exit nonzero.
- Warning behavior: blank condition, absent additional photos, false owner approval, missing raw photos, Coming Soon Collections, and unresolved or proposed relationships are reported separately without changing a valid exit status.
- No-owner-intake behavior: the validator passes tracked examples and reports that owner intake is absent; the summary prints `No owner intake file is present yet.`; no live data is generated.

## Files created

- `content-intake/archive/.gitkeep`
- `content-intake/examples/finds-example.csv`
- `content-intake/examples/photo-manifest-example.csv`
- `content-intake/finds-template.csv`
- `content-intake/intake-schema.json`
- `content-intake/photo-manifest-template.csv`
- `content-intake/photos/.gitkeep`
- `docs/CONTENT_INTAKE_WORKFLOW.md`
- `docs/CONTENT_PHOTO_NAMING.md`
- `docs/REPORTS/M07A_REPORT.md`
- `scripts/lib/content-intake.mjs`
- `scripts/summarize-content-intake.mjs`
- `scripts/validate-content-intake.mjs`
- `tests/content-intake/summary.test.mjs`
- `tests/content-intake/templates.test.mjs`
- `tests/content-intake/validator.test.mjs`

## Files modified

- `.gitignore`
- `README.md`
- `docs/VALIDATION.md`
- `scripts/validate-baseline.mjs`
- Protected files changed: No.

## Files removed

- None

## Validation executed

- `node --check scripts/validate-content-intake.mjs` — PASS
- `node --check scripts/summarize-content-intake.mjs` — PASS
- `node scripts/validate-content-intake.mjs` — PASS; tracked examples valid, owner intake absent, four expected example warnings
- `node scripts/summarize-content-intake.mjs` — PASS; exact no-owner message
- `node --test tests/content-intake/*.test.mjs` — PASS; 17 tests
- `node scripts/validate-baseline.mjs` — PASS; 170 total tests across 23 files
- `git diff --check` — PASS
- `git diff --cached --check` — PASS after staging
- `git status --short` — PASS; clean after the milestone commit
- Total tests: 170 passed, 0 failed; 153 inherited and 17 M07A tests.

## Live-catalog protection

- Runtime data unchanged: all six protected `data/*.js` registries are unchanged.
- Public pages unchanged: `index.html`, `find.html`, `item.html`, `app.js`, `item.js`, and `styles.css` are unchanged.
- Public assets unchanged: `assets/images/*` and `assets/brand/*` are unchanged; no raw photos were committed.
- Existing tests preserved: all 153 inherited baseline, domain, brand, discovery, detail, permalink, sharing, Copy Link, and QR tests pass without weakening protected contracts.

## Warnings and known limitations

- Owner content not supplied.
- No publication in M07A.
- No public IDs assigned.
- No photo conversion.
- No Marketplace or postcard work.

## Git status

- Final branch: `content/m07a-intake-foundation`
- Final commit hash: the milestone commit containing this report; resolve with `git rev-parse HEAD`
- Working-tree state: clean after the required milestone commit
- Push status: not pushed
- Merge status: not merged

## Owner next-step instructions

1. Copy `content-intake/finds-template.csv` to `content-intake/finds.csv`.
2. Copy `content-intake/photo-manifest-template.csv` to `content-intake/photo-manifest.csv`.
3. Delete the non-production sample rows and add one inventory row per Find.
4. Put the untouched raw source photos in `content-intake/photos/`.
5. Name each photo `{intake-key}-01.jpg`, `{intake-key}-02.jpg`, and so on, using an allowed lowercase extension.
6. Make the primary photo sequence `01`, list exact filenames in `finds.csv`, and add one matching manifest row per photo.
7. Provide title, Collection, positive USD price, availability, factual description, primary photo filename, and visual alt text; add condition when known and optional relationships when intended.
8. Set each manifest photo's role, positive integer sequence, orientation, and owner approval; keep internal notes only in notes fields.
9. Run `node scripts/validate-content-intake.mjs` and correct every error.
10. Run `node scripts/summarize-content-intake.mjs` and review ready, blocked, photo, condition, and relationship counts.
11. Submit `content-intake/finds.csv`, `content-intake/photo-manifest.csv`, and the raw files in `content-intake/photos/` for MASTER review.
12. Do not edit `data/items.js` or `assets/images/`, and do not assign permanent public IDs. M07B performs controlled migration after approval.

## Recommended next step

`MASTER review and acceptance of M07A, then owner content entry.`

Do not begin M07B.
