import { readFileSync } from "node:fs";
import vm from "node:vm";
import {
  pathFromRoot,
  readProjectFile
} from "./baseline-contracts.mjs";

export const REQUIRED_FIND_FIELDS = Object.freeze([
  "publicId",
  "legacyId",
  "slug",
  "title",
  "collection",
  "description",
  "condition",
  "availability",
  "price",
  "photos",
  "primaryPhoto",
  "altText",
  "relatedFindIds",
  "featured",
  "createdAt",
  "updatedAt"
]);

export const EXPECTED_IDENTIFIERS = Object.freeze([
  Object.freeze({
    legacyId: 1,
    publicId: "BU-0001",
    slug: "gold-twisted-rope-bracelet"
  }),
  Object.freeze({
    legacyId: 2,
    publicId: "BU-0002",
    slug: "silver-stackable-ring-set"
  }),
  Object.freeze({
    legacyId: 3,
    publicId: "BU-0003",
    slug: "pearl-drop-earrings"
  }),
  Object.freeze({
    legacyId: 4,
    publicId: "BU-0004",
    slug: "layered-gold-chain-necklace"
  }),
  Object.freeze({
    legacyId: 5,
    publicId: "BU-0005",
    slug: "crystal-stud-earrings"
  })
]);

export function loadFindData() {
  const source = readProjectFile("data/items.js");
  const context = { window: {} };

  vm.runInNewContext(source, context, {
    filename: pathFromRoot("data/items.js")
  });

  if (!Array.isArray(context.window.BETWEEN_US_FINDS)) {
    throw new TypeError("data/items.js did not expose window.BETWEEN_US_FINDS as an array");
  }
  if (!Array.isArray(context.window.JEWELRY_ITEMS)) {
    throw new TypeError("data/items.js did not expose window.JEWELRY_ITEMS as an array");
  }
  if (!context.window.BETWEEN_US_DATA) {
    throw new TypeError("data/items.js did not expose window.BETWEEN_US_DATA");
  }

  return {
    finds: Array.from(context.window.BETWEEN_US_FINDS),
    legacyItems: Array.from(context.window.JEWELRY_ITEMS),
    lookup: context.window.BETWEEN_US_DATA
  };
}

export function loadLegacySnapshot() {
  return JSON.parse(
    readFileSync(pathFromRoot("tests/fixtures/legacy-items.snapshot.json"), "utf8")
  );
}

export function toPlainData(value) {
  return JSON.parse(JSON.stringify(value));
}
