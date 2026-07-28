# M07B-4 Deployment Acceptance

**Date:** Monday, July 27, 2026
**Acceptance time:** 10:51 p.m. ET
**Status:** Accepted
**Accepted implementation commit:** `9b275486438594f5b915092dbe7281ca7b94aa51`
**Accepted CI repair commit and deployed revision:** `484eebfd9756841db45df4485437805bb03a3bdc`
**Production URL:** https://bvega.github.io/qr-jewelry-catalog/

## Workflow acceptance

- The GitHub Pages workflow completed successfully for commit
  `484eebfd9756841db45df4485437805bb03a3bdc`.
- Job "Validate and build Pages artifact" passed.
- Job "Deploy accepted main revision" passed.
- The `github-pages` artifact was generated and deployed.

## Public catalog acceptance

- Home, Collections, Explore, About, and Reserve by Message load correctly at
  the production URL.
- Exactly five static public Finds remain visible, in the accepted order.
- `BU-0006`, `BU-0007`, `BU-0008`, and `BU-0009` do not appear publicly.
- The two known unavailable images continue to show the approved
  "NO PHOTO YET" fallback.

## Permalink, sharing, QR, reservation, and Related Finds acceptance

- The `BU-0001` permanent route works:

```text
find.html?id=BU-0001
```

- Product detail, price, availability, Reserve by Message, permanent link,
  Share Find, Copy Link, QR generation, QR download, and Related Finds were
  visually verified in production.

## Seller Manager acceptance

- Production route:

```text
https://bvega.github.io/qr-jewelry-catalog/admin/
```

- Owner authentication succeeded.
- Exactly four remote Finds were displayed:

```text
BU-0006 — Vintage Ceramic Handbell
BU-0007 — Burgundy Montblanc Pen
BU-0008 — Hand-Painted Decorative Shell
BU-0009 — Vintage Floral Teacup and Saucer
```

- All four records were Active.
- All four had Visibility: Hidden.
- Sign-out was completed successfully.

## Publication-state confirmation

- The public catalog remains static and exposes only the five accepted Finds.
- None of `BU-0006` through `BU-0009` was publicly published.
- All four remote Finds remain hidden and unfeatured.

## Security and artifact-boundary confirmation

- Activation and migration routes and tools are absent from the Pages artifact.
- The artifact remains limited to the accepted 21-file allowlist.
- No local migration photos were published or committed.
- No secret key, service-role credential, database password, token, session,
  owner UUID, owner email, or private configuration is recorded here or
  present in the deployed artifact.
- No screenshots are included in the repository for this acceptance.

## Known non-blocking conditions

- Two accepted catalog products still use the "NO PHOTO YET" fallback.
- QR generation still depends on the accepted external qrcodejs CDN library.
- GitHub Actions reported Node.js 20 deprecation warnings for upstream
  actions; both jobs passed. This is recorded as deferred maintenance only
  and does not reopen M07B-4.

## Acceptance

```text
M07B-4 — Deployment and Acceptance — COMPLETE AND ACCEPTED
```

## Next phase

The next milestone remains pending MASTER planning.
