#!/usr/bin/env node

// M07B-4 clean-checkout deployment validation (npm run pages:check:ci).
//
// This is the deployment counterpart to scripts/check-pages.mjs for the
// GitHub Pages workflow: it validates every tracked repository contract that
// a clean GitHub checkout with full Git history can satisfy, then builds and
// validates the strict allowlisted Pages artifact from the caller-provided
// environment. It performs no remote migration and no database or Storage
// writes.
//
// Exactly two local-only maintenance checks are excluded, explicitly and by
// name (never by probing for missing files):
//   - "Controlled catalog migration validation"
//   - "Controlled catalog migration tests"
// Both read the intentionally untracked M07B-3 source photos under
// content-intake/photos/ and remain mandatory locally via
// npm run migration:validate, npm run migration:test, npm run validate:baseline,
// and npm run pages:check.

import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { buildPagesArtifact } from "./build-pages-artifact.mjs";
import { validatePagesArtifact } from "./validate-pages-artifact.mjs";
import { repositoryRoot } from "./lib/baseline-contracts.mjs";
import {
  LOCAL_MIGRATION_CHECK_LABELS,
  LOCAL_MIGRATION_EXCLUSION_REASON,
  buildRepositoryChecks,
  findTestFiles
} from "./lib/repository-checks.mjs";

export function partitionRepositoryChecks(checks = buildRepositoryChecks()) {
  return Object.freeze({
    included: Object.freeze(checks.filter((check) => !check.requiresLocalMigrationSources)),
    excluded: Object.freeze(checks.filter((check) => check.requiresLocalMigrationSources))
  });
}

export function buildCiDeploymentChecks() {
  const { included } = partitionRepositoryChecks();

  return Object.freeze([
    ...included,
    Object.freeze({
      label: "Seller Catalog Manager validation",
      displayCommand: "node scripts/validate-seller-manager.mjs",
      arguments: ["scripts/validate-seller-manager.mjs"]
    }),
    Object.freeze({
      label: "Pages deployment contract tests",
      displayCommand: "node --test tests/deployment/*.test.mjs",
      arguments: ["--test", ...findTestFiles("tests/deployment")]
    })
  ]);
}

export function runCheck(check, { silent = false } = {}) {
  const result = spawnSync(process.execPath, check.arguments, {
    cwd: repositoryRoot,
    stdio: silent ? "ignore" : "inherit"
  });

  return Object.freeze({ ok: !result.error && result.status === 0, status: result.status });
}

async function main() {
  const { excluded } = partitionRepositoryChecks();

  console.log("M07B-4 clean-checkout deployment validation\n");
  console.log("Excluded local-only maintenance checks (explicit, by name):");
  for (const check of excluded) {
    if (!LOCAL_MIGRATION_CHECK_LABELS.includes(check.label)) {
      console.error(`Unexpected excluded check: ${check.label}`);
      process.exitCode = 1;
      return;
    }
    console.log(`- ${check.label} (${check.displayCommand}): ${LOCAL_MIGRATION_EXCLUSION_REASON}`);
  }
  console.log("These checks remain mandatory locally: npm run migration:validate, npm run migration:test, npm run validate:baseline, npm run pages:check.\n");

  const failures = [];

  for (const check of buildCiDeploymentChecks()) {
    console.log(`[RUN] ${check.displayCommand}`);
    if (runCheck(check).ok) {
      console.log(`[PASS] ${check.label}\n`);
    } else {
      failures.push(check.label);
      console.error(`[FAIL] ${check.label}\n`);
    }
  }

  if (failures.length === 0) {
    console.log("[RUN] strict Pages artifact build and validation");
    try {
      await buildPagesArtifact({ environment: process.env });
      validatePagesArtifact();
      console.log("[PASS] Strict Pages artifact build and validation\n");
    } catch (error) {
      failures.push("Strict Pages artifact build and validation");
      console.error(`[FAIL] Strict Pages artifact build and validation\n- ${error.message}\n`);
    }
  }

  if (failures.length > 0) {
    console.error("Failures");
    for (const failure of failures) {
      console.error(`- ${failure}`);
    }
    console.error(`\nM07B-4 clean-checkout deployment validation: FAIL (${failures.length} required check(s) failed)`);
    process.exitCode = 1;
    return;
  }

  console.log("M07B-4 clean-checkout deployment validation: PASS");
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await main();
}
