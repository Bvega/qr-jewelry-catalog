#!/usr/bin/env node

import { build } from "esbuild";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const appOutput = resolve(repositoryRoot, "admin/assets/app.js");
const stylesOutput = resolve(repositoryRoot, "admin/assets/styles.css");

const sharedOptions = {
  bundle: true,
  charset: "utf8",
  legalComments: "none",
  logLevel: "info",
  minify: true,
  sourcemap: false,
  target: ["es2020"]
};

await build({
  ...sharedOptions,
  entryPoints: [resolve(repositoryRoot, "admin-src/app.js")],
  format: "iife",
  outfile: appOutput,
  platform: "browser"
});

await build({
  ...sharedOptions,
  entryPoints: [resolve(repositoryRoot, "admin-src/styles.css")],
  outfile: stylesOutput
});

for (const outputFile of [appOutput, stylesOutput]) {
  const output = await readFile(outputFile, "utf8");
  await writeFile(outputFile, output.replace(/[\t ]+$/gm, ""), "utf8");
}

console.log("Seller Manager assets built.");
