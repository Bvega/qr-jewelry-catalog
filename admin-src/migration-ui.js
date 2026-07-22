const byId = (id) => document.getElementById(id);

export function createMigrationUI() {
  const refs = {
    status: byId("migrationStatus"), signInSection: byId("migrationSignInSection"),
    signInForm: byId("migrationSignInForm"), email: byId("migrationEmail"),
    password: byId("migrationPassword"), signInButton: byId("migrationSignInButton"),
    deniedSection: byId("migrationDeniedSection"), returnButton: byId("migrationReturnButton"),
    workspace: byId("migrationWorkspace"), logoutButton: byId("migrationLogoutButton"),
    planSection: byId("migrationPlanSection"), planBody: byId("migrationPlanBody"),
    sourceBadge: byId("sourceVerificationBadge"), dryRunButton: byId("dryRunButton"),
    preflightSection: byId("databasePreflightSection"), preflightSummary: byId("databasePreflightSummary"),
    collectionList: byId("collectionPreflightList"), findList: byId("findPreflightList"),
    preflightErrors: byId("preflightErrors"), confirmationSection: byId("migrationConfirmationSection"),
    confirmationCheck: byId("migrationConfirmationCheck"), confirmationPhrase: byId("migrationConfirmationPhrase"),
    executeButton: byId("executeMigrationButton")
  };

  function setStatus(message, tone = "neutral") {
    refs.status.textContent = message;
    refs.status.dataset.tone = tone;
  }

  function setWorkflowState(state, message) {
    refs.status.dataset.workflowState = state;
    if (message) setStatus(message, ["blocked", "partial-failure"].includes(state) ? "error" : ["complete", "already-complete"].includes(state) ? "success" : "neutral");
  }

  function setAuthState(state) {
    refs.signInSection.hidden = state !== "signed_out";
    refs.deniedSection.hidden = state !== "denied";
    refs.workspace.hidden = state !== "authorized";
    refs.signInButton.disabled = state === "signing_in" || state === "checking_access";
    if (state !== "authorized") {
      refs.planSection.hidden = true;
      refs.preflightSection.hidden = true;
      refs.confirmationSection.hidden = true;
      refs.planBody.replaceChildren();
      refs.password.value = "";
      refs.confirmationPhrase.value = "";
      refs.confirmationCheck.checked = false;
    }
  }

  function cell(text) {
    const value = document.createElement("td");
    value.textContent = text;
    return value;
  }

  function renderPlan(plan) {
    refs.planBody.replaceChildren(...plan.finds.map((find) => {
      const row = document.createElement("tr");
      const identity = document.createElement("td");
      const id = document.createElement("strong");
      id.textContent = find.public_id;
      identity.append(id, document.createElement("br"), document.createTextNode(find.title));
      row.append(identity, cell(find.collection_id), cell(`$${find.price_amount} USD · ${find.availability}`),
        cell("Hidden · unfeatured"), cell(`${find.photo.filename} · ${find.photo.width} × ${find.photo.height} · verified`));
      row.dataset.publicId = find.public_id;
      return row;
    }));
    refs.sourceBadge.textContent = "Sources verified";
    refs.sourceBadge.dataset.tone = "success";
    refs.planSection.hidden = false;
    refs.dryRunButton.disabled = false;
  }

  function listItem(text, state) {
    const item = document.createElement("li");
    item.textContent = text;
    item.dataset.state = state;
    return item;
  }

  function renderPreflight(dryRun) {
    refs.preflightSection.hidden = false;
    refs.preflightSummary.textContent = dryRun.ready
      ? dryRun.all_complete ? "Dry-run complete: all four exact imports already exist. No write is needed."
        : "Dry-run complete: database and Storage preflight passed with zero writes."
      : "Dry-run blocked. Resolve every named mismatch before execution.";
    refs.collectionList.replaceChildren(...dryRun.collections.map((item) => listItem(`Collection ${item.id}: ${item.state}`, item.state)));
    refs.findList.replaceChildren(...dryRun.records.map((item) => listItem(
      `${item.public_id}: ${item.state}; photo metadata ${item.photo_metadata}; image ${item.storage_object}`, item.state
    )));
    refs.preflightErrors.replaceChildren(...dryRun.errors.map((error) => listItem(error, "blocked")));
    refs.confirmationSection.hidden = !dryRun.ready || dryRun.all_complete;
    refs.confirmationCheck.checked = false;
    refs.confirmationPhrase.value = "";
    refs.executeButton.disabled = true;
  }

  function setRunning(running) {
    refs.dryRunButton.disabled = running;
    refs.executeButton.disabled = true;
    refs.confirmationCheck.disabled = running;
    refs.confirmationPhrase.disabled = running;
  }

  function setRecordProgress(publicId, state) {
    const item = Array.from(refs.findList.children).find((entry) => entry.textContent.startsWith(`${publicId}:`));
    if (item) {
      item.textContent = `${publicId}: ${state}`;
      item.dataset.state = state;
    }
  }

  return { refs, setStatus, setWorkflowState, setAuthState, renderPlan, renderPreflight, setRunning, setRecordProgress };
}
