const FIND_COLUMNS = [
  "id",
  "public_id",
  "title",
  "collection_id",
  "price_amount",
  "price_currency",
  "availability",
  "description",
  "condition",
  "is_published",
  "archived_at"
].join(",");

export class CatalogPublicationError extends Error {
  constructor(message, code) {
    super(message);
    this.name = "CatalogPublicationError";
    this.code = code;
  }
}

function throwIfError(result, fallback) {
  if (result.error) {
    throw new Error(result.error.message || fallback);
  }
  return result.data;
}

export function toFindPayload(value) {
  return {
    title: value.title,
    collection_id: value.collection_id,
    price_amount: value.price_amount,
    price_currency: "USD",
    availability: value.availability,
    description: value.description,
    condition: value.condition
  };
}

export function archivePayload(now = new Date()) {
  return { archived_at: now.toISOString(), is_published: false };
}

export function restorePayload() {
  return { archived_at: null, is_published: false };
}

export function createSubmissionGuard() {
  let active = false;

  return {
    get active() {
      return active;
    },
    async run(operation) {
      if (active) return { skipped: true };
      active = true;
      try {
        return await operation();
      } finally {
        active = false;
      }
    }
  };
}

export async function runConfirmedPublication(confirmAction, message, operation) {
  if (
    typeof confirmAction !== "function" ||
    typeof operation !== "function" ||
    !confirmAction(message)
  ) {
    return { cancelled: true };
  }
  return { cancelled: false, value: await operation() };
}

export async function loadCatalog(client) {
  const collectionsRequest = client
    .from("collections")
    .select("id,label,status,sort_order")
    .order("sort_order", { ascending: true })
    .order("id", { ascending: true });
  const findsRequest = client
    .from("finds")
    .select(FIND_COLUMNS)
    .order("public_id", { ascending: true });
  const photosRequest = client
    .from("find_photos")
    .select("id,find_id,storage_path,alt_text,width,height,sequence")
    .eq("role", "primary")
    .order("sequence", { ascending: true });

  const [collectionsResult, findsResult, photosResult] = await Promise.all([
    collectionsRequest,
    findsRequest,
    photosRequest
  ]);
  const collections = throwIfError(collectionsResult, "Collections could not be loaded.") || [];
  const finds = throwIfError(findsResult, "Finds could not be loaded.") || [];
  const photos = throwIfError(photosResult, "Primary photos could not be loaded.") || [];
  const primaryByFind = new Map(photos.map((photo) => [photo.find_id, photo]));

  return {
    collections,
    finds: finds.map((find) => ({ ...find, primaryPhoto: primaryByFind.get(find.id) || null }))
  };
}

export async function createFind(client, value) {
  const result = await client
    .from("finds")
    .insert({ ...toFindPayload(value), is_published: false })
    .select(FIND_COLUMNS)
    .single();
  return throwIfError(result, "The Find could not be created.");
}

export async function updateFind(client, findId, value) {
  const result = await client
    .from("finds")
    .update(toFindPayload(value))
    .eq("id", findId)
    .select(FIND_COLUMNS)
    .single();
  return throwIfError(result, "The Find could not be updated.");
}

function publicationFailure(error) {
  const status = Number(error?.status);
  const code = String(error?.code || "");
  if (status === 401 || code === "PGRST301") {
    return new CatalogPublicationError(
      "Your session expired. Sign in again before changing publication.",
      "session"
    );
  }
  if (status === 403 || code === "42501") {
    return new CatalogPublicationError(
      "Your account is not authorized to change publication.",
      "authorization"
    );
  }
  return new CatalogPublicationError(
    "Publication could not be changed. Refresh the catalog and try again.",
    "request"
  );
}

export async function loadFind(client, findId) {
  const result = await client
    .from("finds")
    .select(FIND_COLUMNS)
    .eq("id", findId)
    .single();
  if (result.error) throw publicationFailure(result.error);
  return result.data;
}

export async function setFindPublished(client, snapshot, isPublished) {
  if (!snapshot?.id || typeof snapshot.is_published !== "boolean") {
    throw new CatalogPublicationError(
      "Publication state is unavailable. Refresh the catalog and try again.",
      "snapshot"
    );
  }
  const target = Boolean(isPublished);
  const result = await client
    .from("finds")
    .update({ is_published: target })
    .eq("id", snapshot.id)
    .eq("is_published", snapshot.is_published)
    .is("archived_at", null)
    .select(FIND_COLUMNS)
    .maybeSingle();
  if (result.error) throw publicationFailure(result.error);
  if (!result.data || result.data.is_published !== target || result.data.archived_at !== null) {
    throw new CatalogPublicationError(
      "This Find changed elsewhere. Refresh the catalog before trying again.",
      "conflict"
    );
  }

  const verified = await loadFind(client, snapshot.id);
  if (verified.is_published !== target || verified.archived_at !== null) {
    throw new CatalogPublicationError(
      "The final publication state could not be verified. Refresh the catalog.",
      "verification"
    );
  }
  return verified;
}

export async function archiveFind(client, findId, now) {
  const result = await client
    .from("finds")
    .update(archivePayload(now))
    .eq("id", findId)
    .select(FIND_COLUMNS)
    .single();
  return throwIfError(result, "The Find could not be archived.");
}

export async function restoreFind(client, findId) {
  const result = await client
    .from("finds")
    .update(restorePayload())
    .eq("id", findId)
    .select(FIND_COLUMNS)
    .single();
  return throwIfError(result, "The Find could not be restored.");
}
