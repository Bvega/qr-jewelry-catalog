# M07B-4 Controlled Deployment and Acceptance Runbook

Use this runbook only after MASTER has accepted the complete Stage A implementation report. Complete one numbered step, record its non-private result, and then continue. Stop immediately on an unexpected commit, failed check, missing variable, unexpected catalog count, published imported Find, or unavailable rollback target.

Never paste a key, password, token, UUID, email address, session, or private configuration into ChatGPT, an issue, a commit, a screenshot, a screen recording, or this acceptance record. The publishable browser configuration is public at runtime, but it must still be moved directly from the local file to the GitHub variable form without entering chat or shell history.

## 1. Confirm the accepted implementation

1. Obtain MASTER's explicit Stage A acceptance and the accepted local implementation commit SHA.
2. Run `git switch feature/m07b4-deployment-acceptance`.
3. Run `git status --short` and require no output.
4. Run `git rev-parse HEAD` and require the exact accepted implementation SHA.
5. Run `npm ci`.
6. Run `npm run pages:check` and require `Complete local Pages deployment check: PASS`.
7. Run `git status --short` again and require no output.
8. Stop if any commit, validation result, or working-tree state differs.

## 2. Add the three GitHub repository variables

1. Close screen sharing, recording, and any terminal window that could capture configuration.
2. Open the repository's existing local `.env.local` in a trusted local text editor. Do not print it with a shell command.
3. In GitHub, open the repository, then **Settings → Secrets and variables → Actions → Variables**.
4. Select **New repository variable**.
5. Enter the name `BETWEEN_US_SUPABASE_URL`.
6. Copy only the value after local `SUPABASE_URL=` from the editor and paste it directly into the GitHub variable value field.
7. Save the variable and clear the clipboard.
8. Select **New repository variable**.
9. Enter the name `BETWEEN_US_SUPABASE_PUBLISHABLE_KEY`.
10. Copy only the value after local `SUPABASE_PUBLISHABLE_KEY=` directly into the GitHub variable value field.
11. Save the variable and clear the clipboard.
12. Select **New repository variable**.
13. Enter the name `BETWEEN_US_SUPABASE_PROJECT_REF`.
14. Copy only the value after local `SUPABASE_PROJECT_REF=` directly into the GitHub variable value field.
15. Save the variable and clear the clipboard.
16. Confirm the Variables list shows all three exact names. Do not record or screenshot their values.
17. Confirm no GitHub Actions secret was added; this static deployment requires no secret key.
18. Close `.env.local` without modifying it.

The URL must be the matching HTTPS Supabase project URL. The key must be a modern `sb_publishable_...` key or a validated legacy `anon` key. Never substitute an `sb_secret_...` key, `service_role` key, database password, or access token.

## 3. Enable GitHub Pages for Actions

1. In the GitHub repository, open **Settings → Pages**.
2. Under **Build and deployment**, set **Source** to **GitHub Actions**.
3. Confirm the setting is saved.
4. Do not run a starter workflow; the accepted repository workflow is `.github/workflows/deploy-pages.yml`.

## 4. Merge the accepted implementation locally

1. Run `git switch main`.
2. Run `git status --short` and require no output.
3. Run `git fetch origin`.
4. Run `git rev-parse main` and `git rev-parse origin/main`; require identical SHAs.
5. Run `git merge-base --is-ancestor 00c5def9efa362cbc5a7da89f53d35bdbb24c76e main` and require exit code `0`.
6. Run `git merge --ff-only feature/m07b4-deployment-acceptance`.
7. Run `git rev-parse HEAD` and require the exact accepted implementation SHA.
8. Run `npm ci`.
9. Run `npm run pages:check` and require a pass.
10. Run `git status --short` and require no output.
11. Stop if fast-forward merge is unavailable or any check differs; do not create an unreviewed merge commit.

## 5. Push the accepted main revision

1. Run `git push origin main`.
2. Record the pushed commit SHA. This is public repository metadata, not private configuration.
3. Do not push a tag or create a release.

## 6. Monitor build and deployment

1. In GitHub, open **Actions → Deploy GitHub Pages**.
2. Open the workflow run for the recorded accepted `main` SHA.
3. Confirm **Validate and build Pages artifact** succeeds.
4. Confirm the run checked out the recorded SHA, installed with `npm ci`, passed inherited validation and Pages tests, built `dist/pages`, validated it, and uploaded the Pages artifact.
5. Confirm **Deploy accepted main revision** starts only after the build job succeeds.
6. Confirm the deploy job uses the `github-pages` environment and succeeds.
7. Stop if the run is for another SHA or either job fails. Do not approve or bypass a failed check.

## 7. Record the production URL

1. Open the successful deploy job.
2. Copy the public environment URL shown for the `github-pages` deployment.
3. Confirm its path ends in `/qr-jewelry-catalog/`.
4. Record the URL in the final acceptance record.
5. Do not infer or hardcode a different domain.

## 8. Accept the public catalog

1. Open the recorded production URL in a private browsing window.
2. Confirm Home, Collections, Featured, Latest, Find of the Week, Explore, About, and Reserve by Message render normally.
3. Confirm exactly five public Find cards appear in the accepted order.
4. Confirm no public page or card shows `BU-0006`, `BU-0007`, `BU-0008`, or `BU-0009`.
5. Open `find.html?id=BU-0001` below the recorded project URL and confirm the correct Find.
6. Repeat for `BU-0002`, `BU-0003`, `BU-0004`, and `BU-0005`.
7. Confirm image fallback remains honest for the two accepted unavailable image paths.
8. Confirm Reserve by Message, Share Find, and Copy Link remain available and use the permanent public-ID URL.

## 9. Accept QR, legacy, slug, and subpath compatibility

1. Open `item.html?id=1` below the recorded project URL and confirm it resolves to `BU-0001`.
2. Repeat numeric IDs `2` through `5` and confirm their accepted Finds.
3. Open `find.html?slug=gold-twisted-rope-bracelet` and confirm it resolves to `BU-0001`.
4. Repeat the registered aliases `silver-stackable-ring-set`, `pearl-drop-earrings`, `layered-gold-chain-necklace`, and `crystal-stud-earrings`.
5. On one permanent-ID detail page, confirm the QR code renders.
6. Scan that QR with a separate device or trusted scanner.
7. Require the destination to be the same production project subpath plus `find.html?id=BU-NNNN`, with the matching public ID.
8. Confirm no tested link drops `/qr-jewelry-catalog/`.

## 10. Accept production owner sign-in

1. Navigate to `/qr-jewelry-catalog/admin/` on the recorded production origin.
2. Confirm the Seller Catalog Manager shows the allowlisted sign-in form and no signup or password-reset flow.
3. Enter the existing owner email and password directly into the page. Do not record, paste elsewhere, or expose either value.
4. Select **Sign in**.
5. Confirm access is authorized and the remote catalog finishes loading.
6. Stop if access is denied, the role is not `owner`, or the catalog load fails.

## 11. Verify the exact remote Manager count

1. Set **Filter Finds** to **All**.
2. Require the summary to read exactly `4 of 4 Finds shown`.
3. Confirm the four cards are exactly `BU-0006`, `BU-0007`, `BU-0008`, and `BU-0009`.
4. Do not create, edit, upload, publish, hide, archive, restore, or otherwise mutate a Find during acceptance.

## 12. Verify hidden and unfeatured state

1. Confirm the accepted pre-deployment record at `docs/REPORTS/M07B3_REMOTE_IMPORT_ACCEPTANCE.md` records all four Finds as unfeatured.
2. Inspect each of the four Manager cards and require **Visibility: Hidden**.
3. Confirm none is archived unexpectedly.
4. Set **Filter Finds** to **Published** and require `0 of 4 Finds shown`.
5. Set **Filter Finds** to **Hidden** and require `4 of 4 Finds shown`.
6. Confirm the public Featured, Latest, and Find of the Week sections still contain only accepted static Finds.
7. Confirm the deployment workflow and this runbook performed no remote catalog write and exposed no feature-state mutation control.
8. Record that the accepted unfeatured state is unchanged, all four are hidden, and zero are published.

## 13. Sign out

1. Select **Sign out**.
2. Confirm the Manager returns to the sign-in state.
3. Refresh `/admin/`.
4. Confirm the authenticated catalog is no longer visible.
5. Close the private browsing window.

## 14. Confirm maintenance routes are unavailable

1. Request `/qr-jewelry-catalog/admin/activate.html` and require an unavailable/404 response.
2. Request `/qr-jewelry-catalog/admin/migrate-intake.html` and require an unavailable/404 response.
3. Request `/qr-jewelry-catalog/admin/assets/activate.js` and require an unavailable/404 response.
4. Request `/qr-jewelry-catalog/admin/assets/migrate-intake.js` and require an unavailable/404 response.
5. Request `/qr-jewelry-catalog/__maintenance/m07b3/plan` and require an unavailable/404 response.

## 15. Confirm repository internals are unavailable

1. Request `/qr-jewelry-catalog/.git/config` and require an unavailable/404 response.
2. Request `/qr-jewelry-catalog/.github/workflows/deploy-pages.yml` and require an unavailable/404 response.
3. Request `/qr-jewelry-catalog/.env.local` and require an unavailable/404 response.
4. Request `/qr-jewelry-catalog/admin/config.js` and require an unavailable/404 response.
5. Request `/qr-jewelry-catalog/content-intake/finds.csv` and require an unavailable/404 response.
6. Request `/qr-jewelry-catalog/deployment/pages-manifest.json` and require an unavailable/404 response.
7. Request `/qr-jewelry-catalog/docs/MILESTONES/M07B4.md` and require an unavailable/404 response.
8. Request `/qr-jewelry-catalog/migration/m07b3-catalog-plan.json` and require an unavailable/404 response.
9. Request `/qr-jewelry-catalog/package.json` and require an unavailable/404 response.
10. Request `/qr-jewelry-catalog/scripts/build-pages-artifact.mjs` and require an unavailable/404 response.
11. Request `/qr-jewelry-catalog/supabase/config.toml` and require an unavailable/404 response.
12. Request `/qr-jewelry-catalog/tests/deployment/pages-artifact.test.mjs` and require an unavailable/404 response.

## 16. Rollback

### Deployment-content rollback

1. In **Actions → Deploy GitHub Pages**, identify the most recent successful run for the last accepted revision before the faulty deployment.
2. Record that run URL and commit SHA.
3. If the accepted revision and its repository variables are still valid, use **Re-run all jobs** on that exact successful run.
4. Confirm the rerun is for the recorded old SHA and allow it to complete through build and deploy.
5. If rerunning is inappropriate, create a reviewed revert of the faulty deployment commit on a local branch, run `npm ci` and `npm run pages:check`, obtain MASTER acceptance, merge the revert to `main`, and push it.
6. Confirm the rollback workflow succeeds.
7. Recheck the public home, one permanent-ID route, one numeric route, one slug alias, `/admin/`, owner sign-in/catalog count, sign-out, and unavailable maintenance/internal paths.

### Emergency shutdown

1. In the repository, open **Settings → Pages**.
2. Use the available **Unpublish site**, **Disable**, or **Source: None** control to remove the Pages publishing source immediately.
3. Confirm the production Pages URL is unavailable.
4. Do not delete or modify remote Supabase rows, Storage objects, users, roles, or policies.
5. Record that disabling Pages removes the static public/Manager site only; it does not delete the remote Supabase catalog.

## 17. Final acceptance record

Record only the following non-private information:

```text
M07B-4 PRODUCTION ACCEPTANCE

Accepted implementation commit:
Deployment workflow run URL:
Production URL:
Acceptance date/time and timezone:

Public catalog: PASS/FAIL
Five static Finds and order: PASS/FAIL
BU-0006 through BU-0009 absent publicly: PASS/FAIL
Permanent-ID routes: PASS/FAIL
Legacy numeric routes: PASS/FAIL
Registered slug aliases: PASS/FAIL
QR project-subpath destination: PASS/FAIL
Manager owner authorization: PASS/FAIL
Manager exact count (4 of 4): PASS/FAIL
Four hidden and zero published: PASS/FAIL
Owner signed out: PASS/FAIL
Activation and migration routes unavailable: PASS/FAIL
Repository internals unavailable: PASS/FAIL
Rollback target run and commit recorded: PASS/FAIL

Private values recorded: No
Remote catalog writes performed during acceptance: No
Final decision: ACCEPTED / REJECTED
```

Do not add an owner email, UUID, key, password, token, session, or screenshot to this record.
