#!/usr/bin/env node

import { writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

import {
  buildCatalogMigrationPlan,
  planPath,
  serializeCatalogMigrationPlan
} from "./lib/m07b3-plan.mjs";

export function prepareCatalogMigration() {
  const output = serializeCatalogMigrationPlan(buildCatalogMigrationPlan());
  writeFileSync(planPath, output, "utf8");
  return output;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    prepareCatalogMigration();
    console.log("Catalog migration plan prepared: 4 hidden Finds, 4 verified photos.");
  } catch (error) {
    console.error(`Catalog migration preparation failed: ${error.message}`);
    process.exitCode = 1;
  }
}
