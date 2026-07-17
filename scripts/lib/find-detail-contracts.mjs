import vm from "node:vm";
import {
  pathFromRoot,
  readProjectFile
} from "./baseline-contracts.mjs";

export const APPROVED_RESERVATION_TEMPLATE =
  "Hello, I’m interested in reserving {title} ({publicId}) from Between Us. Is it still available?";

export const EXPECTED_UNAVAILABLE_MEDIA = Object.freeze([
  "assets/images/placeholder-ring-silver.jpg",
  "assets/images/placeholder-earrings-pearl.jpg"
]);

export function loadFindDetailRuntime() {
  const context = {
    URL,
    URLSearchParams,
    window: {
      location: { href: "https://example.test/item.html?id=1" }
    }
  };

  for (const relativePath of [
    "data/items.js",
    "data/collections.js",
    "data/media.js",
    "data/reservation.js",
    "data/permalinks.js"
  ]) {
    vm.runInNewContext(readProjectFile(relativePath), context, {
      filename: pathFromRoot(relativePath)
    });
  }

  return {
    collections: context.window.BETWEEN_US_COLLECTIONS,
    finds: context.window.BETWEEN_US_FINDS,
    legacyItems: context.window.JEWELRY_ITEMS,
    lookup: context.window.BETWEEN_US_DATA,
    media: context.window.BETWEEN_US_MEDIA,
    reservation: context.window.BETWEEN_US_RESERVATION,
    permalinks: context.window.BETWEEN_US_PERMALINKS
  };
}

export class StubElement {
  constructor(tagName = "div", id = "") {
    this.tagName = tagName;
    this.id = id;
    this.attributes = Object.create(null);
    this.children = [];
    this.hidden = false;
    this.href = "";
    this.src = "";
    this.alt = "";
    this.style = {};
    this.textContent = "";
    this.value = "";
    this.disabled = false;
    this._innerHTML = "";
    this.listeners = Object.create(null);
    this.nextElementSibling = null;
    this.focused = false;
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
    child.parentNode = this;
    return child;
  }

  removeChild(child) {
    const index = this.children.indexOf(child);
    if (index >= 0) this.children.splice(index, 1);
    child.parentNode = null;
    return child;
  }

  addEventListener(type, listener) {
    this.listeners[type] = listener;
  }

  setAttribute(name, value) {
    this.attributes[name] = String(value);
  }

  getAttribute(name) {
    return this.attributes[name] ?? null;
  }

  removeAttribute(name) {
    delete this.attributes[name];
  }

  click() {
    return this.listeners.click ? this.listeners.click({}) : undefined;
  }

  keydown(key) {
    if (!this.listeners.keydown) return undefined;
    return this.listeners.keydown({ key, preventDefault() {} });
  }

  focus() {
    this.focused = true;
  }

  select() {
    this.selected = true;
  }

  setSelectionRange(start, end) {
    this.selection = [start, end];
  }

  querySelector(selector) {
    const tagName = selector.toLowerCase();
    return this.children.find((child) => child.tagName.toLowerCase() === tagName) ?? null;
  }
}

function usablePhotos(find, media) {
  if (!find) return [];
  const photos = [];
  const add = (path) => {
    if (
      typeof path === "string" &&
      path &&
      !photos.includes(path) &&
      !media.isUnavailable(path)
    ) {
      photos.push(path);
    }
  };

  add(find.primaryPhoto);
  for (const photo of find.photos) add(photo);
  return photos;
}

export function renderFindDetail({
  query = "?id=1",
  href = `https://example.test/item.html${query}`,
  runtime = loadFindDetailRuntime(),
  lookup = runtime.lookup,
  navigator = { clipboard: { writeText: async () => {} } },
  qrCode,
  execCommand
} = {}) {
  const routeRuntime = {
    findByRoute(locationLike = href) {
      const registered = runtime.permalinks.findByRoute(locationLike);
      if (!registered) return null;
      const routeURL = new URL(
        typeof locationLike === "string" ? locationLike : locationLike.href
      );
      if (routeURL.pathname.endsWith("/item.html") && typeof lookup.findByLegacyId === "function") {
        return lookup.findByLegacyId(registered.legacyId);
      }
      if (typeof lookup.findByPublicId === "function") {
        return lookup.findByPublicId(registered.publicId);
      }
      return lookup.findByLegacyId(registered.legacyId);
    },
    permalinkFor(find, locationLike = href) {
      return runtime.permalinks.permalinkFor(find, locationLike);
    },
    legacyUrlFor(find, locationLike = href) {
      return runtime.permalinks.legacyUrlFor(find, locationLike);
    },
    slugAliasFor(find, locationLike = href) {
      return runtime.permalinks.slugAliasFor(find, locationLike);
    },
    currentCanonicalUrl(locationLike = href) {
      const find = this.findByRoute(locationLike);
      return find ? this.permalinkFor(find, locationLike) : null;
    }
  };
  const resolvedFind = routeRuntime.findByRoute(href);
  const canonicalURL = routeRuntime.currentCanonicalUrl(href);
  const photos = usablePhotos(resolvedFind, runtime.media);
  const elements = Object.create(null);
  const detail = new StubElement("section", "itemDetail");
  const thumbnailButtons = photos.length > 1
    ? photos.map((photo, index) => {
      const button = new StubElement("button");
      button.setAttribute("aria-pressed", String(index === 0));
      button.photo = photo;
      return button;
    })
    : [];

  detail.querySelectorAll = (selector) => selector === ".gallery-thumbnail"
    ? thumbnailButtons
    : [];
  elements.itemDetail = detail;

  if (photos.length > 0) {
    const mainImage = new StubElement("img", "galleryMainImage");
    const imageFallback = new StubElement("div");
    mainImage.src = photos[0];
    mainImage.alt = resolvedFind.altText;
    mainImage.nextElementSibling = imageFallback;
    imageFallback.hidden = true;
    elements.galleryMainImage = mainImage;
    elements.galleryStatus = new StubElement("p", "galleryStatus");
  }

  if (resolvedFind?.availability === "available") {
    elements.reserveMessageBtn = new StubElement("button", "reserveMessageBtn");
  }

  for (const idValue of [
    "reservationStatus",
    "reservationMessageFallback",
    "reservationFallbackLabel",
    "shareFindBtn",
    "copyLinkBtn",
    "shareUrlDisplay",
    "shareStatus",
    "manualCopyInstruction",
    "qrCodeCanvas",
    "qrStatus",
    "qrRetryBtn",
    "qrDownloadBtn"
  ]) {
    elements[idValue] = new StubElement("div", idValue);
  }

  elements.reservationMessageFallback.hidden = true;
  elements.reservationFallbackLabel.hidden = true;
  elements.manualCopyInstruction.hidden = true;
  elements.qrRetryBtn.hidden = true;
  elements.qrDownloadBtn.disabled = true;
  elements.canonicalLink = new StubElement("link", "canonicalLink");
  elements.canonicalLink.setAttribute("rel", "canonical");
  elements.canonicalLink.setAttribute("href", "");

  const body = new StubElement("body");
  const createdElements = [];
  const document = {
    title: "Find Details | Between Us Finds",
    getElementById(idValue) {
      return elements[idValue] ?? null;
    },
    createElement(tagName) {
      const element = new StubElement(tagName);
      createdElements.push(element);
      return element;
    },
    body
  };
  if (execCommand !== undefined) document.execCommand = execCommand;
  const context = {
    console,
    document,
    Intl,
    navigator,
    Promise,
    setTimeout() {},
    URL,
    URLSearchParams,
    window: {
      BETWEEN_US_COLLECTIONS: runtime.collections,
      BETWEEN_US_DATA: lookup,
      BETWEEN_US_FINDS: runtime.finds,
      BETWEEN_US_MEDIA: runtime.media,
      BETWEEN_US_PERMALINKS: routeRuntime,
      BETWEEN_US_RESERVATION: runtime.reservation,
      JEWELRY_ITEMS: runtime.legacyItems,
      isSecureContext: true,
      location: { href, search: query }
    }
  };

  if (qrCode !== undefined) {
    context.QRCode = qrCode;
    context.window.QRCode = qrCode;
  }

  vm.runInNewContext(readProjectFile("item.js"), context, {
    filename: pathFromRoot("item.js")
  });

  return {
    context,
    detail,
    document,
    elements,
    find: resolvedFind,
    href,
    canonicalURL,
    createdElements,
    photos,
    thumbnailButtons
  };
}

export function toPlainData(value) {
  return JSON.parse(JSON.stringify(value));
}
