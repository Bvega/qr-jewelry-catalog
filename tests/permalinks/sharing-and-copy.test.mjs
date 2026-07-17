import assert from "node:assert/strict";
import test from "node:test";
import { readProjectFile } from "../../scripts/lib/baseline-contracts.mjs";
import {
  APPROVED_RESERVATION_TEMPLATE,
  loadFindDetailRuntime,
  renderFindDetail
} from "../../scripts/lib/find-detail-contracts.mjs";

const runtime = loadFindDetailRuntime();

function settlePromises() {
  return new Promise((resolve) => setImmediate(resolve));
}

test("sharing area exposes a labeled selectable canonical link and polite status", () => {
  const result = renderFindDetail({ query: "?id=1", runtime });

  assert.match(result.detail.innerHTML, /for="shareUrlDisplay">Permanent Find link<\/label>/);
  assert.match(result.detail.innerHTML, /<textarea[^>]*id="shareUrlDisplay"[^>]*readonly/);
  assert.match(result.detail.innerHTML, /https:\/\/example\.test\/find\.html\?id=BU-0001/);
  assert.match(result.detail.innerHTML, /id="shareStatus"[^>]*aria-live="polite"/);
  assert.match(result.detail.innerHTML, /id="manualCopyInstruction"[^>]*>Select and copy this link manually\./);
});

test("native Share Find uses the exact title, concise text, and canonical URL", async () => {
  const shareCalls = [];
  const result = renderFindDetail({
    query: "?id=1",
    runtime,
    navigator: { share: async (data) => { shareCalls.push(data); } }
  });

  result.elements.shareFindBtn.click();
  await settlePromises();

  assert.deepEqual(JSON.parse(JSON.stringify(shareCalls)), [{
    title: "Gold Twisted Rope Bracelet | Between Us",
    text: "Take a look at Gold Twisted Rope Bracelet from Between Us.",
    url: "https://example.test/find.html?id=BU-0001"
  }]);
  assert.equal(result.elements.shareStatus.textContent, "Find shared.");
});

test("Share Find cancellation is neutral and never triggers copying", async () => {
  let clipboardCalls = 0;
  const result = renderFindDetail({
    query: "?id=1",
    runtime,
    navigator: {
      share: async () => { throw { name: "AbortError" }; },
      clipboard: { writeText: async () => { clipboardCalls += 1; } }
    }
  });

  result.elements.shareFindBtn.click();
  await settlePromises();

  assert.equal(clipboardCalls, 0);
  assert.equal(result.elements.shareStatus.textContent, "Share was canceled.");
  assert.equal(result.elements.manualCopyInstruction.hidden, true);
});

test("unsupported Web Share uses the Copy Link flow", async () => {
  const clipboardCalls = [];
  const result = renderFindDetail({
    query: "?id=1",
    runtime,
    navigator: { clipboard: { writeText: async (text) => { clipboardCalls.push(text); } } }
  });

  result.elements.shareFindBtn.click();
  await settlePromises();

  assert.deepEqual(clipboardCalls, [result.canonicalURL]);
  assert.equal(result.elements.shareStatus.textContent, "Link copied.");
});

test("a non-cancellation share failure exposes Copy Link and manual fallback", async () => {
  const result = renderFindDetail({
    query: "?id=1",
    runtime,
    navigator: { share: async () => { throw new Error("share failed"); } }
  });

  result.elements.shareFindBtn.click();
  await settlePromises();

  assert.match(result.elements.shareStatus.textContent, /Use Copy Link/);
  assert.equal(result.elements.manualCopyInstruction.hidden, false);
});

test("Copy Link reports success only after the canonical URL reaches the Clipboard API", async () => {
  const clipboardCalls = [];
  const result = renderFindDetail({
    query: "?id=1",
    runtime,
    navigator: { clipboard: { writeText: async (text) => { clipboardCalls.push(text); } } }
  });

  assert.equal(result.elements.shareStatus.textContent, "");
  result.elements.copyLinkBtn.click();
  await settlePromises();

  assert.deepEqual(clipboardCalls, ["https://example.test/find.html?id=BU-0001"]);
  assert.equal(result.elements.shareStatus.textContent, "Link copied.");
  assert.equal(result.elements.manualCopyInstruction.hidden, true);
});

test("clipboard failure can succeed through the secondary browser copy command", async () => {
  let secondaryCalls = 0;
  const result = renderFindDetail({
    query: "?id=1",
    runtime,
    navigator: { clipboard: { writeText: async () => { throw new Error("denied"); } } },
    execCommand(command) {
      secondaryCalls += 1;
      return command === "copy";
    }
  });

  result.elements.copyLinkBtn.click();
  await settlePromises();

  assert.equal(secondaryCalls, 1);
  assert.equal(result.elements.shareStatus.textContent, "Link copied.");
});

test("failed primary and secondary copy paths reveal an honest manual fallback", async () => {
  const result = renderFindDetail({
    query: "?id=1",
    runtime,
    navigator: { clipboard: { writeText: async () => { throw new Error("denied"); } } },
    execCommand() { return false; }
  });

  result.elements.copyLinkBtn.click();
  await settlePromises();

  assert.equal(
    result.elements.shareStatus.textContent,
    "Copying was not available. Select and copy the link manually."
  );
  assert.equal(result.elements.manualCopyInstruction.hidden, false);
  assert.notEqual(result.elements.shareStatus.textContent, "Link copied.");
});

test("reservation wording remains exact while every route includes the same canonical link", () => {
  assert.equal(runtime.reservation.messageTemplate, APPROVED_RESERVATION_TEMPLATE);

  const legacy = renderFindDetail({ query: "?id=1", runtime });
  const permanent = renderFindDetail({
    query: "?id=BU-0001",
    href: "https://example.test/find.html?id=BU-0001",
    runtime
  });
  const expectedMessage =
    "Hello, I’m interested in reserving Gold Twisted Rope Bracelet (BU-0001) from Between Us. Is it still available?";

  for (const result of [legacy, permanent]) {
    assert.match(result.detail.innerHTML, new RegExp(expectedMessage.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.match(result.detail.innerHTML, /https:\/\/example\.test\/find\.html\?id=BU-0001/);
  }
  assert.doesNotMatch(readProjectFile("data/reservation.js"), /find\.html|item\.html/);
});
