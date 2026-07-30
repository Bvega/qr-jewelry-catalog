# Seller Catalog Manager

## Scope and architecture

The private Seller Catalog Manager is a framework-free browser application at `/admin/`. `admin/index.html` is the semantic shell, `admin-src/` contains modular vanilla JavaScript and mobile-first CSS, and `scripts/build-admin.mjs` produces the committed browser assets with esbuild. M08 adds controlled publication to the existing catalog editing workflow; public reads remain separate and are documented in `docs/CONTROLLED_DYNAMIC_PUBLISHING.md`.

Browser configuration is deliberately separate from the bundle. `admin/config.js` is generated locally and ignored by Git, while the loopback server validates it and exposes only the browser-safe fields at `/admin/runtime-config.js` before `admin/assets/app.js`. Direct requests to `admin/config.js` are denied. The browser receives only the project URL, publishable key, and project reference.

## Authentication boundary and role gate

The manager uses Supabase email/password sign-in with persistent sessions, automatic token refresh, and auth-state observation. There is no public signup control or signup call. Passwords are passed directly to the SDK and the password field is cleared before the asynchronous sign-in completes. Sessions and tokens are never logged.

Authentication alone does not grant catalog access. After a session is restored or created, the browser calls `public.current_catalog_admin_role()`. This security-definer function reads `private.catalog_admins` only for `auth.uid()`, returns `owner`, `editor`, or `null`, and cannot be executed by `anon`. An authenticated caller without an approved role is signed out and shown a neutral access-denied state. RLS remains the authoritative data and Storage boundary for every request.

## Catalog operations

An allowlisted owner or editor can:

- load all Finds, including draft, hidden, and archived records;
- filter by availability, publication, hidden, or archived state;
- create a hidden draft;
- edit title, Collection, USD price, availability, description, condition, publication state, and primary image details;
- review publication eligibility and exact blockers;
- explicitly publish or unpublish one persisted Find after confirmation;
- archive without deletion; and
- restore an archived Find in a hidden state.

Collections are loaded from `public.collections` in `sort_order`. Finds use a deterministic public-ID order. Internal UUID controls, public IDs, audit fields, role data, and creator/updater fields are never exposed as editable form fields or included in update payloads. Submission locking prevents duplicate save requests.

Archiving sets `archived_at` and `is_published = false`. Restoring clears `archived_at` and also sets `is_published = false`; publication always requires an explicit later action. The manager has no hard-delete action.

## Controlled publication

The existing state model remains authoritative: Published means `is_published = true` and `archived_at is null`; Hidden means `is_published = false` and `archived_at is null`; Archived means `archived_at` is set and is never publicly eligible.

Publish is enabled only for a persisted, non-archived Find with a valid unique immutable public ID, title, established Collection, positive USD price, supported availability, nonempty description, valid optional slug, and valid primary-photo metadata when a photograph exists. A photograph is not required because the public experience has an accepted missing-image fallback. The UI lists blockers and disables Publish until they are resolved.

Publish and Unpublish each require a Find-specific confirmation. They use the same submission guard as saving, so a delayed request cannot be duplicated. The update includes the previously loaded publication state and a non-archived predicate; a concurrent publication or archive-state change therefore returns a safe conflict instead of being overwritten. Success is shown only after both the mutation result and an exact fresh read confirm the requested state. Expired sessions, authorization failures, conflicts, request failures, and verification failures receive neutral retry or sign-in guidance.

Unpublishing changes only `is_published`. It never deletes or archives the Find and never removes photograph metadata or Storage objects. Bulk publication is not available.

## Primary image workflow

M07B-2 supports one primary JPEG, PNG, or WebP image up to 10 MiB. The browser validates MIME type and size, reads dimensions, shows a local `blob:` preview, and requires 1–500 characters of alternative text for an upload or replacement.

Objects use `finds/{find-uuid}/{random-uuid}.{extension}` in the private `find-images` bucket. The Manager downloads an authorized object through Storage RLS and creates a page-local `blob:` preview; it does not derive or persist a public object URL. The application never anonymously lists Storage.

For a new image, the object is uploaded before its `find_photos` row is inserted. A metadata failure triggers best-effort removal of the new object and reports that the Find itself was already saved. For replacement, the new object is uploaded, the existing primary metadata row is updated, and only then is the old object removed. If the metadata update fails, the new object is removed and the previous valid image remains active. Cleanup failures are reported as recoverable partial failures.

## User experience and accessibility

The interface is mobile-first, keyboard accessible, and uses visible focus treatment, 44-pixel controls, semantic labels and fieldsets, a skip link, live status regions, non-color-only status copy, image alternatives, loading/empty states, and explicit signed-out, access-denied, editing, saving, uploading, success, and recoverable network-error states.

The shell applies a strict Content Security Policy: scripts and styles are local, connections are limited to local resources and Supabase HTTPS/WSS endpoints, images may additionally use Supabase and `blob:` previews, and inline script, `unsafe-eval`, objects, framing, and external form submission are disallowed.

## Security boundaries

Never place a database password, access token, owner identifier, secret key, or `service_role` key in browser configuration, source, tests, logs, or documentation. A publishable/legacy anon key is not authorization: private access depends on Auth, the self-only role probe, and RLS. `private.catalog_admins` is not exposed through the API.

Anonymous public reads use explicit column grants and published-row RLS. Manager reads and writes still require an authenticated allowlisted role. The Manager never relies on hidden controls or client validation as authorization.

## Limitations

- M08 publication and Unpublish behavior is complete and accepted.
- `BU-0006` through `BU-0009` are active, hidden, and unpublished remotely
  after the accepted `BU-0006` canary and rollback.
- Only one primary image is managed; additional galleries are deferred.
- A primary image is optional for publication under the accepted fallback rule.
- Related Find and Collection administration are not part of the Manager in M08.
- Payments, shipping, messaging, analytics, multi-tenancy, destructive deletion, and public signup are out of scope.
- Bulk publication and editable Featured, Latest, and Find of the Week controls are out of scope.

See `docs/SELLER_MANAGER_LOCAL_SETUP.md` for local setup and troubleshooting.
