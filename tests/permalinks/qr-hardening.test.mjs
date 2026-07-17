import assert from "node:assert/strict";
import test from "node:test";
import {
  loadFindDetailRuntime,
  renderFindDetail
} from "../../scripts/lib/find-detail-contracts.mjs";

const runtime = loadFindDetailRuntime();

function canvasOutput(source = "data:image/png;base64,qr") {
  return {
    tagName: "canvas",
    attributes: Object.create(null),
    setAttribute(name, value) { this.attributes[name] = String(value); },
    toDataURL(type) {
      assert.equal(type, "image/png");
      return source;
    }
  };
}

function imageOutput(source = "data:image/png;base64,qr") {
  return {
    tagName: "img",
    src: source,
    alt: "",
    width: 160,
    height: 160
  };
}

test("a missing QR constructor never throws and directs visitors to Copy Link", () => {
  const result = renderFindDetail({ query: "?id=1", runtime });

  assert.equal(
    result.elements.qrStatus.textContent,
    "QR generation is temporarily unavailable. Use Copy Link instead."
  );
  assert.equal(result.elements.qrDownloadBtn.disabled, true);
  assert.equal(result.elements.qrDownloadBtn.getAttribute("aria-disabled"), "true");
  assert.equal(result.elements.qrRetryBtn.hidden, false);
  assert.ok(result.elements.copyLinkBtn);
});

test("QR rendering uses the canonical payload and clears stale output before every retry", () => {
  const payloads = [];
  function QRCode(container, options) {
    payloads.push(options.text);
    container.appendChild(canvasOutput());
  }
  const result = renderFindDetail({ query: "?id=1", runtime, qrCode: QRCode });

  assert.deepEqual(payloads, ["https://example.test/find.html?id=BU-0001"]);
  assert.equal(result.elements.qrCodeCanvas.children.length, 1);
  assert.equal(result.elements.qrDownloadBtn.disabled, false);
  assert.equal(result.elements.qrStatus.textContent, "QR code ready for scanning.");
  assert.equal(
    result.elements.qrCodeCanvas.children[0].attributes["aria-label"],
    "QR code for Gold Twisted Rope Bracelet"
  );

  result.elements.qrRetryBtn.hidden = false;
  result.elements.qrRetryBtn.click();
  assert.equal(payloads.length, 2);
  assert.equal(result.elements.qrCodeCanvas.children.length, 1);
});

test("canonical and legacy detail routes generate the identical permanent QR payload", () => {
  const payloads = [];
  function QRCode(container, options) {
    payloads.push(options.text);
    container.appendChild(canvasOutput());
  }

  renderFindDetail({ query: "?id=1", runtime, qrCode: QRCode });
  renderFindDetail({
    query: "?id=BU-0001",
    href: "https://example.test/find.html?id=BU-0001",
    runtime,
    qrCode: QRCode
  });

  assert.deepEqual(payloads, [
    "https://example.test/find.html?id=BU-0001",
    "https://example.test/find.html?id=BU-0001"
  ]);
});

test("canvas output downloads only after a PNG source exists with the exact public-ID filename", () => {
  function QRCode(container) {
    container.appendChild(canvasOutput("data:image/png;base64,canvas-qr"));
  }
  const result = renderFindDetail({ query: "?id=1", runtime, qrCode: QRCode });

  result.elements.qrDownloadBtn.click();
  const links = result.createdElements.filter((element) => element.tagName === "a");

  assert.equal(links.length, 1);
  assert.equal(links[0].download, "between-us-BU-0001-qr.png");
  assert.equal(links[0].href, "data:image/png;base64,canvas-qr");
  assert.equal(result.elements.qrStatus.textContent, "QR download prepared.");
});

test("qrcodejs image output is supported and receives meaningful alternative text", () => {
  function QRCode(container) {
    container.appendChild(imageOutput("data:image/png;base64,image-qr"));
  }
  const result = renderFindDetail({ query: "?id=1", runtime, qrCode: QRCode });

  assert.equal(result.elements.qrCodeCanvas.children[0].alt, "QR code for Gold Twisted Rope Bracelet");
  result.elements.qrDownloadBtn.click();
  const links = result.createdElements.filter((element) => element.tagName === "a");

  assert.equal(links.at(-1).download, "between-us-BU-0001-qr.png");
  assert.equal(links.at(-1).href, "data:image/png;base64,image-qr");
});

test("a valid non-PNG image URL becomes a practical fallback without false success", () => {
  function QRCode(container) {
    container.appendChild(imageOutput("data:image/gif;base64,image-qr"));
  }
  const result = renderFindDetail({ query: "?id=1", runtime, qrCode: QRCode });

  result.elements.qrDownloadBtn.click();
  const links = result.createdElements.filter((element) => element.tagName === "a");

  assert.equal(links.at(-1).href, "data:image/gif;base64,image-qr");
  assert.equal(links.at(-1).target, "_blank");
  assert.match(result.elements.qrStatus.textContent, /PNG download could not be prepared/);
  assert.notEqual(result.elements.qrStatus.textContent, "QR download prepared.");
  assert.equal(result.elements.qrCodeCanvas.children.length, 1);
});

test("missing downloadable output reports an accessible failure and leaves Copy Link usable", () => {
  function QRCode(container) {
    container.appendChild(canvasOutput());
  }
  const result = renderFindDetail({ query: "?id=1", runtime, qrCode: QRCode });
  result.elements.qrCodeCanvas.innerHTML = "";

  result.elements.qrDownloadBtn.click();

  assert.equal(
    result.elements.qrStatus.textContent,
    "The QR download could not be prepared. Use Copy Link instead."
  );
  assert.ok(result.elements.copyLinkBtn);
  assert.match(result.detail.innerHTML, /id="qrStatus"[^>]*aria-live="polite"/);
});

test("constructor errors produce the same recoverable QR failure state", () => {
  function QRCode() {
    throw new Error("blocked");
  }
  const result = renderFindDetail({ query: "?id=1", runtime, qrCode: QRCode });

  assert.match(result.elements.qrStatus.textContent, /Use Copy Link instead/);
  assert.equal(result.elements.qrRetryBtn.hidden, false);
  assert.equal(result.elements.qrDownloadBtn.disabled, true);
});
