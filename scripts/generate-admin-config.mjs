#!/usr/bin/env node

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
export const repositoryRoot = resolve(scriptDirectory, "..");

const REQUIRED_NAMES = Object.freeze([
  "SUPABASE_URL",
  "SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_PROJECT_REF"
]);
const FORBIDDEN_NAMES = Object.freeze([
  "SUPABASE_ACCESS_TOKEN",
  "SUPABASE_DB_PASSWORD",
  "SUPABASE_SECRET_KEY",
  "SUPABASE_SERVICE_ROLE_KEY"
]);

export function parseEnvironment(source) {
  const values = {};
  for (const rawLine of source.split(/\r?\n/)) {
    let line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    if (line.startsWith("export ")) line = line.slice(7).trim();
    const separator = line.indexOf("=");
    if (separator < 1) continue;
    const name = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if (
      value.length >= 2
      && ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'")))
    ) {
      value = value.slice(1, -1);
    }
    values[name] = value;
  }
  return values;
}

function decodedJwtRole(key) {
  if (!key.startsWith("eyJ")) return null;
  try {
    const payload = key.split(".")[1];
    if (!payload) return "invalid";
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const decoded = Buffer.from(normalized, "base64").toString("utf8");
    return JSON.parse(decoded).role || "invalid";
  } catch {
    return "invalid";
  }
}

export function validateBrowserConfiguration(values) {
  for (const name of REQUIRED_NAMES) {
    if (typeof values[name] !== "string" || values[name].trim() === "") {
      throw new Error(`Missing or blank required setting: ${name}.`);
    }
  }
  for (const name of FORBIDDEN_NAMES) {
    if (typeof values[name] === "string" && values[name].trim() !== "") {
      throw new Error(`Secret setting is not accepted by this generator: ${name}.`);
    }
  }

  const projectRef = values.SUPABASE_PROJECT_REF.trim();
  if (!/^[a-z0-9-]{8,40}$/.test(projectRef)) {
    throw new Error("SUPABASE_PROJECT_REF is not a valid project reference.");
  }

  let projectUrl;
  try {
    projectUrl = new URL(values.SUPABASE_URL.trim());
  } catch {
    throw new Error("SUPABASE_URL is not a valid URL.");
  }
  const local = projectUrl.protocol === "http:"
    && projectUrl.hostname === "127.0.0.1"
    && projectUrl.port === "54321"
    && projectRef === "local-m07b3";
  const remote = projectUrl.protocol === "https:"
    && projectUrl.hostname === `${projectRef}.supabase.co`;
  if (
    (!local && !remote)
    || projectUrl.username
    || projectUrl.password
    || projectUrl.pathname !== "/"
    || projectUrl.search
    || projectUrl.hash
  ) {
    throw new Error("SUPABASE_URL must be the matching remote HTTPS URL or exact M07B-3 loopback URL.");
  }

  const publishableKey = values.SUPABASE_PUBLISHABLE_KEY.trim();
  const jwtRole = decodedJwtRole(publishableKey);
  const modernPublishable = /^sb_publishable_[A-Za-z0-9_-]{16,}$/.test(publishableKey);
  const legacyAnon = jwtRole === "anon";
  if (
    /^sb_secret_/i.test(publishableKey)
    || /service[_-]?role/i.test(publishableKey)
    || (!modernPublishable && !legacyAnon)
  ) {
    throw new Error("SUPABASE_PUBLISHABLE_KEY must be a browser-safe publishable or legacy anon key.");
  }

  return {
    url: projectUrl.toString(),
    publishableKey,
    projectRef
  };
}

export function serializeBrowserConfiguration(configuration) {
  const json = JSON.stringify(configuration, null, 2)
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029")
    .replace(/</g, "\\u003c");
  return `window.BETWEEN_US_ADMIN_CONFIG = Object.freeze(${json});\n`;
}

export function generateAdminConfig({
  environmentPath = resolve(repositoryRoot, ".env.local"),
  outputPath = resolve(repositoryRoot, "admin/config.js")
} = {}) {
  if (!existsSync(environmentPath)) {
    throw new Error("Missing .env.local.");
  }
  const values = parseEnvironment(readFileSync(environmentPath, "utf8"));
  const configuration = validateBrowserConfiguration(values);
  writeFileSync(outputPath, serializeBrowserConfiguration(configuration), { encoding: "utf8", mode: 0o600 });
}

function parseLocalStatus(source) {
  const values = {};
  for (const line of source.split(/\r?\n/)) {
    const match = line.match(/^(API_URL|ANON_KEY|PUBLISHABLE_KEY)=(.*)$/);
    if (!match) continue;
    values[match[1]] = match[2].trim().replace(/^['"]|['"]$/g, "");
  }
  return values;
}

export function generateLocalAdminConfig({
  outputPath = resolve(repositoryRoot, "admin/config.js"),
  workdir = repositoryRoot
} = {}) {
  const status = spawnSync("supabase", ["status", "-o", "env", "--workdir", workdir, "--agent", "no"], {
    cwd: repositoryRoot,
    encoding: "utf8"
  });
  if (status.error || status.status !== 0) throw new Error("Local Supabase status is unavailable.");
  const local = parseLocalStatus(status.stdout);
  const configuration = validateBrowserConfiguration({
    SUPABASE_URL: local.API_URL,
    SUPABASE_PUBLISHABLE_KEY: local.PUBLISHABLE_KEY || local.ANON_KEY,
    SUPABASE_PROJECT_REF: "local-m07b3"
  });
  writeFileSync(outputPath, serializeBrowserConfiguration(configuration), { encoding: "utf8", mode: 0o600 });
}

async function main() {
  try {
    if (process.argv.includes("--local")) {
      const workdirIndex = process.argv.indexOf("--workdir");
      const workdir = workdirIndex >= 0 ? process.argv[workdirIndex + 1] : repositoryRoot;
      if (!workdir) throw new Error("--workdir requires a local project directory.");
      generateLocalAdminConfig({ workdir });
    }
    else generateAdminConfig();
    console.log("Seller Manager browser configuration generated.");
  } catch (error) {
    console.error(`Seller Manager browser configuration failed: ${error.message}`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await main();
}
