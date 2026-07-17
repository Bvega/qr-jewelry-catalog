# Collections and Discovery

M04 introduces static, data-driven Collection browsing and editorial discovery without adding routes, dependencies, inventory, or a second Find catalog.

## Collection registry

`data/collections.js` is the authoritative Collection registry and exposes the read-only browser global `window.BETWEEN_US_COLLECTIONS`. Each record contains only:

- `id`
- `label`
- `description`
- `status`
- `sortOrder`

The six initial Collections remain in stable order: Jewelry, Vintage, Home & Decor, Kitchen, Collectibles, and New Items. Jewelry has `status: "active"`; the other five have `status: "coming-soon"`.

An active Collection appears as an enabled Explore filter and may contain Finds. A Coming Soon Collection is an informational preview with explicit text, no link, no filter control, and no invented Find count. The Jewelry preview provides an **Explore Jewelry** anchor to `#explore`.

## Explore filtering

Explore starts with **All Finds** selected and preserves the normalized catalog order. It builds one filter button for each active Collection in registry order, so M04 currently presents **All Finds** and **Jewelry**. Both show the five current Jewelry Finds.

Filter controls are real buttons with `aria-pressed`, visible selected text, keyboard focus, and minimum 44px touch targets. The result summary is a polite live status region and reports either `{count} Finds` or `{count} Finds in {Collection}`. Selection is page-local; refresh may return to All Finds, and no query string, history state, local storage, or Collection route is introduced.

If a future active Collection has no matching Finds, the shared result renderer displays:

```text
No Finds are available in this Collection yet.
```

## Editorial discovery configuration

`data/discovery.js` is the authoritative editorial configuration and exposes the read-only browser global `window.BETWEEN_US_DISCOVERY`. It stores permanent public-ID references only; no title, price, description, availability, media, or date fields are duplicated.

Configured selections are:

- Featured Finds: `BU-0001`, `BU-0004`, `BU-0005`
- Latest Finds: `BU-0004`, `BU-0005`, `BU-0001`
- Find of the Week: `BU-0001`

Featured and Latest use the same standard Find-card renderer as Explore. Cards resolve normalized Finds through `window.BETWEEN_US_DATA`, preserve current values and image fallback, and link to canonical `find.html?id=BU-NNNN` routes through `window.BETWEEN_US_PERMALINKS`.

Find of the Week resolves the same normalized Find and presents its image or fallback, title, public ID, description, price, availability, and permanent **View Find** action in a distinct responsive feature.

## Latest editorial limitation

Latest Finds is an editorial ordering for the current static MVP. It is not calculated from `createdAt` or `updatedAt`; no dates or history were invented. Real chronological behavior may be introduced only after trustworthy timestamps exist and an approved milestone defines the migration.

## Source-of-truth boundaries

- `data/items.js`: normalized Finds, permanent Find values, compatibility adapter, and lookups.
- `data/collections.js`: Collection identity, public copy, status, and order.
- `data/discovery.js`: editorial public-ID references and their order.
- `app.js`: rendering and page-local filter behavior only.

`window.JEWELRY_ITEMS` remains the derived legacy adapter. Discovery files never duplicate Find records or mutate `featured`, `createdAt`, or `updatedAt`.

## Activating a future Collection safely

1. Confirm the Collection is already approved and its stable registry ID is correct.
2. Change its registry status from `coming-soon` to `active` in the same approved change that makes the Collection ready for browsing.
3. Add approved normalized Finds to `data/items.js` using permanent identifiers and the Collection ID; do not copy records into the Collection registry.
4. Extend identifier, domain, compatibility, image, and fixture contracts as required by the approved milestone.
5. Run the complete validator and desktop/mobile visual review. An active Collection with no Finds will use the honest empty state.

## Adding future discovery references

Add existing permanent `publicId` values to the appropriate array in `data/discovery.js`, preserving the intended editorial order. Every reference must resolve, and a Find's fields remain solely in `data/items.js`. Do not mirror discovery selection by changing the normalized `featured` field unless a later milestone explicitly changes that model.

## Deferred features

M04 does not add search, sorting, price or condition filters, Collection detail routes, URL filter state, browser history, reservation messaging, new inventory, timestamps, or timestamp-derived chronology. Those behaviors require their own approved milestones.
