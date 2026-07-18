#!/usr/bin/env node

import {
  parseIntakeArguments,
  resolveIntakeInputs,
  summarizeContentIntake,
  validateContentIntake
} from "./lib/content-intake.mjs";

const { options, errors: argumentErrors } = parseIntakeArguments(process.argv.slice(2));

if (options.help) {
  console.log("Usage: node scripts/summarize-content-intake.mjs [--finds path] [--photos path]");
  process.exit(0);
}

const inputs = resolveIntakeInputs(options);
const preflightErrors = [...argumentErrors, ...inputs.errors];

if (preflightErrors.length > 0) {
  console.error("Content intake summary: FAIL");
  for (const error of preflightErrors) console.error(`- ${error}`);
  process.exitCode = 1;
} else if (!inputs.ownerPresent) {
  console.log("No owner intake file is present yet.");
} else {
  const validation = validateContentIntake({
    findsPath: inputs.findsPath,
    photosPath: inputs.photosPath
  });
  const summary = summarizeContentIntake(validation);

  console.log("Content intake summary");
  console.log(`Proposed Finds: ${summary.proposedFindCount}`);
  console.log("By Collection:");
  for (const [collection, count] of summary.byCollection) console.log(`- ${collection}: ${count}`);
  console.log("By availability:");
  for (const [availability, count] of summary.byAvailability) console.log(`- ${availability}: ${count}`);
  console.log(`Missing condition: ${summary.missingCondition}`);
  console.log(`Missing or unapproved photos: ${summary.missingOrUnapprovedPhotos}`);
  console.log(`Unresolved relationships: ${summary.unresolvedRelationships}`);
  console.log(`Ready for review: ${summary.readyForReview}`);
  console.log(`Blocked: ${summary.blocked}`);

  if (!validation.valid) process.exitCode = 1;
}
