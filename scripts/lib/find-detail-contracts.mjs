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
  const context = { window: {} };

  for (const relativePath of [
    "data/items.js",
    "data/collections.js",
    "data/media.js",
    "data/reservation.js"
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
    reservation: context.window.BETWEEN_US_RESERVATION
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
    this._innerHTML = "";
    this.listeners = Object.create(null);
    this.nextElementSibling = null;
    this.focused = false;
  }

  set innerHTML(value) {
    this._innerHTML = String(value);
  }

  get innerHTML() {
    return this._innerHTML;
  }

  appendChild(child) {
    this.children.push(child);
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

  querySelector() {
    return null;
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
  qrCode
} = {}) {
  const id = Number.parseInt(new URLSearchParams(query).get("id"), 10);
  const resolvedFind = Number.isInteger(id) ? lookup.findByLegacyId(id) : null;
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
    "copyLinkBtn",
    "copyConfirm",
    "qrCodeCanvas",
    "qrFallback",
    "qrDownloadBtn"
  ]) {
    elements[idValue] = new StubElement("div", idValue);
  }

  elements.reservationMessageFallback.hidden = true;
  elements.reservationFallbackLabel.hidden = true;
  elements.copyConfirm.hidden = true;
  elements.qrFallback.hidden = true;

  const document = {
    title: "Find Details | Between Us Finds",
    getElementById(idValue) {
      return elements[idValue] ?? null;
    },
    createElement(tagName) {
      return new StubElement(tagName);
    },
    body: {
      appendChild() {},
      removeChild() {}
    }
  };
  const context = {
    console,
    document,
    Intl,
    navigator,
    Promise,
    setTimeout() {},
    URLSearchParams,
    window: {
      BETWEEN_US_COLLECTIONS: runtime.collections,
      BETWEEN_US_DATA: lookup,
      BETWEEN_US_FINDS: runtime.finds,
      BETWEEN_US_MEDIA: runtime.media,
      BETWEEN_US_RESERVATION: runtime.reservation,
      JEWELRY_ITEMS: runtime.legacyItems,
      location: { href, search: query }
    }
  };

  if (qrCode !== undefined) context.QRCode = qrCode;

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
    photos,
    thumbnailButtons
  };
}

export function toPlainData(value) {
  return JSON.parse(JSON.stringify(value));
}
