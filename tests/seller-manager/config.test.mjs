import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import {
  generateAdminConfig,
  parseEnvironment,
  serializeBrowserConfiguration,
  validateBrowserConfiguration
} from "../../scripts/generate-admin-config.mjs";

const projectRef = "m07b2q9x8c7v6n5p4r3";
const publishableKey = "sb_publishable_m07b2_test_only_q9x8c7v6n5p4r3";

test("environment parsing and validation expose only browser-safe names", () => {
  const parsed = parseEnvironment(`
SUPABASE_URL=https://${projectRef}.supabase.co
SUPABASE_PUBLISHABLE_KEY=${publishableKey}
SUPABASE_PROJECT_REF=${projectRef}
UNRELATED_VALUE=ignored
  `);
  assert.deepEqual(validateBrowserConfiguration(parsed), {
    url: `https://${projectRef}.supabase.co/`,
    publishableKey,
    projectRef
  });
});

test("config validation rejects missing, insecure, mismatched, and secret settings", () => {
  assert.throws(() => validateBrowserConfiguration({}), /SUPABASE_URL/);
  assert.throws(() => validateBrowserConfiguration({
    SUPABASE_URL: `http://${projectRef}.supabase.co`,
    SUPABASE_PUBLISHABLE_KEY: publishableKey,
    SUPABASE_PROJECT_REF: projectRef
  }), /HTTPS URL/);
  assert.throws(() => validateBrowserConfiguration({
    SUPABASE_URL: `https://${projectRef}.supabase.co`,
    SUPABASE_PUBLISHABLE_KEY: ["sb", "secret", "test-only-not-real-123456789"].join("_"),
    SUPABASE_PROJECT_REF: projectRef
  }), /browser-safe/);
  assert.throws(() => validateBrowserConfiguration({
    SUPABASE_URL: `https://${projectRef}.supabase.co`,
    SUPABASE_PUBLISHABLE_KEY: publishableKey,
    SUPABASE_PROJECT_REF: projectRef,
    SUPABASE_SERVICE_ROLE_KEY: "test-only"
  }), /not accepted/);
});

test("config validation accepts only the exact local M07B-3 loopback endpoint", () => {
  assert.deepEqual(validateBrowserConfiguration({
    SUPABASE_URL: "http://127.0.0.1:54321",
    SUPABASE_PUBLISHABLE_KEY: publishableKey,
    SUPABASE_PROJECT_REF: "local-m07b3"
  }), {
    url: "http://127.0.0.1:54321/",
    publishableKey,
    projectRef: "local-m07b3"
  });
  assert.throws(() => validateBrowserConfiguration({
    SUPABASE_URL: "http://localhost:54321",
    SUPABASE_PUBLISHABLE_KEY: publishableKey,
    SUPABASE_PROJECT_REF: "local-m07b3"
  }), /not accepted|matching remote|loopback/i);
});

test("generator writes safely serialized configuration without modifying its input", () => {
  const directory = mkdtempSync(join(tmpdir(), "between-us-admin-config-"));
  const environmentPath = join(directory, ".env.local");
  const outputPath = join(directory, "config.js");
  const source = `SUPABASE_URL=https://${projectRef}.supabase.co\nSUPABASE_PUBLISHABLE_KEY=${publishableKey}\nSUPABASE_PROJECT_REF=${projectRef}\n`;
  writeFileSync(environmentPath, source);
  generateAdminConfig({ environmentPath, outputPath });

  assert.equal(readFileSync(environmentPath, "utf8"), source);
  const output = readFileSync(outputPath, "utf8");
  assert.equal(output, serializeBrowserConfiguration({
    url: `https://${projectRef}.supabase.co/`, publishableKey, projectRef
  }));
  assert.match(output, /^window\.BETWEEN_US_ADMIN_CONFIG = Object\.freeze\(/);
  assert.doesNotMatch(output, /serviceRole|databasePassword|accessToken/i);
});

test("generated config is ignored and committed bundle contains no generated values", () => {
  const root = resolve(import.meta.dirname, "../..");
  const ignored = spawnSync("git", ["check-ignore", "-q", "admin/config.js"], { cwd: root });
  assert.equal(ignored.status, 0);
  for (const bundleName of ["app.js", "activate.js", "migrate-intake.js"]) {
    const bundle = readFileSync(resolve(root, `admin/assets/${bundleName}`), "utf8");
    assert.doesNotMatch(bundle, new RegExp(projectRef));
    assert.doesNotMatch(bundle, new RegExp(publishableKey));
  }
});
