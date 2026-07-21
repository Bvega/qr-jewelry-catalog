# Seller account activation

## Why activation is separate from sign-in

The Seller Catalog Manager sign-in page accepts an email and an existing password. A newly invited seller does not have that password yet, so invitation completion uses a separate private page at:

```text
http://127.0.0.1:3000/admin/activate.html
```

The activation page is not a registration page. It accepts only the authenticated browser session that the Supabase client establishes from an invitation redirect. There is no signup control, anonymous password-creation path, public password-reset request form, or current-password field.

## Authentication and role gate

Before creating the Supabase client, the page captures one non-sensitive boolean: whether the initial query or fragment contains exactly one `type=invite` flow marker. It does not retain the URL or parse any token value. A missing marker, duplicate marker, or any other exact type—including `recovery`, `signup`, or `magiclink`—fails closed before a persisted session can be used.

Only with that captured invite context does the browser create a dedicated publishable-key Supabase client with normal URL-session detection enabled. The activation client starts with a fresh, page-memory-only Auth storage adapter under its own storage key and sets `persistSession: false`; it cannot read or reuse the Seller Catalog Manager's local-storage session, and its invitation session does not survive the page. It subscribes to Auth state changes before asking the isolated client for the session established by the invitation redirect and accepts only the SDK's initial-session or signed-in events. Auth values remain opaque to the application and are never manually decoded, copied into browser persistence, printed, logged, or rendered.

Invite context and an authenticated invitation session inside that isolated client are both necessary but are not sufficient. After the SDK establishes the session, the page calls `public.current_catalog_admin_role()` and admits only an exact `owner` or `editor` result. A persisted manager owner/editor session is unavailable to activation even when a stale or forged URL contains only `type=invite`. A non-admin invite session is signed out and receives a neutral access-denied state. A missing, expired, or invalid invitation, initialization failure, or role-probe failure remains closed and never reveals allowlist membership or Auth internals.

This preserves the existing Auth user UUID and the existing `private.catalog_admins` row. Activation does not create, replace, or edit either record.

## Password setup behavior

After authorization, the seller enters and confirms a new password. Both fields are required, must match exactly, and accept 12–128 characters. Values are not trimmed or otherwise altered. The page prevents duplicate submission and calls `supabase.auth.updateUser({ password })` only while the role-authorized invitation session is active.

The fields are cleared after validation failure, update failure, or completion. Provider errors are replaced with neutral recovery wording. The page reports success only after the password update is confirmed and the invitation session is signed out. If that sign-out fails, the password is not submitted again; a dedicated control retries only the sign-out.

After the Supabase client establishes the session, residual invitation query or fragment material is removed with `history.replaceState`. The application does not inspect or display the contained values. Successful setup leaves the seller on a completion state with a link to `/admin/` for a fresh email/password sign-in; it never opens the manager under the invitation session.

## Configuration and security boundary

The page loads the ignored `admin/config.js` followed by the committed activation bundle. Browser configuration contains only the Supabase URL, publishable key, and project reference. Activation requires no secret key, service-role key, server-side credential, application server, or database change.

## Expired or invalid invitation recovery

A plain visit, missing session, invalid link, or expired link shows neutral invitation-unavailable wording. Do not create a replacement Auth user and do not change the allowlisted UUID. After MASTER accepts this repair, use the Supabase dashboard to resend an invitation to the existing unconfirmed user, then open the new link while the loopback server is running.

## Post-acceptance manual Supabase dashboard plan

These steps are documentation only. Do not execute them until MASTER acceptance:

1. Keep the existing owner Auth user and allowlist row.
2. Set the temporary development Site URL to `http://127.0.0.1:3000/admin/activate.html`.
3. Add the exact Redirect URLs `http://127.0.0.1:3000/admin/activate.html` and `http://127.0.0.1:3000/admin/`.
4. Save the URL Configuration.
5. Resend the invitation to the existing unconfirmed owner user.
6. Open the new invitation while `npm run admin:serve` is running.
7. Set a new password on the activation page.
8. Confirm the user becomes verified.
9. Sign in through `/admin/`.
10. Verify the owner role gate and empty remote catalog.
11. Restore or replace the Site URL during M07B-4 production deployment.

Use exact `127.0.0.1`; do not substitute `localhost`. Do not include an invitation URL, email, UUID, password, token, or key in repository files or reports.
