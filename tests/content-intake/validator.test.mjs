import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import {
  repositoryRoot,
  validateContentIntake
} from "../../scripts/lib/content-intake.mjs";

const findHeaders = "intake_key,title,collection,price_amount,price_currency,availability,description,condition,primary_photo_filename,additional_photo_filenames,alt_text,related_public_ids,featured,owner_notes";
const photoHeaders = "filename,intake_key,role,sequence,orientation,background,owner_approved,notes";

function validFind(overrides = {}) {
  return {
    intake_key: "test-find",
    title: "Test Find",
    collection: "jewelry",
    price_amount: "10.00",
    price_currency: "USD",
    availability: "available",
    description: "Factual test description.",
    condition: "Good",
    primary_photo_filename: "test-find-01.jpg",
    additional_photo_filenames: "",
    alt_text: "Test object on a plain background.",
    related_public_ids: "BU-0001",
    featured: "false",
    owner_notes: "INTERNAL VALUE MUST NOT BE PUBLIC",
    ...overrides
  };
}

function validPhoto(overrides = {}) {
  return {
    filename: "test-find-01.jpg",
    intake_key: "test-find",
    role: "primary",
    sequence: "1",
    orientation: "landscape",
    background: "plain",
    owner_approved: "true",
    notes: "internal",
    ...overrides
  };
}

function csvRow(headers, record) {
  return headers.split(",").map((header) => record[header] ?? "").join(",");
}

function withFixture({ finds = [validFind()], photos = [validPhoto()], rawFiles = ["test-find-01.jpg"] }, callback) {
  const directory = mkdtempSync(join(tmpdir(), "between-us-intake-"));
  const rawDirectory = join(directory, "photos");
  mkdirSync(rawDirectory);
  const findsPath = join(directory, "finds.csv");
  const photosPath = join(directory, "photo-manifest.csv");
  writeFileSync(findsPath, `${findHeaders}\n${finds.map((record) => csvRow(findHeaders, record)).join("\n")}\n`);
  writeFileSync(photosPath, `${photoHeaders}\n${photos.map((record) => csvRow(photoHeaders, record)).join("\n")}\n`);
  for (const filename of rawFiles) writeFileSync(join(rawDirectory, filename), "test image placeholder");

  try {
    return callback({ directory, findsPath, photosPath, rawDirectory });
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

function validationFor(fixture) {
  return validateContentIntake({
    findsPath: fixture.findsPath,
    photosPath: fixture.photosPath,
    rawPhotosDirectory: fixture.rawDirectory
  });
}

function assertErrorCode(result, code) {
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((entry) => entry.code === code), `Expected error code ${code}`);
}

test("valid owner intake passes without modifying its inputs", () => {
  withFixture({}, (fixture) => {
    const before = [readFileSync(fixture.findsPath), readFileSync(fixture.photosPath)];
    const result = validationFor(fixture);
    const after = [readFileSync(fixture.findsPath), readFileSync(fixture.photosPath)];
    assert.equal(result.valid, true);
    assert.deepEqual(after, before);
  });
});

test("blank required inventory values fail", () => {
  withFixture({ finds: [validFind({ title: "" })] }, (fixture) => {
    assertErrorCode(validationFor(fixture), "missing-required-value");
  });
});

test("duplicate intake keys fail", () => {
  withFixture({ finds: [validFind(), validFind()] }, (fixture) => {
    assertErrorCode(validationFor(fixture), "duplicate-intake-key");
  });
});

test("invalid Collection fails", () => {
  withFixture({ finds: [validFind({ collection: "unknown" })] }, (fixture) => {
    assertErrorCode(validationFor(fixture), "invalid-collection");
  });
});

test("nonpositive or over-precise prices fail", () => {
  for (const price_amount of ["0", "10.999"]) {
    withFixture({ finds: [validFind({ price_amount })] }, (fixture) => {
      assertErrorCode(validationFor(fixture), "invalid-price");
    });
  }
});

test("invalid availability fails", () => {
  withFixture({ finds: [validFind({ availability: "pending" })] }, (fixture) => {
    assertErrorCode(validationFor(fixture), "invalid-availability");
  });
});

test("invalid filename or final extension fails", () => {
  withFixture({
    finds: [validFind({ primary_photo_filename: "Test Find 01.heic" })],
    photos: [validPhoto({ filename: "Test Find 01.heic" })],
    rawFiles: []
  }, (fixture) => {
    assertErrorCode(validationFor(fixture), "invalid-photo-filename");
  });
});

test("a missing manifest primary photo fails", () => {
  withFixture({ photos: [], rawFiles: [] }, (fixture) => {
    assertErrorCode(validationFor(fixture), "primary-photo-count");
  });
});

test("duplicate photo filenames fail", () => {
  withFixture({
    photos: [validPhoto(), validPhoto()],
    rawFiles: ["test-find-01.jpg"]
  }, (fixture) => {
    assertErrorCode(validationFor(fixture), "duplicate-photo-filename");
  });
});

test("internal owner notes are never included in validator output", () => {
  withFixture({ finds: [validFind({ price_amount: "invalid", owner_notes: "TOP SECRET INTERNAL NOTE" })] }, (fixture) => {
    const result = spawnSync(process.execPath, [
      "scripts/validate-content-intake.mjs",
      "--finds",
      fixture.findsPath,
      "--photos",
      fixture.photosPath
    ], { cwd: repositoryRoot, encoding: "utf8" });

    assert.equal(result.status, 1);
    assert.doesNotMatch(`${result.stdout}${result.stderr}`, /TOP SECRET INTERNAL NOTE/);
  });
});

const protectedPaths = [
  "data/items.js",
  "data/collections.js",
  "data/discovery.js",
  "data/media.js",
  "data/reservation.js",
  "data/permalinks.js",
  "index.html",
  "find.html",
  "item.html",
  "app.js",
  "item.js",
  "styles.css",
  "tests/fixtures/legacy-items.snapshot.json",
  "docs/IDENTIFIER_REGISTRY.md",
  ".github/workflows/baseline-validation.yml"
];

function protectedDigest() {
  const hash = createHash("sha256");
  for (const path of protectedPaths) {
    hash.update(path);
    hash.update(readFileSync(resolve(repositoryRoot, path)));
  }
  return hash.digest("hex");
}

test("validator and summary never mutate live catalog files", () => {
  const before = protectedDigest();
  const validator = spawnSync(process.execPath, ["scripts/validate-content-intake.mjs"], {
    cwd: repositoryRoot,
    encoding: "utf8"
  });
  const summary = spawnSync(process.execPath, ["scripts/summarize-content-intake.mjs"], {
    cwd: repositoryRoot,
    encoding: "utf8"
  });

  assert.equal(validator.status, 0, validator.stderr);
  assert.equal(summary.status, 0, summary.stderr);
  assert.equal(protectedDigest(), before);
});
