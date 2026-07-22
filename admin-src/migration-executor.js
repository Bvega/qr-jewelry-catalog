import { EXPECTED_PUBLIC_IDS, PRESERVED_PUBLIC_IDS, verifyPhotoBlob } from "./migration-plan.js";

export const CONFIRMATION_PHRASE = "IMPORT 4 FINDS";
export const DRY_RUN_MAX_AGE_MS = 5 * 60 * 1000;
export const IMAGE_BUCKET = "find-images";

const FIND_COLUMNS = [
  "id", "public_id", "slug", "legacy_id", "title", "collection_id", "price_amount",
  "price_currency", "availability", "description", "condition", "is_published", "is_featured",
  "sort_order", "published_at", "archived_at"
].join(",");
const PHOTO_COLUMNS = "id,find_id,storage_path,role,sequence,alt_text,width,height";

export class MigrationWorkflowError extends Error {
  constructor(message, { partial = false, rollbackFailed = false, manualReview = false } = {}) {
    super(message);
    this.name = "MigrationWorkflowError";
    this.partial = partial;
    this.rollbackFailed = rollbackFailed;
    this.manualReview = manualReview;
  }
}

function errorResult(result, message) {
  if (result?.error) throw new MigrationWorkflowError(message);
  return result?.data || [];
}

async function loadDatabase(client) {
  const [collectionsResult, findsResult, photosResult, relationsResult] = await Promise.all([
    client.from("collections").select("id,label,status,sort_order,description"),
    client.from("finds").select(FIND_COLUMNS),
    client.from("find_photos").select(PHOTO_COLUMNS),
    client.from("find_relations").select("find_id,related_find_id,sort_order")
  ]);
  return {
    collections: errorResult(collectionsResult, "Collection preflight could not be completed."),
    finds: errorResult(findsResult, "Find preflight could not be completed."),
    photos: errorResult(photosResult, "Photo preflight could not be completed."),
    relations: errorResult(relationsResult, "Relation preflight could not be completed.")
  };
}

function normalizedPrice(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number.toFixed(2) : "invalid";
}

export function plannedFindPayload(find) {
  return {
    public_id: find.public_id,
    slug: find.slug,
    legacy_id: null,
    title: find.title,
    collection_id: find.collection_id,
    price_amount: find.price_amount,
    price_currency: "USD",
    availability: find.availability,
    description: find.description,
    condition: find.condition,
    is_published: false,
    is_featured: false,
    sort_order: find.sort_order,
    archived_at: null
  };
}

function findMatches(actual, planned) {
  const expected = plannedFindPayload(planned);
  return actual.public_id === expected.public_id
    && actual.slug === expected.slug
    && actual.legacy_id === null
    && actual.title === expected.title
    && actual.collection_id === expected.collection_id
    && normalizedPrice(actual.price_amount) === expected.price_amount
    && actual.price_currency === "USD"
    && actual.availability === expected.availability
    && actual.description === expected.description
    && (actual.condition ?? null) === expected.condition
    && actual.is_published === false
    && actual.is_featured === false
    && actual.sort_order === expected.sort_order
    && actual.archived_at === null
    && actual.published_at === null;
}

function collectionMatches(actual, planned) {
  return actual.id === planned.id
    && actual.label === planned.label
    && actual.status === planned.status
    && actual.sort_order === planned.sort_order
    && (actual.description ?? null) === (planned.description ?? null);
}

function photoMatches(actual, planned, storagePath) {
  return actual.storage_path === storagePath
    && actual.role === "primary"
    && actual.sequence === 1
    && actual.alt_text === planned.photo.alt_text
    && actual.width === planned.photo.width
    && actual.height === planned.photo.height;
}

async function inspectStorage(client, databaseFind, plannedFind) {
  const folder = `finds/${databaseFind.id}`;
  const expectedPath = `${folder}/${plannedFind.photo.filename}`;
  const storage = client.storage.from(IMAGE_BUCKET);
  const listing = await storage.list(folder, { limit: 100, offset: 0, sortBy: { column: "name", order: "asc" } });
  if (listing.error) throw new MigrationWorkflowError(`${plannedFind.public_id} Storage preflight could not be completed.`);
  const objects = listing.data || [];
  if (objects.length > 1 || (objects.length === 1 && objects[0].name !== plannedFind.photo.filename)) {
    return { exact: false, exists: objects.some((object) => object.name === plannedFind.photo.filename), expectedPath };
  }
  if (objects.length === 0) return { exact: true, exists: false, expectedPath };
  const download = await storage.download(expectedPath);
  if (download.error || !download.data) return { exact: false, exists: true, expectedPath };
  try {
    await verifyPhotoBlob(download.data, plannedFind.photo);
    return { exact: true, exists: true, expectedPath };
  } catch {
    return { exact: false, exists: true, expectedPath };
  }
}

function fingerprint(preflight) {
  return JSON.stringify({
    collections: preflight.collections.map(({ id, state }) => ({ id, state })),
    records: preflight.records.map(({ public_id, state, photo_metadata, storage_object }) => ({
      public_id,
      state,
      photo_metadata,
      storage_object
    }))
  });
}

export async function performDryRun({ client, verified, clock = Date.now }) {
  const errors = [];
  const role = await client.rpc("current_catalog_admin_role");
  if (role.error || role.data !== "owner") {
    return {
      ready: false,
      all_complete: false,
      errors: ["Owner authorization is required for this migration."],
      collections: [],
      records: [],
      writes: 0,
      created_at_ms: clock(),
      fingerprint: "unauthorized"
    };
  }

  const database = await loadDatabase(client);
  const collectionsById = new Map(database.collections.map((collection) => [collection.id, collection]));
  const collectionStates = verified.plan.collections.map((collection) => {
    const actual = collectionsById.get(collection.id);
    if (!actual) return { id: collection.id, state: "absent" };
    if (!collectionMatches(actual, collection)) {
      errors.push(`Collection ${collection.id} does not match the approved definition.`);
      return { id: collection.id, state: "mismatch" };
    }
    return { id: collection.id, state: "exact" };
  });

  const findsByPublicId = new Map(database.finds.map((find) => [find.public_id, find]));
  for (const publicId of PRESERVED_PUBLIC_IDS) {
    if (findsByPublicId.has(publicId)) errors.push(`${publicId} is present in this migration target.`);
  }
  const targetSlugs = new Set(verified.plan.finds.map((find) => find.slug));
  for (const find of database.finds) {
    if (targetSlugs.has(find.slug) && !EXPECTED_PUBLIC_IDS.includes(find.public_id)) {
      const planned = verified.plan.finds.find((entry) => entry.slug === find.slug);
      errors.push(`${planned.public_id} slug belongs to another Find.`);
    }
  }

  const photosByFind = new Map();
  for (const photo of database.photos) {
    if (!photosByFind.has(photo.find_id)) photosByFind.set(photo.find_id, []);
    photosByFind.get(photo.find_id).push(photo);
  }
  const relatedIds = new Set();
  for (const relation of database.relations) {
    relatedIds.add(relation.find_id);
    relatedIds.add(relation.related_find_id);
  }

  const records = [];
  for (const planned of verified.plan.finds) {
    const actual = findsByPublicId.get(planned.public_id);
    if (!actual) {
      records.push({
        public_id: planned.public_id,
        state: "absent",
        photo_metadata: "absent",
        storage_object: "absent",
        databaseFind: null,
        databasePhoto: null,
        storagePath: null
      });
      continue;
    }
    if (!findMatches(actual, planned)) {
      errors.push(`${planned.public_id} has a field, slug, Collection, or visibility mismatch.`);
      records.push({ public_id: planned.public_id, state: "mismatch", photo_metadata: "unknown", storage_object: "unknown", databaseFind: actual });
      continue;
    }
    if (relatedIds.has(actual.id)) {
      errors.push(`${planned.public_id} has an unexpected relation.`);
    }

    const expectedPath = `finds/${actual.id}/${planned.photo.filename}`;
    const photos = photosByFind.get(actual.id) || [];
    const conflictingPathOwner = database.photos.some((photo) => (
      photo.storage_path === expectedPath && photo.find_id !== actual.id
    ));
    let databasePhoto = null;
    let metadataState = "absent";
    if (
      conflictingPathOwner
      || photos.length > 1
      || (photos.length === 1 && !photoMatches(photos[0], planned, expectedPath))
    ) {
      metadataState = "mismatch";
      errors.push(`${planned.public_id} has conflicting primary photo metadata.`);
    } else if (photos.length === 1) {
      databasePhoto = photos[0];
      metadataState = "exact";
    }

    const storage = await inspectStorage(client, actual, planned);
    if (!storage.exact) errors.push(`${planned.public_id} has a conflicting Storage object.`);
    const objectState = storage.exists && storage.exact ? "exact" : storage.exists ? "mismatch" : "absent";
    const state = metadataState === "mismatch" || !storage.exact
      ? "mismatch"
      : metadataState === "exact" && objectState === "exact"
        ? "complete"
        : "resumable";
    records.push({
      public_id: planned.public_id,
      state,
      photo_metadata: metadataState,
      storage_object: objectState,
      databaseFind: actual,
      databasePhoto,
      storagePath: storage.expectedPath
    });
  }

  const preflight = {
    ready: errors.length === 0,
    all_complete: errors.length === 0 && records.every((record) => record.state === "complete"),
    errors,
    collections: collectionStates,
    records,
    writes: 0,
    created_at_ms: clock()
  };
  preflight.fingerprint = fingerprint(preflight);
  return preflight;
}

export async function prepareFreshDryRun({ client, loadSources, clock = Date.now }) {
  if (typeof loadSources !== "function") {
    throw new MigrationWorkflowError("Fresh local source verification is required for every dry-run.");
  }
  const verified = await loadSources();
  const dryRun = await performDryRun({ client, verified, clock });
  return { verified, dryRun };
}

export function createExecutionGate({ clock = Date.now, maxAgeMs = DRY_RUN_MAX_AGE_MS } = {}) {
  let dryRun = null;
  return {
    setDryRun(value) {
      dryRun = value?.ready ? value : null;
    },
    clear() {
      dryRun = null;
    },
    canExecute({ checked, phrase }) {
      return Boolean(
        dryRun?.ready
        && !dryRun.all_complete
        && clock() - dryRun.created_at_ms <= maxAgeMs
        && checked
        && phrase === CONFIRMATION_PHRASE
      );
    },
    requireCurrent({ checked, phrase }) {
      if (!this.canExecute({ checked, phrase })) {
        throw new MigrationWorkflowError("A current dry-run and exact confirmation are required.");
      }
      return dryRun;
    }
  };
}

async function ensureCollections(client, plan, states) {
  for (const state of states) {
    if (state.state === "exact") continue;
    const collection = plan.collections.find((entry) => entry.id === state.id);
    try {
      await client.from("collections").insert(collection);
    } catch {
      // The exact post-state below is authoritative for ambiguous responses.
    }
    let reload;
    try {
      reload = await client.from("collections")
        .select("id,label,status,sort_order,description")
        .eq("id", collection.id)
        .maybeSingle();
    } catch {
      throw new MigrationWorkflowError(
        `Collection ${collection.id} create response was ambiguous and its exact state could not be inspected.`,
        { partial: true, rollbackFailed: true, manualReview: true }
      );
    }
    if (reload.error || !reload.data || !collectionMatches(reload.data, collection)) {
      throw new MigrationWorkflowError(
        `Collection ${collection.id} could not be verified after its create attempt.`,
        { partial: true }
      );
    }
  }
}

async function inspectFindByPublicId(client, planned) {
  const result = await client.from("finds").select(FIND_COLUMNS).eq("public_id", planned.public_id);
  if (result.error) throw new MigrationWorkflowError(`${planned.public_id} post-write state could not be inspected.`, { partial: true });
  const rows = result.data || [];
  if (rows.length === 0) return { state: "absent", row: null };
  if (rows.length === 1 && findMatches(rows[0], planned)) return { state: "exact", row: rows[0] };
  return { state: "mismatch", row: rows[0] || null };
}

async function insertFind(client, planned) {
  let result;
  try {
    result = await client.from("finds").insert(plannedFindPayload(planned)).select(FIND_COLUMNS).single();
  } catch {
    result = { data: null, error: true };
  }
  if (!result.error && result.data?.id) {
    if (findMatches(result.data, planned)) return result.data;
    const recovered = await removeFindVerified(client, result.data.id);
    throw new MigrationWorkflowError(
      recovered
        ? `${planned.public_id} insert verification failed and the confirmed new Find was rolled back.`
        : `${planned.public_id} insert verification failed and rollback could not be verified.`,
      { partial: true, rollbackFailed: !recovered }
    );
  }

  let state;
  try {
    state = await inspectFindByPublicId(client, planned);
  } catch {
    throw new MigrationWorkflowError(
      `${planned.public_id} insert response was ambiguous and requires manual review.`,
      { partial: true, rollbackFailed: true, manualReview: true }
    );
  }
  if (state.state === "absent") {
    throw new MigrationWorkflowError(
      `${planned.public_id} insert failed; a fresh inspection confirmed that no target Find exists.`,
      { partial: true }
    );
  }
  throw new MigrationWorkflowError(
    `${planned.public_id} insert response was ambiguous; the observed Find was not deleted because this attempt cannot prove ownership.`,
    { partial: true, rollbackFailed: true, manualReview: true }
  );
}

async function inspectPhotoMetadata(client, databaseFind, planned, storagePath) {
  const result = await client.from("find_photos").select(PHOTO_COLUMNS);
  if (result.error) throw new MigrationWorkflowError(`${planned.public_id} photo metadata state could not be inspected.`, { partial: true });
  const rows = result.data || [];
  const associated = rows.filter((photo) => photo.find_id === databaseFind.id);
  const pathConflict = rows.some((photo) => photo.storage_path === storagePath && photo.find_id !== databaseFind.id);
  if (associated.length === 0 && !pathConflict) return { state: "absent", row: null };
  if (associated.length === 1 && !pathConflict && photoMatches(associated[0], planned, storagePath)) {
    return { state: "exact", row: associated[0] };
  }
  return { state: "mismatch", row: associated[0] || null };
}

async function verifyFindAbsent(client, findId) {
  try {
    const result = await client.from("finds").select("id").eq("id", findId);
    return !result.error && (result.data || []).length === 0;
  } catch {
    return false;
  }
}

async function verifyPhotoAbsent(client, photoId) {
  try {
    const result = await client.from("find_photos").select("id").eq("id", photoId);
    return !result.error && (result.data || []).length === 0;
  } catch {
    return false;
  }
}

async function verifyObjectAbsent(client, find, planned) {
  try {
    const state = await inspectStorage(client, find, planned);
    return state.exact && !state.exists;
  } catch {
    return false;
  }
}

async function removeObjectVerified(client, find, planned, storagePath) {
  try {
    await client.storage.from(IMAGE_BUCKET).remove([storagePath]);
  } catch {
    // A fresh read below reconciles ambiguous delete responses.
  }
  return verifyObjectAbsent(client, find, planned);
}

async function removeFindVerified(client, findId) {
  try {
    await client.from("finds").delete().eq("id", findId);
  } catch {
    // A fresh read below reconciles ambiguous delete responses.
  }
  return verifyFindAbsent(client, findId);
}

async function removePhotoVerified(client, photoId) {
  try {
    await client.from("find_photos").delete().eq("id", photoId);
  } catch {
    // A fresh read below reconciles ambiguous delete responses.
  }
  return verifyPhotoAbsent(client, photoId);
}

async function recoverFailure({ client, attempt }) {
  if (attempt.photoCreated?.id) {
    await removePhotoVerified(client, attempt.photoCreated.id);
  }
  if (attempt.objectCreated) {
    await removeObjectVerified(client, attempt.find, attempt.planned, attempt.storagePath);
  }
  if (attempt.newFind) {
    await removeFindVerified(client, attempt.find.id);
  }

  const checks = [];
  if (attempt.photoCreated?.id) checks.push(await verifyPhotoAbsent(client, attempt.photoCreated.id));
  if (attempt.objectCreated) checks.push(await verifyObjectAbsent(client, attempt.find, attempt.planned));
  if (attempt.newFind) checks.push(await verifyFindAbsent(client, attempt.find.id));
  return checks.every(Boolean);
}

async function rollbackAttempts(client, attempts) {
  let recovered = true;
  for (const attempt of [...attempts].reverse()) {
    recovered = await recoverFailure({ client, attempt }) && recovered;
  }
  return recovered;
}

async function failAfterRollback(client, attempts, publicId, reason) {
  const recovered = await rollbackAttempts(client, attempts);
  throw new MigrationWorkflowError(
    recovered
      ? `${publicId} ${reason}; attempt-created artifacts were rolled back and their absence was verified.`
      : `${publicId} ${reason}; rollback could not be verified and remaining Finds were stopped.`,
    { partial: true, rollbackFailed: !recovered }
  );
}

function manualReviewError(publicId, reason) {
  return new MigrationWorkflowError(
    `${publicId} ${reason}; ownership could not be proved, so no unconfirmed artifact was deleted. Manual review is required.`,
    { partial: true, rollbackFailed: true, manualReview: true }
  );
}

function emitProgress(onProgress, value) {
  try {
    onProgress(value);
  } catch {
    // Progress rendering cannot alter or obscure migration safety state.
  }
}

async function finishPhoto({ client, verified, planned, record, databaseFind, newFind }) {
  const storagePath = record.storagePath || `finds/${databaseFind.id}/${planned.photo.filename}`;
  const attempt = {
    planned,
    record: { ...record, storagePath },
    find: databaseFind,
    storagePath,
    newFind,
    objectCreated: false,
    photoCreated: null
  };

  let blob;
  try {
    blob = verified.photos.get(planned.public_id);
    await verifyPhotoBlob(blob, planned.photo);
  } catch {
    return failAfterRollback(client, [attempt], planned.public_id, "photo verification failed after the Find create step");
  }

  if (record.storage_object !== "exact") {
    let upload;
    try {
      upload = await client.storage.from(IMAGE_BUCKET).upload(storagePath, blob, {
        cacheControl: "3600",
        contentType: planned.photo.mime_type,
        upsert: false
      });
    } catch {
      upload = { data: null, error: true };
    }

    if (!upload.error && upload.data?.path === storagePath) {
      attempt.objectCreated = true;
    } else {
      let observed;
      try {
        observed = await inspectStorage(client, databaseFind, planned);
      } catch {
        throw manualReviewError(planned.public_id, "image upload response and fresh Storage inspection were ambiguous");
      }
      if (observed.exact && !observed.exists) {
        return failAfterRollback(client, [attempt], planned.public_id, "image upload failed and fresh inspection confirmed no object");
      }
      if (observed.exact && observed.exists && newFind) {
        attempt.objectCreated = true;
        return failAfterRollback(client, [attempt], planned.public_id, "image upload response was ambiguous on the confirmed new Find path");
      }
      throw manualReviewError(planned.public_id, "image upload response was ambiguous and the observed object may be pre-existing or concurrent");
    }
  }

  if (record.photo_metadata !== "exact") {
    let metadata;
    try {
      metadata = await client.from("find_photos").insert({
        find_id: databaseFind.id,
        storage_path: storagePath,
        role: "primary",
        sequence: 1,
        alt_text: planned.photo.alt_text,
        width: planned.photo.width,
        height: planned.photo.height
      }).select(PHOTO_COLUMNS).single();
    } catch {
      metadata = { data: null, error: true };
    }

    const responseConfirmsCreation = !metadata.error
      && metadata.data?.id
      && metadata.data.find_id === databaseFind.id;
    if (responseConfirmsCreation) {
      attempt.photoCreated = metadata.data;
      if (!photoMatches(metadata.data, planned, storagePath)) {
        return failAfterRollback(client, [attempt], planned.public_id, "photo metadata response did not match the approved row");
      }
    } else {
      let observed;
      try {
        observed = await inspectPhotoMetadata(client, databaseFind, planned, storagePath);
      } catch {
        throw manualReviewError(planned.public_id, "photo metadata response and fresh database inspection were ambiguous");
      }
      if (observed.state === "absent") {
        return failAfterRollback(client, [attempt], planned.public_id, "photo metadata insert failed and fresh inspection confirmed no row");
      }
      if (observed.state === "exact" && newFind) {
        attempt.photoCreated = observed.row;
        return failAfterRollback(client, [attempt], planned.public_id, "photo metadata response was ambiguous on the confirmed new Find");
      }
      throw manualReviewError(planned.public_id, "photo metadata response was ambiguous and the observed row may be pre-existing or concurrent");
    }
  }

  return attempt;
}

export async function executeCatalogMigration({
  client,
  verified,
  dryRun,
  checked,
  phrase,
  clock = Date.now,
  maxAgeMs = DRY_RUN_MAX_AGE_MS,
  revalidateSources = async () => verified,
  dryRunImpl = performDryRun,
  onProgress = () => {}
}) {
  if (
    !dryRun?.ready
    || dryRun.all_complete
    || clock() - dryRun.created_at_ms > maxAgeMs
    || !checked
    || phrase !== CONFIRMATION_PHRASE
  ) {
    throw new MigrationWorkflowError("A current dry-run and exact confirmation are required.");
  }

  const currentVerified = await revalidateSources();
  if (JSON.stringify(currentVerified?.plan) !== JSON.stringify(verified.plan)) {
    throw new MigrationWorkflowError("The local migration sources changed. Run a new dry-run.");
  }
  const current = await dryRunImpl({ client, verified: currentVerified, clock });
  if (!current.ready || current.fingerprint !== dryRun.fingerprint) {
    throw new MigrationWorkflowError("The dry-run is stale. Run it again before execution.");
  }
  await ensureCollections(client, currentVerified.plan, current.collections);

  const results = [];
  const completedAttempts = [];
  for (const planned of currentVerified.plan.finds) {
    const record = current.records.find((entry) => entry.public_id === planned.public_id);
    emitProgress(onProgress, { public_id: planned.public_id, state: "running" });
    if (record.state === "complete") {
      results.push({ public_id: planned.public_id, state: "skipped" });
      emitProgress(onProgress, { public_id: planned.public_id, state: "skipped" });
      continue;
    }

    const newFind = record.state === "absent";
    const databaseFind = newFind ? await insertFind(client, planned) : record.databaseFind;
    const executionRecord = newFind
      ? { ...record, state: "resumable", photo_metadata: "absent", storage_object: "absent", storagePath: `finds/${databaseFind.id}/${planned.photo.filename}` }
      : record;
    const attempt = await finishPhoto({ client, verified: currentVerified, planned, record: executionRecord, databaseFind, newFind });

    let exactPostWriteState = false;
    try {
      const verification = await dryRunImpl({ client, verified: currentVerified, clock });
      const verifiedRecord = verification.records.find((entry) => entry.public_id === planned.public_id);
      exactPostWriteState = verification.ready && verifiedRecord?.state === "complete";
    } catch {
      return failAfterRollback(client, [attempt], planned.public_id, "post-write verification threw an exception");
    }
    if (!exactPostWriteState) {
      return failAfterRollback(client, [attempt], planned.public_id, "post-write verification did not reach the exact complete state");
    }
    completedAttempts.push(attempt);
    results.push({ public_id: planned.public_id, state: newFind ? "imported" : "resumed" });
    emitProgress(onProgress, { public_id: planned.public_id, state: newFind ? "imported" : "resumed" });
  }

  let finalDryRun;
  let exactFinalState = false;
  try {
    finalDryRun = await dryRunImpl({ client, verified: currentVerified, clock });
    exactFinalState = finalDryRun.ready && finalDryRun.all_complete;
  } catch {
    return failAfterRollback(client, completedAttempts, "Migration", "final verification threw an exception");
  }
  if (!exactFinalState) {
    return failAfterRollback(client, completedAttempts, "Migration", "final verification did not reach four complete Finds");
  }
  return { state: "complete", results, dryRun: finalDryRun };
}
