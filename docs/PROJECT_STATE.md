# Project State — QR Jewelry Catalog

## Current Phase

PHASE 1D — Partial Real Photos Stable

## Current Status

Static MVP is complete and published on GitHub Pages.

3 products show real jewelry photos.

2 products intentionally show "No photo yet" until real photos are available.

QR code generator, share link, and copy button all remain working.

## Files in Place

- index.html — catalog homepage, renders product cards
- item.html — product detail page, loads qrcodejs CDN
- styles.css — mobile-first styles, two-column detail layout on desktop
- app.js — renders product grid from window.JEWELRY_ITEMS
- item.js — renders detail, related items, share link, QR code
- data/items.js — 5 jewelry items, 3 with real photos

## Real Photos Live

- Gold Twisted Rope Bracelet — gold-twisted-rope-bracelet-01.jpeg
- Layered Gold Chain Necklace — layered-gold-chain-necklace-01.jpeg
- Crystal Stud Earrings — crystal-stud-earrings-01.jpeg

## Still on Placeholder

- Silver Stackable Ring Set — no real photo yet
- Pearl Drop Earrings — no real photo yet

## What Works

- Homepage renders all 5 product cards.
- Detail pages render at item.html?id=ITEM_ID.
- Related items appear on detail pages.
- Share link box shows the current item URL.
- Copy item link button works.
- QR code generates from the live GitHub Pages URL.
- Download QR code button saves a PNG file.
- Phone camera scan of QR code opens the correct item page.
- GitHub Pages version confirmed working after cache refresh.
- Mobile and desktop layouts both work.

## Next Planned Work

PHASE 1E — Seller Workflow Polish.

1. Review full catalog experience as a seller would see it.
2. Identify any layout or copy improvements.
3. Add remaining real photos when available.
4. Polish detail page and card presentation.
5. Commit and push updates.
