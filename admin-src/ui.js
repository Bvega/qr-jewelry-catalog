const FILTERS = Object.freeze({
  all: () => true,
  available: (find) => find.availability === "available" && !find.archived_at,
  reserved: (find) => find.availability === "reserved" && !find.archived_at,
  sold: (find) => find.availability === "sold" && !find.archived_at,
  published: (find) => find.is_published && !find.archived_at,
  hidden: (find) => !find.is_published && !find.archived_at,
  archived: (find) => Boolean(find.archived_at)
});

function money(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD"
  }).format(Number(value));
}

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export function filterFinds(finds, filterName) {
  return finds.filter(FILTERS[filterName] || FILTERS.all);
}

export function createUI(documentRoot = document) {
  const byId = (id) => documentRoot.getElementById(id);
  const refs = {
    globalStatus: byId("globalStatus"),
    signInSection: byId("signInSection"),
    signInForm: byId("signInForm"),
    email: byId("email"),
    password: byId("password"),
    signInButton: byId("signInButton"),
    deniedSection: byId("deniedSection"),
    returnToSignInButton: byId("returnToSignInButton"),
    managerSection: byId("managerSection"),
    sessionStatus: byId("sessionStatus"),
    logoutButton: byId("logoutButton"),
    newFindButton: byId("newFindButton"),
    catalogFilter: byId("catalogFilter"),
    catalogSummary: byId("catalogSummary"),
    catalogLoading: byId("catalogLoading"),
    catalogEmpty: byId("catalogEmpty"),
    catalogList: byId("catalogList"),
    editorSection: byId("editorSection"),
    editorEyebrow: byId("editorEyebrow"),
    editorTitle: byId("editorTitle"),
    cancelEditButton: byId("cancelEditButton"),
    findForm: byId("findForm"),
    title: byId("title"),
    collectionId: byId("collectionId"),
    priceAmount: byId("priceAmount"),
    availability: byId("availability"),
    description: byId("description"),
    condition: byId("condition"),
    primaryImage: byId("primaryImage"),
    altText: byId("altText"),
    imagePreview: byId("imagePreview"),
    imagePlaceholder: byId("imagePlaceholder"),
    hideFindButton: byId("hideFindButton"),
    archiveFindButton: byId("archiveFindButton"),
    restoreFindButton: byId("restoreFindButton")
  };

  let finds = [];
  let collectionLabels = new Map();
  let previewObjectUrl = null;

  function setStatus(message, tone = "neutral") {
    refs.globalStatus.textContent = message;
    refs.globalStatus.dataset.tone = tone;
  }

  function setAuthState(state) {
    const isSignedOut = state === "signed_out" || state === "signing_in" || state === "error";
    refs.signInSection.hidden = !isSignedOut;
    refs.deniedSection.hidden = state !== "denied";
    refs.managerSection.hidden = state !== "authorized";
    refs.signInButton.disabled = state === "signing_in";
    refs.logoutButton.disabled = state === "signing_out";
  }

  function setSession(email, role) {
    refs.sessionStatus.textContent = email
      ? `${email} · ${role}`
      : `Access verified · ${role}`;
  }

  function setCatalogLoading(loading) {
    refs.catalogLoading.hidden = !loading;
    refs.catalogList.hidden = loading;
    if (loading) refs.catalogEmpty.hidden = true;
  }

  function setCollections(collections) {
    collectionLabels = new Map(collections.map((collection) => [collection.id, collection.label]));
    refs.collectionId.replaceChildren(new Option("Choose a Collection", ""));
    for (const collection of collections) {
      const suffix = collection.status === "coming_soon" ? " — Coming Soon" : "";
      refs.collectionId.add(new Option(`${collection.label}${suffix}`, collection.id));
    }
  }

  function renderCatalog(nextFinds = finds) {
    finds = nextFinds;
    const filtered = filterFinds(finds, refs.catalogFilter.value);
    refs.catalogList.replaceChildren();
    refs.catalogEmpty.hidden = filtered.length !== 0;
    refs.catalogSummary.textContent = `${filtered.length} of ${finds.length} Finds shown`;

    for (const find of filtered) {
      const item = element("li", "find-card");
      const media = element("div", "find-card-media");
      if (find.primaryPhoto?.publicUrl) {
        const image = element("img");
        image.src = find.primaryPhoto.publicUrl;
        image.alt = find.primaryPhoto.alt_text;
        image.loading = "lazy";
        media.append(image);
      } else {
        media.append(element("span", "find-card-placeholder", "No image"));
      }

      const body = element("div", "find-card-body");
      const heading = element("div", "find-card-heading");
      heading.append(element("span", "public-id", find.public_id), element("h3", "", find.title));
      const facts = element("dl", "find-facts");
      const values = [
        ["Collection", collectionLabels.get(find.collection_id) || find.collection_id],
        ["Price", money(find.price_amount)],
        ["Availability", find.availability],
        ["Visibility", find.is_published && !find.archived_at ? "Published" : "Hidden"],
        ["Record", find.archived_at ? "Archived" : "Active"]
      ];
      for (const [label, value] of values) {
        facts.append(element("dt", "", label), element("dd", "", value));
      }
      const edit = element("button", "button button-secondary", "Edit");
      edit.type = "button";
      edit.dataset.editFind = find.id;
      edit.setAttribute("aria-label", `Edit ${find.public_id}: ${find.title}`);
      body.append(heading, facts, edit);
      item.append(media, body);
      refs.catalogList.append(item);
    }
    refs.catalogList.hidden = false;
  }

  function currentFind(findId) {
    return finds.find((find) => find.id === findId) || null;
  }

  function clearPreviewUrl() {
    if (previewObjectUrl) URL.revokeObjectURL(previewObjectUrl);
    previewObjectUrl = null;
  }

  function setPreview(url, alt = "Selected primary image preview", { objectUrl = false } = {}) {
    clearPreviewUrl();
    if (!url) {
      refs.imagePreview.hidden = true;
      refs.imagePreview.removeAttribute("src");
      refs.imagePlaceholder.hidden = false;
      return;
    }
    previewObjectUrl = objectUrl ? url : null;
    refs.imagePreview.src = url;
    refs.imagePreview.alt = alt;
    refs.imagePreview.hidden = false;
    refs.imagePlaceholder.hidden = true;
  }

  function clearErrors() {
    for (const field of refs.findForm.elements) {
      if (typeof field.setCustomValidity === "function") field.setCustomValidity("");
      field.removeAttribute?.("aria-invalid");
    }
    for (const error of refs.findForm.querySelectorAll(".field-error")) error.textContent = "";
  }

  function showErrors(errors) {
    clearErrors();
    const mapping = {
      title: [refs.title, byId("titleError")],
      collection_id: [refs.collectionId, byId("collectionIdError")],
      price_amount: [refs.priceAmount, byId("priceAmountError")],
      availability: [refs.availability, byId("availabilityError")],
      description: [refs.description, byId("descriptionError")],
      condition: [refs.condition, byId("conditionError")],
      alt_text: [refs.altText, byId("altTextError")],
      primary_image: [refs.primaryImage, byId("primaryImageError")]
    };
    let first = null;
    for (const [name, message] of Object.entries(errors)) {
      const pair = mapping[name];
      if (!pair) continue;
      const [field, output] = pair;
      field.setAttribute("aria-invalid", "true");
      field.setCustomValidity(message);
      output.textContent = message;
      first ||= field;
    }
    first?.focus();
  }

  function openEditor(find = null) {
    clearErrors();
    refs.findForm.reset();
    refs.findForm.dataset.findId = find?.id || "";
    refs.editorEyebrow.textContent = find ? find.public_id : "Create";
    refs.editorTitle.textContent = find ? `Edit ${find.title}` : "New Find";
    refs.title.value = find?.title || "";
    refs.collectionId.value = find?.collection_id || "";
    refs.priceAmount.value = find?.price_amount === undefined ? "" : Number(find.price_amount).toFixed(2);
    refs.availability.value = find?.availability || "available";
    refs.description.value = find?.description || "";
    refs.condition.value = find?.condition || "";
    refs.altText.value = find?.primaryPhoto?.alt_text || "";
    refs.hideFindButton.hidden = !find || !find.is_published || Boolean(find.archived_at);
    refs.archiveFindButton.hidden = !find || Boolean(find.archived_at);
    refs.restoreFindButton.hidden = !find?.archived_at;
    setPreview(find?.primaryPhoto?.publicUrl || null, find?.primaryPhoto?.alt_text || "Primary image");
    refs.editorSection.hidden = false;
    refs.editorTitle.focus();
    refs.editorSection.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function closeEditor() {
    clearPreviewUrl();
    refs.editorSection.hidden = true;
    refs.findForm.reset();
    refs.findForm.dataset.findId = "";
    refs.newFindButton.focus();
  }

  function readForm() {
    return {
      title: refs.title.value,
      collection_id: refs.collectionId.value,
      price_amount: refs.priceAmount.value,
      availability: refs.availability.value,
      description: refs.description.value,
      condition: refs.condition.value,
      alt_text: refs.altText.value
    };
  }

  function setSaving(saving) {
    for (const control of refs.findForm.querySelectorAll("button, input, select, textarea")) {
      control.disabled = saving;
    }
    refs.cancelEditButton.disabled = saving;
    refs.newFindButton.disabled = saving;
    refs.catalogFilter.disabled = saving;
  }

  return {
    refs,
    setStatus,
    setAuthState,
    setSession,
    setCatalogLoading,
    setCollections,
    renderCatalog,
    currentFind,
    openEditor,
    closeEditor,
    readForm,
    showErrors,
    clearErrors,
    setPreview,
    setSaving
  };
}
