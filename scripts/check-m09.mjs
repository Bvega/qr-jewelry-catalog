#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const acceptedBase = "039ebb3ba21ba22d25b49762a23041049503cfeb";
const fictionalEnvironment = Object.freeze({
  SUPABASE_URL: "https://m09validationtest123.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: "sb_publishable_m09_fictional_browser_key_123456",
  SUPABASE_PROJECT_REF: "m09validationtest123"
});

const commands = Object.freeze([
  ["node", ["scripts/check-m08-ci.mjs"], fictionalEnvironment],
  ["node", [
    "--test",
    "tests/browser-validation/policy.test.mjs",
    "tests/browser-validation/sanitizer.test.mjs",
    "tests/browser-validation/evidence.test.mjs",
    "tests/browser-validation/workflows.test.mjs"
  ]],
  ["node", ["scripts/browser-validation/validate-stage-a.mjs"]],
  ["node", ["scripts/browser-validation/validate-evidence.mjs"]],
  ["node", ["scripts/security-scan-m09.mjs"]],
  ["git", ["diff", "--check", acceptedBase, "HEAD", "--"]],
  ["git", ["diff", "--check"]]
]);

for (const [command, arguments_, environment = {}] of commands) {
  const result = spawnSync(command, arguments_, {
    cwd: repositoryRoot,
    env: { ...process.env, ...environment },
    stdio: "inherit"
  });
  if (result.error || result.status !== 0) process.exit(result.status || 1);
}

console.log("M09 browser-assisted validation foundation: PASS");
