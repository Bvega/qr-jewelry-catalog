#!/usr/bin/env node

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const acceptedBase = "915b7fef50ac40ac255b2c8d522d58e0a69ae704";
const failures = [];

const requiredPaths = [
  "admin/index.html",
  "admin/activate.html",
  "admin/migrate-intake.html",
  "admin/config.example.js",
  "admin/assets/activate.js",
  "admin/assets/app.js",
  "admin/assets/migrate-intake.js",
  "admin/assets/styles.css",
  "admin-src/activation.js",
  "admin-src/app.js",
  "admin-src/auth.js",
  "admin-src/migration.js",
  "admin-src/migration-auth.js",
  "admin-src/migration-executor.js",
  "admin-src/migration-plan.js",
  "admin-src/migration-ui.js",
  "admin-src/catalog.js",
  "admin-src/photos.js",
  "admin-src/password.js",
  "admin-src/validation.js",
  "admin-src/ui.js",
  "scripts/build-admin.mjs",
  "scripts/generate-admin-config.mjs",
  "scripts/serve-static.mjs",
  "docs/SELLER_CATALOG_MANAGER.md",
  "docs/SELLER_ACCOUNT_ACTIVATION.md",
  "docs/SELLER_MANAGER_LOCAL_SETUP.md",
  "docs/REPORTS/M07B2_REPORT.md",
  "docs/REPORTS/M07B2R1_REPORT.md",
  "tests/seller-manager/activation.test.mjs",
  "tests/seller-manager/auth.test.mjs",
  "tests/seller-manager/password.test.mjs",
  "tests/seller-manager/shell.test.mjs"
];

for (const path of requiredPaths) {
  if (!existsSync(resolve(repositoryRoot, path))) failures.push(`Missing required path: ${path}`);
}

const testDirectory = resolve(repositoryRoot, "tests/seller-manager");
const testFiles = existsSync(testDirectory)
  ? readdirSync(testDirectory).filter((file) => file.endsWith(".test.mjs")).sort()
  : [];
if (testFiles.length < 8) failures.push("At least eight Seller Manager Node test files are required.");

const ignored = spawnSync("git", ["check-ignore", "-q", "admin/config.js"], {
  cwd: repositoryRoot,
  encoding: "utf8"
});
if (ignored.status !== 0) failures.push("admin/config.js must be ignored by Git.");
const configTracked = spawnSync("git", ["ls-files", "--error-unmatch", "admin/config.js"], {
  cwd: repositoryRoot,
  encoding: "utf8"
});
if (configTracked.status === 0) failures.push("admin/config.js must remain uncommitted.");

const protectedPaths = [
  "styles.css", "data/items.js", "data/collections.js", "data/discovery.js", "data/media.js",
  "data/reservation.js", "data/permalinks.js", "assets/images",
  "content-intake/finds.csv", "content-intake/photo-manifest.csv", "content-intake/photos",
  "tests/fixtures/legacy-items.snapshot.json"
];
const protectedDiff = spawnSync("git", ["diff", "--name-only", acceptedBase, "--", ...protectedPaths], {
  cwd: repositoryRoot,
  encoding: "utf8"
});
const protectedStatus = spawnSync("git", ["status", "--porcelain=v1", "--", ...protectedPaths], {
  cwd: repositoryRoot,
  encoding: "utf8"
});
if (protectedDiff.status !== 0 || protectedDiff.stdout.trim()) failures.push("Protected static catalog, branding, or intake files changed.");
if (protectedStatus.status !== 0 || protectedStatus.stdout.trim()) failures.push("Protected static catalog, branding, or intake files have working-tree changes.");

const scanPaths = requiredPaths.filter((path) => existsSync(resolve(repositoryRoot, path)));
const scanned = scanPaths.map((path) => readFileSync(resolve(repositoryRoot, path), "utf8")).join("\n");
for (const [label, pattern] of [
  ["Supabase secret key", /sb_secret_[A-Za-z0-9_-]{8,}/],
  ["Supabase access token", /sbp_[A-Za-z0-9]{16,}/],
  ["JWT credential", /eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/],
  ["nonempty prohibited secret", /SUPABASE_(?:ACCESS_TOKEN|DB_PASSWORD|SECRET_KEY|SERVICE_ROLE_KEY)\s*=\s*[^\s<]+/]
]) {
  if (pattern.test(scanned)) failures.push(`Prohibited committed value detected: ${label}`);
}

if (failures.length === 0) {
  const result = spawnSync(process.execPath, ["--test", ...testFiles.map((file) => resolve(testDirectory, file))], {
    cwd: repositoryRoot,
    encoding: "utf8"
  });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.error || result.status !== 0) failures.push("Seller Manager Node tests failed.");
}

if (failures.length) {
  console.error("Seller Manager validation: FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log(`Seller Manager validation: PASS (${testFiles.length} test files)`);
}
