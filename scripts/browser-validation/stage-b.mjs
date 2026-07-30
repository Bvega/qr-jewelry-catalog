import {
  ACTION_CLASSES,
  classifyAction
} from "./policy.mjs";

export const LOCAL_CANARY_PUBLIC_ID = "BU-9000";
export const LOCAL_RELATION_ANCHOR_PUBLIC_ID = "BU-0001";
export const LOCAL_CANARY_TITLE = "M09 Local Write Canary";
export const LOCAL_PUBLIC_BASELINE_COUNT = 5;
export const LOCAL_PUBLISHED_COUNT = 6;
export const EXPECTED_NEXT_PRODUCTION_ID = "BU-0010";

export const STAGE_B_CHECKPOINTS = Object.freeze({
  authentication:
    "Use the private local-only credential sheet to sign in to the localhost Manager. Do not send credentials or identifiers here. When the Manager inventory is ready, reply only LOCAL READY.",
  publication:
    "In the localhost Manager, publish only M09 Local Write Canary (BU-9000). When the confirmation completes, reply only LOCAL PUBLISHED.",
  rollback:
    "In the localhost Manager, unpublish only M09 Local Write Canary (BU-9000). When the confirmation completes, reply only LOCAL UNPUBLISHED."
});

export const STAGE_B_BASELINE_CHECKS = Object.freeze([
  "localhost-only-runtime",
  "manager-inventory-loaded",
  "canary-active-hidden-unpublished",
  "exactly-five-static-public-finds",
  "no-production-write-path"
]);

export const STAGE_B_PUBLISHED_CHECKS = Object.freeze([
  "exactly-six-public-finds",
  "canary-card",
  "canary-detail",
  "canary-photo",
  "canonical-link",
  "share-find",
  "qr-destination",
  "reserve-by-message",
  "related-finds",
  "manager-published",
  "no-browser-security-error"
]);

export const STAGE_B_ROLLBACK_CHECKS = Object.freeze([
  "exactly-five-static-public-finds",
  "canary-anonymously-inaccessible",
  "canary-database-row-preserved",
  "canary-photo-metadata-preserved",
  "canary-storage-object-preserved",
  "manager-hidden-unpublished",
  "unrelated-local-state-unchanged"
]);

export const STAGE_B_CLEANUP_CHECKS = Object.freeze([
  "isolated-browser-terminated",
  "local-account-removed",
  "local-canary-row-removed",
  "local-photo-metadata-removed",
  "local-storage-object-removed",
  "temporary-credentials-removed",
  "local-services-stopped",
  "production-next-id-BU-0010",
  "zero-production-writes"
]);

const transitions = Object.freeze({
  created: Object.freeze({ prepare_local: "preparing" }),
  preparing: Object.freeze({
    local_prepared: "awaiting_authentication",
    deviation: "stopped"
  }),
  awaiting_authentication: Object.freeze({
    human_ready: "manager_hidden",
    deviation: "stopped"
  }),
  manager_hidden: Object.freeze({
    request_publication: "awaiting_publication",
    deviation: "stopped"
  }),
  awaiting_publication: Object.freeze({
    human_published: "published",
    deviation: "stopped"
  }),
  published: Object.freeze({
    request_rollback: "awaiting_rollback",
    deviation: "stopped"
  }),
  awaiting_rollback: Object.freeze({
    human_unpublished: "rolled_back",
    deviation: "stopped"
  }),
  rolled_back: Object.freeze({
    begin_cleanup: "cleanup",
    deviation: "stopped"
  }),
  cleanup: Object.freeze({
    cleanup_verified: "complete",
    deviation: "stopped"
  }),
  stopped: Object.freeze({}),
  complete: Object.freeze({})
});

function fail(message) {
  const error = new Error(message);
  error.code = "M09_STAGE_B_DENIED";
  throw error;
}

export function transitionStageB(current, event) {
  const next = transitions[current]?.[event];
  if (!next) fail(`Invalid M09 Stage B transition: ${current} -> ${event}`);
  return next;
}

export function requireHumanWrite(action) {
  if (action !== "publish" && action !== "unpublish") {
    fail("Only local publish and unpublish are recognized Stage B write checkpoints.");
  }
  if (classifyAction(action) !== ACTION_CLASSES.PROHIBITED_WRITE) {
    fail("The Stage A policy boundary unexpectedly permits a write.");
  }
  return Object.freeze({
    action,
    classification: ACTION_CLASSES.HUMAN_CHECKPOINT,
    actor: "human",
    target: LOCAL_CANARY_PUBLIC_ID
  });
}

export function validateLocalCanary(row, { published }) {
  if (
    !row ||
    row.publicId !== LOCAL_CANARY_PUBLIC_ID ||
    row.title !== LOCAL_CANARY_TITLE ||
    row.active !== true ||
    row.archived !== false ||
    row.published !== Boolean(published) ||
    row.hasPhoto !== true
  ) {
    fail("The disposable local canary differs from the exact expected state.");
  }
  return true;
}

export function validatePublicCount(count, { published }) {
  const expected = published ? LOCAL_PUBLISHED_COUNT : LOCAL_PUBLIC_BASELINE_COUNT;
  if (count !== expected) {
    fail(`The local public catalog count must be exactly ${expected}.`);
  }
  return true;
}

export function validateSequenceProof({
  localLastValue,
  localIsCalled,
  productionNextId
}) {
  if (
    localLastValue !== 9 ||
    localIsCalled !== true ||
    productionNextId !== EXPECTED_NEXT_PRODUCTION_ID
  ) {
    fail("The public-ID sequence proof does not preserve BU-0010.");
  }
  return true;
}

export function validateResultSet(expected, results, label) {
  const keys = Object.keys(results || {}).sort();
  const expectedKeys = [...expected].sort();
  if (
    keys.length !== expectedKeys.length ||
    keys.some((key, index) => key !== expectedKeys[index])
  ) {
    fail(`${label} results do not cover the exact Stage B checks.`);
  }
  if (keys.some((key) => results[key] !== "PASS")) {
    fail(`${label} contains a non-passing Stage B check.`);
  }
  return true;
}
