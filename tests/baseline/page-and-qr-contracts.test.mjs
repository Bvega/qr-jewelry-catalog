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
const findHtml = readProjectFile("find.html");
const appSource = readProjectFile("app.js");
const itemSource = readProjectFile("item.js");
const styles = readProjectFile("styles.css");

test("required public pages and DOM anchors exist", () => {
  assert.ok(existsSync(pathFromRoot("index.html")));
  assert.ok(existsSync(pathFromRoot("item.html")));
  assert.ok(existsSync(pathFromRoot("find.html")));
  assert.match(indexHtml, /\bid=["']catalogGrid["']/);
  assert.match(itemHtml, /\bid=["']itemDetail["']/);
  assert.match(findHtml, /\bid=["']itemDetail["']/);
});

test("catalog page loads the shared stylesheet, data, and renderer in order", () => {
  assert.ok(extractStylesheetLinks(indexHtml).includes("styles.css"));
  assert.deepEqual(extractScriptSources(indexHtml), [
    "data/items.js",
    "data/collections.js",
    "data/discovery.js",
    "data/media.js",
    "data/permalinks.js",
    "app.js"
  ]);
});

test("detail page loads data, approved QR library, and renderer in order", () => {
  assert.ok(extractStylesheetLinks(itemHtml).includes("styles.css"));
  assert.deepEqual(extractScriptSources(itemHtml), [
    "data/items.js",
    "data/collections.js",
    "data/media.js",
    "data/reservation.js",
    "data/permalinks.js",
    APPROVED_QR_LIBRARY,
    "item.js"
  ]);
  assert.deepEqual(extractScriptSources(findHtml), extractScriptSources(itemHtml));
});

test("catalog and detail renderers use permanent links while retaining legacy route resolution", () => {
  assert.match(appSource, /getElementById\(["']catalogGrid["']\)/);
  assert.match(appSource, /BETWEEN_US_PERMALINKS\.permalinkFor\(find\)/);
  assert.match(itemSource, /getElementById\(["']itemDetail["']\)/);
  assert.match(itemSource, /permalinks\.findByRoute\(window\.location\)/);
  assert.match(itemSource, /currentCanonicalUrl\(window\.location\)/);
  assert.match(itemSource, /BETWEEN_US_PERMALINKS\.permalinkFor\(relatedFind\)/);
});

test("share, copy-link, QR generation, fallback, and PNG download paths remain", () => {
  assert.match(itemSource, /navigator\.clipboard\.writeText\(text\)/);
  assert.match(itemSource, /document\.execCommand\(["']copy["']\)/);
  assert.match(itemSource, /navigator\.share\(shareData\)/);
  assert.match(itemSource, /new Constructor\(qrContainer,/);
  assert.match(itemSource, /text:\s*canonicalURL/);
  assert.match(itemSource, /QR generation is temporarily unavailable\. Use Copy Link instead\./);
  assert.match(itemSource, /qrContainer\.innerHTML\s*=\s*["']["']/);
  assert.match(itemSource, /canvas\.toDataURL\(["']image\/png["']\)/);
  assert.match(itemSource, /link\.download\s*=\s*["']between-us-["']\s*\+\s*find\.publicId\s*\+\s*["']-qr\.png["']/);
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
