import assert from "node:assert/strict";
import test from "node:test";
import { readProjectFile } from "../../scripts/lib/baseline-contracts.mjs";
import {
  loadFindDetailRuntime,
  renderFindDetail
} from "../../scripts/lib/find-detail-contracts.mjs";

const runtime = loadFindDetailRuntime();
const itemSource = readProjectFile("item.js");

test("numeric routes resolve normalized Finds through the compatibility lookup", () => {
  assert.match(itemSource, /window\.BETWEEN_US_DATA\.findByLegacyId\(itemId\)/);

  for (const find of runtime.finds) {
    const result = renderFindDetail({ query: `?id=${find.legacyId}`, runtime });

    assert.equal(result.find, find);
    assert.equal(result.document.title, `${find.title} | Between Us Finds`);
    assert.match(result.detail.innerHTML, new RegExp(find.publicId));
    assert.match(result.detail.innerHTML, new RegExp(find.title));
    assert.doesNotMatch(result.detail.innerHTML, /Find not found/);
  }
});

test("detail presents public ID, Collection registry label, normalized price, and availability", () => {
  const result = renderFindDetail({ query: "?id=1", runtime });

  assert.match(result.detail.innerHTML, /Find ID: <strong>BU-0001<\/strong>/);
  assert.match(result.detail.innerHTML, /Collection: Jewelry/);
  assert.match(result.detail.innerHTML, /\$28\.00/);
  assert.match(result.detail.innerHTML, /Availability:[\s\S]*Available/);
  assert.match(itemSource, /new Intl\.NumberFormat\(["']en-US["']/);
  assert.match(itemSource, /currency:\s*price\.currency/);
});

test("null condition and internal normalized metadata are omitted", () => {
  const result = renderFindDetail({ query: "?id=1", runtime });

  assert.doesNotMatch(result.detail.innerHTML, /Condition:/);
  assert.doesNotMatch(result.detail.innerHTML, /Legacy ID:|Slug:|Created at:|Updated at:/);
});

test("a real non-empty condition is rendered without changing the page structure", () => {
  const base = runtime.finds[0];
  const conditionedFind = { ...base, condition: "Excellent" };
  const lookup = {
    findByLegacyId(id) {
      return id === conditionedFind.legacyId ? conditionedFind : runtime.lookup.findByLegacyId(id);
    },
    findByPublicId(publicId) {
      return publicId === conditionedFind.publicId
        ? conditionedFind
        : runtime.lookup.findByPublicId(publicId);
    }
  };
  const result = renderFindDetail({ query: "?id=1", runtime, lookup });

  assert.match(result.detail.innerHTML, /Condition:<\/span> Excellent/);
  assert.equal((result.detail.innerHTML.match(/<h1\b/g) || []).length, 1);
});

test("invalid numeric, nonnumeric, and missing IDs retain the branded invalid state", () => {
  for (const query of ["", "?id=not-a-number", "?id=999"]) {
    const result = renderFindDetail({ query, runtime });

    assert.equal(result.document.title, "Find not found | Between Us Finds");
    assert.match(result.detail.innerHTML, /<h1>Find not found\.<\/h1>/);
    assert.match(result.detail.innerHTML, /href="index\.html#explore"/);
  }
});

test("Related Finds resolve normalized public IDs in their exact configured order", () => {
  const result = renderFindDetail({ query: "?id=1", runtime });
  const first = result.detail.innerHTML.indexOf("item.html?id=2");
  const second = result.detail.innerHTML.indexOf("item.html?id=4");

  assert.ok(first >= 0);
  assert.ok(second > first);
  assert.match(itemSource, /find\.relatedFindIds\.map/);
  assert.doesNotMatch(result.detail.innerHTML, /reservation[^>]*item\.html\?id=2/i);
});
