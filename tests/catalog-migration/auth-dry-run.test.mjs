import assert from "node:assert/strict";
import test from "node:test";

import { createMigrationAuthManager, isMigrationOwnerRole } from "../../admin-src/migration-auth.js";
import { createExecutionGate, performDryRun } from "../../admin-src/migration-executor.js";
import { verifyPhotoBlob } from "../../admin-src/migration-plan.js";
import { createMockClient, loadVerifiedPlan } from "./mock-client.mjs";

const verified = loadVerifiedPlan();

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
