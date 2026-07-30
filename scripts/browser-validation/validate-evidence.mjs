#!/usr/bin/env node

import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { assertSanitizedEvidence } from "./sanitizer.mjs";
import {
  ANONYMOUS_CHECKS,
  CLEANUP_CHECKS,
  MANAGER_CHECKS
} from "./workflows.mjs";

const repositoryRoot = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const archivePath = resolve(repositoryRoot, "evidence/M09_STAGE_A_EVIDENCE.zip");
const checksumPath = resolve(
  repositoryRoot,
  "evidence/M09_STAGE_A_EVIDENCE.zip.sha256"
);
const expectedEntries = Object.freeze([
  "ANONYMOUS.txt",
  "CLEANUP.txt",
  "MANAGER.txt",
  "MANIFEST.sha256",
  "README.txt",
  "REMOTE_STATE.txt"
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
    throw new Error("The M09 evidence ZIP could not be inspected.");
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
      throw new Error("The M09 evidence manifest is malformed.");
    }
    entries.set(match[2], match[1]);
  }
  return entries;
}

function assertTerms(source, terms, label) {
  const missing = terms.filter((term) => !source.includes(term));
  if (missing.length > 0) {
    throw new Error(`${label} omits required evidence.`);
  }
}

export function validateEvidence() {
  if (!existsSync(archivePath) || !existsSync(checksumPath)) {
    throw new Error("The M09 evidence ZIP or checksum record is missing.");
  }

  const entries = unzip(["-Z1", archivePath])
    .trim()
    .split(/\r?\n/)
    .filter(Boolean)
    .sort();
  if (JSON.stringify(entries) !== JSON.stringify(expectedEntries)) {
    throw new Error("The M09 evidence ZIP contains an unexpected entry set.");
  }

  const text = new Map();
  for (const entry of entries) {
    const buffer = archiveEntry(entry);
    if (buffer.includes(0)) {
      throw new Error(`The M09 evidence entry is not text: ${entry}`);
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
    throw new Error("The M09 evidence manifest entry set is incomplete.");
  }
  for (const entry of manifestedEntries) {
    if (manifest.get(entry) !== sha256(archiveEntry(entry))) {
      throw new Error(`The M09 evidence manifest hash differs: ${entry}`);
    }
  }

  const adjacent = readFileSync(checksumPath, "utf8").trim();
  const checksumMatch =
    /^([0-9a-f]{64})  M09_STAGE_A_EVIDENCE\.zip$/.exec(adjacent);
  if (!checksumMatch || checksumMatch[1] !== sha256(readFileSync(archivePath))) {
    throw new Error("The M09 evidence ZIP checksum record differs.");
  }

  assertTerms(
    text.get("ANONYMOUS.txt"),
    [...ANONYMOUS_CHECKS, "PASS"],
    "Anonymous evidence"
  );
  assertTerms(
    text.get("MANAGER.txt"),
    [...MANAGER_CHECKS, "PASS", "BU-0006", "BU-0009"],
    "Manager evidence"
  );
  assertTerms(
    text.get("CLEANUP.txt"),
    [...CLEANUP_CHECKS, "PASS", "manual fallback"],
    "Cleanup evidence"
  );
  assertTerms(
    text.get("REMOTE_STATE.txt"),
    ["BU-0001", "BU-0005", "BU-0006", "BU-0009", "BU-0010", "zero"],
    "Remote-state evidence"
  );
  return true;
}

async function main() {
  try {
    validateEvidence();
    console.log(
      `M09 evidence integrity validation: PASS (${expectedEntries.length} sanitized entries)`
    );
  } catch (error) {
    console.error(`M09 evidence integrity validation: FAIL\n- ${error.message}`);
    process.exitCode = 1;
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  await main();
}
