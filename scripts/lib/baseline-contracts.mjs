import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const moduleDirectory = dirname(fileURLToPath(import.meta.url));

export const repositoryRoot = resolve(moduleDirectory, "../..");

export const EXPECTED_LEGACY_IDS = Object.freeze([1, 2, 3, 4, 5]);
export const ALLOWED_AVAILABILITY = Object.freeze([
  "available",
  "reserved",
  "sold"
]);

export const APPROVED_QR_LIBRARY =
  "https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js";

export const EXPECTED_REAL_IMAGE_PATHS = Object.freeze([
  "assets/images/gold-twisted-rope-bracelet-01.jpeg",
  "assets/images/layered-gold-chain-necklace-01.jpeg",
  "assets/images/crystal-stud-earrings-01.jpeg"
]);

export const KNOWN_MISSING_IMAGE_PATHS = Object.freeze([
  "assets/images/placeholder-ring-silver.jpg",
  "assets/images/placeholder-earrings-pearl.jpg"
]);

export function pathFromRoot(relativePath) {
  return resolve(repositoryRoot, relativePath);
}

export function readProjectFile(relativePath) {
  return readFileSync(pathFromRoot(relativePath), "utf8");
}

export function loadCatalog() {
  const source = readProjectFile("data/items.js");
  const context = { window: {} };

  vm.runInNewContext(source, context, {
    filename: pathFromRoot("data/items.js")
  });

  if (!Array.isArray(context.window.JEWELRY_ITEMS)) {
    throw new TypeError("data/items.js did not expose window.JEWELRY_ITEMS as an array");
  }

  return Array.from(context.window.JEWELRY_ITEMS);
}

export function getImageAssetState(items = loadCatalog()) {
  return items
    .filter((item) => typeof item.image === "string" && item.image.length > 0)
    .map((item) => ({
      id: item.id,
      name: item.name,
      path: item.image,
      exists: existsSync(pathFromRoot(item.image))
    }));
}

export function extractScriptSources(html) {
  return Array.from(html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi),
    (match) => match[1]);
}

export function extractStylesheetLinks(html) {
  return Array.from(
    html.matchAll(/<link\b(?=[^>]*\brel=["']stylesheet["'])(?=[^>]*\bhref=["']([^"']+)["'])[^>]*>/gi),
    (match) => match[1]
  );
}
