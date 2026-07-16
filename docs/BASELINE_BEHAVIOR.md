# M01 Public Compatibility Baseline

This document records the public behavior protected before domain normalization and rebranding. M01 does not change the visible application.

## Catalog

Opening `/` or `/index.html` loads `data/items.js` followed by `app.js`. The application renders one linked card for each of the five current records into `#catalogGrid`. Cards show the item image or fallback, name, dollar price, description, and availability label.

The current numeric identifiers and public detail URLs are:

| ID | Item | Availability | Detail URL |
|---:|---|---|---|
| 1 | Gold Twisted Rope Bracelet | available | `item.html?id=1` |
| 2 | Silver Stackable Ring Set | available | `item.html?id=2` |
| 3 | Pearl Drop Earrings | reserved | `item.html?id=3` |
| 4 | Layered Gold Chain Necklace | available | `item.html?id=4` |
| 5 | Crystal Stud Earrings | sold | `item.html?id=5` |

All five numeric URLs are protected legacy contracts. The visible labels are formed by capitalizing the stored values: Available, Reserved, and Sold.

## Item detail routing and invalid items

`item.html` loads item data, qrcodejs, and then `item.js`. The renderer reads `id` from the query string as a base-10 integer and matches it to the numeric record ID.

A valid ID renders the image or fallback, category, name, price, availability, description, share controls, QR controls, and related items. A missing, nonnumeric, or unknown ID renders `Item not found. Back to catalog.`

## Related items

Related cards use the same `item.html?id=N` route. The current explicit relationships are:

| Item ID | Related IDs |
|---:|---|
| 1 | 2, 4 |
| 2 | 1, 5 |
| 3 | 4, 5 |
| 4 | 1, 3 |
| 5 | 2, 3 |

The section appears when at least one referenced record resolves and is labeled `You may also like`.

## Images and fallback

The following real image assets exist and must remain reachable:

- `assets/images/gold-twisted-rope-bracelet-01.jpeg`
- `assets/images/layered-gold-chain-necklace-01.jpeg`
- `assets/images/crystal-stud-earrings-01.jpeg`

The following referenced files are known to be missing:

- item 2: `assets/images/placeholder-ring-silver.jpg`
- item 3: `assets/images/placeholder-earrings-pearl.jpg`

Both catalog and detail renderers hide an image that fails to load and reveal the styled `No photo yet` fallback. Known missing files are warnings, not validation failures. M01 does not alter the records or add photos.

## Share and copy-link behavior

The share box displays `window.location.href`, preserving the complete current item URL. **Copy item link** writes that same value through the browser Clipboard API, displays `Link copied`, and hides the confirmation after two seconds.

## QR generation and download

`item.html` loads qrcodejs 1.0.0 from cdnjs before `item.js`. For a valid item, `item.js` generates a 160-by-160 QR code whose text is the same current page URL shown in the share box.

**Download QR code** uses the generated canvas PNG, or the older image output fallback, and downloads `jewelry-item-N-qr.png`. If the QR library is missing or generation throws, the page displays `QR code could not be generated.` and hides the download button. The external CDN remains a known runtime dependency.

## Responsive layout

The catalog is mobile-first with a two-column grid. At 600px it becomes three columns, and at 900px it becomes four columns. The item detail is stacked on smaller screens and changes to a two-column image/detail layout at 768px. Related items use two columns on smaller screens and three columns from 600px.

These are compatibility expectations, not pixel-perfect visual snapshots. Brand, copy, navigation, data shape, and runtime presentation remain unchanged during M01.
