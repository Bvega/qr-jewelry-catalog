# Local Supabase Development

The local stack is a development and test environment with local credentials and no production hardening. Never expose it publicly. Run it only on a trusted machine and keep its ports bound to local interfaces or an explicitly local Docker network.

## Requirements

- Node.js 20 or later
- npm
- a running Docker-compatible container runtime

## Reproduce and validate

From the repository root:

```bash
npm install
npm run m08:check
```

`m08:check` requires a running Docker-compatible engine, starts or reuses only this repository's local Supabase stack, runs inherited and M08 browser validation, resets and tests the local database, exercises actual RLS and Storage policies through pgTAP, lints the schema, validates the Pages artifact, runs the security scan, and checks the diff. It exits nonzero rather than substituting mocks if local database verification is unavailable.

For individual local database operations:

```bash
npm run supabase:start
npm run supabase:reset
npm run supabase:test
npm run supabase:lint
npm run supabase:stop
```

`supabase:start` starts the local services and applies migrations and seed data. `supabase:reset` destroys and rebuilds only the local database, then applies the ordered migration and `supabase/seed.sql`. `supabase:test` runs the pgTAP database/RLS suite. `supabase:lint` checks the local database. `supabase:stop` stops this repository's local stack.

Static and Node validation do not require Docker:

```bash
npm run validate:supabase
npm run validate
npm run pages:check
npm run m08:check:ci
```

The seed creates only the approved six Collection records. It creates no users, admins, Finds, relations, photos, objects, credentials, or owner data.

## Local versus production boundaries

Local Supabase and the ignored `admin/config.js` remain development and controlled-maintenance inputs. `npm run pages:check` uses fictional browser configuration and writes only the ignored `dist/pages/` artifact. It does not connect to local or remote Supabase, authenticate an owner, or perform a database or Storage write.

The M08 source adds a hybrid public client, but Stage A does not deploy it or alter the accepted production site. Until a separately approved Stage B, production continues to expose only the five accepted static Finds. Remote `BU-0006` through `BU-0009` remain hidden and unpublished, and the next generated public ID remains `BU-0010`.

The Manager configuration contains only the matching HTTPS project URL, project reference, and browser-safe publishable key (or a structurally validated legacy `anon` key). Public runtime configuration contains only the matching URL and browser-safe key. Those values are visible to every browser and are not privileged secrets. Secret or privileged keys, database passwords, access tokens, refresh tokens, owner identifiers, and authenticated sessions are forbidden. The deployment artifact excludes `admin/activate.html`, `admin/migrate-intake.html`, their bundles, all migration inputs, and every repository-internal path.

The local M08 migration changes only local grants and the local `find-images` bucket during reset. It does not contact the remote project. Stop the local stack with `npm run supabase:stop` after review if it was not already needed for other work.

## Local RLS and Storage verification

`supabase/tests/database/06_m08_controlled_dynamic_publishing.test.sql` uses fictional transaction-scoped rows and local roles to prove:

- anonymous callers can select only the approved columns;
- unpublished and archived Finds remain unreadable;
- published non-archived Finds, photos, and valid relationships are readable;
- unauthorized authenticated users cannot change publication;
- allowlisted owner/editor publication behavior remains authorized; and
- private image objects are readable only while linked to an eligible Find.

The test rolls back its fictional data. It does not authenticate a real owner and does not write remote database or Storage state.
