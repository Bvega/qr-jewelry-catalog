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
  "archived_at",
  "created_at",
  "updated_at"
].join(",");

function throwIfError(result, fallback) {
  if (result.error) {
    throw new Error(result.error.message || fallback);
  }
  return result.data;
}

export function toFindPayload(value, { publish = false } = {}) {
  return {
    title: value.title,
    collection_id: value.collection_id,
    price_amount: value.price_amount,
    price_currency: "USD",
    availability: value.availability,
    description: value.description,
    condition: value.condition,
    is_published: Boolean(publish)
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

export async function createFind(client, value, { publish = false } = {}) {
  const result = await client
    .from("finds")
    .insert(toFindPayload(value, { publish }))
    .select(FIND_COLUMNS)
    .single();
  return throwIfError(result, "The Find could not be created.");
}

export async function updateFind(client, findId, value, { publish = false } = {}) {
  const result = await client
    .from("finds")
    .update(toFindPayload(value, { publish }))
    .eq("id", findId)
    .select(FIND_COLUMNS)
    .single();
  return throwIfError(result, "The Find could not be updated.");
}

export async function setFindPublished(client, findId, isPublished) {
  const result = await client
    .from("finds")
    .update({ is_published: Boolean(isPublished) })
    .eq("id", findId)
    .select(FIND_COLUMNS)
    .single();
  return throwIfError(result, "The Find visibility could not be changed.");
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
