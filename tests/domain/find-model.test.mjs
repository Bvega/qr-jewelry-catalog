import assert from "node:assert/strict";
import test from "node:test";
import { ALLOWED_AVAILABILITY } from "../../scripts/lib/baseline-contracts.mjs";
import {
  EXPECTED_IDENTIFIERS,
  REQUIRED_FIND_FIELDS,
  loadFindData,
  loadLegacySnapshot
} from "../../scripts/lib/find-contracts.mjs";

const { finds, lookup } = loadFindData();
const legacySnapshot = loadLegacySnapshot();

test("normalized Finds and the read-only lookup namespace are exposed", () => {
  assert.equal(finds.length, 5);
  assert.equal(typeof lookup.findByPublicId, "function");
  assert.equal(typeof lookup.findByLegacyId, "function");
  assert.equal(typeof lookup.findBySlug, "function");
});

test("every Find contains all required normalized fields", () => {
  for (const find of finds) {
    for (const field of REQUIRED_FIND_FIELDS) {
      assert.ok(Object.hasOwn(find, field), `${find.publicId ?? "<unknown>"} is missing ${field}`);
    }
  }
});

test("public IDs use the permanent exact mapping and remain unique", () => {
  const publicIds = finds.map((find) => find.publicId);

  assert.deepEqual(
    finds.map(({ legacyId, publicId }) => ({ legacyId, publicId })),
    EXPECTED_IDENTIFIERS.map(({ legacyId, publicId }) => ({ legacyId, publicId }))
  );
  assert.equal(new Set(publicIds).size, finds.length);
  for (const publicId of publicIds) assert.match(publicId, /^BU-\d{4}$/);
});

test("legacy IDs are positive, unique, and preserve deterministic order", () => {
  const legacyIds = finds.map((find) => find.legacyId);

  assert.deepEqual(legacyIds, [1, 2, 3, 4, 5]);
  assert.equal(new Set(legacyIds).size, finds.length);
  for (const legacyId of legacyIds) assert.ok(Number.isInteger(legacyId) && legacyId > 0);
});

test("slugs use the registered lowercase ASCII kebab-case mapping", () => {
  const slugs = finds.map((find) => find.slug);

  assert.deepEqual(slugs, EXPECTED_IDENTIFIERS.map(({ slug }) => slug));
  assert.equal(new Set(slugs).size, finds.length);
  for (const slug of slugs) assert.match(slug, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
});

test("collection, availability, price, and nullable values follow the M02 model", () => {
  const allowedAvailability = new Set(ALLOWED_AVAILABILITY);

  for (const find of finds) {
    assert.equal(find.collection, "jewelry");
    assert.ok(allowedAvailability.has(find.availability));
    assert.ok(Number.isFinite(find.price.amount) && find.price.amount >= 0);
    assert.equal(find.price.currency, "USD");
    assert.equal(find.condition, null);
    assert.equal(find.createdAt, null);
    assert.equal(find.updatedAt, null);
    assert.equal(find.featured, false);
  }
});

test("photos, primary photos, and alt text preserve current media semantics", () => {
  for (const find of finds) {
    assert.ok(Array.isArray(find.photos));
    assert.equal(find.photos.length, 1);
    assert.equal(typeof find.primaryPhoto, "string");
    assert.ok(find.photos.includes(find.primaryPhoto));
    assert.equal(typeof find.altText, "string");
    assert.ok(find.altText.trim().length > 0);
    assert.ok(find.altText.includes(find.title));
  }
});

test("related public IDs resolve and exactly preserve legacy relationships", () => {
  const publicIds = new Set(finds.map((find) => find.publicId));

  for (const find of finds) {
    const legacyRecord = legacySnapshot.find((item) => item.id === find.legacyId);
    const expectedRelatedPublicIds = legacyRecord.relatedIds.map(
      (legacyId) => EXPECTED_IDENTIFIERS.find((entry) => entry.legacyId === legacyId).publicId
    );

    assert.ok(Array.isArray(find.relatedFindIds));
    assert.deepEqual(Array.from(find.relatedFindIds), expectedRelatedPublicIds);
    for (const relatedPublicId of find.relatedFindIds) {
      assert.ok(publicIds.has(relatedPublicId));
      assert.notEqual(relatedPublicId, find.publicId);
    }
  }
});

test("lookup helpers resolve each supported identifier and reject unknown values", () => {
  for (const find of finds) {
    assert.equal(lookup.findByPublicId(find.publicId), find);
    assert.equal(lookup.findByLegacyId(find.legacyId), find);
    assert.equal(lookup.findBySlug(find.slug), find);
  }

  assert.equal(lookup.findByPublicId("BU-9999"), null);
  assert.equal(lookup.findByPublicId(1), null);
  assert.equal(lookup.findByLegacyId(9999), null);
  assert.equal(lookup.findByLegacyId("1"), null);
  assert.equal(lookup.findBySlug("unknown-find"), null);
  assert.equal(lookup.findBySlug(null), null);
});

test("normalized data and lookup surfaces are read-only", () => {
  assert.ok(Object.isFrozen(lookup));

  for (const find of finds) {
    assert.ok(Object.isFrozen(find));
    assert.ok(Object.isFrozen(find.price));
    assert.ok(Object.isFrozen(find.photos));
    assert.ok(Object.isFrozen(find.relatedFindIds));
  }
});
