import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { inflateSync } from "node:zlib";
import { fileURLToPath, pathToFileURL } from "node:url";

const repositoryRoot = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const localCanaryModule = await import(pathToFileURL(
  resolve(repositoryRoot, "scripts/browser-validation/local-canary.mjs")
));
const source = readFileSync(
  resolve(repositoryRoot, "scripts/browser-validation/local-canary.mjs"),
  "utf8"
);
const encodedMatch = /const tinyPng = Buffer\.from\(\s*"([^"]+)",\s*"base64"\s*\)/.exec(
  source
);
const png = Buffer.from(encodedMatch?.[1] || "", "base64");
const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

function parsePng(buffer) {
  assert.equal(buffer.subarray(0, 8).equals(pngSignature), true);
  const chunks = [];
  let offset = 8;
  while (offset + 12 <= buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString("ascii", offset + 4, offset + 8);
    const data = buffer.subarray(offset + 8, offset + 8 + length);
    chunks.push({ type, data });
    offset += 12 + length;
  }
  assert.equal(offset, buffer.length);
  const ihdr = chunks.find((chunk) => chunk.type === "IHDR")?.data;
  const idat = chunks
    .filter((chunk) => chunk.type === "IDAT")
    .map((chunk) => chunk.data);
  assert.equal(ihdr?.length, 13);
  assert.equal(idat.length > 0, true);
  return {
    width: ihdr.readUInt32BE(0),
    height: ihdr.readUInt32BE(4),
    decoded: inflateSync(Buffer.concat(idat))
  };
}

test("the embedded local canary photograph passes strict PNG decoding", () => {
  assert.doesNotThrow(() => parsePng(png));
});

test("the embedded photograph is visibly inspectable rather than a one-pixel placeholder", () => {
  const parsed = parsePng(png);
  assert.equal(parsed.width >= 32, true);
  assert.equal(parsed.height >= 32, true);
  assert.equal(parsed.decoded.length > 4, true);
});

test("fixture preparation gates publication setup on validated photograph bytes", () => {
  const validation = source.indexOf("assertFixturePhotoReady(tinyPng)");
  const upload = source.indexOf("await attachFixturePhoto({");
  assert.equal(validation >= 0, true);
  assert.equal(upload >= 0, true);
  assert.equal(validation < upload, true);
});

test("fixture photograph validator rejects corrupted or invisible PNG bytes", () => {
  const proof = localCanaryModule.assertFixturePhotoReady(png);
  assert.equal(proof.width, 32);
  assert.equal(proof.height, 32);
  assert.equal(proof.visiblePixels, 1024);
  assert.equal(proof.uniqueColors >= 3, true);

  const corrupted = Buffer.from(png);
  corrupted[corrupted.length - 1] ^= 1;
  assert.throws(
    () => localCanaryModule.assertFixturePhotoReady(corrupted),
    /checksum|chunk|trailing|PNG/i
  );
});

test("hidden-state verification requires the stored photograph to decode before publication", () => {
  const verification = source.indexOf("await verifyStoredFixturePhoto({ key: configuration.serviceKey });");
  const anonymousRead = source.indexOf("const finds = await anonymousRows(");
  assert.equal(verification >= 0, true);
  assert.equal(anonymousRead >= 0, true);
  assert.equal(verification < anonymousRead, true);
});
