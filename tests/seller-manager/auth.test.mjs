import assert from "node:assert/strict";
import test from "node:test";
import { createAuthManager, isCatalogAdminRole } from "../../admin-src/auth.js";

function createClient({ role = null, signInError = null } = {}) {
  const calls = { signOut: 0, signInArguments: null };
  const client = {
    rpc: async (name) => {
      assert.equal(name, "current_catalog_admin_role");
      return { data: role, error: null };
    },
    auth: {
      getSession: async () => ({ data: { session: null }, error: null }),
      signInWithPassword: async (arguments_) => {
        calls.signInArguments = arguments_;
        return signInError
          ? { data: { session: null }, error: signInError }
          : { data: { session: { user: { email: arguments_.email } } }, error: null };
      },
      signOut: async () => {
        calls.signOut += 1;
        return { error: null };
      },
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } })
    }
  };
  return { client, calls };
}

test("only the exact owner and editor roles satisfy the shared admin predicate", () => {
  assert.equal(isCatalogAdminRole("owner"), true);
  assert.equal(isCatalogAdminRole("editor"), true);
  for (const role of [null, "", "viewer", "Owner", "administrator"]) {
    assert.equal(isCatalogAdminRole(role), false, String(role));
  }
});

test("authentication alone does not unlock an unallowlisted account", async () => {
  const { client, calls } = createClient({ role: null });
  const states = [];
  const manager = createAuthManager(client, (state) => states.push(state));
  const result = await manager.gateSession({ user: { email: "visitor@example.test" } });

  assert.deepEqual(result, { allowed: false, reason: "denied" });
  assert.equal(calls.signOut, 1);
  assert.deepEqual(states.map(({ state }) => state), ["checking_access", "denied"]);
  assert.doesNotMatch(states.at(-1).message, /owner|editor|allowlist/i);
});

test("owner and editor roles pass the authenticated role gate", async () => {
  for (const role of ["owner", "editor"]) {
    const { client, calls } = createClient({ role });
    const states = [];
    const manager = createAuthManager(client, (state) => states.push(state));
    assert.deepEqual(await manager.gateSession({ user: { email: `${role}@example.test` } }), {
      allowed: true,
      role
    });
    assert.equal(calls.signOut, 0);
    assert.equal(states.at(-1).state, "authorized");
    assert.equal(states.at(-1).role, role);
  }
});

test("sign-in uses email/password auth and reports invalid credentials neutrally", async () => {
  const { client, calls } = createClient({ signInError: new Error("provider detail") });
  const states = [];
  const manager = createAuthManager(client, (state) => states.push(state));
  const result = await manager.signIn("  seller@example.test ", "test-only-password");

  assert.deepEqual(calls.signInArguments, {
    email: "seller@example.test",
    password: "test-only-password"
  });
  assert.deepEqual(result, { allowed: false, reason: "invalid_credentials" });
  assert.equal(states.at(-1).state, "signed_out");
  assert.doesNotMatch(states.at(-1).message, /provider detail|allowlist|role/i);
});

test("start restores the existing session and subscribes to auth changes", async () => {
  const { client } = createClient({ role: "owner" });
  let subscribed = false;
  client.auth.getSession = async () => ({
    data: { session: { user: { email: "restored@example.test" } } },
    error: null
  });
  client.auth.onAuthStateChange = () => {
    subscribed = true;
    return { data: { subscription: { unsubscribe() {} } } };
  };
  const states = [];
  const manager = createAuthManager(client, (state) => states.push(state.state));
  await manager.start();
  assert.deepEqual(states, ["restoring", "checking_access", "authorized"]);
  assert.equal(subscribed, true);
});
