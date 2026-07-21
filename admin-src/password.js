export const MIN_PASSWORD_LENGTH = 12;
export const MAX_PASSWORD_LENGTH = 128;

export function validatePasswordSetup(password, confirmation) {
  const errors = {};

  if (typeof password !== "string" || password.length === 0) {
    errors.password = "Enter a new password.";
  } else if (password.length < MIN_PASSWORD_LENGTH) {
    errors.password = `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
  } else if (password.length > MAX_PASSWORD_LENGTH) {
    errors.password = `Use no more than ${MAX_PASSWORD_LENGTH} characters.`;
  }

  if (typeof confirmation !== "string" || confirmation.length === 0) {
    errors.confirmation = "Confirm the new password.";
  } else if (typeof password === "string" && password !== confirmation) {
    errors.confirmation = "The passwords do not match.";
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors
  };
}

export function createPasswordSetup(client, {
  isAuthorized = () => false,
  onStateChange = () => {},
  clearSensitiveFields = () => {}
} = {}) {
  let pending = false;
  let passwordUpdated = false;

  function emit(state, details = {}) {
    onStateChange({ state, ...details });
  }

  async function signOutAfterUpdate() {
    emit("signing_out");
    let result;
    try {
      result = await client.auth.signOut();
    } catch {
      result = { error: true };
    }

    if (result?.error) {
      emit("sign_out_error", {
        message: "Your password was set, but this session could not be closed. Try signing out again."
      });
      return { ok: false, reason: "sign_out_failed", passwordUpdated: true };
    }

    emit("success", {
      message: "Your password is set. Sign in to the Seller Catalog Manager with your new password."
    });
    return { ok: true };
  }

  async function submit(password, confirmation) {
    if (pending) return { ok: false, reason: "pending", skipped: true };

    const validation = validatePasswordSetup(password, confirmation);
    if (!validation.valid) {
      clearSensitiveFields();
      emit("validation_error", {
        errors: validation.errors,
        message: "Review the password fields and try again."
      });
      return { ok: false, reason: "validation", errors: validation.errors };
    }

    if (!isAuthorized() || passwordUpdated) {
      clearSensitiveFields();
      emit("authorization_error", {
        message: "Seller access could not be verified. Request a new invitation and try again."
      });
      return { ok: false, reason: "unauthorized" };
    }

    pending = true;
    emit("updating");
    try {
      let result;
      try {
        result = await client.auth.updateUser({ password });
      } catch {
        result = { error: true };
      }

      if (result?.error) {
        emit("update_error", {
          message: "The password could not be set. Check the invitation and try again."
        });
        return { ok: false, reason: "update_failed" };
      }

      passwordUpdated = true;
      return await signOutAfterUpdate();
    } finally {
      clearSensitiveFields();
      pending = false;
    }
  }

  async function retrySignOut() {
    if (pending || !passwordUpdated) {
      return { ok: false, reason: pending ? "pending" : "password_not_updated", skipped: true };
    }

    pending = true;
    try {
      return await signOutAfterUpdate();
    } finally {
      clearSensitiveFields();
      pending = false;
    }
  }

  return {
    submit,
    retrySignOut,
    get pending() {
      return pending;
    }
  };
}
