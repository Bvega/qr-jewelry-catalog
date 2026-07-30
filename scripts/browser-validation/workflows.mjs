import {
  ACTION_CLASSES,
  CHECKPOINT_INSTRUCTIONS,
  classifyAction
} from "./policy.mjs";

export const ACCEPTED_PUBLIC_FINDS = Object.freeze([
  "BU-0001",
  "BU-0002",
  "BU-0003",
  "BU-0004",
  "BU-0005"
]);

export const ACCEPTED_MANAGER_FINDS = Object.freeze([
  Object.freeze({ publicId: "BU-0006", state: "Active", publication: "Hidden" }),
  Object.freeze({ publicId: "BU-0007", state: "Active", publication: "Hidden" }),
  Object.freeze({ publicId: "BU-0008", state: "Active", publication: "Hidden" }),
  Object.freeze({ publicId: "BU-0009", state: "Active", publication: "Hidden" })
]);

export const ANONYMOUS_CHECKS = Object.freeze([
  "home-rendered",
  "exactly-five-public-finds",
  "collection-filtering",
  "find-detail",
  "gallery-primary-photo",
  "canonical-link",
  "share-ui-present-no-completion",
  "qr-present-and-canonical-destination",
  "reserve-ui-present-no-send",
  "related-finds",
  "static-fallback",
  "console-allowlist",
  "network-allowlist"
]);

export const MANAGER_CHECKS = Object.freeze([
  "private-human-authentication",
  "authorized-manager-ready",
  "BU-0006-active-hidden-unpublished",
  "BU-0007-active-hidden-unpublished",
  "BU-0008-active-hidden-unpublished",
  "BU-0009-active-hidden-unpublished",
  "no-editor-opened",
  "no-write-control-activated",
  "no-authenticated-capture"
]);

export const CLEANUP_CHECKS = Object.freeze([
  "isolated-browser-terminated",
  "session-not-exported",
  "authenticated-evidence-not-retained",
  "raw-temporary-evidence-removed",
  "sanitized-evidence-validated",
  "production-state-unchanged"
]);

export const FALLBACK_DECISION =
  "Stop agent control, keep the page unchanged, and continue the same checklist manually in a fresh private browser only after the deviation is understood.";

const transitions = Object.freeze({
  created: Object.freeze({ begin_anonymous: "anonymous" }),
  anonymous: Object.freeze({
    anonymous_passed: "awaiting_authentication",
    deviation: "stopped"
  }),
  awaiting_authentication: Object.freeze({
    human_ready: "manager_read_only",
    deviation: "stopped"
  }),
  manager_read_only: Object.freeze({
    manager_passed: "cleanup",
    deviation: "stopped"
  }),
  cleanup: Object.freeze({
    cleanup_verified: "complete",
    deviation: "stopped"
  }),
  stopped: Object.freeze({}),
  complete: Object.freeze({})
});

export function transition(current, event) {
  const next = transitions[current]?.[event];
  if (!next) throw new Error(`Invalid M09 workflow transition: ${current} -> ${event}`);
  return next;
}

export function validateResultSet(expected, results, label) {
  const keys = Object.keys(results || {}).sort();
  const expectedKeys = [...expected].sort();
  if (
    keys.length !== expectedKeys.length ||
    keys.some((key, index) => key !== expectedKeys[index])
  ) {
    throw new Error(`${label} results do not cover the exact required checks.`);
  }
  const failures = keys.filter((key) => results[key] !== "PASS");
  if (failures.length > 0) {
    throw new Error(`${label} contains non-passing checks: ${failures.join(", ")}`);
  }
  return true;
}

export function validateManagerBaseline(rows) {
  const normalized = [...rows]
    .map(({ publicId, state, publication }) => ({ publicId, state, publication }))
    .sort((left, right) => left.publicId.localeCompare(right.publicId));
  if (JSON.stringify(normalized) !== JSON.stringify(ACCEPTED_MANAGER_FINDS)) {
    throw new Error("Manager inventory differs from the accepted hidden/unpublished baseline.");
  }
  return true;
}

export function validatePlannedActions(actions) {
  const prohibited = actions.filter(
    (action) => classifyAction(action) === ACTION_CLASSES.PROHIBITED_WRITE
  );
  if (prohibited.length > 0) {
    throw new Error(`Workflow contains prohibited actions: ${prohibited.join(", ")}`);
  }
  return true;
}

export function authenticationCheckpoint() {
  return Object.freeze({
    action: "authenticate_privately",
    classification: classifyAction("authenticate_privately"),
    instruction: CHECKPOINT_INSTRUCTIONS.authentication
  });
}
