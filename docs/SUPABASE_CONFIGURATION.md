# Supabase Configuration Boundary

M07B-1 does not connect browser code to Supabase. `.env.example` lists only empty placeholders for later configuration:

```text
SUPABASE_URL
SUPABASE_PUBLISHABLE_KEY
SUPABASE_PROJECT_REF
```

Only the project URL and publishable key may eventually enter browser configuration. A publishable key identifies the project and relies on grants plus RLS for authorization; it does not make catalog writes safe by itself.

Real environment files are ignored by Git while `.env.example` remains tracked. Do not fill the example with local, CI, staging, or production values.

The following are local/CI-only secrets and must never be committed, logged, placed in browser code, or copied into documentation examples:

```text
SUPABASE_ACCESS_TOKEN
SUPABASE_DB_PASSWORD
SUPABASE_SECRET_KEY
SUPABASE_SERVICE_ROLE_KEY
```

Store them only in an approved secret manager or an ignored local environment file when a later accepted milestone requires them. M07B-1 requests and uses none of these values.
