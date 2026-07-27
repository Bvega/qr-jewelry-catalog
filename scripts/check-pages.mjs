#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { resolve } from "node:path";
import { buildPagesArtifact } from "./build-pages-artifact.mjs";
import { repositoryRoot } from "./generate-admin-config.mjs";
import { validatePagesArtifact } from "./validate-pages-artifact.mjs";

const fictionalEnvironment = Object.freeze({
  SUPABASE_URL: "https://m07b4testref123456.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: "sb_publishable_m07b4_fictional_browser_key_123456",
  SUPABASE_PROJECT_REF: "m07b4testref123456"
});

const migrationTests = readdirSync(resolve(repositoryRoot, "tests/catalog-migration"))
  .filter((path) => path.endsWith(".test.mjs"))
  .sort()
  .map((path) => resolve(repositoryRoot, "tests/catalog-migration", path));

const commands = [
  ["scripts/validate-baseline.mjs"],
  ["scripts/validate-seller-manager.mjs"],
  ["scripts/validate-catalog-migration.mjs"],
  ["--test", ...migrationTests],
  ["--test", "tests/deployment/pages-artifact.test.mjs"]
];

for (const args of commands) {
  const result = spawnSync(process.execPath, args.map((path, index) => (
    index === 0 || path.startsWith("-") ? path : resolve(repositoryRoot, path)
  )), {
    cwd: repositoryRoot,
    encoding: "utf8",
    stdio: "inherit"
  });
  if (result.error || result.status !== 0) process.exit(result.status || 1);
}

await buildPagesArtifact({ environment: fictionalEnvironment });
validatePagesArtifact();
console.log("Complete local Pages deployment check: PASS");
