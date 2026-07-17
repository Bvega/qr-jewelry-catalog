import vm from "node:vm";
import {
  pathFromRoot,
  readProjectFile
} from "./baseline-contracts.mjs";

export const PREVIEW_ORIGIN = "https://example.test";
export const PREVIEW_BASE_PATH = "/between-us/";

export function loadPermalinkRuntime({
  href = `${PREVIEW_ORIGIN}${PREVIEW_BASE_PATH}find.html?id=BU-0001`
} = {}) {
  const context = {
    URL,
    URLSearchParams,
    window: {
      location: { href }
    }
  };

  for (const relativePath of ["data/items.js", "data/permalinks.js"]) {
    vm.runInNewContext(readProjectFile(relativePath), context, {
      filename: pathFromRoot(relativePath)
    });
  }

  return {
    context,
    finds: context.window.BETWEEN_US_FINDS,
    legacyItems: context.window.JEWELRY_ITEMS,
    lookup: context.window.BETWEEN_US_DATA,
    permalinks: context.window.BETWEEN_US_PERMALINKS
  };
}

export function toPlainData(value) {
  return JSON.parse(JSON.stringify(value));
}
