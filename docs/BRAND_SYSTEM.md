# Between Us Brand System

## Brand names and voice

- Primary brand: **Between Us**
- Catalog identity: **Between Us Finds**
- Primary tagline: **Hidden Gems. Honest Prices.**
- Supporting statement: **Discover Something Worth Keeping.**

The voice is discreet, elegant, local, trustworthy, curated, and warm without becoming sentimental. The presentation should feel spacious and affordable without looking cheap.

## Palette

| Token | Value | Primary use |
|---|---|---|
| `--color-charcoal` | `#252525` | Primary text, strong actions, dark sections |
| `--color-ivory` | `#F6F1E7` | Warm panels and mark background |
| `--color-ivory-soft` | `#FBF8F2` | Page background |
| `--color-olive` | `#6F7652` | Collection emphasis and editorial accents |
| `--color-terracotta` | `#C66F49` | Supporting statements and action details |
| `--color-gold` | `#C79A43` | Sparkle and focus indicator |
| `--color-muted` | `#6C675F` | Secondary text |
| `--color-border` | `#D9D0C2` | Dividers and card outlines |
| `--color-white` | `#FFFFFF` | Card and detail surfaces |

Availability styles use readable text labels and borders in addition to color. Minor derived background colors are limited to status treatments.

## Typography

- Display: `Georgia, "Times New Roman", serif`
- Body: `Arial, Helvetica, sans-serif`

Display type establishes the subtle vintage character. Body type supports compact navigation, prices, status labels, actions, and longer copy. No external font files or services are used.

## Logo construction

`assets/brand/between-us-mark.svg` is the approved local mark. It uses:

- a perfectly round charcoal outer circle;
- a restrained olive inner circle;
- a serif `BU` monogram;
- a small gold four-point sparkle; and
- a terracotta lower flourish.

The mark has a transparent canvas, an accessible SVG title, a `0 0 160 160` view box, and no raster or external asset dependency. It is used in both public headers and as the SVG favicon. Header instances carry their accessible brand label on the surrounding link so the decorative image itself uses empty alternative text.

## Spacing and usage

- Keep a generous ivory field around the mark and major headings.
- Prefer thin borders, typography, and whitespace over decorative object icons.
- Keep body copy within readable line lengths.
- Use solid charcoal for the primary action and outlined treatments for secondary actions.
- Keep future collections visually quiet and clearly labeled **Coming Soon**.
- Do not add unnecessary animation; respect `prefers-reduced-motion`.

## Prohibited treatments

Do not use hearts, hands, keyholes, treasure chests, shopping carts, product-category icons, emoji, loud discount graphics, crowded marketplace patterns, external fonts, or novelty effects.

## Accessibility rules

- Preserve sufficient contrast between text and its surface.
- Maintain visible `:focus-visible` outlines using the gold token.
- Keep navigation keyboard accessible without JavaScript.
- Use one clear page-level heading in valid and invalid states.
- Use semantic landmarks and logical heading order.
- Do not communicate availability through color alone.
- Preserve descriptive image alternatives and the visible **No photo yet** fallback.
- Keep interactive targets usable on mobile; the shared navigation uses a minimum 44px target height.
