# Project State — Between Us Platform

## Current milestone

`M08 — Controlled Dynamic Publishing` is complete and accepted.

The accepted implementation is deployed to GitHub Pages, and migration
`20260728120000_m08_controlled_dynamic_publishing.sql` is applied remotely.
The public experience uses the five protected static Finds as its authoritative
base and can append only remote Finds that pass the accepted publication,
RLS, grant, normalization, and image-delivery contracts.

## Accepted production state

- The public catalog contains exactly five protected static Finds.
- `BU-0006` is active, hidden, unpublished, and preserved after its accepted
  publication and rollback canary.
- `BU-0007` through `BU-0009` are unchanged, active, hidden, and unpublished.
- The Seller Catalog Manager inventory remains available to an authenticated,
  allowlisted owner or editor.
- The `find-images` bucket remains private, with public object access limited
  to photographs linked to eligible published Finds.
- No additional migration, publication, Auth change, role change, policy
  change, grant change, Storage change, or GitHub configuration change is part
  of the M08 closeout.

## Protected contracts

- `BU-0001` through `BU-0005` remain authoritative and available when the
  remote public path fails.
- Permanent public-ID and registered-slug routes, sharing, Copy Link, Reserve
  by Message, QR destinations, galleries, Related Finds, and image fallbacks
  remain intact.
- Publishing and Unpublishing require authenticated role authorization,
  explicit confirmation, expected-state writes, and exact final-state
  verification.
- Unpublish preserves the Find row, photograph metadata, and Storage objects.
- The next generated public ID remains `BU-0010`.

## Acceptance evidence

- `docs/REPORTS/M08_CONTROLLED_DYNAMIC_PUBLISHING_ACCEPTANCE.md`
- `docs/REPORTS/M08_STAGE_B_EXECUTION.md`
- `evidence/M08_STAGE_B_CLOSEOUT_EVIDENCE.zip`
- `evidence/M08_STAGE_B_CLOSEOUT_EVIDENCE.zip.sha256`

## Next planning milestone

`M09 — Browser-Assisted Validation`

M09 remains planning-only. No M09 architecture, migration, feature, browser
module, or implementation has begun.
