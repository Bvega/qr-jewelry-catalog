export const MAINTENANCE_SOURCE_PREFIX = "/__maintenance/m07b3";
export const MIGRATION_PLAN_URL = `${MAINTENANCE_SOURCE_PREFIX}/plan`;
export const EXPECTED_PUBLIC_IDS = Object.freeze(["BU-0006", "BU-0007", "BU-0008", "BU-0009"]);
export const PRESERVED_PUBLIC_IDS = Object.freeze(["BU-0001", "BU-0002", "BU-0003", "BU-0004", "BU-0005"]);

export const MAINTENANCE_SOURCE_URLS = Object.freeze({
  "content-intake/finds.csv": `${MAINTENANCE_SOURCE_PREFIX}/finds.csv`,
  "content-intake/photo-manifest.csv": `${MAINTENANCE_SOURCE_PREFIX}/photo-manifest.csv`,
  "data/collections.js": `${MAINTENANCE_SOURCE_PREFIX}/collections.js`,
  "docs/IDENTIFIER_REGISTRY.md": `${MAINTENANCE_SOURCE_PREFIX}/identifier-registry.md`
});

const TOP_LEVEL_KEYS = ["plan_version", "sources", "collections", "finds"];
const COLLECTION_KEYS = ["id", "label", "status", "sort_order", "description"];
const FIND_KEYS = [
  "public_id", "slug", "title", "collection_id", "price_amount", "price_currency",
  "availability", "description", "condition", "legacy_id", "is_published", "is_featured",
  "sort_order", "archived_at", "photo"
];
const PHOTO_KEYS = [
  "filename", "mime_type", "byte_size", "sha256", "width", "height", "alt_text", "role", "sequence"
];
const DISALLOWED_KEY = /(?:owner|credential|password|secret|token|session|uuid|absolute|relation|notes)/i;

export class SourceVerificationError extends Error {
  constructor(message) {
    super(message);
    this.name = "SourceVerificationError";
  }
}

function exactKeys(value, keys) {
  return value && typeof value === "object"
    && JSON.stringify(Object.keys(value)) === JSON.stringify(keys);
}

function hasDisallowedKey(value) {
  if (!value || typeof value !== "object") return false;
  return Object.entries(value).some(([key, nested]) => DISALLOWED_KEY.test(key) || hasDisallowedKey(nested));
}

export function parseCsv(source) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  const text = String(source).replace(/^\uFEFF/, "");
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted) {
      if (character === '"') {
        if (text[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          quoted = false;
        }
      } else {
        field += character;
      }
    } else if (character === '"') {
      if (field) throw new SourceVerificationError("A source CSV is malformed.");
      quoted = true;
    } else if (character === ",") {
      row.push(field);
      field = "";
    } else if (character === "\n" || character === "\r") {
      if (character === "\r" && text[index + 1] === "\n") index += 1;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += character;
    }
  }
  if (quoted) throw new SourceVerificationError("A source CSV is malformed.");
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  const nonblank = rows.filter((cells) => cells.some((cell) => cell.trim()));
  const headers = nonblank.shift();
  if (!headers) throw new SourceVerificationError("A source CSV is empty.");
  return nonblank.map((cells) => Object.fromEntries(
    headers.map((header, index) => [header, (cells[index] || "").trim()])
  ));
}

export async function sha256Hex(bytes) {
  const input = bytes instanceof ArrayBuffer
    ? bytes
    : bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", input);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function uint24LittleEndian(bytes, offset) {
  return bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16);
}

export function readImageMetadata(input) {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (
    bytes.length >= 24
    && [137, 80, 78, 71, 13, 10, 26, 10].every((value, index) => bytes[index] === value)
  ) {
    return { mime_type: "image/png", width: view.getUint32(16), height: view.getUint32(20) };
  }
  if (bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    const frames = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);
    let offset = 2;
    while (offset + 3 < bytes.length) {
      while (offset < bytes.length && bytes[offset] !== 0xff) offset += 1;
      while (offset < bytes.length && bytes[offset] === 0xff) offset += 1;
      const marker = bytes[offset];
      offset += 1;
      if (marker === 0xd8 || marker === 0xd9 || (marker >= 0xd0 && marker <= 0xd7)) continue;
      if (offset + 1 >= bytes.length) break;
      const length = view.getUint16(offset);
      if (length < 2 || offset + length > bytes.length) break;
      if (frames.has(marker) && length >= 7) {
        return { mime_type: "image/jpeg", width: view.getUint16(offset + 5), height: view.getUint16(offset + 3) };
      }
      offset += length;
    }
    throw new SourceVerificationError("JPEG dimensions could not be verified.");
  }
  const ascii = (start, end) => String.fromCharCode(...bytes.slice(start, end));
  if (bytes.length >= 30 && ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") {
    const chunk = ascii(12, 16);
    if (chunk === "VP8X") {
      return { mime_type: "image/webp", width: uint24LittleEndian(bytes, 24) + 1, height: uint24LittleEndian(bytes, 27) + 1 };
    }
    if (chunk === "VP8 " && bytes[23] === 0x9d && bytes[24] === 0x01 && bytes[25] === 0x2a) {
      return { mime_type: "image/webp", width: view.getUint16(26, true) & 0x3fff, height: view.getUint16(28, true) & 0x3fff };
    }
    if (chunk === "VP8L" && bytes[20] === 0x2f) {
      const packed = view.getUint32(21, true);
      return { mime_type: "image/webp", width: (packed & 0x3fff) + 1, height: ((packed >>> 14) & 0x3fff) + 1 };
    }
    throw new SourceVerificationError("WebP dimensions could not be verified.");
  }
  throw new SourceVerificationError("The source photo type is not approved.");
}

function validatePlanShape(plan) {
  if (!exactKeys(plan, TOP_LEVEL_KEYS) || plan.plan_version !== 1 || hasDisallowedKey(plan)) {
    throw new SourceVerificationError("The tracked plan has an unexpected structure.");
  }
  if (!exactKeys(plan.sources, Object.keys(MAINTENANCE_SOURCE_URLS))) {
    throw new SourceVerificationError("The tracked plan source contract is not exact.");
  }
  if (!Array.isArray(plan.collections) || plan.collections.length !== 6 || plan.collections.some((item) => !exactKeys(item, COLLECTION_KEYS))) {
    throw new SourceVerificationError("The tracked Collection plan is not exact.");
  }
  if (!Array.isArray(plan.finds) || plan.finds.length !== 4) {
    throw new SourceVerificationError("The tracked plan must contain four Finds.");
  }
  plan.finds.forEach((find, index) => {
    if (!exactKeys(find, FIND_KEYS) || !exactKeys(find.photo, PHOTO_KEYS)) {
      throw new SourceVerificationError(`${EXPECTED_PUBLIC_IDS[index]} has unexpected plan fields.`);
    }
    if (
      find.public_id !== EXPECTED_PUBLIC_IDS[index]
      || find.slug !== [
        "vintage-ceramic-handbell",
        "burgundy-montblanc-pen",
        "hand-painted-decorative-shell",
        "vintage-floral-teacup-saucer"
      ][index]
      || find.sort_order !== index + 6
      || find.legacy_id !== null
      || find.is_published !== false
      || find.is_featured !== false
      || find.archived_at !== null
      || find.price_currency !== "USD"
      || find.photo.role !== "primary"
      || find.photo.sequence !== 1
    ) {
      throw new SourceVerificationError(`${EXPECTED_PUBLIC_IDS[index]} has an invalid planned state.`);
    }
  });
}

function parseCollectionRegistry(source) {
  const values = [];
  for (const match of source.matchAll(/freezeCollection\(\{([\s\S]*?)\}\)/g)) {
    const block = match[1];
    const stringValue = (key) => block.match(new RegExp(`${key}:\\s*"([^"]*)"`))?.[1];
    const sortOrder = Number(block.match(/sortOrder:\s*([0-9]+)/)?.[1]);
    const status = stringValue("status");
    values.push({
      id: stringValue("id"),
      label: stringValue("label"),
      status: status === "coming-soon" ? "coming_soon" : status,
      sort_order: sortOrder,
      description: stringValue("description")
    });
  }
  return values;
}

function verifyCsvDerivation(plan, findsSource, manifestSource) {
  const intakeByKey = new Map(parseCsv(findsSource).map((record) => [record.intake_key, record]));
  const manifestByKey = new Map(parseCsv(manifestSource).map((record) => [record.intake_key, record]));
  for (const find of plan.finds) {
    const intake = intakeByKey.get(find.slug);
    const photo = manifestByKey.get(find.slug);
    if (!intake || !photo) throw new SourceVerificationError(`${find.public_id} is missing from local sources.`);
    const expected = {
      title: intake.title,
      collection_id: intake.collection,
      price_amount: Number(intake.price_amount).toFixed(2),
      price_currency: intake.price_currency,
      availability: intake.availability,
      description: intake.description,
      condition: intake.condition || null
    };
    for (const [key, value] of Object.entries(expected)) {
      if (find[key] !== value) throw new SourceVerificationError(`${find.public_id} differs from the accepted intake.`);
    }
    if (
      intake.primary_photo_filename !== find.photo.filename
      || intake.alt_text !== find.photo.alt_text
      || intake.additional_photo_filenames
      || intake.related_public_ids
      || intake.featured !== "false"
      || photo.filename !== find.photo.filename
      || photo.role !== "primary"
      || photo.sequence !== "1"
      || photo.owner_approved !== "true"
    ) {
      throw new SourceVerificationError(`${find.public_id} photo or state differs from the accepted intake.`);
    }
  }
}

async function fetchBytes(url, fetchImpl, accessToken) {
  const response = await fetchImpl(url, {
    method: "GET",
    cache: "no-store",
    credentials: "same-origin",
    redirect: "error",
    headers: { authorization: `Bearer ${accessToken}` }
  });
  if (!response.ok) throw new SourceVerificationError("A required local migration source is unavailable.");
  return new Uint8Array(await response.arrayBuffer());
}

export async function verifyPhotoBlob(blob, expected) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const image = readImageMetadata(bytes);
  if (
    bytes.byteLength !== expected.byte_size
    || await sha256Hex(bytes) !== expected.sha256
    || image.mime_type !== expected.mime_type
    || image.width !== expected.width
    || image.height !== expected.height
  ) {
    throw new SourceVerificationError("A photo failed byte, type, hash, or dimension verification.");
  }
  return true;
}

export async function loadAndVerifyMigrationSources({
  fetchImpl = globalThis.fetch.bind(globalThis),
  accessToken
} = {}) {
  if (typeof accessToken !== "string" || accessToken === "" || /\s/.test(accessToken)) {
    throw new SourceVerificationError("Owner-authenticated source delivery is required.");
  }
  const planBytes = await fetchBytes(MIGRATION_PLAN_URL, fetchImpl, accessToken);
  let plan;
  try {
    plan = JSON.parse(new TextDecoder().decode(planBytes));
  } catch {
    throw new SourceVerificationError("The tracked migration plan is invalid.");
  }
  validatePlanShape(plan);

  const sourceEntries = await Promise.all(Object.entries(MAINTENANCE_SOURCE_URLS).map(async ([path, url]) => {
    const bytes = await fetchBytes(url, fetchImpl, accessToken);
    if (await sha256Hex(bytes) !== plan.sources[path]) {
      throw new SourceVerificationError(`Local source drift blocks migration: ${path}.`);
    }
    return [path, bytes];
  }));
  const sources = new Map(sourceEntries);
  const decode = (path) => new TextDecoder().decode(sources.get(path));
  verifyCsvDerivation(
    plan,
    decode("content-intake/finds.csv"),
    decode("content-intake/photo-manifest.csv")
  );
  if (JSON.stringify(parseCollectionRegistry(decode("data/collections.js"))) !== JSON.stringify(plan.collections)) {
    throw new SourceVerificationError("The Collection registry differs from the tracked plan.");
  }
  const registry = decode("docs/IDENTIFIER_REGISTRY.md");
  for (const find of plan.finds) {
    if (!registry.includes(`| \`${find.public_id}\` | — | \`${find.slug}\` |`)) {
      throw new SourceVerificationError(`${find.public_id} differs from the identifier registry.`);
    }
  }
  if (!registry.includes("The next new public ID is `BU-0010`")) {
    throw new SourceVerificationError("The next public ID reservation is not exact.");
  }

  const photos = new Map();
  await Promise.all(plan.finds.map(async (find) => {
    const bytes = await fetchBytes(
      `${MAINTENANCE_SOURCE_PREFIX}/photos/${encodeURIComponent(find.photo.filename)}`,
      fetchImpl,
      accessToken
    );
    const blob = new Blob([bytes], { type: find.photo.mime_type });
    try {
      await verifyPhotoBlob(blob, find.photo);
    } catch {
      throw new SourceVerificationError(`${find.public_id} local photo verification failed.`);
    }
    photos.set(find.public_id, blob);
  }));

  return { plan, photos };
}
