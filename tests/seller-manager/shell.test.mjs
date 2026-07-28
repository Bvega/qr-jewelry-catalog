import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { HOST, createStaticServer, resolveStaticRequest } from "../../scripts/serve-static.mjs";

const root = resolve(import.meta.dirname, "../..");
const html = readFileSync(resolve(root, "admin/index.html"), "utf8");

test("admin shell identifies the manager and exposes accessible auth/session states", () => {
  assert.match(html, /<title>Seller Catalog Manager \| Between Us<\/title>/);
  assert.match(html, /<form id="signInForm"[^>]*>/);
  assert.match(html, /type="email"[^>]*autocomplete="username"/);
  assert.match(html, /type="password"[^>]*autocomplete="current-password"/);
  assert.match(html, /id="globalStatus"[^>]*role="status"[^>]*aria-live="polite"/);
  assert.match(html, /id="logoutButton"/);
  assert.match(html, /id="deniedSection"/);
  assert.match(html, /Skip to manager/);
});

test("shell provides all required catalog, editing, image, and lifecycle controls", () => {
  for (const id of [
    "catalogList", "catalogFilter", "newFindButton", "findForm", "title", "collectionId",
    "priceAmount", "availability", "description", "condition", "primaryImage", "altText",
    "publicationState", "publicationEligibility", "publicationBlockers", "publishFindButton",
    "hideFindButton", "archiveFindButton", "restoreFindButton", "cancelEditButton"
  ]) assert.match(html, new RegExp(`id="${id}"`), id);
  for (const label of ["Save Find", "Publish", "Unpublish", "New Find", "Archive", "Restore", "Cancel edit"]) {
    assert.ok(html.includes(label), label);
  }
  for (const filter of ["all", "available", "reserved", "sold", "published", "hidden", "archived"]) {
    assert.match(html, new RegExp(`value="${filter}"`), filter);
  }
});

test("shell has no signup flow and uses a strict local-asset CSP", () => {
  assert.doesNotMatch(html, /sign[ -]?up|create account/i);
  assert.match(html, /script-src 'self'/);
  assert.match(html, /style-src 'self'/);
  assert.match(html, /connect-src 'self' http:\/\/127\.0\.0\.1:54321 ws:\/\/127\.0\.0\.1:54321 https:\/\/\*\.supabase\.co wss:\/\/\*\.supabase\.co/);
  assert.match(html, /img-src 'self' data: blob: http:\/\/127\.0\.0\.1:54321 https:\/\/\*\.supabase\.co/);
  assert.doesNotMatch(html, /unsafe-eval|unsafe-inline/);
  assert.match(html, /src="\.\/runtime-config\.js"/);
  assert.match(html, /src="\.\/assets\/app\.js"/);
});

test("local server binds to loopback, maps /admin/, blocks secrets, and has no write API", async () => {
  assert.equal(HOST, "127.0.0.1");
  assert.equal(resolveStaticRequest("/admin/", root), resolve(root, "admin/index.html"));
  assert.equal(resolveStaticRequest("/admin/activate.html", root), resolve(root, "admin/activate.html"));
  assert.equal(resolveStaticRequest("/admin/migrate-intake.html", root), resolve(root, "admin/migrate-intake.html"));
  assert.equal(resolveStaticRequest("/.env.local", root), null);
  assert.equal(resolveStaticRequest("/%2e%2e/%2e%2e/.env.local", root), null);

  const server = createStaticServer(root);
  const handler = server.listeners("request")[0];
  const response = {
    status: null,
    headers: null,
    body: null,
    writeHead(status, headers) {
      this.status = status;
      this.headers = headers;
    },
    end(body) {
      this.body = body;
    }
  };
  await handler({ method: "POST", url: "/admin/", headers: {} }, response);
  assert.equal(response.status, 405);
  assert.equal(response.headers.Allow, "GET, HEAD");
  assert.equal(response.body.toString("utf8"), "Method not allowed");
  server.close();
});

test("protected static catalog, accepted intake, and product images are unchanged", () => {
  const protectedPaths = [
    "styles.css", "data/items.js", "data/collections.js", "data/discovery.js", "data/media.js",
    "data/reservation.js", "data/permalinks.js", "assets/images",
    "content-intake/finds.csv", "content-intake/photo-manifest.csv", "content-intake/photos",
    "tests/fixtures/legacy-items.snapshot.json"
  ];
  const diff = spawnSync("git", [
    "diff", "--name-only", "915b7fef50ac40ac255b2c8d522d58e0a69ae704", "--", ...protectedPaths
  ], { cwd: root, encoding: "utf8" });
  const status = spawnSync("git", ["status", "--porcelain=v1", "--", ...protectedPaths], {
    cwd: root,
    encoding: "utf8"
  });
  assert.equal(diff.status, 0, diff.stderr);
  assert.equal(status.status, 0, status.stderr);
  assert.equal(diff.stdout.trim(), "");
  assert.equal(status.stdout.trim(), "");
});
