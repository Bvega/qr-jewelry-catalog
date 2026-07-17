import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve, sep } from "node:path";
import test from "node:test";
import vm from "node:vm";
import {
  APPROVED_QR_LIBRARY,
  extractScriptSources,
  pathFromRoot,
  readProjectFile,
  repositoryRoot
} from "../../scripts/lib/baseline-contracts.mjs";
import { loadCollectionAndDiscoveryData } from "../../scripts/lib/discovery-contracts.mjs";
import {
  loadFindDetailRuntime,
  renderFindDetail
} from "../../scripts/lib/find-detail-contracts.mjs";

const findHtml = readProjectFile("find.html");
const itemHtml = readProjectFile("item.html");
const runtime = loadFindDetailRuntime();

class HomeElement {
  constructor() {
    this.children = [];
    this.attributes = Object.create(null);
    this.listeners = Object.create(null);
    this.textContent = "";
    this.href = "";
    this._innerHTML = "";
  }
  set innerHTML(value) {
    this._innerHTML = String(value);
    if (value === "") this.children = [];
  }
  get innerHTML() { return this._innerHTML; }
  appendChild(child) { this.children.push(child); return child; }
  setAttribute(name, value) { this.attributes[name] = String(value); }
  getAttribute(name) { return this.attributes[name] ?? null; }
  addEventListener(type, listener) { this.listeners[type] = listener; }
}

function renderHome() {
  const data = loadCollectionAndDiscoveryData();
  const ids = [
    "collectionGrid",
    "catalogGrid",
    "featuredGrid",
    "latestGrid",
    "weeklyFeature",
    "collectionFilters",
    "resultsSummary"
  ];
  const elements = Object.fromEntries(ids.map((id) => [id, new HomeElement()]));
  const context = {
    console,
    document: {
      getElementById(id) { return elements[id] ?? null; },
      createElement() { return new HomeElement(); }
    },
    window: {
      BETWEEN_US_COLLECTIONS: data.collections,
      BETWEEN_US_DATA: data.lookup,
      BETWEEN_US_DISCOVERY: data.discovery,
      BETWEEN_US_FINDS: data.finds,
      BETWEEN_US_PERMALINKS: data.permalinks,
      JEWELRY_ITEMS: data.legacyItems,
      location: { hash: "" }
    }
  };

  vm.runInNewContext(readProjectFile("app.js"), context, {
    filename: pathFromRoot("app.js")
  });
  return elements;
}

function readStaticRoute(route) {
  const request = new URL(route, "https://static-preview.test");
  const relativePath = request.pathname === "/" ? "index.html" : request.pathname.slice(1);
  const filePath = resolve(repositoryRoot, relativePath);
  if (filePath !== repositoryRoot && !filePath.startsWith(`${repositoryRoot}${sep}`)) return null;
  return readFileSync(filePath, "utf8");
}

test("permanent page exists with the approved shell, canonical element, and script order", () => {
  assert.ok(existsSync(pathFromRoot("find.html")));
  for (const landmark of ["header", "nav", "main", "footer"]) {
    assert.match(findHtml, new RegExp(`<${landmark}\\b`, "i"));
  }
  assert.match(findHtml, /\bid=["']itemDetail["']/);
  assert.match(findHtml, /Back to Explore/);
  assert.equal((findHtml.match(/rel=["']canonical["']/g) || []).length, 1);
  assert.equal((itemHtml.match(/rel=["']canonical["']/g) || []).length, 1);
  assert.deepEqual(extractScriptSources(findHtml), [
    "data/items.js",
    "data/collections.js",
    "data/media.js",
    "data/reservation.js",
    "data/permalinks.js",
    APPROVED_QR_LIBRARY,
    "item.js"
  ]);
});

test("all five public-ID and slug-alias routes resolve with a public-ID canonical URL", () => {
  for (const find of runtime.finds) {
    for (const route of [
      `find.html?id=${find.publicId}`,
      `find.html?slug=${find.slug}`
    ]) {
      const href = `https://example.test/catalog/${route}`;
      const result = renderFindDetail({ query: href.slice(href.indexOf("?")), href, runtime });

      assert.equal(result.find.publicId, find.publicId);
      assert.match(result.detail.innerHTML, new RegExp(find.title));
      assert.equal(
        result.elements.canonicalLink.getAttribute("href"),
        `https://example.test/catalog/find.html?id=${find.publicId}`
      );
    }
  }
});

test("all five legacy numeric routes resolve the same Find and public-ID canonical URL", () => {
  for (const find of runtime.finds) {
    const result = renderFindDetail({ query: `?id=${find.legacyId}`, runtime });

    assert.equal(result.find.publicId, find.publicId);
    assert.match(result.detail.innerHTML, new RegExp(find.title));
    assert.equal(
      result.elements.canonicalLink.getAttribute("href"),
      `https://example.test/find.html?id=${find.publicId}`
    );
  }
});

test("invalid routes render only the branded accessible not-found state", () => {
  const invalid = [
    "find.html",
    "find.html?id=",
    "find.html?id=BU-9999",
    "find.html?id=1",
    "find.html?slug=unknown",
    "find.html?id=BU-0001&slug=another-slug",
    "item.html",
    "item.html?id=not-a-number",
    "item.html?id=999"
  ];

  for (const route of invalid) {
    const href = `https://example.test/${route}`;
    const query = href.includes("?") ? href.slice(href.indexOf("?")) : "";
    const result = renderFindDetail({ query, href, runtime });

    assert.match(result.detail.innerHTML, /role="status"/);
    assert.match(result.detail.innerHTML, /Find not found/);
    assert.match(result.detail.innerHTML, /Back to Explore/);
    assert.doesNotMatch(result.detail.innerHTML, /shareFindBtn|copyLinkBtn|reserveMessageBtn|qrCodeCanvas/);
    assert.equal(result.elements.canonicalLink.getAttribute("href"), null);
  }
});

test("home discovery and Explore links all use public-ID permalinks in exact order", () => {
  const elements = renderHome();
  const base = "https://example.test/finds/find.html?id=";

  assert.deepEqual(
    elements.catalogGrid.children.map((card) => card.href),
    ["BU-0001", "BU-0002", "BU-0003", "BU-0004", "BU-0005"].map((id) => base + id)
  );
  assert.deepEqual(
    elements.featuredGrid.children.map((card) => card.href),
    ["BU-0001", "BU-0004", "BU-0005"].map((id) => base + id)
  );
  assert.deepEqual(
    elements.latestGrid.children.map((card) => card.href),
    ["BU-0004", "BU-0005", "BU-0001"].map((id) => base + id)
  );
  assert.match(elements.weeklyFeature.innerHTML, /find\.html\?id=BU-0001/);
});

test("Related Finds use permanent URLs while preserving configured order", () => {
  const result = renderFindDetail({ query: "?id=1", runtime });
  const first = result.detail.innerHTML.indexOf("find.html?id=BU-0002");
  const second = result.detail.innerHTML.indexOf("find.html?id=BU-0004");

  assert.ok(first >= 0);
  assert.ok(second > first);
  assert.doesNotMatch(result.detail.innerHTML, /href="item\.html\?id=/);
});

test("static serving resolves the permanent shell with public-ID and slug query strings", () => {
  for (const route of [
    "/find.html?id=BU-0001",
    "/find.html?id=BU-0005",
    "/find.html?slug=gold-twisted-rope-bracelet"
  ]) {
    const body = readStaticRoute(route);
    assert.match(body, /\bid=["']itemDetail["']/);
  }
});
