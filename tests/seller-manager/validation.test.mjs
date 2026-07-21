import assert from "node:assert/strict";
import test from "node:test";
import {
  MAX_IMAGE_BYTES,
  normalizePrice,
  validateFindInput,
  validatePhotoFile
} from "../../admin-src/validation.js";

test("price normalization accepts positive USD values with at most two decimals", () => {
  assert.equal(normalizePrice(" 12 "), "12.00");
  assert.equal(normalizePrice("12.5"), "12.50");
  assert.equal(normalizePrice("12.50"), "12.50");
  for (const invalid of ["", "0", "-1", "1.234", ".50", "1e2", "Infinity"]) {
    assert.equal(normalizePrice(invalid), null, invalid);
  }
});

test("Find validation trims approved values and enforces every field boundary", () => {
  const result = validateFindInput({
    title: "  Fictional Find  ",
    collection_id: "jewelry",
    price_amount: "19.9",
    availability: "available",
    description: "  A test-only description.  ",
    condition: "  Excellent  ",
    alt_text: "  A test object on a plain background.  "
  }, { hasSelectedImage: true });

  assert.equal(result.valid, true);
  assert.deepEqual(result.value, {
    title: "Fictional Find",
    collection_id: "jewelry",
    price_amount: "19.90",
    price_currency: "USD",
    availability: "available",
    description: "A test-only description.",
    condition: "Excellent",
    alt_text: "A test object on a plain background.",
    is_published: false
  });

  const invalid = validateFindInput({
    title: " ", collection_id: "", price_amount: "0", availability: "missing",
    description: "", condition: "x".repeat(501), alt_text: ""
  }, { hasSelectedImage: true });
  assert.equal(invalid.valid, false);
  assert.deepEqual(Object.keys(invalid.errors).sort(), [
    "alt_text", "availability", "collection_id", "condition", "description", "price_amount", "title"
  ]);
});

test("photo validation permits only JPEG, PNG, and WebP through 10 MiB", () => {
  for (const type of ["image/jpeg", "image/png", "image/webp"]) {
    assert.equal(validatePhotoFile({ type, size: MAX_IMAGE_BYTES }).valid, true);
  }
  assert.equal(validatePhotoFile({ type: "image/gif", size: 100 }).valid, false);
  assert.equal(validatePhotoFile({ type: "image/jpeg", size: MAX_IMAGE_BYTES + 1 }).valid, false);
  assert.equal(validatePhotoFile({ type: "image/jpeg", size: 0 }).valid, false);
});
