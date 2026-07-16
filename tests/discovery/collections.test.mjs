import assert from "node:assert/strict";
import test from "node:test";
import { readProjectFile } from "../../scripts/lib/baseline-contracts.mjs";
import {
  EXPECTED_COLLECTIONS,
  loadCollectionAndDiscoveryData,
  toPlainData
} from "../../scripts/lib/discovery-contracts.mjs";

const { collections } = loadCollectionAndDiscoveryData();

test("Collection registry exposes the exact six approved records in order", () => {
  assert.ok(Array.isArray(collections));
  assert.deepEqual(toPlainData(collections), toPlainData(EXPECTED_COLLECTIONS));
});

test("Jewelry is the only active Collection", () => {
  assert.deepEqual(
    Array.from(collections).filter((collection) => collection.status === "active")
      .map((collection) => collection.id),
    ["jewelry"]
  );
  assert.equal(
    Array.from(collections).filter((collection) => collection.status === "coming-soon").length,
    5
  );
});

test("Collection IDs are unique and statuses and sort order are valid", () => {
  const ids = Array.from(collections, (collection) => collection.id);

  assert.equal(new Set(ids).size, collections.length);
  assert.deepEqual(Array.from(collections, (collection) => collection.sortOrder), [1, 2, 3, 4, 5, 6]);
  for (const collection of collections) {
    assert.ok(["active", "coming-soon"].includes(collection.status));
  }
});

test("Collection records remain read-only and contain no duplicated Find fields", () => {
  assert.ok(Object.isFrozen(collections));
  for (const collection of collections) {
    assert.ok(Object.isFrozen(collection));
    assert.deepEqual(Object.keys(collection), ["id", "label", "description", "status", "sortOrder"]);
    for (const field of ["publicId", "legacyId", "title", "price", "photos", "availability"]) {
      assert.equal(Object.hasOwn(collection, field), false);
    }
  }
});

test("Collection registry is text-only and does not require product icons or emoji", () => {
  const source = readProjectFile("data/collections.js");

  assert.match(source, /window\.BETWEEN_US_COLLECTIONS\s*=\s*betweenUsCollections/);
  assert.doesNotMatch(source, /\b(?:icon|emoji)\s*:/i);
  assert.doesNotMatch(source, /[\p{Extended_Pictographic}]/u);
});
