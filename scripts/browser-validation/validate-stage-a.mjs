#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";
import {
  ANONYMOUS_CHECKS,
  CLEANUP_CHECKS,
  MANAGER_CHECKS
} from "./workflows.mjs";
import {
  PRODUCTION_CATALOG_BASE,
  PRODUCTION_MANAGER_URL
} from "./policy.mjs";

const repositoryRoot = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const requiredFiles = Object.freeze([
  "docs/M09_BROWSER_ASSISTED_VALIDATION_RUNBOOK.md",
  "docs/REPORTS/M09_STAGE_A_EXECUTION.md",
  "scripts/browser-validation/policy.mjs",
  "scripts/browser-validation/sanitizer.mjs",
  "scripts/browser-validation/validate-evidence.mjs",
  "scripts/browser-validation/workflows.mjs",
  "scripts/browser-validation/validate-stage-a.mjs",
  "scripts/check-m09.mjs",
  "scripts/security-scan-m09.mjs",
  "tests/browser-validation/policy.test.mjs",
  "tests/browser-validation/sanitizer.test.mjs",
  "tests/browser-validation/evidence.test.mjs",
  "tests/browser-validation/workflows.test.mjs"
]);

function fail(message) {
  console.error(`M09 Stage A contract validation: FAIL\n- ${message}`);
  process.exitCode = 1;
}

function git(args) {
  const result = spawnSync("git", args, {
    cwd: repositoryRoot,
    encoding: "utf8"
  });
  if (result.error || result.status !== 0) {
    throw new Error(`Git contract check failed: git ${args.join(" ")}`);
  }
  return result.stdout.trim();
}

export function validateStageA() {
  const missing = requiredFiles.filter((path) => !existsSync(resolve(repositoryRoot, path)));
  if (missing.length > 0) throw new Error(`Missing required files: ${missing.join(", ")}`);

  const packageJSON = JSON.parse(readFileSync(resolve(repositoryRoot, "package.json"), "utf8"));
  if (packageJSON.scripts?.["m09:check"] !== "node scripts/check-m09.mjs") {
    throw new Error("package.json does not expose the exact m09:check entry point.");
  }

  const manifest = readFileSync(
    resolve(repositoryRoot, "deployment/pages-manifest.json"),
    "utf8"
  );
  if (/m09|browser-validation|evidence/i.test(manifest)) {
    throw new Error("M09 validation assets entered the Pages deployment manifest.");
  }

  const runbook = readFileSync(
    resolve(repositoryRoot, "docs/M09_BROWSER_ASSISTED_VALIDATION_RUNBOOK.md"),
    "utf8"
  );
  const requiredRunbookTerms = [
    PRODUCTION_CATALOG_BASE,
    PRODUCTION_MANAGER_URL,
    "OBSERVE",
    "HUMAN_CHECKPOINT",
    "PROHIBITED_WRITE",
    "reply only READY",
    "no authenticated screenshots",
    ...ANONYMOUS_CHECKS,
    ...MANAGER_CHECKS,
    ...CLEANUP_CHECKS
  ];
  const absentTerms = requiredRunbookTerms.filter((term) => !runbook.includes(term));
  if (absentTerms.length > 0) {
    throw new Error(`Runbook omits required controls: ${absentTerms.join(", ")}`);
  }

  for (const path of requiredFiles) {
    const source = readFileSync(resolve(repositoryRoot, path), "utf8");
    if (/\r/.test(source) || /[ \t]+$/m.test(source)) {
      throw new Error(`${path} contains non-canonical whitespace.`);
    }
  }

  const manifestDiff = git([
    "diff",
    "--name-only",
    "039ebb3ba21ba22d25b49762a23041049503cfeb",
    "--",
    "deployment/pages-manifest.json"
  ]);
  if (manifestDiff) throw new Error("The Pages deployment manifest changed after planning.");
  return true;
}

async function main() {
  try {
    validateStageA();
    console.log(`M09 Stage A contract validation: PASS (${requiredFiles.length} required files)`);
  } catch (error) {
    fail(error.message);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await main();
}
