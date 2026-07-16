import assert from "node:assert/strict";
import vm from "node:vm";
import test from "node:test";
import {
  pathFromRoot,
  readProjectFile
} from "../../scripts/lib/baseline-contracts.mjs";
import {
  EXPECTED_DISCOVERY,
  loadCollectionAndDiscoveryData,
  toPlainData
} from "../../scripts/lib/discovery-contracts.mjs";

const { discovery, finds, lookup } = loadCollectionAndDiscoveryData();

test("Discovery configuration exposes the exact approved IDs and order", () => {
  assert.deepEqual(toPlainData(discovery), toPlainData(EXPECTED_DISCOVERY));
});

test("every Featured, Latest, and weekly reference resolves to a normalized Find", () => {
  for (const publicId of [...discovery.featuredFindIds, ...discovery.latestFindIds]) {
    assert.ok(lookup.findByPublicId(publicId), `missing discovery Find ${publicId}`);
  }
  assert.ok(lookup.findByPublicId(discovery.weeklyFindId));
});

test("Discovery configuration stores references only and duplicates no Find records", () => {
  assert.deepEqual(Object.keys(discovery), ["featuredFindIds", "latestFindIds", "weeklyFindId"]);
  assert.ok(discovery.featuredFindIds.every((value) => typeof value === "string"));
  assert.ok(discovery.latestFindIds.every((value) => typeof value === "string"));

  const source = readProjectFile("data/discovery.js");
  assert.doesNotMatch(source, /\b(?:title|description|price|photo|availability|legacyId|createdAt|updatedAt)\s*:/);
});

test("Discovery configuration and its ordered arrays are read-only", () => {
  assert.ok(Object.isFrozen(discovery));
  assert.ok(Object.isFrozen(discovery.featuredFindIds));
  assert.ok(Object.isFrozen(discovery.latestFindIds));
});

test("loading Discovery does not mutate normalized Finds or invent dates", () => {
  const context = { window: {} };
  vm.runInNewContext(readProjectFile("data/items.js"), context, {
    filename: pathFromRoot("data/items.js")
  });
  const before = JSON.stringify(context.window.BETWEEN_US_FINDS);
  vm.runInNewContext(readProjectFile("data/discovery.js"), context, {
    filename: pathFromRoot("data/discovery.js")
  });

  assert.equal(JSON.stringify(context.window.BETWEEN_US_FINDS), before);
  for (const find of finds) {
    assert.equal(find.createdAt, null);
    assert.equal(find.updatedAt, null);
    assert.equal(find.featured, false);
  }
});
