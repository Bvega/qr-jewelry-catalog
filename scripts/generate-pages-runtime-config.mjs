#!/usr/bin/env node

import { existsSync, lstatSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import {
  repositoryRoot,
  serializeBrowserConfiguration,
  serializePublicBrowserConfiguration,
  validateBrowserConfiguration
} from "./generate-admin-config.mjs";

export const pagesRuntimeConfigPath = resolve(
  repositoryRoot,
  "dist/pages/admin/runtime-config.js"
);
export const pagesPublicRuntimeConfigPath = resolve(
  repositoryRoot,
  "dist/pages/runtime-config.js"
);

export function generatePagesRuntimeConfig({
  environment = process.env,
  target = "admin"
} = {}) {
  const configuration = validateBrowserConfiguration(environment, { production: true });
  if (target !== "admin" && target !== "public") {
    throw new Error("Pages runtime configuration target is invalid.");
  }
  const outputPath = target === "admin"
    ? pagesRuntimeConfigPath
    : pagesPublicRuntimeConfigPath;
  const directories = [
    resolve(repositoryRoot, "dist"),
    resolve(repositoryRoot, "dist/pages")
  ];
  if (target === "admin") directories.push(resolve(repositoryRoot, "dist/pages/admin"));
  for (const path of directories) {
    if (existsSync(path) && lstatSync(path).isSymbolicLink()) {
      throw new Error("Pages runtime configuration path cannot contain a symlink.");
    }
  }
  mkdirSync(dirname(outputPath), { recursive: true });
  if (existsSync(outputPath) && lstatSync(outputPath).isSymbolicLink()) {
    throw new Error("Pages runtime configuration path cannot contain a symlink.");
  }
  writeFileSync(
    outputPath,
    target === "admin"
      ? serializeBrowserConfiguration(configuration)
      : serializePublicBrowserConfiguration(configuration),
    { encoding: "utf8", mode: 0o644 }
  );
  return configuration;
}

async function main() {
  try {
    generatePagesRuntimeConfig({ target: process.argv.includes("--public") ? "public" : "admin" });
    console.log("Pages browser configuration generated.");
  } catch (error) {
    console.error(`Pages browser configuration failed: ${error.message}`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await main();
}
