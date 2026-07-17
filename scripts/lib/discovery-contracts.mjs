import vm from "node:vm";
import {
  pathFromRoot,
  readProjectFile
} from "./baseline-contracts.mjs";

export const EXPECTED_COLLECTIONS = Object.freeze([
  Object.freeze({
    id: "jewelry",
    label: "Jewelry",
    description: "Wearable finds selected for style, detail, and everyday discovery.",
    status: "active",
    sortOrder: 1
  }),
  Object.freeze({
    id: "vintage",
    label: "Vintage",
    description: "Distinctive pieces with character, history, and lasting appeal.",
    status: "coming-soon",
    sortOrder: 2
  }),
  Object.freeze({
    id: "home-decor",
    label: "Home & Decor",
    description: "Useful and decorative finds for comfortable, personal spaces.",
    status: "coming-soon",
    sortOrder: 3
  }),
  Object.freeze({
    id: "kitchen",
    label: "Kitchen",
    description: "Practical kitchen finds chosen for everyday use.",
    status: "coming-soon",
    sortOrder: 4
  }),
  Object.freeze({
    id: "collectibles",
    label: "Collectibles",
    description: "Interesting pieces worth noticing, keeping, or sharing.",
    status: "coming-soon",
    sortOrder: 5
  }),
  Object.freeze({
    id: "new-items",
    label: "New Items",
    description: "Unused finds offered locally at honest prices.",
    status: "coming-soon",
    sortOrder: 6
  })
]);

export const EXPECTED_DISCOVERY = Object.freeze({
  featuredFindIds: Object.freeze(["BU-0001", "BU-0004", "BU-0005"]),
  latestFindIds: Object.freeze(["BU-0004", "BU-0005", "BU-0001"]),
  weeklyFindId: "BU-0001"
});

export function loadCollectionAndDiscoveryData() {
  const context = {
    URL,
    URLSearchParams,
    window: {
      location: { href: "https://example.test/finds/index.html" }
    }
  };

  for (const relativePath of [
    "data/items.js",
    "data/collections.js",
    "data/discovery.js",
    "data/permalinks.js"
  ]) {
    vm.runInNewContext(readProjectFile(relativePath), context, {
      filename: pathFromRoot(relativePath)
    });
  }

  return {
    collections: context.window.BETWEEN_US_COLLECTIONS,
    discovery: context.window.BETWEEN_US_DISCOVERY,
    finds: context.window.BETWEEN_US_FINDS,
    lookup: context.window.BETWEEN_US_DATA,
    legacyItems: context.window.JEWELRY_ITEMS,
    permalinks: context.window.BETWEEN_US_PERMALINKS
  };
}

export function toPlainData(value) {
  return JSON.parse(JSON.stringify(value));
}
