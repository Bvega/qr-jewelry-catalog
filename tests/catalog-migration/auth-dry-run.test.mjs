import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

import { createMigrationAuthManager, isMigrationOwnerRole } from "../../admin-src/migration-auth.js";
import { createExecutionGate, performDryRun, prepareFreshDryRun } from "../../admin-src/migration-executor.js";
import {
  MAINTENANCE_SOURCE_PREFIX,
  MIGRATION_PLAN_URL,
  loadAndVerifyMigrationSources,
  verifyPhotoBlob
} from "../../admin-src/migration-plan.js";
import { createMockClient, loadVerifiedPlan } from "./mock-client.mjs";

const verified = loadVerifiedPlan();
const root = resolve(import.meta.dirname, "../..");

const protectedSourcePaths = new Map([
  [MIGRATION_PLAN_URL, "migration/m07b3-catalog-plan.json"],
  [`${MAINTENANCE_SOURCE_PREFIX}/finds.csv`, "content-intake/finds.csv"],
  [`${MAINTENANCE_SOURCE_PREFIX}/photo-manifest.csv`, "content-intake/photo-manifest.csv"],
  [`${MAINTENANCE_SOURCE_PREFIX}/collections.js`, "data/collections.js"],
  [`${MAINTENANCE_SOURCE_PREFIX}/identifier-registry.md`, "docs/IDENTIFIER_REGISTRY.md"],
  ...verified.plan.finds.map((find) => [
    `${MAINTENANCE_SOURCE_PREFIX}/photos/${encodeURIComponent(find.photo.filename)}`,
    `content-intake/photos/${find.photo.filename}`
  ])
]);

function localProtectedFetch({ mutate } = {}) {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    const relativePath = protectedSourcePaths.get(url);
    if (!relativePath) return new Response("Not found", { status: 404 });
    let bytes = readFileSync(resolve(root, relativePath));
    if (mutate) bytes = mutate({ url, relativePath, bytes, call: calls.length }) || bytes;
    return new Response(bytes, { status: 200 });
  };
  return { calls, fetchImpl };
}

function authClient(role) {
  const calls = { signOut: 0 };
  return {
    calls,
    rpc: async () => ({ data: role, error: null }),
    auth: {
      signOut: async () => { calls.signOut += 1; return { error: null }; },
      signInWithPassword: async ({ email }) => ({ data: { session: { user: { email } } }, error: null }),
      getSession: async () => ({ data: { session: null }, error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } })
    }
  };
}

test("only exact owner authorization unlocks migration and editor is signed out", async () => {
  assert.equal(isMigrationOwnerRole("owner"), true);
  for (const role of ["editor", null, "Owner", "administrator"]) assert.equal(isMigrationOwnerRole(role), false);
  const client = authClient("editor");
  const manager = createMigrationAuthManager(client);
  assert.deepEqual(await manager.gateSession({ user: {} }), { allowed: false, reason: "denied" });
  assert.equal(client.calls.signOut, 1);
});

test("authentication alone is insufficient and dry-run performs no writes", async () => {
  const unauthorized = createMockClient({ role: "editor" });
  const denied = await performDryRun({ client: unauthorized, verified, clock: () => 1 });
  assert.equal(denied.ready, false);

  const client = createMockClient({ collections: verified.plan.collections });
  const result = await performDryRun({ client, verified, clock: () => 10 });
  assert.equal(result.ready, true);
  assert.equal(result.writes, 0);
  assert.equal(client.calls.writes, 0);
  assert.ok(result.records.every((record) => record.state === "absent"));
});

test("confirmation and current dry-run are both required", () => {
  let now = 100;
  const gate = createExecutionGate({ clock: () => now, maxAgeMs: 50 });
  gate.setDryRun({ ready: true, all_complete: false, created_at_ms: 100 });
  assert.equal(gate.canExecute({ checked: false, phrase: "IMPORT 4 FINDS" }), false);
  assert.equal(gate.canExecute({ checked: true, phrase: "import 4 finds" }), false);
  assert.equal(gate.canExecute({ checked: true, phrase: "IMPORT 4 FINDS" }), true);
  now = 151;
  assert.equal(gate.canExecute({ checked: true, phrase: "IMPORT 4 FINDS" }), false);
});

test("missing or wrong photo bytes block image verification", async () => {
  const planned = verified.plan.finds[0];
  await assert.rejects(() => verifyPhotoBlob(new Blob([new Uint8Array([1, 2, 3])]), planned.photo));
});

test("every dry-run freshly reloads and verifies every protected source", async () => {
  const token = "fictional.owner.access-token";
  const { calls, fetchImpl } = localProtectedFetch();
  const client = createMockClient({ collections: verified.plan.collections });
  const loadSources = () => loadAndVerifyMigrationSources({ fetchImpl, accessToken: token });

  const first = await prepareFreshDryRun({ client, loadSources, clock: () => 10 });
  const second = await prepareFreshDryRun({ client, loadSources, clock: () => 20 });
  assert.equal(first.dryRun.ready, true);
  assert.equal(second.dryRun.ready, true);
  assert.equal(calls.length, protectedSourcePaths.size * 2);
  for (const url of protectedSourcePaths.keys()) {
    assert.equal(calls.filter((call) => call.url === url).length, 2, url);
  }
  assert.equal(calls.every((call) => call.options.cache === "no-store"), true);
  assert.equal(calls.every((call) => call.options.headers.authorization === `Bearer ${token}`), true);
});

test("a later dry-run catches source and photo drift instead of using verified memory", async () => {
  const token = "fictional.owner.access-token";
  let generation = 1;
  const driftingPhotoUrl = `${MAINTENANCE_SOURCE_PREFIX}/photos/${encodeURIComponent(verified.plan.finds[0].photo.filename)}`;
  const { fetchImpl } = localProtectedFetch({
    mutate: ({ url, bytes }) => generation === 2 && url === driftingPhotoUrl
      ? Buffer.concat([bytes, Buffer.from([0])])
      : bytes
  });
  const client = createMockClient({ collections: verified.plan.collections });
  const loadSources = () => loadAndVerifyMigrationSources({ fetchImpl, accessToken: token });

  await prepareFreshDryRun({ client, loadSources, clock: () => 10 });
  generation = 2;
  await assert.rejects(
    () => prepareFreshDryRun({ client, loadSources, clock: () => 20 }),
    /local photo verification failed/i
  );
  assert.equal(client.calls.writes, 0);
});
