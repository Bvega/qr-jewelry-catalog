import assert from "node:assert/strict";
import test from "node:test";
import {
  MAX_PASSWORD_LENGTH,
  MIN_PASSWORD_LENGTH,
  createPasswordSetup,
  validatePasswordSetup
} from "../../admin-src/password.js";

const minimumPassword = "m".repeat(MIN_PASSWORD_LENGTH);
const maximumPassword = "x".repeat(MAX_PASSWORD_LENGTH);

function createClient({ updateResults = [{ error: null }], signOutResults = [{ error: null }] } = {}) {
  const calls = { updates: [], signOut: 0, sequence: [] };
  return {
    calls,
    client: {
      auth: {
        async updateUser(arguments_) {
          calls.sequence.push("update");
          calls.updates.push(arguments_);
          const result = updateResults.shift();
          return typeof result === "function" ? result() : result;
        },
        async signOut() {
          calls.sequence.push("sign_out");
          calls.signOut += 1;
          return signOutResults.shift() || { error: null };
        }
      }
    }
  };
}

test("password validation enforces required, matching, minimum, and maximum boundaries", () => {
  assert.equal(validatePasswordSetup(minimumPassword, minimumPassword).valid, true);
  assert.equal(validatePasswordSetup(maximumPassword, maximumPassword).valid, true);
  assert.equal(validatePasswordSetup("m".repeat(MIN_PASSWORD_LENGTH - 1), "m".repeat(MIN_PASSWORD_LENGTH - 1)).valid, false);
  assert.equal(validatePasswordSetup("x".repeat(MAX_PASSWORD_LENGTH + 1), "x".repeat(MAX_PASSWORD_LENGTH + 1)).valid, false);
  assert.deepEqual(Object.keys(validatePasswordSetup("", "").errors).sort(), ["confirmation", "password"]);
  assert.match(validatePasswordSetup(minimumPassword, `${minimumPassword}!`).errors.confirmation, /do not match/i);
});

test("password values are not trimmed or otherwise altered", async () => {
  const exactPassword = "  test-only-password  ";
  const { client, calls } = createClient();
  const setup = createPasswordSetup(client, { isAuthorized: () => true });

  assert.deepEqual(await setup.submit(exactPassword, exactPassword), { ok: true });
  assert.deepEqual(calls.updates, [{ password: exactPassword }]);
});

test("password update is blocked until role authorization succeeds", async () => {
  const { client, calls } = createClient();
  const states = [];
  let clears = 0;
  const setup = createPasswordSetup(client, {
    isAuthorized: () => false,
    clearSensitiveFields: () => { clears += 1; },
    onStateChange: (state) => states.push(state)
  });

  assert.deepEqual(await setup.submit(minimumPassword, minimumPassword), {
    ok: false,
    reason: "unauthorized"
  });
  assert.equal(calls.updates.length, 0);
  assert.equal(calls.signOut, 0);
  assert.equal(clears, 1);
  assert.equal(states.at(-1).state, "authorization_error");
});

test("duplicate submit is skipped while one update is pending", async () => {
  let releaseUpdate;
  const updateWait = new Promise((resolve) => { releaseUpdate = resolve; });
  const { client, calls } = createClient({
    updateResults: [async () => {
      await updateWait;
      return { error: null };
    }]
  });
  let clears = 0;
  const setup = createPasswordSetup(client, {
    isAuthorized: () => true,
    clearSensitiveFields: () => { clears += 1; }
  });

  const first = setup.submit(minimumPassword, minimumPassword);
  await Promise.resolve();
  assert.deepEqual(await setup.submit(minimumPassword, minimumPassword), {
    ok: false,
    reason: "pending",
    skipped: true
  });
  assert.equal(calls.updates.length, 1);
  releaseUpdate();
  assert.deepEqual(await first, { ok: true });
  assert.equal(calls.signOut, 1);
  assert.equal(clears, 1);
  assert.equal(setup.pending, false);
});

test("a confirmed password update signs out before reporting success", async () => {
  const { client, calls } = createClient();
  const states = [];
  const setup = createPasswordSetup(client, {
    isAuthorized: () => true,
    onStateChange: (state) => states.push(state)
  });

  assert.deepEqual(await setup.submit(minimumPassword, minimumPassword), { ok: true });
  assert.deepEqual(calls.sequence, ["update", "sign_out"]);
  assert.deepEqual(states.map(({ state }) => state), ["updating", "signing_out", "success"]);
  assert.doesNotMatch(JSON.stringify(states), new RegExp(minimumPassword));
});

test("validation and update errors clear sensitive fields and remain recoverable", async () => {
  const { client, calls } = createClient({
    updateResults: [{ error: new Error("private provider detail") }, { error: null }]
  });
  const fields = { password: "", confirmation: "" };
  const states = [];
  const clear = () => {
    fields.password = "";
    fields.confirmation = "";
  };
  const setup = createPasswordSetup(client, {
    isAuthorized: () => true,
    clearSensitiveFields: clear,
    onStateChange: (state) => states.push(state)
  });

  fields.password = "short";
  fields.confirmation = "different";
  assert.equal((await setup.submit(fields.password, fields.confirmation)).reason, "validation");
  assert.deepEqual(fields, { password: "", confirmation: "" });

  fields.password = minimumPassword;
  fields.confirmation = minimumPassword;
  assert.equal((await setup.submit(fields.password, fields.confirmation)).reason, "update_failed");
  assert.deepEqual(fields, { password: "", confirmation: "" });
  assert.doesNotMatch(states.at(-1).message, /provider detail/i);

  fields.password = minimumPassword;
  fields.confirmation = minimumPassword;
  assert.deepEqual(await setup.submit(fields.password, fields.confirmation), { ok: true });
  assert.equal(calls.updates.length, 2);
  assert.deepEqual(fields, { password: "", confirmation: "" });
});

test("sign-out failure after update is recoverable without a second password update", async () => {
  const { client, calls } = createClient({
    signOutResults: [{ error: new Error("private sign-out detail") }, { error: null }]
  });
  const states = [];
  const setup = createPasswordSetup(client, {
    isAuthorized: () => true,
    onStateChange: (state) => states.push(state)
  });

  assert.deepEqual(await setup.submit(minimumPassword, minimumPassword), {
    ok: false,
    reason: "sign_out_failed",
    passwordUpdated: true
  });
  assert.equal(calls.updates.length, 1);
  assert.equal(states.at(-1).state, "sign_out_error");
  assert.doesNotMatch(states.at(-1).message, /private sign-out detail/i);

  assert.deepEqual(await setup.retrySignOut(), { ok: true });
  assert.equal(calls.updates.length, 1);
  assert.equal(calls.signOut, 2);
  assert.equal(states.at(-1).state, "success");
});
