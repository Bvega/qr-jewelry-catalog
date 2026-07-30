#!/usr/bin/env node

import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { assertSanitizedEvidence } from "./sanitizer.mjs";

const repositoryRoot = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const archivePath = resolve(repositoryRoot, "evidence/M09_STAGE_B_EVIDENCE.zip");
const checksumPath = resolve(
  repositoryRoot,
  "evidence/M09_STAGE_B_EVIDENCE.zip.sha256"
);
const expectedEntries = Object.freeze([
  "CLEANUP.txt",
  "DOCKER_IMAGES.txt",
  "LOCALHOST.txt",
  "MANIFEST.sha256",
  "PHOTO.txt",
  "PRESERVED_BEFORE_RESET.txt",
  "PUBLICATION.txt",
  "README.txt",
  "ROLLBACK.txt"
]);
const manifestedEntries = expectedEntries.filter(
  (entry) => entry !== "MANIFEST.sha256"
);

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function unzip(arguments_) {
  const result = spawnSync("unzip", arguments_, {
    cwd: repositoryRoot,
    encoding: arguments_[0] === "-p" ? "buffer" : "utf8",
    maxBuffer: 16 * 1024 * 1024
  });
  if (result.error || result.status !== 0) {
    throw new Error("The M09 Stage B evidence ZIP could not be inspected.");
  }
  return result.stdout;
}

function archiveEntry(name) {
  return unzip(["-p", archivePath, name]);
}

function parseManifest(source) {
  const entries = new Map();
  for (const line of source.trim().split(/\r?\n/)) {
    const match = /^([0-9a-f]{64})  ([A-Z][A-Za-z0-9_.-]+)$/.exec(line);
    if (!match || entries.has(match[2])) {
      throw new Error("The M09 Stage B evidence manifest is malformed.");
    }
    entries.set(match[2], match[1]);
  }
  return entries;
}

function assertTerms(source, terms, label) {
  const normalized = source.toLowerCase();
  const missing = terms.filter((term) => !normalized.includes(term.toLowerCase()));
  if (missing.length > 0) {
    throw new Error(`${label} omits required evidence.`);
  }
}

export function validateStageBEvidence() {
  if (!existsSync(archivePath) || !existsSync(checksumPath)) {
    throw new Error("The M09 Stage B evidence ZIP or checksum record is missing.");
  }

  const entries = unzip(["-Z1", archivePath])
    .trim()
    .split(/\r?\n/)
    .filter(Boolean)
    .sort();
  if (JSON.stringify(entries) !== JSON.stringify(expectedEntries)) {
    throw new Error("The M09 Stage B evidence ZIP contains an unexpected entry set.");
  }

  const text = new Map();
  for (const entry of entries) {
    const buffer = archiveEntry(entry);
    if (buffer.includes(0)) {
      throw new Error(`The M09 Stage B evidence entry is not text: ${entry}`);
    }
    const source = buffer.toString("utf8");
    assertSanitizedEvidence(source);
    text.set(entry, source);
  }

  const manifest = parseManifest(text.get("MANIFEST.sha256"));
  if (
    JSON.stringify([...manifest.keys()].sort()) !==
    JSON.stringify([...manifestedEntries].sort())
  ) {
    throw new Error("The M09 Stage B evidence manifest entry set is incomplete.");
  }
  for (const entry of manifestedEntries) {
    if (manifest.get(entry) !== sha256(archiveEntry(entry))) {
      throw new Error(`The M09 Stage B evidence manifest hash differs: ${entry}`);
    }
  }

  const adjacent = readFileSync(checksumPath, "utf8").trim();
  const checksumMatch =
    /^([0-9a-f]{64})  M09_STAGE_B_EVIDENCE\.zip$/.exec(adjacent);
  if (!checksumMatch || checksumMatch[1] !== sha256(readFileSync(archivePath))) {
    throw new Error("The M09 Stage B evidence ZIP checksum record differs.");
  }

  assertTerms(
    text.get("LOCALHOST.txt"),
    ["127.0.0.1", "BU-9000", "BU-0010", "PASS", "zero production writes"],
    "Localhost evidence"
  );
  assertTerms(
    text.get("DOCKER_IMAGES.txt"),
    ["public.ecr.aws/supabase/", "local Docker runtime images only", "PASS"],
    "Docker-image evidence"
  );
  assertTerms(
    text.get("PHOTO.txt"),
    ["32x32", "330 bytes", "1024 visible pixels", "3 colors", "PASS"],
    "Photo evidence"
  );
  assertTerms(
    text.get("PUBLICATION.txt"),
    ["exactly six visible Finds", "Share Find", "QR destination", "PASS"],
    "Publication evidence"
  );
  assertTerms(
    text.get("ROLLBACK.txt"),
    ["exactly five protected static Finds", "not publicly accessible", "PASS"],
    "Rollback evidence"
  );
  assertTerms(
    text.get("PRESERVED_BEFORE_RESET.txt"),
    ["row", "photo metadata", "Storage object", "PASS"],
    "Preserved-before-reset evidence"
  );
  assertTerms(
    text.get("CLEANUP.txt"),
    ["local account", "temporary credentials", "no local Supabase containers", "PASS"],
    "Cleanup evidence"
  );
  return true;
}

async function main() {
  try {
    validateStageBEvidence();
    console.log(
      `M09 Stage B evidence integrity validation: PASS (${expectedEntries.length} sanitized entries)`
    );
  } catch (error) {
    console.error(`M09 Stage B evidence integrity validation: FAIL\n- ${error.message}`);
    process.exitCode = 1;
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  await main();
}
