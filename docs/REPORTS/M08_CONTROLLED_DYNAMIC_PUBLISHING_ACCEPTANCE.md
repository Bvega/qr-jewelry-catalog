# M08 Controlled Dynamic Publishing Acceptance

**Date:** Thursday, July 30, 2026
**MASTER acceptance time:** 2:30 p.m. EDT
**Status:** Complete and accepted
**Accepted and deployed implementation commit:** `bc7a060338998c27537d74f9e5b37b1732d96aeb`
**Applied migration:** `20260728120000_m08_controlled_dynamic_publishing.sql`
**Evidence ZIP:** `evidence/M08_STAGE_B_CLOSEOUT_EVIDENCE.zip`
**Evidence ZIP SHA-256:** `3d06e8a781beecfa894ab9f32a3aff866cd30349daacf88c509ebfd4ce025abf`

## Stage A acceptance

- The static-first hybrid public catalog and controlled Manager publication
  implementation were accepted.
- The five protected static Finds remain authoritative and available when the
  remote public read path is absent, denied, slow, or malformed.
- Explicit column grants, RLS, private-image delivery, publication
  confirmation, final-state verification, and safe Unpublish behavior passed
  the accepted local and clean-checkout validation contract.
- Stage A introduced one reviewed migration and no additional architecture,
  publication state, table, or browser module.

## Stage B deployment

- Only migration
  `20260728120000_m08_controlled_dynamic_publishing.sql` was applied remotely.
- The accepted implementation commit was pushed to `main` and deployed by the
  normal GitHub Pages workflow.
- Production was verified to serve the accepted public adapter and Seller
  Catalog Manager artifact.
- The pre-M08 Manager artifact mismatch was resolved by deploying the accepted
  implementation. No compatibility grant migration or other database change
  was created or applied.

## Canary and rollback acceptance

- Only `BU-0006` was published for the approved production canary.
- The six-Find public catalog, permanent detail route, photographs, Share Find,
  QR destination, Reserve by Message, and Related Finds behavior passed.
- `BU-0006` was then unpublished through the Manager.
- Anonymous verification confirmed the public catalog returned to exactly the
  five protected static Finds and that `BU-0006` was no longer publicly
  visible or accessible.
- Unpublish preserved the active hidden Find row, photograph metadata, and
  private Storage objects.

## Final protected state

- `BU-0001` through `BU-0005` remain the five protected static public Finds.
- `BU-0006` is active, hidden, unpublished, and preserved.
- `BU-0007` through `BU-0009` are unchanged, active, hidden, and unpublished.
- No other Find was edited or published.
- No Auth user, account role, RLS policy, database grant or privilege, Storage
  policy, repository workflow, variable, secret, or GitHub configuration
  changed outside the accepted M08 migration and implementation deployment.

## Evidence and validation

- The sanitized Stage B execution report is
  `docs/REPORTS/M08_STAGE_B_EXECUTION.md`.
- The evidence ZIP and its adjacent SHA-256 record are committed as the
  accepted closeout evidence.
- The complete accepted M08 validation suite passed with Supabase CLI
  `2.110.0`.
- Documentation, tracked-file, binary-safe privacy, security, and
  clean-checkout checks passed before final closeout.

## Acceptance

```text
M08 — Controlled Dynamic Publishing — COMPLETE AND ACCEPTED
```

## Next milestone

`M09 — Browser-Assisted Validation` is the next planning milestone. M09
remains planning-only; no M09 implementation is part of this acceptance.
