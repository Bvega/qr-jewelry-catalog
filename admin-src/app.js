import { createClient } from "@supabase/supabase-js";
import { createAuthManager } from "./auth.js";
import {
  archiveFind,
  createFind,
  createSubmissionGuard,
  loadCatalog,
  restoreFind,
  setFindPublished,
  updateFind
} from "./catalog.js";
import {
  getPrimaryImageUrl,
  updatePrimaryAltText,
  uploadPrimaryImage
} from "./photos.js";
import { readImageDimensions, validateFindInput, validatePhotoFile } from "./validation.js";
import { createUI } from "./ui.js";

const ui = createUI();
const configuration = globalThis.BETWEEN_US_ADMIN_CONFIG;

function configurationIsUsable(value) {
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

function friendlyError(error, fallback = "The request could not be completed. Please try again.") {
  if (globalThis.navigator?.onLine === false) {
    return "You appear to be offline. Reconnect and try again.";
  }
  return error?.message || fallback;
}

if (!configurationIsUsable(configuration)) {
  ui.setAuthState("error");
  ui.setStatus("Manager configuration is missing or invalid. Run the local configuration generator.", "error");
  ui.refs.signInForm.hidden = true;
} else {
  const client = createClient(configuration.url, configuration.publishableKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false
    }
  });
  const saveGuard = createSubmissionGuard();
  let selectedImage = null;
  let selectedDimensions = null;
  let catalog = { collections: [], finds: [] };

  function decorateFinds(finds) {
    return finds.map((find) => ({
      ...find,
      primaryPhoto: find.primaryPhoto
        ? { ...find.primaryPhoto, publicUrl: getPrimaryImageUrl(client, find.primaryPhoto) }
        : null
    }));
  }

  async function refreshCatalog() {
    ui.setCatalogLoading(true);
    ui.setStatus("Loading catalog…");
    try {
      catalog = await loadCatalog(client);
      catalog.finds = decorateFinds(catalog.finds);
      ui.setCollections(catalog.collections);
      ui.renderCatalog(catalog.finds);
      ui.setStatus("Catalog loaded.", "success");
    } catch (error) {
      ui.setStatus(friendlyError(error, "The catalog could not be loaded."), "error");
    } finally {
      ui.setCatalogLoading(false);
    }
  }

  const auth = createAuthManager(client, async (authState) => {
    ui.setAuthState(authState.state);
    if (authState.message) {
      ui.setStatus(authState.message, authState.state === "denied" || authState.state === "error" ? "error" : "neutral");
    }
    if (authState.state === "restoring") ui.setStatus("Restoring session…");
    if (authState.state === "signing_in") ui.setStatus("Signing in…");
    if (authState.state === "checking_access") ui.setStatus("Checking seller access…");
    if (authState.state === "signed_out" && !authState.message) ui.setStatus("Sign in to manage the catalog.");
    if (authState.state === "authorized") {
      ui.setSession(authState.email, authState.role);
      await refreshCatalog();
    }
  });

  ui.refs.signInForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!ui.refs.signInForm.reportValidity()) return;
    const email = ui.refs.email.value;
    const password = ui.refs.password.value;
    ui.refs.password.value = "";
    await auth.signIn(email, password);
  });

  ui.refs.logoutButton.addEventListener("click", async () => {
    ui.closeEditor();
    await auth.signOut();
  });

  ui.refs.returnToSignInButton.addEventListener("click", () => {
    ui.setAuthState("signed_out");
    ui.setStatus("Sign in with an allowlisted account.");
    ui.refs.email.focus();
  });

  ui.refs.catalogFilter.addEventListener("change", () => ui.renderCatalog(catalog.finds));
  ui.refs.newFindButton.addEventListener("click", () => {
    selectedImage = null;
    selectedDimensions = null;
    ui.openEditor();
  });
  ui.refs.cancelEditButton.addEventListener("click", () => {
    selectedImage = null;
    selectedDimensions = null;
    ui.closeEditor();
  });

  ui.refs.catalogList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-edit-find]");
    if (!button) return;
    const find = ui.currentFind(button.dataset.editFind);
    if (!find) return;
    selectedImage = null;
    selectedDimensions = null;
    ui.openEditor(find);
  });

  ui.refs.primaryImage.addEventListener("change", async () => {
    ui.clearErrors();
    selectedImage = ui.refs.primaryImage.files?.[0] || null;
    selectedDimensions = null;
    const check = validatePhotoFile(selectedImage);
    if (!check.valid) {
      ui.showErrors({ primary_image: check.error });
      ui.refs.primaryImage.value = "";
      selectedImage = null;
      return;
    }
    if (!selectedImage) {
      const existing = ui.currentFind(ui.refs.findForm.dataset.findId);
      ui.setPreview(
        existing?.primaryPhoto?.publicUrl || null,
        existing?.primaryPhoto?.alt_text || "Primary image"
      );
      return;
    }

    try {
      selectedDimensions = await readImageDimensions(selectedImage);
      ui.setPreview(URL.createObjectURL(selectedImage), "Selected primary image preview", { objectUrl: true });
      ui.setStatus(`Image ready: ${selectedDimensions.width} × ${selectedDimensions.height} pixels.`);
    } catch (error) {
      ui.showErrors({ primary_image: friendlyError(error, "The selected image could not be read.") });
      ui.refs.primaryImage.value = "";
      selectedImage = null;
    }
  });

  async function save(event) {
    event.preventDefault();
    const publish = event.submitter?.value === "publish";
    const editingId = ui.refs.findForm.dataset.findId || null;
    const existing = editingId ? ui.currentFind(editingId) : null;
    const validation = validateFindInput(ui.readForm(), { hasSelectedImage: Boolean(selectedImage) });
    const photoValidation = validatePhotoFile(selectedImage);
    if (!photoValidation.valid) validation.errors.primary_image = photoValidation.error;
    if (selectedImage && !selectedDimensions) {
      validation.errors.primary_image = "Wait for image inspection to finish, then try again.";
    }
    validation.valid = Object.keys(validation.errors).length === 0;
    if (!validation.valid) {
      ui.showErrors(validation.errors);
      ui.setStatus("Review the highlighted fields.", "error");
      return;
    }

    await saveGuard.run(async () => {
      ui.setSaving(true);
      ui.setStatus(selectedImage ? "Saving Find and uploading image…" : "Saving Find…");
      let persistedFind = null;
      try {
        const saved = existing
          ? await updateFind(client, existing.id, validation.value, { publish })
          : await createFind(client, validation.value, { publish });
        persistedFind = saved;
        let imageWarning = null;

        if (selectedImage) {
          const imageResult = await uploadPrimaryImage({
            client,
            findId: saved.id,
            file: selectedImage,
            altText: validation.value.alt_text,
            width: selectedDimensions.width,
            height: selectedDimensions.height,
            existingPhoto: existing?.primaryPhoto || null
          });
          imageWarning = imageResult.warning;
        } else if (
          existing?.primaryPhoto
          && validation.value.alt_text
          && validation.value.alt_text !== existing.primaryPhoto.alt_text
        ) {
          await updatePrimaryAltText(client, existing.primaryPhoto.id, validation.value.alt_text);
        }

        selectedImage = null;
        selectedDimensions = null;
        await refreshCatalog();
        ui.closeEditor();
        ui.setStatus(
          imageWarning ? `${saved.public_id} was saved. ${imageWarning}` : `${saved.public_id} was saved successfully.`,
          imageWarning ? "error" : "success"
        );
      } catch (error) {
        await refreshCatalog();
        if (!existing && persistedFind) {
          selectedImage = null;
          selectedDimensions = null;
          const created = ui.currentFind(persistedFind.id);
          if (created) ui.openEditor(created);
        }
        const message = friendlyError(error);
        ui.setStatus(
          persistedFind
            ? existing
              ? `${persistedFind.public_id} catalog fields were saved. ${message}`
              : `${persistedFind.public_id} was created. ${message}`
            : message,
          "error"
        );
      } finally {
        ui.setSaving(false);
      }
    });
  }

  ui.refs.findForm.addEventListener("submit", save);

  async function runRecordAction(action, pendingMessage, successMessage) {
    const findId = ui.refs.findForm.dataset.findId;
    if (!findId || saveGuard.active) return;
    await saveGuard.run(async () => {
      ui.setSaving(true);
      ui.setStatus(pendingMessage);
      try {
        await action(findId);
        await refreshCatalog();
        ui.closeEditor();
        ui.setStatus(successMessage, "success");
      } catch (error) {
        ui.setStatus(friendlyError(error), "error");
      } finally {
        ui.setSaving(false);
      }
    });
  }

  ui.refs.hideFindButton.addEventListener("click", () => runRecordAction(
    (id) => setFindPublished(client, id, false),
    "Hiding Find…",
    "The Find is now hidden."
  ));
  ui.refs.archiveFindButton.addEventListener("click", () => runRecordAction(
    (id) => archiveFind(client, id),
    "Archiving Find…",
    "The Find was archived and hidden."
  ));
  ui.refs.restoreFindButton.addEventListener("click", () => runRecordAction(
    (id) => restoreFind(client, id),
    "Restoring Find…",
    "The Find was restored and remains hidden until published."
  ));

  auth.start().catch((error) => {
    ui.setAuthState("error");
    ui.setStatus(friendlyError(error, "The manager could not start."), "error");
  });
}
