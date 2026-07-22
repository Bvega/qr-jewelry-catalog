import { createClient } from "@supabase/supabase-js";
import { createMigrationAuthManager } from "./migration-auth.js";
import { CONFIRMATION_PHRASE, createExecutionGate, executeCatalogMigration, performDryRun } from "./migration-executor.js";
import { loadAndVerifyMigrationSources } from "./migration-plan.js";
import { createMigrationUI } from "./migration-ui.js";

const ui = createMigrationUI();
const configuration = globalThis.BETWEEN_US_ADMIN_CONFIG;

function configurationIsUsable(value) {
  if (!value || typeof value !== "object") return false;
  try {
    const url = new URL(value.url);
    const projectRef = typeof value.projectRef === "string" ? value.projectRef : "";
    const remote = url.protocol === "https:"
      && url.hostname === `${projectRef}.supabase.co`
      && url.port === "";
    const local = url.protocol === "http:"
      && url.hostname === "127.0.0.1"
      && url.port === "54321"
      && projectRef === "local-m07b3";
    return (remote || local)
      && url.username === ""
      && url.password === ""
      && url.pathname === "/"
      && url.search === ""
      && url.hash === ""
      && typeof value.publishableKey === "string"
      && value.publishableKey.length > 0;
  } catch {
    return false;
  }
}

if (!configurationIsUsable(configuration)) {
  ui.setAuthState("signed_out");
  ui.refs.signInForm.hidden = true;
  ui.setWorkflowState("blocked", "Migration configuration is missing or invalid.");
} else {
  const client = createClient(configuration.url, configuration.publishableKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false }
  });
  const gate = createExecutionGate();
  let verified = null;
  let currentDryRun = null;
  let sourceLoad = null;

  async function loadSourcesOnce() {
    sourceLoad ||= loadAndVerifyMigrationSources();
    try {
      verified = await sourceLoad;
      ui.renderPlan(verified.plan);
      ui.setWorkflowState("blocked", "Local sources verified. Run the mandatory dry-run before execution.");
    } catch (error) {
      sourceLoad = null;
      verified = null;
      ui.setWorkflowState("blocked", error.message || "Local source verification failed.");
    }
  }

  const auth = createMigrationAuthManager(client, async (state) => {
    ui.setAuthState(state.state);
    if (state.state === "restoring") ui.setStatus("Restoring owner session…");
    if (state.state === "signing_in") ui.setStatus("Signing in…");
    if (state.state === "checking_access") ui.setStatus("Checking owner access…");
    if (state.state === "signed_out") ui.setStatus(state.message || "Sign in with the approved owner account.");
    if (state.state === "denied" || state.state === "error") ui.setWorkflowState("blocked", state.message || "Owner access could not be verified.");
    if (state.state === "authorized") {
      ui.setStatus("Owner role verified. Verifying local sources…");
      await loadSourcesOnce();
    }
  });

  ui.refs.signInForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!ui.refs.signInForm.reportValidity()) return;
    const password = ui.refs.password.value;
    ui.refs.password.value = "";
    await auth.signIn(ui.refs.email.value, password);
  });
  ui.refs.logoutButton.addEventListener("click", async () => {
    verified = null;
    currentDryRun = null;
    sourceLoad = null;
    gate.clear();
    await auth.signOut();
  });
  ui.refs.returnButton.addEventListener("click", () => {
    ui.setAuthState("signed_out");
    ui.setStatus("Sign in with the approved owner account.");
    ui.refs.email.focus();
  });

  ui.refs.dryRunButton.addEventListener("click", async () => {
    if (!verified) return;
    gate.clear();
    currentDryRun = null;
    ui.setRunning(true);
    ui.setWorkflowState("running", "Running no-write database and Storage preflight…");
    try {
      const dryRun = await performDryRun({ client, verified });
      currentDryRun = dryRun;
      gate.setDryRun(dryRun);
      ui.renderPreflight(dryRun);
      if (!dryRun.ready) ui.setWorkflowState("blocked", "Dry-run blocked by a named mismatch.");
      else if (dryRun.all_complete) ui.setWorkflowState("already-complete", "All four exact hidden Finds and verified images are already complete. No write was performed.");
      else ui.setWorkflowState("ready", "Dry-run passed with zero writes. Review and confirm the controlled import.");
    } catch (error) {
      gate.clear();
      ui.setWorkflowState("blocked", error.message || "Dry-run could not be completed.");
    } finally {
      ui.setRunning(false);
    }
  });

  function updateExecutionEligibility() {
    ui.refs.executeButton.disabled = !gate.canExecute({ checked: ui.refs.confirmationCheck.checked, phrase: ui.refs.confirmationPhrase.value });
  }
  ui.refs.confirmationCheck.addEventListener("change", updateExecutionEligibility);
  ui.refs.confirmationPhrase.addEventListener("input", updateExecutionEligibility);

  ui.refs.executeButton.addEventListener("click", async () => {
    if (!verified || !currentDryRun) return;
    try {
      gate.requireCurrent({ checked: ui.refs.confirmationCheck.checked, phrase: ui.refs.confirmationPhrase.value });
    } catch (error) {
      ui.setWorkflowState("blocked", error.message);
      return;
    }
    ui.setRunning(true);
    ui.setWorkflowState("running", "Executing controlled four-record import…");
    try {
      const result = await executeCatalogMigration({
        client, verified, dryRun: currentDryRun, checked: ui.refs.confirmationCheck.checked,
        phrase: ui.refs.confirmationPhrase.value,
        revalidateSources: () => loadAndVerifyMigrationSources(),
        onProgress: ({ public_id, state }) => ui.setRecordProgress(public_id, state)
      });
      currentDryRun = result.dryRun;
      gate.clear();
      ui.renderPreflight(result.dryRun);
      ui.setWorkflowState("complete", "Import complete: four exact hidden Finds and four verified primary images.");
    } catch (error) {
      gate.clear();
      ui.setWorkflowState(error.partial ? "partial-failure" : "blocked", error.message || "Migration stopped safely.");
    } finally {
      ui.refs.confirmationPhrase.value = "";
      ui.refs.confirmationCheck.checked = false;
      ui.setRunning(false);
    }
  });

  ui.refs.confirmationPhrase.setAttribute("aria-describedby", "migrationConfirmationTitle");
  ui.refs.executeButton.dataset.confirmation = CONFIRMATION_PHRASE;
  auth.start().catch(() => ui.setWorkflowState("blocked", "Migration authentication could not start."));
}
