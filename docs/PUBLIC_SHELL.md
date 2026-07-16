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

`#collections` presents the six approved collection names. Jewelry is labeled **Current Collection**. Vintage, Home & Decor, Kitchen, Collectibles, and New Items are labeled **Coming Soon**.

The preview is informational in M03. Future collection cards are not interactive, and no filter, collection route, or discovery logic is present.

## Explore

`#explore` retains `#catalogGrid`, the existing renderer anchor. `app.js` still reads the derived `window.JEWELRY_ITEMS` compatibility array and creates the same five numeric `item.html?id=N` links in the same order.

Cards preserve the image or fallback, title, price, description, availability label, and detail link. The public action label is **View Find**.

## About

`#about` explains that Between Us is a curated local catalog of useful, distinctive, and well-priced Finds selected for the community. It also explains that each Find is local and inventory changes over time.

## Find detail

`item.html` retains `#itemDetail`, numeric `?id=N` lookup, current data, image fallback, related relationships, sharing, and QR controls. `item.js` updates the page title to `{Find title} | Between Us Finds`, renders the Find title as the page-level heading, labels recommendations **Related Finds**, and provides **Back to Explore**.

The invalid route state uses **Find not found**, a page-level heading, and a return to `index.html#explore`. QR payloads and displayed share URLs remain `window.location.href`; QR download naming remains unchanged for compatibility.

## Deferred behavior

M04 owns collection browsing, filters, and Featured, Latest, and Weekly discovery views. M05 owns Reserve by Message and further Find-detail improvements. The M03 shell does not introduce either set of behavior.
