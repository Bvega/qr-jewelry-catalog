import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve, sep } from "node:path";
import test from "node:test";
import {
  EXPECTED_LEGACY_IDS,
  EXPECTED_REAL_IMAGE_PATHS,
  repositoryRoot
} from "../../scripts/lib/baseline-contracts.mjs";

function readStaticRoute(route) {
  try {
    const requestUrl = new URL(route, "https://static-preview.test");
    const relativePath = requestUrl.pathname === "/"
      ? "index.html"
      : decodeURIComponent(requestUrl.pathname.slice(1));
    const filePath = resolve(repositoryRoot, relativePath);

    if (filePath !== repositoryRoot && !filePath.startsWith(`${repositoryRoot}${sep}`)) {
      return { status: 403, body: Buffer.from("Forbidden") };
    }

    return { status: 200, body: readFileSync(filePath) };
  } catch (error) {
    return {
      status: error.code === "ENOENT" ? 404 : 500,
      body: Buffer.from("Not found")
    };
  }
}

for (const publicPath of [
  "/",
  "/index.html",
  "/find.html",
  "/styles.css",
  "/app.js",
  "/item.js",
  "/runtime-config.js",
  "/data/items.js",
  "/data/collections.js",
  "/data/discovery.js",
  "/data/media.js",
  "/data/reservation.js",
  "/data/permalinks.js",
  "/data/public-catalog.js"
]) {
  test(`${publicPath} resolves as a static resource`, () => {
    const response = readStaticRoute(publicPath);

    assert.equal(response.status, 200);
    assert.ok(response.body.length > 0);
  });
}

for (const publicId of ["BU-0001", "BU-0002", "BU-0003", "BU-0004", "BU-0005"]) {
  test(`/find.html?id=${publicId} resolves the permanent Find detail shell`, () => {
    const response = readStaticRoute(`/find.html?id=${publicId}`);

    assert.equal(response.status, 200);
    assert.match(response.body.toString("utf8"), /\bid=["']itemDetail["']/);
  });
}

for (const id of EXPECTED_LEGACY_IDS) {
  test(`/item.html?id=${id} resolves the item detail shell`, () => {
    const response = readStaticRoute(`/item.html?id=${id}`);

    assert.equal(response.status, 200);
    assert.match(response.body.toString("utf8"), /\bid=["']itemDetail["']/);
  });
}

for (const imagePath of EXPECTED_REAL_IMAGE_PATHS) {
  test(`/${imagePath} resolves the existing real image`, () => {
    const response = readStaticRoute(`/${imagePath}`);

    assert.equal(response.status, 200);
    assert.ok(response.body.length > 0);
  });
}
