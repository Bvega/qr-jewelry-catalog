# M07B-3 controlled remote import runbook

## Gate

Do not use this runbook until MASTER has accepted the M07B-3 implementation. Do not begin M07B-4 until the remote import is separately accepted. Use the existing owner account and browser-safe ignored configuration; never place a credential or personal identifier in the repository, terminal output, report, or browser console.

## Controlled steps

1. Confirm the accepted implementation has been merged and pushed through the approved process.
2. Confirm the repository is clean and checked out at the accepted revision.
3. Rerun all M07B-3 local validation, including local Supabase reset, pgTAP, lint, and stop.
4. Review `migration/m07b3-catalog-plan.json` and run `npm run migration:validate`.
5. Apply only the accepted `20260722120000_m07b3_public_id_reservations.sql` migration to the remote project.
6. Confirm remote migration history contains that exact migration and no unapproved migration.
7. Generate the ignored browser configuration with `npm run admin:config`. It must contain only the remote URL, browser-safe publishable key, and project reference.
8. Start the loopback-only server with `npm run admin:serve`.
9. Sign in with the existing approved owner account. Do not create or replace the owner.
10. Open `http://127.0.0.1:3000/admin/migrate-intake.html` directly; it is intentionally unlinked.
11. Run the mandatory dry-run and confirm it freshly reloads the plan, CSVs, Collection registry, identifier registry, and four photo files, then reports zero writes and a ready state.
12. Review `BU-0006` through `BU-0009`, the exact Collections, hidden/unfeatured state, and four verified original images.
13. Check the approval control and type exactly `IMPORT 4 FINDS`.
14. Use the separate final action once.
15. Confirm the workflow reports four complete hidden Finds, with no mismatch or recovery warning.
16. Confirm exactly four approved Storage objects and four primary photo rows exist.
17. Open `/admin/` and confirm 4 of 4 imported Finds are visible to the owner.
18. Confirm none is published or featured and none has an archive timestamp or legacy numeric ID.
19. Confirm the public static catalog is unchanged and exposes none of the four imported drafts.
20. Sign out and stop the loopback server.
21. Record acceptance without personal identifiers, credentials, internal identifiers, or session material.
22. Stop. Do not begin M07B-4 until MASTER accepts the remote import result.

The server must remain bound to `127.0.0.1`. Direct GETs for `migration/`, migration resources under `content-intake/`, the identifier registry, `.env.local`, and `admin/config.js` must return neutral 404 responses. Requests under `/__maintenance/m07b3/` must return 401 without a bearer access token, 403 for an authenticated editor/non-owner, 200 only for an exact owner and exact allowlisted source, and 404 for every non-allowlisted path. Never copy the access token into a URL, command line, report, page source, response, or console. The server validates the token and exact owner role with the browser-safe publishable key only; it has no service-role key, database password, secret key, server credential, or write endpoint.

## Mismatch or partial-failure response

Do not retry blindly and do not overwrite a mismatch. Preserve the public-ID-specific message, stop remaining records, and inspect the database row, expected Storage path, and primary photo metadata through approved owner tooling. An ambiguous upload or metadata result on a pre-existing Find requires manual ownership review; do not delete the observed object or row. If the page reports rollback failure, treat it as a partial failure, stop all remaining Finds, verify exact state through approved owner tooling, rerun the local plan validator, and obtain review before another dry-run. Never infer rollback success from an error-free delete response.
