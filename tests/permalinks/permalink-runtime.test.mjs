import assert from "node:assert/strict";
import test from "node:test";
import { readProjectFile } from "../../scripts/lib/baseline-contracts.mjs";
import {
  PREVIEW_BASE_PATH,
  PREVIEW_ORIGIN,
  loadPermalinkRuntime
} from "../../scripts/lib/permalink-contracts.mjs";

const runtime = loadPermalinkRuntime({
  href: `${PREVIEW_ORIGIN}${PREVIEW_BASE_PATH}item.html?id=1&utm_source=old#details`
});
const { finds, permalinks } = runtime;

test("permalink runtime exposes one frozen read-only namespace", () => {
  assert.deepEqual(Object.keys(permalinks), [
    "findByRoute",
    "permalinkFor",
    "legacyUrlFor",
    "slugAliasFor",
    "currentCanonicalUrl"
  ]);
  assert.ok(Object.isFrozen(permalinks));
  for (const helper of Object.values(permalinks)) assert.equal(typeof helper, "function");
});

test("every Find generates exact absolute URLs beneath the current deployment base", () => {
  for (const find of finds) {
    assert.equal(
      permalinks.permalinkFor(find),
      `${PREVIEW_ORIGIN}${PREVIEW_BASE_PATH}find.html?id=${find.publicId}`
    );
    assert.equal(
      permalinks.legacyUrlFor(find),
      `${PREVIEW_ORIGIN}${PREVIEW_BASE_PATH}item.html?id=${find.legacyId}`
    );
    assert.equal(
      permalinks.slugAliasFor(find),
      `${PREVIEW_ORIGIN}${PREVIEW_BASE_PATH}find.html?slug=${find.slug}`
    );
  }
});

test("generation drops unrelated query values and hashes without hardcoding a host or repository", () => {
  const generated = permalinks.permalinkFor(
    "BU-0001",
    "https://pages.example/owner/project/index.html?filter=jewelry#explore"
  );

  assert.equal(generated, "https://pages.example/owner/project/find.html?id=BU-0001");
  assert.doesNotMatch(readProjectFile("data/permalinks.js"), /github\.io|localhost|qr-jewelry-catalog/i);
});

test("public-ID, exact slug, and legacy numeric routes resolve the same normalized records", () => {
  for (const find of finds) {
    assert.equal(
      permalinks.findByRoute(`${PREVIEW_ORIGIN}${PREVIEW_BASE_PATH}find.html?id=${find.publicId}`),
      find
    );
    assert.equal(
      permalinks.findByRoute(`${PREVIEW_ORIGIN}${PREVIEW_BASE_PATH}find.html?slug=${find.slug}`),
      find
    );
    assert.equal(
      permalinks.findByRoute(`${PREVIEW_ORIGIN}${PREVIEW_BASE_PATH}item.html?id=${find.legacyId}`),
      find
    );
  }
});

test("canonical lookup converts public, slug, and legacy routes to the public-ID permalink", () => {
  const expected = `${PREVIEW_ORIGIN}${PREVIEW_BASE_PATH}find.html?id=BU-0001`;

  for (const route of [
    "find.html?id=BU-0001",
    "find.html?slug=gold-twisted-rope-bracelet",
    "item.html?id=1"
  ]) {
    assert.equal(
      permalinks.currentCanonicalUrl(`${PREVIEW_ORIGIN}${PREVIEW_BASE_PATH}${route}`),
      expected
    );
  }
});

test("malformed, unknown, missing, ambiguous, and unsupported routes fail safely", () => {
  const invalidRoutes = [
    "find.html",
    "find.html?id=",
    "find.html?id=BU-9999",
    "find.html?id=bu-0001",
    "find.html?id=1",
    "find.html?slug=unknown",
    "find.html?id=BU-0001&slug=gold-twisted-rope-bracelet",
    "find.html?id=BU-0001&id=BU-0001",
    "find.html?id=BU-0001&campaign=x",
    "item.html",
    "item.html?id=not-a-number",
    "item.html?id=01",
    "item.html?id=999",
    "item.html?id=1&campaign=x",
    "index.html?id=BU-0001"
  ];

  for (const route of invalidRoutes) {
    const href = `${PREVIEW_ORIGIN}${PREVIEW_BASE_PATH}${route}`;
    assert.equal(permalinks.findByRoute(href), null, route);
    assert.equal(permalinks.currentCanonicalUrl(href), null, route);
  }
  assert.equal(permalinks.findByRoute("not a url"), null);
  assert.equal(permalinks.permalinkFor("BU-9999"), null);
});

test("the runtime reuses the normalized registry without duplicating Find records", () => {
  for (const find of finds) {
    assert.equal(permalinks.findByRoute(permalinks.permalinkFor(find)), find);
  }
  assert.doesNotMatch(
    readProjectFile("data/permalinks.js"),
    /\b(?:title|description|price|availability|photos|relatedFindIds)\s*:/
  );
});
