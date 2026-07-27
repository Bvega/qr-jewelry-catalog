import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  lstatSync,
  readFileSync,
  readdirSync,
  symlinkSync,
  unlinkSync,
  writeFileSync
} from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import vm from "node:vm";
import {
  buildPagesArtifact,
  loadPagesManifest,
  pagesArtifactRoot,
  validatePagesManifest
} from "../../scripts/build-pages-artifact.mjs";
import {
  serializeBrowserConfiguration,
  validateBrowserConfiguration
} from "../../scripts/generate-admin-config.mjs";
import {
  generatePagesRuntimeConfig,
  pagesRuntimeConfigPath
} from "../../scripts/generate-pages-runtime-config.mjs";
import {
  PAGES_DEFAULT_PORT,
  PAGES_HOST,
  parsePagesPort,
  resolvePagesRequest
} from "../../scripts/serve-pages-artifact.mjs";
import { validatePagesArtifact } from "../../scripts/validate-pages-artifact.mjs";

const root = resolve(import.meta.dirname, "../..");
const projectRef = "m07b4testref123456";
const publishableKey = "sb_publishable_m07b4_fictional_browser_key_123456";
const environment = Object.freeze({
  SUPABASE_URL: `https://${projectRef}.supabase.co`,
  SUPABASE_PUBLISHABLE_KEY: publishableKey,
  SUPABASE_PROJECT_REF: projectRef
});
const acceptedPublicIds = Object.freeze([
  "BU-0001",
  "BU-0002",
  "BU-0003",
  "BU-0004",
  "BU-0005"
]);
const acceptedSlugs = Object.freeze([
  "gold-twisted-rope-bracelet",
  "silver-stackable-ring-set",
  "pearl-drop-earrings",
  "layered-gold-chain-necklace",
  "crystal-stud-earrings"
]);
const publicCopyPaths = Object.freeze([
  "app.js",
  "assets/brand/between-us-mark.svg",
  "assets/images/crystal-stud-earrings-01.jpeg",
  "assets/images/gold-twisted-rope-bracelet-01.jpeg",
  "assets/images/layered-gold-chain-necklace-01.jpeg",
  "data/collections.js",
  "data/discovery.js",
  "data/items.js",
  "data/media.js",
  "data/permalinks.js",
  "data/reservation.js",
  "find.html",
  "index.html",
  "item.html",
  "item.js",
  "styles.css"
]);

function base64Url(value) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function legacyKey(role = "anon", ref = projectRef) {
  return [
    base64Url({ alg: "HS256", typ: "JWT" }),
    base64Url({ iss: "supabase", ref, role, iat: 1700000000, exp: 4102444800 }),
    "a".repeat(43)
  ].join(".");
}

function listFiles(directory = pagesArtifactRoot, prefix = "") {
  const files = [];
  for (const name of readdirSync(directory).sort((left, right) => left.localeCompare(right))) {
    const path = resolve(directory, name);
    const relativePath = prefix ? `${prefix}/${name}` : name;
    const status = lstatSync(path);
    if (status.isDirectory()) files.push(...listFiles(path, relativePath));
    else files.push(relativePath);
  }
  return files;
}

function artifactSnapshot() {
  return Object.fromEntries(listFiles().map((path) => [
    path,
    createHash("sha256").update(readFileSync(resolve(pagesArtifactRoot, path))).digest("hex")
  ]));
}

function loadArtifactFinds() {
  const context = { window: {} };
  vm.runInNewContext(
    readFileSync(resolve(pagesArtifactRoot, "data/items.js"), "utf8"),
    context,
    { filename: "dist/pages/data/items.js" }
  );
  return Array.from(context.window.BETWEEN_US_FINDS, (find) => ({
    publicId: find.publicId,
    legacyId: find.legacyId,
    slug: find.slug
  }));
}

await buildPagesArtifact({ environment, silent: true });

test("manifest is a deterministic, sorted, strict runtime allowlist", () => {
  const manifest = loadPagesManifest();
  assert.equal(manifest.version, 1);
  assert.equal(manifest.files.length, 21);
  const outputs = manifest.files.map((entry) => entry.output);
  assert.deepEqual(outputs, [...outputs].sort((left, right) => left.localeCompare(right)));
  assert.equal(new Set(outputs).size, outputs.length);
  assert.deepEqual(Object.keys(JSON.parse(
    readFileSync(resolve(root, "deployment/pages-manifest.json"), "utf8")
  )), ["version", "files"]);

  const duplicate = structuredClone(manifest);
  duplicate.files[1].output = duplicate.files[0].output;
  assert.throws(() => validatePagesManifest(duplicate), /Duplicate manifest output/);

  const duplicateSource = structuredClone(manifest);
  const sourcedEntries = duplicateSource.files.filter((entry) => entry.source);
  sourcedEntries[1].source = sourcedEntries[0].source;
  assert.throws(() => validatePagesManifest(duplicateSource), /Duplicate manifest source/);

  const outsideRoot = structuredClone(manifest);
  outsideRoot.files[1].output = "../outside.js";
  assert.throws(() => validatePagesManifest(outsideRoot), /dot path|escapes|normalized/i);

  const outsideSource = structuredClone(manifest);
  outsideSource.files.find((entry) => entry.source).source = "../outside.js";
  assert.throws(() => validatePagesManifest(outsideSource), /dot path|escapes|normalized/i);

  const dotSource = structuredClone(manifest);
  dotSource.files.find((entry) => entry.source).source = ".env.example";
  assert.throws(() => validatePagesManifest(dotSource), /dot path/i);

  const missingSource = structuredClone(manifest);
  missingSource.files.find((entry) => entry.source).source = "missing-runtime-file.js";
  assert.throws(() => validatePagesManifest(missingSource), /ENOENT|missing-runtime-file/);

  const sourceLink = resolve(root, "dist/manifest-source-link");
  symlinkSync(resolve(root, "README.md"), sourceLink);
  try {
    const symlinkSource = structuredClone(manifest);
    symlinkSource.files.find((entry) => entry.source).source = "dist/manifest-source-link";
    assert.throws(() => validatePagesManifest(symlinkSource), /source cannot be a symlink/i);
  } finally {
    unlinkSync(sourceLink);
  }
});

test("production configuration accepts only validated browser-safe values", () => {
  assert.deepEqual(validateBrowserConfiguration(environment, { production: true }), {
    url: `https://${projectRef}.supabase.co/`,
    publishableKey,
    projectRef
  });
  const legacy = legacyKey();
  assert.deepEqual(validateBrowserConfiguration({
    ...environment,
    SUPABASE_PUBLISHABLE_KEY: legacy
  }, { production: true }), {
    url: `https://${projectRef}.supabase.co/`,
    publishableKey: legacy,
    projectRef
  });

  for (const blankName of [
    "SUPABASE_URL",
    "SUPABASE_PUBLISHABLE_KEY",
    "SUPABASE_PROJECT_REF"
  ]) {
    assert.throws(() => validateBrowserConfiguration({
      ...environment,
      [blankName]: " "
    }, { production: true }), /Missing or blank/);
  }
  assert.throws(() => validateBrowserConfiguration({
    ...environment,
    SUPABASE_URL: "https://differentref123456.supabase.co"
  }, { production: true }), /matching remote/i);
  assert.throws(() => validateBrowserConfiguration({
    ...environment,
    SUPABASE_URL: "http://127.0.0.1:54321",
    SUPABASE_PROJECT_REF: "local-m07b3"
  }, { production: true }), /loopback in production/i);
  const fictionalSecretKey = ["sb", "secret", "fictional-rejected-value-123456"].join("_");
  assert.equal(fictionalSecretKey.startsWith(["sb", "secret", ""].join("_")), true);
  assert.throws(() => validateBrowserConfiguration({
    ...environment,
    SUPABASE_PUBLISHABLE_KEY: fictionalSecretKey
  }, { production: true }), /browser-safe/);
  assert.throws(() => validateBrowserConfiguration({
    ...environment,
    SUPABASE_PUBLISHABLE_KEY: legacyKey("service_role")
  }, { production: true }), /browser-safe/);
  assert.throws(() => validateBrowserConfiguration({
    ...environment,
    SUPABASE_SERVICE_ROLE_KEY: "fictional-rejected"
  }, { production: true }), /not accepted/);
  assert.throws(() => validateBrowserConfiguration({
    ...environment,
    SUPABASE_ACCESS_TOKEN: "fictional-rejected"
  }, { production: true }), /not accepted/);
  assert.throws(() => validateBrowserConfiguration({
    ...environment,
    SUPABASE_PUBLISHABLE_KEY: legacyKey("anon", "wrongref123456")
  }, { production: true }), /browser-safe/);
});

test("deployment generator writes only the exact production runtime config without logging values", () => {
  generatePagesRuntimeConfig({ environment });
  const output = readFileSync(pagesRuntimeConfigPath, "utf8");
  assert.equal(output, serializeBrowserConfiguration({
    url: `https://${projectRef}.supabase.co/`,
    publishableKey,
    projectRef
  }));
  assert.deepEqual(
    listFiles().filter((path) => path.endsWith("runtime-config.js")),
    ["admin/runtime-config.js"]
  );
  assert.equal(lstatSync(resolve(root, "admin")).isDirectory(), true);

  const result = spawnSync(process.execPath, ["scripts/build-pages-artifact.mjs"], {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, ...environment }
  });
  assert.equal(result.status, 0, result.stderr);
  const logs = `${result.stdout}\n${result.stderr}`;
  for (const value of Object.values(environment)) assert.ok(!logs.includes(value));
  assert.match(logs, /Pages artifact built \(21 files\)/);
});

test("artifact starts clean, rejects unexpected entries and symlinks, and rebuilds byte-identically", async () => {
  writeFileSync(resolve(pagesArtifactRoot, "unexpected-owner-note.txt"), "must be removed");
  assert.throws(() => validatePagesArtifact(), /inventory differs/i);
  await buildPagesArtifact({ environment, silent: true });
  const first = artifactSnapshot();

  symlinkSync(resolve(root, "README.md"), resolve(pagesArtifactRoot, "unexpected-link"));
  assert.throws(() => validatePagesArtifact(), /symlink is forbidden/i);
  await buildPagesArtifact({ environment, silent: true });
  assert.deepEqual(artifactSnapshot(), first);
  assert.deepEqual(listFiles(), loadPagesManifest().files.map((entry) => entry.output));
  assert.equal(readFileSync(resolve(pagesArtifactRoot, ".nojekyll")).byteLength, 0);
  assert.ok(listFiles().every((path) => !path.endsWith(".map")));
  validatePagesArtifact();
});

test("accepted public catalog bytes, identifiers, routes, aliases, and QR contract remain frozen", () => {
  for (const path of publicCopyPaths) {
    assert.deepEqual(
      readFileSync(resolve(pagesArtifactRoot, path)),
      readFileSync(resolve(root, path)),
      path
    );
  }
  const finds = loadArtifactFinds();
  assert.deepEqual(finds.map((find) => find.publicId), acceptedPublicIds);
  assert.deepEqual(finds.map((find) => find.legacyId), [1, 2, 3, 4, 5]);
  assert.deepEqual(finds.map((find) => find.slug), acceptedSlugs);
  const allPublicText = publicCopyPaths
    .filter((path) => /\.(?:html|js|css|svg)$/.test(path))
    .map((path) => readFileSync(resolve(pagesArtifactRoot, path), "utf8"))
    .join("\n");
  for (const id of ["BU-0006", "BU-0007", "BU-0008", "BU-0009"]) {
    assert.ok(!allPublicText.includes(id));
  }
  for (const [index, find] of finds.entries()) {
    assert.equal(
      resolvePagesRequest(`/find.html?id=${find.publicId}`),
      resolve(pagesArtifactRoot, "find.html")
    );
    assert.equal(
      resolvePagesRequest(`/item.html?id=${index + 1}`),
      resolve(pagesArtifactRoot, "item.html")
    );
    assert.equal(
      resolvePagesRequest(`/find.html?slug=${find.slug}`),
      resolve(pagesArtifactRoot, "find.html")
    );
  }
  const detailHtml = readFileSync(resolve(pagesArtifactRoot, "find.html"), "utf8");
  assert.match(detailHtml, /https:\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/qrcodejs\/1\.0\.0\/qrcode\.min\.js/);
  assert.match(readFileSync(resolve(pagesArtifactRoot, "item.js"), "utf8"), /text:\s*canonicalURL/);
  assert.match(readFileSync(resolve(pagesArtifactRoot, "data/permalinks.js"), "utf8"), /find\.html/);
});

test("relative public and Manager navigation remains valid under the GitHub project subpath", () => {
  const projectBase = "https://example.github.io/qr-jewelry-catalog/";
  assert.equal(new URL("styles.css", projectBase).pathname, "/qr-jewelry-catalog/styles.css");
  assert.equal(new URL("find.html?id=BU-0001", projectBase).pathname, "/qr-jewelry-catalog/find.html");
  assert.equal(
    new URL("../index.html", `${projectBase}admin/index.html`).pathname,
    "/qr-jewelry-catalog/index.html"
  );
  assert.equal(
    new URL("./assets/app.js", `${projectBase}admin/index.html`).pathname,
    "/qr-jewelry-catalog/admin/assets/app.js"
  );
});

test("production Manager contains only its accepted route, assets, and remote-only CSP", () => {
  const inventory = new Set(listFiles());
  for (const path of [
    "admin/index.html",
    "admin/assets/app.js",
    "admin/assets/styles.css",
    "admin/runtime-config.js"
  ]) assert.ok(inventory.has(path), path);
  for (const path of [
    "admin/activate.html",
    "admin/migrate-intake.html",
    "admin/assets/activate.js",
    "admin/assets/migrate-intake.js",
    "admin/config.js"
  ]) assert.ok(!inventory.has(path), path);

  const html = readFileSync(resolve(pagesArtifactRoot, "admin/index.html"), "utf8");
  assert.match(html, /name="robots" content="noindex, nofollow"/);
  assert.match(html, /connect-src 'self' https:\/\/\*\.supabase\.co wss:\/\/\*\.supabase\.co/);
  assert.match(html, /img-src 'self' data: blob: https:\/\/\*\.supabase\.co/);
  assert.doesNotMatch(html, /127\.0\.0\.1|localhost|sign[ -]?up|create account|password reset/i);
  assert.doesNotMatch(
    listFiles()
      .filter((path) => /\.(?:html|js|css)$/.test(path))
      .map((path) => readFileSync(resolve(pagesArtifactRoot, path), "utf8"))
      .join("\n"),
    /sb_secret_|SUPABASE_(?:SERVICE_ROLE_KEY|SECRET_KEY|DB_PASSWORD|ACCESS_TOKEN)/
  );
});

test("preview server is loopback-only, validates its port, and exposes only artifact routes", () => {
  assert.equal(PAGES_HOST, "127.0.0.1");
  assert.equal(PAGES_DEFAULT_PORT, 4175);
  assert.equal(parsePagesPort(undefined), 4175);
  assert.equal(parsePagesPort("49152"), 49152);
  for (const value of ["0", "65536", "-1", "1.5", "localhost", " 4175"]) {
    assert.throws(() => parsePagesPort(value), /PAGES_PORT/);
  }
  assert.equal(resolvePagesRequest("/"), resolve(pagesArtifactRoot, "index.html"));
  assert.equal(resolvePagesRequest("/admin/"), resolve(pagesArtifactRoot, "admin/index.html"));
  for (const path of [
    "/admin/activate.html",
    "/admin/migrate-intake.html",
    "/.git/config",
    "/.env.local",
    "/content-intake/finds.csv",
    "/deployment/pages-manifest.json",
    "/docs/MILESTONES/M07B4.md",
    "/migration/m07b3-catalog-plan.json",
    "/package.json",
    "/scripts/build-pages-artifact.mjs",
    "/supabase/config.toml",
    "/tests/deployment/pages-artifact.test.mjs"
  ]) {
    const resolved = resolvePagesRequest(path);
    if (path.includes("/.")) assert.equal(resolved, null, path);
    else assert.equal(lstatOrNull(resolved), null, path);
  }
});

test("workflow validates every event but deploys only accepted main revisions with least privilege", () => {
  const workflow = readFileSync(resolve(root, ".github/workflows/deploy-pages.yml"), "utf8");
  const jobsIndex = workflow.indexOf("\njobs:");
  const deployIndex = workflow.indexOf("\n  deploy:");
  assert.ok(jobsIndex > 0);
  assert.ok(deployIndex > jobsIndex);
  const workflowHeader = workflow.slice(0, jobsIndex);
  const buildJob = workflow.slice(jobsIndex, deployIndex);
  const deployJob = workflow.slice(deployIndex);

  assert.match(workflow, /^  pull_request:\n    branches:\n      - main/m);
  assert.match(workflow, /^  push:\n    branches:\n      - main/m);
  assert.match(workflow, /^  workflow_dispatch:$/m);
  assert.match(workflowHeader, /^permissions:\n  contents: read\s*$/m);
  assert.doesNotMatch(workflowHeader, /^\s+pages: write\s*$/m);
  assert.doesNotMatch(workflowHeader, /^\s+id-token: write\s*$/m);
  assert.doesNotMatch(buildJob, /^\s{4}permissions:\s*$/m);
  assert.doesNotMatch(buildJob, /^\s+pages: write\s*$/m);
  assert.doesNotMatch(buildJob, /^\s+id-token: write\s*$/m);
  assert.doesNotMatch(buildJob, /actions\/(?:configure|deploy)-pages@/);
  assert.match(deployJob, /^\s{4}permissions:\n\s{6}pages: write\n\s{6}id-token: write\s*$/m);
  assert.match(
    deployJob,
    /uses: actions\/configure-pages@v5\n\n\s+- name: Deploy GitHub Pages\n\s+id: deployment\n\s+uses: actions\/deploy-pages@v4/
  );
  assert.equal(workflow.split("actions/configure-pages@v5").length - 1, 1);
  assert.equal(workflow.split("actions/deploy-pages@v4").length - 1, 1);
  assert.match(workflow, /uses: actions\/checkout@v6[\s\S]*?ref: \$\{\{ github\.sha \}\}/);
  assert.match(workflow, /uses: actions\/setup-node@v6/);
  assert.match(workflow, /uses: actions\/upload-pages-artifact@v4[\s\S]*?path: dist\/pages/);
  assert.doesNotMatch(workflow, /path:\s*[.'"]+\s*$/m);
  assert.match(deployJob, /needs:\n      - build/);
  assert.match(deployJob, /github\.ref == 'refs\/heads\/main'/);
  assert.match(deployJob, /github\.event_name == 'push' \|\| github\.event_name == 'workflow_dispatch'/);
  assert.doesNotMatch(deployJob, /github\.event_name == 'pull_request'/);
  assert.match(deployJob, /environment:\n      name: github-pages\n      url: \$\{\{ steps\.deployment\.outputs\.page_url \}\}/);
  assert.match(deployJob, /concurrency:\n      group: github-pages\n      cancel-in-progress: false/);
  for (const name of [
    "BETWEEN_US_SUPABASE_URL",
    "BETWEEN_US_SUPABASE_PUBLISHABLE_KEY",
    "BETWEEN_US_SUPABASE_PROJECT_REF"
  ]) {
    assert.equal(workflow.split(`vars.${name}`).length - 1, 1, name);
  }
  assert.doesNotMatch(workflow, /secrets\./);
  assert.match(workflow, /run: npm ci/);
  for (const command of [
    "validate:baseline",
    "admin:validate",
    "migration:validate",
    "migration:test",
    "pages:test",
    "pages:build",
    "pages:validate"
  ]) assert.match(workflow, new RegExp(`npm run ${command.replace(":", "\\:")}`));
});

function lstatOrNull(path) {
  try {
    return lstatSync(path);
  } catch {
    return null;
  }
}
