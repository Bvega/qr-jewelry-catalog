# M09 Stage B Execution Report

**Milestone:** M09 - Browser-Assisted Validation
**Stage:** B - disposable localhost write canary
**Date:** July 30, 2026
**Status:** Stage B local canary accepted; M09 remains open
**Stage A implementation commit:** `58c60c2c9ff40c0a904373b83f235758bb6041bb`

## Boundary

Stage B used only the disposable local Supabase stack and exact loopback
origins. It did not use production credentials, production URLs, production
Supabase, production Storage, GitHub Pages, GitHub writes, or remote
configuration.

The only write actions were the human-performed localhost publication and
rollback of `BU-9000`. No production Find was created, edited, published,
unpublished, archived, restored, deleted, or otherwise changed. `BU-0010`
remained unconsumed.

## Docker Image Exception

MASTER approved local runtime acquisition for the official Docker images
required by `supabase start`. The images were pulled only by the existing local
Supabase CLI workflow, required no credentials, and did not alter tracked
repository configuration.

The local runtime used official `public.ecr.aws/supabase/*` images for the
disposable Supabase stack. They are recorded in the Stage B evidence package as
local Docker runtime images only.

## Photo Repair

The accepted blocker was repaired locally by replacing the invalid visually
empty fixture with a deterministic test-only PNG. The repaired fixture is:

- PNG;
- `32x32`;
- `330` bytes;
- fully visible with `1024` visible pixels; and
- nontrivial with `3` colors.

The fixture is validated before upload. The uploaded local Storage object is
then downloaded and byte-checked before any publication checkpoint is allowed.

## Local Canary Results

Pre-publication verification passed:

- `BU-9000` existed locally as Active, Hidden, unpublished;
- the public catalog remained at the five protected static Finds;
- `BU-9000` was not anonymously visible;
- its photo row and local Storage object existed; and
- the stored object byte-check and strict decoder checks passed.

After the human published only `BU-9000`, verification passed:

- the public adapter returned exactly six visible Finds;
- the `BU-9000` card and detail data rendered;
- the repaired photo rendered from the downloaded object;
- the canonical localhost URL was correct;
- Share Find, QR destination, Reserve by Message, and Related Finds contracts
  rendered without external completion; and
- no unrelated record changed.

After the human unpublished only `BU-9000`, verification passed:

- the public adapter returned to exactly the five protected static Finds;
- `BU-9000` was no longer anonymously visible or route-resolvable;
- the `BU-9000` row, photo metadata, local Storage object, and relation were
  preserved before reset; and
- the Manager-equivalent state was Active, Hidden, unpublished.

## Cleanup

Final cleanup reset and stopped the disposable local Supabase stack, removed the
local account, session, test Find, photo row, Storage object, credential sheet,
temporary site, and server state, and left no local Supabase containers running.

The in-app Browser connector was unavailable in this VS Code session, so
automated browser sign-out/close could not be performed. No cookies, storage,
headers, sessions, credentials, browser profiles, or authenticated network data
were inspected or retained.

## Evidence

- Evidence ZIP: `evidence/M09_STAGE_B_EVIDENCE.zip`
- Adjacent checksum record: `evidence/M09_STAGE_B_EVIDENCE.zip.sha256`
- Evidence type: sanitized text only
- Raw screenshots, browser logs, HARs, traces, cookies, storage state,
  authorization headers, sessions, credentials, personal paths, UUIDs, and
  private identifiers: not retained

## Validation

The final validation gate includes:

- `npm run m09:check`;
- `npm run m09:stage-b:check`;
- inherited M08 and M09 Stage A validation;
- Stage B evidence integrity validation;
- privacy and security scanning;
- tracked-diff validation; and
- clean-checkout validation using already installed locked dependencies.

No npm package, Playwright, MCP, browser extension, or new tool installation was
performed. Nothing was pushed, merged, deployed, or modified remotely.

## Final acceptance note

Stage B was accepted by MASTER. M09 is complete and accepted. See
`docs/REPORTS/M09_BROWSER_ASSISTED_VALIDATION_ACCEPTANCE.md`.
