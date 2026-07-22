#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import {
  defaultRawPhotosDirectory,
  ownerFindsPath,
  ownerPhotosPath,
  summarizeContentIntake,
  validateContentIntake
} from "./lib/content-intake.mjs";
import {
  MIGRATION_ASSIGNMENTS,
  SOURCE_PATHS,
  assertIdentifierRegistry,
  collectionRegistryPath,
  identifierRegistryPath,
  parseCollectionRegistry,
  planPath,
  readImageMetadata,
  sha256
} from "./lib/m07b3-plan.mjs";

const PLAN_KEYS = ["plan_version", "sources", "collections", "finds"];
const COLLECTION_KEYS = ["id", "label", "status", "sort_order", "description"];
const FIND_KEYS = [
  "public_id", "slug", "title", "collection_id", "price_amount", "price_currency",
  "availability", "description", "condition", "legacy_id", "is_published", "is_featured",
  "sort_order", "archived_at", "photo"
];
const PHOTO_KEYS = [
  "filename", "mime_type", "byte_size", "sha256", "width", "height", "alt_text", "role", "sequence"
];
const PROHIBITED_KEY_PATTERN = /(?:owner|credential|password|secret|token|session|uuid|absolute|relation|notes)/i;

function sameKeys(value, expected) {
  return value && typeof value === "object"
    && JSON.stringify(Object.keys(value)) === JSON.stringify(expected);
}

function findProhibitedKey(value) {
  if (!value || typeof value !== "object") return false;
  for (const [key, nested] of Object.entries(value)) {
    if (PROHIBITED_KEY_PATTERN.test(key)) return true;
    if (findProhibitedKey(nested)) return true;
  }
  return false;
}

function push(errors, condition, message) {
  if (!condition) errors.push(message);
}

export function validateCatalogMigration({
  migrationPlanPath = planPath,
  findsPath = ownerFindsPath,
  photosPath = ownerPhotosPath,
  photosDirectory = defaultRawPhotosDirectory,
  collectionsPath = collectionRegistryPath,
  registryPath = identifierRegistryPath
} = {}) {
  const errors = [];
  if (!existsSync(migrationPlanPath)) return { valid: false, errors: ["Tracked migration plan is missing."] };

  let plan;
  try {
    plan = JSON.parse(readFileSync(migrationPlanPath, "utf8"));
  } catch {
    return { valid: false, errors: ["Tracked migration plan is not valid JSON."] };
  }

  push(errors, sameKeys(plan, PLAN_KEYS), "Plan top-level fields are not exact.");
  push(errors, plan.plan_version === 1, "Plan version must be 1.");
  push(errors, !findProhibitedKey(plan), "Plan contains a prohibited field.");
  push(errors, sameKeys(plan.sources, SOURCE_PATHS), "Plan source hash fields are not exact.");
  push(errors, Array.isArray(plan.collections) && plan.collections.length === 6, "Plan must contain six Collections.");
  push(errors, Array.isArray(plan.finds) && plan.finds.length === 4, "Plan must contain four Finds.");

  let validation;
  try {
    validation = validateContentIntake({ findsPath, photosPath, rawPhotosDirectory: photosDirectory });
    const summary = summarizeContentIntake(validation);
    push(errors, validation.valid && summary.readyForReview === 4 && summary.blocked === 0, "Accepted intake is not 4 ready and 0 blocked.");
    push(errors, validation.finds.length === 4 && validation.photos.length === 4, "Accepted intake count drifted.");
  } catch {
    errors.push("Accepted intake could not be read.");
  }

  const collectionSource = existsSync(collectionsPath) ? readFileSync(collectionsPath) : null;
  const registrySource = existsSync(registryPath) ? readFileSync(registryPath) : null;
  try {
    if (!registrySource) throw new Error();
    assertIdentifierRegistry(registrySource.toString("utf8"));
  } catch {
    errors.push("Identifier registry does not preserve the approved assignment contract.");
  }

  let expectedCollections = [];
  try {
    if (!collectionSource) throw new Error();
    expectedCollections = parseCollectionRegistry(collectionSource.toString("utf8"));
  } catch {
    errors.push("Collection registry could not be derived.");
  }

  const sourceFiles = {
    "content-intake/finds.csv": existsSync(findsPath) ? readFileSync(findsPath) : null,
    "content-intake/photo-manifest.csv": existsSync(photosPath) ? readFileSync(photosPath) : null,
    "data/collections.js": collectionSource,
    "docs/IDENTIFIER_REGISTRY.md": registrySource
  };
  for (const path of SOURCE_PATHS) {
    const bytes = sourceFiles[path];
    push(errors, Boolean(bytes), `Source is missing: ${path}.`);
    if (bytes) push(errors, plan.sources?.[path] === sha256(bytes), `Source drift detected: ${path}.`);
  }

  if (Array.isArray(plan.collections)) {
    for (const collection of plan.collections) {
      push(errors, sameKeys(collection, COLLECTION_KEYS), `Collection ${collection?.id || "unknown"} has unexpected fields.`);
    }
    push(errors, JSON.stringify(plan.collections) === JSON.stringify(expectedCollections), "Collection definitions do not match the repository registry.");
  }

  if (validation && Array.isArray(plan.finds)) {
    const findsByKey = new Map(validation.finds.map((find) => [find.intake_key, find]));
    const photosByKey = new Map(validation.photos.map((photo) => [photo.intake_key, photo]));
    for (const [index, assignment] of MIGRATION_ASSIGNMENTS.entries()) {
      const actual = plan.finds[index];
      const intake = findsByKey.get(assignment.slug);
      const manifest = photosByKey.get(assignment.slug);
      push(errors, sameKeys(actual, FIND_KEYS), `${assignment.public_id} has unexpected fields.`);
      push(errors, sameKeys(actual?.photo, PHOTO_KEYS), `${assignment.public_id} photo has unexpected fields.`);
      if (!actual || !intake || !manifest) {
        errors.push(`${assignment.public_id} is missing from the independently derived plan.`);
        continue;
      }
      const expectedFind = {
        public_id: assignment.public_id,
        slug: assignment.slug,
        title: intake.title,
        collection_id: intake.collection,
        price_amount: Number(intake.price_amount).toFixed(2),
        price_currency: "USD",
        availability: intake.availability,
        description: intake.description,
        condition: intake.condition || null,
        legacy_id: null,
        is_published: false,
        is_featured: false,
        sort_order: assignment.sort_order,
        archived_at: null
      };
      for (const [key, value] of Object.entries(expectedFind)) {
        push(errors, actual[key] === value, `${assignment.public_id} field mismatch: ${key}.`);
      }
      push(errors, intake._relationships.length === 0, `${assignment.public_id} has an unexpected relationship.`);
      push(errors, intake._additionalPhotos.length === 0, `${assignment.public_id} has an unexpected additional photo.`);
      push(errors, manifest.filename === intake.primary_photo_filename && manifest.role === "primary" && manifest.sequence === "1" && manifest.owner_approved === "true", `${assignment.public_id} manifest mismatch.`);

      const photoPath = resolve(photosDirectory, intake.primary_photo_filename);
      if (!existsSync(photoPath)) {
        errors.push(`${assignment.public_id} source photo is missing.`);
        continue;
      }
      try {
        const bytes = readFileSync(photoPath);
        const image = readImageMetadata(bytes);
        const expectedPhoto = {
          filename: intake.primary_photo_filename,
          mime_type: image.mime_type,
          byte_size: bytes.byteLength,
          sha256: sha256(bytes),
          width: image.width,
          height: image.height,
          alt_text: intake.alt_text,
          role: "primary",
          sequence: 1
        };
        push(errors, JSON.stringify(actual.photo) === JSON.stringify(expectedPhoto), `${assignment.public_id} image integrity mismatch.`);
      } catch {
        errors.push(`${assignment.public_id} source photo could not be verified.`);
      }
    }
  }

  return { valid: errors.length === 0, errors, plan };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = validateCatalogMigration();
  if (!result.valid) {
    console.error("Catalog migration validation: FAIL");
    for (const error of result.errors) console.error(`- ${error}`);
    process.exitCode = 1;
  } else {
    console.log("Catalog migration validation: PASS (4 hidden Finds, 4 verified photos, 6 Collections)");
  }
}
