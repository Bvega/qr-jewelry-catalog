import assert from "node:assert/strict";
import test from "node:test";
import { readProjectFile } from "../../scripts/lib/baseline-contracts.mjs";
import {
  loadFindData,
  loadLegacySnapshot,
  toPlainData
} from "../../scripts/lib/find-contracts.mjs";

const { finds, legacyItems } = loadFindData();
const legacySnapshot = loadLegacySnapshot();

test("legacy adapter output has exact pre-M02 snapshot parity", () => {
  assert.deepEqual(toPlainData(legacyItems), legacySnapshot);
});

test("adapter fields map from each normalized Find", () => {
  for (const find of finds) {
    const item = legacyItems.find((candidate) => candidate.id === find.legacyId);

    assert.deepEqual(Object.keys(item), [
      "id",
      "name",
      "price",
      "description",
      "status",
      "category",
      "image",
      "relatedIds"
    ]);
    assert.equal(item.id, find.legacyId);
    assert.equal(item.name, find.title);
    assert.equal(item.price, find.price.amount);
    assert.equal(item.description, find.description);
    assert.equal(item.status, find.availability);
    assert.equal(item.category, find.legacyCategory);
    assert.equal(item.image, find.primaryPhoto);
  }
});

test("adapter translates related public IDs back to numeric legacy IDs", () => {
  const legacyIdByPublicId = new Map(
    finds.map((find) => [find.publicId, find.legacyId])
  );

  for (const find of finds) {
    const item = legacyItems.find((candidate) => candidate.id === find.legacyId);
    const expectedRelatedIds = find.relatedFindIds.map(
      (publicId) => legacyIdByPublicId.get(publicId)
    );

    assert.deepEqual(Array.from(item.relatedIds), Array.from(expectedRelatedIds));
    for (const relatedId of item.relatedIds) assert.ok(Number.isInteger(relatedId));
  }
});

test("normalized and legacy record ordering is deterministic", () => {
  const secondLoad = loadFindData();

  assert.deepEqual(
    finds.map((find) => find.publicId),
    secondLoad.finds.map((find) => find.publicId)
  );
  assert.deepEqual(
    legacyItems.map((item) => item.id),
    secondLoad.legacyItems.map((item) => item.id)
  );
  assert.deepEqual(legacyItems.map((item) => item.id), [1, 2, 3, 4, 5]);
});

test("legacy items are derived from the single normalized source", () => {
  const source = readProjectFile("data/items.js");

  assert.match(source, /betweenUsFinds\.map\(toLegacyItem\)/);
  assert.doesNotMatch(source, /var\s+jewelryItems\s*=\s*\[/);
  assert.match(source, /window\.BETWEEN_US_FINDS\s*=\s*betweenUsFinds\s*;/);
  assert.match(source, /window\.JEWELRY_ITEMS\s*=\s*jewelryItems\s*;/);
});
