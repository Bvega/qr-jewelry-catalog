# M01 Implementation Report

## M01 Result

- Status: PASS
- Branch: `migration/m01-safety-baseline`
- Commit: the milestone commit containing this report, titled `test: establish migration safety baseline` (resolve with `git rev-parse HEAD`)
- Base commit: `899bb08d296ec12ce40dffa72dd6a9d6c9af2c96`
- Rollback reference: `899bb08d296ec12ce40dffa72dd6a9d6c9af2c96`

## Repository inspected

- Read the MASTER specification, milestone package, current todo, README, MVP scope, project state, and session handoff.
- Read all runtime HTML, CSS, JavaScript, and catalog data files.
- Confirmed a dependency-free static architecture: `index.html` catalog, `item.html?id=N` detail shell, shared `styles.css`, browser-global data from `data/items.js`, rendering in `app.js` and `item.js`, and qrcodejs loaded from cdnjs.
- Confirmed five numeric records, three real images, two known missing placeholder images, three availability values, explicit related IDs, share/copy actions, QR generation/download, and GitHub Pages as the recorded current target.
- Fresh origin fetch confirmed `main`, `origin/main`, and `FETCH_HEAD` at the same base commit before branching.

## Files created

- `.github/workflows/baseline-validation.yml`
- `docs/BASELINE_BEHAVIOR.md`
- `docs/DEPLOYMENT.md`
- `docs/REPORTS/M01_REPORT.md`
- `docs/VALIDATION.md`
- `scripts/lib/baseline-contracts.mjs`
- `scripts/validate-baseline.mjs`
- `tests/baseline/data-contracts.test.mjs`
- `tests/baseline/legacy-urls.test.mjs`
- `tests/baseline/page-and-qr-contracts.test.mjs`
- `tests/baseline/static-serving.test.mjs`

## Files modified

- None; all M01 implementation files are additive.
- No protected runtime file changed. `index.html`, `item.html`, `app.js`, `item.js`, `styles.css`, `data/items.js`, and `assets/images/*` are unchanged.

## Files removed

- None

## Validation executed

- `git status --short` — PASS; clean preflight and clean after the milestone commit
- `git branch --show-current` — PASS; `main` at preflight and `migration/m01-safety-baseline` for implementation
- `git log -1 --oneline` — PASS
- `git fetch origin main` — PASS
- `git rev-parse main` — PASS; `899bb08d296ec12ce40dffa72dd6a9d6c9af2c96`
- `git rev-parse origin/main` — PASS; `899bb08d296ec12ce40dffa72dd6a9d6c9af2c96`
- `git rev-parse FETCH_HEAD` — PASS; `899bb08d296ec12ce40dffa72dd6a9d6c9af2c96`
- `node --check app.js` — PASS
- `node --check item.js` — PASS
- `node --check data/items.js` — PASS
- `node --test tests/baseline/*.test.mjs` — PASS; 36 tests
- `node scripts/validate-baseline.mjs` — PASS
- `ruby -e 'require "yaml"; YAML.parse_file(ARGV.fetch(0)); puts "Workflow YAML parse: PASS"' .github/workflows/baseline-validation.yml` — PASS
- `git diff --check` — PASS
- Workflow syntax and semantics — PASS by focused contract review of triggers, actions, Node version, command, and absence of install/deploy steps

## Baseline contracts established

- Data: global array, fixed IDs 1–5, uniqueness, required renderer fields and types, numeric prices, exact availability set, related-record integrity, image path types, and current asset state.
- Static pages: required files, styles, scripts and load order, DOM anchors, renderer wiring, and responsive breakpoints.
- Legacy URLs: every catalog card produces `item.html?id=N`; isolated detail rendering resolves all five current IDs and preserves invalid-item handling.
- Static serving: root, HTML, queried detail routes, CSS, JavaScript, data, and each real image resolve through dependency-free static route reads.
- Images: all three real assets are required; the two absent placeholder files are explicit warnings.
- QR: approved CDN reference and load order, current-URL payload, copy path, QR generation, graceful unavailable-library fallback, and PNG download are protected.
- Deployment: GitHub Pages model, local preview, post-deployment checks, legacy URL/QR verification, CI validation, and external configuration limits are documented.

## Warnings and known limitations

- Missing assets: item 2 references `assets/images/placeholder-ring-silver.jpg`; item 3 references `assets/images/placeholder-earrings-pearl.jpg`. Both are accepted warnings with a visible fallback.
- External dependencies: runtime QR generation depends on qrcodejs 1.0.0 from cdnjs.
- Unverified GitHub settings: the active GitHub Pages source branch and folder are external and not represented in repository configuration.
- Remaining gaps: deployment is not repository-self-contained; M01 intentionally adds no browser automation, new product media, domain normalization, or future routing.

## Git status

- Final branch: `migration/m01-safety-baseline`
- Final commit hash: the commit containing this report; obtain with `git rev-parse HEAD`
- Working-tree state: clean after commit
- Push status: not pushed; nothing merged

## Recommended next step

Prepare for:

```text
M02 — Domain Model and Compatibility Adapter
```

Do not begin M02 until M01 receives MASTER review.
