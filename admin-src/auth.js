const ALLOWED_ROLES = new Set(["owner", "editor"]);

export function createAuthManager(client, onStateChange = () => {}) {
  let subscription = null;
  let denying = false;

  function emit(state, details = {}) {
    onStateChange({ state, ...details });
  }

  async function gateSession(session) {
    if (!session?.user) {
      emit("signed_out");
      return { allowed: false, reason: "signed_out" };
    }

    emit("checking_access");
    const result = await client.rpc("current_catalog_admin_role");
    if (result.error) {
      emit("error", { message: "Access could not be verified. Please try again." });
      return { allowed: false, reason: "probe_error" };
    }

    if (!ALLOWED_ROLES.has(result.data)) {
      denying = true;
      await client.auth.signOut();
      denying = false;
      emit("denied", { message: "This account does not have Seller Catalog Manager access." });
      return { allowed: false, reason: "denied" };
    }

    emit("authorized", {
      role: result.data,
      email: typeof session.user.email === "string" ? session.user.email : ""
    });
    return { allowed: true, role: result.data };
  }

  async function start() {
    emit("restoring");
    const current = await client.auth.getSession();
    if (current.error) {
      emit("error", { message: "The saved session could not be restored." });
    } else {
      await gateSession(current.data.session);
    }

    const listener = client.auth.onAuthStateChange((_event, session) => {
      if (denying && !session) return;
      queueMicrotask(() => {
        gateSession(session).catch(() => {
          emit("error", { message: "Authentication state could not be verified." });
        });
      });
    });
    subscription = listener.data.subscription;
  }

  async function signIn(email, password) {
    emit("signing_in");
    const result = await client.auth.signInWithPassword({ email: email.trim(), password });
    if (result.error) {
      emit("signed_out", { message: "Sign-in was not accepted. Check your details and try again." });
      return { allowed: false, reason: "invalid_credentials" };
    }
    return gateSession(result.data.session);
  }

  async function signOut() {
    emit("signing_out");
    const result = await client.auth.signOut();
    if (result.error) {
      emit("error", { message: "Sign-out did not complete. Please try again." });
      return false;
    }
    emit("signed_out");
    return true;
  }

  function destroy() {
    subscription?.unsubscribe();
    subscription = null;
  }

  return { start, signIn, signOut, destroy, gateSession };
}
