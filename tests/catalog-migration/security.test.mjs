import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

import { parseCsv } from "../../scripts/lib/content-intake.mjs";
import { HOST, createStaticServer, resolveStaticRequest } from "../../scripts/serve-static.mjs";

const root = resolve(import.meta.dirname, "../..");
const read = (path) => readFileSync(resolve(root, path), "utf8");

test("migration route is private, unlinked, strict, and unavailable to POST", () => {
  const html = read("admin/migrate-intake.html");
  assert.match(html, /Private workspace/);
  assert.match(html, /Owner access only/);
  assert.match(html, /script-src 'self'/);
  assert.match(html, /connect-src 'self' http:\/\/127\.0\.0\.1:54321 ws:\/\/127\.0\.0\.1:54321/);
  assert.doesNotMatch(html, /unsafe-inline|unsafe-eval|sign[ -]?up|password reset/i);
  assert.equal(HOST, "127.0.0.1");
  assert.equal(resolveStaticRequest("/admin/migrate-intake.html", root), resolve(root, "admin/migrate-intake.html"));
  for (const publicFile of ["index.html", "find.html", "item.html", "app.js", "item.js"]) {
    assert.doesNotMatch(read(publicFile), /migrate-intake/);
  }

  const server = createStaticServer(root);
  const handler = server.listeners("request")[0];
  const response = { writeHead(status, headers) { this.status = status; this.headers = headers; }, end(body) { this.body = body; } };
  handler({ method: "POST", url: "/admin/migrate-intake.html" }, response);
  assert.equal(response.status, 405);
  assert.equal(resolveStaticRequest("/.env.local", root), null);
  server.close();
});

test("migration sources and bundles contain no credentials, logging, identity, or internal note values", () => {
  const sourcePaths = [
    "admin/migrate-intake.html", "admin-src/migration.js", "admin-src/migration-auth.js",
    "admin-src/migration-plan.js", "admin-src/migration-executor.js", "admin-src/migration-ui.js",
    "migration/m07b3-catalog-plan.json"
  ];
  const source = sourcePaths.map(read).join("\n");
  const bundle = read("admin/assets/migrate-intake.js");
  const combined = `${source}\n${bundle}`;
  assert.doesNotMatch(combined, /sb_secret_[A-Za-z0-9_-]{8,}|sbp_[A-Za-z0-9]{16,}/);
  assert.doesNotMatch(combined, /eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/);
  assert.doesNotMatch(source, /console\.(?:log|info|warn|error)|service[_-]?role/i);
  assert.doesNotMatch(source, /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i);

  const intakeRecords = parseCsv(read("content-intake/finds.csv"), "accepted");
  const noteIndex = intakeRecords.headers.findIndex((header) => /^owner.*notes$/.test(header));
  for (const { cells } of intakeRecords.records) {
    const value = cells[noteIndex]?.trim();
    if (value) assert.equal(combined.includes(value), false);
  }
});

test("ignored configuration remains untracked and public/protected runtime is unchanged", () => {
  assert.equal(spawnSync("git", ["check-ignore", "-q", "admin/config.js"], { cwd: root }).status, 0);
  assert.notEqual(spawnSync("git", ["ls-files", "--error-unmatch", "admin/config.js"], { cwd: root }).status, 0);
  const protectedPaths = [
    "index.html", "find.html", "item.html", "app.js", "item.js", "styles.css",
    "data/items.js", "data/discovery.js", "data/media.js", "data/reservation.js", "data/permalinks.js",
    "content-intake/finds.csv", "content-intake/photo-manifest.csv", "content-intake/photos",
    "tests/fixtures/legacy-items.snapshot.json"
  ];
  const result = spawnSync("git", ["diff", "--name-only", "915b7fef50ac40ac255b2c8d522d58e0a69ae704", "--", ...protectedPaths], { cwd: root, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), "");
});
