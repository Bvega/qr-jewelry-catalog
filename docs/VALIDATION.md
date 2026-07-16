# Baseline Validation

## Prerequisites

- Run commands from the repository root.
- Use Node.js 22 or a compatible newer release with the built-in Node test runner.
- No package installation, package manager, browser driver, or third-party project dependency is required.

## Primary command

Run the complete M01 suite with:

```bash
node scripts/validate-baseline.mjs
```

The command checks JavaScript syntax, runs every `tests/baseline/*.test.mjs` contract, prints known warnings in a separate section, and returns exit code `0` only when every required contract passes. A failed syntax check or test produces a nonzero exit code.

## Individual commands

Use these commands when isolating a failure or completing a milestone review:

```bash
node --check app.js
node --check item.js
node --check data/items.js
node --test tests/baseline/*.test.mjs
node scripts/validate-baseline.mjs
git diff --check
git status --short
```

The GitHub Actions workflow at `.github/workflows/baseline-validation.yml` runs the same primary validation command on pushes to `migration/**` and `feature/**` branches and on pull requests targeting `main`.

## What the validation checks

### JavaScript syntax

Node parses `app.js`, `item.js`, and `data/items.js` without executing the browser application.

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

### Static page contracts

The suite verifies that `index.html` and `item.html` exist, retain `#catalogGrid` and `#itemDetail`, load `styles.css`, and load the required scripts in their current order. It also protects the current responsive grid and detail-layout breakpoints.

### Legacy URL contracts

The catalog renderer is executed in an isolated DOM stub to prove that it creates `item.html?id=N` for every current item. The detail renderer is then executed once for every numeric ID to prove that the correct item, related links, and share URL render. Missing, nonnumeric, and unknown IDs must continue to show the current not-found response.

### Static resource smoke checks

The dependency-free smoke test resolves static request paths using the same path/query behavior expected from a static host. It reads `/`, `/index.html`, every `item.html?id=N` route, the stylesheet, both application scripts, the data script, and every real image. It does not pretend that known missing image files exist.

### QR and sharing contracts

The suite protects the approved qrcodejs 1.0.0 CDN reference and its position before `item.js`. It also checks the existing current-URL share value, Clipboard API path, QR generation, PNG download path, and visible fallback when the QR global is unavailable.

### Repository workflow contract

The suite reviews the workflow's required branch triggers, official Node setup action, Node version, primary command, lack of package-install steps, and lack of deployment behavior.

## Warnings versus failures

A **failure** means a required compatibility contract was broken. The primary command exits nonzero and the change must not be accepted until the failure is resolved or an authorized future milestone intentionally replaces the contract.

A **warning** records an accepted but unresolved baseline condition. Warnings do not change the exit code. The M01 warnings are:

- item 2 references `assets/images/placeholder-ring-silver.jpg`, which is absent;
- item 3 references `assets/images/placeholder-earrings-pearl.jpg`, which is absent;
- QR generation depends on an external CDN resource; and
- the active GitHub Pages source branch/folder settings cannot be verified from repository files.

## Adding or changing a contract

1. Add or update a focused `*.test.mjs` file under `tests/baseline/`.
2. Reuse `scripts/lib/baseline-contracts.mjs` for catalog loading, baseline constants, and project paths.
3. Give the test a name that describes public behavior rather than implementation trivia.
4. Add a fixed baseline value when removal or silent change must be detected; do not derive both the expected and actual value from the same source.
5. Run the primary command and the individual review commands above.
6. Update `docs/BASELINE_BEHAVIOR.md`, deployment instructions, and the active milestone report when the public contract changes.

Future milestones must change tests intentionally in the same commit as an approved behavior change. A test must not be weakened merely to make a new implementation pass. Legacy numeric URLs and QR behavior remain mandatory migration contracts even after new routes or models are introduced.
