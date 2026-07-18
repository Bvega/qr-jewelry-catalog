import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  loadIntakeSchema,
  parseCsv,
  repositoryRoot,
  validateContentIntake
} from "../../scripts/lib/content-intake.mjs";
import { resolve } from "node:path";

const expectedFindHeaders = [
  "intake_key",
  "title",
  "collection",
  "price_amount",
  "price_currency",
  "availability",
  "description",
  "condition",
  "primary_photo_filename",
  "additional_photo_filenames",
  "alt_text",
  "related_public_ids",
  "featured",
  "owner_notes"
];

const expectedPhotoHeaders = [
  "filename",
  "intake_key",
  "role",
  "sequence",
  "orientation",
  "background",
  "owner_approved",
  "notes"
];

function readCsv(relativePath) {
  const path = resolve(repositoryRoot, relativePath);
  return parseCsv(readFileSync(path, "utf8"), path);
}

test("inventory and photo templates use the exact approved header order", () => {
  assert.deepEqual(readCsv("content-intake/finds-template.csv").headers, expectedFindHeaders);
  assert.deepEqual(readCsv("content-intake/photo-manifest-template.csv").headers, expectedPhotoHeaders);
});

test("templates and examples contain only the labeled fictional structural record", () => {
  for (const path of [
    "content-intake/finds-template.csv",
    "content-intake/examples/finds-example.csv"
  ]) {
    const parsed = readCsv(path);
    assert.equal(parsed.records.length, 1);
    assert.equal(parsed.records[0].cells[0], "sample-find-do-not-publish");
    assert.match(parsed.records[0].cells.at(-1), /NON-PRODUCTION EXAMPLE/);
  }

  for (const path of [
    "content-intake/photo-manifest-template.csv",
    "content-intake/examples/photo-manifest-example.csv"
  ]) {
    const parsed = readCsv(path);
    assert.equal(parsed.records.length, 1);
    assert.equal(parsed.records[0].cells[1], "sample-find-do-not-publish");
    assert.match(parsed.records[0].cells.at(-1), /NON-PRODUCTION EXAMPLE/);
  }
});

test("machine-readable schema matches the templates and protects internal notes", () => {
  const schema = loadIntakeSchema();
  assert.deepEqual(schema.inventory.headers, expectedFindHeaders);
  assert.deepEqual(schema.photoManifest.headers, expectedPhotoHeaders);
  assert.deepEqual(schema.inventory.collectionIds, [
    "jewelry",
    "vintage",
    "home-decor",
    "kitchen",
    "collectibles",
    "new-items"
  ]);
  assert.deepEqual(schema.inventory.availabilityValues, ["available", "reserved", "sold"]);
  assert.equal(schema.inventory.currency, "USD");
  assert.equal(schema.booleanBehavior.featuredMayBeBlank, true);
  assert.equal(schema.booleanBehavior.ownerApprovedMayBeBlank, false);
  assert.match(schema.notesBoundary.owner_notes, /Internal only/);
  assert.match(schema.notesBoundary.notes, /Never copied to public fields/);
});

test("tracked examples pass the shared intake contract", () => {
  const result = validateContentIntake({
    findsPath: resolve(repositoryRoot, "content-intake/examples/finds-example.csv"),
    photosPath: resolve(repositoryRoot, "content-intake/examples/photo-manifest-example.csv")
  });

  assert.equal(result.valid, true);
  assert.equal(result.errors.length, 0);
});
