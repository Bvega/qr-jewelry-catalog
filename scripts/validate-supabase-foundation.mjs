#!/usr/bin/env node

import {
  existsSync,
  readFileSync,
  readdirSync
} from "node:fs";
import { relative, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const foundationBase = "e7c065c28ac24c135946d10bdb40d3a2977d7fc8";
const failures = [];

const requiredPaths = [
  ".env.example",
  "package.json",
  "package-lock.json",
  "supabase/config.toml",
  "supabase/seed.sql",
  "supabase/migrations",
  "supabase/tests/database",
  "tests/supabase-foundation",
  "docs/SUPABASE_ARCHITECTURE.md",
  "docs/SUPABASE_CONFIGURATION.md",
  "docs/SUPABASE_LOCAL_DEVELOPMENT.md",
  "docs/SUPABASE_REMOTE_SETUP.md",
  "docs/REPORTS/M07B1_REPORT.md"
];

const protectedPaths = [
  "index.html",
  "find.html",
  "item.html",
  "app.js",
  "item.js",
  "styles.css",
  "data/items.js",
  "data/collections.js",
  "data/discovery.js",
  "data/media.js",
  "data/reservation.js",
  "data/permalinks.js",
  "assets/images",
  "assets/brand",
  "content-intake/finds.csv",
  "content-intake/photo-manifest.csv",
  "content-intake/photos",
  "tests/fixtures/legacy-items.snapshot.json",
  "docs/IDENTIFIER_REGISTRY.md",
  ".github/workflows/baseline-validation.yml"
];

function read(relativePath) {
  return readFileSync(resolve(repositoryRoot, relativePath), "utf8");
}

function requireCheck(condition, message) {
  if (!condition) failures.push(message);
}

for (const path of requiredPaths) {
  requireCheck(existsSync(resolve(repositoryRoot, path)), `Missing required path: ${path}`);
}

const migrationDirectory = resolve(repositoryRoot, "supabase/migrations");
const migrationFiles = existsSync(migrationDirectory)
  ? readdirSync(migrationDirectory).filter((file) => file.endsWith(".sql")).sort()
  : [];
const foundationMigrationFile = "20260720120000_m07b1_catalog_foundation.sql";
requireCheck(
  migrationFiles.includes(foundationMigrationFile)
    && migrationFiles[0] === foundationMigrationFile,
  "The ordered M07B-1 foundation migration must remain first and unchanged."
);

const migration = migrationFiles.includes(foundationMigrationFile)
  ? read(`supabase/migrations/${foundationMigrationFile}`)
  : "";
const config = existsSync(resolve(repositoryRoot, "supabase/config.toml"))
  ? read("supabase/config.toml")
  : "";
const seed = existsSync(resolve(repositoryRoot, "supabase/seed.sql"))
  ? read("supabase/seed.sql")
  : "";

for (const table of ["collections", "finds", "find_photos", "find_relations"]) {
  requireCheck(
    new RegExp(`create\\s+table\\s+public\\.${table}\\b`, "i").test(migration),
    `Migration must create public.${table}.`
  );
  requireCheck(
    new RegExp(`alter\\s+table\\s+public\\.${table}\\s+enable\\s+row\\s+level\\s+security`, "i").test(migration),
    `RLS must be enabled on public.${table}.`
  );
}

for (const constraint of [
  "finds_public_id_check",
  "finds_title_check",
  "finds_price_amount_check",
  "finds_price_currency_check",
  "finds_availability_check",
  "finds_description_check",
  "finds_legacy_id_check",
  "find_photos_role_check",
  "find_photos_sequence_check",
  "find_photos_alt_text_check",
  "find_relations_no_self_check"
]) {
  requireCheck(migration.includes(`constraint ${constraint}`), `Missing required constraint: ${constraint}`);
}

requireCheck(/create\s+schema\s+if\s+not\s+exists\s+private/i.test(migration), "Private schema is required.");
requireCheck(/create\s+table\s+private\.catalog_admins/i.test(migration), "Explicit admin allowlist is required.");
requireCheck(/create\s+or\s+replace\s+function\s+private\.is_catalog_admin\(\)/i.test(migration), "Admin helper is required.");
requireCheck(/security\s+definer[\s\S]*?set\s+search_path\s*=\s*''/i.test(migration), "Security-definer helpers need a safe explicit search path.");
requireCheck(!/raw_user_meta_data/i.test(migration), "Policies must not trust raw_user_meta_data.");
requireCheck(/create\s+policy\s+finds_public_read[\s\S]*?is_published\s*=\s*true[\s\S]*?archived_at\s+is\s+null/i.test(migration), "Public Find reads must be published-only and non-archived.");
requireCheck(/create\s+policy\s+finds_admin_insert[\s\S]*?private\.is_catalog_admin/i.test(migration), "Find writes must use the admin allowlist.");
requireCheck(/create\s+sequence\s+public\.find_public_id_seq/i.test(migration), "Public-ID sequence is required.");
requireCheck(/private\.next_find_public_id\(\)/i.test(migration), "Controlled public-ID generator is required.");
requireCheck(/alter\s+column\s+public_id\s+set\s+default\s+private\.next_find_public_id\(\)/i.test(migration), "Find public IDs must generate automatically.");
requireCheck(/BU-'\s*\|\|\s*lpad/i.test(migration), "Public-ID generator must format BU-NNNN values.");
requireCheck(/create\s+trigger\s+finds_maintain_audit/i.test(migration), "Find audit trigger is required.");

requireCheck(/\[storage\.buckets\.find-images\]/.test(config), "find-images must be configured locally.");
requireCheck(/file_size_limit\s*=\s*"10MiB"/.test(config), "find-images must have a 10 MiB limit.");
for (const mime of ["image/jpeg", "image/png", "image/webp"]) {
  requireCheck(config.includes(mime), `find-images must allow ${mime}.`);
}
requireCheck(/insert\s+into\s+storage\.buckets/i.test(migration), "Migration must reconcile hosted bucket metadata.");
for (const operation of ["list", "insert", "update", "delete"]) {
  requireCheck(
    new RegExp(`create\\s+policy\\s+find_images_admin_${operation}`, "i").test(migration),
    `Missing admin Storage ${operation} policy.`
  );
}
requireCheck(/\^finds\//.test(migration), "Storage writes must enforce the Finds path convention.");

requireCheck(
  !/insert\s+into\s+(?:auth\.users|private\.catalog_admins|public\.finds|public\.find_photos|public\.find_relations)/i.test(seed),
  "Local seed must not create users, admins, Finds, photos, or relations."
);
requireCheck(
  (seed.match(/\('(?:jewelry|vintage|home-decor|kitchen|collectibles|new-items)'/g) || []).length === 6,
  "Local seed must contain exactly the approved six Collection IDs."
);
requireCheck(!/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i.test(seed), "Seed must not contain a user or product UUID.");

const packageJson = existsSync(resolve(repositoryRoot, "package.json"))
  ? JSON.parse(read("package.json"))
  : {};
for (const script of [
  "validate",
  "validate:baseline",
  "validate:intake",
  "validate:supabase",
  "supabase:start",
  "supabase:stop",
  "supabase:reset",
  "supabase:test",
  "supabase:lint"
]) {
  requireCheck(Boolean(packageJson.scripts?.[script]), `Missing npm script: ${script}`);
}
requireCheck(packageJson.private === true, "package.json must be private.");
requireCheck(
  Object.keys(packageJson.devDependencies || {}).length === 2
    && /^\d+\.\d+\.\d+$/.test(packageJson.devDependencies?.esbuild || "")
    && /^\d+\.\d+\.\d+$/.test(packageJson.devDependencies?.supabase || ""),
  "Supabase CLI and esbuild must be the only pinned stable development dependencies."
);
requireCheck(
  Object.keys(packageJson.dependencies || {}).length === 1
    && /^\d+\.\d+\.\d+$/.test(packageJson.dependencies?.["@supabase/supabase-js"] || ""),
  "The pinned Supabase browser SDK must be the only runtime dependency."
);

const environmentExample = existsSync(resolve(repositoryRoot, ".env.example"))
  ? read(".env.example")
  : "";
for (const name of ["SUPABASE_URL", "SUPABASE_PUBLISHABLE_KEY", "SUPABASE_PROJECT_REF"]) {
  requireCheck(new RegExp(`^${name}=$`, "m").test(environmentExample), `${name} must be an empty example placeholder.`);
}
requireCheck(
  !/^SUPABASE_(?:ACCESS_TOKEN|DB_PASSWORD|SECRET_KEY|SERVICE_ROLE_KEY)=/m.test(environmentExample),
  "Secret variables must not be present in the browser-safe example."
);

const scanPaths = [
  ".env.example",
  "package.json",
  "supabase/config.toml",
  "supabase/seed.sql",
  ...migrationFiles.map((file) => `supabase/migrations/${file}`),
  "docs/SUPABASE_ARCHITECTURE.md",
  "docs/SUPABASE_CONFIGURATION.md",
  "docs/SUPABASE_LOCAL_DEVELOPMENT.md",
  "docs/SUPABASE_REMOTE_SETUP.md",
  "docs/REPORTS/M07B1_REPORT.md"
].filter((path) => existsSync(resolve(repositoryRoot, path)));
const scannedSource = scanPaths.map((path) => `${path}\n${read(path)}`).join("\n");
for (const [label, pattern] of [
  ["Supabase secret key", /sb_secret_[A-Za-z0-9_-]{8,}/],
  ["Supabase access token", /sbp_[A-Za-z0-9]{16,}/],
  ["JWT credential", /eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/],
  ["nonempty local/CI secret", /SUPABASE_(?:ACCESS_TOKEN|DB_PASSWORD|SECRET_KEY|SERVICE_ROLE_KEY)\s*=\s*[^\s<]+/]
]) {
  requireCheck(!pattern.test(scannedSource), `Prohibited credential detected: ${label}`);
}

const databaseTestDirectory = resolve(repositoryRoot, "supabase/tests/database");
const databaseTests = existsSync(databaseTestDirectory)
  ? readdirSync(databaseTestDirectory).filter((file) => file.endsWith(".sql")).sort()
  : [];
requireCheck(databaseTests.length >= 2, "pgTAP foundation and rollback tests are required.");
const databaseTestSource = databaseTests
  .map((file) => read(`supabase/tests/database/${file}`))
  .join("\n");
for (const phrase of [
  "an unpublished Find is invisible to anon",
  "a published non-archived Find is visible to anon",
  "an archived Find is invisible to anon",
  "an authenticated non-admin cannot create a Find",
  "a catalog admin can create Finds",
  "photo visibility follows parent publication state",
  "a self-relation fails",
  "a non-admin cannot write a Storage object",
  "a catalog admin can write a valid Storage object path",
  "fictional Auth fixtures rolled back"
]) {
  requireCheck(databaseTestSource.includes(phrase), `Missing pgTAP behavior: ${phrase}`);
}

const protectedDiff = spawnSync("git", ["diff", "--name-only", foundationBase, "--", ...protectedPaths], {
  cwd: repositoryRoot,
  encoding: "utf8"
});
const protectedStatus = spawnSync("git", ["status", "--porcelain=v1", "--", ...protectedPaths], {
  cwd: repositoryRoot,
  encoding: "utf8"
});
requireCheck(protectedDiff.status === 0, "Unable to compare protected files with the accepted base.");
requireCheck(protectedStatus.status === 0, "Unable to inspect protected working-tree files.");
requireCheck(!protectedDiff.stdout.trim(), `Protected files changed: ${protectedDiff.stdout.trim()}`);
requireCheck(!protectedStatus.stdout.trim(), `Protected working-tree changes detected: ${protectedStatus.stdout.trim()}`);

if (failures.length > 0) {
  console.error("Supabase foundation validation: FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log("Supabase foundation validation: PASS");
}
