import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { loadPagesManifest } from "../../scripts/build-pages-artifact.mjs";
import {
  buildCiDeploymentChecks,
  partitionRepositoryChecks,
  runCheck
} from "../../scripts/check-pages-ci.mjs";
import {
  LOCAL_MIGRATION_CHECK_LABELS,
  LOCAL_MIGRATION_EXCLUSION_REASON,
  buildRepositoryChecks
} from "../../scripts/lib/repository-checks.mjs";

const root = resolve(import.meta.dirname, "../..");
const workflow = readFileSync(resolve(root, ".github/workflows/deploy-pages.yml"), "utf8");
const packageJson = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));
const localOnlyPhotoNames = Object.freeze([
  "vintage-ceramic-handbell-01.jpeg",
  "burgundy-montblanc-pen-01.jpeg",
  "hand-painted-decorative-shell-01.png",
  "vintage-floral-teacup-saucer-01.png"
]);
const trackedPublicSources = Object.freeze([
  "index.html",
  "find.html",
  "item.html",
  "app.js",
  "item.js",
  "styles.css",
  "data/items.js",
  "data/collections.js",
  "data/discovery.js",
  "data/media.js",
  "data/permalinks.js",
  "data/reservation.js"
]);

test("workflow build job checks out enough history for accepted-baseline comparisons", () => {
  assert.match(
    workflow,
    /- name: Check out triggering revision with full history\n\s+uses: actions\/checkout@v6\n\s+with:\n\s+ref: \$\{\{ github\.sha \}\}\n\s+fetch-depth: 0/
  );
});

test("workflow invokes only the explicit clean-checkout deployment validation command", () => {
  const buildJob = workflow.slice(workflow.indexOf("\njobs:"), workflow.indexOf("\n  deploy:"));
  assert.match(buildJob, /run: npm run pages:check:ci$/m);
  assert.equal(workflow.split("npm run ").length - 1, 1);
  for (const localOnlyCommand of [
    "npm run validate:baseline",
    "npm run validate\n",
    "npm run admin:validate",
    "npm run migration:validate",
    "npm run migration:test",
    "npm run pages:test",
    "npm run pages:build",
    "npm run pages:validate"
  ]) assert.equal(workflow.includes(localOnlyCommand), false, localOnlyCommand);
  assert.doesNotMatch(workflow, /npm run pages:check(?!:ci)/);
  assert.doesNotMatch(workflow, /validate-baseline\.mjs|validate-catalog-migration\.mjs|catalog-migration/);
});

test("workflow permission boundaries and deploy gating remain unchanged", () => {
  const jobsIndex = workflow.indexOf("\njobs:");
  const deployIndex = workflow.indexOf("\n  deploy:");
  const workflowHeader = workflow.slice(0, jobsIndex);
  const buildJob = workflow.slice(jobsIndex, deployIndex);
  const deployJob = workflow.slice(deployIndex);

  assert.match(workflowHeader, /^permissions:\n  contents: read\s*$/m);
  assert.doesNotMatch(buildJob, /pages: write|id-token: write|permissions:/);
  assert.match(deployJob, /^\s{4}permissions:\n\s{6}pages: write\n\s{6}id-token: write\s*$/m);
  assert.match(deployJob, /github\.ref == 'refs\/heads\/main'/);
  assert.match(deployJob, /github\.event_name == 'push' \|\| github\.event_name == 'workflow_dispatch'/);
  assert.doesNotMatch(deployJob, /pull_request/);
  assert.match(
    deployJob,
    /uses: actions\/configure-pages@v5\n\n\s+- name: Deploy GitHub Pages\n\s+id: deployment\n\s+uses: actions\/deploy-pages@v4/
  );
});

test("local maintenance commands remain present, strict, and unchanged", () => {
  assert.equal(packageJson.scripts["validate:baseline"], "node scripts/validate-baseline.mjs");
  assert.equal(packageJson.scripts["admin:validate"], "node scripts/validate-seller-manager.mjs");
  assert.equal(packageJson.scripts["migration:validate"], "node scripts/validate-catalog-migration.mjs");
  assert.equal(packageJson.scripts["migration:test"], "node --test tests/catalog-migration/*.test.mjs");
  assert.equal(packageJson.scripts["pages:check"], "node scripts/check-pages.mjs");
  assert.equal(packageJson.scripts["pages:check:ci"], "node scripts/check-pages-ci.mjs");
  assert.equal(packageJson.scripts["pages:test"], "node --test tests/deployment/*.test.mjs");

  const baselineSource = readFileSync(resolve(root, "scripts/validate-baseline.mjs"), "utf8");
  assert.match(baselineSource, /buildRepositoryChecks\(\)/);
  assert.doesNotMatch(baselineSource, /requiresLocalMigrationSources/);

  const checkPagesSource = readFileSync(resolve(root, "scripts/check-pages.mjs"), "utf8");
  assert.match(checkPagesSource, /validate-catalog-migration\.mjs/);
  assert.match(checkPagesSource, /tests\/catalog-migration/);

  const checks = buildRepositoryChecks();
  const tagged = checks.filter((check) => check.requiresLocalMigrationSources);
  assert.deepEqual(tagged.map((check) => check.label), [...LOCAL_MIGRATION_CHECK_LABELS]);
  assert.deepEqual(checks.slice(-2).map((check) => check.label), [...LOCAL_MIGRATION_CHECK_LABELS]);
  assert.equal(tagged[0].displayCommand, "node scripts/validate-catalog-migration.mjs");
  assert.equal(tagged[1].displayCommand, "node --test tests/catalog-migration/*.test.mjs");
  assert.ok(tagged[1].arguments.length > 1);
});

test("clean deployment validation excludes exactly the two photo-dependent migration checks", () => {
  const checks = buildRepositoryChecks();
  const { included, excluded } = partitionRepositoryChecks();
  assert.deepEqual(excluded.map((check) => check.label), [...LOCAL_MIGRATION_CHECK_LABELS]);
  assert.equal(included.length + excluded.length, checks.length);
  assert.match(LOCAL_MIGRATION_EXCLUSION_REASON, /content-intake\/photos/);
  assert.match(LOCAL_MIGRATION_EXCLUSION_REASON, /untracked/);
});

test("clean deployment validation covers public, Manager, foundation, and deployment contracts", () => {
  const ciChecks = buildCiDeploymentChecks();
  for (const label of [
    "Baseline contract tests",
    "Find domain and compatibility adapter tests",
    "Between Us brand and public shell tests",
    "Collections and discovery tests",
    "Find Details, gallery, media, and reservation tests",
    "Permalink, sharing, Copy Link, and QR tests",
    "Content intake tests",
    "Content intake default validation",
    "Content intake default summary",
    "Supabase foundation static validation",
    "Supabase foundation tests",
    "Seller Catalog Manager tests",
    "Seller Catalog Manager validation",
    "Pages deployment contract tests"
  ]) {
    assert.ok(ciChecks.some((check) => check.label === label), label);
  }
});

test("clean deployment validation never executes migration checks or reads local-only photos", () => {
  const ciChecks = buildCiDeploymentChecks();
  for (const check of ciChecks) {
    assert.notEqual(check.arguments[0], "scripts/validate-catalog-migration.mjs", check.label);
    for (const argument of check.arguments) {
      assert.ok(!argument.includes("tests/catalog-migration"), `${check.label}: ${argument}`);
      assert.ok(!argument.includes("content-intake/photos"), `${check.label}: ${argument}`);
      for (const photo of localOnlyPhotoNames) {
        assert.ok(!argument.includes(photo), `${check.label}: ${argument}`);
      }
    }
  }
});

test("local-only migration photos remain untracked and ignored", () => {
  const tracked = spawnSync("git", ["ls-files", "--", "content-intake/photos"], {
    cwd: root,
    encoding: "utf8"
  });
  assert.equal(tracked.status, 0, tracked.stderr);
  assert.deepEqual(
    tracked.stdout.split("\n").filter(Boolean),
    ["content-intake/photos/.gitkeep"]
  );
  for (const photo of localOnlyPhotoNames) {
    const ignored = spawnSync("git", ["check-ignore", "-q", `content-intake/photos/${photo}`], {
      cwd: root
    });
    assert.equal(ignored.status, 0, photo);
  }
});

test("deployment check runner strictly propagates pass and fail outcomes", () => {
  const pass = runCheck({
    label: "fixture pass",
    displayCommand: "node --eval process.exit(0)",
    arguments: ["--eval", "process.exit(0)"]
  }, { silent: true });
  assert.equal(pass.ok, true);
  assert.equal(pass.status, 0);

  const fail = runCheck({
    label: "fixture fail",
    displayCommand: "node --eval process.exit(1)",
    arguments: ["--eval", "process.exit(1)"]
  }, { silent: true });
  assert.equal(fail.ok, false);
  assert.equal(fail.status, 1);
});

test("tracked public catalog sources keep BU-0006 through BU-0009 absent", () => {
  const publicText = trackedPublicSources
    .map((path) => readFileSync(resolve(root, path), "utf8"))
    .join("\n");
  for (const id of ["BU-0006", "BU-0007", "BU-0008", "BU-0009"]) {
    assert.equal(publicText.includes(id), false, id);
  }
});

test("Pages manifest keeps activation, migration, and intake content out of production", () => {
  const manifest = loadPagesManifest();
  assert.equal(manifest.files.length, 21);
  const outputs = manifest.files.map((entry) => entry.output);
  for (const forbidden of [
    "admin/activate.html",
    "admin/migrate-intake.html",
    "admin/assets/activate.js",
    "admin/assets/migrate-intake.js",
    "admin/config.js"
  ]) {
    assert.equal(outputs.includes(forbidden), false, forbidden);
  }
  for (const entry of manifest.files) {
    if (entry.source) {
      assert.ok(!entry.source.startsWith("content-intake/"), entry.source);
      assert.ok(!entry.source.startsWith("migration/"), entry.source);
    }
  }
});
