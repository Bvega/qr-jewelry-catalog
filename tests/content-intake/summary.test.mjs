import assert from "node:assert/strict";
import {
  mkdtempSync,
  mkdirSync,
  rmSync,
  writeFileSync
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import {
  repositoryRoot,
  summarizeContentIntake,
  validateContentIntake
} from "../../scripts/lib/content-intake.mjs";

const findHeaders = "intake_key,title,collection,price_amount,price_currency,availability,description,condition,primary_photo_filename,additional_photo_filenames,alt_text,related_public_ids,featured,owner_notes";
const photoHeaders = "filename,intake_key,role,sequence,orientation,background,owner_approved,notes";

test("default summary handles the no-owner-intake state exactly", () => {
  const result = spawnSync(process.execPath, ["scripts/summarize-content-intake.mjs"], {
    cwd: repositoryRoot,
    encoding: "utf8"
  });

  assert.equal(result.status, 0);
  assert.equal(result.stdout.trim(), "No owner intake file is present yet.");
});

test("summary reports collection, availability, readiness, and blocking counts", () => {
  const directory = mkdtempSync(join(tmpdir(), "between-us-summary-"));
  const rawDirectory = join(directory, "photos");
  const findsPath = join(directory, "finds.csv");
  const photosPath = join(directory, "photo-manifest.csv");
  mkdirSync(rawDirectory);

  const finds = [
    "ready-find,Ready Find,jewelry,10,USD,available,Factual description.,,ready-find-01.jpg,,Ready object on a plain background.,BU-0001,false,",
    "unapproved-find,Unapproved Find,vintage,20,USD,reserved,Factual description.,Good,unapproved-find-01.jpg,,Unapproved object on a plain background.,BU-9999,false,",
    "missing-photo-find,Missing Photo Find,kitchen,30,USD,sold,Factual description.,,missing-photo-find-01.jpg,,Missing object on a plain background.,,true,"
  ];
  const photos = [
    "ready-find-01.jpg,ready-find,primary,1,landscape,plain,true,",
    "unapproved-find-01.jpg,unapproved-find,primary,1,portrait,plain,false,",
    "missing-photo-find-01.jpg,missing-photo-find,primary,1,unknown,,true,"
  ];

  writeFileSync(findsPath, `${findHeaders}\n${finds.join("\n")}\n`);
  writeFileSync(photosPath, `${photoHeaders}\n${photos.join("\n")}\n`);
  writeFileSync(join(rawDirectory, "ready-find-01.jpg"), "test image placeholder");
  writeFileSync(join(rawDirectory, "unapproved-find-01.jpg"), "test image placeholder");

  try {
    const validation = validateContentIntake({ findsPath, photosPath, rawPhotosDirectory: rawDirectory });
    const summary = summarizeContentIntake(validation);

    assert.equal(validation.valid, true);
    assert.equal(summary.proposedFindCount, 3);
    assert.deepEqual(Object.fromEntries(summary.byCollection), { jewelry: 1, vintage: 1, kitchen: 1 });
    assert.deepEqual(Object.fromEntries(summary.byAvailability), { available: 1, reserved: 1, sold: 1 });
    assert.equal(summary.missingCondition, 2);
    assert.equal(summary.missingOrUnapprovedPhotos, 2);
    assert.equal(summary.unresolvedRelationships, 1);
    assert.equal(summary.readyForReview, 1);
    assert.equal(summary.blocked, 2);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
