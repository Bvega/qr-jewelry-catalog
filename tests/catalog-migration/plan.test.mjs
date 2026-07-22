import assert from "node:assert/strict";
import { cpSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";

import { buildCatalogMigrationPlan, serializeCatalogMigrationPlan } from "../../scripts/lib/m07b3-plan.mjs";
import { validateCatalogMigration } from "../../scripts/validate-catalog-migration.mjs";

const root = resolve(import.meta.dirname, "../..");
const planPath = resolve(root, "migration/m07b3-catalog-plan.json");

test("plan contains the exact four hidden records, slugs, order, and verified images", () => {
  const plan = JSON.parse(readFileSync(planPath, "utf8"));
  assert.deepEqual(plan.finds.map((find) => find.public_id), ["BU-0006", "BU-0007", "BU-0008", "BU-0009"]);
  assert.deepEqual(plan.finds.map((find) => find.slug), [
    "vintage-ceramic-handbell", "burgundy-montblanc-pen",
    "hand-painted-decorative-shell", "vintage-floral-teacup-saucer"
  ]);
  assert.deepEqual(plan.finds.map((find) => find.sort_order), [6, 7, 8, 9]);
  for (const find of plan.finds) {
    assert.equal(find.legacy_id, null);
    assert.equal(find.is_published, false);
    assert.equal(find.is_featured, false);
    assert.equal(find.archived_at, null);
    assert.match(find.photo.sha256, /^[0-9a-f]{64}$/);
    assert.ok(find.photo.byte_size > 0);
    assert.ok(find.photo.width > 0 && find.photo.height > 0);
  }
});

test("generation is deterministic and matches the tracked bytes", () => {
  const first = serializeCatalogMigrationPlan(buildCatalogMigrationPlan());
  const second = serializeCatalogMigrationPlan(buildCatalogMigrationPlan());
  assert.equal(first, second);
  assert.equal(first, readFileSync(planPath, "utf8"));
});

test("independent validation detects CSV and image drift", () => {
  const directory = mkdtempSync(join(tmpdir(), "m07b3-drift-"));
  const findsPath = join(directory, "finds.csv");
  const photosPath = join(directory, "photo-manifest.csv");
  const photosDirectory = join(directory, "photos");
  cpSync(resolve(root, "content-intake/finds.csv"), findsPath);
  cpSync(resolve(root, "content-intake/photo-manifest.csv"), photosPath);
  cpSync(resolve(root, "content-intake/photos"), photosDirectory, { recursive: true });

  writeFileSync(findsPath, readFileSync(findsPath, "utf8").replace("Vintage Ceramic Handbell", "Changed Handbell"));
  const csvResult = validateCatalogMigration({ migrationPlanPath: planPath, findsPath, photosPath, photosDirectory });
  assert.equal(csvResult.valid, false);
  assert.ok(csvResult.errors.some((error) => /drift|mismatch/i.test(error)));

  cpSync(resolve(root, "content-intake/finds.csv"), findsPath);
  const imagePath = join(photosDirectory, "vintage-ceramic-handbell-01.jpeg");
  writeFileSync(imagePath, Buffer.concat([readFileSync(imagePath), Buffer.from([0])]));
  const imageResult = validateCatalogMigration({ migrationPlanPath: planPath, findsPath, photosPath, photosDirectory });
  assert.equal(imageResult.valid, false);
  assert.ok(imageResult.errors.some((error) => /image integrity/i.test(error)));
});

test("tracked plan excludes prohibited and unexpected fields", () => {
  const source = readFileSync(planPath, "utf8");
  const plan = JSON.parse(source);
  assert.doesNotMatch(source, /owner|credential|password|secret|token|session|uuid|absolute|relation|notes/i);
  assert.deepEqual(Object.keys(plan), ["plan_version", "sources", "collections", "finds"]);
});
