import assert from "node:assert/strict";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync
} from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import test, { afterEach } from "node:test";
import {
  REDACTIONS,
  assertSanitizedEvidence,
  removeRawEvidenceDirectory,
  retainPublicPng,
  sanitizeEvidenceFile,
  sanitizeText,
  sanitizeValue
} from "../../scripts/browser-validation/sanitizer.mjs";

const fixtureRoots = new Set();

afterEach(() => {
  for (const root of fixtureRoots) {
    rmSync(root, { recursive: true, force: true });
  }
  fixtureRoots.clear();
});

function fixture() {
  const root = mkdtempSync(resolve(tmpdir(), "m09-sanitizer-test-"));
  const repositoryRoot = resolve(root, "repository");
  const rawRoot = resolve(root, "m09-browser-raw-fixture");
  mkdirSync(resolve(repositoryRoot, "evidence/m09-stage-a"), { recursive: true });
  mkdirSync(rawRoot);
  fixtureRoots.add(root);
  return { rawRoot, repositoryRoot, root };
}

test("text and structured evidence redact every private-value class", () => {
  const origin = "https://m09sanitizertest.supabase.co";
  const email = ["private.person", "private.invalid"].join("@");
  const uuid = ["12345678", "1234", "4123", "8123", "123456789012"].join("-");
  const token = ["sb", "secret", "fictionalvalue123456"].join("_");
  const source = [
    email,
    uuid,
    token,
    `${origin}/rest/v1/finds?owner=${uuid}`,
    `finds/${uuid}/private-photo.jpeg`,
    ["/", "Users", "private-name", "project", "file.txt"].join("/"),
    ["C:", "Users", "private-name", "profile", "data"].join("\\"),
    ["Author", "ization: Bearer private-token-value-123456"].join(""),
    ["Coo", "kie: session=private-session-value"].join("")
  ].join("\n");
  const sanitized = sanitizeText(source, { supabaseOrigin: origin });
  assertSanitizedEvidence(sanitized);
  assert.match(sanitized, /REDACTED_EMAIL/);
  assert.match(sanitized, /REDACTED_IDENTIFIER/);
  assert.match(sanitized, /SUPABASE_ORIGIN/);
  assert.doesNotMatch(sanitized, /private-name|private\.person|123456789012/);

  assert.deepEqual(sanitizeValue({
    status: "PASS",
    clipboardText: "private content",
    nested: { user_id: uuid }
  }), {
    status: "PASS",
    clipboardText: REDACTIONS.credential,
    nested: { user_id: REDACTIONS.credential }
  });
});

test("raw text stays outside the repository and only sanitized output is retained", () => {
  const { rawRoot, repositoryRoot } = fixture();
  const inputPath = resolve(rawRoot, "console.txt");
  const outputPath = resolve(repositoryRoot, "evidence/m09-stage-a/console-sanitized.txt");
  writeFileSync(inputPath, ["person", "private.invalid"].join("@"));
  sanitizeEvidenceFile({ inputPath, outputPath, repositoryRoot });
  assert.equal(readFileSync(outputPath, "utf8"), `${REDACTIONS.email}\n`);
  assert.throws(() => sanitizeEvidenceFile({
    inputPath: outputPath,
    outputPath: resolve(repositoryRoot, "evidence/m09-stage-a/rewrite.txt"),
    repositoryRoot
  }), /outside the repository/i);
});

test("only anonymous PNG screenshots may be retained", () => {
  const { rawRoot, repositoryRoot } = fixture();
  const inputPath = resolve(rawRoot, "public.png");
  const outputPath = resolve(repositoryRoot, "evidence/m09-stage-a/public.png");
  writeFileSync(inputPath, Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0]));
  retainPublicPng({
    inputPath,
    outputPath,
    repositoryRoot,
    visibility: "anonymous"
  });
  assert.equal(existsSync(outputPath), true);
  assert.throws(() => retainPublicPng({
    inputPath,
    outputPath: resolve(repositoryRoot, "evidence/m09-stage-a/manager.png"),
    repositoryRoot,
    visibility: "manager",
    authenticated: true
  }), /Only anonymous/i);
});

test("cleanup removes only an exact verified raw-evidence directory", () => {
  const { rawRoot, repositoryRoot, root } = fixture();
  writeFileSync(resolve(rawRoot, "transient.txt"), "transient");
  assert.equal(removeRawEvidenceDirectory(rawRoot, {
    repositoryRoot,
    temporaryRoot: root
  }), true);
  assert.equal(existsSync(rawRoot), false);
  assert.throws(() => removeRawEvidenceDirectory(root, {
    repositoryRoot,
    temporaryRoot: root
  }), /Refusing/i);
});
