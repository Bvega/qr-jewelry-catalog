import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import {
  ACTIVATION_AUTH_STORAGE_KEY,
  activationConfigurationIsUsable,
  captureInitialInviteContext,
  createActivationAuthStorage,
  createActivationSessionManager,
  scrubInvitationAddress,
  startActivationPage
} from "../../admin-src/activation.js";
import { createPasswordSetup } from "../../admin-src/password.js";

const root = resolve(import.meta.dirname, "../..");
const activationHtml = readFileSync(resolve(root, "admin/activate.html"), "utf8");
const validConfiguration = {
  url: "https://fictional-project.supabase.co",
  publishableKey: "fictional-publishable-key",
  projectRef: "fictional-project"
};

function createDocumentRoot() {
  const elements = new Map();
  const listeners = new Map();
  return {
    elements,
    listeners,
    documentRoot: {
      getElementById(id) {
        if (!elements.has(id)) {
          elements.set(id, {
            dataset: {},
            hidden: false,
            disabled: false,
            textContent: "",
            value: "",
            addEventListener(type, listener) {
              listeners.set(`${id}:${type}`, listener);
            },
            removeAttribute() {},
            setAttribute() {},
            setCustomValidity() {},
            focus() {}
          });
        }
        return elements.get(id);
      }
    }
  };
}

function createClient({
  session = null,
  role = null,
  roleError = null,
  sessionError = null,
  signOutError = null,
  rpcWait = null
} = {}) {
  const calls = { getSession: 0, subscriptions: 0, rpc: 0, signOut: 0, updateUser: 0 };
  let authCallback = null;
  const client = {
    rpc: async (name) => {
      calls.rpc += 1;
      assert.equal(name, "current_catalog_admin_role");
      if (rpcWait) await rpcWait;
      return { data: role, error: roleError };
    },
    auth: {
      getSession: async () => {
        calls.getSession += 1;
        return { data: { session }, error: sessionError };
      },
      signOut: async () => {
        calls.signOut += 1;
        return { error: signOutError };
      },
      updateUser: async () => {
        calls.updateUser += 1;
        return { error: null };
      },
      onAuthStateChange(callback) {
        calls.subscriptions += 1;
        authCallback = callback;
        return { data: { subscription: { unsubscribe() {} } } };
      }
    }
  };
  return {
    client,
    calls,
    emitAuth(event, nextSession) {
      authCallback?.(event, nextSession);
    }
  };
}

test("activation configuration accepts only a complete HTTPS browser configuration", () => {
  assert.equal(activationConfigurationIsUsable(validConfiguration), true);
  assert.equal(activationConfigurationIsUsable(null), false);
  assert.equal(activationConfigurationIsUsable({ ...validConfiguration, url: "http://fictional-project.supabase.co" }), false);
  assert.equal(activationConfigurationIsUsable({ ...validConfiguration, publishableKey: "" }), false);
  assert.equal(activationConfigurationIsUsable({ ...validConfiguration, projectRef: "" }), false);
});

test("initial invitation context accepts only one exact invite flow type from query or hash", () => {
  assert.equal(captureInitialInviteContext({ search: "?type=invite", hash: "" }), true);
  assert.equal(captureInitialInviteContext({ search: "", hash: "#type=invite" }), true);

  for (const locationObject of [
    { search: "", hash: "" },
    { search: "?type=recovery", hash: "" },
    { search: "?type=signup", hash: "" },
    { search: "?type=magiclink", hash: "" },
    { search: "?type=Invite", hash: "" },
    { search: "?type=invite-extra", hash: "" },
    { search: "?notype=invite", hash: "" },
    { search: "?redirect_to=https://example.test/?type=invite", hash: "" },
    { search: "", hash: "#next=?type=invite" },
    { search: "?type=invite&type=invite", hash: "" },
    { search: "?type=invite", hash: "#type=recovery" }
  ]) assert.equal(captureInitialInviteContext(locationObject), false, JSON.stringify(locationObject));
});

test("missing invite context is rejected before the Supabase client is created", () => {
  const elements = new Map();
  const documentRoot = {
    getElementById(id) {
      if (!elements.has(id)) {
        elements.set(id, {
          dataset: {},
          hidden: false,
          disabled: false,
          textContent: "",
          value: "",
          removeAttribute() {},
          setAttribute() {},
          setCustomValidity() {},
          focus() {}
        });
      }
      return elements.get(id);
    }
  };
  let clientCreations = 0;
  const result = startActivationPage({
    configuration: validConfiguration,
    documentRoot,
    initialInviteContext: false,
    clientFactory() {
      clientCreations += 1;
      return {};
    }
  });

  assert.equal(result, null);
  assert.equal(clientCreations, 0);
  assert.equal(elements.get("invitationInvalidSection").hidden, false);
  assert.match(elements.get("activationStatus").textContent, /invalid, expired, or missing/i);
});

test("activation client uses fresh isolated nonpersistent Auth storage with URL detection", async () => {
  const { documentRoot } = createDocumentRoot();
  const { client, calls } = createClient();
  let activationAuth;
  const page = startActivationPage({
    configuration: validConfiguration,
    documentRoot,
    initialInviteContext: true,
    clientFactory(url, publishableKey, options) {
      assert.equal(url, validConfiguration.url);
      assert.equal(publishableKey, validConfiguration.publishableKey);
      activationAuth = options.auth;
      return client;
    }
  });

  assert.deepEqual(await page.activation.start(), { allowed: false, reason: "missing_session" });
  assert.equal(activationAuth.persistSession, false);
  assert.equal(activationAuth.detectSessionInUrl, true);
  assert.equal(activationAuth.storageKey, ACTIVATION_AUTH_STORAGE_KEY);
  assert.equal(activationAuth.storage.getItem(ACTIVATION_AUTH_STORAGE_KEY), null);
  assert.equal(calls.rpc, 0);
  assert.equal(calls.updateUser, 0);
});

test("activation Auth storage is initially empty, memory-only, and independent per client", () => {
  const first = createActivationAuthStorage();
  const second = createActivationAuthStorage();

  assert.equal(first.getItem("test-only-key"), null);
  assert.equal(second.getItem("test-only-key"), null);
  first.setItem("test-only-key", "test-only-value");
  assert.equal(first.getItem("test-only-key"), "test-only-value");
  assert.equal(second.getItem("test-only-key"), null);
  first.removeItem("test-only-key");
  assert.equal(first.getItem("test-only-key"), null);
});

test("forged or invalid invite markers cannot reuse shared owner or editor sessions", async () => {
  const cases = [
    { role: "owner", locationObject: { search: "", hash: "#type=invite" }, sessionError: null },
    { role: "editor", locationObject: { search: "?type=invite", hash: "" }, sessionError: null },
    { role: "owner", locationObject: { search: "?type=invite", hash: "" }, sessionError: new Error("expired") }
  ];

  for (const { role, locationObject, sessionError } of cases) {
    const { documentRoot } = createDocumentRoot();
    const persistedManagerSession = { user: { id: `fictional-persisted-${role}` } };
    let sharedStorageReads = 0;
    const sharedManagerStorage = {
      getItem() {
        sharedStorageReads += 1;
        return persistedManagerSession;
      }
    };
    let harness;

    const page = startActivationPage({
      configuration: validConfiguration,
      documentRoot,
      initialInviteContext: captureInitialInviteContext(locationObject),
      clientFactory(_url, _publishableKey, options) {
        const initialSession = options.auth.persistSession
          ? sharedManagerStorage.getItem()
          : options.auth.storage.getItem(options.auth.storageKey);
        harness = createClient({ session: initialSession, role, sessionError });
        return harness.client;
      }
    });

    const activationResult = await page.activation.start();
    assert.equal(activationResult.allowed, false);
    assert.equal(activationResult.reason, sessionError ? "initialization_error" : "missing_session");
    assert.equal(sharedStorageReads, 0);
    assert.equal(harness.calls.rpc, 0);
    assert.equal(page.activation.isAuthorized(), false);
    assert.equal(
      (await page.passwordSetup.submit("test-only-value", "test-only-value")).reason,
      "unauthorized"
    );
    assert.equal(harness.calls.updateUser, 0);
  }
});

test("an SDK-established invite session in isolated storage still reaches the role gate", async () => {
  for (const role of ["owner", "editor"]) {
    const { documentRoot } = createDocumentRoot();
    let harness;
    const page = startActivationPage({
      configuration: validConfiguration,
      documentRoot,
      initialInviteContext: true,
      clientFactory(_url, _publishableKey, options) {
        assert.equal(options.auth.persistSession, false);
        assert.equal(options.auth.storage.getItem(options.auth.storageKey), null);
        harness = createClient({
          session: { user: { id: `fictional-invited-${role}` } },
          role
        });
        return harness.client;
      }
    });

    assert.deepEqual(await page.activation.start(), { allowed: true, role });
    assert.equal(harness.calls.rpc, 1);
    assert.equal(harness.calls.updateUser, 0);
    assert.equal(page.activation.isAuthorized(), true);
  }
});

test("activation shell is branded, accessible, private, and script-restricted", () => {
  assert.match(activationHtml, /<title>Seller Account Setup \| Between Us<\/title>/);
  assert.match(activationHtml, /assets\/brand\/between-us-mark\.svg/);
  assert.match(activationHtml, /Private workspace/);
  assert.match(activationHtml, /id="activationStatus"[^>]*role="status"[^>]*aria-live="polite"/);
  for (const id of [
    "activationLoadingSection", "invitationInvalidSection", "accessDeniedSection",
    "passwordSetupSection", "signOutFailureSection", "activationSuccessSection"
  ]) assert.match(activationHtml, new RegExp(`id="${id}"`), id);

  assert.match(activationHtml, /id="newPassword"[^>]*type="password"[^>]*autocomplete="new-password"/);
  assert.match(activationHtml, /id="confirmPassword"[^>]*type="password"[^>]*autocomplete="new-password"/);
  assert.doesNotMatch(activationHtml, /type="email"|name="email"/i);
  assert.doesNotMatch(activationHtml, /sign[ -]?up|public password-reset|forgot password/i);
  assert.match(activationHtml, /href="\/admin\/"[^>]*>Go to Seller Catalog Manager sign-in/);

  assert.match(activationHtml, /script-src 'self'/);
  assert.match(activationHtml, /style-src 'self'/);
  assert.match(activationHtml, /connect-src 'self' http:\/\/127\.0\.0\.1:54321 ws:\/\/127\.0\.0\.1:54321 https:\/\/\*\.supabase\.co wss:\/\/\*\.supabase\.co/);
  assert.match(activationHtml, /img-src 'self' data: blob: http:\/\/127\.0\.0\.1:54321 https:\/\/\*\.supabase\.co/);
  assert.doesNotMatch(activationHtml, /unsafe-eval|unsafe-inline/);
  assert.doesNotMatch(activationHtml, /<script(?![^>]*\bsrc=)[^>]*>/i);
  const scriptSources = [...activationHtml.matchAll(/<script[^>]*\bsrc="([^"]+)"[^>]*><\/script>/g)]
    .map((match) => match[1]);
  assert.deepEqual(scriptSources, ["./config.js", "./assets/activate.js"]);
});

test("missing invitation session fails closed without probing role or scrubbing URL", async () => {
  const { client, calls } = createClient();
  const states = [];
  let scrubs = 0;
  const manager = createActivationSessionManager(client, {
    hasInviteContext: true,
    onStateChange: (state) => states.push(state),
    scrubAddress: () => { scrubs += 1; }
  });

  assert.deepEqual(await manager.start(), { allowed: false, reason: "missing_session" });
  assert.equal(calls.rpc, 0);
  assert.equal(calls.signOut, 0);
  assert.equal(scrubs, 0);
  assert.deepEqual(states.map(({ state }) => state), ["initializing", "invalid"]);
});

test("a valid invite session is authorized only after the owner or editor role probe", async () => {
  for (const [role, locationObject] of [
    ["owner", { search: "?type=invite", hash: "" }],
    ["editor", { search: "", hash: "#type=invite" }]
  ]) {
    const session = { user: { id: `fictional-${role}` } };
    const { client, calls } = createClient({ session, role });
    const states = [];
    const manager = createActivationSessionManager(client, {
      hasInviteContext: captureInitialInviteContext(locationObject),
      onStateChange: (state) => states.push(state.state),
      scrubAddress: () => {}
    });

    assert.equal(manager.isAuthorized(), false);
    assert.deepEqual(await manager.start(), { allowed: true, role });
    assert.equal(calls.rpc, 1);
    assert.equal(calls.signOut, 0);
    assert.deepEqual(states, ["initializing", "checking_access", "authorized"]);
    assert.equal(manager.isAuthorized(), true);
  }
});

test("an authenticated non-admin is signed out and denied", async () => {
  const session = { user: { id: "fictional-visitor" } };
  const { client, calls } = createClient({ session, role: null });
  const states = [];
  const manager = createActivationSessionManager(client, {
    hasInviteContext: true,
    onStateChange: (state) => states.push(state),
    scrubAddress: () => {}
  });

  assert.deepEqual(await manager.start(), {
    allowed: false,
    reason: "denied",
    signOutFailed: false
  });
  assert.equal(calls.signOut, 1);
  assert.equal(manager.isAuthorized(), false);
  assert.equal(states.at(-1).state, "denied");
  assert.doesNotMatch(states.at(-1).message, /owner|editor|allowlist|uuid/i);
});

test("a role-probe error fails closed without exposing provider details", async () => {
  const session = { user: { id: "fictional-seller" } };
  const { client, calls } = createClient({
    session,
    roleError: new Error("fictional provider detail that must stay private")
  });
  const states = [];
  const manager = createActivationSessionManager(client, {
    hasInviteContext: true,
    onStateChange: (state) => states.push(state),
    scrubAddress: () => {}
  });

  assert.deepEqual(await manager.start(), { allowed: false, reason: "probe_error" });
  assert.equal(calls.rpc, 1);
  assert.equal(manager.isAuthorized(), false);
  assert.equal(states.at(-1).state, "role_error");
  assert.doesNotMatch(states.at(-1).message, /provider detail|owner|editor|uuid/i);
});

test("Auth initialization failure is neutral and never probes authorization", async () => {
  const { client, calls } = createClient({
    sessionError: new Error("fictional initialization detail")
  });
  const states = [];
  const manager = createActivationSessionManager(client, {
    hasInviteContext: true,
    onStateChange: (state) => states.push(state),
    scrubAddress: () => {}
  });

  assert.deepEqual(await manager.start(), { allowed: false, reason: "initialization_error" });
  assert.equal(calls.rpc, 0);
  assert.equal(states.at(-1).state, "initialization_error");
  assert.doesNotMatch(states.at(-1).message, /initialization detail/i);
});

test("duplicate starts and Auth events initialize and authorize only once", async () => {
  let releaseProbe;
  const rpcWait = new Promise((resolve) => { releaseProbe = resolve; });
  const session = { user: { id: "fictional-owner" } };
  const { client, calls, emitAuth } = createClient({ session, role: "owner", rpcWait });
  let scrubs = 0;
  const manager = createActivationSessionManager(client, {
    hasInviteContext: true,
    scrubAddress: () => { scrubs += 1; }
  });

  const firstStart = manager.start();
  const secondStart = manager.start();
  emitAuth("INITIAL_SESSION", session);
  emitAuth("SIGNED_IN", session);
  await Promise.resolve();
  releaseProbe();
  assert.deepEqual(await firstStart, { allowed: true, role: "owner" });
  assert.deepEqual(await secondStart, { allowed: true, role: "owner" });
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(calls.subscriptions, 1);
  assert.equal(calls.getSession, 1);
  assert.equal(calls.rpc, 1);
  assert.equal(scrubs, 1);
});

test("URL query and hash material is scrubbed only after a session exists", async () => {
  const replaceCalls = [];
  const historyObject = {
    state: { local: true },
    replaceState(...arguments_) { replaceCalls.push(arguments_); }
  };
  const locationObject = {
    pathname: "/admin/activate.html",
    search: "?fictional=invite",
    hash: "#fictional-session-material"
  };
  const scrub = () => scrubInvitationAddress(historyObject, locationObject);

  const missing = createClient();
  await createActivationSessionManager(missing.client, {
    hasInviteContext: true,
    scrubAddress: scrub
  }).start();
  assert.equal(replaceCalls.length, 0);

  const invited = createClient({ session: { user: { id: "fictional-owner" } }, role: "owner" });
  await createActivationSessionManager(invited.client, {
    hasInviteContext: true,
    scrubAddress: scrub
  }).start();
  assert.deepEqual(replaceCalls, [[historyObject.state, "", "/admin/activate.html"]]);
});

test("session and token-shaped values are neither emitted nor logged by activation code", async () => {
  const session = {
    user: { id: "fictional-user-id" },
    access_token: "fictional-access-material",
    refresh_token: "fictional-refresh-material"
  };
  const { client } = createClient({ session, role: "editor" });
  const states = [];
  const manager = createActivationSessionManager(client, {
    hasInviteContext: true,
    onStateChange: (state) => states.push(state),
    scrubAddress: () => {}
  });
  await manager.start();

  const renderedState = JSON.stringify(states);
  assert.doesNotMatch(renderedState, /fictional-user-id|fictional-access-material|fictional-refresh-material/);
  const source = readFileSync(resolve(root, "admin-src/activation.js"), "utf8");
  assert.doesNotMatch(source, /console\.(?:log|info|debug|warn|error)/);
  assert.doesNotMatch(source, /URLSearchParams|access_token|refresh_token/);
  assert.doesNotMatch(source, /(?:globalThis|window)\.localStorage/);
  assert.doesNotMatch(source, /textContent\s*=\s*(?:session|.*token)/i);
});

test("persisted owner and editor sessions without invite context are rejected before SDK session use", async () => {
  for (const role of ["owner", "editor"]) {
    const session = { user: { id: `fictional-persisted-${role}` } };
    const { client, calls } = createClient({ session, role });
    const states = [];
    let scrubs = 0;
    const manager = createActivationSessionManager(client, {
      hasInviteContext: false,
      onStateChange: (state) => states.push(state.state),
      scrubAddress: () => { scrubs += 1; }
    });

    assert.deepEqual(await manager.start(), {
      allowed: false,
      reason: "invalid_invite_context"
    });
    assert.equal(manager.isAuthorized(), false);
    assert.equal(calls.getSession, 0);
    assert.equal(calls.subscriptions, 0);
    assert.equal(calls.rpc, 0);
    assert.equal(scrubs, 0);
    assert.deepEqual(states, ["initializing", "invalid"]);

    const passwordSetup = createPasswordSetup(client, {
      isAuthorized: manager.isAuthorized
    });
    assert.equal((await passwordSetup.submit("test-only-value", "test-only-value")).reason, "unauthorized");
    assert.equal(calls.updateUser, 0);
  }
});

test("missing and wrong flow types never authorize a persisted owner or call updateUser", async () => {
  for (const locationObject of [
    { search: "", hash: "" },
    { search: "?type=recovery", hash: "" },
    { search: "?type=signup", hash: "" },
    { search: "?type=magiclink", hash: "" }
  ]) {
    const { client, calls } = createClient({
      session: { user: { id: "fictional-persisted-owner" } },
      role: "owner"
    });
    const manager = createActivationSessionManager(client, {
      hasInviteContext: captureInitialInviteContext(locationObject),
      scrubAddress: () => {}
    });

    assert.equal((await manager.start()).reason, "invalid_invite_context");
    const passwordSetup = createPasswordSetup(client, {
      isAuthorized: manager.isAuthorized
    });
    assert.equal((await passwordSetup.submit("test-only-value", "test-only-value")).reason, "unauthorized");
    assert.equal(calls.getSession, 0);
    assert.equal(calls.rpc, 0);
    assert.equal(calls.updateUser, 0);
  }
});

test("non-session Auth events cannot initialize password setup", async () => {
  const { client, calls, emitAuth } = createClient({ role: "owner" });
  const manager = createActivationSessionManager(client, {
    hasInviteContext: true,
    scrubAddress: () => {}
  });
  const starting = manager.start();
  emitAuth("PASSWORD_RECOVERY", { user: { id: "fictional-recovery-user" } });
  emitAuth("USER_UPDATED", { user: { id: "fictional-updated-user" } });
  assert.deepEqual(await starting, { allowed: false, reason: "missing_session" });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(calls.rpc, 0);
  assert.equal(manager.isAuthorized(), false);
});
