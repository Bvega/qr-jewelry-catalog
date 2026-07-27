#!/usr/bin/env node

import { existsSync, lstatSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import {
  repositoryRoot,
  serializeBrowserConfiguration,
  validateBrowserConfiguration
} from "./generate-admin-config.mjs";

export const pagesRuntimeConfigPath = resolve(
  repositoryRoot,
  "dist/pages/admin/runtime-config.js"
);

export function generatePagesRuntimeConfig({ environment = process.env } = {}) {
  const configuration = validateBrowserConfiguration(environment, { production: true });
  const directories = [
    resolve(repositoryRoot, "dist"),
    resolve(repositoryRoot, "dist/pages"),
    resolve(repositoryRoot, "dist/pages/admin")
  ];
  for (const path of directories) {
    if (existsSync(path) && lstatSync(path).isSymbolicLink()) {
      throw new Error("Pages runtime configuration path cannot contain a symlink.");
    }
  }
  mkdirSync(dirname(pagesRuntimeConfigPath), { recursive: true });
  if (existsSync(pagesRuntimeConfigPath) && lstatSync(pagesRuntimeConfigPath).isSymbolicLink()) {
    throw new Error("Pages runtime configuration path cannot contain a symlink.");
  }
  writeFileSync(
    pagesRuntimeConfigPath,
    serializeBrowserConfiguration(configuration),
    { encoding: "utf8", mode: 0o644 }
  );
  return configuration;
}

async function main() {
  try {
    generatePagesRuntimeConfig();
    console.log("Pages browser configuration generated.");
  } catch (error) {
    console.error(`Pages browser configuration failed: ${error.message}`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await main();
}
