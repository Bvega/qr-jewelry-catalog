#!/usr/bin/env node

import { relative } from "node:path";
import { spawnSync } from "node:child_process";
import {
  APPROVED_QR_LIBRARY,
  getImageAssetState,
  repositoryRoot
} from "./lib/baseline-contracts.mjs";
import {
  buildRepositoryChecks,
  findTestFiles,
  repositoryTestDirectories
} from "./lib/repository-checks.mjs";

// The complete local maintenance validation: every repository check runs here,
// including the controlled catalog migration checks that need the local-only
// M07B-3 source photos. The clean-checkout deployment subset lives in
// scripts/check-pages-ci.mjs.
const checks = buildRepositoryChecks();

const failures = [];

console.log("M07B-3 repository validation\n");

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
  console.error(`\nM07B-3 repository validation: FAIL (${failures.length} required check(s) failed)`);
  process.exitCode = 1;
} else {
  const relativeTests = repositoryTestDirectories
    .flatMap((directory) => findTestFiles(directory))
    .map((file) => relative(repositoryRoot, file));
  console.log(`\nValidated ${relativeTests.length} baseline, domain, brand, discovery, detail, permalink, content-intake, Supabase foundation, Seller Manager, and catalog migration test files.`);
  console.log("M07B-3 repository validation: PASS");
}
