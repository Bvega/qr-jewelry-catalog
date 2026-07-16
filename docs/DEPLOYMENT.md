# Current Deployment

## Deployment model

The current application is a static site published to GitHub Pages. Runtime files live at the repository root and use relative links to `styles.css`, `data/items.js`, application scripts, and `assets/images/`.

The repository does not contain a Pages deployment workflow, a checked-in Pages configuration file, or enough metadata to verify the active GitHub Pages source settings. The production source branch and folder are therefore external, unverified settings. They must be confirmed in the repository's GitHub Pages settings before changing deployment behavior.

The M01 workflow only validates compatibility. It does not deploy the site and does not change GitHub Pages configuration.

## Validate before deployment

From the repository root, run:

```bash
node scripts/validate-baseline.mjs
git diff --check
git status --short
```

Do not deploy a revision with a required validation failure. The two known missing-photo warnings are accepted baseline conditions.

## Local preview

If Python 3 is available, serve the repository root without installing a project dependency:

```bash
python3 -m http.server 8000
```

Then open:

```text
http://localhost:8000/
http://localhost:8000/item.html?id=1
```

Stop the preview with `Ctrl-C`. Opening HTML files directly from disk is not the preferred preview method because browser behavior can differ from static HTTP hosting.

## Manual post-deployment checks

Use the actual GitHub Pages base URL shown in the verified external Pages settings. After every deployment:

1. Open the catalog and confirm all five cards render.
2. Open `item.html?id=1` through `item.html?id=5` and confirm each URL shows the correct item.
3. Confirm the three real images load and items 2 and 3 show the deliberate `No photo yet` fallback.
4. Confirm Available, Reserved, and Sold labels render correctly.
5. Follow related-item cards and confirm their numeric legacy URLs resolve.
6. Confirm the share box contains the current item URL.
7. Use **Copy item link**, paste the result, and confirm it retains the correct numeric ID.
8. Confirm a QR code appears, scan it with a phone, and verify the same item URL opens.
9. Use **Download QR code** and confirm a PNG is saved.
10. Check an unknown ID such as `item.html?id=999` and confirm the current item-not-found message appears.
11. Check the catalog and an item page at phone and desktop widths.

Legacy URLs and both existing QR actions must be verified after every deployment. Existing printed QR codes and shared `item.html?id=N` links are migration-critical.

## Known deployment limitations

- GitHub Pages is the recorded current target, but its active source branch/folder settings are not self-contained in this repository.
- Deployment is not reproducible from a repository workflow yet.
- QR generation requires qrcodejs 1.0.0 from cdnjs at page load; the application shows a fallback if it is unavailable.
- Two catalog records reference image files that are intentionally absent and fall back to `No photo yet`.
- M01 does not change, infer, or automate any external GitHub Pages setting.
