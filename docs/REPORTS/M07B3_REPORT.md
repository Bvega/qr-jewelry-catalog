# M07B-3 implementation and safety-repair report

## Result

- Status: Stage A implementation and local-only safety repair complete.
- Acceptance state: Implementation candidate — pending MASTER acceptance.
- Repair base: `2bb753dda4f84546d1e48c53063b480f7ff7fb0e`.
- Repair commit message: `fix: harden catalog migration safety`.
- Remote migration, catalog, Auth, and Storage writes: none performed.
- Public source switch: not included; the public catalog remains static and its runtime files are unchanged.

## Corrected safety finding

The original M07B-3 implementation did not prevent direct unauthenticated HTTP reads of the plan, accepted intake CSVs, manifest, or approved intake photos. Any earlier statement that unauthenticated source access was already prevented was incorrect. This repair blocks those static paths, blocks the identifier registry and ignored configuration path, and moves migration reads to an exact authenticated maintenance allowlist.

The loopback-only server accepts GET/HEAD and exposes no write API. For each allowlisted migration request it takes the current Supabase access token only from the Authorization header, validates the Auth user, and requires the exact `owner` result from `current_catalog_admin_role`. It uses only the browser-safe publishable key. Missing authentication receives neutral 401, authenticated editors and non-owners receive neutral 403, and unknown or direct paths receive neutral 404. Authorization values never enter URLs, page source, responses, or logs. The ignored `admin/config.js` path is not served; the server emits only validated browser-safe fields at `/admin/runtime-config.js`.

The public `data/collections.js` asset remains unchanged and publicly readable because it is required by the accepted static catalog. The migration workflow retrieves its tracked bytes through the separately protected `/__maintenance/m07b3/collections.js` endpoint. This preserves the public runtime contract while requiring owner authorization for the migration source-delivery path.

## Fresh source and image verification

Every Run dry-run click now discards previous source state and reloads the plan, both CSVs, Collection registry, identifier registry, and all four approved photos. It rechecks source hashes and each photo's SHA-256, byte size, detected MIME type, width, and height. Execution performs another fresh protected reload and rejects plan drift before any import write.

## Idempotency, ambiguity, and rollback

Upload ownership is recorded only after a successful response confirms the exact path. Upload collisions, timeouts, and ambiguous responses cause fresh Storage inspection. A resumable pre-existing Find never loses an object unless this execution positively confirmed creating it; unresolved ownership becomes a manual-review partial failure without deletion.

Ambiguous Find and photo-metadata insert/delete responses are reconciled through exact reads. A newly inserted Find and UUID-scoped path are cleaned only while their ownership by the current attempt is proven. Every post-write and final verification exception invokes rollback. Rollback removes only positively confirmed attempt-created rows/objects and then independently verifies absence. An error-free delete response is not considered success by itself. Failed rollback stops remaining Finds and reports partial failure instead of a generic no-write blocked state.

## Regression coverage

The M07B-3 suite contains 38 passing tests, including 12 new repair regressions. Added coverage proves:

- unauthenticated direct and maintenance GET denial for plan, CSVs, manifest, identifier registry, protected Collection source, and four photos;
- editor/non-owner denial and exact-owner access to only nine allowlisted resources;
- bearer values are header-only and absent from logs, URLs, response headers, and response bodies;
- every dry-run reloads all nine sources and detects later photo/source drift;
- thrown per-Find and final verification roll back attempt-created artifacts;
- ambiguous uploads on resumable Finds are inspected and never deleted without ownership proof;
- ambiguous metadata insert/delete and cleanup responses are re-read and reconciled;
- rollback absence is verified rather than inferred from a successful response; and
- rollback failure stops remaining Finds and reports partial failure.

## Local validation result

- `npm ci`: pass; 19 packages installed from the lockfile.
- Deterministic plan generation: pass twice; zero tracked plan change after each run.
- Migration validation: pass; 4 hidden Finds, 4 verified photos, 6 Collections.
- Catalog migration tests: 38/38 pass.
- Seller Manager validation: 54/54 tests pass across 8 files.
- Full baseline aggregate: 275/275 tests pass across 38 files.
- Content intake: pass; 4 ready, 0 blocked, 8 expected non-failing warnings.
- Supabase foundation validation: pass.
- Local Supabase reset: pass with all three migrations applied.
- Local pgTAP: 93/93 assertions pass across 5 SQL files.
- Local schema lint: pass with 0 errors.
- Local fictional-user integration: pass with 2 Auth roles, 4 hidden Finds, 4 photo rows, 4 Storage objects, and 0 public Finds.
- Integration cleanup: verified 0 fictional Auth users, allowlist rows, target Finds, photo rows, or Storage rows.
- Real loopback HTTP security smoke: pass for unauthenticated 401, authenticated editor 403, exact owner 200, and direct plan 404.
- `git diff --check`, protected-scope diff checks, deterministic regeneration, ignored-config checks, and configuration/credential leak scans: pass.

The in-app browser backend was unavailable in the validation environment. No alternate browser backend was substituted. The route and security behavior was exercised through real loopback HTTP with actual fictional local Auth sessions, plus unit-level UI/CSP/source/log checks.

## Warnings and known limitations

The two pre-existing missing public placeholder images and external QR-library dependency remain the baseline's non-failing warnings. Remote import remains prohibited until MASTER accepts this repair and separately authorizes Stage B.
