import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

import { parseCsv } from "../../scripts/lib/content-intake.mjs";
import {
  HOST,
  MAINTENANCE_PREFIX,
  MAINTENANCE_RESOURCES,
  createMaintenanceAuthorizer,
  createStaticServer,
  resolveMaintenanceRequest,
  resolveStaticRequest
} from "../../scripts/serve-static.mjs";

const root = resolve(import.meta.dirname, "../..");
const read = (path) => readFileSync(resolve(root, path), "utf8");
const fictionalToken = "fictional.local.owner.access-token";

async function invoke(server, { method = "GET", url = "/", headers = {} } = {}) {
  const response = {
    status: null,
    headers: null,
    body: null,
    writeHead(status, responseHeaders) {
      this.status = status;
      this.headers = responseHeaders;
    },
    end(body) {
      this.body = body ?? Buffer.alloc(0);
    }
  };
  await server.listeners("request")[0]({ method, url, headers }, response);
  response.text = Buffer.from(response.body).toString("utf8");
  return response;
}

function authorizerFor(role, calls = []) {
  return createMaintenanceAuthorizer({
    configurationProvider: () => ({
      url: "http://127.0.0.1:54321/",
      publishableKey: "fictional-local-publishable-key",
      projectRef: "local-m07b3"
    }),
    fetchImpl: async (url, options) => {
      calls.push({ url: String(url), options });
      if (new URL(url).pathname === "/auth/v1/user") {
        return new Response(JSON.stringify({ id: "00000000-0000-4000-8000-000000000099" }), {
          status: 200,
          headers: { "content-type": "application/json" }
        });
      }
      return new Response(JSON.stringify(role), {
        status: 200,
        headers: { "content-type": "application/json" }
      });
    }
  });
}

test("migration route is private, unlinked, strict, and unavailable to POST", async () => {
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
  const response = await invoke(server, { method: "POST", url: "/admin/migrate-intake.html" });
  assert.equal(response.status, 405);
  assert.equal(response.headers.Allow, "GET, HEAD");
  assert.equal(resolveStaticRequest("/.env.local", root), null);
  server.close();
});

test("unauthenticated direct GET cannot retrieve migration sources", async () => {
  const server = createStaticServer(root, { authorizeMaintenanceRequest: authorizerFor("owner") });
  const rawPaths = [
    "/migration/m07b3-catalog-plan.json",
    "/content-intake/finds.csv",
    "/content-intake/photo-manifest.csv",
    "/content-intake/photos/vintage-ceramic-handbell-01.jpeg",
    "/docs/IDENTIFIER_REGISTRY.md",
    "/admin/config.js",
    "/Migration/m07b3-catalog-plan.json",
    "/Content-Intake/finds.csv",
    "/Docs/identifier_registry.md",
    "/Admin/CONFIG.js",
    "/.env.local"
  ];
  for (const url of rawPaths) {
    const response = await invoke(server, { url });
    assert.equal(response.status, 404, url);
    assert.equal(resolveStaticRequest(url, root), null, url);
  }
  for (const url of Object.keys(MAINTENANCE_RESOURCES)) {
    const response = await invoke(server, { url });
    assert.equal(response.status, 401, url);
    assert.equal(response.text, "Unauthorized", url);
  }
  server.close();
});

test("authenticated editor and non-owner access are denied", async () => {
  for (const role of ["editor", null, "Owner", "administrator"]) {
    const server = createStaticServer(root, { authorizeMaintenanceRequest: authorizerFor(role) });
    const response = await invoke(server, {
      url: `${MAINTENANCE_PREFIX}/plan`,
      headers: { authorization: `Bearer ${fictionalToken}` }
    });
    assert.equal(response.status, 403, String(role));
    assert.equal(response.text, "Forbidden", String(role));
    server.close();
  }
});

test("authenticated exact owner can retrieve only exact allowlisted migration resources", async () => {
  const calls = [];
  const server = createStaticServer(root, { authorizeMaintenanceRequest: authorizerFor("owner", calls) });
  for (const [url, relativePath] of Object.entries(MAINTENANCE_RESOURCES)) {
    const response = await invoke(server, {
      url,
      headers: { authorization: `Bearer ${fictionalToken}` }
    });
    assert.equal(response.status, 200, url);
    assert.deepEqual(Buffer.from(response.body), readFileSync(resolve(root, relativePath)), url);
    assert.equal(response.headers["Cache-Control"], "no-store");
  }

  for (const url of [
    `${MAINTENANCE_PREFIX}/unknown`,
    `${MAINTENANCE_PREFIX}/photos/not-approved.png`,
    `${MAINTENANCE_PREFIX}/plan?download=1`,
    `${MAINTENANCE_PREFIX}/../migration/m07b3-catalog-plan.json`
  ]) {
    assert.equal((await invoke(server, {
      url,
      headers: { authorization: `Bearer ${fictionalToken}` }
    })).status, 404, url);
    assert.equal(resolveMaintenanceRequest(url, root), null, url);
  }

  const head = await invoke(server, {
    method: "HEAD",
    url: `${MAINTENANCE_PREFIX}/plan`,
    headers: { authorization: `Bearer ${fictionalToken}` }
  });
  assert.equal(head.status, 200);
  assert.equal(head.body.byteLength, 0);
  assert.ok(calls.length >= Object.keys(MAINTENANCE_RESOURCES).length * 2);
  server.close();
});

test("bearer authorization is header-only and is never logged or returned", { concurrency: false }, async () => {
  const calls = [];
  const output = [];
  const methods = ["log", "info", "warn", "error"];
  const originals = Object.fromEntries(methods.map((method) => [method, console[method]]));
  for (const method of methods) console[method] = (...values) => output.push(values.join(" "));
  try {
    const server = createStaticServer(root, { authorizeMaintenanceRequest: authorizerFor("owner", calls) });
    const response = await invoke(server, {
      url: `${MAINTENANCE_PREFIX}/plan`,
      headers: { authorization: `Bearer ${fictionalToken}` }
    });
    assert.equal(response.status, 200);
    const returned = `${response.text}\n${JSON.stringify(response.headers)}\n${output.join("\n")}`;
    assert.equal(returned.includes(fictionalToken), false);
    assert.equal(calls.every(({ url }) => !url.includes(fictionalToken)), true);
    assert.equal(calls.every(({ options }) => options.headers.authorization === `Bearer ${fictionalToken}`), true);
    assert.equal(calls.every(({ options }) => options.method === "GET" && options.redirect === "error"), true);
    server.close();
  } finally {
    for (const method of methods) console[method] = originals[method];
  }
});

test("migration sources and bundles contain no credentials, logging, identity, or internal note values", () => {
  const sourcePaths = [
    "admin/migrate-intake.html", "admin-src/migration.js", "admin-src/migration-auth.js",
    "admin-src/migration-plan.js", "admin-src/migration-executor.js", "admin-src/migration-ui.js",
    "scripts/serve-static.mjs", "migration/m07b3-catalog-plan.json"
  ];
  const source = sourcePaths.map(read).join("\n");
  const bundle = read("admin/assets/migrate-intake.js");
  const combined = `${source}\n${bundle}`;
  assert.doesNotMatch(combined, /sb_secret_[A-Za-z0-9_-]{8,}|sbp_[A-Za-z0-9]{16,}/);
  assert.doesNotMatch(combined, /eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/);
  assert.doesNotMatch(source, /console\.(?:info|warn)|service[_-]?role/i);

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
