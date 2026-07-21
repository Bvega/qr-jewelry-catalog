import assert from "node:assert/strict";
import test from "node:test";
import { readProjectFile } from "../../scripts/lib/baseline-contracts.mjs";
import {
  loadFindDetailRuntime,
  renderFindDetail
} from "../../scripts/lib/find-detail-contracts.mjs";

const runtime = loadFindDetailRuntime();
const itemSource = readProjectFile("item.js");
const packageJson = JSON.parse(readProjectFile("package.json"));

test("one-photo Finds render a primary image without an empty thumbnail rail", () => {
  const result = renderFindDetail({ query: "?id=1", runtime });

  assert.deepEqual(result.photos, [runtime.finds[0].primaryPhoto]);
  assert.match(result.detail.innerHTML, /id="galleryMainImage"/);
  assert.match(result.detail.innerHTML, /alt="Gold Twisted Rope Bracelet"/);
  assert.doesNotMatch(result.detail.innerHTML, /class="gallery-thumbnails"/);
});

test("a synthetic multi-photo Find keeps primary first and normalized order after it", () => {
  const base = runtime.finds[0];
  const syntheticFind = {
    ...base,
    photos: ["photos/one.jpg", "photos/two.jpg", "photos/three.jpg"],
    primaryPhoto: "photos/two.jpg"
  };
  const lookup = {
    findByLegacyId(id) {
      return id === 1 ? syntheticFind : runtime.lookup.findByLegacyId(id);
    },
    findByPublicId(publicId) {
      return publicId === syntheticFind.publicId
        ? syntheticFind
        : runtime.lookup.findByPublicId(publicId);
    }
  };
  const result = renderFindDetail({ query: "?id=1", runtime, lookup });

  assert.deepEqual(result.photos, ["photos/two.jpg", "photos/one.jpg", "photos/three.jpg"]);
  assert.equal(result.thumbnailButtons.length, 3);
  assert.ok(result.detail.innerHTML.indexOf("photos/two.jpg") < result.detail.innerHTML.indexOf("photos/one.jpg"));
});

test("thumbnail buttons expose accessible state and select images by click and arrow key", () => {
  const base = runtime.finds[0];
  const syntheticFind = {
    ...base,
    photos: ["photos/one.jpg", "photos/two.jpg"],
    primaryPhoto: "photos/one.jpg"
  };
  const lookup = {
    findByLegacyId() { return syntheticFind; },
    findByPublicId(publicId) { return runtime.lookup.findByPublicId(publicId); }
  };
  const result = renderFindDetail({ query: "?id=1", runtime, lookup });

  assert.match(result.detail.innerHTML, /aria-label="View photo 1 of 2 for Gold Twisted Rope Bracelet"/);
  assert.match(result.detail.innerHTML, /aria-pressed="true"/);
  result.thumbnailButtons[1].click();
  assert.equal(result.elements.galleryMainImage.src, "photos/two.jpg");
  assert.equal(result.thumbnailButtons[0].getAttribute("aria-pressed"), "false");
  assert.equal(result.thumbnailButtons[1].getAttribute("aria-pressed"), "true");
  assert.equal(result.elements.galleryStatus.textContent, "Photo 2 of 2 selected.");

  result.thumbnailButtons[1].keydown("ArrowLeft");
  assert.equal(result.elements.galleryMainImage.src, "photos/one.jpg");
  assert.equal(result.thumbnailButtons[0].focused, true);
});

test("gallery image errors reveal a meaningful deliberate fallback", () => {
  const result = renderFindDetail({ query: "?id=1", runtime });

  result.elements.galleryMainImage.listeners.error();
  assert.equal(result.elements.galleryMainImage.hidden, true);
  assert.equal(result.elements.galleryMainImage.nextElementSibling.hidden, false);
  assert.match(result.detail.innerHTML, /No photo yet/);
  assert.match(result.detail.innerHTML, /Details are still available below\./);
});

test("public gallery remains dependency-free and uses no automatic carousel behavior", () => {
  assert.deepEqual(Object.keys(packageJson.dependencies), ["@supabase/supabase-js"]);
  assert.deepEqual(Object.keys(packageJson.devDependencies), ["esbuild", "supabase"]);
  assert.doesNotMatch(itemSource, /@supabase|\bimport\b|\brequire\s*\(/i);
  assert.doesNotMatch(itemSource, /setInterval|autoplay|carousel/i);
  assert.match(itemSource, /find\.photos\.forEach\(addPhoto\)/);
});
