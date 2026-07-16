import assert from "node:assert/strict";
import vm from "node:vm";
import test from "node:test";
import {
  EXPECTED_LEGACY_IDS,
  loadCatalog,
  pathFromRoot,
  readProjectFile
} from "../../scripts/lib/baseline-contracts.mjs";

const items = loadCatalog();
const itemSource = readProjectFile("item.js");
const appSource = readProjectFile("app.js");

function renderDetail(query) {
  const elements = {
    itemDetail: { innerHTML: "" },
    copyLinkBtn: { addEventListener() {} },
    copyConfirm: { style: {} },
    qrCodeCanvas: { querySelector() { return null; } },
    qrFallback: { style: {} },
    qrDownloadBtn: { style: {}, addEventListener() {} }
  };
  const document = {
    title: "Item Detail — Jewelry Catalog",
    getElementById(id) {
      return elements[id] ?? null;
    },
    createElement() {
      return {};
    },
    body: {
      appendChild() {},
      removeChild() {}
    }
  };
  const href = `https://example.test/item.html${query}`;
  const context = {
    document,
    navigator: { clipboard: { writeText: async () => {} } },
    URLSearchParams,
    window: {
      JEWELRY_ITEMS: items,
      location: { href, search: query }
    }
  };

  vm.runInNewContext(itemSource, context, {
    filename: pathFromRoot("item.js")
  });

  return { document, elements, href };
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

    assert.equal(result.document.title, `${item.name} — Jewelry Catalog`);
    assert.ok(result.elements.itemDetail.innerHTML.includes(item.name));
    assert.ok(result.elements.itemDetail.innerHTML.includes(result.href));
    assert.doesNotMatch(result.elements.itemDetail.innerHTML, /Item not found/);
    assert.equal(result.elements.qrFallback.style.display, "block");
    assert.equal(result.elements.qrDownloadBtn.style.display, "none");

    for (const relatedId of item.relatedIds) {
      assert.ok(
        result.elements.itemDetail.innerHTML.includes(`item.html?id=${relatedId}`),
        `item ${item.id} did not retain related link ${relatedId}`
      );
    }
  });
}

for (const query of ["", "?id=not-a-number", "?id=999"] ) {
  test(`invalid route ${query || "<no query>"} retains not-found behavior`, () => {
    const result = renderDetail(query);

    assert.match(result.elements.itemDetail.innerHTML, /Item not found/);
    assert.match(result.elements.itemDetail.innerHTML, /href=["']index\.html["']/);
  });
}
