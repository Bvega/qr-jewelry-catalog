import assert from "node:assert/strict";
import test from "node:test";
import { readProjectFile } from "../../scripts/lib/baseline-contracts.mjs";
import {
  loadFindDetailRuntime,
  renderFindDetail
} from "../../scripts/lib/find-detail-contracts.mjs";

const runtime = loadFindDetailRuntime();
const indexHtml = readProjectFile("index.html");
const itemHtml = readProjectFile("item.html");
const itemSource = readProjectFile("item.js");
const styles = readProjectFile("styles.css");

function settlePromises() {
  return new Promise((resolve) => setImmediate(resolve));
}

test("home Reserve section and both primary navigation shells use approved links and copy", () => {
  assert.match(indexHtml, /<section\b[^>]*id="reserve"/);
  assert.match(indexHtml, /<h2\b[^>]*>Reserve by Message<\/h2>/);
  assert.match(indexHtml, /Open an available Find and use Reserve by Message\. The owner will confirm availability and arrange local pickup\./);
  assert.match(indexHtml, /Payment is made in cash\./);
  assert.match(indexHtml, /href="#explore">Explore Available Finds<\/a>/);
  assert.match(indexHtml, /href="#reserve">Reserve by Message<\/a>/);
  assert.match(itemHtml, /href="index\.html#reserve">Reserve by Message<\/a>/);
});

test("available Finds expose the active action and required manual fulfillment statements", () => {
  const result = renderFindDetail({ query: "?id=1", runtime });

  assert.match(result.detail.innerHTML, /<h2 id="reservation-title">Reserve This Find<\/h2>/);
  assert.match(result.detail.innerHTML, /id="reserveMessageBtn"[^>]*>Reserve by Message<\/button>/);
  assert.match(result.detail.innerHTML, /The owner confirms availability manually\./);
  assert.match(result.detail.innerHTML, /Payment is cash\. Local pickup details are arranged by message after availability is confirmed\./);
  assert.match(result.detail.innerHTML, /id="reservationStatus"[^>]*aria-live="polite"/);
});

test("reserved and sold Finds show exact inactive text without an active action", () => {
  const reserved = renderFindDetail({ query: "?id=3", runtime });
  const sold = renderFindDetail({ query: "?id=5", runtime });

  assert.match(reserved.detail.innerHTML, /This Find is currently reserved\./);
  assert.doesNotMatch(reserved.detail.innerHTML, /id="reserveMessageBtn"/);
  assert.match(sold.detail.innerHTML, /This Find has been sold\./);
  assert.doesNotMatch(sold.detail.innerHTML, /id="reserveMessageBtn"/);
  for (const result of [reserved, sold]) {
    assert.match(result.detail.innerHTML, /Share This Find/);
    assert.match(result.detail.innerHTML, /Download QR code/);
    assert.match(result.detail.innerHTML, /Related Finds/);
  }
});

test("available action uses channel-neutral Web Share with title, message, public ID, and current URL", async () => {
  const shareCalls = [];
  const clipboardCalls = [];
  const navigator = {
    share: async (data) => { shareCalls.push(data); },
    clipboard: { writeText: async (text) => { clipboardCalls.push(text); } }
  };
  const result = renderFindDetail({ query: "?id=1", runtime, navigator });

  result.elements.reserveMessageBtn.click();
  await settlePromises();

  assert.equal(shareCalls.length, 1);
  assert.equal(shareCalls[0].title, "Between Us reservation request");
  assert.match(shareCalls[0].text, /Gold Twisted Rope Bracelet/);
  assert.match(shareCalls[0].text, /BU-0001/);
  assert.equal(shareCalls[0].url, result.href);
  assert.equal(clipboardCalls.length, 0);
  assert.match(result.elements.reservationStatus.textContent, /shared/);
});

test("Web Share cancellation is neutral and does not trigger clipboard fallback", async () => {
  let clipboardCalls = 0;
  const navigator = {
    share: async () => { throw { name: "AbortError" }; },
    clipboard: { writeText: async () => { clipboardCalls += 1; } }
  };
  const result = renderFindDetail({ query: "?id=1", runtime, navigator });

  result.elements.reserveMessageBtn.click();
  await settlePromises();

  assert.equal(clipboardCalls, 0);
  assert.equal(result.elements.reservationStatus.textContent, "Sharing was canceled. Nothing was sent.");
});

test("unavailable or failed Web Share copies the complete message and URL", async () => {
  const clipboardCalls = [];
  const navigator = {
    clipboard: { writeText: async (text) => { clipboardCalls.push(text); } }
  };
  const result = renderFindDetail({ query: "?id=1", runtime, navigator });

  result.elements.reserveMessageBtn.click();
  await settlePromises();

  assert.equal(clipboardCalls.length, 1);
  assert.match(clipboardCalls[0], /Gold Twisted Rope Bracelet \(BU-0001\)/);
  assert.match(clipboardCalls[0], new RegExp(result.href.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(result.elements.reservationStatus.textContent, /Paste it into your preferred messaging application/);

  const failedShareClipboard = [];
  const failedShare = renderFindDetail({
    query: "?id=1",
    runtime,
    navigator: {
      share: async () => { throw new Error("share failed"); },
      clipboard: { writeText: async (text) => { failedShareClipboard.push(text); } }
    }
  });
  failedShare.elements.reserveMessageBtn.click();
  await settlePromises();
  assert.equal(failedShareClipboard.length, 1);
});

test("clipboard failure reveals an honest selectable manual message fallback", async () => {
  const result = renderFindDetail({
    query: "?id=1",
    runtime,
    navigator: { clipboard: { writeText: async () => { throw new Error("denied"); } } }
  });

  result.elements.reserveMessageBtn.click();
  await settlePromises();

  assert.equal(result.elements.reservationMessageFallback.hidden, false);
  assert.equal(result.elements.reservationFallbackLabel.hidden, false);
  assert.match(result.elements.reservationStatus.textContent, /Select and copy the message below/);
  assert.match(result.detail.innerHTML, /<textarea[^>]*id="reservationMessageFallback"[^>]*readonly/);
  assert.match(result.detail.innerHTML, /Gold Twisted Rope Bracelet \(BU-0001\)/);
  assert.match(result.detail.innerHTML, /https:\/\/example\.test\/item\.html\?id=1/);
});

test("reservation controls retain mobile target, focus, and non-color-only states", () => {
  assert.match(styles, /\.reservation-button\s*{[\s\S]*?min-height:\s*46px/);
  assert.match(styles, /:focus-visible\s*{/);
  assert.match(itemSource, /This Find is currently reserved\./);
  assert.match(itemSource, /This Find has been sold\./);
  assert.match(itemSource, /role=\\?"status\\?"[^\n]*aria-live=\\?"polite\\?"/);
});
