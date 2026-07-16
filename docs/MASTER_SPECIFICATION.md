# BETWEEN US PLATFORM — MASTER SPECIFICATION v1.0

**Status:** Draft for Owner Approval  
**Date:** Thursday, July 16, 2026  
**Project role:** Single source of truth for migration, implementation, review, and acceptance  
**Existing repository:** `/Users/miniboli/DEV/qr-jewelry-catalog`

---

## 1. Product Definition

### 1.1 Purpose

Between Us is a discreet, community-focused discovery catalog for selected goods offered locally at fair prices.

The platform begins with the existing jewelry catalog and expands it into one unified catalog containing multiple collections, including jewelry, vintage pieces, home items, decor, kitchen items, collectibles, and new merchandise.

### 1.2 Core promise

**Hidden Gems. Honest Prices.**

Between Us helps nearby buyers discover useful, attractive, unusual, or valuable items without the experience feeling like a garage sale, classified listing board, or large marketplace.

### 1.3 Positioning

Between Us is:

- A curated local catalog
- A discovery experience
- A discreet way to present available items
- A single destination reached through QR codes and shared links
- A platform that can later support additional collections

Between Us is not initially:

- A public multi-seller marketplace
- An e-commerce checkout system
- A shipping platform
- A payment processor
- A social network
- A full inventory-management application

---

## 2. Audience

### 2.1 Primary audience

Residents and neighbors in nearby buildings and the surrounding community.

### 2.2 Secondary audience

People who discover individual Finds through:

- Facebook Marketplace
- Shared links
- Printed postcards
- QR codes
- Referrals from existing buyers

### 2.3 Seller model

The owner manages all inventory manually during the MVP.

The MVP supports one seller and one catalog.

---

## 3. Brand System

### 3.1 Public brand name

**Between Us**

### 3.2 Catalog identity

**Between Us Finds**

### 3.3 Primary tagline

**Hidden Gems. Honest Prices.**

### 3.4 Supporting phrase

**Discover Something Worth Keeping.**

### 3.5 Brand personality

- Discreet
- Elegant
- Local
- Trustworthy
- Warm but not sentimental
- Curated rather than crowded
- Affordable without appearing cheap

### 3.6 Approved visual direction

- Charcoal black
- Warm ivory
- Olive
- Terracotta
- Soft gold

### 3.7 Logo direction

- Perfectly round circle
- BU serif monogram
- Small, discreet four-point gold sparkle
- No heart
- No hands
- No product icons
- No treasure chest
- No keyhole

---

## 4. Domain Language

The public interface uses the following permanent vocabulary:

| Avoid | Use |
|---|---|
| Product | Find |
| Products | Finds |
| Category | Collection |
| Categories | Collections |
| Related Products | Related Finds |
| Product Detail | Find Details |
| Inventory | Catalog or Finds |
| Shop | Explore |
| Buy Now | Reserve by Message |

### 4.1 Find

A **Find** is one item offered through Between Us.

### 4.2 Collection

A **Collection** is a primary organizational grouping for Finds.

### 4.3 Availability states

The MVP supports exactly:

- `available`
- `reserved`
- `sold`

Public labels:

- Available
- Reserved
- Sold

### 4.4 Reservation

A reservation is initiated by message.

The platform does not confirm, process, or guarantee the reservation automatically. The owner confirms availability manually.

### 4.5 Related Finds

A Find may explicitly reference other Finds that should appear as recommendations.

---

## 5. Initial Information Architecture

### 5.1 Primary navigation

- Home
- Explore
- Collections
- About
- Reserve by Message

The word **Shop** must not appear in primary navigation.

### 5.2 Home page structure

1. Brand hero
2. Supporting statement
3. Explore Collections
4. Featured Finds
5. Latest Finds
6. Weekly Finds
7. About Between Us
8. Reserve by Message

### 5.3 Initial Collections

Primary Collections:

- Jewelry
- Vintage
- Home & Decor
- Kitchen
- Collectibles
- New Items

Editorial discovery views, not permanent Collections:

- Featured Finds
- Latest Finds
- Weekly Finds

Additional Collections may be added later without changing the platform architecture.

---

## 6. Find Data Model

Each normalized Find should support:

```text
publicId
legacyId
slug
title
collection
description
condition
availability
price.amount
price.currency
photos[]
primaryPhoto
altText
relatedFindIds[]
featured
createdAt
updatedAt
```

### 6.1 Identifier rules

- `publicId` is the permanent external identifier.
- `legacyId` preserves compatibility with existing numeric jewelry IDs.
- `slug` supports readable future URLs.
- Public identifiers must never be recycled.
- A sold Find may remain publicly accessible unless the owner explicitly archives it.

### 6.2 Price rules

- Price must include an amount and currency.
- The initial currency is USD.
- Cash is the initial payment method.
- No payment collection occurs inside the MVP.

### 6.3 Media rules

- A Find may contain one or more photos.
- Each photo must support descriptive alt text.
- Missing media must use a deliberate fallback without generating avoidable broken-image requests.
- Existing jewelry photos must be preserved.

---

## 7. URL and QR Compatibility Contract

This is a mandatory migration constraint.

### 7.1 Existing URLs

Current public links use:

```text
item.html?id=N
```

These links must continue to work throughout and after migration.

### 7.2 Future URL direction

The preferred future structure is:

```text
/find/{publicId-or-slug}
```

### 7.3 Compatibility requirements

- Existing QR codes must not break.
- Existing shared links must not break.
- Legacy numeric IDs must resolve to the correct normalized Find.
- Redirects, aliases, or compatibility adapters may be used.
- The legacy path must remain validated during every migration milestone affecting routing.

### 7.4 QR types

The platform supports two QR purposes:

1. **Brand QR**  
   Opens the Between Us home or Explore page.

2. **Find QR**  
   Opens a permanent Find detail URL.

---

## 8. MVP Public Experience

### 8.1 Included

- Mobile-first responsive catalog
- Collection discovery
- Find cards
- Find detail page
- Availability status
- Related Finds
- Image fallback
- Shareable permanent links
- Copy-link action
- QR generation
- QR image download
- Reserve-by-message action
- Featured, Latest, and Weekly discovery views
- Existing jewelry records and photographs
- Static deployment compatible with GitHub Pages during migration

### 8.2 Explicitly excluded from MVP

- User accounts
- Seller accounts
- Admin dashboard
- Database
- API
- Multiple sellers
- Online payment
- Shipping
- Shopping cart
- Automated reservation confirmation
- Automated inventory synchronization
- Consignment workflow
- Analytics platform
- Customer reviews
- Public comments
- Notifications
- Native mobile application

These exclusions may be revisited only through a future approved specification change.

---

## 9. Reservation and Fulfillment Flow

1. Visitor discovers a Find.
2. Visitor opens Find Details.
3. Visitor selects **Reserve by Message**.
4. The message includes the Find title and permanent identifier.
5. Owner manually confirms whether it is available.
6. Payment is made in cash.
7. Pickup is arranged near the owner's zone.
8. Owner manually changes the status to Reserved or Sold.

The exact message channel must remain configurable.

---

## 10. Technical Migration Principles

### 10.1 Migration strategy

Use an adapter-first, incremental migration.

Do not rebuild from scratch.

### 10.2 Existing capabilities to preserve

- Catalog flow
- Find detail flow
- Availability states
- Related items
- Sharing
- QR generation and download
- Responsive behavior
- Existing images
- Graceful missing-image experience

### 10.3 Existing implementation that may remain temporarily

- Static HTML pages
- Existing CSS
- Existing JavaScript files
- GitHub Pages deployment
- Current record array behind a compatibility adapter

### 10.4 Areas to evolve gradually

- Global `window.JEWELRY_ITEMS`
- Numeric-only identifiers
- Duplicated rendering
- Large `innerHTML` templates
- Missing schema validation
- Missing automated tests
- Third-party QR dependency
- Non-reproducible deployment configuration

### 10.5 Framework decision

No framework, backend, database, or package-manager migration is approved by this specification.

Any such change requires:

- Demonstrated need
- Separate architecture decision
- Explicit owner approval
- Migration and rollback plan

---

## 11. Quality and Safety Requirements

Every code-changing milestone must:

- Preserve legacy URLs
- Preserve QR behavior
- Preserve current working features
- Keep the repository recoverable
- Run all available validation
- Add validation where the milestone requires it
- Avoid unrelated refactoring
- Avoid new dependencies without explicit approval
- Produce a concise technical report
- Remain within the approved milestone scope

---

## 12. Repository and Git Rules

### 12.1 Current repository

The existing repository remains the migration base.

Do not rename the folder yet:

```text
/Users/miniboli/DEV/qr-jewelry-catalog
```

### 12.2 Source of truth

- MASTER Specification: product and architecture authority
- Work milestone package: implementation authority for one milestone
- Repository: implementation source of truth
- GitHub: recoverable history

### 12.3 Branching

Each code-changing milestone should use a dedicated branch.

Suggested format:

```text
migration/m01-safety-baseline
migration/m02-domain-compatibility
migration/m03-between-us-shell
feature/m04-collections-discovery
feature/m05-find-reservation
feature/m06-qr-permalinks
```

---

## 13. Approved Milestone Roadmap

### M00 — Repository Audit and Migration Baseline

**Status:** Accepted

Read-only inspection of the existing repository.

### M01 — Migration Safety and Compatibility Baseline

- Capture current behavior
- Add lightweight automated validation
- Protect legacy URLs
- Document reproducible local validation and deployment
- Establish rollback checkpoint

### M02 — Domain Model and Compatibility Adapter

- Introduce normalized Find model
- Preserve existing jewelry records
- Add stable public identifiers
- Keep legacy numeric lookup working
- Add data validation

### M03 — Between Us Brand and Public Shell

- Apply approved name, logo, palette, typography, and copy
- Introduce Home, Explore, Collections, and About structure
- Preserve catalog and detail functionality

### M04 — Collections and Discovery

- Add initial Collections
- Add Featured, Latest, and Weekly views
- Add collection browsing and filtering
- Preserve responsive behavior

### M05 — Find Details and Reservation

- Complete normalized Find detail presentation
- Add Reserve by Message
- Improve gallery and accessibility
- Preserve Related Finds

### M06 — QR, Sharing, and Permalinks

- Introduce permanent Find URLs
- Preserve all legacy URLs
- Harden QR generation and downloads
- Improve copy-link failure handling

### M07 — Content Migration and Marketing Integration

- Add remaining inventory
- Add final photos and alt text
- Connect brand QR
- Prepare postcard-compatible destination
- Validate Facebook Marketplace sharing flow

### M08 — Launch Hardening

- Accessibility
- Performance
- SEO and social previews
- Error states
- Deployment reproducibility
- Final regression validation
- Launch checkpoint

---

## 14. Acceptance Criteria for This Specification

This specification is approved when the owner confirms:

- Between Us is one unified catalog.
- Jewelry remains an initial Collection.
- Finds and Collections are the permanent public vocabulary.
- The initial audience is the local community.
- Reservations occur by message.
- Payment is cash.
- Pickup occurs near the owner's zone.
- Legacy QR links must remain operational.
- The MVP remains single-seller and public-facing.
- No rebuild, framework migration, backend, database, or admin dashboard is currently approved.
- M01 is the next authorized implementation milestone.

---

## 15. Change Control

After approval, this document becomes the MASTER source of truth.

Changes require:

1. A proposed amendment
2. Impact analysis
3. Owner approval
4. Version update
5. Corresponding milestone adjustment when required

No implementation task may override this specification.
