import assert from "node:assert/strict";
import test from "node:test";
import {
  APPROVED_QR_LIBRARY,
  extractScriptSources,
  readProjectFile
} from "../../scripts/lib/baseline-contracts.mjs";

const indexHtml = readProjectFile("index.html");
const itemHtml = readProjectFile("item.html");
const appSource = readProjectFile("app.js");
const itemSource = readProjectFile("item.js");
const styles = readProjectFile("styles.css");

test("home metadata and semantic shell use Between Us", () => {
  assert.match(indexHtml, /<title>[^<]*Between Us[^<]*<\/title>/);
  assert.match(indexHtml, /<meta\b[^>]*name=["']description["'][^>]*Between Us/i);
  for (const landmark of ["header", "nav", "main", "footer"]) {
    assert.match(indexHtml, new RegExp(`<${landmark}\\b`, "i"));
  }
  assert.doesNotMatch(indexHtml, />\s*Jewelry Catalog\s*</i);
});

test("home exposes stable sections and complete anchor navigation", () => {
  for (const id of ["home", "collections", "explore", "about"]) {
    assert.match(indexHtml, new RegExp(`\\bid=["']${id}["']`));
  }
  for (const label of ["Home", "Collections", "Explore", "About"]) {
    assert.match(indexHtml, new RegExp(`>${label}<`));
  }
});

test("hero contains all approved public brand copy and Explore action", () => {
  assert.match(indexHtml, /Between Us Finds/);
  assert.match(indexHtml, /Hidden Gems\. Honest Prices\./);
  assert.match(indexHtml, /Discover Something Worth Keeping\./);
  assert.match(indexHtml, /href=["']#explore["'][^>]*>Explore Finds</);
  assert.equal((indexHtml.match(/<h1\b/g) || []).length, 1);
});

test("collections preview retains the M03 section while using the M04 registry renderer", () => {
  assert.match(indexHtml, /<h2\b[^>]*>Explore Collections<\/h2>/);
  assert.match(indexHtml, /\bid=["']collectionGrid["']/);
  assert.match(appSource, /renderCollections\(collectionGrid, collections\)/);
  assert.match(appSource, /Current Collection/);
  assert.match(appSource, /Coming Soon/);
});

test("Explore and About preserve the catalog anchor and approved message", () => {
  assert.match(indexHtml, /<h2\b[^>]*>Explore Finds<\/h2>/);
  assert.match(indexHtml, /\bid=["']catalogGrid["']/);
  assert.match(indexHtml, /Between Us is a curated local catalog of useful, distinctive, and well-priced finds selected for our community\./);
  assert.match(appSource, /View Find/);
});

test("detail page shares the brand shell and preserves required script order", () => {
  for (const landmark of ["header", "nav", "main", "footer"]) {
    assert.match(itemHtml, new RegExp(`<${landmark}\\b`, "i"));
  }
  assert.match(itemHtml, /href=["']index\.html#explore["'][^>]*>[\s\S]*?Back to Explore/);
  assert.match(itemHtml, /\bid=["']itemDetail["']/);
  assert.deepEqual(extractScriptSources(itemHtml), [
    "data/items.js",
    APPROVED_QR_LIBRARY,
    "item.js"
  ]);
});

test("detail renderer uses Find vocabulary and dynamic Between Us title", () => {
  assert.match(itemSource, /Find not found/);
  assert.match(itemSource, /Related Finds/);
  assert.match(itemSource, /document\.title\s*=\s*item\.name\s*\+\s*["'] \| Between Us Finds["']/);
  assert.match(itemSource, /<h1 class=["']detail-title["']>/);
  assert.match(itemSource, /<h1>Find not found\.<\/h1>/);
});

test("shared shell uses the local mark in headers and favicon links", () => {
  for (const html of [indexHtml, itemHtml]) {
    assert.match(html, /rel=["']icon["'][^>]*assets\/brand\/between-us-mark\.svg/);
    assert.match(html, /class=["']brand-mark["'][^>]*assets\/brand\/between-us-mark\.svg/);
  }
});

test("CSS implements approved tokens, fonts, focus, and responsive behavior", () => {
  const tokens = {
    "color-charcoal": "#252525",
    "color-ivory": "#F6F1E7",
    "color-ivory-soft": "#FBF8F2",
    "color-olive": "#6F7652",
    "color-terracotta": "#C66F49",
    "color-gold": "#C79A43",
    "color-muted": "#6C675F",
    "color-border": "#D9D0C2",
    "color-white": "#FFFFFF"
  };

  for (const [name, value] of Object.entries(tokens)) {
    assert.match(styles, new RegExp(`--${name}:\\s*${value}`, "i"));
  }

  assert.match(styles, /--font-display:\s*Georgia, ["']Times New Roman["'], serif/);
  assert.match(styles, /--font-body:\s*Arial, Helvetica, sans-serif/);
  assert.match(styles, /:focus-visible\s*{/);
  assert.match(styles, /@media\s*\(min-width:\s*600px\)/);
  assert.match(styles, /@media\s*\(min-width:\s*768px\)/);
  assert.match(styles, /@media\s*\(min-width:\s*900px\)/);
  assert.match(styles, /@media\s*\(prefers-reduced-motion:\s*reduce\)/);
  assert.doesNotMatch(styles, /@import|fonts\.googleapis\.com/i);
});
