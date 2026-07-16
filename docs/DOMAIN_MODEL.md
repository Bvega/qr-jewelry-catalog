# Find Domain Model

M02 establishes the normalized Find as the authoritative catalog record. The five current records live in `data/items.js` and are exposed synchronously as the read-only browser global `window.BETWEEN_US_FINDS`. The same script derives the legacy catalog global; there is no second manually maintained item dataset.

## Core fields

Every Find contains every field below. “Nullable” means the property remains present with the value `null` when the information is unknown.

| Field | Required | Nullable | M02 contract |
|---|---|---|---|
| `publicId` | Yes | No | Permanent unique ID in `BU-NNNN` form |
| `legacyId` | Yes for the five migrated records | No for the five migrated records | Existing positive numeric ID used by `item.html?id=N` |
| `slug` | Yes | No | Permanent unique lowercase ASCII kebab-case identifier |
| `title` | Yes | No | Exact current item title |
| `collection` | Yes | No | `jewelry` in M02 |
| `description` | Yes | No | Exact current description |
| `condition` | Yes | Yes | `null` when no explicit source condition exists |
| `availability` | Yes | No | `available`, `reserved`, or `sold` |
| `price.amount` | Yes | No | Finite nonnegative numeric amount |
| `price.currency` | Yes | No | `USD` in M02 |
| `photos` | Yes | No | Array of current image paths; may be empty for a future Find without media |
| `primaryPhoto` | Yes | Yes | A path contained in `photos`, or `null` when no primary photo exists |
| `altText` | Yes | No | Nonempty descriptive text based on the title |
| `relatedFindIds` | Yes | No | Array of valid public IDs for explicitly related Finds |
| `featured` | Yes | No | Boolean; `false` for all five current records |
| `createdAt` | Yes | Yes | `null` until a trustworthy date exists |
| `updatedAt` | Yes | Yes | `null` until a trustworthy date exists |

Future Finds that never had a numeric predecessor may use `legacyId: null` only after validation and lookup behavior are extended in an approved milestone. The five migrated IDs remain permanently required.

## Availability and collections

The complete M02 availability set is `available`, `reserved`, and `sold`. No other stored value is valid. The only collection value introduced in M02 is `jewelry`; additional approved collections may be added without changing existing records or identifiers.

## Price and media rules

Prices always contain both `amount` and `currency`. M02 preserves the current numeric amounts and uses `USD`. Currency conversion, formatting changes, and payment behavior are outside this milestone.

`photos` preserves each current image path, including the two known placeholder paths whose files are missing. When `primaryPhoto` is not `null`, it must occur in `photos`. Missing files continue to use the current renderer fallback and remain validation warnings.

## Related Finds

`relatedFindIds` stores public IDs, never legacy numeric IDs. Every value must resolve to an existing Find, must not refer to the same Find, and preserves the explicit order and relationships from the legacy data. The compatibility adapter translates these values back to numeric `relatedIds` for the current renderer.

## Compatibility metadata

Each migrated Find also carries `legacyCategory`. It is not a core domain field; it preserves the current bracelet, ring, earrings, or necklace label for the compatibility adapter. It must remain until the current detail renderer no longer requires the legacy `category` field.

## Future extension rules

- Add fields without changing the meaning of existing fields.
- Never recycle a public ID, legacy ID, or established slug.
- Do not derive an established slug again when a title changes.
- Preserve legacy URL resolution while any numeric link or QR code remains public.
- Add new availability, collection, currency, media, or date semantics only through an approved milestone and matching validation.
- Keep `condition` and timestamps `null` rather than inventing source information.
