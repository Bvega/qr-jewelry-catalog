# Between Us Public Shell

## Shared shell

`index.html`, `find.html`, and `item.html` share a semantic header, primary navigation, main landmark, and community-oriented footer. All pages use the local Between Us mark, the same wordmark treatment, the same five navigation destinations, and the same visual tokens.

On the home page, navigation uses stable in-page anchors. From a Find detail, the same links return to the corresponding anchor on `index.html`.

| Destination | Home link | Detail link |
|---|---|---|
| Home | `#home` | `index.html#home` |
| Collections | `#collections` | `index.html#collections` |
| Explore | `#explore` | `index.html#explore` |
| About | `#about` | `index.html#about` |
| Reserve by Message | `#reserve` | `index.html#reserve` |

The header remains usable without JavaScript. Sticky-header offsets keep anchor headings visible after navigation.

## Home

The `#home` hero presents the Between Us Finds identity, tagline, supporting statement, short catalog introduction, primary **Explore Finds** action, and secondary **Explore Collections** action. Its decorative treatment is constructed from the local brand mark and CSS; it does not depend on a stock image.

## Collections preview

`#collections` renders the six approved Collections from `window.BETWEEN_US_COLLECTIONS`. Each card shows its registry label and approved description. Jewelry is labeled **Current Collection** and provides an **Explore Jewelry** anchor to `#explore`. Vintage, Home & Decor, Kitchen, Collectibles, and New Items are labeled **Coming Soon** and remain noninteractive.

No card displays a fake Find count, icon, emoji, or Collection route.

## M05 home order and discovery

The home main landmark uses this stable section order:

1. `#home`
2. `#collections`
3. `#featured`
4. `#latest`
5. `#weekly`
6. `#explore`
7. `#about`
8. `#reserve`

`#featured` and `#latest` resolve exact editorial public-ID lists and render them through the shared standard Find-card path. `#weekly` resolves one normalized Find into a restrained responsive feature with its public ID and permanent detail action. Latest is an editorial order, not a timestamp-derived view.

## Explore

`#explore` retains `#catalogGrid`, the existing renderer anchor. `app.js` uses normalized `window.BETWEEN_US_FINDS` for display and asks `window.BETWEEN_US_PERMALINKS` for each public-ID `find.html?id=BU-NNNN` URL. The derived `window.JEWELRY_ITEMS` and every direct numeric route remain available for compatibility.

Cards preserve the image or fallback, title, price, description, availability label, and detail link. The public action label is **View Find**.

The Explore toolbar renders **All Finds** plus every active Collection from the registry. M04 currently enables **Jewelry** only. Buttons expose `aria-pressed`, and the polite result summary reports the current count and selected Collection. Coming Soon Collections never become enabled filters. Selection is page-local, and an active Collection without Finds receives the approved honest empty state.

## About

`#about` explains that Between Us is a curated local catalog of useful, distinctive, and well-priced Finds selected for the community. It also explains that each Find is local and inventory changes over time.

## Reserve by Message home section

`#reserve` follows `#about` without changing the accepted M04 discovery order. It explains that visitors open an available Find, use **Reserve by Message**, wait for manual availability confirmation, and arrange local pickup. It states that payment is made in cash and links **Explore Available Finds** to `#explore`. No contact destination is invented.

## Find detail

`find.html` and `item.html` share `#itemDetail`, the same shell, and the same `item.js` renderer. `window.BETWEEN_US_PERMALINKS.findByRoute` resolves permanent public-ID routes, registered-slug aliases, and protected numeric routes to the same normalized Find. The renderer updates the page title to `{Find title} | Between Us Finds`, renders one page-level Find heading, displays the permanent public ID, resolves the Collection public label, formats normalized currency, omits null condition, labels recommendations **Related Finds**, and provides **Back to Explore**.

The gallery uses normalized `photos[]`, `primaryPhoto`, and `altText`. One-photo Finds have no empty thumbnail rail; future multi-photo Finds receive accessible selectable thumbnails. Both registered unavailable paths render the deliberate fallback directly without first becoming image requests.

Every valid detail includes **Reserve This Find**. Available Finds expose **Reserve by Message**; Reserved and Sold Finds show exact inactive text. The panel states manual confirmation, cash payment, and locally arranged pickup. Web Share is the default channel, with clipboard and selectable-text fallbacks. General Share Find, Copy Link, QR generation/download, navigation, and Related Finds remain separate and available in every availability state. These actions use the absolute canonical public-ID permalink even on slug and legacy routes.

The invalid route state uses **Find not found**, a page-level heading, an accessible status, and a return to `index.html#explore`. Invalid routes expose no share, copy, reservation, or QR action and claim no valid canonical URL. Valid routes display a selectable canonical link, publish the same URL in one canonical-link element, and name QR downloads `between-us-{publicId}-qr.png`.

## Deferred behavior

M07 owns final content, photo replacement, and the brand/home QR. M08 owns broader SEO and social previews. Clean paths, search, sorting, advanced filters, Collection routes, URL filter state, and timestamp-derived chronology remain deferred.
