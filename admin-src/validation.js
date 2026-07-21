export const AVAILABILITY_VALUES = Object.freeze(["available", "reserved", "sold"]);
export const IMAGE_MIME_TYPES = Object.freeze(["image/jpeg", "image/png", "image/webp"]);
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

function trimmed(value) {
  return typeof value === "string" ? value.trim() : "";
}

export function normalizePrice(value) {
  const candidate = trimmed(String(value ?? ""));

  if (!/^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(candidate)) {
    return null;
  }

  const numeric = Number(candidate);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return null;
  }

  return numeric.toFixed(2);
}

export function validateFindInput(input, { hasSelectedImage = false } = {}) {
  const title = trimmed(input.title);
  const collectionId = trimmed(input.collection_id);
  const description = trimmed(input.description);
  const condition = trimmed(input.condition);
  const altText = trimmed(input.alt_text);
  const availability = trimmed(input.availability);
  const priceAmount = normalizePrice(input.price_amount);
  const errors = {};

  if (title.length < 1 || title.length > 200) {
    errors.title = "Enter a title between 1 and 200 characters.";
  }
  if (!collectionId) {
    errors.collection_id = "Choose a Collection.";
  }
  if (priceAmount === null) {
    errors.price_amount = "Enter a positive USD price with no more than two decimal places.";
  }
  if (!AVAILABILITY_VALUES.includes(availability)) {
    errors.availability = "Choose available, reserved, or sold.";
  }
  if (description.length < 1 || description.length > 5000) {
    errors.description = "Enter a description between 1 and 5,000 characters.";
  }
  if (condition.length > 500) {
    errors.condition = "Condition must be no more than 500 characters.";
  }
  if ((hasSelectedImage && altText.length < 1) || altText.length > 500) {
    errors.alt_text = "Describe the image in 1 to 500 characters.";
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
    value: {
      title,
      collection_id: collectionId,
      price_amount: priceAmount,
      price_currency: "USD",
      availability,
      description,
      condition: condition || null,
      alt_text: altText,
      is_published: Boolean(input.is_published)
    }
  };
}

export function validatePhotoFile(file) {
  if (!file) {
    return { valid: true, error: null };
  }
  if (!IMAGE_MIME_TYPES.includes(file.type)) {
    return { valid: false, error: "Choose a JPEG, PNG, or WebP image." };
  }
  if (!Number.isFinite(file.size) || file.size <= 0 || file.size > MAX_IMAGE_BYTES) {
    return { valid: false, error: "Choose an image no larger than 10 MiB." };
  }
  return { valid: true, error: null };
}

export function readImageDimensions(file, dependencies = {}) {
  const ImageConstructor = dependencies.ImageConstructor || globalThis.Image;
  const createObjectURL = dependencies.createObjectURL || globalThis.URL?.createObjectURL?.bind(globalThis.URL);
  const revokeObjectURL = dependencies.revokeObjectURL || globalThis.URL?.revokeObjectURL?.bind(globalThis.URL);

  if (!ImageConstructor || !createObjectURL || !revokeObjectURL) {
    return Promise.reject(new Error("This browser cannot inspect the selected image."));
  }

  return new Promise((resolve, reject) => {
    const objectUrl = createObjectURL(file);
    const image = new ImageConstructor();

    const release = () => revokeObjectURL(objectUrl);
    image.onload = () => {
      const width = image.naturalWidth;
      const height = image.naturalHeight;
      release();
      if (!width || !height) {
        reject(new Error("The selected image has invalid dimensions."));
        return;
      }
      resolve({ width, height });
    };
    image.onerror = () => {
      release();
      reject(new Error("The selected image could not be read."));
    };
    image.src = objectUrl;
  });
}
