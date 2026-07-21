import { createClient } from "@supabase/supabase-js";
import { isCatalogAdminRole } from "./auth.js";
import { createPasswordSetup } from "./password.js";
import { createActivationUI } from "./ui.js";

const SESSION_ESTABLISHING_EVENTS = new Set(["INITIAL_SESSION", "SIGNED_IN"]);
export const ACTIVATION_AUTH_STORAGE_KEY = "between-us-activation-auth";

export function createActivationAuthStorage() {
  const entries = new Map();

  return {
    getItem(key) {
      return entries.has(key) ? entries.get(key) : null;
    },
    setItem(key, value) {
      entries.set(key, value);
    },
    removeItem(key) {
      entries.delete(key);
    }
  };
}

function inspectFlowType(parameterText, initialDelimiter) {
  let count = 0;
  let exactInvite = true;
  const typePattern = initialDelimiter === "?"
    ? /(?:^\?|&)type=([^&]*)/g
    : /(?:^#|&)type=([^&]*)/g;
  let match;

  while ((match = typePattern.exec(typeof parameterText === "string" ? parameterText : "")) !== null) {
    count += 1;
    if (match[1] !== "invite") exactInvite = false;
  }

  return { count, exactInvite };
}

export function captureInitialInviteContext(locationObject = globalThis.location) {
  const queryType = inspectFlowType(locationObject?.search, "?");
  const hashType = inspectFlowType(locationObject?.hash, "#");
  return queryType.count + hashType.count === 1
    && queryType.exactInvite
    && hashType.exactInvite;
}

export function activationConfigurationIsUsable(value) {
  if (!value || typeof value !== "object") return false;
  try {
    const url = new URL(value.url);
    return url.protocol === "https:"
      && typeof value.publishableKey === "string"
      && value.publishableKey.length > 0
      && typeof value.projectRef === "string"
      && value.projectRef.length > 0;
  } catch {
    return false;
  }
}

export function scrubInvitationAddress(
  historyObject = globalThis.history,
  locationObject = globalThis.location
) {
  if (!historyObject || !locationObject || (!locationObject.search && !locationObject.hash)) return false;
  historyObject.replaceState(historyObject.state, "", locationObject.pathname);
  return true;
}

export function createActivationSessionManager(client, {
  hasInviteContext = false,
  onStateChange = () => {},
  scrubAddress = scrubInvitationAddress
} = {}) {
  let subscription = null;
  let startPromise = null;
  let sessionPromise = null;
  let authorized = false;

  function emit(state, details = {}) {
    onStateChange({ state, ...details });
  }

  function rejectInvalidContext() {
    emit("invalid", {
      message: "This invitation is invalid, expired, or missing. Request a new invitation and try again."
    });
    return { allowed: false, reason: "invalid_invite_context" };
  }

  function processSession(session, authEvent = "INITIAL_SESSION") {
    if (hasInviteContext !== true) return Promise.resolve(rejectInvalidContext());
    if (!SESSION_ESTABLISHING_EVENTS.has(authEvent)) {
      return Promise.resolve({ allowed: false, reason: "invalid_auth_event" });
    }
    if (!session?.user) return Promise.resolve({ allowed: false, reason: "missing_session" });
    if (sessionPromise) return sessionPromise;

    sessionPromise = (async () => {
      try {
        scrubAddress();
      } catch {
        emit("initialization_error", {
          message: "Account setup could not start safely. Request a new invitation and try again."
        });
        return { allowed: false, reason: "url_scrub_error" };
      }

      emit("checking_access");
      let result;
      try {
        result = await client.rpc("current_catalog_admin_role");
      } catch {
        result = { error: true };
      }

      if (result?.error) {
        emit("role_error", {
          message: "Seller access could not be verified. Reload this invitation and try again."
        });
        return { allowed: false, reason: "probe_error" };
      }

      if (!isCatalogAdminRole(result?.data)) {
        let signOutFailed = false;
        try {
          const signOutResult = await client.auth.signOut();
          signOutFailed = Boolean(signOutResult?.error);
        } catch {
          signOutFailed = true;
        }
        emit("denied", {
          message: signOutFailed
            ? "Seller access is not available. Close this tab before continuing."
            : "Seller access is not available for this account."
        });
        return { allowed: false, reason: "denied", signOutFailed };
      }

      authorized = true;
      emit("authorized");
      return { allowed: true, role: result.data };
    })();

    return sessionPromise;
  }

  function start() {
    if (startPromise) return startPromise;

    emit("initializing");
    if (hasInviteContext !== true) {
      startPromise = Promise.resolve(rejectInvalidContext());
      return startPromise;
    }

    try {
      const listener = client.auth.onAuthStateChange((event, session) => {
        if (!SESSION_ESTABLISHING_EVENTS.has(event) || !session?.user) return;
        queueMicrotask(() => {
          processSession(session, event).catch(() => {
            emit("initialization_error", {
              message: "Account setup could not start. Request a new invitation and try again."
            });
          });
        });
      });
      subscription = listener?.data?.subscription || null;
    } catch {
      emit("initialization_error", {
        message: "Account setup could not start. Request a new invitation and try again."
      });
      startPromise = Promise.resolve({ allowed: false, reason: "initialization_error" });
      return startPromise;
    }

    startPromise = (async () => {
      let current;
      try {
        current = await client.auth.getSession();
      } catch {
        current = { error: true };
      }

      if (current?.error) {
        emit("initialization_error", {
          message: "The invitation could not be verified. Request a new invitation and try again."
        });
        return { allowed: false, reason: "initialization_error" };
      }

      if (current?.data?.session?.user) return processSession(current.data.session);

      await Promise.resolve();
      if (sessionPromise) return sessionPromise;

      emit("invalid", {
        message: "This invitation is invalid, expired, or missing. Request a new invitation and try again."
      });
      return { allowed: false, reason: "missing_session" };
    })();

    return startPromise;
  }

  function destroy() {
    subscription?.unsubscribe();
    subscription = null;
  }

  return {
    start,
    destroy,
    processSession,
    isAuthorized: () => authorized
  };
}

export function startActivationPage({
  configuration = globalThis.BETWEEN_US_ADMIN_CONFIG,
  documentRoot = globalThis.document,
  clientFactory = createClient,
  initialInviteContext = captureInitialInviteContext(globalThis.location)
} = {}) {
  const ui = createActivationUI(documentRoot);
  if (!activationConfigurationIsUsable(configuration)) {
    ui.setState(
      "configuration_error",
      "Account setup configuration is missing or invalid. Run the local configuration generator."
    );
    return null;
  }

  if (initialInviteContext !== true) {
    ui.setState(
      "invalid",
      "This invitation is invalid, expired, or missing. Request a new invitation and try again."
    );
    return null;
  }

  const client = clientFactory(configuration.url, configuration.publishableKey, {
    auth: {
      storage: createActivationAuthStorage(),
      storageKey: ACTIVATION_AUTH_STORAGE_KEY,
      persistSession: false,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  });

  let passwordSetup;
  const activation = createActivationSessionManager(client, {
    hasInviteContext: initialInviteContext,
    onStateChange(authState) {
      ui.setState(authState.state, authState.message);
    }
  });

  passwordSetup = createPasswordSetup(client, {
    isAuthorized: activation.isAuthorized,
    clearSensitiveFields: ui.clearPasswordFields,
    onStateChange(passwordState) {
      if (passwordState.state === "validation_error") {
        ui.showPasswordErrors(passwordState.errors);
      } else {
        ui.clearPasswordErrors();
      }
      ui.setState(passwordState.state, passwordState.message);
    }
  });

  ui.refs.passwordSetupForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    await passwordSetup.submit(ui.refs.newPassword.value, ui.refs.confirmPassword.value);
  });

  ui.refs.retrySignOutButton.addEventListener("click", async () => {
    await passwordSetup.retrySignOut();
  });

  activation.start().catch(() => {
    ui.setState(
      "initialization_error",
      "Account setup could not start. Request a new invitation and try again."
    );
  });

  globalThis.addEventListener?.("pagehide", () => activation.destroy(), { once: true });
  return { activation, passwordSetup };
}

if (typeof document !== "undefined") startActivationPage();
