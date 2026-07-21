import { validatePhotoFile } from "./validation.js";

export const IMAGE_BUCKET = "find-images";

const EXTENSIONS = Object.freeze({
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp"
});

export class PhotoWorkflowError extends Error {
  constructor(message, { stage, cleanupFailed = false } = {}) {
    super(message);
    this.name = "PhotoWorkflowError";
    this.stage = stage || "unknown";
    this.cleanupFailed = cleanupFailed;
  }
}

export function createStoragePath(findId, file, randomUUID = globalThis.crypto?.randomUUID?.bind(globalThis.crypto)) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(findId)) {
    throw new TypeError("A valid Find identifier is required for image storage.");
  }
  const extension = EXTENSIONS[file?.type];
  if (!extension) {
    throw new TypeError("A supported image type is required for image storage.");
  }
  if (typeof randomUUID !== "function") {
    throw new Error("Secure random identifiers are unavailable in this browser.");
  }

  return `finds/${findId}/${randomUUID()}.${extension}`;
}

async function cleanupNewObject(storage, storagePath) {
  try {
    const result = await storage.remove([storagePath]);
    return Boolean(result?.error);
  } catch {
    return true;
  }
}

function publicUrl(storage, storagePath) {
  return storage.getPublicUrl(storagePath).data.publicUrl;
}

export async function uploadPrimaryImage({
  client,
  findId,
  file,
  altText,
  width,
  height,
  existingPhoto = null,
  randomUUID
}) {
  const validation = validatePhotoFile(file);
  if (!validation.valid) {
    throw new PhotoWorkflowError(validation.error, { stage: "validation" });
  }

  const storage = client.storage.from(IMAGE_BUCKET);
  const storagePath = createStoragePath(findId, file, randomUUID);
  const upload = await storage.upload(storagePath, file, {
    cacheControl: "3600",
    contentType: file.type,
    upsert: false
  });
  if (upload.error) {
    throw new PhotoWorkflowError(upload.error.message || "The image could not be uploaded.", {
      stage: "upload"
    });
  }

  const metadata = {
    storage_path: storagePath,
    alt_text: altText.trim(),
    width,
    height
  };

  if (existingPhoto) {
    const update = await client
      .from("find_photos")
      .update(metadata)
      .eq("id", existingPhoto.id)
      .select("id,find_id,storage_path,alt_text,width,height,sequence")
      .single();

    if (update.error) {
      const cleanupFailed = await cleanupNewObject(storage, storagePath);
      throw new PhotoWorkflowError(
        cleanupFailed
          ? "The image metadata was not updated, and the unused upload could not be removed. The previous image is still active."
          : "The image metadata was not updated. The unused upload was removed and the previous image is still active.",
        { stage: "metadata", cleanupFailed }
      );
    }

    let oldCleanupFailed = false;
    try {
      const oldCleanup = await storage.remove([existingPhoto.storage_path]);
      oldCleanupFailed = Boolean(oldCleanup.error);
    } catch {
      oldCleanupFailed = true;
    }
    return {
      photo: update.data,
      publicUrl: publicUrl(storage, storagePath),
      warning: oldCleanupFailed
        ? "The replacement is active, but the previous Storage object could not be removed."
        : null
    };
  }

  const insert = await client
    .from("find_photos")
    .insert({
      find_id: findId,
      role: "primary",
      sequence: 1,
      ...metadata
    })
    .select("id,find_id,storage_path,alt_text,width,height,sequence")
    .single();

  if (insert.error) {
    const cleanupFailed = await cleanupNewObject(storage, storagePath);
    throw new PhotoWorkflowError(
      cleanupFailed
        ? "The Find was saved, but image metadata failed and the unused upload could not be removed."
        : "The Find was saved, but image metadata failed. The unused upload was removed.",
      { stage: "metadata", cleanupFailed }
    );
  }

  return {
    photo: insert.data,
    publicUrl: publicUrl(storage, storagePath),
    warning: null
  };
}

export function getPrimaryImageUrl(client, photo) {
  if (!photo?.storage_path) return null;
  return client.storage.from(IMAGE_BUCKET).getPublicUrl(photo.storage_path).data.publicUrl;
}

export async function updatePrimaryAltText(client, photoId, altText) {
  const result = await client
    .from("find_photos")
    .update({ alt_text: altText.trim() })
    .eq("id", photoId)
    .select("id,find_id,storage_path,alt_text,width,height,sequence")
    .single();
  if (result.error) {
    throw new PhotoWorkflowError(result.error.message || "Image alternative text could not be updated.", {
      stage: "metadata"
    });
  }
  return result.data;
}
