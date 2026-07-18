# Content Intake Workflow

M07A provides a private staging process. It does not publish Finds, change the live catalog, assign permanent public IDs, or move photos into public assets.

## Owner workflow

1. Copy `content-intake/finds-template.csv` to `content-intake/finds.csv`.
2. Copy `content-intake/photo-manifest-template.csv` to `content-intake/photo-manifest.csv`.
3. Delete the clearly labeled sample rows, then add one row per Find.
4. Place raw photos in `content-intake/photos/` without deleting or overwriting source images.
5. Use the approved filenames in `docs/CONTENT_PHOTO_NAMING.md`.
6. Run `node scripts/validate-content-intake.mjs`.
7. Correct every error. Review warnings and supply missing information when available.
8. Run `node scripts/summarize-content-intake.mjs`.
9. Review the summary, especially blocked records and missing or unapproved photos.
10. Submit the completed intake for MASTER review.
11. Do not edit `data/items.js` or `assets/images/` manually.
12. Do not assign permanent public IDs manually.
13. M07B performs controlled migration only after approval.

`owner_notes` in the inventory file and `notes` in the photo manifest are internal. Neither field becomes public automatically.

## Inventory template fields

Every row requires `intake_key`, `title`, `collection`, `price_amount`, `price_currency`, `availability`, `description`, `primary_photo_filename`, and `alt_text`.

- `intake_key` is a unique temporary ID using lowercase ASCII kebab-case.
- `collection` is `jewelry`, `vintage`, `home-decor`, `kitchen`, `collectibles`, or `new-items`.
- `price_amount` is a positive number with at most two decimals and no currency symbol.
- `price_currency` is `USD`.
- `availability` is `available`, `reserved`, or `sold`.
- `description` is factual public copy without unsupported claims.
- `primary_photo_filename` is the exact filename, including its approved extension.
- `alt_text` is a concise visual description.

Optional fields are `condition`, `additional_photo_filenames`, `related_public_ids`, `featured`, and `owner_notes`. Separate multiple photo filenames or relationship references with `|`. Use `true`, `false`, or blank for `featured`. Condition and notes must remain factual; `owner_notes` is internal only.

## Photo manifest fields

Use one manifest row per photo. Required values are `filename`, `intake_key`, `role`, `sequence`, `orientation`, and `owner_approved`; `background` and `notes` are optional.

- `role` is `primary` or `additional`.
- `sequence` is a positive integer and must match the two-digit filename sequence.
- `orientation` is `square`, `portrait`, `landscape`, or `unknown`.
- `owner_approved` is `true` or `false` and cannot be blank.
- Every Find must have exactly one primary manifest row, matching `primary_photo_filename` and sequence `01`.
- Manifest `notes` are internal only.

## What the owner must provide

- title;
- Collection;
- price;
- availability;
- factual description;
- photo;
- concise visual alt text;
- condition when known; and
- optional relationships.

## What M07A does not do

- no publication;
- no public ID assignment;
- no image optimization;
- no QR creation;
- no Facebook Marketplace posting;
- no postcard creation; and
- no live catalog modification.
