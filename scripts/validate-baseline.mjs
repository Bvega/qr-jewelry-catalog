#!/usr/bin/env node

import { readdirSync } from "node:fs";
import { relative, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import {
  APPROVED_QR_LIBRARY,
  getImageAssetState,
  repositoryRoot
} from "./lib/baseline-contracts.mjs";

function findTestFiles(relativeDirectory) {
  const testDirectory = resolve(repositoryRoot, relativeDirectory);

  return readdirSync(testDirectory)
    .filter((file) => file.endsWith(".test.mjs"))
    .sort()
    .map((file) => resolve(testDirectory, file));
}

const baselineTestFiles = findTestFiles("tests/baseline");
const domainTestFiles = findTestFiles("tests/domain");
const brandTestFiles = findTestFiles("tests/brand");
const discoveryTestFiles = findTestFiles("tests/discovery");
const detailTestFiles = findTestFiles("tests/detail");

const checks = [
  {
    label: "JavaScript syntax: app.js",
    displayCommand: "node --check app.js",
    arguments: ["--check", "app.js"]
  },
  {
    label: "JavaScript syntax: item.js",
    displayCommand: "node --check item.js",
    arguments: ["--check", "item.js"]
  },
  {
    label: "JavaScript syntax: data/items.js",
    displayCommand: "node --check data/items.js",
    arguments: ["--check", "data/items.js"]
  },
  {
    label: "JavaScript syntax: data/collections.js",
    displayCommand: "node --check data/collections.js",
    arguments: ["--check", "data/collections.js"]
  },
  {
    label: "JavaScript syntax: data/discovery.js",
    displayCommand: "node --check data/discovery.js",
    arguments: ["--check", "data/discovery.js"]
  },
  {
    label: "JavaScript syntax: data/media.js",
    displayCommand: "node --check data/media.js",
    arguments: ["--check", "data/media.js"]
  },
  {
    label: "JavaScript syntax: data/reservation.js",
    displayCommand: "node --check data/reservation.js",
    arguments: ["--check", "data/reservation.js"]
  },
  {
    label: "Baseline contract tests",
    displayCommand: "node --test tests/baseline/*.test.mjs",
    arguments: ["--test", ...baselineTestFiles]
  },
  {
    label: "Find domain and compatibility adapter tests",
    displayCommand: "node --test tests/domain/*.test.mjs",
    arguments: ["--test", ...domainTestFiles]
  },
  {
    label: "Between Us brand and public shell tests",
    displayCommand: "node --test tests/brand/*.test.mjs",
    arguments: ["--test", ...brandTestFiles]
  },
  {
    label: "Collections and discovery tests",
    displayCommand: "node --test tests/discovery/*.test.mjs",
    arguments: ["--test", ...discoveryTestFiles]
  },
  {
    label: "Find Details, gallery, media, and reservation tests",
    displayCommand: "node --test tests/detail/*.test.mjs",
    arguments: ["--test", ...detailTestFiles]
  }
];

const failures = [];

console.log("M05 repository validation\n");

for (const check of checks) {
  console.log(`[RUN] ${check.displayCommand}`);
  const result = spawnSync(process.execPath, check.arguments, {
    cwd: repositoryRoot,
    encoding: "utf8"
  });

  if (result.stdout) {
    process.stdout.write(result.stdout);
  }
  if (result.stderr) {
    process.stderr.write(result.stderr);
  }

  if (result.error || result.status !== 0) {
    failures.push(check.label);
    console.error(`[FAIL] ${check.label}\n`);
  } else {
    console.log(`[PASS] ${check.label}\n`);
  }
}

const warnings = [];

try {
  for (const asset of getImageAssetState()) {
    if (!asset.exists) {
      warnings.push(`Item ${asset.id} (${asset.name}) references missing image ${asset.path}`);
    }
  }
} catch (error) {
  warnings.push(`Image warning scan could not load catalog data: ${error.message}`);
}

warnings.push(`QR generation depends on the external library ${APPROVED_QR_LIBRARY}`);
warnings.push("The active GitHub Pages source branch/folder settings are external and unverified in this repository");

console.log("Warnings (non-failing baseline conditions)");
for (const warning of warnings) {
  console.log(`- ${warning}`);
}

if (failures.length > 0) {
  console.error("\nFailures");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  console.error(`\nM05 repository validation: FAIL (${failures.length} required check(s) failed)`);
  process.exitCode = 1;
} else {
  const relativeTests = [
    ...baselineTestFiles,
    ...domainTestFiles,
    ...brandTestFiles,
    ...discoveryTestFiles,
    ...detailTestFiles
  ]
    .map((file) => relative(repositoryRoot, file));
  console.log(`\nValidated ${relativeTests.length} baseline, domain, brand, discovery, and detail test files.`);
  console.log("M05 repository validation: PASS");
}
