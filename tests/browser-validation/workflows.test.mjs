import assert from "node:assert/strict";
import test from "node:test";
import {
  ACCEPTED_MANAGER_FINDS,
  ACCEPTED_PUBLIC_FINDS,
  ANONYMOUS_CHECKS,
  CLEANUP_CHECKS,
  FALLBACK_DECISION,
  MANAGER_CHECKS,
  authenticationCheckpoint,
  transition,
  validateManagerBaseline,
  validatePlannedActions,
  validateResultSet
} from "../../scripts/browser-validation/workflows.mjs";

test("accepted public and Manager baselines are exact and immutable", () => {
  assert.deepEqual(ACCEPTED_PUBLIC_FINDS, [
    "BU-0001", "BU-0002", "BU-0003", "BU-0004", "BU-0005"
  ]);
  assert.equal(Object.isFrozen(ACCEPTED_PUBLIC_FINDS), true);
  assert.equal(validateManagerBaseline(ACCEPTED_MANAGER_FINDS), true);
  assert.throws(() => validateManagerBaseline([
    ...ACCEPTED_MANAGER_FINDS.slice(0, 3),
    { publicId: "BU-0009", state: "Active", publication: "Published" }
  ]), /differs/i);
});

test("workflow cannot skip the human authentication checkpoint or cleanup", () => {
  let state = "created";
  state = transition(state, "begin_anonymous");
  state = transition(state, "anonymous_passed");
  assert.equal(state, "awaiting_authentication");
  assert.throws(() => transition(state, "manager_passed"), /Invalid/);
  state = transition(state, "human_ready");
  state = transition(state, "manager_passed");
  state = transition(state, "cleanup_verified");
  assert.equal(state, "complete");
});

test("result validators require every named check to pass", () => {
  for (const checks of [ANONYMOUS_CHECKS, MANAGER_CHECKS, CLEANUP_CHECKS]) {
    const passing = Object.fromEntries(checks.map((check) => [check, "PASS"]));
    assert.equal(validateResultSet(checks, passing, "fixture"), true);
    const missing = { ...passing };
    delete missing[checks[0]];
    assert.throws(() => validateResultSet(checks, missing, "fixture"), /exact/i);
  }
});

test("planned action and fallback contracts fail closed", () => {
  assert.equal(validatePlannedActions([
    "navigate_approved",
    "read_visible_text",
    "authenticate_privately",
    "terminate_session"
  ]), true);
  assert.throws(() => validatePlannedActions([
    "read_visible_text",
    "publish"
  ]), /prohibited/i);
  assert.match(FALLBACK_DECISION, /keep the page unchanged/i);
  assert.equal(authenticationCheckpoint().classification, "HUMAN_CHECKPOINT");
  assert.match(authenticationCheckpoint().instruction, /reply only READY/);
});
