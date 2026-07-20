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
```

The seed creates only the approved six Collection records. It creates no users, admins, Finds, relations, photos, objects, credentials, or owner data.
