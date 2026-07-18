#!/usr/bin/env node

import {
  formatDiagnostic,
  parseIntakeArguments,
  resolveIntakeInputs,
  validateContentIntake
} from "./lib/content-intake.mjs";

const { options, errors: argumentErrors } = parseIntakeArguments(process.argv.slice(2));

if (options.help) {
  console.log("Usage: node scripts/validate-content-intake.mjs [--finds path] [--photos path]");
  process.exit(0);
}

const inputs = resolveIntakeInputs(options);
const preflightErrors = [...argumentErrors, ...inputs.errors];

if (preflightErrors.length > 0) {
  console.log("Content intake validation: FAIL");
  console.log(`Errors (${preflightErrors.length})`);
  for (const error of preflightErrors) console.log(`- ${error}`);
  process.exitCode = 1;
} else {
  const result = validateContentIntake({
    findsPath: inputs.findsPath,
    photosPath: inputs.photosPath
  });

  console.log(`Content intake validation: ${result.valid ? "PASS" : "FAIL"}`);
  if (!inputs.ownerPresent) console.log("Owner intake is not yet present; tracked examples were validated.");

  if (result.errors.length > 0) {
    console.log(`Errors (${result.errors.length})`);
    for (const error of result.errors) console.log(`- ${formatDiagnostic(error)}`);
  }

  if (result.warnings.length > 0) {
    console.log(`Warnings (${result.warnings.length})`);
    for (const warning of result.warnings) console.log(`- ${formatDiagnostic(warning)}`);
  }

  if (!result.valid) process.exitCode = 1;
}
