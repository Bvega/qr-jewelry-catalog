#!/usr/bin/env node

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const acceptedBase = "7cf635d69f926141e9b3f3e3ffaf378898329473";
const failures = [];

const requiredPaths = [
  "admin/index.html",
  "admin/config.example.js",
  "admin/assets/app.js",
  "admin/assets/styles.css",
  "admin-src/app.js",
  "admin-src/auth.js",
  "admin-src/catalog.js",
  "admin-src/photos.js",
  "admin-src/validation.js",
  "admin-src/ui.js",
  "scripts/build-admin.mjs",
  "scripts/generate-admin-config.mjs",
  "scripts/serve-static.mjs",
  "docs/SELLER_CATALOG_MANAGER.md",
  "docs/SELLER_MANAGER_LOCAL_SETUP.md",
  "docs/REPORTS/M07B2_REPORT.md"
];

for (const path of requiredPaths) {
  if (!existsSync(resolve(repositoryRoot, path))) failures.push(`Missing required path: ${path}`);
}

const testDirectory = resolve(repositoryRoot, "tests/seller-manager");
const testFiles = existsSync(testDirectory)
  ? readdirSync(testDirectory).filter((file) => file.endsWith(".test.mjs")).sort()
  : [];
if (testFiles.length < 6) failures.push("At least six Seller Manager Node test files are required.");

const ignored = spawnSync("git", ["check-ignore", "-q", "admin/config.js"], {
  cwd: repositoryRoot,
  encoding: "utf8"
});
if (ignored.status !== 0) failures.push("admin/config.js must be ignored by Git.");

const protectedPaths = [
  "index.html", "find.html", "item.html", "app.js", "item.js", "styles.css",
  "data/items.js", "data/collections.js", "data/discovery.js", "data/media.js",
  "data/reservation.js", "data/permalinks.js", "assets/images",
  "content-intake/finds.csv", "content-intake/photo-manifest.csv", "content-intake/photos",
  "tests/fixtures/legacy-items.snapshot.json", "docs/IDENTIFIER_REGISTRY.md"
];
const protectedDiff = spawnSync("git", ["diff", "--name-only", acceptedBase, "--", ...protectedPaths], {
  cwd: repositoryRoot,
  encoding: "utf8"
});
const protectedStatus = spawnSync("git", ["status", "--porcelain=v1", "--", ...protectedPaths], {
  cwd: repositoryRoot,
  encoding: "utf8"
});
if (protectedDiff.status !== 0 || protectedDiff.stdout.trim()) failures.push("Protected public catalog or intake files changed.");
if (protectedStatus.status !== 0 || protectedStatus.stdout.trim()) failures.push("Protected public catalog or intake files have working-tree changes.");

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
