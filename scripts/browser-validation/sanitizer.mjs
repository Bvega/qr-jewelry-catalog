import {
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync
} from "node:fs";
import { dirname, isAbsolute, relative, resolve } from "node:path";

export const REDACTIONS = Object.freeze({
  credential: "[REDACTED_CREDENTIAL]",
  email: "[REDACTED_EMAIL]",
  identifier: "[REDACTED_IDENTIFIER]",
  path: "[REDACTED_PATH]",
  privateQuery: "[REDACTED_PRIVATE_QUERY]",
  project: "[REDACTED_PROJECT_REF]",
  supabaseOrigin: "https://SUPABASE_ORIGIN"
});

const patterns = Object.freeze({
  authorization:
    /\b(authorization[ \t]*[:=][ \t]*)(?:bearer[ \t]+)?[^\s,;"'}]+/gi,
  httpState: /\b((?:set-)?cookie[ \t]*[:=][ \t]*)[^\s][^\r\n]*/gi,
  email: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,
  jwt: /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g,
  privateKey:
    /\b(?:sb_secret_[A-Za-z0-9_-]{8,}|sbp_[A-Za-z0-9]{16,}|sb_publishable_[A-Za-z0-9_-]{16,})\b/g,
  privateQuery:
    /([?&](?:access_token|apikey|code|email|key|owner|password|redirect_to|refresh_token|session|storage_path|token|user)=)[^&#\s"']+/gi,
  storagePath:
    /\bfinds\/[0-9a-f-]{32,}\/[^\s"'?#]+/gi,
  supabaseOrigin: /https:\/\/[a-z0-9-]+\.supabase\.co/gi,
  temporaryPath:
    /\/(?:(?:private\/)?var\/folders|private\/tmp)\/[^:\r\n"'<> ]+/g,
  unixPersonalPath: /\/(?:Users|home)\/[^/\s"'<>]+(?:\/[^:\r\n"'<>]*)?/g,
  uuid: /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi,
  windowsPersonalPath: /\b[A-Z]:\\Users\\[^\\\s"'<>]+(?:\\[^:\r\n"'<>]*)?/gi
});

const privateObjectKey =
  /(?:authorization|clipboard|cookie|credential|email|password|private|profile|session|storage_path|token|user_id|uuid)/i;

function isWithin(parent, child) {
  const path = relative(resolve(parent), resolve(child));
  return path === "" || (!path.startsWith("..") && !isAbsolute(path));
}

function replaceKnownProjectReference(text, supabaseOrigin) {
  if (!supabaseOrigin) return text;
  let reference;
  try {
    const url = new URL(supabaseOrigin);
    reference = url.hostname.split(".")[0];
  } catch {
    throw new Error("A valid Supabase origin is required for evidence sanitization.");
  }
  if (!reference || reference.length < 8) {
    throw new Error("Supabase project reference was not safe to sanitize.");
  }
  return text.replaceAll(reference, REDACTIONS.project);
}

export function sanitizeText(value, { supabaseOrigin } = {}) {
  let text = String(value);
  text = text.replace(patterns.supabaseOrigin, REDACTIONS.supabaseOrigin);
  text = replaceKnownProjectReference(text, supabaseOrigin);
  text = text.replace(patterns.storagePath, `finds/${REDACTIONS.path}`);
  text = text.replace(patterns.authorization, `$1${REDACTIONS.credential}`);
  text = text.replace(patterns.httpState, `$1${REDACTIONS.credential}`);
  text = text.replace(patterns.jwt, REDACTIONS.credential);
  text = text.replace(patterns.privateKey, REDACTIONS.credential);
  text = text.replace(patterns.privateQuery, `$1${REDACTIONS.privateQuery}`);
  text = text.replace(patterns.email, REDACTIONS.email);
  text = text.replace(patterns.uuid, REDACTIONS.identifier);
  text = text.replace(patterns.windowsPersonalPath, REDACTIONS.path);
  text = text.replace(patterns.temporaryPath, REDACTIONS.path);
  text = text.replace(patterns.unixPersonalPath, REDACTIONS.path);
  return text;
}

export function sanitizeValue(value, options = {}, key = "") {
  if (privateObjectKey.test(key)) return REDACTIONS.credential;
  if (typeof value === "string") return sanitizeText(value, options);
  if (Array.isArray(value)) {
    return value.map((entry) => sanitizeValue(entry, options));
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([entryKey, entryValue]) => [
        entryKey,
        sanitizeValue(entryValue, options, entryKey)
      ])
    );
  }
  return value;
}

export function findSensitiveShapes(value) {
  let text = typeof value === "string" ? value : JSON.stringify(value);
  for (const redaction of Object.values(REDACTIONS)) {
    text = text.replaceAll(redaction, "");
  }
  const findings = [];
  const checks = [
    ["authorization value", patterns.authorization],
    ["cookie value", patterns.httpState],
    ["email-shaped value", patterns.email],
    ["JWT-shaped value", patterns.jwt],
    ["private key-shaped value", patterns.privateKey],
    ["private query value", patterns.privateQuery],
    ["private Storage path", patterns.storagePath],
    ["concrete Supabase origin", patterns.supabaseOrigin],
    ["UUID-shaped value", patterns.uuid],
    ["temporary filesystem path", patterns.temporaryPath],
    ["personal Unix path", patterns.unixPersonalPath],
    ["personal Windows path", patterns.windowsPersonalPath]
  ];
  for (const [label, pattern] of checks) {
    pattern.lastIndex = 0;
    if (pattern.test(text)) findings.push(label);
  }
  return findings;
}

export function assertSanitizedEvidence(value) {
  const findings = findSensitiveShapes(value);
  if (findings.length > 0) {
    throw new Error(`Evidence sanitization failed: ${findings.join(", ")}`);
  }
  return true;
}

function assertEvidencePaths(inputPath, outputPath, repositoryRoot) {
  if (isWithin(repositoryRoot, inputPath)) {
    throw new Error("Raw evidence must remain outside the repository.");
  }
  const evidenceRoot = resolve(repositoryRoot, "evidence/m09-stage-a");
  if (!isWithin(evidenceRoot, outputPath) || resolve(outputPath) === evidenceRoot) {
    throw new Error("Sanitized evidence output must be a file under evidence/m09-stage-a/.");
  }
  mkdirSync(dirname(outputPath), { recursive: true });
}

export function sanitizeEvidenceFile({
  inputPath,
  outputPath,
  repositoryRoot,
  supabaseOrigin
}) {
  assertEvidencePaths(inputPath, outputPath, repositoryRoot);
  const source = readFileSync(inputPath, "utf8");
  const sanitized = sanitizeText(source, { supabaseOrigin });
  assertSanitizedEvidence(sanitized);
  writeFileSync(outputPath, sanitized.endsWith("\n") ? sanitized : `${sanitized}\n`, {
    encoding: "utf8",
    mode: 0o600
  });
  return outputPath;
}

export function retainPublicPng({
  inputPath,
  outputPath,
  repositoryRoot,
  visibility,
  authenticated = false
}) {
  if (visibility !== "anonymous" || authenticated) {
    throw new Error("Only anonymous public screenshots may be retained.");
  }
  assertEvidencePaths(inputPath, outputPath, repositoryRoot);
  const buffer = readFileSync(inputPath);
  const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  if (buffer.length < pngSignature.length || !buffer.subarray(0, 8).equals(pngSignature)) {
    throw new Error("Retained screenshot is not a PNG.");
  }
  copyFileSync(inputPath, outputPath);
  return outputPath;
}

export function removeRawEvidenceDirectory(path, { repositoryRoot, temporaryRoot }) {
  const target = resolve(path);
  const temp = resolve(temporaryRoot);
  if (
    !existsSync(target) ||
    !lstatSync(target).isDirectory() ||
    isWithin(repositoryRoot, target) ||
    !isWithin(temp, target) ||
    target === temp ||
    !target.split("/").at(-1).startsWith("m09-browser-raw-")
  ) {
    throw new Error("Refusing to remove an unverified raw-evidence directory.");
  }
  rmSync(target, { recursive: true, force: false });
  return !existsSync(target);
}
