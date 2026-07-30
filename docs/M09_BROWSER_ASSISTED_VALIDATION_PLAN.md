# M09 Browser-Assisted Validation Plan

**Milestone:** M09 — Browser-Assisted Validation
**Planning date:** July 30, 2026
**Planning status:** Proposed; implementation requires separate MASTER approval
**Accepted base:** `722cd6bd162e4847543aa1558a16602b4f27229d`
**Production impact of this planning stage:** None

## 1. Executive decision

The recommended M09 architecture is a **human-gated hybrid using the confirmed
Codex in-app Browser for anonymous and read-only observation, with private human
authentication, human-exclusive execution of every write, and a permanent
manual-browser fallback**.

This is the smallest approach that:

- uses a browser capability confirmed in the current environment without
  installing a dependency;
- keeps the browser profile separate from the operator's normal browser;
- supports rendered-page interaction and screenshots;
- can support console and network inspection when separately enabled and
  approved;
- preserves human control over authentication and every write-producing action;
- keeps VS Code as the source, command, diff, and report workspace even though
  the browser interaction itself occurs in the ChatGPT desktop app; and
- can stop safely and fall back to the existing manual acceptance model.

The first M09 implementation should not install Playwright, Playwright MCP, a
Chrome extension, Chrome DevTools MCP, or another browser package. Standalone
Playwright remains the preferred later enhancement if MASTER decides that
machine-repeatable local browser tests justify a new dependency. A browser MCP
server is technically possible in Codex and VS Code, but it is not installed or
exposed in this project, and its origin filters are not a security boundary.

Production validation remains read-only by default. The required publication
and rollback workflow is rehearsed against an ephemeral local Supabase canary.
There is no currently permissible production canary: `BU-0006` through
`BU-0009` must not be published, no new production Find may consume `BU-0010`,
and the next generated public ID must remain `BU-0010`. A production canary
therefore requires a separate MASTER decision that explicitly changes or
supplements those constraints.

## 2. Non-negotiable constraints

M09 belongs only to the development and validation environment. It must not add
browser code, tracking, analytics, test controls, policy exceptions, or
validation assets to the public catalog or Seller Catalog Manager artifact.

The following constraints are mandatory:

- no customer tracking or analytics;
- no credential automation;
- no agent access to passwords, tokens, cookies, sessions, Keychain entries, or
  private identifiers;
- no unattended production writes;
- no weakening of Supabase Auth, RLS, SQL grants, Storage policies, bucket
  privacy, GitHub branch protection, Pages deployment protection, or repository
  protections;
- no publication of `BU-0006`, `BU-0007`, `BU-0008`, or `BU-0009`;
- no production record creation, deletion, migration, sequence advancement, or
  other action that changes the next generated public ID from `BU-0010`;
- read-only behavior by default;
- per-action human confirmation before publish, unpublish, create, edit,
  archive, restore, delete, upload, download, clipboard mutation, message
  initiation, or any other local or remote write;
- automatic stop on unexpected navigation, authorization failure, security
  warning, state conflict, evidence-sanitization failure, or unverified final
  state; and
- complete sign-out, browser closure, browser-data cleanup, temporary-evidence
  cleanup, and final-state verification.

## 3. Accepted system context

### 3.1 Repository architecture

The production application is a strict 23-file GitHub Pages artifact assembled
from an allowlist in `deployment/pages-manifest.json`.

- The public catalog is static first. `BU-0001` through `BU-0005` are the
  protected repository records.
- `data/public-catalog.js` may append only eligible published, non-archived
  Supabase Finds after explicit-column reads, defensive normalization, and
  private-image download through Storage RLS.
- A failed, denied, slow, or malformed remote request restores the protected
  five-Find catalog.
- Public remote responses are not persisted in localStorage, IndexedDB, or a
  Service Worker.
- The Seller Catalog Manager is a framework-free browser application at
  `/admin/`, built from `admin-src/`.
- Authentication uses Supabase email/password with persistent sessions and an
  exact `owner`/`editor` role probe. Authentication alone grants no catalog
  access.
- RLS and SQL grants, not hidden UI controls or client-side validation, are the
  authorization boundary.
- Publish and Unpublish already require a Find-specific in-application
  confirmation, an expected-state write predicate, a duplicate-submission
  guard, and an exact fresh-read verification.
- Save, archive, restore, image upload/replacement, and alternative-text changes
  are also writes, even where the current Manager does not show a second
  confirmation. The M09 outer control plane must gate them all.
- The Manager has no hard-delete control. Migration-maintenance code contains
  deletion paths, but those routes are excluded from the production Pages
  artifact and are out of M09 scope.

The accepted production state is:

- exactly five public static Finds;
- `BU-0006` through `BU-0009` active, hidden, and unpublished;
- the `find-images` bucket private;
- no change to Auth users, roles, policies, grants, Storage, or GitHub
  configuration; and
- next generated public ID `BU-0010`.

### 3.2 Existing validation and deployment controls

The repository already provides:

- `npm run m08:check` for full local database, RLS, Storage, Manager, public
  adapter, Pages, security, and diff validation;
- `npm run m08:check:ci` for tracked-only clean-checkout validation without
  Docker or private configuration;
- `npm run pages:check` for a deterministic Pages artifact built with fictional
  browser configuration;
- `scripts/security-scan-m08.mjs` for binary-safe credential and private-value
  scanning;
- pgTAP tests for actual local RLS and Storage behavior;
- extensive Node contracts for public details, galleries, sharing, reservation,
  QR behavior, related Finds, Manager authorization, publication, and failure
  recovery; and
- a GitHub Pages workflow that validates pull requests and deploys only
  accepted `main` pushes or controlled `main` manual dispatches.

M09 browser validation complements these contracts. It does not replace unit,
integration, pgTAP, artifact, or security scans.

### 3.3 Current local capability inventory

| Capability | Classification | Planning consequence |
| --- | --- | --- |
| Mac mini, Apple M4, arm64, 16 GB | Confirmed locally | Compatible with current Chrome, Node, VS Code, and browser automation choices. |
| VS Code `1.130.0` and `openai.chatgpt` extension `26.721.41059` | Confirmed locally | VS Code remains the code and report surface. |
| Node `v24.18.0`, npm `11.16.0`, Chrome `151.0.7922.71`, Docker `29.6.1` | Confirmed locally | Sufficient host tools exist for later approved browser or container experiments. |
| Codex in-app Browser skill and its local control runtime | Confirmed in this session; deliberately not initialized during planning | Can navigate, inspect, click, type, and capture screenshots. The built-in browser uses a profile separate from the regular browser. |
| Browser Developer mode / full CDP | Supported by the product, but current enablement and workspace policy are unverified | Treat console/network access as unavailable until a human verifies settings and grants per-site approval. Never use it on authenticated traffic unless the evidence policy is separately approved. |
| Browser inside Codex CLI or the VS Code Codex extension | Unsupported by current official guidance | Browser work requires the desktop-app surface. The IDE can use MCP, not the built-in Browser. |
| Project `.codex/config.toml` | Not present | No project-scoped browser MCP policy currently exists. |
| Playwright, `@playwright/test`, or `@playwright/mcp` in this repository | Not installed | Any use requires a later dependency/configuration decision and lockfile review. |
| Callable Playwright MCP or Chrome DevTools MCP in this session | Not exposed | Do not claim or rely on either integration. |
| Chrome plugin / extension control for this Codex session | Not confirmed or listed | Treat as unavailable. Do not use the operator's regular Chrome profile. |
| Secure erasure of browser data verifiable by the agent | Uncertain | Cleanup is a human-observed control followed by a fresh-session no-reuse check; the agent never inspects the underlying store. |

Official Codex guidance states that the built-in Browser is available in the
desktop app, uses a separate profile, and is not available in the CLI or IDE
extension. It also states that full CDP can inspect console and network data and
requires explicit approval. Codex clients do support project- or host-scoped
MCP servers. See [Browser](https://learn.chatgpt.com/docs/browser) and
[Model Context Protocol](https://learn.chatgpt.com/docs/extend/mcp).

## 4. Option comparison

### 4.1 Concise matrix

| Approach | Current status | M4 / VS Code fit | Session and credential isolation | Evidence | Complexity / maintenance | Principal limitation | Decision |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Standalone Playwright test runner in an isolated browser | Technically possible; not installed | Strong on M4; runs beside VS Code | Strong browser-context isolation, but saved auth state contains impersonation-capable cookies/headers and is prohibited | Strong screenshots, traces, console, and network | Medium; package, browser binaries, tests, upgrades, and CI ownership | Credential-safe Manager use still needs a private human handoff and strict prohibition on saved storage state | Defer as deterministic local enhancement |
| Codex in-app Browser | Confirmed in current desktop session; not initialized | Strong on M4; browser steps are outside VS Code | Separate browser profile; human login handoff required; no cookie/storage inspection | Screenshots confirmed; console/network possible only with separately approved Developer mode | Low initial maintenance | Not available directly in CLI/IDE; authenticated CDP can expose sensitive internals | Use as recommended automation surface |
| Playwright MCP or Chrome DevTools MCP for Codex/VS Code | Supported in principle; not installed/exposed | Strong single-workflow fit after setup | Isolated profiles are possible, but the MCP server and agent have broad browser visibility; regular-profile extensions are unacceptable | Strong interaction, screenshots, console, network, and traces | Medium to high; server lifecycle, npm/browser upgrades, tool policy, and security review | Playwright documents that its origin filters and MCP itself are not security boundaries; Chrome DevTools can expose or modify all browser data | Do not use in initial M09 |
| Permanent human-assisted browser checkpoints | Confirmed; no installation | Strong but manual | Best credential privacy when the human owns login and sensitive actions | Screenshots and DevTools evidence are manual and less reproducible | Low technical / high operator effort | Higher omission risk and weaker repeatability | Mandatory fallback |
| Hybrid: in-app Browser + human auth/writes + manual fallback | Components confirmed except optional CDP | Strong overall; source work stays in VS Code | Best available balance: isolated profile, private login, agent read-only, human-exclusive writes | Strong public screenshots; authenticated evidence deliberately narrower and sanitized | Low to medium | Requires disciplined handoffs and a surface switch from VS Code | **Recommended** |

### 4.2 Complete criteria matrix

| Required criterion | Standalone Playwright | Codex in-app Browser | Browser MCP / Chrome tool | Human checkpoints | Recommended hybrid |
| --- | --- | --- | --- | --- | --- |
| Mac mini M4 and VS Code workflow | Native arm64 macOS fit; tests and commands run from VS Code | Native desktop-app fit; browser step requires leaving VS Code | Native fit after server/extension setup; strongest potential VS Code integration | Any local browser; checklist and reports remain in VS Code | Source work in VS Code, browser work in desktop app, manual fallback in a private browser |
| Authenticated-session isolation | Fresh nonpersistent BrowserContext is strong | Product-documented profile is separate from regular browser | Isolated profile possible; persistent/extension modes are unsafe for M09 | Private-window isolation depends on human discipline | Reset in-app profile plus private human handoff; no persistent exported state |
| Credentials hidden from agent | Possible only with a paused headed handoff; saved `storageState` prohibited | Possible with paused human entry and post-login visible-identifier redaction | Difficult to guarantee because tool servers can expose broad DOM/network/browser state | Strongest when human owns all login steps | Required human handoff; authenticated agent tools are deliberately restricted |
| Inspect public pages | Strong and deterministic | Confirmed interaction surface | Strong after installation | Yes, manually | Agent uses in-app Browser; human can take over |
| Inspect Manager pages | Technically strong, but authenticated restrictions reduce automation | Yes after human handoff | Technically strong, with higher session-exposure risk | Yes, manually | Sanitized inventory state only; no editor or hidden-state inspection by default |
| Screenshots | Native and repeatable | Confirmed | Native after setup | Manual | Public automated; Manager sanitized and human-reviewed |
| Console/network evidence | Strong listeners, traces, and routing | Developer mode supports CDP, but current enablement is unverified | Strong; Chrome DevTools MCP is especially capable | Manual DevTools | Anonymous only by default; authenticated evidence excludes raw console/network |
| GitHub Pages support | Yes; ordinary local/public HTTP targets | Yes; local and public navigation documented | Yes after setup | Yes | Yes, with exact project subpath and origin checks |
| Supabase support | Yes; browser makes ordinary Auth/Data/Storage requests | Yes; existing application client remains authoritative | Yes after setup, but raw Auth traffic raises risk | Yes | Public reads and sanitized Manager UI only; no direct database tooling |
| Installation and maintenance | Medium: package, browser binaries, lockfile, selectors, upgrades, optional CI | Low: already confirmed; settings and product availability still require review | Medium/high: npm server or extension, config, permissions, restart, upgrades, telemetry review | Low technical, high recurring operator time | Low/medium: policy, handoffs, sanitizer, and runbook |
| Security/privacy risk | Medium: powerful automation and sensitive auth-state files | Medium: page control plus optional sensitive CDP | High: broad tool or extension access; MCP and origin filters are not security boundaries | Low tool risk, medium evidence/omission risk | Medium reduced by separation of duties, no authenticated CDP, and human-exclusive writes |
| Reliability and recovery | High for local deterministic tests; selector/version failures possible | Medium; tool/product availability and handoff failures fall back manually | Medium; adds MCP/browser lifecycle and profile-conflict failures | Medium/low repeatability; simple recovery | High operational resilience because the same checklist continues manually |
| Local validation | Excellent, including fault injection | Strong when the local server is reachable | Strong after setup | Strong but manual | Agent-assisted anonymous plus human local Auth/canary |
| Production validation | Safe for read-only checks; unattended writes prohibited | Safe for read-only checks with strict gates | Read-only technically possible but unnecessary added risk | Safest for sensitive production steps | Read-only default; local canary; production write only under separate exact authorization |
| Current Codex-environment limitation | Package absent; no code exists | Browser confirmed, but not initialized; CDP enablement unknown; unavailable in IDE/CLI | No callable Playwright/Chrome MCP and no project MCP config | No technical blocker | Requires desktop-app surface switch and cannot technically prove secure erasure without prohibited store inspection |

### 4.3 Approach details

#### A. Standalone Playwright-controlled isolated browser

Compatibility and capability:

- Playwright supports Chromium, Firefox, and WebKit on macOS and uses isolated
  browser contexts.
- It can capture screenshots, trace interaction, observe console messages, and
  inspect network events.
- It can validate loopback Pages previews, the GitHub Pages production origin,
  Supabase-backed public reads, and the Manager UI.
- It is well suited to deterministic local fault injection, mobile viewports,
  and repeatable anonymous checks.

Security and privacy:

- The human can authenticate in a headed isolated context, but the agent must be
  paused and unable to observe input.
- No `storageState`, cookie export, session export, or persistent user-data
  directory may be created for Manager validation. Playwright warns that saved
  browser state can contain cookies and headers capable of impersonation.
- Network headers and bodies must be disabled or redacted for authenticated
  runs.
- Playwright code or tests must never contain owner email, password, project
  private values, tokens, or Storage object paths.

Complexity and recovery:

- Requires adding and maintaining packages and browser binaries, deciding
  whether they belong in the lockfile, and defining CI behavior.
- Browser and application version changes can make selectors or timing brittle.
- Recovery is strong when contexts are disposable and tests are idempotent.
- Production writes remain inappropriate for unattended Playwright execution.

Conclusion: the best later option for repeatable local anonymous and failure
testing, but unnecessary for the first M09 implementation.

Reference:
[Playwright authentication and state safety](https://playwright.dev/docs/auth).

#### B. Supported Codex Browser tool

Compatibility and capability:

- The current session confirms the in-app Browser skill and control runtime.
- The product documents a browser profile separate from the regular browser,
  localhost and public-page interaction, screenshots, and human-controlled site
  permissions.
- Optional Developer mode can inspect DOM, console, network, and performance
  through CDP after explicit approval.
- GitHub Pages and Supabase are ordinary HTTPS targets; application security
  still comes from Auth, grants, RLS, and Storage policies.

Security and privacy:

- The profile must be newly reset for the run and must not import regular
  browser data.
- The human performs authentication while agent control, screenshots, logging,
  and recording are paused.
- After sign-in, the human replaces the visible `#sessionStatus` email text with
  neutral local display text before returning control. This is a validation-only
  display redaction; it must not alter application source or server state.
- The authenticated phase uses semantic page interaction only. It prohibits
  cookie, storage, session, password, history, Keychain, raw DOM value, arbitrary
  JavaScript, and network header/body inspection.
- Developer mode is off for authenticated Manager validation by default.

Limitations:

- Browser interaction does not run inside the VS Code extension.
- Current Developer-mode enablement and admin policy are unverified.
- The profile cleanup cannot be proven by inspecting browser storage because
  that inspection is itself prohibited.

Conclusion: the lowest-change confirmed surface for M09 when combined with
human gates.

#### C. Browser MCP or Chrome integration for Codex / VS Code

Compatibility and capability:

- Official Codex guidance supports STDIO and HTTP MCP servers in the desktop
  app, CLI, and IDE extension.
- Microsoft's Playwright MCP documents direct Codex configuration, isolated
  profiles, accessibility-based interaction, screenshots, and browser tools.
- Chrome DevTools MCP can inspect console, network, screenshots, and
  performance.

Security and privacy:

- Playwright MCP explicitly states that it is not a security boundary.
- Its allowed- and blocked-origin settings do not secure redirects and must not
  be treated as the sole allowlist.
- A persistent or extension-connected browser can expose existing sessions.
- Chrome extension and DevTools permissions can be broad enough to read or
  change data on all websites, browser history, downloads, and debugger state.
- A regular Chrome profile, remote-debugging port, imported profile, or existing
  logged-in tab is prohibited for M09.

Complexity and recovery:

- Requires installation, project or host configuration, server restart,
  browser lifecycle ownership, upgrades, security review, and tool-approval
  policy.
- MCP startup or browser conflicts add recovery modes not present in the
  current repository.
- It offers a better VS Code fit only after those controls are designed and
  accepted.

Conclusion: technically possible but not installed. It is not recommended for
the first implementation.

References:
[Codex MCP support](https://learn.chatgpt.com/docs/extend/mcp),
[Playwright MCP](https://github.com/microsoft/playwright-mcp), and
[Chrome DevTools MCP](https://github.com/ChromeDevTools/chrome-devtools-mcp).

#### D. Human-assisted browser checkpoints

Compatibility and capability:

- Works in a private or isolated browser without adding project dependencies.
- Preserves private entry of credentials and gives the operator direct control
  of all writes.
- Can perform screenshots, manual DevTools inspection, mobile sizing, QR scans,
  Share-sheet cancellation, and session cleanup.

Limitations:

- Evidence is less repeatable and more vulnerable to skipped steps.
- Console and network capture must be sanitized manually.
- A checklist and two-person review are desirable for any production canary.

Conclusion: mandatory permanent fallback and the recovery path for any tool or
browser failure.

#### E. Human-gated hybrid

The hybrid assigns anonymous navigation and repeatable read-only page
observation to the in-app Browser, but assigns credentials, authentication,
private-identifier redaction, every write, sensitive OS prompts, and final
cleanup to the human operator. If the tool cannot proceed safely, the same
checklist continues manually.

This approach does not claim that the browser tool is a security boundary.
Instead, it combines:

- browser-profile separation;
- explicit domain permissions;
- an external policy state machine;
- strict tool prohibitions in authenticated mode;
- human-exclusive write execution;
- RLS and existing Manager confirmations;
- sanitized evidence; and
- independent final-state verification.

## 5. Proposed architecture

```text
MASTER approval
      |
      v
Human control plane --------------------+
  - approves exact scope                |
  - performs private authentication     |
  - executes every write                |
  - owns abort and cleanup              |
      |                                 |
      v                                 |
Validation policy / state machine       |
  - read-only default                   |
  - exact origin + action allowlists    |
  - per-action one-time confirmation    |
  - stop-on-deviation                   |
      |                                 |
      v                                 |
Isolated validation browser             |
  - anonymous agent observation         |
  - post-auth restricted read-only view |
  - no normal-profile import            |
      |                                 |
      +----------+----------------------+
                 |
       +---------+----------+
       |                    |
GitHub Pages public     Seller Manager
read surface            Auth + RLS writes
       |                    |
       +---------+----------+
                 |
             Supabase
      Auth / Data API / Storage

Evidence boundary:
raw transient capture -> sanitizer -> human review -> approved evidence only
```

### 5.1 Boundary rules

1. **Public artifact boundary:** no M09 file is added to
   `deployment/pages-manifest.json`, `dist/pages`, public HTML, Manager HTML,
   runtime configuration, or GitHub Pages deployment inputs.
2. **Repository boundary:** future M09 scripts, tests, templates, and reports
   live under development-only paths and are rejected if the Pages inventory
   includes them.
3. **Browser boundary:** the validation profile is isolated from the regular
   profile and has no imported history, bookmarks, extensions, passwords,
   cookies, or sessions.
4. **Credential boundary:** credentials move only from the human to the
   Manager's sign-in fields while agent control and capture are paused.
5. **Authorization boundary:** existing Supabase Auth, the exact role probe,
   grants, RLS, and Storage policies remain authoritative.
6. **Action boundary:** the agent may propose a write but cannot approve or
   execute it. The human performs the exact action after a fresh one-time
   confirmation.
7. **Evidence boundary:** no raw authenticated screenshot, network request,
   console record, or browser state is retained until it passes sanitization
   and human review.
8. **Production boundary:** public and Manager observation are allowed after
   approval; production writes remain disabled unless an exact canary action is
   separately authorized.

## 6. Security and privacy model

### 6.1 Isolated browser profile

The profile must:

- be created or reset specifically for one validation session;
- not be the operator's regular Chrome profile;
- have sync, password saving, autofill, history import, profile import, and
  third-party extensions disabled;
- never connect to a generic remote-debugging port;
- never use a Playwright or MCP persistent user-data directory for Manager
  authentication;
- begin with an anonymous check proving no Manager session is present; and
- be cleared and closed at the end of the run.

### 6.2 Domain allowlist

The human approves exact origins, not wildcard Internet access:

- the loopback Pages preview origin for local work;
- the exact recorded GitHub Pages production origin and project subpath;
- the exact Supabase HTTPS/WSS origin already present in the approved runtime
  configuration;
- `https://cdnjs.cloudflare.com` only for the existing qrcodejs asset; and
- no other origin.

Unexpected top-level navigation, redirect, popup, download origin, share target,
authentication origin, or request host moves the state machine to `ABORTED`.
Tool-specific origin filters are defense in depth only. They do not replace the
state-machine check because Playwright MCP documents that its origin filters do
not secure redirects.

### 6.3 Authentication handoff

1. The agent verifies the signed-out Manager page and blank fields.
2. All agent browser control, screenshots, console/network capture, and
   recording stop.
3. The human confirms the exact Manager origin.
4. The human types the approved account email and password directly.
5. The human completes sign-in and confirms the expected role and inventory
   load.
6. The human clears the email input and changes only the rendered
   `#sessionStatus` text to a neutral value such as `Access verified · owner`.
   No application source, network response, or stored browser state is changed.
7. The human confirms no private identifier is visible in the page or browser
   chrome.
8. Agent control may resume in restricted authenticated read-only mode.

The agent never requests, receives, types, pastes, logs, reads, or verifies the
credential or identifier value. Authentication failure ends the session; the
agent does not attempt password recovery, repeated login, account creation, or
role repair.

### 6.4 Authenticated-mode tool restrictions

Authenticated mode permits:

- visible semantic page state;
- Manager inventory count and public IDs;
- visibility and archived/active labels;
- changing a client-side filter;
- sanitized screenshot capture after the privacy check; and
- sign-out-state observation after the human signs out.

Authenticated mode prohibits:

- cookie, localStorage, sessionStorage, IndexedDB, cache, service-worker,
  history, password, autofill, Keychain, or profile inspection;
- arbitrary JavaScript evaluation;
- raw DOM inspection of hidden values or form controls;
- network request/response headers or bodies;
- Authorization, API-key, token, session, user-object, or Auth-event capture;
- console output that has not first been reviewed by the human;
- browser history or regular-profile access;
- file upload or download;
- clipboard read or write;
- opening edit controls unless a separately approved read-only check requires
  them; and
- every remote write.

### 6.5 Write controls

All local and remote writes require:

- exact action;
- exact target using a public ID or named local fixture, never a UUID;
- exact expected before state;
- exact expected after state;
- rollback action;
- time-bounded one-use human confirmation;
- the human physically executing the UI action; and
- an independent fresh-read verification.

Confirmation of one action never authorizes a related action. Publish approval
does not approve Unpublish. Edit approval does not approve upload. A canceled,
expired, failed, conflicted, or ambiguous action cannot be retried without a new
proposal and confirmation.

Production hard-delete, Auth changes, role changes, SQL, migration, grant, RLS,
Storage-policy, GitHub configuration, deployment, and bulk actions are
prohibited even with an ordinary M09 confirmation. They require a separate
MASTER authorization outside this workflow.

### 6.6 Evidence sanitization

Evidence must remove or replace:

- email addresses and account names;
- UUIDs and private database identifiers;
- Supabase project references in captured hostnames, using `SUPABASE_ORIGIN`;
- Storage object paths;
- passwords, tokens, sessions, cookies, JWTs, API headers, and browser state;
- query or fragment material that is not an approved public route;
- local filesystem paths outside the repository-relative evidence path;
- OS notifications, unrelated tabs, bookmarks, browser history, and desktop
  content; and
- raw prompt, tool, or console content not needed to prove a check.

Public IDs, approved public route paths, HTTP method, sanitized host alias,
status code, duration, check ID, viewport, and pass/fail result may be retained.

No authenticated screenshot is saved until `#sessionStatus`, the email field,
browser chrome, and surrounding desktop have been reviewed. Raw authenticated
network evidence is not retained. The preferred proof is a sanitized
status/endpoint record created after the request, not a HAR.

### 6.7 Session termination

The human must:

1. select **Sign out**;
2. confirm the Manager returns to signed-out state;
3. refresh and confirm inventory is not visible;
4. close every validation tab and popup;
5. clear the isolated Browser data through its settings;
6. close the Browser;
7. open a fresh isolated session and confirm `/admin/` is signed out;
8. close and clear that verification session; and
9. remove transient raw evidence after the sanitized evidence has been
   reviewed.

The agent records only completion of these observable steps. It does not inspect
the browser's cookie or session store.

## 7. Human-versus-agent responsibility matrix

| Activity | Agent | Human operator | MASTER |
| --- | --- | --- | --- |
| Define milestone scope and production permissions | Summarizes and enforces | Reviews | Approves |
| Verify commit, branch, validations, and expected state | Performs read-only checks | Reviews exceptions | — |
| Approve exact domains | Proposes minimum list | Enters/approves permissions | Approves production list |
| Start/reset isolated profile | Provides checklist | Performs and observes | — |
| Anonymous public navigation | May perform | Observes or takes over | — |
| Public screenshots and anonymous console/network evidence | Captures within policy | Reviews sanitization | — |
| Enter email/password or use password manager | **Prohibited** | Performs privately | — |
| Inspect credentials, cookies, sessions, tokens, Keychain, or private identifiers | **Prohibited** | Avoids exposing; may verify privately | — |
| Manager inventory read-only checks | Performs after privacy handoff | Observes | — |
| Propose a write | States exact target, before/after, rollback | Reviews | Production proposal requires approval |
| Confirm a write | Cannot | Provides one-time confirmation | Required for production canary |
| Execute a write | **Prohibited** | Performs exact UI action | — |
| Verify public result after a write | May perform fresh anonymous checks | Observes | — |
| Verify Manager final state | Reads sanitized visible state | Confirms privately | — |
| Execute rollback | Cannot | Performs exact UI action | Required production authority |
| Handle unexpected navigation or security warning | Stops immediately | Closes/contains session | Decides resumption |
| Sign out, clear data, close browser | Records visible result | Performs | — |
| Approve retained evidence | Proposes sanitized set | Reviews every artifact | Accepts milestone evidence |

## 8. Confirmation state machine

| State | Meaning | Allowed transition |
| --- | --- | --- |
| `DISABLED` | No browser capability authorized | MASTER approval -> `PREFLIGHTED` |
| `PREFLIGHTED` | Commit, working tree, expected state, config, allowlist, and evidence directory verified | Start isolated profile -> `ANONYMOUS_READ_ONLY` |
| `ANONYMOUS_READ_ONLY` | Public or signed-out Manager observation only | Auth needed -> `AUTH_HANDOFF`; finish -> `TERMINATING`; deviation -> `ABORTED` |
| `AUTH_HANDOFF` | Agent control and capture paused; human authenticates and redacts visible identifier | Privacy check passes -> `AUTHENTICATED_READ_ONLY`; failure -> `ABORTED` |
| `AUTHENTICATED_READ_ONLY` | Restricted Manager observation | Write needed -> `WRITE_PROPOSED`; sign-out -> `TERMINATING`; deviation -> `ABORTED` |
| `WRITE_PROPOSED` | Exact action, target, before/after, and rollback displayed | Human/MASTER approval as required -> `CONFIRMATION_PENDING`; rejection -> `AUTHENTICATED_READ_ONLY` |
| `CONFIRMATION_PENDING` | One-use confirmation awaiting the human's physical action | Human begins exact action -> `HUMAN_EXECUTING`; timeout/change -> `WRITE_PROPOSED` |
| `HUMAN_EXECUTING` | Agent control paused while human performs one exact UI action | UI result -> `POST_WRITE_VERIFY`; ambiguity -> `ROLLBACK_REQUIRED` |
| `POST_WRITE_VERIFY` | Fresh Manager and anonymous reads compare exact expected state | Match -> `AUTHENTICATED_READ_ONLY` or `RESTORED`; mismatch -> `ROLLBACK_REQUIRED` |
| `ROLLBACK_REQUIRED` | No other work is allowed | New explicit rollback confirmation -> `HUMAN_EXECUTING`; cannot safely rollback -> `ABORTED` |
| `RESTORED` | Canary is hidden, public baseline restored, and no unrelated state changed | `TERMINATING` |
| `TERMINATING` | Human signs out, clears profile, closes browser, and removes transient evidence | Fresh signed-out check -> `TERMINATED`; failure -> `ABORTED` |
| `TERMINATED` | Session complete and evidence sealed | None |
| `ABORTED` | Unexpected origin, auth result, security warning, state, or evidence condition | Cleanup only; new run requires new preflight and approval |

The state machine is fail-closed. Browser restart, tool restart, page refresh,
session recovery, or reconnect never resumes a pending confirmation.

## 9. Approved and prohibited actions

### 9.1 Approved by default in read-only mode

- open the exact local or production public origin;
- inspect Home, Collections, Featured, Latest, Find of the Week, Explore, About,
  and Reserve by Message sections;
- change public and Manager client-side filters;
- open approved public-ID, slug, and legacy routes;
- select gallery thumbnails;
- inspect visible canonical links and public copy;
- capture sanitized public screenshots;
- capture anonymous console messages and sanitized network metadata;
- open signed-out `/admin/`; and
- inspect sanitized Manager inventory labels after the human auth handoff.

### 9.2 Separately confirmed local actions

- click Copy Link only after the human confirms the clipboard will be cleared;
- initiate and cancel the Share or Reserve system sheet without selecting a
  recipient or sending content;
- download a QR only to an approved temporary location followed by deletion,
  although QR destination verification should normally avoid a download;
- publish and unpublish one ephemeral local-only canary through the Manager; and
- inject local-only failure conditions such as blocked Supabase, failed image
  download, missing QR library, timeout, or fictional expired/unauthorized Auth.

### 9.3 Conditional production actions

No production write is currently approved. If MASTER later authorizes a
production canary, the authorization must name:

- one target that is not `BU-0006` through `BU-0009`;
- how the target exists without creating or consuming `BU-0010`;
- Publish as one action;
- Unpublish as a separate mandatory rollback action;
- maximum exposure time;
- expected public paths and state;
- the operator;
- the rollback trigger; and
- the evidence to retain.

### 9.4 Always prohibited in M09

- agent entry or inspection of credentials;
- credential or session reuse, export, storage-state files, or automation;
- regular-profile Chrome, profile import, browser sync, or password manager use;
- raw authenticated HAR, trace, console, network body, header, cookie, storage,
  or history capture;
- unattended or agent-executed writes;
- production create, edit, archive, restore, delete, upload, or bulk action;
- production Auth, role, grant, RLS, Storage policy, migration, sequence,
  deployment, Pages, GitHub variable, or protection changes;
- publication of `BU-0006` through `BU-0009`;
- any action that changes the next generated public ID from `BU-0010`;
- message sending, reservation completion, payment, customer-data entry,
  tracking, analytics, or third-party publication;
- bypassing a browser, Manager, Supabase, GitHub, or OS security warning; and
- continuing after an unexpected state.

## 10. Configuration model

The future M09 implementation may use a development-only, non-secret
configuration validated before browser startup. The conceptual fields are:

| Field | Purpose | Rule |
| --- | --- | --- |
| `schemaVersion` | Locks the policy schema | Exact accepted integer |
| `mode` | `local` or `production` | Production has stricter action policy |
| `publicBaseUrl` | Exact public origin and project subpath | HTTPS for production; loopback for local |
| `managerUrl` | Exact `/admin/` URL | Must be beneath the same accepted base |
| `allowedOrigins` | Network/navigation allowlist | Exact origins; no `*` |
| `allowedPublicIds` | Read targets | Public IDs only, never UUIDs |
| `writePolicy` | `deny`, `local-canary`, or separately approved production canary | Defaults to `deny` |
| `allowedWriteTarget` | One local fixture or separately approved production public ID | Empty when writes denied |
| `allowedWriteActions` | Exact action names | Empty by default; never contains delete |
| `expectedPublicCount` | Baseline public count | Five in current production |
| `expectedManagerIds` | Sanitized inventory expectation | `BU-0006`–`BU-0009` for current production read-only check |
| `redactionSelectors` | Visible privacy surfaces | Includes `#sessionStatus` and sign-in fields |
| `evidenceRoot` | Repository-relative transient/sanitized evidence location | Must not enter Pages artifact |
| `runId` | Non-personal correlation ID | Timestamp plus random non-secret suffix |
| `approvalRecord` | References separate MASTER authorization | Contains no private values |

The configuration must reject:

- credentials, tokens, cookies, sessions, emails, UUIDs, private Storage paths,
  environment-file paths, or secret names;
- non-HTTPS production URLs;
- origins outside the accepted list;
- a production write target of `BU-0006` through `BU-0009`;
- a production create action;
- a wildcard action or origin;
- an evidence path inside `dist/pages`; and
- production write mode without an exact approval record.

## 11. Evidence format

Each run produces a temporary raw area and a candidate sanitized area. Only the
candidate area may be reviewed for retention.

Proposed sanitized inventory:

```text
evidence/m09/<run-id>/
  manifest.json
  summary.md
  checks.jsonl
  console-anonymous.jsonl
  network-anonymous.jsonl
  screenshots/
  checksums.sha256
```

`manifest.json` records:

- schema version and run ID;
- accepted commit and mode;
- browser surface and version when visible without private inspection;
- exact check IDs;
- public base alias;
- viewport;
- start/end timestamps and timezone;
- final outcome;
- final production public count;
- final allowed public IDs;
- confirmation that the Manager is signed out and browser data was cleared;
- filenames and SHA-256 values; and
- sanitizer and human-review results.

`checks.jsonl` records one line per check:

- check ID;
- state-machine state;
- action category;
- sanitized route;
- expected and observed public state;
- pass, fail, skipped-by-policy, or aborted;
- evidence filename; and
- non-private note.

`network-anonymous.jsonl` records only method, aliased origin, approved public
path, status, resource type, and duration. It records no headers, request body,
response body, query values other than approved public route parameters,
project reference, or Storage path.

Authenticated Manager proof is limited to sanitized screenshots and high-level
check results. No authenticated network or console file is retained by default.

## 12. Validation workflows

### 12.1 Anonymous public baseline

Preconditions:

- accepted revision and clean working tree;
- existing non-browser suites pass;
- exact local or production URL approved;
- fresh isolated browser with no Manager session; and
- read-only state machine active.

Checks:

1. Load the public home from a fresh navigation.
2. Verify Home, Collections, Featured, Latest, Find of the Week, Explore, About,
   and Reserve by Message.
3. Verify exactly five public Finds in the accepted order.
4. Verify `BU-0006` through `BU-0009` are absent.
5. Verify current Collection states and Explore count.
6. Verify the three real static images and two accepted fallbacks.
7. Verify neutral fallback behavior when Supabase is unavailable only in the
   local fault-injection run.
8. Capture desktop and mobile screenshots with only public content.
9. Record zero unexpected console errors and only allowlisted network origins,
   or record and stop on any deviation.

### 12.2 Public Find detail and action surfaces

For approved static public IDs:

1. Open a permanent `find.html?id=BU-NNNN` route from a fresh navigation.
2. Verify title, public ID, Collection, price, availability, description,
   condition behavior, and photos/fallback.
3. Verify one-photo and fallback behavior; verify multi-photo behavior against a
   local fixture if required.
4. Verify the canonical public-ID link and page metadata.
5. Open one registered slug alias and one legacy numeric route; require the same
   canonical public-ID destination and preserved project subpath.
6. Verify Related Finds in the accepted order.
7. Verify Share Find opens the system action and cancel it without sending.
8. Verify Copy Link only with separate human clipboard confirmation, then clear
   the clipboard; otherwise validate the visible canonical link.
9. Verify Reserve by Message opens the expected manual message/share path and
   cancel it without selecting a recipient.
10. Verify the QR destination by a human-controlled trusted scanner or separate
    device. Require the exact canonical public-ID URL and project subpath.
11. Do not download the QR unless a separate temporary-file action is approved.

### 12.3 Authenticated Manager inventory loading

1. Open `/admin/` signed out and verify no signup or password-reset flow.
2. Pause agent control and capture.
3. The human authenticates privately and performs visible-identifier redaction.
4. Resume only after the privacy checkpoint.
5. Set **Filter Finds** to **All** and require exactly `4 of 4 Finds shown`.
6. Verify the cards are exactly `BU-0006` through `BU-0009`.
7. Verify all four are Hidden, active, and not archived.
8. Set **Published** and require `0 of 4 Finds shown`.
9. Set **Hidden** and require `4 of 4 Finds shown`.
10. Do not open an editor or perform a write.
11. Return control to the human for sign-out and cleanup.

An authorization denial, unexpected role, unexpected count, unexpected public
ID, published state, archived state, or visible private identifier aborts the
run.

### 12.4 Controlled canary publication and rollback

#### Default local rehearsal

1. Start only the repository's resettable local Supabase stack.
2. Reset to accepted migrations and local seed.
3. Create or load one fictional local-only canary through an approved fixture
   mechanism. It must not affect production or reuse production owner data.
4. Begin with the canary hidden and the local public baseline recorded.
5. Privately authenticate the human to the local Manager.
6. The agent proposes exact local Publish; the human confirms and executes it.
7. Verify the Manager's fresh final state.
8. In a fresh anonymous local page, verify the canary list/detail/image or
   fallback/canonical/Share/Reserve/QR/Related behavior.
9. Return to the Manager. The agent proposes exact local Unpublish; the human
   separately confirms and executes it.
10. Verify the Manager fresh state and a fresh anonymous absence.
11. Reset the local database and verify accepted local seed state.
12. Terminate the browser session and remove transient evidence.

The local fixture should use a clearly fictional ID strategy accepted during
implementation and must not assert anything about the production sequence.

#### Conditional production canary

Under the current constraints, report `SKIPPED-BY-POLICY: NO APPROVED CANARY`.
Do not treat this as a validation failure.

If a later MASTER authorization supplies a permissible target and preserves
`BU-0010`, use the same state machine with:

- one target;
- one human Publish;
- immediate fresh Manager and anonymous verification;
- no other Manager action;
- one separately confirmed human Unpublish;
- fresh verification that the public catalog returned to five;
- proof that `BU-0006` through `BU-0009` remained hidden;
- proof that no data or private Storage object was deleted; and
- an exposure-time limit and automatic rollback trigger.

### 12.5 Failure and fallback testing

Perform active fault injection only locally:

- Supabase Data API unavailable, slow, malformed, or denied;
- one failed sibling request and cancellation of the others;
- Storage download denied, missing, malformed, or failed;
- QR library missing or throwing;
- clipboard unavailable;
- Web Share canceled or unavailable;
- fictional expired session;
- fictional authenticated but unallowlisted user;
- conflict between loaded and current publication state;
- final-state mismatch;
- unexpected redirect, popup, or origin;
- screenshot sanitizer rejection; and
- browser/tool disconnect.

Production failure testing is passive:

- verify known unavailable maintenance and repository-internal paths;
- observe naturally occurring failures;
- never induce repeated Auth failure, traffic load, policy denial, Storage
  probing, or mutation conflict; and
- stop on any warning or unexpected behavior.

Every failure must leave the public static fallback usable and the Manager
either signed out or in a clearly recoverable read-only state.

### 12.6 Evidence collection

1. Assign check IDs before navigation.
2. Capture public evidence only after route and origin verification.
3. Disable authenticated console/network capture.
4. Apply screenshot redaction and scan every candidate artifact.
5. Run credential, email, UUID, Storage-path, environment-file, and project-host
   scans.
6. Have the human review each candidate artifact.
7. Compute checksums only after sanitization.
8. Remove raw transient evidence.
9. Record any skipped-by-policy check honestly.
10. Do not commit evidence until MASTER accepts the evidence set.

### 12.7 Post-test production verification

The closing proof requires:

- five public static Finds in accepted order;
- `BU-0006` through `BU-0009` absent publicly;
- Manager `4 of 4`, all Hidden, none Published or Archived;
- no Find created, edited, archived, restored, deleted, uploaded, or otherwise
  changed;
- next generated public ID still `BU-0010`;
- no Auth, role, grant, RLS, Storage, migration, GitHub, Pages, variable,
  workflow, protection, or deployment change;
- Manager signed out after refresh;
- isolated browser data cleared; and
- no raw private evidence retained.

The sequence claim should be proven from accepted migration/state evidence or a
separately approved read-only database check. Do not generate an ID merely to
test it.

## 13. Reliability and recovery behavior

### 13.1 Reliability and recovery controls

- Each navigation starts from an explicit approved URL, not browser history.
- Each public verification uses a fresh load to avoid a stale in-memory remote
  catalog.
- Each write proposal carries the loaded before state and requires a fresh read
  afterward.
- A tool disconnect invalidates pending confirmation and requires a new
  preflight.
- A browser crash moves directly to cleanup and final-state verification.
- A Manager conflict or ambiguous response allows no second action until a
  human refreshes and the state is independently verified.
- Failure to prove the final state is not success; it triggers rollback or
  abort.
- The manual runbook uses the same check IDs, expected states, and evidence
  schema so it can resume from the last proven read-only checkpoint.

### 13.2 Rollback strategy

Local rollback uses the human-executed Unpublish action, fresh Manager and
anonymous verification, and a complete local Supabase reset. The local browser
profile and transient evidence are then cleared.

Production rollback, if a future canary is separately authorized, prioritizes
human-executed Unpublish of that one canary and a fresh proof that the public
catalog returned to five Finds. If application content rather than catalog
state is faulty, redeploying the last accepted Pages revision follows the
existing controlled deployment runbook and requires separate authority.
Database policy reversal is never an ad hoc rollback: it requires removing the
dependent browser behavior first and applying a reviewed forward migration.
Auth, role, grant, RLS, Storage, GitHub, and deployment changes remain outside
ordinary M09 confirmation.

## 14. Testing strategy

The future implementation should add tests only in development paths:

1. configuration schema and no-secret validation;
2. exact-origin allowlist and unexpected-navigation rejection;
3. state-machine transition and confirmation-expiry tests;
4. prohibited action and target tests, including `BU-0006`–`BU-0009`;
5. sanitizer fixtures for emails, UUIDs, JWTs, cookies, headers, Storage paths,
   Supabase hosts, URL fragments, and filesystem paths;
6. evidence manifest and checksum validation;
7. Pages-manifest exclusion proof;
8. local anonymous browser workflow;
9. local authenticated human-handoff rehearsal;
10. local human-executed canary Publish and Unpublish;
11. local failure/fallback matrix;
12. manual fallback rehearsal;
13. production anonymous read-only acceptance;
14. production Manager read-only acceptance; and
15. final scope, privacy, security, diff, and clean-checkout scans.

Browser evidence never replaces:

- `npm run m08:check`;
- `npm run m08:check:ci`;
- pgTAP RLS and Storage tests;
- Pages artifact validation; or
- the binary-safe security scan.

## 15. Acceptance criteria

M09 may be accepted only when:

1. MASTER has approved the browser surface, human-exclusive write policy,
   production scope, allowlist, evidence retention, and CDP policy.
2. No M09 file or behavior appears in the 23-file Pages artifact.
3. Existing full local and CI-safe M08 validations pass unchanged.
4. The policy defaults to read-only and rejects every prohibited action.
5. The browser begins and ends without a reusable Manager session.
6. The agent never receives or inspects a password, email, token, cookie,
   session, Keychain item, UUID, private Storage path, or private identifier.
7. Anonymous public baseline and Find-detail workflows pass at desktop and
   mobile widths.
8. Manager inventory loads after a private human authentication handoff and
   shows exactly the expected sanitized state.
9. The local canary Publish and separately confirmed Unpublish pass, including
   fresh public verification and local reset.
10. Production canary is either separately authorized and fully rolled back or
    honestly recorded as skipped by policy.
11. Failure/fallback and manual recovery workflows pass locally.
12. Evidence scans and human review find no private value.
13. Final production verification proves five public Finds, `BU-0006` through
    `BU-0009` hidden, and next ID `BU-0010`.
14. No production data, configuration, Auth, policies, grants, Storage, GitHub
    settings, workflow protections, or deployment state changed except an exact
    separately authorized canary transition that was fully restored.
15. All browser data and transient raw evidence are cleared.

## 16. Exact proposed M09 implementation sequence

No step below is authorized by this planning commit.

1. Obtain MASTER decisions listed in section 18.
2. Create an M09 implementation branch from accepted M08 closeout.
3. Reconfirm clean/synchronized Git state and exact production baseline.
4. Run inherited M08 local and CI-safe validations before changes.
5. Add the development-only M09 policy schema, example configuration, action
   classifier, state machine, sanitizer, evidence validator, and manual
   fallback runbook.
6. Add unit tests for config, state, action, redaction, evidence, and Pages
   exclusion. Do not add a browser dependency.
7. Add validation commands that operate only on local configuration and
   evidence; keep them outside the Pages artifact and deployment workflow.
8. Run documentation, scope, privacy, security, Pages, and clean-checkout
   validation.
9. Perform a human-observed in-app Browser capability pilot against the
   fictional local Pages artifact without authentication.
10. Verify whether Browser Developer mode is available. If approved, use it
    only for anonymous local/public evidence. If unavailable, mark
    console/network checks manual without changing approach.
11. Rehearse private human authentication against local Supabase with agent
    capture paused and authenticated restrictions active.
12. Rehearse the local-only canary Publish, public verification, separately
    confirmed Unpublish, local reset, and cleanup.
13. Rehearse every local failure/fallback case and the permanent manual
    fallback.
14. Review and sanitize the local evidence. Remove raw captures.
15. Obtain separate MASTER approval for production read-only validation,
    including exact origins, time window, operator, and evidence set.
16. Run production anonymous baseline and Find-detail checks.
17. Run production Manager inventory checks after private human
    authentication. Perform no write.
18. Record production canary as skipped by current policy unless a separate
    exact authorization resolves the missing canary without violating the
    protected IDs or `BU-0010`.
19. Human signs out, clears browser data, closes the Browser, and completes a
    fresh signed-out verification.
20. Verify final production public and Manager state and the unchanged next ID.
21. Run inherited validations and final documentation, scope, privacy,
    security, diff, and clean-checkout scans.
22. Produce the sanitized M09 implementation and acceptance reports.
23. Obtain MASTER acceptance before any merge, push, evidence retention,
    production canary, or update to `chatGPT_Todo.txt`.

## 17. Estimated implementation effort

| Work | Estimate |
| --- | ---: |
| Policy schema, state machine, action guards, and tests | 1.0–1.5 engineering days |
| Evidence schema, sanitizer, scans, and tests | 1.5–2.0 engineering days |
| Runbook, local browser pilot, auth handoff, and local canary | 1.0–1.5 engineering days |
| Failure/fallback and manual recovery rehearsal | 0.5–1.0 engineering day |
| Production read-only run, final verification, and reporting | 0.5–1.0 engineering day |
| **Recommended hybrid total** | **4.5–7.0 engineering days plus MASTER/operator review** |

Optional additions:

- standalone Playwright anonymous/local suite: add 2–4 engineering days plus
  dependency/browser maintenance;
- Playwright or Chrome DevTools MCP pilot: add 1–2 engineering days for setup
  and at least 1–2 days for threat modeling, permissions, and recovery tests;
- separately authorized production canary: add one controlled operator session
  and review time after an eligible target exists.

## 18. Decisions requiring MASTER approval

1. **Recommended surface:** approve the in-app Browser plus human checkpoints,
   accepting that browser steps occur in the desktop app rather than inside the
   VS Code extension.
2. **Write authority:** approve human-exclusive execution of all writes. The
   agent may propose and verify but never click a write action.
3. **Production scope:** approve production read-only validation and local-only
   canary rehearsal. Alternatively, provide a separate exact production canary
   authorization that does not publish `BU-0006`–`BU-0009` or consume
   `BU-0010`.
4. **CDP policy:** approve Developer mode only for anonymous local and public
   checks, with authenticated Manager CDP off.
5. **Origin allowlist:** approve the exact loopback, GitHub Pages, Supabase, and
   cdnjs origins; reject wildcard access.
6. **Authentication account:** approve human use of the existing allowlisted
   account without creating or modifying an Auth user or role.
7. **Visible-identifier redaction:** approve the human-only validation-time
   replacement of `#sessionStatus` display text before agent control resumes.
8. **Evidence retention:** approve retaining only sanitized public screenshots,
   sanitized Manager screenshots, anonymous network/console metadata, check
   records, and checksums; retain no raw authenticated capture.
9. **Evidence destination:** decide whether the accepted sanitized evidence is
   committed, stored outside Git, or summarized only. Recommendation: commit
   only the final sanitized manifest/report and specifically approved images.
10. **Dependency boundary:** approve no Playwright or MCP installation for the
    first M09 implementation, with a later standalone Playwright decision only
    if repeatability proves insufficient.
11. **Acceptance of policy skip:** approve `SKIPPED-BY-POLICY: NO APPROVED
    CANARY` as the correct production-canary result under current constraints.

## 19. Explicitly out of scope

- implementing or installing a browser in this planning stage;
- public catalog or Manager feature changes;
- embedding test hooks, controls, analytics, or telemetry in production;
- customer tracking, buyer accounts, customer-data storage, payments,
  reservations, or messaging;
- credential automation, password managers, account creation, password reset,
  Auth migration, role changes, or secret management;
- changing RLS, grants, schemas, triggers, Storage policies, bucket privacy, or
  migrations;
- changing GitHub Pages settings, Actions variables, branch protection,
  deployment protection, workflows, domains, or production artifacts;
- production edits, uploads, archives, restores, deletion, migration, or bulk
  publication;
- publication of `BU-0006` through `BU-0009`;
- consuming `BU-0010` or advancing the production sequence;
- regular-profile Chrome, browser-profile import, remote debugging, or
  extension-connected existing sessions;
- cross-browser certification, performance/load testing, accessibility
  certification, penetration testing, CAPTCHA bypass, or third-party account
  automation;
- QR redesign, Share/Reserve redesign, visual redesign, search, editorial
  controls, or broader inventory; and
- updating `chatGPT_Todo.txt` before a later accepted M09 closeout.

## 20. Source notes

Primary current sources consulted for this planning decision:

- [OpenAI / ChatGPT Browser](https://learn.chatgpt.com/docs/browser)
- [OpenAI / ChatGPT Chrome extension](https://learn.chatgpt.com/docs/chrome-extension)
- [OpenAI / Codex Model Context Protocol](https://learn.chatgpt.com/docs/extend/mcp)
- [Microsoft Playwright MCP](https://github.com/microsoft/playwright-mcp)
- [Playwright authentication](https://playwright.dev/docs/auth)
- [Playwright network inspection](https://playwright.dev/docs/network)
- [Chrome DevTools MCP](https://github.com/ChromeDevTools/chrome-devtools-mcp)
- [GitHub Pages custom workflows](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)
- [Supabase Auth sessions](https://supabase.com/docs/guides/auth/sessions)

These sources establish tool capability and risk, not project authorization.
The repository's accepted migrations, runbooks, validation scripts, and M08
acceptance remain authoritative for Between Us production behavior.
