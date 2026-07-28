#!/usr/bin/env node

import {
  existsSync,
  lstatSync,
  readFileSync,
  readdirSync
} from "node:fs";
import { relative, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const acceptedBase = "775ac4a3bac0fd096dd8db47f90712fee033a1f9";
const findings = [];

const credentialPatterns = Object.freeze([
  ["Supabase secret key", /sb_secret_[A-Za-z0-9_-]{8,}/i],
  ["Supabase CLI access token", /sbp_[A-Za-z0-9]{16,}/],
  ["JWT-shaped credential", /eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{16,}/],
  ["private key", /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
  [
    "assigned prohibited secret",
    /SUPABASE_(?:ACCESS_TOKEN|DB_PASSWORD|SECRET_KEY|SERVICE_ROLE_KEY)\s*=\s*(?!\s*(?:$|<|\$\{|env\())\S+/m
  ],
  ["refresh token value", /\brefresh_token["']?\s*[:=]\s*["'][A-Za-z0-9._-]{16,}/i],
  ["access token value", /\baccess_token["']?\s*[:=]\s*["'][A-Za-z0-9._-]{16,}/i]
]);

function command(args) {
  const result = spawnSync("git", args, {
    cwd: repositoryRoot,
    encoding: "utf8"
  });
  if (result.error || result.status !== 0) {
    throw new Error(`Git security inventory failed: git ${args.join(" ")}`);
  }
  return result.stdout.split("\n").filter(Boolean);
}

function changedPaths() {
  const tracked = command(["diff", "--name-only", "--diff-filter=ACMR", acceptedBase, "--"]);
  const untracked = command(["ls-files", "--others", "--exclude-standard"]);
  return [...new Set([...tracked, ...untracked])].sort();
}

function artifactPaths(root = resolve(repositoryRoot, "dist/pages"), prefix = "") {
  if (!existsSync(root)) return [];
  const paths = [];
  for (const name of readdirSync(root).sort()) {
    const path = resolve(root, name);
    const relativePath = prefix ? `${prefix}/${name}` : name;
    const status = lstatSync(path);
    if (status.isSymbolicLink()) {
      findings.push(`dist/pages/${relativePath}: symlink`);
    } else if (status.isDirectory()) {
      paths.push(...artifactPaths(path, relativePath));
    } else if (status.isFile()) {
      paths.push({ display: `dist/pages/${relativePath}`, path });
    }
  }
  return paths;
}

function inspect(display, buffer) {
  if (buffer.includes(0)) return;
  const source = buffer.toString("utf8");
  for (const [label, pattern] of credentialPatterns) {
    if (pattern.test(source)) findings.push(`${display}: ${label}`);
  }
  if (
    /(?:^|\/)\.env(?:\.|$)/i.test(display) &&
    !display.endsWith(".env.example")
  ) {
    findings.push(`${display}: environment file`);
  }
  for (const email of source.matchAll(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi)) {
    if (!approvedBundleEmail(email[0])) {
      findings.push(`${display}: email-shaped private value`);
      break;
    }
  }
  const publicArtifact = display.startsWith("dist/pages/");
  if (
    publicArtifact &&
    /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/i.test(source)
  ) {
    findings.push(`${display}: UUID-shaped private value`);
  }
  if (
    publicArtifact &&
    /finds\/[0-9a-f]{8}-[0-9a-f-]{27,}\/[^"'\s]+/i.test(source)
  ) {
    findings.push(`${display}: concrete private Storage path`);
  }
}

function approvedBundleEmail(value) {
  const normalized = value.toLowerCase();
  return normalized.endsWith("@example.test") ||
    normalized === "noreply@github.com" ||
    normalized.endsWith("@users.noreply.github.com");
}

function approvedFixtureUUID(value) {
  return /^(?:00000000|10000000|11000000|20000000|30000000|40000000)-0000-4000-8000-000000000[0-9]{3}$/i
    .test(value);
}

function bundlePaths(root, prefix = "") {
  const paths = [];
  for (const name of readdirSync(root).sort()) {
    const path = resolve(root, name);
    const display = prefix ? `${prefix}/${name}` : name;
    const status = lstatSync(path);
    if (status.isSymbolicLink()) {
      findings.push(`${display}: symlink`);
    } else if (status.isDirectory()) {
      paths.push(...bundlePaths(path, display));
    } else if (status.isFile()) {
      paths.push({ display, path });
    }
  }
  return paths;
}

function inspectBundleFile(display, buffer) {
  const source = buffer.toString("utf8");
  for (const [label, pattern] of credentialPatterns) {
    if (pattern.test(source)) findings.push(`${display}: ${label}`);
  }
  if (/(?:^|\/)\.env(?:\.|$)/i.test(display)) {
    findings.push(`${display}: environment file`);
  }
  if (/(?:^|\/)admin\/config\.js$/i.test(display)) {
    findings.push(`${display}: generated Manager configuration`);
  }
  if (
    /(?:^|\/)(?:admin\/)?runtime-config\.js$/i.test(display) &&
    /["']?publishableKey["']?\s*:\s*["'][^"']+["']/i.test(source)
  ) {
    findings.push(`${display}: generated non-empty runtime configuration`);
  }
  for (const email of source.matchAll(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi)) {
    const removedDefaultEmail = ["admin", "email.com"].join("@");
    const removedSupabaseDefault = display === "implementation.patch" &&
      email[0].toLowerCase() === removedDefaultEmail &&
      source.includes(`-# admin_email = "${removedDefaultEmail}"`);
    if (!approvedBundleEmail(email[0]) && !removedSupabaseDefault) {
      findings.push(`${display}: email-shaped private value`);
      break;
    }
  }
  for (const uuid of source.matchAll(
    /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi
  )) {
    if (!approvedFixtureUUID(uuid[0])) {
      findings.push(`${display}: UUID-shaped private owner identifier`);
      break;
    }
  }
  for (const storagePath of source.matchAll(
    /finds\/([0-9a-f]{8}-[0-9a-f-]{27,})\/[^"'\s]+/gi
  )) {
    if (!approvedFixtureUUID(storagePath[1])) {
      findings.push(`${display}: concrete private Storage path`);
      break;
    }
  }
  for (const match of source.matchAll(/https:\/\/([a-z0-9-]+)\.supabase\.co/gi)) {
    if (!/(?:test|fictional|example|project|your|different|wrong)/i.test(match[1])) {
      findings.push(`${display}: private Supabase project URL`);
      break;
    }
  }
}

const bundleArgument = process.argv.indexOf("--bundle-dir");
if (bundleArgument !== -1) {
  const requestedDirectory = process.argv[bundleArgument + 1];
  if (!requestedDirectory) throw new Error("--bundle-dir requires a directory.");
  const bundleDirectory = resolve(requestedDirectory);
  if (!existsSync(bundleDirectory) || !lstatSync(bundleDirectory).isDirectory()) {
    throw new Error("Review bundle directory does not exist.");
  }
  const files = bundlePaths(bundleDirectory);
  for (const file of files) inspectBundleFile(file.display, readFileSync(file.path));
  if (findings.length > 0) {
    console.error("M08 review-bundle privacy scan: FAIL");
    for (const finding of [...new Set(findings)].sort()) console.error(`- ${finding}`);
    process.exitCode = 1;
  } else {
    console.log(
      `M08 review-bundle privacy scan: PASS (${files.length} file(s), binary-safe)`
    );
  }
  process.exit();
}

for (const path of changedPaths()) {
  const absolute = resolve(repositoryRoot, path);
  if (!existsSync(absolute) || !lstatSync(absolute).isFile()) continue;
  inspect(path, readFileSync(absolute));
}
for (const artifact of artifactPaths()) inspect(artifact.display, readFileSync(artifact.path));

const patch = spawnSync("git", ["diff", "--binary", acceptedBase, "--"], {
  cwd: repositoryRoot,
  encoding: "buffer",
  maxBuffer: 64 * 1024 * 1024
});
if (patch.error || patch.status !== 0) {
  throw new Error("Final-diff security scan could not be generated.");
}
for (const [label, pattern] of credentialPatterns) {
  if (pattern.test(patch.stdout.toString("utf8"))) findings.push(`final diff: ${label}`);
}

if (findings.length > 0) {
  console.error("M08 security scan: FAIL");
  for (const finding of [...new Set(findings)].sort()) console.error(`- ${finding}`);
  process.exitCode = 1;
} else {
  console.log(
    `M08 security scan: PASS (${changedPaths().length} changed path(s), ` +
    `${artifactPaths().length} artifact file(s), binary-safe)`
  );
}
