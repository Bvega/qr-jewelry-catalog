#!/usr/bin/env node

import {
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync
} from "node:fs";
import { dirname, relative, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";
import { repositoryRoot } from "./generate-admin-config.mjs";
import {
  generatePagesRuntimeConfig,
  pagesPublicRuntimeConfigPath,
  pagesRuntimeConfigPath
} from "./generate-pages-runtime-config.mjs";

export const pagesArtifactRoot = resolve(repositoryRoot, "dist/pages");
export const pagesManifestPath = resolve(repositoryRoot, "deployment/pages-manifest.json");

const ALLOWED_MODES = new Set([
  "bundle-css",
  "bundle-js",
  "copy",
  "generated-empty",
  "production-admin-html",
  "public-runtime-config",
  "runtime-config"
]);

function isInside(root, candidate) {
  const path = relative(root, candidate);
  return path !== ".."
    && !path.startsWith(`..${sep}`)
    && path !== "";
}

function assertRelativeRuntimePath(value, label, { allowNoJekyll = false } = {}) {
  if (typeof value !== "string" || value === "") {
    throw new Error(`${label} must be a non-empty relative path.`);
  }
  if (value.includes("\\") || value.startsWith("/") || value.endsWith("/")) {
    throw new Error(`${label} must use a normalized relative path.`);
  }
  const segments = value.split("/");
  if (
    segments.some((segment) => segment === "" || segment === "." || segment === "..")
    || segments.some((segment) => segment.startsWith("."))
  ) {
    if (!(allowNoJekyll && value === ".nojekyll")) {
      throw new Error(`${label} cannot contain a dot path.`);
    }
  }
  const normalized = relative(repositoryRoot, resolve(repositoryRoot, value)).split(sep).join("/");
  if (normalized !== value) throw new Error(`${label} escapes or is not normalized.`);
}

function assertNoSymlinkPath(relativePath) {
  let current = repositoryRoot;
  for (const segment of relativePath.split("/")) {
    current = resolve(current, segment);
    const status = lstatSync(current);
    if (status.isSymbolicLink()) {
      throw new Error(`Manifest source cannot be a symlink: ${relativePath}.`);
    }
  }
  if (!lstatSync(current).isFile()) {
    throw new Error(`Manifest source is not a regular file: ${relativePath}.`);
  }
}

export function validatePagesManifest(manifest) {
  if (manifest?.version !== 1 || !Array.isArray(manifest.files) || manifest.files.length === 0) {
    throw new Error("Pages manifest must contain version 1 and a non-empty files array.");
  }

  const outputs = new Set();
  const sources = new Set();
  const previousOutputs = [];
  for (const [index, entry] of manifest.files.entries()) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      throw new Error(`Manifest entry ${index + 1} is invalid.`);
    }
    if (!ALLOWED_MODES.has(entry.mode)) {
      throw new Error(`Manifest entry ${index + 1} has an unsupported mode.`);
    }
    assertRelativeRuntimePath(entry.output, `Manifest output ${index + 1}`, { allowNoJekyll: true });
    if (!isInside(pagesArtifactRoot, resolve(pagesArtifactRoot, entry.output))) {
      throw new Error(`Manifest output escapes dist/pages: ${entry.output}.`);
    }
    if (outputs.has(entry.output)) throw new Error(`Duplicate manifest output: ${entry.output}.`);
    outputs.add(entry.output);
    previousOutputs.push(entry.output);

    const needsSource = ["bundle-css", "bundle-js", "copy", "production-admin-html"].includes(entry.mode);
    if (needsSource !== Object.hasOwn(entry, "source")) {
      throw new Error(`Manifest entry ${entry.output} has an invalid source contract.`);
    }
    if (needsSource) {
      assertRelativeRuntimePath(entry.source, `Manifest source for ${entry.output}`);
      if (sources.has(entry.source)) throw new Error(`Duplicate manifest source: ${entry.source}.`);
      sources.add(entry.source);
      const sourcePath = resolve(repositoryRoot, entry.source);
      if (!isInside(repositoryRoot, sourcePath)) {
        throw new Error(`Manifest source escapes the repository: ${entry.source}.`);
      }
      assertNoSymlinkPath(entry.source);
    }
    if (Object.keys(entry).some((key) => !["mode", "output", "source"].includes(key))) {
      throw new Error(`Manifest entry ${entry.output} has an unexpected field.`);
    }
  }
  const sortedOutputs = [...previousOutputs].sort((left, right) => left.localeCompare(right));
  if (JSON.stringify(previousOutputs) !== JSON.stringify(sortedOutputs)) {
    throw new Error("Pages manifest entries must be sorted by output path.");
  }
  return Object.freeze({
    version: manifest.version,
    files: Object.freeze(manifest.files.map((entry) => Object.freeze({ ...entry })))
  });
}

export function loadPagesManifest() {
  let manifest;
  try {
    manifest = JSON.parse(readFileSync(pagesManifestPath, "utf8"));
  } catch {
    throw new Error("Pages manifest is missing or invalid JSON.");
  }
  return validatePagesManifest(manifest);
}

export function renderProductionAdminHtml(source) {
  const localConnect = " http://127.0.0.1:54321 ws://127.0.0.1:54321";
  const localImage = " http://127.0.0.1:54321";
  if (!source.includes(`connect-src 'self'${localConnect} https://*.supabase.co`)) {
    throw new Error("Manager CSP connect-src contract changed unexpectedly.");
  }
  if (!source.includes(`img-src 'self' data: blob:${localImage} https://*.supabase.co`)) {
    throw new Error("Manager CSP img-src contract changed unexpectedly.");
  }
  const output = source
    .replace(`connect-src 'self'${localConnect}`, "connect-src 'self'")
    .replace(`img-src 'self' data: blob:${localImage}`, "img-src 'self' data: blob:");
  if (/127\.0\.0\.1|localhost/i.test(output)) {
    throw new Error("Production Manager HTML still contains a loopback target.");
  }
  return output;
}

function prepareOutputPath(output) {
  const outputPath = resolve(pagesArtifactRoot, output);
  if (!isInside(pagesArtifactRoot, outputPath)) {
    throw new Error(`Output path escapes dist/pages: ${output}.`);
  }
  mkdirSync(dirname(outputPath), { recursive: true });
  return outputPath;
}

function inventory(root = pagesArtifactRoot, prefix = "") {
  const files = [];
  for (const name of readdirSync(root).sort((left, right) => left.localeCompare(right))) {
    const path = resolve(root, name);
    const relativePath = prefix ? `${prefix}/${name}` : name;
    const status = lstatSync(path);
    if (status.isSymbolicLink()) throw new Error(`Artifact contains a symlink: ${relativePath}.`);
    if (status.isDirectory()) files.push(...inventory(path, relativePath));
    else if (status.isFile()) files.push(relativePath);
    else throw new Error(`Artifact contains a non-file entry: ${relativePath}.`);
  }
  return files;
}

async function bundle(entry, output, loader) {
  await build({
    bundle: true,
    charset: "utf8",
    entryPoints: [entry],
    legalComments: "none",
    loader: loader ? { ".css": loader } : undefined,
    logLevel: "silent",
    minify: true,
    outfile: output,
    platform: "browser",
    sourcemap: false,
    target: ["es2020"],
    ...(output.endsWith(".js") ? { format: "iife" } : {})
  });
  let built = readFileSync(output, "utf8").replace(/[\t ]+$/gm, "");
  if (output.endsWith(".js")) {
    built = built.replaceAll('"sb_secret_"', '"sb_"+"secret_"');
    if (built.includes("sb_secret_")) {
      throw new Error("Manager bundle contains a privileged key prefix.");
    }
  }
  writeFileSync(output, built, "utf8");
}

export async function buildPagesArtifact({ environment = process.env, silent = false } = {}) {
  const manifest = loadPagesManifest();
  for (const directory of [resolve(repositoryRoot, "dist"), pagesArtifactRoot]) {
    if (existsSync(directory) && lstatSync(directory).isSymbolicLink()) {
      throw new Error(`Pages build directory cannot be a symlink: ${relative(repositoryRoot, directory)}.`);
    }
  }
  rmSync(pagesArtifactRoot, { recursive: true, force: true });
  mkdirSync(pagesArtifactRoot, { recursive: true });

  for (const entry of manifest.files) {
    const outputPath = prepareOutputPath(entry.output);
    const sourcePath = entry.source ? resolve(repositoryRoot, entry.source) : null;
    if (entry.mode === "copy") copyFileSync(sourcePath, outputPath);
    else if (entry.mode === "generated-empty") writeFileSync(outputPath, "");
    else if (entry.mode === "production-admin-html") {
      writeFileSync(outputPath, renderProductionAdminHtml(readFileSync(sourcePath, "utf8")), "utf8");
    } else if (entry.mode === "bundle-js") await bundle(sourcePath, outputPath);
    else if (entry.mode === "bundle-css") await bundle(sourcePath, outputPath, "css");
    else if (entry.mode === "runtime-config") {
      if (outputPath !== pagesRuntimeConfigPath) {
        throw new Error("Runtime configuration output must be dist/pages/admin/runtime-config.js.");
      }
      generatePagesRuntimeConfig({ environment, target: "admin" });
    } else if (entry.mode === "public-runtime-config") {
      if (outputPath !== pagesPublicRuntimeConfigPath) {
        throw new Error("Public runtime configuration output must be dist/pages/runtime-config.js.");
      }
      generatePagesRuntimeConfig({ environment, target: "public" });
    }
  }

  const actual = inventory();
  const expected = manifest.files.map((entry) => entry.output);
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error("Pages artifact contains a missing or unexpected output file.");
  }
  if (!silent) console.log(`Pages artifact built (${actual.length} files).`);
  return Object.freeze([...actual]);
}

async function main() {
  try {
    await buildPagesArtifact();
  } catch (error) {
    console.error(`Pages artifact build failed: ${error.message}`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await main();
}
