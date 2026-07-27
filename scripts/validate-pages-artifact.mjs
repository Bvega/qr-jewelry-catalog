#!/usr/bin/env node

import {
  lstatSync,
  readFileSync,
  readdirSync
} from "node:fs";
import { extname, relative, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";
import {
  loadPagesManifest,
  pagesArtifactRoot,
  renderProductionAdminHtml
} from "./build-pages-artifact.mjs";
import {
  serializeBrowserConfiguration,
  validateBrowserConfiguration
} from "./generate-admin-config.mjs";

const FORBIDDEN_ROOTS = new Set([
  ".git",
  ".github",
  "admin-src",
  "content-intake",
  "deployment",
  "docs",
  "migration",
  "node_modules",
  "scripts",
  "supabase",
  "tests"
]);
const FORBIDDEN_EXACT = new Set([
  ".env",
  "admin/activate.html",
  "admin/config.js",
  "admin/migrate-intake.html",
  "admin/assets/activate.js",
  "admin/assets/migrate-intake.js",
  "chatgpt_todo.txt",
  "package.json",
  "package-lock.json",
  "readme.md"
]);
const KNOWN_FALLBACK_REFERENCES = new Set([
  "assets/images/placeholder-ring-silver.jpg",
  "assets/images/placeholder-earrings-pearl.jpg"
]);
const PUBLIC_OUTPUTS = new Set([
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

function listArtifact(root = pagesArtifactRoot, prefix = "") {
  const files = [];
  for (const name of readdirSync(root).sort((left, right) => left.localeCompare(right))) {
    const filePath = resolve(root, name);
    const relativePath = prefix ? `${prefix}/${name}` : name;
    const status = lstatSync(filePath);
    if (status.isSymbolicLink()) throw new Error(`Artifact symlink is forbidden: ${relativePath}.`);
    if (status.isDirectory()) files.push(...listArtifact(filePath, relativePath));
    else if (status.isFile()) files.push(relativePath);
    else throw new Error(`Artifact special file is forbidden: ${relativePath}.`);
  }
  return files;
}

function resolveLocalReference(fromFile, reference) {
  if (
    reference === ""
    || reference.startsWith("#")
    || /^(?:data:|blob:|mailto:|tel:)/i.test(reference)
  ) return null;
  if (/^https?:\/\//i.test(reference)) {
    if (reference === "https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js") {
      return null;
    }
    throw new Error(`Unexpected external runtime reference in ${fromFile}.`);
  }
  const parsed = new URL(reference, `https://artifact.test/${fromFile}`);
  const decoded = decodeURIComponent(parsed.pathname).replace(/^\/+/, "");
  const normalized = relative(".", resolve(".", decoded)).split(sep).join("/");
  if (normalized === ".." || normalized.startsWith("../") || normalized.startsWith(".")) {
    throw new Error(`Runtime reference escapes the artifact in ${fromFile}.`);
  }
  return normalized;
}

function validateHtmlReferences(file, source, inventory) {
  const references = Array.from(
    source.matchAll(/\b(?:href|src)=["']([^"']*)["']/gi),
    (match) => match[1]
  );
  for (const reference of references) {
    const local = resolveLocalReference(file, reference);
    if (local && !inventory.has(local)) {
      throw new Error(`Runtime reference is missing from the artifact: ${file} -> ${local}.`);
    }
  }
}

function validateCssReferences(file, source, inventory) {
  for (const match of source.matchAll(/url\(\s*(['"]?)([^'")]+)\1\s*\)/gi)) {
    const local = resolveLocalReference(file, match[2].trim());
    if (local && !inventory.has(local)) {
      throw new Error(`Runtime reference is missing from the artifact: ${file} -> ${local}.`);
    }
  }
}

function parseRuntimeConfiguration(source) {
  const match = source.match(
    /^window\.BETWEEN_US_ADMIN_CONFIG = Object\.freeze\((\{[\s\S]*\})\);\n$/
  );
  if (!match) throw new Error("Production runtime configuration serialization is invalid.");
  const parsed = JSON.parse(match[1]);
  if (
    JSON.stringify(Object.keys(parsed).sort())
    !== JSON.stringify(["projectRef", "publishableKey", "url"])
  ) {
    throw new Error("Production runtime configuration contains an unexpected field.");
  }
  const configuration = validateBrowserConfiguration({
    SUPABASE_URL: parsed.url,
    SUPABASE_PUBLISHABLE_KEY: parsed.publishableKey,
    SUPABASE_PROJECT_REF: parsed.projectRef
  }, { production: true });
  if (serializeBrowserConfiguration(configuration) !== source) {
    throw new Error("Production runtime configuration is not canonically serialized.");
  }
  return configuration;
}

function scanTextFile(relativePath, source, { runtimeConfiguration = false } = {}) {
  for (const [label, pattern] of [
    ["secret key prefix", /sb_secret_/i],
    ["service-role key name", /SUPABASE_SERVICE_ROLE_KEY/i],
    ["secret key name", /SUPABASE_SECRET_KEY/i],
    ["database-password name", /SUPABASE_DB_PASSWORD/i],
    ["access-token name", /SUPABASE_ACCESS_TOKEN/i],
    ["Supabase CLI access token", /sbp_[A-Za-z0-9]{16,}/],
    ["owner email literal", /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i],
    ["owner UUID literal", /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/i],
    ["private key block", /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/]
  ]) {
    if (pattern.test(source)) throw new Error(`${relativePath} contains a forbidden ${label}.`);
  }
  if (!runtimeConfiguration && /eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{16,}/.test(source)) {
    throw new Error(`${relativePath} contains an embedded JWT-shaped value.`);
  }
}

export function validatePagesArtifact() {
  const manifest = loadPagesManifest();
  const actual = listArtifact();
  const expected = manifest.files.map((entry) => entry.output);
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error("Artifact inventory differs from the tracked manifest.");
  }
  const inventory = new Set(actual);

  for (const path of actual) {
    const lower = path.toLowerCase();
    const root = lower.split("/")[0];
    if (FORBIDDEN_ROOTS.has(root) || FORBIDDEN_EXACT.has(lower)) {
      throw new Error(`Forbidden production path exists: ${path}.`);
    }
    if (
      lower.endsWith(".map")
      || lower === ".env"
      || lower.startsWith(".env.")
      || lower.split("/").some((segment) => segment.startsWith(".") && segment !== ".nojekyll")
    ) {
      throw new Error(`Forbidden production filename exists: ${path}.`);
    }
  }

  for (const entry of manifest.files) {
    const outputPath = resolve(pagesArtifactRoot, entry.output);
    if (entry.mode === "copy") {
      const source = readFileSync(resolve(pagesArtifactRoot, "../../", entry.source));
      const output = readFileSync(outputPath);
      if (!source.equals(output)) throw new Error(`Copied runtime bytes changed: ${entry.output}.`);
    }
    if (entry.mode === "production-admin-html") {
      const sourcePath = resolve(pagesArtifactRoot, "../../", entry.source);
      const expectedHtml = renderProductionAdminHtml(readFileSync(sourcePath, "utf8"));
      if (readFileSync(outputPath, "utf8") !== expectedHtml) {
        throw new Error("Production Manager HTML does not match the controlled transform.");
      }
    }
  }

  if (readFileSync(resolve(pagesArtifactRoot, ".nojekyll")).byteLength !== 0) {
    throw new Error(".nojekyll must be present and empty.");
  }

  for (const path of actual) {
    const extension = extname(path).toLowerCase();
    if (![".css", ".html", ".js", ".json", ".svg", ""].includes(extension)) continue;
    const source = readFileSync(resolve(pagesArtifactRoot, path), "utf8");
    scanTextFile(path, source, { runtimeConfiguration: path === "admin/runtime-config.js" });
    if (path.endsWith(".html")) validateHtmlReferences(path, source, inventory);
    if (path.endsWith(".css")) validateCssReferences(path, source, inventory);
  }

  const runtimeConfiguration = parseRuntimeConfiguration(
    readFileSync(resolve(pagesArtifactRoot, "admin/runtime-config.js"), "utf8")
  );
  if (!runtimeConfiguration.url.startsWith("https://")) {
    throw new Error("Production Manager configuration must use HTTPS.");
  }

  const adminHtml = readFileSync(resolve(pagesArtifactRoot, "admin/index.html"), "utf8");
  for (const required of [
    "./assets/app.js",
    "./assets/styles.css",
    "./runtime-config.js"
  ]) {
    if (!adminHtml.includes(required)) throw new Error(`Manager HTML is missing ${required}.`);
  }
  if (/sign[ -]?up|create account|password reset/i.test(adminHtml)) {
    throw new Error("Manager HTML exposes a public account flow.");
  }
  if (
    !adminHtml.includes("connect-src 'self' https://*.supabase.co wss://*.supabase.co")
    || !adminHtml.includes("img-src 'self' data: blob: https://*.supabase.co")
    || /127\.0\.0\.1|localhost|unsafe-inline|unsafe-eval/i.test(adminHtml)
  ) {
    throw new Error("Production Manager CSP is not restricted to required Supabase targets.");
  }

  const publicText = [...PUBLIC_OUTPUTS]
    .filter((path) => /\.(?:html|js|css|svg)$/.test(path))
    .map((path) => readFileSync(resolve(pagesArtifactRoot, path), "utf8"))
    .join("\n");
  for (const id of ["BU-0006", "BU-0007", "BU-0008", "BU-0009"]) {
    if (publicText.includes(id)) throw new Error(`Public artifact exposes ${id}.`);
  }
  const imageReferences = new Set(Array.from(
    publicText.matchAll(/["'](assets\/images\/[^"']+)["']/g),
    (match) => match[1]
  ));
  for (const imagePath of imageReferences) {
    if (!inventory.has(imagePath) && !KNOWN_FALLBACK_REFERENCES.has(imagePath)) {
      throw new Error(`Unexpected unresolved public image reference: ${imagePath}.`);
    }
  }
  for (const path of KNOWN_FALLBACK_REFERENCES) {
    if (inventory.has(path)) throw new Error(`Known fallback placeholder must remain absent: ${path}.`);
  }
  if (!publicText.includes("assets/brand/between-us-mark.svg")) {
    throw new Error("Accepted image fallback asset is not referenced.");
  }

  console.log(`Pages artifact validation: PASS (${actual.length} allowlisted files)`);
  return Object.freeze([...actual]);
}

async function main() {
  try {
    validatePagesArtifact();
  } catch (error) {
    console.error(`Pages artifact validation: FAIL\n- ${error.message}`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await main();
}
