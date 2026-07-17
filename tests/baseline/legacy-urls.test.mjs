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

test("catalog renderer creates one permanent public-ID link per current item", () => {
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
    window: {
      BETWEEN_US_COLLECTIONS: [],
      BETWEEN_US_FINDS: runtime.finds,
      BETWEEN_US_PERMALINKS: runtime.permalinks,
      JEWELRY_ITEMS: items
    }
  };

  vm.runInNewContext(appSource, context, {
    filename: pathFromRoot("app.js")
  });

  assert.deepEqual(
    Array.from(cards, (card) => card.href),
    Array.from(runtime.finds, (find) => `https://example.test/find.html?id=${find.publicId}`)
  );
});

for (const item of items) {
  test(`item.html?id=${item.id} resolves the baseline item`, () => {
    const result = renderDetail(`?id=${item.id}`);

    assert.equal(result.document.title, `${item.name} | Between Us Finds`);
    assert.ok(result.elements.itemDetail.innerHTML.includes(item.name));
    assert.ok(result.elements.itemDetail.innerHTML.includes(result.canonicalURL));
    assert.doesNotMatch(result.elements.itemDetail.innerHTML, /Find not found/);
    assert.match(result.elements.qrStatus.textContent, /temporarily unavailable/);
    assert.equal(result.elements.qrRetryBtn.hidden, false);
    assert.equal(result.elements.qrDownloadBtn.disabled, true);
    assert.equal(result.elements.canonicalLink.getAttribute("href"), result.canonicalURL);

    for (const relatedId of item.relatedIds) {
      const relatedFind = runtime.lookup.findByLegacyId(relatedId);
      assert.ok(
        result.elements.itemDetail.innerHTML.includes(`find.html?id=${relatedFind.publicId}`),
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
