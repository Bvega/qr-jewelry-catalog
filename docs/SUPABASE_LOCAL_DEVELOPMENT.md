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
```

The seed creates only the approved six Collection records. It creates no users, admins, Finds, relations, photos, objects, credentials, or owner data.

## Local versus production boundaries

Local Supabase and the ignored `admin/config.js` remain development and controlled-maintenance inputs. `npm run pages:check` uses fictional browser configuration and writes only the ignored `dist/pages/` artifact. It does not connect to local or remote Supabase, authenticate an owner, or perform a database or Storage write.

The deployed public catalog continues to read the five accepted Finds from static repository JavaScript. It does not read Supabase and does not expose remote `BU-0006` through `BU-0009`. The production Seller Manager is the only deployed Supabase client, and it loads remote catalog data only after email/password authentication and the accepted `owner` or `editor` role probe succeeds.

Production configuration contains only the matching HTTPS project URL, project reference, and browser-safe publishable key (or a structurally validated legacy `anon` key). Those values are visible to every browser and are not privileged secrets. Secret keys, `service_role` keys, database passwords, and access tokens are forbidden. The deployment artifact excludes `admin/activate.html`, `admin/migrate-intake.html`, their bundles, all migration inputs, and every repository-internal path.
