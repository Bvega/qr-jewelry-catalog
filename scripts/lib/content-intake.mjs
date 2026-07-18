import {
  existsSync,
  readFileSync
} from "node:fs";
import {
  dirname,
  extname,
  resolve
} from "node:path";
import { fileURLToPath } from "node:url";

const moduleDirectory = dirname(fileURLToPath(import.meta.url));

export const repositoryRoot = resolve(moduleDirectory, "../..");
export const schemaPath = resolve(repositoryRoot, "content-intake/intake-schema.json");
export const ownerFindsPath = resolve(repositoryRoot, "content-intake/finds.csv");
export const ownerPhotosPath = resolve(repositoryRoot, "content-intake/photo-manifest.csv");
export const exampleFindsPath = resolve(repositoryRoot, "content-intake/examples/finds-example.csv");
export const examplePhotosPath = resolve(repositoryRoot, "content-intake/examples/photo-manifest-example.csv");
export const defaultRawPhotosDirectory = resolve(repositoryRoot, "content-intake/photos");

export function loadIntakeSchema(path = schemaPath) {
  return JSON.parse(readFileSync(path, "utf8"));
}

export function loadExistingPublicIds() {
  const source = readFileSync(resolve(repositoryRoot, "data/items.js"), "utf8");
  return new Set(Array.from(source.matchAll(/\bpublicId:\s*"([^"]+)"/g), (match) => match[1]));
}

export function parseCsv(source, sourceLabel = "CSV") {
  const text = String(source).replace(/^\uFEFF/, "");
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];

    if (inQuotes) {
      if (character === '"') {
        if (text[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += character;
      }
      continue;
    }

    if (character === '"') {
      if (field.length !== 0) {
        throw new Error(`${sourceLabel}: unexpected quote in an unquoted field`);
      }
      inQuotes = true;
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

  if (inQuotes) {
    throw new Error(`${sourceLabel}: unterminated quoted field`);
  }

  if (field.length > 0 || row.length > 0 || text.length === 0) {
    row.push(field);
    rows.push(row);
  }

  const nonblankRows = rows.filter((cells) => cells.some((cell) => cell.trim() !== ""));
  if (nonblankRows.length === 0) {
    throw new Error(`${sourceLabel}: CSV is empty`);
  }

  const headers = nonblankRows[0];
  const records = nonblankRows.slice(1).map((cells, index) => ({
    cells,
    rowNumber: index + 2
  }));

  return { headers, records, sourceLabel };
}

function diagnostic(level, code, message, details = {}) {
  return { level, code, message, ...details };
}

function validateHeaders(parsed, expectedHeaders, errors) {
  const seen = new Set();

  for (const header of parsed.headers) {
    if (seen.has(header)) {
      errors.push(diagnostic(
        "error",
        "duplicate-header",
        `Duplicate header "${header}".`,
        { source: parsed.sourceLabel, row: 1 }
      ));
    }
    seen.add(header);
  }

  for (const header of expectedHeaders) {
    if (!seen.has(header)) {
      errors.push(diagnostic(
        "error",
        "missing-header",
        `Missing required header "${header}".`,
        { source: parsed.sourceLabel, row: 1 }
      ));
    }
  }

  for (const header of seen) {
    if (!expectedHeaders.includes(header)) {
      errors.push(diagnostic(
        "error",
        "unexpected-header",
        `Unexpected header "${header}".`,
        { source: parsed.sourceLabel, row: 1 }
      ));
    }
  }
}

function recordsFromParsed(parsed, expectedHeaders, errors) {
  const firstHeaderIndex = new Map();
  parsed.headers.forEach((header, index) => {
    if (!firstHeaderIndex.has(header)) firstHeaderIndex.set(header, index);
  });

  return parsed.records.map(({ cells, rowNumber }) => {
    if (cells.length !== parsed.headers.length) {
      errors.push(diagnostic(
        "error",
        "column-count",
        `Expected ${parsed.headers.length} columns but found ${cells.length}.`,
        { source: parsed.sourceLabel, row: rowNumber }
      ));
    }

    const record = { _row: rowNumber, _source: parsed.sourceLabel };
    for (const header of expectedHeaders) {
      const index = firstHeaderIndex.get(header);
      record[header] = index === undefined ? "" : (cells[index] ?? "").trim();
    }
    return record;
  });
}

function splitPipe(value) {
  if (!value) return [];
  return value.split("|").map((entry) => entry.trim()).filter(Boolean);
}

function photoNameDetails(filename, schema) {
  const match = filename.match(new RegExp(schema.photos.filenamePattern));
  if (!match) return null;
  return {
    intakeKey: match[1],
    sequence: Number(match[2]),
    extension: extname(filename)
  };
}

function addRequiredValueErrors(records, requiredFields, errors) {
  for (const record of records) {
    for (const field of requiredFields) {
      if (!record[field]) {
        errors.push(diagnostic(
          "error",
          "missing-required-value",
          `Required field "${field}" is blank.`,
          { source: record._source, row: record._row, intakeKey: record.intake_key || null }
        ));
      }
    }
  }
}

function validateInventory(parsed, schema, existingPublicIds, errors, warnings) {
  validateHeaders(parsed, schema.inventory.headers, errors);
  const finds = recordsFromParsed(parsed, schema.inventory.headers, errors);
  addRequiredValueErrors(finds, schema.inventory.requiredFields, errors);

  const keyPattern = new RegExp(schema.inventory.intakeKeyPattern);
  const pricePattern = new RegExp(schema.inventory.pricePattern);
  const keys = new Map();
  const photoOwners = new Map();

  for (const find of finds) {
    const details = { source: find._source, row: find._row, intakeKey: find.intake_key || null };

    if (find.intake_key && !keyPattern.test(find.intake_key)) {
      errors.push(diagnostic("error", "invalid-intake-key", `Invalid intake_key "${find.intake_key}"; use lowercase ASCII kebab-case.`, details));
    }
    if (find.intake_key && keys.has(find.intake_key)) {
      errors.push(diagnostic("error", "duplicate-intake-key", `Duplicate intake_key "${find.intake_key}".`, details));
    } else if (find.intake_key) {
      keys.set(find.intake_key, find);
    }

    if (find.collection && !schema.inventory.collectionIds.includes(find.collection)) {
      errors.push(diagnostic("error", "invalid-collection", `Collection "${find.collection}" is not allowed.`, details));
    } else if (schema.inventory.comingSoonCollectionIds.includes(find.collection)) {
      warnings.push(diagnostic("warning", "coming-soon-collection", `Collection "${find.collection}" is currently Coming Soon.`, details));
    }

    if (find.price_amount && (!pricePattern.test(find.price_amount) || Number(find.price_amount) <= 0)) {
      errors.push(diagnostic("error", "invalid-price", `price_amount "${find.price_amount}" must be positive with no more than two decimals.`, details));
    }
    if (find.price_currency && find.price_currency !== schema.inventory.currency) {
      errors.push(diagnostic("error", "invalid-currency", `price_currency must be ${schema.inventory.currency}.`, details));
    }
    if (find.availability && !schema.inventory.availabilityValues.includes(find.availability)) {
      errors.push(diagnostic("error", "invalid-availability", `Availability "${find.availability}" is not allowed.`, details));
    }
    if (!schema.inventory.featuredValues.includes(find.featured)) {
      errors.push(diagnostic("error", "invalid-featured", "featured must be true, false, or blank.", details));
    }

    if (!find.condition) {
      warnings.push(diagnostic("warning", "condition-blank", "Condition is blank; add it when known.", details));
    }
    if (!find.additional_photo_filenames) {
      warnings.push(diagnostic("warning", "additional-photos-absent", "No additional photos are listed.", details));
    }

    const inventoryPhotos = [
      { filename: find.primary_photo_filename, role: "primary" },
      ...splitPipe(find.additional_photo_filenames).map((filename) => ({ filename, role: "additional" }))
    ].filter(({ filename }) => filename);

    find._additionalPhotos = splitPipe(find.additional_photo_filenames);
    find._relationships = splitPipe(find.related_public_ids);
    find._inventoryPhotos = inventoryPhotos.map(({ filename }) => filename);

    for (const { filename, role } of inventoryPhotos) {
      const name = photoNameDetails(filename, schema);
      if (!name) {
        errors.push(diagnostic("error", "invalid-photo-filename", `Photo filename "${filename}" does not match the approved pattern or extension.`, details));
      } else {
        if (name.intakeKey !== find.intake_key) {
          errors.push(diagnostic("error", "photo-key-mismatch", `Photo filename "${filename}" does not match intake_key "${find.intake_key}".`, details));
        }
        if (name.sequence < 1 || (role === "primary" && name.sequence !== schema.photos.primarySequence)) {
          errors.push(diagnostic("error", "invalid-photo-sequence", `Primary photo "${filename}" must use sequence 01.`, details));
        }
        if (role === "additional" && name.sequence === schema.photos.primarySequence) {
          errors.push(diagnostic("error", "invalid-photo-sequence", `Additional photo "${filename}" cannot use primary sequence 01.`, details));
        }
      }

      if (photoOwners.has(filename)) {
        errors.push(diagnostic("error", "duplicate-photo-filename", `Duplicate photo filename "${filename}" in the inventory.`, details));
      } else {
        photoOwners.set(filename, find.intake_key);
      }
    }
  }

  for (const find of finds) {
    const details = { source: find._source, row: find._row, intakeKey: find.intake_key || null };
    for (const relationship of find._relationships) {
      if (existingPublicIds.has(relationship)) continue;
      if (keys.has(relationship)) {
        warnings.push(diagnostic(
          "warning",
          "proposed-relationship",
          `Proposed relationship "${relationship}" is pending permanent public ID assignment.`,
          details
        ));
      } else {
        warnings.push(diagnostic(
          "warning",
          "unresolved-relationship",
          `Relationship "${relationship}" is unresolved and pending review.`,
          details
        ));
      }
    }
  }

  return finds;
}

function validateManifest(parsed, finds, schema, rawPhotosDirectory, errors, warnings) {
  validateHeaders(parsed, schema.photoManifest.headers, errors);
  const photos = recordsFromParsed(parsed, schema.photoManifest.headers, errors);
  addRequiredValueErrors(photos, schema.photoManifest.requiredFields, errors);

  const findByKey = new Map(finds.map((find) => [find.intake_key, find]));
  const filenameRows = new Map();
  const sequenceRows = new Map();
  const rowsByKey = new Map();
  const sequencePattern = new RegExp(schema.photoManifest.sequencePattern);
  const keyPattern = new RegExp(schema.inventory.intakeKeyPattern);

  for (const photo of photos) {
    const details = { source: photo._source, row: photo._row, intakeKey: photo.intake_key || null };
    const name = photoNameDetails(photo.filename, schema);

    if (photo.intake_key && !keyPattern.test(photo.intake_key)) {
      errors.push(diagnostic("error", "invalid-intake-key", `Invalid manifest intake_key "${photo.intake_key}".`, details));
    }
    if (photo.intake_key && !findByKey.has(photo.intake_key)) {
      errors.push(diagnostic("error", "unresolved-manifest-key", `Manifest intake_key "${photo.intake_key}" does not resolve to a Find.`, details));
    }
    if (photo.role && !schema.photoManifest.roleValues.includes(photo.role)) {
      errors.push(diagnostic("error", "invalid-photo-role", `Photo role "${photo.role}" is not allowed.`, details));
    }
    if (photo.orientation && !schema.photoManifest.orientationValues.includes(photo.orientation)) {
      errors.push(diagnostic("error", "invalid-orientation", `Orientation "${photo.orientation}" is not allowed.`, details));
    }
    if (photo.owner_approved && !schema.photoManifest.ownerApprovedValues.includes(photo.owner_approved)) {
      errors.push(diagnostic("error", "invalid-owner-approved", "owner_approved must be true or false.", details));
    }
    if (photo.sequence && !sequencePattern.test(photo.sequence)) {
      errors.push(diagnostic("error", "invalid-manifest-sequence", `Sequence "${photo.sequence}" must be a positive integer.`, details));
    }

    if (!name) {
      if (photo.filename) {
        errors.push(diagnostic("error", "invalid-photo-filename", `Photo filename "${photo.filename}" does not match the approved pattern or extension.`, details));
      }
    } else {
      if (name.intakeKey !== photo.intake_key) {
        errors.push(diagnostic("error", "photo-key-mismatch", `Photo filename "${photo.filename}" does not match manifest intake_key "${photo.intake_key}".`, details));
      }
      if (photo.sequence && sequencePattern.test(photo.sequence) && name.sequence !== Number(photo.sequence)) {
        errors.push(diagnostic("error", "manifest-sequence-mismatch", `Filename sequence for "${photo.filename}" does not match sequence ${photo.sequence}.`, details));
      }
      if (name.sequence < 1 || (photo.role === "primary" && name.sequence !== schema.photos.primarySequence)) {
        errors.push(diagnostic("error", "invalid-photo-sequence", `Primary photo "${photo.filename}" must use sequence 01.`, details));
      }
      if (photo.role === "additional" && name.sequence === schema.photos.primarySequence) {
        errors.push(diagnostic("error", "invalid-photo-sequence", `Additional photo "${photo.filename}" cannot use primary sequence 01.`, details));
      }
    }

    if (photo.filename && filenameRows.has(photo.filename)) {
      errors.push(diagnostic("error", "duplicate-photo-filename", `Duplicate photo filename "${photo.filename}" in the manifest.`, details));
    } else if (photo.filename) {
      filenameRows.set(photo.filename, photo);
    }

    if (photo.intake_key && photo.sequence) {
      const sequenceKey = `${photo.intake_key}:${photo.sequence}`;
      if (sequenceRows.has(sequenceKey)) {
        errors.push(diagnostic("error", "duplicate-photo-sequence", `Duplicate sequence ${photo.sequence} for "${photo.intake_key}".`, details));
      } else {
        sequenceRows.set(sequenceKey, photo);
      }
    }

    if (!rowsByKey.has(photo.intake_key)) rowsByKey.set(photo.intake_key, []);
    rowsByKey.get(photo.intake_key).push(photo);

    if (photo.owner_approved === "false") {
      warnings.push(diagnostic("warning", "owner-approval-false", `Photo "${photo.filename}" is not owner approved.`, details));
    }
    if (photo.filename && !existsSync(resolve(rawPhotosDirectory, photo.filename))) {
      warnings.push(diagnostic("warning", "raw-photo-missing", `Referenced raw photo "${photo.filename}" is not present.`, details));
    }
  }

  for (const find of finds) {
    const details = { source: find._source, row: find._row, intakeKey: find.intake_key || null };
    const manifestRows = rowsByKey.get(find.intake_key) || [];
    const primaryRows = manifestRows.filter((photo) => photo.role === "primary");

    if (primaryRows.length !== 1) {
      errors.push(diagnostic("error", "primary-photo-count", `Find "${find.intake_key}" must have exactly one primary manifest photo; found ${primaryRows.length}.`, details));
    } else if (primaryRows[0].filename !== find.primary_photo_filename) {
      errors.push(diagnostic("error", "primary-photo-mismatch", `Manifest primary filename does not match the Find row for "${find.intake_key}".`, details));
    }

    const manifestAdditional = new Set(
      manifestRows.filter((photo) => photo.role === "additional").map((photo) => photo.filename)
    );
    const inventoryAdditional = new Set(find._additionalPhotos);

    for (const filename of inventoryAdditional) {
      if (!manifestAdditional.has(filename)) {
        errors.push(diagnostic("error", "missing-manifest-photo", `Additional photo "${filename}" is missing from the manifest.`, details));
      }
    }
    for (const filename of manifestAdditional) {
      if (!inventoryAdditional.has(filename)) {
        errors.push(diagnostic("error", "unlisted-manifest-photo", `Manifest photo "${filename}" is not listed in the Find row.`, details));
      }
    }
  }

  return photos;
}

export function validateContentIntake({
  findsPath,
  photosPath = null,
  rawPhotosDirectory = defaultRawPhotosDirectory,
  schema = loadIntakeSchema(),
  existingPublicIds = loadExistingPublicIds()
}) {
  const errors = [];
  const warnings = [];
  let finds = [];
  let photos = [];

  try {
    const parsedFinds = parseCsv(readFileSync(findsPath, "utf8"), findsPath);
    finds = validateInventory(parsedFinds, schema, existingPublicIds, errors, warnings);
  } catch (error) {
    errors.push(diagnostic("error", "finds-read", error.message, { source: findsPath, row: null, intakeKey: null }));
  }

  if (photosPath) {
    try {
      const parsedPhotos = parseCsv(readFileSync(photosPath, "utf8"), photosPath);
      photos = validateManifest(parsedPhotos, finds, schema, rawPhotosDirectory, errors, warnings);
    } catch (error) {
      errors.push(diagnostic("error", "photos-read", error.message, { source: photosPath, row: null, intakeKey: null }));
    }
  } else {
    for (const find of finds) {
      warnings.push(diagnostic(
        "warning",
        "manifest-absent",
        `No photo manifest is present for "${find.intake_key}".`,
        { source: find._source, row: find._row, intakeKey: find.intake_key || null }
      ));
      for (const filename of find._inventoryPhotos || []) {
        if (!existsSync(resolve(rawPhotosDirectory, filename))) {
          warnings.push(diagnostic(
            "warning",
            "raw-photo-missing",
            `Referenced raw photo "${filename}" is not present.`,
            { source: find._source, row: find._row, intakeKey: find.intake_key || null }
          ));
        }
      }
    }
  }

  return {
    errors,
    warnings,
    finds,
    photos,
    findsPath,
    photosPath,
    rawPhotosDirectory,
    valid: errors.length === 0
  };
}

export function summarizeContentIntake(validation) {
  const byCollection = new Map();
  const byAvailability = new Map();
  const photoRowsByKey = new Map();
  const relationshipWarningCodes = new Set(["proposed-relationship", "unresolved-relationship"]);

  for (const photo of validation.photos) {
    if (!photoRowsByKey.has(photo.intake_key)) photoRowsByKey.set(photo.intake_key, []);
    photoRowsByKey.get(photo.intake_key).push(photo);
  }

  let missingCondition = 0;
  let missingOrUnapprovedPhotos = 0;
  let unresolvedRelationships = 0;
  let readyForReview = 0;
  let blocked = 0;
  const globalError = validation.errors.some((entry) => !entry.intakeKey);

  for (const find of validation.finds) {
    if (find.collection) byCollection.set(find.collection, (byCollection.get(find.collection) || 0) + 1);
    if (find.availability) byAvailability.set(find.availability, (byAvailability.get(find.availability) || 0) + 1);
    if (!find.condition) missingCondition += 1;

    const rows = photoRowsByKey.get(find.intake_key) || [];
    const inventoryPhotos = find._inventoryPhotos || [];
    const rowByFilename = new Map(rows.map((photo) => [photo.filename, photo]));
    const photoBlocked = inventoryPhotos.length === 0 || inventoryPhotos.some((filename) => {
      const row = rowByFilename.get(filename);
      return !row || row.owner_approved !== "true" || !existsSync(resolve(validation.rawPhotosDirectory, filename));
    });

    if (photoBlocked) missingOrUnapprovedPhotos += 1;

    const unresolvedForFind = validation.warnings.filter((entry) =>
      entry.intakeKey === find.intake_key && relationshipWarningCodes.has(entry.code)
    ).length;
    unresolvedRelationships += unresolvedForFind;

    const recordHasError = globalError || validation.errors.some((entry) => entry.intakeKey === find.intake_key);
    if (recordHasError || photoBlocked || unresolvedForFind > 0) {
      blocked += 1;
    } else {
      readyForReview += 1;
    }
  }

  return {
    proposedFindCount: validation.finds.length,
    byCollection,
    byAvailability,
    missingCondition,
    missingOrUnapprovedPhotos,
    unresolvedRelationships,
    readyForReview,
    blocked
  };
}

export function parseIntakeArguments(argv) {
  const options = { finds: null, photos: null, help: false };
  const errors = [];

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--help" || argument === "-h") {
      options.help = true;
    } else if (argument === "--finds" || argument === "--photos") {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) {
        errors.push(`${argument} requires a file path.`);
      } else {
        options[argument.slice(2)] = resolve(process.cwd(), value);
        index += 1;
      }
    } else {
      errors.push(`Unknown argument "${argument}".`);
    }
  }

  return { options, errors };
}

export function resolveIntakeInputs(options) {
  const explicit = Boolean(options.finds || options.photos);
  const ownerFindsExists = existsSync(ownerFindsPath);
  const ownerPhotosExists = existsSync(ownerPhotosPath);

  if (!explicit && !ownerFindsExists && !ownerPhotosExists) {
    return {
      ownerPresent: false,
      findsPath: exampleFindsPath,
      photosPath: examplePhotosPath,
      errors: []
    };
  }

  const findsPath = options.finds || (explicit ? null : (ownerFindsExists ? ownerFindsPath : null));
  const photosPath = options.photos || (explicit ? null : (ownerPhotosExists ? ownerPhotosPath : null));
  const errors = [];

  if (!findsPath) errors.push("A photo manifest is present but no owner Finds file is available.");
  if (findsPath && !existsSync(findsPath)) errors.push(`Finds file does not exist: ${findsPath}`);
  if (photosPath && !existsSync(photosPath)) errors.push(`Photo manifest does not exist: ${photosPath}`);

  return { ownerPresent: true, findsPath, photosPath, errors };
}

export function formatDiagnostic(entry) {
  const location = entry.source
    ? `${entry.source}${entry.row ? `:${entry.row}` : ""}: `
    : "";
  return `${location}${entry.message}`;
}
