# M09 Browser-Assisted Validation Runbook

**Milestone:** M09 — Browser-Assisted Validation
**Stage:** A — repository foundation and read-only production rehearsal
**Accepted planning commit:** `039ebb3ba21ba22d25b49762a23041049503cfeb`
**Production catalog:** `https://bvega.github.io/qr-jewelry-catalog/`
**Production Manager:** `https://bvega.github.io/qr-jewelry-catalog/admin/`

## Purpose and boundary

This runbook controls a browser-assisted validation session. It does not alter
the production application or its deployment artifact. Production validation
is read-only. It must not change catalog rows, publication state, Auth, roles,
RLS, grants, Storage, the public-ID sequence, GitHub settings, or Pages.

The only approved browser surface is a fresh isolated Codex in-app Browser.
Playwright, browser MCP servers, regular Chrome profiles, extensions, saved
browser state, cookie export, and credential automation are outside Stage A.

## Action classes

Every contemplated action is classified before execution:

| Class | Meaning | Examples |
| --- | --- | --- |
| `OBSERVE` | Agent may perform the exact allowlisted read-only action. | Navigate to an approved URL, read visible public UI, apply a public filter, select a public gallery image, or retain an anonymous screenshot. |
| `HUMAN_CHECKPOINT` | Agent stops and a human performs or authorizes the private or OS-level action. | Private authentication, QR scanning, opening and canceling a native share sheet, signing out, or terminating the isolated session. |
| `PROHIBITED_WRITE` | Action must not occur. Unknown actions fail into this class. | Publish, unpublish, create, edit, save, archive, restore, delete, upload, download, copy to clipboard, send a message, reserve, inspect credentials/cookies/storage, or capture authenticated browser internals. |

The repository policy in `scripts/browser-validation/policy.mjs` is the
executable source for these classes. An unexpected navigation, warning,
authorization result, network service, or state difference stops the run.

## Origin and navigation allowlist

Top-level production navigation is limited to the exact GitHub Pages origin and
project path:

- catalog home, `index.html`, `find.html`, and `item.html`;
- only protected `BU-0001` through `BU-0005`, their five accepted slugs, or
  legacy IDs `1` through `5`; and
- the exact Manager path `/qr-jewelry-catalog/admin/` or its `index.html`.

Optional local previews are limited to exact loopback origins
`http://127.0.0.1:4175` and `http://127.0.0.1:3000`. `localhost`, arbitrary
ports, URL credentials, fragments, extra query parameters, non-HTTPS production
navigation, and every other origin are denied.

Anonymous network observation permits only:

- read-only GitHub Pages project requests;
- the exact QR library at
  `https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js`; and
- read-only `/rest/v1/` or authenticated-image download paths at the one exact
  Supabase HTTPS origin loaded by the production runtime configuration.

The Supabase origin is pinned in memory for the run and emitted in retained
evidence only as `https://SUPABASE_ORIGIN`. Authenticated Manager console and
network capture are prohibited.

## Preflight

1. Confirm the branch is `feature/m09-browser-assisted-validation` and its base
   includes accepted planning commit `039ebb3ba21ba22d25b49762a23041049503cfeb`.
2. Confirm the worktree contains no unrelated changes.
3. Run the focused browser-validation tests and the M09 security scan.
4. Create one uniquely named raw-evidence directory with prefix
   `m09-browser-raw-` under the operating system temporary directory, outside
   the repository.
5. Initialize a fresh isolated in-app Browser. Do not import a profile, enable
   sync, save a password, export state, or connect the regular browser.
6. Start with no authenticated session. Developer-mode console/network
   observation, if available, is allowed only during the anonymous phase.

## Anonymous production workflow

Perform the checks in order. Each check records only `PASS` or a concise,
sanitized reason to stop.

| Check key | Required observation |
| --- | --- |
| `home-rendered` | The approved production home renders its Between Us catalog shell. |
| `exactly-five-public-finds` | Exactly five public Find cards appear and resolve to `BU-0001` through `BU-0005`; no additional public Find appears. |
| `collection-filtering` | At least one populated collection filter changes the visible card set and the All filter restores all five. |
| `find-detail` | An approved card opens its matching permanent Find detail. |
| `gallery-primary-photo` | The primary photo renders; if multiple thumbnails exist, selecting one changes only the displayed gallery photo. |
| `canonical-link` | The page canonical is the exact production `find.html?id=BU-NNNN` URL for the displayed protected Find. |
| `share-ui-present-no-completion` | Share Find UI and the canonical share value are visible. Do not invoke native share and do not copy to the clipboard. |
| `qr-present-and-canonical-destination` | A QR image is visible and its destination contract equals the canonical URL. Direct navigation to that same allowlisted URL may validate the destination; agent QR scanning requires a human checkpoint. |
| `reserve-ui-present-no-send` | Reserve by Message UI is visible. Do not activate it and do not send or draft a message. |
| `related-finds` | Related Finds render and an approved related link targets one of the protected five. |
| `static-fallback` | The protected five remain the application fallback when the optional remote catalog read is unavailable or rejected. Prefer an anonymous browser request-failure control if the Browser exposes a safe read-only control; otherwise use the inherited deterministic fault contract and record that evidence source. |
| `console-allowlist` | Anonymous console output contains no unexpected error, credential, private identifier, or security warning. Expected optional-remote fallback output must be concise and sanitized. |
| `network-allowlist` | Every observed anonymous request is a read-only request to GitHub Pages, the exact QR library, or the one pinned Supabase origin and approved path. Record only method, service alias, path class, result class, and count. |

Public Share, Reserve, clipboard, download, external-app, and OS prompts are
never completed. A prompt that cannot be dismissed without side effects is an
immediate stop.

## Private Manager authentication checkpoint

After every anonymous check passes, navigate to the exact Manager URL and stop
agent interaction and capture. Show the human exactly:

> Sign in privately in the isolated Browser. Do not send credentials or identifiers here. When the Manager is ready, reply only READY.

The human enters credentials directly. Credentials, the account email, tokens,
cookies, sessions, password-manager UI, and Auth traffic must not be copied,
described, screenshotted, logged, or returned to the agent.

## Authenticated Manager read-only workflow

After the human replies only `READY`, keep console/network capture off. Do not
take a screenshot or broad semantic snapshot. Query only the visible inventory
region required to establish these checks:

- `private-human-authentication`
- `authorized-manager-ready`
- `BU-0006-active-hidden-unpublished`
- `BU-0007-active-hidden-unpublished`
- `BU-0008-active-hidden-unpublished`
- `BU-0009-active-hidden-unpublished`
- `no-editor-opened`
- `no-write-control-activated`
- `no-authenticated-capture`

The exact expected Manager inventory is `BU-0006` through `BU-0009`, each
Active, Hidden, and unpublished. Do not open an editor, New Find, Edit,
Publish, Unpublish, Archive, Restore, upload, download, save, or other
write-capable control. Do not inspect the session-status region.

If the inventory differs, authorization fails, the Manager redirects, or a
security warning appears, stop with:

> Stop. Leave the page unchanged and report only the visible non-private warning or unexpected destination.

## Evidence policy

Raw screenshots and browser observations are transient and stay outside the
repository. Before retention:

1. Text and structured observations pass through the deterministic sanitizer.
2. Emails, UUIDs, tokens, keys, authorization/cookie values, session or
   clipboard fields, private query values, Supabase identifiers/origins,
   private Storage paths, and personal filesystem/profile paths are removed.
3. A residual private-shape scan must pass.
4. Only anonymous public PNG screenshots may be copied into
   `evidence/m09-stage-a/`.
5. There are no authenticated screenshots, raw console/network captures, HARs,
   traces, browser profiles, cookies, storage state, clipboard captures, or
   private identifiers in retained evidence.
6. A manifest and SHA-256 checksums cover the retained files.

Any sanitization failure stops retention. The raw material remains temporary
until its exact directory is inspected and then removed.

## Cleanup and final verification

The run is incomplete until all cleanup keys pass:

- `isolated-browser-terminated`
- `session-not-exported`
- `authenticated-evidence-not-retained`
- `raw-temporary-evidence-removed`
- `sanitized-evidence-validated`
- `production-state-unchanged`

Terminate the isolated Browser, which invalidates the session for this run.
Never inspect its underlying cookie or storage database to prove cleanup.
Verify that no state file or authenticated capture was exported. Inspect the
exact temporary raw-evidence directory, remove only that directory, and confirm
it no longer exists. Run `npm run m09:check`, review the final diff, and confirm
that the production Pages manifest and all protected platform files remain
unchanged.

The accepted final production state remains exactly five public static Finds;
`BU-0006` through `BU-0009` Active, Hidden, and unpublished; and next public ID
`BU-0010`. Any uncertainty uses the manual fallback: stop agent control, keep
the page unchanged, and continue the same checklist manually in a fresh
private browser only after the deviation is understood.

## Stage A rehearsal disposition

The accepted Stage A rehearsal completed the anonymous production checklist
and the authenticated Manager inventory checklist without a write. The Manager
showed `BU-0006` through `BU-0009` Active, Hidden, and unpublished.

No screenshot, console log, network log, trace, HAR, browser profile, cookie,
storage state, clipboard content, or session export was retained. The final
browser-control connection was unavailable, so termination used the documented
human fallback. The human operator confirmed that the authenticated session
and isolated browser were closed without browser-internal inspection.

The sanitized text-only evidence is
`evidence/M09_STAGE_A_EVIDENCE.zip`, with its adjacent SHA-256 record. This
disposition closes Stage A only; it does not mark M09 complete or authorize a
local or production write canary.

## Stage B Disposable Local Write Canary

Stage B is a localhost-only rehearsal that uses a disposable Supabase stack and
one synthetic Find, `BU-9000`. It is not a production canary and must not use
production credentials, production URLs, production Storage, GitHub Pages,
GitHub writes, repository secrets, workflows, Pages configuration, or the
production public-ID sequence.

The local setup may run `supabase start` and, with explicit MASTER approval,
allow the local Supabase CLI to pull only the official Docker images required
for the existing local stack. That exception is local runtime acquisition only.
It is not npm dependency installation and it must not alter tracked project
configuration.

Before any publish instruction, the harness must prove:

- exact loopback origins only;
- `BU-9000` is Active, Hidden, and unpublished;
- the public adapter still returns the five protected static Finds;
- the repaired fixture photograph is a valid, visible `32x32` PNG;
- the local Storage object downloads and byte-matches the fixture; and
- the next generated production public ID remains `BU-0010`.

The only write checkpoints are human actions in the localhost Manager:

1. publish only `BU-9000`, then reply only `LOCAL PUBLISHED`;
2. unpublish only `BU-9000`, then reply only `LOCAL UNPUBLISHED`.

After publication, the localhost public adapter must show exactly six visible
Finds and validate the `BU-9000` card, detail, visible photo, canonical URL,
Share Find, QR destination, Reserve by Message, Related Finds, Manager
Published-equivalent state, and no unrelated record change.

After rollback, the localhost public adapter must return to exactly five
protected static Finds. `BU-9000` must be no longer publicly visible or
route-resolvable, while its row, photo metadata, Storage object, and relation
remain preserved before reset.

Final cleanup must reset and stop the disposable local Supabase stack, remove
the local account, sessions, test Find, photo row, Storage object, temporary
credential sheet, temporary site, and server state, and confirm no local
Supabase containers remain running unless explicitly required by the standard
local workflow.

The sanitized Stage B text-only evidence is
`evidence/M09_STAGE_B_EVIDENCE.zip`, with its adjacent SHA-256 record. Stage B
does not mark M09 complete and does not authorize any production write.

## Final M09 Acceptance Disposition

M09 is complete and accepted. The accepted capability remains limited to
development and validation work. It does not add browser automation code to the
production artifact, does not authorize unattended production writes, and does
not create a production canary target.

Production writes remain human-exclusive. Localhost write canaries remain
disposable, local-only, and excluded from production data and the production
public-ID sequence.

The final acceptance record is
`docs/REPORTS/M09_BROWSER_ASSISTED_VALIDATION_ACCEPTANCE.md`.
