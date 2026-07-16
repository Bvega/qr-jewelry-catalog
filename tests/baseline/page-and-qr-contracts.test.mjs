import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import test from "node:test";
import {
  APPROVED_QR_LIBRARY,
  extractScriptSources,
  extractStylesheetLinks,
  pathFromRoot,
  readProjectFile
} from "../../scripts/lib/baseline-contracts.mjs";

const indexHtml = readProjectFile("index.html");
const itemHtml = readProjectFile("item.html");
const appSource = readProjectFile("app.js");
const itemSource = readProjectFile("item.js");
const styles = readProjectFile("styles.css");

test("required public pages and DOM anchors exist", () => {
  assert.ok(existsSync(pathFromRoot("index.html")));
  assert.ok(existsSync(pathFromRoot("item.html")));
  assert.match(indexHtml, /\bid=["']catalogGrid["']/);
  assert.match(itemHtml, /\bid=["']itemDetail["']/);
});

test("catalog page loads the shared stylesheet, data, and renderer in order", () => {
  assert.ok(extractStylesheetLinks(indexHtml).includes("styles.css"));
  assert.deepEqual(extractScriptSources(indexHtml), [
    "data/items.js",
    "data/collections.js",
    "data/discovery.js",
    "app.js"
  ]);
});

test("detail page loads data, approved QR library, and renderer in order", () => {
  assert.ok(extractStylesheetLinks(itemHtml).includes("styles.css"));
  assert.deepEqual(extractScriptSources(itemHtml), [
    "data/items.js",
    APPROVED_QR_LIBRARY,
    "item.js"
  ]);
});

test("catalog and detail renderers retain required DOM and legacy-link contracts", () => {
  assert.match(appSource, /getElementById\(["']catalogGrid["']\)/);
  assert.match(appSource, /card\.href\s*=\s*["']item\.html\?id=["']\s*\+\s*item\.id/);
  assert.match(itemSource, /getElementById\(["']itemDetail["']\)/);
  assert.match(itemSource, /new URLSearchParams\(window\.location\.search\)/);
  assert.match(itemSource, /candidate\.id\s*===\s*itemId/);
  assert.match(itemSource, /href=["']item\.html\?id=["']\s*\+\s*related\.id/);
});

test("share, copy-link, QR generation, fallback, and download paths remain", () => {
  assert.match(itemSource, /var shareURL\s*=\s*window\.location\.href\s*;/);
  assert.match(itemSource, /navigator\.clipboard\.writeText\(shareURL\)/);
  assert.match(itemSource, /typeof QRCode\s*!==\s*["']undefined["']/);
  assert.match(itemSource, /new QRCode\(qrContainer,/);
  assert.match(itemSource, /text:\s*shareURL/);
  assert.match(itemSource, /qrFallback\.style\.display\s*=\s*["']block["']/);
  assert.match(itemSource, /qrDownloadBtn\.style\.display\s*=\s*["']none["']/);
  assert.match(itemSource, /canvas\.toDataURL\(["']image\/png["']\)/);
  assert.match(itemSource, /link\.download\s*=\s*["']jewelry-item-["']\s*\+\s*item\.id/);
});

test("shared CSS retains the current responsive layout breakpoints", () => {
  assert.match(styles, /#catalogGrid\s*{[\s\S]*?grid-template-columns:\s*1fr 1fr/);
  assert.match(styles, /@media\s*\(min-width:\s*600px\)/);
  assert.match(styles, /@media\s*\(min-width:\s*768px\)/);
  assert.match(styles, /@media\s*\(min-width:\s*900px\)/);
  assert.match(styles, /\.detail-card\s*{[\s\S]*?grid-template-columns:\s*1fr 1fr/);
});

test("GitHub workflow runs the local validator without installing or deploying", () => {
  const workflow = readProjectFile(".github/workflows/baseline-validation.yml");

  assert.match(workflow, /^name:\s*M01 Baseline Validation/m);
  assert.match(workflow, /^on:\s*$/m);
  assert.match(workflow, /^\s{2}push:\s*$/m);
  assert.match(workflow, /^\s{6}- ["']migration\/\*\*["']\s*$/m);
  assert.match(workflow, /^\s{6}- ["']feature\/\*\*["']\s*$/m);
  assert.match(workflow, /^\s{2}pull_request:\s*$/m);
  assert.match(workflow, /^\s{6}- main\s*$/m);
  assert.match(workflow, /uses:\s*actions\/setup-node@v4/);
  assert.match(workflow, /node-version:\s*["']22["']/);
  assert.match(workflow, /run:\s*node scripts\/validate-baseline\.mjs/);
  assert.doesNotMatch(workflow, /\b(?:npm|yarn|pnpm)\s+(?:install|ci)\b/);
  assert.doesNotMatch(workflow, /\bdeploy\b/i);
});
