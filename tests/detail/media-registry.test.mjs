import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";
import {
  EXPECTED_REAL_IMAGE_PATHS,
  pathFromRoot,
  readProjectFile
} from "../../scripts/lib/baseline-contracts.mjs";
import {
  EXPECTED_UNAVAILABLE_MEDIA,
  loadFindDetailRuntime,
  renderFindDetail,
  toPlainData
} from "../../scripts/lib/find-detail-contracts.mjs";

const runtime = loadFindDetailRuntime();

test("media registry exposes exactly the two known unavailable local paths", () => {
  assert.deepEqual(
    toPlainData(runtime.media.unavailablePaths),
    EXPECTED_UNAVAILABLE_MEDIA
  );
  assert.ok(Object.isFrozen(runtime.media));
  assert.ok(Object.isFrozen(runtime.media.unavailablePaths));
  assert.equal(typeof runtime.media.isUnavailable, "function");
});

test("real image paths are never registered unavailable", () => {
  for (const path of EXPECTED_REAL_IMAGE_PATHS) {
    assert.equal(runtime.media.isUnavailable(path), false);
  }
  for (const path of EXPECTED_UNAVAILABLE_MEDIA) {
    assert.equal(runtime.media.isUnavailable(path), true);
  }
});

test("known unavailable detail media renders fallback without assigning a missing src", () => {
  for (const legacyId of [2, 3]) {
    const result = renderFindDetail({ query: `?id=${legacyId}`, runtime });
    const missingPath = runtime.finds[legacyId - 1].primaryPhoto;

    assert.match(result.detail.innerHTML, /No photo yet/);
    assert.doesNotMatch(result.detail.innerHTML, new RegExp(`src="${missingPath}"`));
  }
});

test("standard home cards use the same registry decision and preserve real photos", () => {
  const catalogGrid = {
    children: [],
    _innerHTML: "",
    set innerHTML(value) {
      this._innerHTML = value;
      if (value === "") this.children = [];
    },
    get innerHTML() { return this._innerHTML; },
    appendChild(child) { this.children.push(child); }
  };
  const context = {
    console,
    document: {
      getElementById(id) { return id === "catalogGrid" ? catalogGrid : null; },
      createElement() { return { className: "", href: "", innerHTML: "" }; }
    },
    window: {
      BETWEEN_US_COLLECTIONS: [],
      BETWEEN_US_FINDS: runtime.finds,
      BETWEEN_US_MEDIA: runtime.media,
      JEWELRY_ITEMS: runtime.legacyItems
    }
  };

  vm.runInNewContext(readProjectFile("app.js"), context, {
    filename: pathFromRoot("app.js")
  });

  assert.match(catalogGrid.children[0].innerHTML, /gold-twisted-rope-bracelet-01\.jpeg/);
  assert.doesNotMatch(catalogGrid.children[1].innerHTML, /placeholder-ring-silver\.jpg/);
  assert.match(catalogGrid.children[1].innerHTML, /No photo yet/);
});

test("media registry duplicates no Find records or mutable catalog values", () => {
  assert.deepEqual(Object.keys(runtime.media), ["unavailablePaths", "isUnavailable"]);
  const source = readProjectFile("data/media.js");
  assert.doesNotMatch(source, /\b(?:publicId|legacyId|title|price|availability|relatedFindIds)\s*:/);
  assert.equal(runtime.finds.length, 5);
});
