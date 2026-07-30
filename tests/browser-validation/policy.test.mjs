import assert from "node:assert/strict";
import test from "node:test";
import {
  ACTION_CLASSES,
  APPROVED_QR_LIBRARY,
  CHECKPOINT_INSTRUCTIONS,
  PRODUCTION_CATALOG_BASE,
  PRODUCTION_MANAGER_URL,
  assertAnonymousRequest,
  assertNavigation,
  assertRedirectChain,
  classifyAction,
  pinSupabaseOrigin,
  requireAction
} from "../../scripts/browser-validation/policy.mjs";

test("navigation policy permits only exact public and Manager destinations", () => {
  assert.equal(assertNavigation(PRODUCTION_CATALOG_BASE).production, true);
  assert.equal(
    assertNavigation(`${PRODUCTION_CATALOG_BASE}find.html?id=BU-0005`).phase,
    "anonymous"
  );
  assert.equal(
    assertNavigation(`${PRODUCTION_CATALOG_BASE}find.html?slug=pearl-drop-earrings`).phase,
    "anonymous"
  );
  assert.equal(
    assertNavigation(`${PRODUCTION_CATALOG_BASE}item.html?id=1`).phase,
    "anonymous"
  );
  assert.equal(assertNavigation(PRODUCTION_MANAGER_URL, { phase: "manager" }).phase, "manager");
  assert.equal(
    assertNavigation("http://127.0.0.1:4175/find.html?id=BU-0001", {
      allowLocal: true
    }).production,
    false
  );

  for (const denied of [
    "https://example.test/",
    `${PRODUCTION_CATALOG_BASE}find.html?id=BU-0006`,
    `${PRODUCTION_CATALOG_BASE}find.html?id=BU-0001&campaign=x`,
    `${PRODUCTION_CATALOG_BASE}admin/`,
    `${PRODUCTION_CATALOG_BASE}find.html?id=BU-0001#details`,
    "http://localhost:4175/"
  ]) {
    assert.throws(
      () => assertNavigation(denied),
      /M09|allowlisted|approved|requires|fragment|protected/i
    );
  }
  assert.throws(
    () => assertNavigation(`${PRODUCTION_MANAGER_URL}?next=editor`, { phase: "manager" }),
    /query/i
  );
});

test("every redirect hop is independently validated", () => {
  assert.equal(assertRedirectChain([
    PRODUCTION_CATALOG_BASE,
    `${PRODUCTION_CATALOG_BASE}index.html`
  ]).length, 2);
  assert.throws(() => assertRedirectChain([
    PRODUCTION_CATALOG_BASE,
    "https://example.test/"
  ]), /origin/i);
});

test("anonymous service policy pins one Supabase origin and remains read-only", () => {
  const pinned = pinSupabaseOrigin("https://m09policytest123.supabase.co");
  assert.equal(pinned.evidenceAlias, "https://SUPABASE_ORIGIN");
  assert.equal(assertAnonymousRequest({
    url: `${pinned.origin}/rest/v1/finds?select=public_id`,
    method: "GET"
  }, { pinnedSupabaseOrigin: pinned }).service, "supabase");
  assert.equal(assertAnonymousRequest({
    url: APPROVED_QR_LIBRARY
  }, { pinnedSupabaseOrigin: pinned }).service, "qr-library");
  assert.throws(() => assertAnonymousRequest({
    url: `${pinned.origin}/auth/v1/token`,
    method: "POST"
  }, { pinnedSupabaseOrigin: pinned }), /read-only|outside/i);
  assert.throws(() => assertAnonymousRequest({
    url: "https://differentpolicytest.supabase.co/rest/v1/finds"
  }, { pinnedSupabaseOrigin: pinned }), /origin/i);
  assert.throws(() => pinSupabaseOrigin("http://127.0.0.1:54321"), /exact remote/i);
});

test("action classification fails closed and checkpoints stay credential-free", () => {
  assert.equal(classifyAction("read_visible_text"), ACTION_CLASSES.OBSERVE);
  assert.equal(
    classifyAction("authenticate_privately"),
    ACTION_CLASSES.HUMAN_CHECKPOINT
  );
  for (const action of ["publish", "copy_clipboard", "send_message", "unknown_action"]) {
    assert.equal(classifyAction(action), ACTION_CLASSES.PROHIBITED_WRITE);
    assert.throws(() => requireAction(action), /prohibited/i);
  }
  assert.match(CHECKPOINT_INSTRUCTIONS.authentication, /reply only READY/);
  assert.doesNotMatch(CHECKPOINT_INSTRUCTIONS.authentication, /email|password/i);
});
