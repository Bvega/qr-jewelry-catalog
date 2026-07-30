# M08 Controlled Dynamic Publishing — Stage A Implementation Report

**Date:** Tuesday, July 28, 2026
**Status:** Stage A accepted; superseded by final M08 acceptance
**Accepted base:** `775ac4a3bac0fd096dd8db47f90712fee033a1f9`
**Remote actions during Stage A:** None

## Result

M08 Stage A implements a static-first hybrid public catalog and controlled Manager publication on the feature branch. It does not mark M08 complete or accepted, and it does not authorize Stage B.

The five protected static Finds remain authoritative and first in their accepted order. Eligible remote Finds can be appended only after Supabase RLS permits the row and the browser validates the normalized public contract. Remote rows cannot replace a protected public ID. A missing, slow, denied, or malformed remote response falls back to the five static Finds.

## State and migration decision

The existing `is_published` plus `archived_at` model is sufficient. Public eligibility requires `is_published = true` and `archived_at is null`; existing constraints provide the required catalog completeness. No new publication state, table, or broad redesign was added.

One minimal migration is necessary to close two pre-M08 exposure gaps:

- replace whole-table anonymous/authenticated reads with an exact anonymous public grant and a narrowly extended authenticated maintenance grant;
- make `find-images` private, with anonymous authenticated-object information and download operations allowed only when an object is linked to a photograph for a published, non-archived Find, while bucket listing remains denied; and
- require every photograph path to remain scoped to its parent Find UUID.

The migration changes no catalog, Auth, allowlist, or owner data and was not applied remotely.

## Public and Manager behavior

The public runtime requests explicit approved columns, rejects duplicate, hidden, archived, malformed, or incomplete remote data, downloads eligible private images through the authenticated-object Storage route into page-local blob URLs, and preserves the accepted missing-image fallback. Opaque publishable keys are sent only as `apikey`; validated legacy `anon` JWTs retain the legacy `apikey` plus Bearer combination. Explore, Collection filters and counts, direct ID and slug routes, canonical sharing, Copy Link, Reserve by Message, QR, gallery, and Related Finds use the merged normalized catalog. Static editorial Featured, Latest, and Find of the Week behavior is unchanged.

The authenticated Manager displays publication state and blockers. Publish and Unpublish require explicit confirmation, share the duplicate-submission guard, use an expected-state write predicate, and report success only after an exact refetch. Unpublish preserves the Find, photograph rows, and Storage objects.

## Security boundary

RLS and SQL column grants are primary. Client filtering is secondary. Anonymous browsers receive no administrative or audit columns and cannot read hidden, unpublished, or archived Finds. The public browser uses only the project URL and browser-safe publishable key. No owner session, owner identifier, secret, privileged key, database password, or private environment value is part of the public artifact.

The Pages artifact is allowlisted and excludes activation, migration, intake, environment, source, test, documentation, and repository-internal content. Public dynamic configuration contains only the validated URL and publishable key.

## Verification contract

Full local verification is:

```bash
npm run m08:check
```

That command refuses to substitute mocks for local RLS and Storage verification. It covers inherited baseline, Seller Manager, controlled migration, M08 browser, local Supabase reset and pgTAP, schema lint, Pages artifact, security scan, and diff checks.

Tracked-only review is:

```bash
npm run m08:check:ci
```

The clean-checkout procedure installs the lockfile dependencies, runs the CI-safe command, rebuilds the exact 23-file Pages artifact with fictional browser configuration, and verifies that ignored/private inputs are unnecessary. Execution logs and exact pass counts belong in the external review bundle and final implementation report; this repository report deliberately does not claim MASTER acceptance.

## Rollback and Stage B

Before Stage B, the single local implementation commit can be reverted with no remote cleanup. A later authorized canary rollback begins by unpublishing the canary and restoring the prior accepted Pages revision. Reversing column grants or bucket privacy requires a reviewed forward migration after the dynamic client is removed; dashboard edits are prohibited.

Stage B requires separate MASTER approval. It must start with all four imported Finds still hidden, apply only the reviewed migration, deploy only the accepted artifact, publish at most one reviewed canary, verify its anonymous public and private-image behavior, prove all other hidden Finds remain absent, and prove Unpublish removes the canary without deleting data before any broader publication.

## Stage A handoff status

- `BU-0006` through `BU-0009` remain hidden and unpublished remotely.
- The next generated public ID remains `BU-0010`.
- No push, merge, deployment, GitHub configuration, authentication, remote database write, remote Storage write, or other remote write was performed for Stage A.
- At the Stage A handoff, M08 remained pending MASTER review and acceptance.

See `docs/CONTROLLED_DYNAMIC_PUBLISHING.md` for the complete state, access, failure, validation, rollback, canary, limitation, and exclusion contract.

## Final acceptance

Stage A was accepted, its reviewed migration and implementation were deployed
during the separately authorized Stage B, and the `BU-0006` publication and
rollback canary passed. M08 is complete and accepted. See
`docs/REPORTS/M08_CONTROLLED_DYNAMIC_PUBLISHING_ACCEPTANCE.md`.
