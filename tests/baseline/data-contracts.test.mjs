import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import test from "node:test";
import {
  ALLOWED_AVAILABILITY,
  EXPECTED_LEGACY_IDS,
  EXPECTED_REAL_IMAGE_PATHS,
  KNOWN_MISSING_IMAGE_PATHS,
  getImageAssetState,
  loadCatalog,
  pathFromRoot,
  readProjectFile
} from "../../scripts/lib/baseline-contracts.mjs";

const items = loadCatalog();

test("catalog data exposes the existing global array", () => {
  assert.match(
    readProjectFile("data/items.js"),
    /window\.JEWELRY_ITEMS\s*=\s*jewelryItems\s*;/
  );
  assert.ok(Array.isArray(items));
  assert.ok(items.length > 0);
});

test("all baseline numeric item IDs are present and unique", () => {
  const ids = items.map((item) => item.id);

  assert.deepEqual([...ids].sort((a, b) => a - b), EXPECTED_LEGACY_IDS);
  assert.equal(new Set(ids).size, ids.length);
});

test("records retain fields and types required by the current renderers", () => {
  const requiredFields = [
    "id",
    "name",
    "price",
    "description",
    "status",
    "category",
    "relatedIds"
  ];

  for (const item of items) {
    for (const field of requiredFields) {
      assert.ok(
        Object.hasOwn(item, field),
        `item ${item.id ?? "<unknown>"} is missing ${field}`
      );
    }

    assert.ok(Number.isInteger(item.id) && item.id > 0, `invalid id ${item.id}`);
    assert.ok(typeof item.name === "string" && item.name.trim(), `invalid name for ${item.id}`);
    assert.ok(
      typeof item.description === "string" && item.description.trim(),
      `invalid description for ${item.id}`
    );
    assert.ok(
      typeof item.category === "string" && item.category.trim(),
      `invalid category for ${item.id}`
    );
    assert.ok(
      typeof item.price === "number" && Number.isFinite(item.price) && item.price >= 0,
      `invalid price for ${item.id}`
    );
    assert.ok(Array.isArray(item.relatedIds), `invalid relatedIds for ${item.id}`);

    if (item.image !== undefined && item.image !== null) {
      assert.ok(
        typeof item.image === "string" && item.image.trim(),
        `invalid image path for ${item.id}`
      );
    }
  }
});

test("availability values stay within the existing allowed set", () => {
  const allowed = new Set(ALLOWED_AVAILABILITY);

  for (const item of items) {
    assert.ok(allowed.has(item.status), `invalid availability ${item.status} for ${item.id}`);
  }

  assert.deepEqual(
    [...new Set(items.map((item) => item.status))].sort(),
    [...ALLOWED_AVAILABILITY].sort()
  );
});

test("related IDs are numeric and reference existing records", () => {
  const ids = new Set(items.map((item) => item.id));

  for (const item of items) {
    for (const relatedId of item.relatedIds) {
      assert.ok(Number.isInteger(relatedId), `item ${item.id} has non-integer related ID`);
      assert.ok(ids.has(relatedId), `item ${item.id} references missing item ${relatedId}`);
    }
  }
});

test("real image assets remain present and known placeholders remain warnings", () => {
  const imageState = getImageAssetState(items);
  const realPaths = imageState
    .filter((asset) => asset.exists)
    .map((asset) => asset.path)
    .sort();
  const missingPaths = imageState
    .filter((asset) => !asset.exists)
    .map((asset) => asset.path)
    .sort();

  assert.deepEqual(realPaths, [...EXPECTED_REAL_IMAGE_PATHS].sort());
  assert.deepEqual(missingPaths, [...KNOWN_MISSING_IMAGE_PATHS].sort());

  for (const imagePath of EXPECTED_REAL_IMAGE_PATHS) {
    assert.ok(existsSync(pathFromRoot(imagePath)), `missing real image ${imagePath}`);
  }
  for (const imagePath of KNOWN_MISSING_IMAGE_PATHS) {
    assert.equal(existsSync(pathFromRoot(imagePath)), false);
  }
});
