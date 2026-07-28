import assert from "node:assert/strict";
import test from "node:test";
import {
  PhotoWorkflowError,
  createStoragePath,
  getPrimaryImageUrl,
  uploadPrimaryImage
} from "../../admin-src/photos.js";

const findId = "20000000-0000-4000-8000-000000000201";
const file = { type: "image/jpeg", size: 2048 };
const newObjectId = "30000000-0000-4000-8000-000000000301";

function createPhotoClient({ updateError = null, insertError = null, oldCleanupError = null } = {}) {
  const calls = { uploads: [], removes: [], updates: [], inserts: [] };
  const storage = {
    upload: async (path) => {
      calls.uploads.push(path);
      return { error: null };
    },
    remove: async (paths) => {
      calls.removes.push(paths);
      return { error: paths[0].includes("old") ? oldCleanupError : null };
    },
    download: async (path) => ({ data: { fictionalBlobFor: path }, error: null })
  };
  function terminal(data, error) {
    return {
      eq() { return this; },
      select() { return this; },
      async single() { return { data, error }; }
    };
  }
  const client = {
    storage: { from: () => storage },
    from: () => ({
      update(payload) {
        calls.updates.push(payload);
        return terminal({ id: "photo-id", find_id: findId, ...payload, sequence: 1 }, updateError);
      },
      insert(payload) {
        calls.inserts.push(payload);
        return terminal({ id: "photo-id", ...payload }, insertError);
      }
    })
  };
  return { client, calls };
}

test("Storage paths are Find-scoped, typed, and collision resistant", () => {
  const ids = [
    "30000000-0000-4000-8000-000000000301",
    "30000000-0000-4000-8000-000000000302"
  ];
  const first = createStoragePath(findId, { type: "image/webp" }, () => ids.shift());
  const second = createStoragePath(findId, { type: "image/webp" }, () => ids.shift());
  assert.match(first, new RegExp(`^finds/${findId}/[0-9a-f-]+\\.webp$`));
  assert.notEqual(first, second);
});

test("new image uploads before metadata insertion", async () => {
  const { client, calls } = createPhotoClient();
  const result = await uploadPrimaryImage({
    client, findId, file, altText: " Test image ", width: 100, height: 80,
    randomUUID: () => newObjectId
  });
  assert.equal(calls.uploads.length, 1);
  assert.deepEqual(calls.inserts[0], {
    find_id: findId,
    role: "primary",
    sequence: 1,
    storage_path: `finds/${findId}/${newObjectId}.jpg`,
    alt_text: "Test image",
    width: 100,
    height: 80
  });
  assert.equal(calls.removes.length, 0);
  assert.equal(result.warning, null);
});

test("metadata insertion failure removes the new object as best-effort cleanup", async () => {
  const { client, calls } = createPhotoClient({ insertError: new Error("insert failed") });
  await assert.rejects(
    uploadPrimaryImage({
      client, findId, file, altText: "Test image", width: 100, height: 80,
      randomUUID: () => newObjectId
    }),
    (error) => error instanceof PhotoWorkflowError && error.stage === "metadata"
  );
  assert.deepEqual(calls.removes, [[`finds/${findId}/${newObjectId}.jpg`]]);
});

test("replacement updates metadata before removing the old valid object", async () => {
  const { client, calls } = createPhotoClient();
  const existingPhoto = { id: "old-photo", storage_path: `finds/${findId}/old.jpg` };
  await uploadPrimaryImage({
    client, findId, file, altText: "Replacement", width: 120, height: 90,
    existingPhoto, randomUUID: () => newObjectId
  });
  assert.equal(calls.updates.length, 1);
  assert.deepEqual(calls.removes, [[existingPhoto.storage_path]]);
});

test("replacement metadata failure removes only the new object and preserves the old image", async () => {
  const { client, calls } = createPhotoClient({ updateError: new Error("update failed") });
  const existingPhoto = { id: "old-photo", storage_path: `finds/${findId}/old.jpg` };
  await assert.rejects(uploadPrimaryImage({
    client, findId, file, altText: "Replacement", width: 120, height: 90,
    existingPhoto, randomUUID: () => newObjectId
  }), PhotoWorkflowError);
  assert.deepEqual(calls.removes, [[`finds/${findId}/${newObjectId}.jpg`]]);
  assert.equal(calls.removes.flat().includes(existingPhoto.storage_path), false);
});

test("old-object cleanup failure is reported after a valid replacement", async () => {
  const { client } = createPhotoClient({ oldCleanupError: new Error("cleanup failed") });
  const result = await uploadPrimaryImage({
    client, findId, file, altText: "Replacement", width: 120, height: 90,
    existingPhoto: { id: "old-photo", storage_path: `finds/${findId}/old.jpg` },
    randomUUID: () => newObjectId
  });
  assert.match(result.warning, /replacement is active/i);
});

test("private Find images are downloaded through Storage RLS into a page-local URL", async () => {
  const { client } = createPhotoClient();
  const path = `finds/${findId}/private.jpg`;
  const calls = [];
  const url = await getPrimaryImageUrl(
    client,
    { storage_path: path },
    (blob) => {
      calls.push(blob);
      return "blob:fictional-manager-photo";
    }
  );
  assert.equal(url, "blob:fictional-manager-photo");
  assert.deepEqual(calls, [{ fictionalBlobFor: path }]);
});
