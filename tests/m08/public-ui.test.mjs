import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";
import { readProjectFile, pathFromRoot } from "../../scripts/lib/baseline-contracts.mjs";
import {
  StubElement,
  loadFindDetailRuntime,
  renderFindDetail
} from "../../scripts/lib/find-detail-contracts.mjs";
import { loadCollectionAndDiscoveryData } from "../../scripts/lib/discovery-contracts.mjs";

class Element {
  constructor(tagName, id = "") {
    this.tagName = tagName;
    this.id = id;
    this.children = [];
    this.attributes = {};
    this.className = "";
    this.href = "";
    this.textContent = "";
    this.hidden = false;
    this._innerHTML = "";
    this.listeners = {};
  }
  set innerHTML(value) {
    this._innerHTML = String(value);
    if (value === "") this.children = [];
  }
  get innerHTML() { return this._innerHTML; }
  appendChild(child) { this.children.push(child); return child; }
  setAttribute(name, value) { this.attributes[name] = String(value); }
  getAttribute(name) { return this.attributes[name] ?? null; }
  addEventListener(name, listener) { this.listeners[name] = listener; }
  click() { this.listeners.click?.(); }
}

function remoteFind(overrides = {}) {
  return Object.freeze({
    publicId: "BU-9101",
    legacyId: null,
    slug: "fictional-remote-find",
    title: "Fictional Remote Find",
    collection: "vintage",
    legacyCategory: null,
    description: "Fictional public UI record.",
    condition: "Good",
    availability: "available",
    price: Object.freeze({ amount: 42, currency: "USD" }),
    photos: Object.freeze(["blob:fictional-photo"]),
    photoAltTexts: Object.freeze(["Fictional remote object."]),
    primaryPhoto: "blob:fictional-photo",
    altText: "Fictional remote object.",
    relatedFindIds: Object.freeze([]),
    featured: false,
    createdAt: null,
    updatedAt: null,
    ...overrides
  });
}

function homeRuntime() {
  const accepted = loadCollectionAndDiscoveryData();
  const remote = remoteFind();
  const finds = [...accepted.finds, remote];
  const lookup = {
    findByPublicId(id) { return finds.find((find) => find.publicId === id) || null; },
    findByLegacyId(id) { return finds.find((find) => find.legacyId === id) || null; },
    findBySlug(slug) { return finds.find((find) => find.slug === slug) || null; }
  };
  const collections = accepted.collections.map((collection) => Object.freeze({
    ...collection,
    status: collection.id === "vintage" ? "active" : collection.status
  }));
  const ids = [
    "collectionGrid", "catalogGrid", "featuredGrid", "latestGrid", "weeklyFeature",
    "collectionFilters", "resultsSummary", "catalogAvailabilityStatus"
  ];
  const elements = Object.fromEntries(ids.map((id) => [id, new Element("div", id)]));
  const document = {
    getElementById(id) { return elements[id] || null; },
    createElement(tag) { return new Element(tag); }
  };
  const context = {
    console,
    document,
    window: {
      BETWEEN_US_FINDS: finds,
      BETWEEN_US_DATA: lookup,
      BETWEEN_US_COLLECTIONS: collections,
      BETWEEN_US_DISCOVERY: accepted.discovery,
      BETWEEN_US_PERMALINKS: {
        permalinkFor(find) {
          return `https://example.test/catalog/find.html?id=${find.publicId}`;
        }
      },
      JEWELRY_ITEMS: accepted.legacyItems,
      location: { hash: "" }
    }
  };
  vm.runInNewContext(readProjectFile("app.js"), context, { filename: pathFromRoot("app.js") });
  return { elements, remote };
}

test("Explore renders an eligible remote card, accurate count, image alt text, and active Collection", () => {
  const { elements, remote } = homeRuntime();
  assert.equal(elements.catalogGrid.children.length, 6);
  assert.equal(elements.resultsSummary.textContent, "6 Finds");
  const card = elements.catalogGrid.children.at(-1);
  assert.equal(card.href, `https://example.test/catalog/find.html?id=${remote.publicId}`);
  assert.match(card.innerHTML, /blob:fictional-photo/);
  assert.match(card.innerHTML, /alt="Fictional remote object\."/);
  assert.deepEqual(
    elements.collectionFilters.children.map((button) => button.textContent),
    ["All Finds", "Jewelry", "Vintage"]
  );
  const vintage = elements.collectionFilters.children.at(-1);
  vintage.click();
  assert.equal(elements.resultsSummary.textContent, "1 Find in Vintage");
  assert.equal(elements.catalogGrid.children.length, 1);
});

function remoteDetailRuntime({ withPhoto = true } = {}) {
  const base = loadFindDetailRuntime();
  const related = remoteFind({
    publicId: "BU-9102",
    slug: "fictional-related-find",
    title: "Fictional Related Find",
    photos: Object.freeze([]),
    primaryPhoto: null,
    altText: "Fictional related object."
  });
  const remote = remoteFind({
    photos: Object.freeze(withPhoto ? ["blob:fictional-photo"] : []),
    primaryPhoto: withPhoto ? "blob:fictional-photo" : null,
    relatedFindIds: Object.freeze(["BU-9102", "BU-9199"])
  });
  const finds = [...base.finds, remote, related];
  const lookup = {
    findByPublicId(id) { return finds.find((find) => find.publicId === id) || null; },
    findByLegacyId(id) { return finds.find((find) => find.legacyId === id) || null; },
    findBySlug(slug) { return finds.find((find) => find.slug === slug) || null; }
  };
  const permalinks = {
    findByRoute(locationLike) {
      const url = new URL(typeof locationLike === "string" ? locationLike : locationLike.href);
      if (url.pathname.endsWith("/find.html") && url.searchParams.size === 1) {
        if (url.searchParams.has("id")) return lookup.findByPublicId(url.searchParams.get("id"));
        if (url.searchParams.has("slug")) return lookup.findBySlug(url.searchParams.get("slug"));
      }
      if (url.pathname.endsWith("/item.html") && url.searchParams.size === 1) {
        return lookup.findByLegacyId(Number(url.searchParams.get("id")));
      }
      return null;
    },
    permalinkFor(find, locationLike) {
      const url = new URL("find.html", typeof locationLike === "string" ? locationLike : locationLike.href);
      url.search = "";
      url.searchParams.set("id", find.publicId);
      return url.href;
    },
    legacyUrlFor() { return null; },
    slugAliasFor(find, locationLike) {
      const url = new URL("find.html", typeof locationLike === "string" ? locationLike : locationLike.href);
      url.search = "";
      url.searchParams.set("slug", find.slug);
      return url.href;
    }
  };
  return { ...base, finds, lookup, permalinks };
}

async function freshRemoteDetailPage() {
  const href = "https://example.test/catalog/find.html?id=BU-9101";
  const canonicalURL = href;
  const elements = Object.create(null);
  const detail = new StubElement("section", "itemDetail");
  detail.innerHTML = "Loading Find details…";
  detail.querySelectorAll = () => [];
  elements.itemDetail = detail;

  for (const id of [
    "catalogAvailabilityStatus", "galleryStatus", "reservationStatus",
    "reservationMessageFallback", "reservationFallbackLabel", "reserveMessageBtn",
    "shareFindBtn", "copyLinkBtn", "shareUrlDisplay", "shareStatus",
    "manualCopyInstruction", "qrCodeCanvas", "qrStatus", "qrRetryBtn",
    "qrDownloadBtn"
  ]) {
    elements[id] = new StubElement("div", id);
  }
  elements.reservationMessageFallback.hidden = true;
  elements.reservationFallbackLabel.hidden = true;
  elements.manualCopyInstruction.hidden = true;
  elements.qrRetryBtn.hidden = true;
  elements.qrDownloadBtn.disabled = true;
  elements.canonicalLink = new StubElement("link", "canonicalLink");
  elements.galleryMainImage = new StubElement("img", "galleryMainImage");
  elements.galleryMainImage.nextElementSibling = new StubElement("div");

  const body = new StubElement("body");
  const createdElements = [];
  const document = {
    title: "Find Details | Between Us Finds",
    body,
    getElementById(id) {
      return elements[id] || null;
    },
    createElement(tag) {
      const created = new StubElement(tag);
      createdElements.push(created);
      return created;
    }
  };
  const shareCalls = [];
  const clipboardWrites = [];
  const navigator = {
    async share(value) {
      shareCalls.push(value);
    },
    clipboard: {
      async writeText(value) {
        clipboardWrites.push(value);
      }
    }
  };
  const qrOptions = [];
  function QRCode(container, options) {
    qrOptions.push(options);
    const canvas = new StubElement("canvas");
    canvas.toDataURL = () => "data:image/png;base64,fictional";
    container.appendChild(canvas);
  }
  const findRow = {
    id: "40000000-0000-4000-8000-000000000201",
    public_id: "BU-9101",
    slug: "fictional-remote-find",
    title: "Fictional Remote Find",
    collection_id: "vintage",
    price_amount: "42.00",
    price_currency: "USD",
    availability: "available",
    description: "Fictional public UI record.",
    condition: "Good",
    is_published: true,
    sort_order: 1,
    archived_at: null
  };
  const photoRow = {
    id: "40000000-0000-4000-8000-000000000301",
    find_id: findRow.id,
    storage_path: `${"finds"}/${findRow.id}/remote.jpg`,
    role: "primary",
    sequence: 1,
    alt_text: "Fictional remote object.",
    width: 800,
    height: 600
  };
  const fetchImplementation = async (input) => {
    const url = new URL(String(input));
    if (url.pathname.includes("/storage/v1/object/")) {
      return { ok: true, blob: async () => ({ type: "image/jpeg" }) };
    }
    const values = {
      collections: [],
      finds: [findRow],
      find_photos: [photoRow],
      find_relations: []
    };
    return { ok: true, json: async () => values[url.pathname.split("/").at(-1)] };
  };
  const context = {
    AbortController,
    URL,
    URLSearchParams,
    clearTimeout,
    console,
    document,
    Intl,
    navigator,
    Promise,
    QRCode,
    setTimeout,
    window: {
      AbortController,
      QRCode,
      URL: {
        createObjectURL() {
          return "blob:fictional-fresh-remote";
        },
        revokeObjectURL() {}
      },
      addEventListener() {},
      fetch: fetchImplementation,
      isSecureContext: true,
      location: { href, search: "?id=BU-9101" }
    }
  };
  for (const path of [
    "data/items.js",
    "data/collections.js",
    "data/media.js",
    "data/reservation.js",
    "data/permalinks.js"
  ]) {
    vm.runInNewContext(readProjectFile(path), context, { filename: pathFromRoot(path) });
  }
  context.window.BETWEEN_US_PUBLIC_CONFIG = {
    url: "https://m08testref123456.supabase.co/",
    publishableKey: "sb_publishable_m08_fictional_browser_key_123456"
  };
  vm.runInNewContext(
    readProjectFile("data/public-catalog.js"),
    context,
    { filename: pathFromRoot("data/public-catalog.js") }
  );
  vm.runInNewContext(readProjectFile("item.js"), context, { filename: pathFromRoot("item.js") });
  assert.equal(detail.innerHTML, "Loading Find details…");
  await context.window.BETWEEN_US_PUBLIC_CATALOG.ready;
  await Promise.resolve();

  return {
    canonicalURL,
    clipboardWrites,
    context,
    createdElements,
    detail,
    elements,
    qrOptions,
    shareCalls
  };
}

test("fresh direct remote detail and slug alias use canonical public-ID URLs and full utilities", () => {
  const runtime = remoteDetailRuntime();
  for (const href of [
    "https://example.test/catalog/find.html?id=BU-9101",
    "https://example.test/catalog/find.html?slug=fictional-remote-find"
  ]) {
    const result = renderFindDetail({ href, runtime, lookup: runtime.lookup });
    assert.equal(result.find.publicId, "BU-9101");
    assert.equal(result.canonicalURL, "https://example.test/catalog/find.html?id=BU-9101");
    assert.match(result.detail.innerHTML, /Fictional Remote Find/);
    assert.match(result.detail.innerHTML, /blob:fictional-photo/);
    assert.match(result.detail.innerHTML, /Fictional remote object\./);
    assert.match(result.detail.innerHTML, /Share This Find/);
    assert.match(result.detail.innerHTML, /Reserve This Find/);
    assert.match(result.detail.innerHTML, /Scan QR code/);
    assert.match(result.detail.innerHTML, /Fictional Related Find/);
    assert.doesNotMatch(result.detail.innerHTML, /BU-9199/);
    assert.equal(result.elements.canonicalLink.getAttribute("href"), result.canonicalURL);
  }
});

test("a static-only fresh detail load awaits Supabase and wires remote canonical utilities", async () => {
  const page = await freshRemoteDetailPage();
  assert.match(page.detail.innerHTML, /Fictional Remote Find/);
  assert.match(page.detail.innerHTML, /blob:fictional-fresh-remote/);
  assert.equal(page.elements.canonicalLink.getAttribute("href"), page.canonicalURL);
  assert.equal(page.qrOptions[0].text, page.canonicalURL);
  assert.equal(page.elements.qrDownloadBtn.disabled, false);

  page.elements.shareFindBtn.click();
  page.elements.copyLinkBtn.click();
  page.elements.reserveMessageBtn.click();
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(page.shareCalls[0].url, page.canonicalURL);
  assert.equal(page.shareCalls[1].url, page.canonicalURL);
  assert.deepEqual(page.clipboardWrites, [page.canonicalURL]);

  page.elements.qrDownloadBtn.click();
  const download = page.createdElements.find((element) => element.download);
  assert.equal(download.download, "between-us-BU-9101-qr.png");
  assert.equal(download.href, "data:image/png;base64,fictional");
});

test("remote missing-photo fallback remains honest and accessible", () => {
  const runtime = remoteDetailRuntime({ withPhoto: false });
  const result = renderFindDetail({
    href: "https://example.test/catalog/find.html?id=BU-9101",
    runtime,
    lookup: runtime.lookup
  });
  assert.match(result.detail.innerHTML, /No photo yet/);
  assert.match(result.detail.innerHTML, /Details are still available below/);
});

test("remote gallery selections use each photograph's accessible alt text", () => {
  const runtime = remoteDetailRuntime();
  const target = runtime.finds.find((find) => find.publicId === "BU-9101");
  const galleryFind = Object.freeze({
    ...target,
    photos: Object.freeze(["blob:fictional-photo", "blob:fictional-additional"]),
    photoAltTexts: Object.freeze(["Fictional front view.", "Fictional side view."]),
    primaryPhoto: "blob:fictional-photo",
    altText: "Fictional front view."
  });
  const finds = runtime.finds.map((find) => find.publicId === galleryFind.publicId ? galleryFind : find);
  const lookup = {
    findByPublicId(id) { return finds.find((find) => find.publicId === id) || null; },
    findByLegacyId(id) { return finds.find((find) => find.legacyId === id) || null; },
    findBySlug(slug) { return finds.find((find) => find.slug === slug) || null; }
  };
  const result = renderFindDetail({
    href: "https://example.test/catalog/find.html?id=BU-9101",
    runtime: { ...runtime, finds },
    lookup
  });
  assert.equal(result.elements.galleryMainImage.alt, "Fictional front view.");
  result.thumbnailButtons[1].click();
  assert.equal(result.elements.galleryMainImage.alt, "Fictional side view.");
});

test("public runtime keeps canonical sharing, Copy Link, reservation, and QR download contracts", () => {
  const source = readProjectFile("item.js");
  assert.match(source, /text:\s*canonicalURL/);
  assert.match(source, /copyText\(canonicalURL\)/);
  assert.match(source, /completeReservationMessage\(message, shareURL/);
  assert.match(source, /text:\s*canonicalURL,[\s\S]*width:\s*160/);
  assert.match(source, /link\.download = "between-us-" \+ find\.publicId \+ "-qr\.png"/);
});
