import assert from "node:assert/strict";
import vm from "node:vm";
import test from "node:test";
import {
  EXPECTED_LEGACY_IDS,
  pathFromRoot,
  readProjectFile
} from "../../scripts/lib/baseline-contracts.mjs";
import {
  loadFindDetailRuntime,
  renderFindDetail
} from "../../scripts/lib/find-detail-contracts.mjs";

const runtime = loadFindDetailRuntime();
const items = Array.from(runtime.legacyItems);
const appSource = readProjectFile("app.js");

function renderDetail(query) {
  return renderFindDetail({ query, runtime });
}

test("catalog renderer creates one legacy numeric link per current item", () => {
  const cards = [];
  const grid = {
    innerHTML: "loading",
    appendChild(card) {
      cards.push(card);
    }
  };
  const context = {
    console,
    document: {
      getElementById(id) {
        return id === "catalogGrid" ? grid : null;
      },
      createElement() {
        return { className: "", href: "", innerHTML: "" };
      }
    },
    window: { JEWELRY_ITEMS: items }
  };

  vm.runInNewContext(appSource, context, {
    filename: pathFromRoot("app.js")
  });

  assert.deepEqual(
    cards.map((card) => card.href),
    EXPECTED_LEGACY_IDS.map((id) => `item.html?id=${id}`)
  );
});

for (const item of items) {
  test(`item.html?id=${item.id} resolves the baseline item`, () => {
    const result = renderDetail(`?id=${item.id}`);

    assert.equal(result.document.title, `${item.name} | Between Us Finds`);
    assert.ok(result.elements.itemDetail.innerHTML.includes(item.name));
    assert.ok(result.elements.itemDetail.innerHTML.includes(result.href));
    assert.doesNotMatch(result.elements.itemDetail.innerHTML, /Find not found/);
    assert.equal(result.elements.qrFallback.hidden, false);
    assert.equal(result.elements.qrDownloadBtn.hidden, true);

    for (const relatedId of item.relatedIds) {
      assert.ok(
        result.elements.itemDetail.innerHTML.includes(`item.html?id=${relatedId}`),
        `item ${item.id} did not retain related link ${relatedId}`
      );
    }
  });
}

for (const query of ["", "?id=not-a-number", "?id=999"] ) {
  test(`invalid route ${query || "<no query>"} retains branded not-found behavior`, () => {
    const result = renderDetail(query);

    assert.match(result.elements.itemDetail.innerHTML, /Find not found/);
    assert.match(result.elements.itemDetail.innerHTML, /href=["']index\.html#explore["']/);
  });
}
