# Permalinks, QR, and Sharing

## Permanent route

The static MVP uses:

```text
find.html?id={publicId}
```

`publicId` is the immutable external routing identifier. New card links, Share Find, Copy Link, reservation messages, canonical metadata, and Find QR payloads always use the exact registered uppercase public ID. Titles, slugs, availability, and prices may change without changing this URL.

The route remains query-based because GitHub Pages project hosting serves real static files but provides no approved rewrite for `/find/{id}`. `data/permalinks.js` builds absolute URLs from the current document location, preserving an origin and repository subpath without hardcoding either one. It replaces the current filename, query, and hash with `find.html?id={publicId}` through browser-native `URL` and `URLSearchParams` APIs.

## Runtime and route resolution

After `data/items.js`, every public page loads `data/permalinks.js`. It exposes the frozen `window.BETWEEN_US_PERMALINKS` namespace:

- `findByRoute` resolves one supported route to the normalized Find;
- `permalinkFor` generates its canonical public-ID URL;
- `legacyUrlFor` generates its protected numeric URL;
- `slugAliasFor` generates its readable alias; and
- `currentCanonicalUrl` converts any resolved current route to the public-ID URL.

The runtime reuses `window.BETWEEN_US_DATA`; it stores no second Find catalog. Missing, empty, duplicated, mixed, unknown, malformed, extra, or unsupported route parameters fail safely.

## Slug alias

Exact registered slugs resolve at:

```text
find.html?slug={registered-slug}
```

A slug is an alias, not the generated canonical address. The rendered canonical element and every outward action still use `find.html?id={publicId}`. Unknown or mixed public-ID/slug routes use the branded not-found state.

## Legacy compatibility

All original routes remain operational:

```text
item.html?id=1
item.html?id=2
item.html?id=3
item.html?id=4
item.html?id=5
```

They render the same normalized Find Details shell through `item.js`. They do not redirect, so existing shared links and already-distributed numeric QR codes keep working. Their canonical element, newly shared link, reservation message, and newly rendered QR use the public-ID permalink.

## Canonical metadata

`find.html` and `item.html` each contain exactly one canonical-link element. After a valid route resolves, `item.js` sets its absolute `href` to the public-ID permalink. Slug and numeric routes therefore converge on one public identity. An invalid route removes the `href` and does not claim another Find's canonical URL.

## Share Find and Copy Link

Share Find is separate from Reserve by Message. When Web Share is supported, it receives the exact Find title, concise Between Us text, and canonical URL. Cancellation is neutral. Lack of Web Share uses the Copy Link path; another share failure leaves Copy Link and the selectable manual link available with an accessible status.

Copy Link first uses `navigator.clipboard.writeText` in an eligible context. If that does not complete, it attempts the browser's dependency-free copy command with a temporary textarea. If neither path succeeds, the page reports the failure without claiming success and keeps the labeled read-only canonical link plus the instruction **Select and copy this link manually.** The link display remains selectable, wraps safely, and is the same on permanent, alias, and legacy routes.

## Reservation URL

The M05 reservation configuration and message template are unchanged. Only the separately included URL moved from the current numeric page address to the absolute canonical public-ID permalink. Web Share, clipboard, and manual reservation fallbacks remain channel-neutral; no recipient is configured.

## Find QR lifecycle

Find QR generation continues to use qrcodejs 1.0.0. Before rendering, `item.js` confirms that the constructor exists and clears stale content. A retry also clears the container, preventing duplicated QR output. The QR payload is the absolute canonical URL.

If the library is blocked, missing, throws, or produces no output, the page keeps sharing, Copy Link, reservation, and navigation usable and announces **QR generation is temporarily unavailable. Use Copy Link instead.** A retry control remains available.

The download path supports qrcodejs canvas and image output. Canvas output is requested as PNG. Image output is used directly when already PNG or converted through a temporary canvas when browser capabilities allow. A valid non-PNG image URL may be opened as a practical manual-save fallback; this state is reported as a preparation failure, not success. If no source exists, the QR remains visible when present and the live status directs the visitor to Copy Link.

Successful PNG downloads use:

```text
between-us-{publicId}-qr.png
```

## Invalid routes and milestone boundaries

An invalid route renders **Find not found**, an accessible status, and **Back to Explore**. It creates no canonical claim, QR, Share Find, Copy Link, or reservation action.

M07 owns the brand/home QR, postcard destination, and final content. M08 owns broader SEO and social-preview metadata. M06 adds no clean-path rewrite, redirect hack, backend, service worker, framework, or new dependency.

## Adding a future Find safely

1. Register a new immutable public ID and permanent slug under the approved identifier process; never recycle either value.
2. Add the normalized Find once in `data/items.js` and extend approved compatibility behavior if it legitimately has a legacy numeric predecessor.
3. Do not add Find records to the permalink runtime; it resolves the normalized registry automatically.
4. Add focused public-ID, slug, card, canonical, sharing, reservation, and QR contracts for the new record.
5. Run `node scripts/validate-baseline.mjs`, then review permanent, alias, and any approved legacy routes at desktop and mobile widths.
