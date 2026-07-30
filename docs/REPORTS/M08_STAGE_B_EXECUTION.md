# M08 Stage B Controlled Deployment and Canary Execution

Status: Accepted by MASTER on Thursday, July 30, 2026.

## Authorized production changes

- Deployed accepted commit `bc7a060338998c27537d74f9e5b37b1732d96aeb` by normal fast-forward push to `main`.
- Applied only migration `20260728120000_m08_controlled_dynamic_publishing.sql`.
- Published only `BU-0006` for the approved canary.
- Unpublished `BU-0006` after successful anonymous verification.
- Created no additional migration and no final acceptance commit.

## Deployment verification

- Local `main`, `origin/main`, and the deployed Pages workflow resolve to the accepted commit.
- The GitHub Pages build and deployment completed successfully.
- Production Manager shell, Manager bundle, and public M08 adapter matched the accepted artifact bytes.
- The Pages workflow, expected configuration-name set, and workflow bytes remained unchanged.

## Canary verification

Before publication, the anonymous catalog contained exactly the five protected static Finds and no dynamic Find.

While `BU-0006` was published:

- the anonymous catalog contained six Finds;
- the permanent public detail route resolved;
- private photographs downloaded through the approved public Storage policy;
- Share Find and the canonical link contract passed;
- the QR destination used the permanent public-ID route;
- Reserve by Message remained available;
- Related Finds exposed no hidden endpoint.

After unpublication:

- the anonymous catalog returned to exactly five protected static Finds;
- `BU-0006` was no longer publicly visible or anonymously resolvable;
- its hidden Storage path was no longer anonymously downloadable;
- its active hidden database row, photo metadata, and Storage object remained present.

## Protected remote state

- `BU-0007`, `BU-0008`, and `BU-0009` remained hidden, active, unpublished, and exact against the accepted import plan.
- All four imported Finds retained exact catalog fields and primary-photo metadata.
- All four private Storage object records remained present with the accepted media type and byte size.
- The existing owner mapping remained singular; no additional account or catalog role appeared.
- The accepted catalog grants, twenty catalog RLS policies, five Storage policies, role probe, and scoped-photo constraint remained intact.
- The remote migration history records the approved M08 migration; no additional local migration exists.

## Final validation

The complete accepted M08 validation suite passed with Supabase CLI `2.110.0`, including:

- inherited repository validation;
- Seller Catalog Manager tests;
- controlled migration tests;
- M08 public adapter and UI tests;
- local database reset and pgTAP verification;
- schema lint;
- Pages artifact validation;
- binary-safe security scan;
- diff checks.

The validation used only the local Docker-backed Supabase stack and performed no production write.

## Closeout boundary

No additional Find was published, edited, archived, restored, or deleted. No account, role, grant, policy, privilege, Storage policy, or GitHub configuration change was authorized or observed outside the accepted M08 migration and deployment.

MASTER accepted M08 after reviewing this report and its sanitized evidence
package. See `docs/REPORTS/M08_CONTROLLED_DYNAMIC_PUBLISHING_ACCEPTANCE.md`.
