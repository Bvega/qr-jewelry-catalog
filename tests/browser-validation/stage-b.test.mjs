import assert from "node:assert/strict";
import test from "node:test";
import {
  LOCAL_SUPABASE_ORIGIN,
  PRODUCTION_CATALOG_BASE,
  assertLocalRequest
} from "../../scripts/browser-validation/policy.mjs";
import {
  EXPECTED_NEXT_PRODUCTION_ID,
  LOCAL_CANARY_PUBLIC_ID,
  LOCAL_CANARY_TITLE,
  STAGE_B_CHECKPOINTS,
  requireHumanWrite,
  transitionStageB,
  validateLocalCanary,
  validatePublicCount,
  validateSequenceProof
} from "../../scripts/browser-validation/stage-b.mjs";

test("all Stage B write-capable browser requests terminate on exact loopback", () => {
  for (const request of [
    { url: `${LOCAL_SUPABASE_ORIGIN}/auth/v1/token?grant_type=password`, method: "POST" },
    { url: `${LOCAL_SUPABASE_ORIGIN}/rest/v1/finds?id=eq.fixture`, method: "PATCH" },
    { url: `${LOCAL_SUPABASE_ORIGIN}/auth/v1/logout`, method: "POST" }
  ]) {
    const accepted = assertLocalRequest(request, { phase: "manager" });
    assert.equal(accepted.writeCapable, true);
    assert.equal(accepted.humanOnly, true);
  }

  for (const denied of [
    { url: `${PRODUCTION_CATALOG_BASE}rest/v1/finds`, method: "PATCH" },
    { url: "https://m09fictionaltest.supabase.co/rest/v1/finds", method: "PATCH" },
    { url: `${LOCAL_SUPABASE_ORIGIN}/rest/v1/find_photos`, method: "POST" },
    { url: `${LOCAL_SUPABASE_ORIGIN}/storage/v1/object/find-images/fixture`, method: "DELETE" }
  ]) {
    assert.throws(
      () => assertLocalRequest(denied, { phase: "manager" }),
      /loopback|boundary/i
    );
  }
});

test("anonymous Stage B requests remain local and read-only", () => {
  assert.equal(assertLocalRequest({
    url: `${LOCAL_SUPABASE_ORIGIN}/rest/v1/finds?select=public_id`,
    method: "GET"
  }).writeCapable, false);
  assert.throws(() => assertLocalRequest({
    url: `${LOCAL_SUPABASE_ORIGIN}/rest/v1/finds`,
    method: "POST"
  }), /read-only/i);
});

test("publish and rollback remain exact human checkpoints", () => {
  assert.deepEqual(requireHumanWrite("publish"), {
    action: "publish",
    classification: "HUMAN_CHECKPOINT",
    actor: "human",
    target: LOCAL_CANARY_PUBLIC_ID
  });
  assert.deepEqual(requireHumanWrite("unpublish"), {
    action: "unpublish",
    classification: "HUMAN_CHECKPOINT",
    actor: "human",
    target: LOCAL_CANARY_PUBLIC_ID
  });
  assert.throws(() => requireHumanWrite("edit"), /Only local publish/i);
  assert.match(STAGE_B_CHECKPOINTS.authentication, /reply only LOCAL READY/);
  assert.match(STAGE_B_CHECKPOINTS.publication, /reply only LOCAL PUBLISHED/);
  assert.match(STAGE_B_CHECKPOINTS.rollback, /reply only LOCAL UNPUBLISHED/);
});

test("Stage B cannot skip authentication, publication, rollback, or cleanup", () => {
  let state = "created";
  state = transitionStageB(state, "prepare_local");
  state = transitionStageB(state, "local_prepared");
  assert.throws(() => transitionStageB(state, "human_published"), /Invalid/i);
  state = transitionStageB(state, "human_ready");
  state = transitionStageB(state, "request_publication");
  state = transitionStageB(state, "human_published");
  state = transitionStageB(state, "request_rollback");
  state = transitionStageB(state, "human_unpublished");
  state = transitionStageB(state, "begin_cleanup");
  state = transitionStageB(state, "cleanup_verified");
  assert.equal(state, "complete");
});

test("fixture, count, and sequence contracts preserve production BU-0010", () => {
  assert.equal(validateLocalCanary({
    publicId: LOCAL_CANARY_PUBLIC_ID,
    title: LOCAL_CANARY_TITLE,
    active: true,
    archived: false,
    published: false,
    hasPhoto: true
  }, { published: false }), true);
  assert.equal(validatePublicCount(5, { published: false }), true);
  assert.equal(validatePublicCount(6, { published: true }), true);
  assert.equal(validateSequenceProof({
    localLastValue: 9,
    localIsCalled: true,
    productionNextId: EXPECTED_NEXT_PRODUCTION_ID
  }), true);
  assert.throws(() => validateSequenceProof({
    localLastValue: 10,
    localIsCalled: true,
    productionNextId: EXPECTED_NEXT_PRODUCTION_ID
  }), /BU-0010/i);
});
