#!/usr/bin/env node

import {
  existsSync,
  lstatSync,
  readFileSync
} from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const acceptedBase = "039ebb3ba21ba22d25b49762a23041049503cfeb";
const findings = [];

const allowedPaths = Object.freeze([
  /^package\.json$/,
  /^chatGPT_Todo\.txt$/,
  /^docs\/PROJECT_STATE\.md$/,
  /^docs\/M09_BROWSER_ASSISTED_VALIDATION_(?:PLAN|RUNBOOK)\.md$/,
  /^docs\/REPORTS\/M09_(?:PLANNING_REPORT|STAGE_A_EXECUTION|STAGE_B_EXECUTION|BROWSER_ASSISTED_VALIDATION_ACCEPTANCE)\.md$/,
  /^scripts\/browser-validation\/[a-z0-9-]+\.mjs$/,
  /^scripts\/check-m09\.mjs$/,
  /^scripts\/security-scan-m09\.mjs$/,
  /^tests\/browser-validation\/[a-z0-9-]+\.test\.mjs$/,
  /^evidence\/m09-stage-a\/(?:[a-z0-9._-]+\/)*[a-z0-9._-]+$/,
  /^evidence\/M09_STAGE_A_EVIDENCE\.zip(?:\.sha256)?$/,
  /^evidence\/M09_STAGE_B_EVIDENCE\.zip(?:\.sha256)?$/
]);

const credentialPatterns = Object.freeze([
  ["Supabase secret key", /sb_secret_[A-Za-z0-9_-]{8,}/i],
  ["Supabase CLI access token", /sbp_[A-Za-z0-9]{16,}/],
  ["JWT-shaped credential", /eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{16,}/],
  ["private key", /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
  ["authorization value", /\bauthorization\s*[:=]\s*(?:bearer\s+)?[A-Za-z0-9._-]{16,}/i],
  ["cookie value", /\b(?:set-)?cookie\s*[:=]\s*[^\s,[{][^\r\n]{8,}/i],
  ["concrete Supabase origin", /https:\/\/(?![a-z0-9-]*(?:test|fictional|example|your|project))[a-z0-9-]{8,}\.supabase\.co/i],
  ["personal filesystem path", /\/(?:Users|home)\/[^/<\s"'`]+/],
  ["private Storage path", /\bfinds\/[0-9a-f]{8}-[0-9a-f-]{27,}\/[^"'\s]+/i]
]);

function git(args, { binary = false } = {}) {
  const result = spawnSync("git", args, {
    cwd: repositoryRoot,
    encoding: binary ? "buffer" : "utf8",
    maxBuffer: 64 * 1024 * 1024
  });
  if (result.error || result.status !== 0) {
    throw new Error(`Git security inventory failed: git ${args.join(" ")}`);
  }
  return result.stdout;
}

function changedPaths() {
  const tracked = git(["diff", "--name-only", "--diff-filter=ACMR", acceptedBase, "--"])
    .split("\n")
    .filter(Boolean);
  const untracked = git(["ls-files", "--others", "--exclude-standard"])
    .split("\n")
    .filter(Boolean);
  return [...new Set([...tracked, ...untracked])].sort();
}

function approvedEmail(value) {
  return value.toLowerCase().endsWith("@example.test");
}

function inspectText(display, source) {
  for (const [label, pattern] of credentialPatterns) {
    if (pattern.test(source)) findings.push(`${display}: ${label}`);
  }
  for (const email of source.matchAll(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi)) {
    if (!approvedEmail(email[0])) {
      findings.push(`${display}: email-shaped private value`);
      break;
    }
  }
  if (/\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/i.test(source)) {
    findings.push(`${display}: UUID-shaped private value`);
  }
}

function inspectEvidenceArchive(path, absolute) {
  const list = spawnSync("unzip", ["-Z1", absolute], {
    cwd: repositoryRoot,
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024
  });
  if (list.error || list.status !== 0) {
    findings.push(`${path}: unreadable evidence ZIP`);
    return;
  }
  const entries = list.stdout.split(/\r?\n/).filter(Boolean);
  for (const entry of entries) {
    if (
      !/^[A-Z][A-Za-z0-9_.-]+$/.test(entry) ||
      /(?:raw|auth|cookie|session|storage|trace|har|clipboard|profile)/i.test(entry)
    ) {
      findings.push(`${path}: prohibited evidence entry name`);
      continue;
    }
    const content = spawnSync("unzip", ["-p", absolute, entry], {
      cwd: repositoryRoot,
      encoding: "buffer",
      maxBuffer: 16 * 1024 * 1024
    });
    if (content.error || content.status !== 0) {
      findings.push(`${path}: unreadable evidence entry`);
      continue;
    }
    if (!content.stdout.includes(0)) {
      inspectText(`${path}:${entry}`, content.stdout.toString("utf8"));
    }
  }
}

const paths = changedPaths();
for (const path of paths) {
  if (!allowedPaths.some((pattern) => pattern.test(path))) {
    findings.push(`${path}: outside the M09 Stage A allowlist`);
  }
  if (
    /^evidence\/m09-stage-a\//.test(path) &&
    /(?:raw|auth|manager|cookie|session|storage-state|trace|har|clipboard|profile)/i.test(path)
  ) {
    findings.push(`${path}: prohibited retained-evidence name`);
  }
  if (/\.(?:har|trace|sqlite|db|jsonl)$/i.test(path)) {
    findings.push(`${path}: prohibited retained-evidence format`);
  }
  const absolute = resolve(repositoryRoot, path);
  if (!existsSync(absolute) || !lstatSync(absolute).isFile()) continue;
  const buffer = readFileSync(absolute);
    if (
      path === "evidence/M09_STAGE_A_EVIDENCE.zip" ||
      path === "evidence/M09_STAGE_B_EVIDENCE.zip"
    ) {
    inspectEvidenceArchive(path, absolute);
  } else if (!buffer.includes(0)) {
    inspectText(path, buffer.toString("utf8"));
  }
}

for (const protectedPath of [
  "deployment/pages-manifest.json",
  "package-lock.json"
]) {
  const diff = git(["diff", "--name-only", acceptedBase, "--", protectedPath]).trim();
  if (diff) findings.push(`${protectedPath}: protected file changed`);
}

for (const protectedPrefix of ["supabase", ".github/workflows", "admin-src"]) {
  const diff = git(["diff", "--name-only", acceptedBase, "--", protectedPrefix]).trim();
  if (diff) findings.push(`${protectedPrefix}: protected implementation changed`);
}

const patch = git(["diff", "--binary", acceptedBase, "--"], { binary: true }).toString("utf8");
for (const [label, pattern] of credentialPatterns) {
  if (pattern.test(patch)) findings.push(`final diff: ${label}`);
}

if (findings.length > 0) {
  console.error("M09 security and privacy scan: FAIL");
  for (const finding of [...new Set(findings)].sort()) console.error(`- ${finding}`);
  process.exitCode = 1;
} else {
  console.log(`M09 security and privacy scan: PASS (${paths.length} changed path(s))`);
}
