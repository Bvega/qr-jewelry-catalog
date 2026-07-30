import assert from "node:assert/strict";
import test from "node:test";
import { validateEvidence } from "../../scripts/browser-validation/validate-evidence.mjs";

test("retained Stage A evidence is minimal, sanitized, and internally complete", () => {
  assert.equal(validateEvidence(), true);
});
