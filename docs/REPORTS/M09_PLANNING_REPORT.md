# M09 Browser-Assisted Validation — Planning Report

**Date:** Thursday, July 30, 2026
**Status:** Planning package complete; pending MASTER decisions
**Accepted M08 closeout:** `722cd6bd162e4847543aa1558a16602b4f27229d`
**Planning branch:** `planning/m09-browser-assisted-validation`
**Production actions:** None

## Result

M09 should use a human-gated hybrid: the confirmed Codex in-app Browser for
anonymous and read-only observation, a private human authentication handoff,
human-exclusive execution of every write, sanitized evidence, and the existing
manual browser workflow as a permanent fallback.

This planning stage added documentation only. It did not initialize a browser,
install a package or extension, add MCP configuration, modify the Pages
artifact, connect to Supabase, authenticate, write production data, deploy,
push, merge, or update `chatGPT_Todo.txt`.

The complete proposal is
`docs/M09_BROWSER_ASSISTED_VALIDATION_PLAN.md`.

## Preflight

- `main` was clean before branching.
- `git fetch origin main` completed successfully.
- `HEAD` and freshly fetched `origin/main` were both exactly
  `722cd6bd162e4847543aa1558a16602b4f27229d`.
- Ahead/behind was `0/0`.
- The planning branch was created from that exact commit.
- Production data and configuration were not inspected or modified.
- `.env.local`, Supabase temporary secrets, cookies, sessions, credentials, and
  owner identifiers were not read.

## Architecture reviewed

The review covered:

- the 23-file allowlisted GitHub Pages artifact and deployment workflow;
- static-first public catalog loading and five-Find fallback;
- permanent-ID, slug, legacy, gallery, Share Find, Copy Link, Reserve by
  Message, QR, and Related Finds behavior;
- Seller Manager email/password Auth, role probe, inventory load, save,
  publish, unpublish, archive, restore, and image workflows;
- Supabase RLS, exact column grants, private Storage bucket and download
  policies, audit triggers, and public-ID sequence;
- local pgTAP, Node contract, Pages artifact, clean-checkout, privacy, and
  security validation; and
- M08 Stage B canary, rollback, evidence, and accepted final production state.

## Capability findings

Confirmed locally:

- Mac mini with Apple M4, arm64, 16 GB;
- VS Code `1.130.0`;
- `openai.chatgpt` extension `26.721.41059`;
- Node `v24.18.0`, npm `11.16.0`;
- Chrome `151.0.7922.71`;
- Docker `29.6.1`;
- Codex in-app Browser skill and local control runtime in the current session;
  and
- no project `.codex/config.toml`.

Confirmed absent from this repository or current callable tool set:

- Playwright, `@playwright/test`, and `@playwright/mcp` packages;
- a callable Playwright MCP or Chrome DevTools MCP; and
- a confirmed Chrome plugin/extension control surface.

Supported but not confirmed as enabled:

- in-app Browser Developer mode / full CDP for console and network inspection.

Official product guidance says the in-app Browser is not available directly
inside the Codex CLI or IDE extension; Codex MCP servers can be shared by the
desktop app, CLI, and IDE. The plan therefore keeps VS Code as the source and
report workspace while browser checks run in the desktop app.

## Approaches evaluated

| Approach | Status | Outcome |
| --- | --- | --- |
| Standalone Playwright isolated browser | Technically possible; not installed | Defer for later deterministic local automation |
| Codex in-app Browser | Confirmed current capability; not initialized | Recommended browser surface |
| Playwright MCP / Chrome DevTools MCP for Codex or VS Code | Supported in principle; not installed/exposed | Do not use initially |
| Human-assisted browser checkpoints | Confirmed | Mandatory permanent fallback |
| Hybrid Browser + human auth/writes + fallback | Components confirmed except optional CDP | **Recommended** |

## Recommended security boundary

- new/reset isolated profile with no profile import, sync, extensions, saved
  password, regular-browser session, or persistent test state;
- exact loopback, GitHub Pages, Supabase, and cdnjs origin allowlist;
- read-only default and fail-closed state machine;
- agent control and capture paused while the human authenticates;
- no agent access to passwords, emails, tokens, cookies, sessions, browser
  storage, history, Keychain, UUIDs, or private Storage paths;
- authenticated mode limited to sanitized visible Manager state;
- human-exclusive execution and one-time confirmation for every write;
- no authenticated raw network, console, HAR, trace, or browser-state evidence;
- sanitized evidence plus human review before retention;
- automatic stop on navigation, Auth, security, state, or evidence deviation;
  and
- sign-out, refresh, browser-data clearing, fresh signed-out verification, and
  transient-evidence removal.

## Production canary decision

The plan defines a complete local canary Publish and Unpublish rehearsal using
an ephemeral fictional local fixture.

No production canary is currently permissible:

- `BU-0006` through `BU-0009` must not be published;
- no new production Find may consume `BU-0010`; and
- the next generated public ID must remain `BU-0010`.

The recommended production result is therefore:

```text
SKIPPED-BY-POLICY: NO APPROVED CANARY
```

A production canary requires a separate exact MASTER authorization that
supplies an eligible target without weakening those constraints.

## Principal risks

- prompt injection or misleading page content causing an unexpected action or
  navigation;
- credential, session, email, authorization-header, UUID, or Storage-path
  exposure through screenshots, browser internals, console, network capture, or
  saved browser state;
- an agent or tool treating its own allowlist as a security boundary;
- accidental production state change, stale state, ambiguous writes, or failed
  rollback;
- the Manager's visible session email reaching the agent before redaction;
- QR, clipboard, Share, Reserve, download, or OS-level prompts crossing the
  intended browser boundary;
- browser/tool availability changes and the IDE/desktop surface split;
- incomplete browser-data cleanup that cannot be verified by inspecting the
  prohibited session store; and
- false confidence if browser evidence is allowed to replace existing pgTAP,
  contract, artifact, and security tests.

## Decisions requiring MASTER approval

1. Approve the in-app Browser hybrid and desktop-app browser step.
2. Approve human-exclusive write execution.
3. Approve production read-only validation plus a local-only canary.
4. Accept the production canary policy skip unless a new eligible target is
   separately authorized.
5. Approve Developer mode only for anonymous local/public checks.
6. Approve the exact domain allowlist.
7. Approve use of the existing allowlisted account by the human without Auth or
   role changes.
8. Approve human-only visible email redaction before agent control resumes.
9. Approve the sanitized evidence set, destination, and retention policy.
10. Approve no Playwright, MCP, or Chrome extension installation in the first
    implementation.

## Proposed implementation effort

The recommended hybrid is estimated at **4.5–7.0 engineering days**, plus
MASTER and human-operator review. Standalone Playwright would add approximately
2–4 engineering days. An MCP pilot would add setup plus a separate security and
recovery review.

## Planning files

- `docs/M09_BROWSER_ASSISTED_VALIDATION_PLAN.md`
- `docs/REPORTS/M09_PLANNING_REPORT.md`

No other tracked file is intended to change.

## Validation record

| Validation | Result |
| --- | --- |
| Required-section and mandatory-constraint documentation scan | PASS — 39 required sections/constraints |
| Markdown link scan | PASS — 15 HTTPS links and no broken local Markdown targets |
| Documentation-only scope scan | PASS — exactly the two authorized M09 documents |
| Focused M09 privacy scan | PASS — two files across eight private-value classes |
| Binary-safe M08 security scan | PASS — 61 accepted-base changed paths and 23 artifact files |
| `npm run m08:check:ci` with fictional browser configuration | PASS — inherited repository, Manager, M08, deployment, artifact, security, and diff checks |
| Untracked-document whitespace scan | PASS — both M09 documents |

The final staged diff check and clean post-commit status are performed after
this self-referential report is finalized and are recorded in the handoff.

## Scope confirmation

- Browser initialized or connected: **No**
- Browser, extension, package, dependency, or MCP installed: **No**
- Source or implementation code added: **No**
- Production data or configuration changed: **No**
- Supabase connected or written: **No**
- Auth session created or inspected: **No**
- GitHub Pages or workflow changed: **No**
- Deployed: **No**
- Pushed: **No**
- Merged: **No**
- `chatGPT_Todo.txt` modified: **No**
