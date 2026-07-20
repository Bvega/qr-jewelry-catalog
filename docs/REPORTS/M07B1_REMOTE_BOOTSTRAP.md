# M07B-1 Remote Supabase Bootstrap Record

**Project:** Between Us Platform / QR Jewelry Catalog  
**Date:** Monday, July 20, 2026  
**Status:** Complete  
**Acceptance:** MASTER accepted

## Remote project

- Project name: `between-us-catalog`
- Region: `East US (North Virginia)`
- Project reference: `vyjyzieteuwvniuhbpqu`
- Repository link: complete

## Migration state

The reviewed M07B-1 migration was applied to the remote project:

```text
20260720120000_m07b1_catalog_foundation.sql
```

Migration history verification showed an exact local/remote match:

```text
Local:  20260720120000
Remote: 20260720120000
```

No owner products or intake records were seeded remotely.

## Authentication and authorization

- The owner Auth user was created through the Supabase administrative flow.
- The user was inserted into `private.catalog_admins`.
- Confirmed role: `owner`.
- No owner email, UUID, password, token, or other identity value is recorded in Git.

## Security review

Supabase Security Advisor result:

- Errors: `0`
- Warnings: `1`
- Warning: leaked-password protection unavailable/disabled on the Free plan
- Disposition: non-blocking for the MVP

The warning does not weaken the catalog RLS or admin allowlist. Revisit it before a paid production launch.

## Browser-safe configuration

The following browser-safe values were copied from Supabase and stored locally:

```text
SUPABASE_URL
SUPABASE_PUBLISHABLE_KEY
SUPABASE_PROJECT_REF
```

They are stored in:

```text
.env.local
```

Verification completed:

- all three values are present;
- `.env.local` is protected by restrictive file permissions;
- `.env.local` is ignored by Git;
- the repository working tree remained clean.

## Secret boundary

The following were not committed or recorded:

- database password;
- Mac login password;
- Supabase access token;
- owner password;
- owner email;
- owner UUID;
- secret key;
- legacy `service_role` key;
- local development secret keys.

## Result

The secure remote foundation is ready for M07B-2 — Seller Catalog Manager.

M07B-2 must use local Supabase for automated implementation testing and must not migrate the four approved intake Finds. Remote manual acceptance occurs only after MASTER review.
