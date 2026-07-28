import { readdirSync } from "node:fs";
import { resolve } from "node:path";
import { repositoryRoot } from "./baseline-contracts.mjs";

// The controlled catalog migration checks read the owner-supplied M07B-3
// source photos under content-intake/photos/, which are intentionally
// untracked (.gitignore) and therefore absent from a clean GitHub checkout.
export const LOCAL_MIGRATION_EXCLUSION_REASON =
  "requires the intentionally untracked local-only M07B-3 source photos under content-intake/photos/";

export const LOCAL_MIGRATION_CHECK_LABELS = Object.freeze([
  "Controlled catalog migration validation",
  "Controlled catalog migration tests"
]);

export const repositoryTestDirectories = Object.freeze([
  "tests/baseline",
  "tests/domain",
  "tests/brand",
  "tests/discovery",
  "tests/detail",
  "tests/permalinks",
  "tests/content-intake",
  "tests/supabase-foundation",
  "tests/seller-manager",
  "tests/catalog-migration",
  "tests/m08"
]);

export function findTestFiles(relativeDirectory) {
  const testDirectory = resolve(repositoryRoot, relativeDirectory);

  return readdirSync(testDirectory)
    .filter((file) => file.endsWith(".test.mjs"))
    .sort()
    .map((file) => resolve(testDirectory, file));
}

function syntaxCheck(file) {
  return {
    label: `JavaScript syntax: ${file}`,
    displayCommand: `node --check ${file}`,
    arguments: ["--check", file]
  };
}

function scriptCheck(label, script) {
  return {
    label,
    displayCommand: `node ${script}`,
    arguments: [script]
  };
}

function testSuiteCheck(label, relativeDirectory) {
  return {
    label,
    displayCommand: `node --test ${relativeDirectory}/*.test.mjs`,
    arguments: ["--test", ...findTestFiles(relativeDirectory)]
  };
}

export function buildRepositoryChecks() {
  return Object.freeze([
    ...[
      "app.js",
      "item.js",
      "data/items.js",
      "data/collections.js",
      "data/discovery.js",
      "data/media.js",
      "data/reservation.js",
      "data/permalinks.js",
      "data/public-catalog.js",
      "runtime-config.js",
      "scripts/lib/content-intake.mjs",
      "scripts/validate-content-intake.mjs",
      "scripts/summarize-content-intake.mjs",
      "scripts/validate-supabase-foundation.mjs",
      "admin-src/app.js",
      "admin-src/auth.js",
      "admin-src/catalog.js",
      "admin-src/migration.js",
      "admin-src/migration-auth.js",
      "admin-src/migration-executor.js",
      "admin-src/migration-plan.js",
      "admin-src/migration-ui.js",
      "admin-src/photos.js",
      "admin-src/validation.js",
      "admin-src/ui.js",
      "scripts/build-admin.mjs",
      "scripts/lib/m07b3-plan.mjs",
      "scripts/prepare-catalog-migration.mjs",
      "scripts/validate-catalog-migration.mjs",
      "scripts/generate-admin-config.mjs",
      "scripts/generate-pages-runtime-config.mjs",
      "scripts/build-pages-artifact.mjs",
      "scripts/validate-pages-artifact.mjs",
      "scripts/check-m08.mjs",
      "scripts/check-m08-ci.mjs",
      "scripts/security-scan-m08.mjs",
      "scripts/serve-static.mjs",
      "scripts/validate-seller-manager.mjs"
    ].map(syntaxCheck),
    testSuiteCheck("Baseline contract tests", "tests/baseline"),
    testSuiteCheck("Find domain and compatibility adapter tests", "tests/domain"),
    testSuiteCheck("Between Us brand and public shell tests", "tests/brand"),
    testSuiteCheck("Collections and discovery tests", "tests/discovery"),
    testSuiteCheck("Find Details, gallery, media, and reservation tests", "tests/detail"),
    testSuiteCheck("Permalink, sharing, Copy Link, and QR tests", "tests/permalinks"),
    testSuiteCheck("Content intake tests", "tests/content-intake"),
    scriptCheck("Content intake default validation", "scripts/validate-content-intake.mjs"),
    scriptCheck("Content intake default summary", "scripts/summarize-content-intake.mjs"),
    scriptCheck("Supabase foundation static validation", "scripts/validate-supabase-foundation.mjs"),
    testSuiteCheck("Supabase foundation tests", "tests/supabase-foundation"),
    testSuiteCheck("Seller Catalog Manager tests", "tests/seller-manager"),
    testSuiteCheck("M08 controlled dynamic publishing tests", "tests/m08"),
    {
      ...scriptCheck(LOCAL_MIGRATION_CHECK_LABELS[0], "scripts/validate-catalog-migration.mjs"),
      requiresLocalMigrationSources: true
    },
    {
      ...testSuiteCheck(LOCAL_MIGRATION_CHECK_LABELS[1], "tests/catalog-migration"),
      requiresLocalMigrationSources: true
    }
  ].map((check) => Object.freeze(check)));
}
