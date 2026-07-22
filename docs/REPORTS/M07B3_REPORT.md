# M07B-3 implementation report

## Result

- Status: Stage A implementation and local-only validation complete.
- Acceptance state: Implementation candidate — pending MASTER acceptance.
- Remote migration and catalog writes: none performed.
- Public source switch: not included; the public catalog remains static.

## Delivered scope

M07B-3 adds a deterministic four-Find plan, independent source and image validation, fixed assignments `BU-0006` through `BU-0009`, a monotonic sequence-floor migration, pgTAP coverage, an owner-only unlinked migration page, no-write database and Storage preflight, explicit confirmation, idempotent execution, partial-photo resume, scoped rollback, security checks, documentation, and the post-acceptance remote runbook.

The six repository Collections are inserted only when missing and exact. Existing differences block. Original image bytes are hashed, typed, measured, dimension-checked, uploaded without recompression, and verified at their deterministic Find-scoped path.

## Safety result

Editors and authenticated non-admins are denied and signed out. The page reveals no plan before owner authorization, performs no anonymous Storage listing, does not log authentication material, and never embeds browser configuration or source image bytes in bundles. Existing mismatches are never overwritten. Cleanup is limited to artifacts created by the failed attempt, and cleanup failure stops all remaining records.

Protected public runtime and accepted intake files remain unchanged. The identifier registry changes only for the four approved mappings and next ID `BU-0010`.

## Local validation result

Deterministic plan regeneration, independent migration validation, the migration Node suite, admin build and Seller Manager validation, intake validation and summary, foundation validation, the full baseline suite, local Supabase reset, 93 pgTAP assertions, local schema lint, protected-scope checks, and whitespace checks pass. Repeating plan generation leaves the tracked plan byte-identical.

A real local-service integration smoke used only fictional temporary Auth users. It confirmed exact owner authorization, a zero-write dry-run, editor migration denial and sign-out without changing normal editor catalog capability, anonymous write rejection, import of four exact hidden and unfeatured Finds, original-image verification, already-complete idempotency, and complete fixture cleanup. The local database finished with zero Auth users, administrator rows, Finds, photo rows, and Storage objects; the sequence floor remained at 9.

The loopback server returned `200` for `/admin/`, `/admin/activate.html`, and `/admin/migrate-intake.html`, returned `404` for `/.env.local`, and rejected migration-route `POST` with `405`. The in-app visual browser runtime was unavailable in the implementation environment, so visual click-through and console inspection could not be repeated there; equivalent route, UI-module, CSP, authorization, local-service, and source/log security checks passed.

All temporary local identities and catalog/Storage fixtures were removed. The ignored local browser configuration remains untracked.

See `docs/CATALOG_DATA_MIGRATION.md` for the workflow and `docs/M07B3_REMOTE_IMPORT_RUNBOOK.md` for the prohibited-until-accepted remote steps.
