import assert from "node:assert/strict";
import vm from "node:vm";
import test from "node:test";
import {
  extractScriptSources,
  pathFromRoot,
  readProjectFile
} from "../../scripts/lib/baseline-contracts.mjs";
import {
  loadCollectionAndDiscoveryData,
  toPlainData
} from "../../scripts/lib/discovery-contracts.mjs";

const indexHtml = readProjectFile("index.html");
const appSource = readProjectFile("app.js");
const styles = readProjectFile("styles.css");
const runtimeData = loadCollectionAndDiscoveryData();

class StubElement {
  constructor(tagName, id = "") {
    this.tagName = tagName;
    this.id = id;
    this.children = [];
    this.attributes = Object.create(null);
    this.listeners = Object.create(null);
    this.className = "";
    this.href = "";
    this.textContent = "";
    this.type = "";
    this._innerHTML = "";
  }

  set innerHTML(value) {
    this._innerHTML = String(value);
    if (value === "") this.children = [];
  }

  get innerHTML() {
    return this._innerHTML;
  }

  appendChild(child) {
    this.children.push(child);
    return child;
  }

  setAttribute(name, value) {
    this.attributes[name] = String(value);
  }

  getAttribute(name) {
    return this.attributes[name] ?? null;
  }

  addEventListener(type, listener) {
    this.listeners[type] = listener;
  }

  click() {
    if (this.listeners.click) this.listeners.click();
  }
}

function renderHome({ collections = runtimeData.collections } = {}) {
  const elementIds = [
    "collectionGrid",
    "catalogGrid",
    "featuredGrid",
    "latestGrid",
    "weeklyFeature",
    "collectionFilters",
    "resultsSummary"
  ];
  const elements = Object.fromEntries(
    elementIds.map((id) => [id, new StubElement("div", id)])
  );
  const document = {
    getElementById(id) {
      return elements[id] ?? null;
    },
    createElement(tagName) {
      return new StubElement(tagName);
    }
  };
  const context = {
    console,
    document,
    window: {
      BETWEEN_US_FINDS: runtimeData.finds,
      BETWEEN_US_DATA: runtimeData.lookup,
      BETWEEN_US_COLLECTIONS: collections,
      BETWEEN_US_DISCOVERY: runtimeData.discovery,
      BETWEEN_US_PERMALINKS: runtimeData.permalinks,
      JEWELRY_ITEMS: runtimeData.legacyItems
    }
  };

  vm.runInNewContext(appSource, context, {
    filename: pathFromRoot("app.js")
  });

  return elements;
}

function filterByLabel(elements, label) {
  return elements.collectionFilters.children.find((button) => button.textContent === label);
}

test("home loads item, Collection, and Discovery data before app.js", () => {
  assert.deepEqual(extractScriptSources(indexHtml), [
    "data/items.js",
    "data/collections.js",
    "data/discovery.js",
    "data/media.js",
    "data/permalinks.js",
    "runtime-config.js",
    "data/public-catalog.js",
    "app.js"
  ]);
});

test("home sections use the exact required order and supporting copy", () => {
  const positions = ["home", "collections", "featured", "latest", "weekly", "explore", "about"]
    .map((id) => indexHtml.indexOf(`id="${id}"`));

  assert.ok(positions.every((position) => position >= 0));
  assert.deepEqual([...positions].sort((a, b) => a - b), positions);
  assert.match(indexHtml, /Featured Finds/);
  assert.match(indexHtml, /A curated selection from the current catalog\./);
  assert.match(indexHtml, /Latest Finds/);
  assert.match(indexHtml, /Recently highlighted Finds from the current collection\./);
  assert.match(indexHtml, /Find of the Week/);
  assert.match(indexHtml, /One Find selected for a closer look this week\./);
});

test("Collection preview is rendered from the registry with honest states", () => {
  const elements = renderHome();

  assert.equal(elements.collectionGrid.children.length, 6);
  runtimeData.collections.forEach((collection, index) => {
    const html = elements.collectionGrid.children[index].innerHTML;
    assert.match(html, new RegExp(collection.label.replace("&", "&amp;")));
    assert.ok(html.includes(collection.description));
    assert.ok(html.includes(collection.status === "active" ? "Current Collection" : "Coming Soon"));
  });
  assert.match(elements.collectionGrid.children[0].innerHTML, /href="#explore">Explore Jewelry/);
  for (const card of elements.collectionGrid.children.slice(1)) {
    assert.doesNotMatch(card.innerHTML, /<a\b/);
  }
});

test("Explore defaults to all five Finds in original order with permanent links", () => {
  const elements = renderHome();

  assert.deepEqual(
    elements.catalogGrid.children.map((card) => card.href),
    ["BU-0001", "BU-0002", "BU-0003", "BU-0004", "BU-0005"]
      .map((id) => `https://example.test/finds/find.html?id=${id}`)
  );
  assert.equal(elements.resultsSummary.textContent, "5 Finds");
});

test("only active Collections become accessible filter buttons", () => {
  const elements = renderHome();

  assert.deepEqual(
    elements.collectionFilters.children.map((button) => button.textContent),
    ["All Finds", "Jewelry"]
  );
  assert.ok(elements.collectionFilters.children.every((button) => button.tagName === "button"));
  assert.equal(filterByLabel(elements, "All Finds").getAttribute("aria-pressed"), "true");
  assert.equal(filterByLabel(elements, "Jewelry").getAttribute("aria-pressed"), "false");
  for (const label of ["Vintage", "Home & Decor", "Kitchen", "Collectibles", "New Items", "unknown"]) {
    assert.equal(filterByLabel(elements, label), undefined);
  }
});

test("Jewelry filter preserves order, permanent URLs, selected state, and summary", () => {
  const elements = renderHome();
  filterByLabel(elements, "Jewelry").click();

  assert.deepEqual(
    elements.catalogGrid.children.map((card) => card.href),
    ["BU-0001", "BU-0002", "BU-0003", "BU-0004", "BU-0005"]
      .map((id) => `https://example.test/finds/find.html?id=${id}`)
  );
  assert.equal(elements.resultsSummary.textContent, "5 Finds in Jewelry");
  assert.equal(filterByLabel(elements, "All Finds").getAttribute("aria-pressed"), "false");
  assert.equal(filterByLabel(elements, "Jewelry").getAttribute("aria-pressed"), "true");
});

test("a future active Collection with no Finds uses the approved empty state", () => {
  const futureCollections = [
    ...toPlainData(runtimeData.collections),
    {
      id: "future-active",
      label: "Future Active",
      description: "A future active Collection used only to exercise the empty state.",
      status: "active",
      sortOrder: 7
    }
  ];
  const elements = renderHome({ collections: futureCollections });
  filterByLabel(elements, "Future Active").click();

  assert.equal(elements.catalogGrid.children.length, 1);
  assert.equal(
    elements.catalogGrid.children[0].textContent,
    "No Finds are available in this Collection yet."
  );
  assert.equal(elements.resultsSummary.textContent, "0 Finds in Future Active");
});

test("Featured and Latest use exact configured order through shared cards", () => {
  const elements = renderHome();

  assert.deepEqual(
    elements.featuredGrid.children.map((card) => card.href),
    ["BU-0001", "BU-0004", "BU-0005"]
      .map((id) => `https://example.test/finds/find.html?id=${id}`)
  );
  assert.deepEqual(
    elements.latestGrid.children.map((card) => card.href),
    ["BU-0004", "BU-0005", "BU-0001"]
      .map((id) => `https://example.test/finds/find.html?id=${id}`)
  );
  assert.equal((appSource.match(/renderFindCards\(/g) || []).length, 4);
  assert.equal((appSource.match(/function createFindCard\(/g) || []).length, 1);
});

test("shared cards preserve visible data, image fallback, and availability", () => {
  const elements = renderHome();
  const firstCard = elements.featuredGrid.children[0].innerHTML;

  assert.match(firstCard, /Gold Twisted Rope Bracelet/);
  assert.match(firstCard, /\$28/);
  assert.match(firstCard, /badge-available[^>]*>Available/);
  assert.match(firstCard, /gold-twisted-rope-bracelet-01\.jpeg/);
  assert.match(firstCard, /onerror=/);
  assert.match(appSource, /No photo yet/);
});

test("Find of the Week presents the exact configured normalized Find", () => {
  const elements = renderHome();
  const html = elements.weeklyFeature.innerHTML;

  assert.match(html, /BU-0001/);
  assert.match(html, /Gold Twisted Rope Bracelet/);
  assert.ok(html.includes(runtimeData.finds[0].description));
  assert.match(html, /\$28/);
  assert.match(html, /badge-available[^>]*>Available/);
  assert.match(html, /href="https:\/\/example\.test\/finds\/find\.html\?id=BU-0001">View Find/);
});

test("filter controls expose live state, visible selection, focus, and mobile targets", () => {
  assert.match(indexHtml, /id="resultsSummary"[^>]*role="status"[^>]*aria-live="polite"/);
  assert.match(appSource, /button\.setAttribute\("aria-pressed"/);
  assert.match(styles, /\.collection-filter\s*{[\s\S]*?min-height:\s*44px/);
  assert.match(styles, /\.collection-filter\[aria-pressed="true"\]::after\s*{[\s\S]*?content:\s*"Selected"/);
  assert.match(styles, /:focus-visible\s*{/);
  assert.match(styles, /\.collection-filters\s*{[\s\S]*?flex-wrap:\s*wrap/);
});
