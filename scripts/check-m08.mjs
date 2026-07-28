#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const localEnvironment = { ...process.env, DO_NOT_TRACK: "1" };
for (const name of [
  "DATABASE_URL",
  "PGPASSWORD",
  "SUPABASE_ACCESS_TOKEN",
  "SUPABASE_DB_PASSWORD",
  "SUPABASE_SECRET_KEY",
  "SUPABASE_SERVICE_ROLE_KEY"
]) {
  delete localEnvironment[name];
}

function run(command, arguments_, label, { silent = false } = {}) {
  console.log(`[RUN] ${label}`);
  const result = spawnSync(command, arguments_, {
    cwd: repositoryRoot,
    env: localEnvironment,
    stdio: silent ? "ignore" : "inherit"
  });
  if (result.error || result.status !== 0) {
    console.error(`[FAIL] ${label}`);
    process.exit(result.status || 1);
  }
  console.log(`[PASS] ${label}\n`);
}

run("docker", ["info"], "Docker engine availability", { silent: true });

const status = spawnSync("npx", [
  "supabase", "status", "--workdir", repositoryRoot, "--agent", "no"
], {
  cwd: repositoryRoot,
  env: localEnvironment,
  stdio: "ignore"
});
if (status.error || status.status !== 0) {
  run(
    "npx",
    [
      "supabase", "start", "--workdir", repositoryRoot, "--agent", "no", "--yes",
      "--exclude",
      "edge-runtime,gotrue,imgproxy,kong,logflare,mailpit,postgres-meta,postgrest,realtime,storage-api,studio,supavisor,vector"
    ],
    "Local Supabase start",
    { silent: true }
  );
}

for (const [command, arguments_, label] of [
  ["npm", ["run", "validate:baseline"], "Inherited repository validation"],
  ["npm", ["run", "admin:validate"], "Seller Manager validation"],
  ["npm", ["run", "migration:validate"], "Controlled migration validation"],
  ["npm", ["run", "migration:test"], "Controlled migration tests"],
  ["node", ["--test", "tests/m08/public-catalog.test.mjs", "tests/m08/public-ui.test.mjs"],
    "M08 public adapter and UI tests"],
  ["npx", ["supabase", "db", "reset", "--workdir", repositoryRoot, "--local"],
    "Local Supabase seeded reset"],
  ["npx", ["supabase", "test", "db", "--workdir", repositoryRoot],
    "Local Supabase RLS and Storage pgTAP"],
  ["npx", ["supabase", "db", "lint", "--local", "--workdir", repositoryRoot],
    "Local Supabase schema lint"],
  ["npm", ["run", "pages:check"], "Pages artifact validation"],
  ["node", ["scripts/security-scan-m08.mjs"], "M08 security scan"],
  ["git", ["diff", "--check"], "git diff --check"]
]) {
  run(command, arguments_, label);
}

console.log("M08 complete local validation: PASS");
