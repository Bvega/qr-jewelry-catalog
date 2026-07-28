#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const acceptedBase = "775ac4a3bac0fd096dd8db47f90712fee033a1f9";
const commands = Object.freeze([
  ["node", ["scripts/check-pages-ci.mjs"]],
  ["node", ["scripts/security-scan-m08.mjs"]],
  ["git", ["diff", "--check", acceptedBase, "HEAD", "--"]],
  ["git", ["diff", "--check"]]
]);

for (const [command, arguments_] of commands) {
  const result = spawnSync(command, arguments_, {
    cwd: repositoryRoot,
    env: process.env,
    stdio: "inherit"
  });
  if (result.error || result.status !== 0) process.exit(result.status || 1);
}

console.log("M08 clean-checkout validation: PASS");
