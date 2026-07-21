# M07B-2 Remote Owner Smoke — Activation Blocker

**Date:** Monday, July 20, 2026  
**Status:** Blocked pending M07B-2R1  
**Repository commit:** `8e202f1d1e9792d808efa2b592476dbcfc01d702`

## Confirmed working

- M07B-2 was accepted, merged into `main`, and pushed.
- Seller Manager automated validation passed.
- Local Supabase pgTAP validation passed.
- Remote migration `20260720130000_m07b2_catalog_admin_role_probe.sql` is synchronized.
- `/admin/` loads from the loopback-only development server.
- The owner Auth user exists.
- The owner UUID remains allowlisted in `private.catalog_admins` with role `owner`.

## Blocker

The owner user is `Waiting for verification / Unconfirmed`.

The original invitation redirects to:

```text
http://localhost:3000
```

On the development machine, that address opens Open WebUI rather than the Seller Catalog Manager.

The actual Seller Catalog Manager is served at:

```text
http://127.0.0.1:3000/admin/
```

The current Seller Manager has sign-in and authorization behavior but no first-time invitation/password-setup screen.

## Root cause

Two conditions combined:

1. Supabase Auth URL Configuration used `http://localhost:3000` as Site URL and had no allowed Redirect URLs.
2. M07B-2 omitted a seller account activation page that can accept the invitation session and call `auth.updateUser({ password })`.

## Safety decision

Do not:

- delete or recreate the owner Auth user;
- change the owner UUID;
- remove or replace the owner allowlist row;
- reuse the old invitation link;
- enter credentials into Open WebUI;
- begin M07B-3.

## Repair

Implement:

```text
M07B-2R1 — Seller Invitation and Password Setup
```

After MASTER acceptance, configure exact `127.0.0.1` Auth URLs, resend the invitation to the existing user, complete password setup, and perform the controlled owner sign-in smoke test.
