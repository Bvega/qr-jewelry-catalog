# Project State — QR Jewelry Catalog

## Current Phase

PHASE 1 — Static MVP Complete

## Current Status

Phase 0 documentation scaffold is complete.

Phase 1 static frontend is built and tested locally.

All core MVP files are in place.

## Files Created

- index.html — catalog homepage, renders product cards
- item.html — product detail page shell
- styles.css — mobile-first styles, two-column detail layout on desktop
- app.js — renders product grid from window.JEWELRY_ITEMS
- item.js — renders product detail and related items from URL param ?id=
- data/items.js — 5 sample jewelry items

## What Works

- Homepage renders all 5 product cards with name, price, description, and availability badge.
- Each card links to item.html?id=ITEM_ID.
- Detail pages render full product info: image area, name, price, description, category, badge.
- Related items appear below the detail card and link to each other.
- Layout tested locally with python3 -m http.server 5500.
- Mobile and desktop layouts both work.

## Next Planned Work

PHASE 1B — Real photos and GitHub Pages publishing.

1. Replace placeholder images with real jewelry photos.
2. Create GitHub repository.
3. Connect local repo to GitHub.
4. Push initial commit.
5. Publish to GitHub Pages.
6. Validate live URLs work for item.html?id= links.
