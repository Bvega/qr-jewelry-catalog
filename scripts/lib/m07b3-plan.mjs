import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";

import {
  ownerFindsPath,
  ownerPhotosPath,
  defaultRawPhotosDirectory,
  summarizeContentIntake,
  validateContentIntake
} from "./content-intake.mjs";

const moduleDirectory = dirname(fileURLToPath(import.meta.url));

export const repositoryRoot = resolve(moduleDirectory, "../..");
export const planPath = resolve(repositoryRoot, "migration/m07b3-catalog-plan.json");
export const collectionRegistryPath = resolve(repositoryRoot, "data/collections.js");
export const identifierRegistryPath = resolve(repositoryRoot, "docs/IDENTIFIER_REGISTRY.md");

export const SOURCE_PATHS = Object.freeze([
  "content-intake/finds.csv",
  "content-intake/photo-manifest.csv",
  "data/collections.js",
  "docs/IDENTIFIER_REGISTRY.md"
]);

export const MIGRATION_ASSIGNMENTS = Object.freeze([
  Object.freeze({ public_id: "BU-0006", slug: "vintage-ceramic-handbell", sort_order: 6 }),
  Object.freeze({ public_id: "BU-0007", slug: "burgundy-montblanc-pen", sort_order: 7 }),
  Object.freeze({ public_id: "BU-0008", slug: "hand-painted-decorative-shell", sort_order: 8 }),
  Object.freeze({ public_id: "BU-0009", slug: "vintage-floral-teacup-saucer", sort_order: 9 })
]);

export const PRESERVED_ASSIGNMENTS = Object.freeze([
  Object.freeze({ public_id: "BU-0001", legacy_id: 1, slug: "gold-twisted-rope-bracelet" }),
  Object.freeze({ public_id: "BU-0002", legacy_id: 2, slug: "silver-stackable-ring-set" }),
  Object.freeze({ public_id: "BU-0003", legacy_id: 3, slug: "pearl-drop-earrings" }),
  Object.freeze({ public_id: "BU-0004", legacy_id: 4, slug: "layered-gold-chain-necklace" }),
  Object.freeze({ public_id: "BU-0005", legacy_id: 5, slug: "crystal-stud-earrings" })
]);

export function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function uint24LittleEndian(bytes, offset) {
  return bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16);
}

export function readImageMetadata(bytes) {
  const buffer = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);

  if (
    buffer.length >= 24
    && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  ) {
    return {
      mime_type: "image/png",
      width: buffer.readUInt32BE(16),
      height: buffer.readUInt32BE(20)
    };
  }

  if (buffer.length >= 4 && buffer[0] === 0xff && buffer[1] === 0xd8) {
    let offset = 2;
    const startOfFrame = new Set([
      0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7,
      0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf
    ]);
    while (offset + 3 < buffer.length) {
      while (offset < buffer.length && buffer[offset] !== 0xff) offset += 1;
      while (offset < buffer.length && buffer[offset] === 0xff) offset += 1;
      const marker = buffer[offset];
      offset += 1;
      if (marker === 0xd8 || marker === 0xd9 || (marker >= 0xd0 && marker <= 0xd7)) continue;
      if (offset + 1 >= buffer.length) break;
      const segmentLength = buffer.readUInt16BE(offset);
      if (segmentLength < 2 || offset + segmentLength > buffer.length) break;
      if (startOfFrame.has(marker) && segmentLength >= 7) {
        return {
          mime_type: "image/jpeg",
          width: buffer.readUInt16BE(offset + 5),
          height: buffer.readUInt16BE(offset + 3)
        };
      }
      offset += segmentLength;
    }
    throw new Error("JPEG dimensions could not be read.");
  }

  if (
    buffer.length >= 30
    && buffer.toString("ascii", 0, 4) === "RIFF"
    && buffer.toString("ascii", 8, 12) === "WEBP"
  ) {
    const chunk = buffer.toString("ascii", 12, 16);
    if (chunk === "VP8X") {
      return {
        mime_type: "image/webp",
        width: uint24LittleEndian(buffer, 24) + 1,
        height: uint24LittleEndian(buffer, 27) + 1
      };
    }
    if (chunk === "VP8 " && buffer.length >= 30) {
      if (buffer[23] !== 0x9d || buffer[24] !== 0x01 || buffer[25] !== 0x2a) {
        throw new Error("WebP frame header is invalid.");
      }
      return {
        mime_type: "image/webp",
        width: buffer.readUInt16LE(26) & 0x3fff,
        height: buffer.readUInt16LE(28) & 0x3fff
      };
    }
    if (chunk === "VP8L" && buffer.length >= 25 && buffer[20] === 0x2f) {
      const packed = buffer.readUInt32LE(21);
      return {
        mime_type: "image/webp",
        width: (packed & 0x3fff) + 1,
        height: ((packed >>> 14) & 0x3fff) + 1
      };
    }
    throw new Error("WebP dimensions could not be read.");
  }

  throw new Error("Only JPEG, PNG, and WebP source photos are supported.");
}

export function parseCollectionRegistry(source) {
  const context = { window: {} };
  runInNewContext(source, context, { timeout: 1000 });
  const collections = context.window.BETWEEN_US_COLLECTIONS;
  if (!Array.isArray(collections)) throw new Error("Collection registry did not expose an array.");
  return collections.map((collection) => ({
    id: collection.id,
    label: collection.label,
    status: collection.status === "coming-soon" ? "coming_soon" : collection.status,
    sort_order: collection.sortOrder,
    description: collection.description
  }));
}

export function parseIdentifierRegistry(source) {
  const rows = [];
  for (const match of source.matchAll(
    /^\| `(?<publicId>BU-[0-9]{4})` \| (?<legacy>[^|]+) \| `(?<slug>[a-z0-9-]+)` \|/gm
  )) {
    rows.push({
      public_id: match.groups.publicId,
      legacy_id: /^\d+$/.test(match.groups.legacy.trim()) ? Number(match.groups.legacy.trim()) : null,
      slug: match.groups.slug
    });
  }
  return rows;
}

export function assertIdentifierRegistry(source) {
  const rows = parseIdentifierRegistry(source);
  const expected = [
    ...PRESERVED_ASSIGNMENTS,
    ...MIGRATION_ASSIGNMENTS.map(({ public_id, slug }) => ({ public_id, legacy_id: null, slug }))
  ];
  if (rows.length !== expected.length) throw new Error("Identifier registry must contain exactly nine assigned Finds.");
  for (const [index, assignment] of expected.entries()) {
    if (JSON.stringify(rows[index]) !== JSON.stringify(assignment)) {
      throw new Error(`Identifier registry mismatch at ${assignment.public_id}.`);
    }
  }
  if (!/The next new public ID is `BU-0010`/.test(source)) {
    throw new Error("Identifier registry must reserve BU-0010 as the next ID.");
  }
}

function assertApprovedIntake(validation) {
  const summary = summarizeContentIntake(validation);
  if (!validation.valid || summary.readyForReview !== 4 || summary.blocked !== 0) {
    throw new Error("The accepted intake must contain exactly four ready and zero blocked Finds.");
  }
  if (validation.finds.length !== 4 || validation.photos.length !== 4) {
    throw new Error("The accepted intake must contain exactly four Finds and four photos.");
  }
}

export function buildCatalogMigrationPlan({
  findsPath = ownerFindsPath,
  photosPath = ownerPhotosPath,
  photosDirectory = defaultRawPhotosDirectory,
  collectionsPath = collectionRegistryPath,
  registryPath = identifierRegistryPath
} = {}) {
  const validation = validateContentIntake({ findsPath, photosPath, rawPhotosDirectory: photosDirectory });
  assertApprovedIntake(validation);

  const collectionSource = readFileSync(collectionsPath);
  const identifierSource = readFileSync(registryPath);
  assertIdentifierRegistry(identifierSource.toString("utf8"));
  const collections = parseCollectionRegistry(collectionSource.toString("utf8"));

  const findsByKey = new Map(validation.finds.map((find) => [find.intake_key, find]));
  const photosByKey = new Map(validation.photos.map((photo) => [photo.intake_key, photo]));

  const finds = MIGRATION_ASSIGNMENTS.map((assignment) => {
    const find = findsByKey.get(assignment.slug);
    const manifestPhoto = photosByKey.get(assignment.slug);
    if (!find || !manifestPhoto) throw new Error(`Accepted intake is missing ${assignment.public_id}.`);
    if (find._relationships.length || find._additionalPhotos.length) {
      throw new Error(`Unexpected relationship or additional photo for ${assignment.public_id}.`);
    }
    if (
      find.featured !== "false"
      || find.price_currency !== "USD"
      || manifestPhoto.role !== "primary"
      || manifestPhoto.sequence !== "1"
      || manifestPhoto.owner_approved !== "true"
      || manifestPhoto.filename !== find.primary_photo_filename
    ) {
      throw new Error(`Accepted state mismatch for ${assignment.public_id}.`);
    }

    const photoBytes = readFileSync(resolve(photosDirectory, find.primary_photo_filename));
    const image = readImageMetadata(photoBytes);
    return {
      public_id: assignment.public_id,
      slug: assignment.slug,
      title: find.title,
      collection_id: find.collection,
      price_amount: Number(find.price_amount).toFixed(2),
      price_currency: "USD",
      availability: find.availability,
      description: find.description,
      condition: find.condition || null,
      legacy_id: null,
      is_published: false,
      is_featured: false,
      sort_order: assignment.sort_order,
      archived_at: null,
      photo: {
        filename: find.primary_photo_filename,
        mime_type: image.mime_type,
        byte_size: photoBytes.byteLength,
        sha256: sha256(photoBytes),
        width: image.width,
        height: image.height,
        alt_text: find.alt_text,
        role: "primary",
        sequence: 1
      }
    };
  });

  const sourceFiles = new Map([
    ["content-intake/finds.csv", readFileSync(findsPath)],
    ["content-intake/photo-manifest.csv", readFileSync(photosPath)],
    ["data/collections.js", collectionSource],
    ["docs/IDENTIFIER_REGISTRY.md", identifierSource]
  ]);

  return {
    plan_version: 1,
    sources: Object.fromEntries(SOURCE_PATHS.map((path) => [path, sha256(sourceFiles.get(path))])),
    collections,
    finds
  };
}

export function serializeCatalogMigrationPlan(plan) {
  return `${JSON.stringify(plan, null, 2)}\n`;
}
