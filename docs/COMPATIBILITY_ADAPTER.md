# Find Compatibility Adapter

M02 introduces normalized data without changing the current pages, routes, branding, or renderer contract. `data/items.js` loads synchronously in the existing static script order and exposes all data through browser globals.

## Globals

- `window.BETWEEN_US_FINDS` is the read-only array of five normalized Finds and the single authoritative set of current catalog values.
- `window.JEWELRY_ITEMS` is a read-only legacy array derived from `window.BETWEEN_US_FINDS` in the same deterministic order.
- `window.BETWEEN_US_DATA` is a frozen lookup namespace with `findByPublicId(string)`, `findByLegacyId(integer)`, and `findBySlug(string)`.

Each lookup returns the normalized Find object or `null` for an unknown or incorrectly typed identifier. The lookup API is synchronous and dependency-free.

## Exact legacy field mapping

| Legacy field | Normalized source | Notes |
|---|---|---|
| `id` | `legacyId` | Preserves numeric routes 1–5 |
| `name` | `title` | Exact current text |
| `price` | `price.amount` | Exact current numeric value |
| `description` | `description` | Unchanged |
| `status` | `availability` | The existing renderers call this field `status` |
| `category` | `legacyCategory` | Temporary compatibility metadata preserving current labels |
| `image` | `primaryPhoto` | Current path or `null` when no primary photo exists |
| `relatedIds` | `relatedFindIds` translated through `legacyId` | Numeric values in current order |

The pre-M02 runtime contract uses the legacy field name `status`, so the adapter maps normalized `availability` to `status`. This is protected by `tests/fixtures/legacy-items.snapshot.json`; adapter output must have exact snapshot parity.

## Why the legacy global remains

`app.js` and `item.js` synchronously read `window.JEWELRY_ITEMS`. They also generate and resolve `item.html?id=N` links, related cards, sharing URLs, and QR downloads from numeric IDs. Keeping the adapter lets those protected behaviors continue without modifying either renderer or any public HTML file.

## Compatibility boundary

The adapter is the only translation boundary. Current item values are edited in the normalized Finds, never independently in the derived legacy array or the snapshot fixture. The fixture records the compatibility expectation; it is not runtime data.

Future approved milestones may migrate renderers to normalized names, introduce public-ID or slug routes, and eventually retire this adapter. Until legacy routes, shared links, existing QR codes, related-item rendering, share/copy behavior, and QR download naming have been safely migrated and validated:

- `window.JEWELRY_ITEMS` must remain available synchronously;
- its exact fields and values must retain snapshot parity;
- numeric IDs and related IDs must resolve to the same records;
- `item.html?id=N` must remain functional; and
- no current renderer may depend on the new globals.

M02 does not add modules, asynchronous loading, a framework, a backend, or a second catalog dataset.
