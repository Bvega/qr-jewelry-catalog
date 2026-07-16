import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import test from "node:test";
import {
  pathFromRoot,
  readProjectFile
} from "../../scripts/lib/baseline-contracts.mjs";

const markPath = "assets/brand/between-us-mark.svg";
const mark = readProjectFile(markPath);

test("Between Us mark is a local accessible scalable SVG", () => {
  assert.ok(existsSync(pathFromRoot(markPath)));
  assert.match(mark, /^<svg\b[^>]*\bviewBox=["']0 0 160 160["']/);
  assert.match(mark, /<title\b[^>]*>[^<]*Between Us[^<]*<\/title>/);
  assert.match(mark, /\brole=["']img["']/);
});

test("mark contains the approved circle, BU monogram, and four-point sparkle", () => {
  assert.match(mark, /<circle\b/);
  assert.match(mark, /<text\b[^>]*>BU<\/text>/);
  assert.match(mark, /class=["']brand-sparkle["']/);
  assert.match(mark, /fill=["']#C79A43["']/i);
});

test("mark has no raster embedding or external dependency", () => {
  assert.doesNotMatch(mark, /<image\b/i);
  assert.doesNotMatch(mark, /\b(?:href|src)=["'](?:https?:|\/\/|data:)/i);
  assert.doesNotMatch(mark, /@import|url\s*\(/i);
});
