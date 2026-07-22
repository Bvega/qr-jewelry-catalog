# Find Identifier Registry

This registry is the authority for permanent public IDs, current legacy IDs, and stable slugs introduced in M02.

| Public ID | Legacy ID | Stable slug | Current title |
|---|---:|---|---|
| `BU-0001` | 1 | `gold-twisted-rope-bracelet` | Gold Twisted Rope Bracelet |
| `BU-0002` | 2 | `silver-stackable-ring-set` | Silver Stackable Ring Set |
| `BU-0003` | 3 | `pearl-drop-earrings` | Pearl Drop Earrings |
| `BU-0004` | 4 | `layered-gold-chain-necklace` | Layered Gold Chain Necklace |
| `BU-0005` | 5 | `crystal-stud-earrings` | Crystal Stud Earrings |
| `BU-0006` | — | `vintage-ceramic-handbell` | Vintage Ceramic Handbell |
| `BU-0007` | — | `burgundy-montblanc-pen` | Burgundy Montblanc Pen |
| `BU-0008` | — | `hand-painted-decorative-shell` | Hand-Painted Decorative Shell |
| `BU-0009` | — | `vintage-floral-teacup-saucer` | Vintage Floral Teacup and Saucer |

## Public ID rules

- Public IDs are immutable, unique, and independent of title, price, collection, and availability.
- IDs use the uppercase form `BU-NNNN`.
- The next new public ID is `BU-0010`; future records continue the sequence monotonically.
- A public ID is never recycled, even if its Find is sold, archived, removed from discovery, or entered in error.
- Skipped, reserved, or retired values remain unavailable forever and must be recorded here with their disposition before the next release.

## Legacy ID rules

- Numeric IDs 1 through 5 remain bound to the same Finds and the same `item.html?id=N` URLs.
- Legacy IDs are immutable and are never reassigned or recycled.
- A future Find without a pre-existing numeric route does not receive a legacy ID merely to fill a gap.
- Retiring a legacy route requires a separately approved compatibility migration; until then, its mapping remains active.

## Slug rules

- Slugs are unique lowercase ASCII kebab-case strings.
- An established slug is immutable and does not automatically change when a title changes.
- Slugs do not include price, availability, or other mutable wording.
- If a future title-derived candidate is already registered, append the permanent public ID suffix, such as `example-find-bu-0006`.
- Retired slugs remain reserved and are never reassigned to another Find.

There are no separately reserved, skipped, or retired identifiers as of M02.
