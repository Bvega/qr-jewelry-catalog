# Find Details and Reservation

M05 completes the static Find Details experience and introduces a manual, configurable Reserve by Message flow. It does not add a backend, customer data collection, automatic availability changes, payment processing, or a contact recipient.

## Normalized detail source

`item.js` serves both the permanent `find.html?id=BU-NNNN` page and protected `item.html?id=N` page. It resolves permanent public IDs, exact registered-slug aliases, and numeric legacy IDs through `window.BETWEEN_US_PERMALINKS.findByRoute`. The returned normalized Find supplies:

- `title`
- `publicId`
- `collection`
- `price.amount` and `price.currency`
- `availability`
- `description`
- optional `condition`
- `photos`, `primaryPhoto`, and `altText`
- `relatedFindIds`

The permanent public ID is displayed as `Find ID: BU-NNNN`. `legacyId`, slugs, null timestamps, and other internal fields are not presented as detail metadata. A condition is displayed only when it is a real, non-empty string.

The public Collection label is resolved from `window.BETWEEN_US_COLLECTIONS`; the detail renderer does not hardcode Jewelry as the only possible Collection. Prices are formatted from the normalized amount and ISO currency with `Intl.NumberFormat` and no dependency.

## Gallery behavior

The gallery builds one ordered usable-photo list from `primaryPhoto` and `photos[]`. The primary photo is presented first, remaining photos retain normalized order, and duplicate or registered-unavailable paths are omitted.

A one-photo Find renders only the primary image region. A future multi-photo Find automatically receives ordered thumbnail buttons without a new page structure. Each button has an explicit photo-position label and `aria-pressed` state. Buttons work with Tab, Enter, and Space through native button behavior; Left and Right Arrow also move between thumbnails without trapping focus. The selected image keeps the normalized `altText`, and a polite live region announces changes.

There is no carousel dependency, automatic rotation, or motion requirement. Unexpected image-load failures reveal the same meaningful **No photo yet** presentation.

## Media registry

`data/media.js` exposes the frozen `window.BETWEEN_US_MEDIA` registry. Its `unavailablePaths` contains exactly:

```text
assets/images/placeholder-ring-silver.jpg
assets/images/placeholder-earrings-pearl.jpg
```

The Find records and their paths remain unchanged. Home cards, discovery views, the weekly feature, Related Finds, and Find Details consult `isUnavailable(path)` before assigning an image `src`, so the browser does not make preventable requests for these known missing files. Real paths continue through the normal image and runtime-error fallback behavior. M07 can remove a replaced path from this registry when approved final media exists.

## Reservation configuration

`data/reservation.js` exposes the frozen `window.BETWEEN_US_RESERVATION` boundary:

```text
channel: share
messageTemplate: Hello, I’m interested in reserving {title} ({publicId}) from Between Us. Is it still available?
includeUrl: true
manualConfirmation: true
paymentMethod: cash
pickupMode: local-arrangement
```

`{title}` and `{publicId}` resolve to the exact normalized values. The absolute canonical public-ID permalink is added separately when `includeUrl` is true, regardless of whether the visitor entered through a permanent, slug-alias, or legacy route. No phone number, email address, messaging account, recipient, pickup address, or third-party SDK is configured.

The channel boundary is intentionally configurable. M05 implements `share` as the approved default and uses clipboard/manual text as channel-neutral fallbacks; a future direct channel requires separate approved configuration and contact information.

## Reservation behavior by availability

- **Available:** shows **Reserve by Message** and activates the configured flow.
- **Reserved:** shows **This Find is currently reserved.** and no active reservation action.
- **Sold:** shows **This Find has been sold.** and no active reservation action.

All states keep the public page, general copy-link control, QR control, Related Finds, and navigation available. The panel always states that the owner confirms availability manually and that payment is cash, with local pickup details arranged by message after confirmation. Activating the available action does not confirm or guarantee a reservation.

## Web Share and fallbacks

When the configured channel is `share` and the browser supports `navigator.share`, the action supplies a Between Us reservation-request title, the generated message, and the canonical detail URL. A resolved share reports success accessibly. User cancellation reports that nothing was sent and is not treated as a failure.

If Web Share is unavailable or fails for a non-cancellation reason, the complete message and URL are copied with the Clipboard API. The polite live status tells the visitor to paste the text into a preferred messaging application.

If clipboard access is unavailable or fails, a labeled read-only textarea is revealed with the complete selectable message and URL. The interface honestly instructs the visitor to copy it manually; it does not silently fail or move focus automatically.

## Privacy and architecture boundary

The browser holds the generated text only for the current page interaction. The application has no form submission, customer-name field, storage, account, database, API, backend, automatic reservation, inventory synchronization, notification, payment collection, shipping, or published pickup address.

M06 preserves every current numeric URL and already-distributed QR destination while routing every newly generated card, share, reservation, and QR target to the public-ID permalink. M07 owns final content and media replacement; until then, the media registry remains the authority for the two known unavailable paths.
