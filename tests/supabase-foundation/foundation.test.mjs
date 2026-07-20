import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

const repositoryRoot = resolve(import.meta.dirname, "../..");
const foundationBase = "e7c065c28ac24c135946d10bdb40d3a2977d7fc8";
const read = (path) => readFileSync(resolve(repositoryRoot, path), "utf8");
const migrations = readdirSync(resolve(repositoryRoot, "supabase/migrations"))
  .filter((file) => file.endsWith(".sql"))
  .sort();
const migration = migrations.length === 1 ? read(`supabase/migrations/${migrations[0]}`) : "";
const config = read("supabase/config.toml");
const seed = read("supabase/seed.sql");

test("project structure and repository-local CLI scripts are complete", () => {
  for (const path of [
    ".env.example",
    "package.json",
    "package-lock.json",
    "supabase/config.toml",
    "supabase/seed.sql",
    "supabase/migrations",
    "supabase/tests/database"
  ]) {
    assert.equal(existsSync(resolve(repositoryRoot, path)), true, path);
  }

  const packageJson = JSON.parse(read("package.json"));
  assert.equal(packageJson.private, true);
  assert.deepEqual(Object.keys(packageJson.devDependencies), ["supabase"]);
  assert.match(packageJson.devDependencies.supabase, /^\d+\.\d+\.\d+$/);
  assert.equal(packageJson.dependencies, undefined);
  for (const name of [
    "validate", "validate:baseline", "validate:intake", "validate:supabase",
    "supabase:start", "supabase:stop", "supabase:reset", "supabase:test", "supabase:lint"
  ]) {
    assert.equal(typeof packageJson.scripts[name], "string", name);
  }
});

test("exactly one ordered M07B-1 migration is the schema source of truth", () => {
  assert.deepEqual(migrations, ["20260720120000_m07b1_catalog_foundation.sql"]);
  assert.match(migration, /create schema if not exists private/i);
  assert.doesNotMatch(config, /schemas\s*=\s*\[[^\]]*"private"/);
});

test("migration creates the allowlist and four catalog tables", () => {
  assert.match(migration, /create table private\.catalog_admins/i);
  for (const table of ["collections", "finds", "find_photos", "find_relations"]) {
    assert.match(migration, new RegExp(`create\\s+table\\s+public\\.${table}\\b`, "i"));
  }
});

test("public-ID contract is automatic, formatted, collision-safe, and sequence-backed", () => {
  assert.match(migration, /create sequence public\.find_public_id_seq/i);
  assert.match(migration, /create or replace function private\.next_find_public_id\(\)/i);
  assert.match(migration, /loop[\s\S]*exit when not exists/i);
  assert.match(migration, /\^BU-\[0-9\]\{4,\}\$/);
  assert.match(migration, /alter column public_id set default private\.next_find_public_id\(\)/i);
  assert.match(read("docs/SUPABASE_ARCHITECTURE.md"), /setval\([\s\S]*find_public_id_seq/);
});

test("schema constraints cover IDs, content, prices, availability, photos, and relations", () => {
  for (const constraint of [
    "finds_public_id_check", "finds_legacy_id_check", "finds_title_check",
    "finds_price_amount_check", "finds_price_currency_check", "finds_availability_check",
    "finds_description_check", "find_photos_role_check", "find_photos_sequence_check",
    "find_photos_alt_text_check", "find_photos_width_check", "find_photos_height_check",
    "find_relations_no_self_check"
  ]) {
    assert.ok(migration.includes(`constraint ${constraint}`), constraint);
  }
  assert.match(migration, /create unique index find_photos_one_primary_per_find_idx/i);
});

test("RLS is enabled on every exposed catalog table", () => {
  for (const table of ["collections", "finds", "find_photos", "find_relations"]) {
    assert.match(
      migration,
      new RegExp(`alter\\s+table\\s+public\\.${table}\\s+enable\\s+row\\s+level\\s+security`, "i")
    );
  }
});

test("public reads are limited by publication and parent visibility", () => {
  assert.match(migration, /create policy finds_public_read[\s\S]*is_published = true and archived_at is null/i);
  assert.match(migration, /create policy find_photos_public_read[\s\S]*from public\.finds[\s\S]*is_published = true[\s\S]*archived_at is null/i);
  assert.match(migration, /create policy find_relations_public_read[\s\S]*source_find\.is_published = true[\s\S]*related_find\.is_published = true/i);
});

test("administration requires explicit allowlisting rather than login or metadata", () => {
  assert.match(migration, /create or replace function private\.is_catalog_admin\(\)/i);
  assert.match(migration, /security definer[\s\S]*set search_path = ''/i);
  assert.match(migration, /where user_id = \(select auth\.uid\(\)\)/i);
  assert.doesNotMatch(migration, /raw_user_meta_data/i);
  assert.match(migration, /revoke all on private\.catalog_admins from public, anon, authenticated/i);
  assert.match(migration, /create policy finds_admin_insert[\s\S]*private\.is_catalog_admin/i);
});

test("Storage bucket and object policies enforce the approved contract", () => {
  assert.match(config, /\[storage\.buckets\.find-images\][\s\S]*public = true[\s\S]*file_size_limit = "10MiB"/);
  for (const mime of ["image/jpeg", "image/png", "image/webp"]) assert.ok(config.includes(mime));
  assert.match(migration, /insert into storage\.buckets/i);
  for (const operation of ["list", "insert", "update", "delete"]) {
    assert.match(migration, new RegExp(`create policy find_images_admin_${operation}`, "i"));
  }
  assert.match(migration, /\^finds\//);
  assert.doesNotMatch(config, /image\/heic/i);
});

test("foundation sources contain no committed credential values or owner data", () => {
  const source = [
    read(".env.example"), config, seed, migration,
    read("docs/SUPABASE_CONFIGURATION.md"),
    read("docs/SUPABASE_REMOTE_SETUP.md")
  ].join("\n");
  assert.doesNotMatch(source, /sb_secret_[A-Za-z0-9_-]{8,}/);
  assert.doesNotMatch(source, /sbp_[A-Za-z0-9]{16,}/);
  assert.doesNotMatch(source, /eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/);
  assert.doesNotMatch(source, /SUPABASE_(?:ACCESS_TOKEN|DB_PASSWORD|SECRET_KEY|SERVICE_ROLE_KEY)\s*=\s*[^\s<]+/);
  assert.doesNotMatch(seed, /insert\s+into\s+(?:auth\.users|private\.catalog_admins|public\.finds)/i);
  assert.doesNotMatch(seed, /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i);
});

test("environment example exposes only empty browser-safe placeholders", () => {
  const lines = read(".env.example")
    .split(/\r?\n/)
    .filter((line) => line && !line.startsWith("#"));
  assert.deepEqual(lines, [
    "SUPABASE_URL=",
    "SUPABASE_PUBLISHABLE_KEY=",
    "SUPABASE_PROJECT_REF="
  ]);
});

test("documentation covers architecture, local workflow, configuration, and deferred remote setup", () => {
  const architecture = read("docs/SUPABASE_ARCHITECTURE.md");
  const local = read("docs/SUPABASE_LOCAL_DEVELOPMENT.md");
  const remote = read("docs/SUPABASE_REMOTE_SETUP.md");
  const configuration = read("docs/SUPABASE_CONFIGURATION.md");
  for (const phrase of ["Authentication alone does not grant", "public.finds", "find-images", "Migration ownership"]) {
    assert.ok(architecture.includes(phrase), phrase);
  }
  for (const command of [
    "npm install", "npm run supabase:start", "npm run supabase:reset",
    "npm run supabase:test", "npm run supabase:lint", "npm run supabase:stop"
  ]) {
    assert.ok(local.includes(command), command);
  }
  assert.match(local, /Never expose it publicly/i);
  assert.match(remote, /only after MASTER acceptance/i);
  assert.match(remote, /publishable key/i);
  for (const name of [
    "SUPABASE_ACCESS_TOKEN", "SUPABASE_DB_PASSWORD", "SUPABASE_SECRET_KEY", "SUPABASE_SERVICE_ROLE_KEY"
  ]) {
    assert.ok(configuration.includes(name), name);
  }
});

test("protected live catalog and accepted intake files remain unchanged", () => {
  const protectedPaths = [
    "index.html", "find.html", "item.html", "app.js", "item.js", "styles.css",
    "data/items.js", "data/collections.js", "data/discovery.js", "data/media.js",
    "data/reservation.js", "data/permalinks.js", "assets/images", "assets/brand",
    "content-intake/finds.csv", "content-intake/photo-manifest.csv", "content-intake/photos",
    "tests/fixtures/legacy-items.snapshot.json", "docs/IDENTIFIER_REGISTRY.md",
    ".github/workflows/baseline-validation.yml"
  ];
  const result = spawnSync("git", ["diff", "--name-only", foundationBase, "--", ...protectedPaths], {
    cwd: repositoryRoot,
    encoding: "utf8"
  });
  const status = spawnSync("git", ["status", "--porcelain=v1", "--", ...protectedPaths], {
    cwd: repositoryRoot,
    encoding: "utf8"
  });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(status.status, 0, status.stderr);
  assert.equal(result.stdout.trim(), "");
  assert.equal(status.stdout.trim(), "");
});
