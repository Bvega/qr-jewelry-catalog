# Between Us Public Shell

## Shared shell

`index.html` and `item.html` share a semantic header, primary navigation, main landmark, and community-oriented footer. Both pages use the local Between Us mark, the same wordmark treatment, the same four navigation destinations, and the same visual tokens.

On the home page, navigation uses stable in-page anchors. From a Find detail, the same links return to the corresponding anchor on `index.html`.

| Destination | Home link | Detail link |
|---|---|---|
| Home | `#home` | `index.html#home` |
| Collections | `#collections` | `index.html#collections` |
| Explore | `#explore` | `index.html#explore` |
| About | `#about` | `index.html#about` |

The header remains usable without JavaScript. Sticky-header offsets keep anchor headings visible after navigation.

## Home

The `#home` hero presents the Between Us Finds identity, tagline, supporting statement, short catalog introduction, primary **Explore Finds** action, and secondary **Explore Collections** action. Its decorative treatment is constructed from the local brand mark and CSS; it does not depend on a stock image.

## Collections preview

`#collections` renders the six approved Collections from `window.BETWEEN_US_COLLECTIONS`. Each card shows its registry label and approved description. Jewelry is labeled **Current Collection** and provides an **Explore Jewelry** anchor to `#explore`. Vintage, Home & Decor, Kitchen, Collectibles, and New Items are labeled **Coming Soon** and remain noninteractive.

No card displays a fake Find count, icon, emoji, or Collection route.

## M04 home order and discovery

The home main landmark uses this stable section order:

1. `#home`
2. `#collections`
3. `#featured`
4. `#latest`
5. `#weekly`
6. `#explore`
7. `#about`

`#featured` and `#latest` resolve exact editorial public-ID lists and render them through the shared standard Find-card path. `#weekly` resolves one normalized Find into a restrained responsive feature with its public ID and numeric detail action. Latest is an editorial order, not a timestamp-derived view.

## Explore

`#explore` retains `#catalogGrid`, the existing renderer anchor. `app.js` uses normalized `window.BETWEEN_US_FINDS` for display and creates the same five numeric `item.html?id=N` links in the same order. The derived `window.JEWELRY_ITEMS` remains available for compatibility.

Cards preserve the image or fallback, title, price, description, availability label, and detail link. The public action label is **View Find**.

The Explore toolbar renders **All Finds** plus every active Collection from the registry. M04 currently enables **Jewelry** only. Buttons expose `aria-pressed`, and the polite result summary reports the current count and selected Collection. Coming Soon Collections never become enabled filters. Selection is page-local, and an active Collection without Finds receives the approved honest empty state.

## About

`#about` explains that Between Us is a curated local catalog of useful, distinctive, and well-priced Finds selected for the community. It also explains that each Find is local and inventory changes over time.

## Find detail

`item.html` retains `#itemDetail`, numeric `?id=N` lookup, current data, image fallback, related relationships, sharing, and QR controls. `item.js` updates the page title to `{Find title} | Between Us Finds`, renders the Find title as the page-level heading, labels recommendations **Related Finds**, and provides **Back to Explore**.

The invalid route state uses **Find not found**, a page-level heading, and a return to `index.html#explore`. QR payloads and displayed share URLs remain `window.location.href`; QR download naming remains unchanged for compatibility.

## Deferred behavior

M05 owns Reserve by Message and further Find-detail improvements. Search, sorting, advanced filters, Collection routes, URL filter state, and timestamp-derived chronology remain deferred. M04 introduces none of those behaviors.
