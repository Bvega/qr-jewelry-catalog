import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import vm from "node:vm";

const root = resolve(import.meta.dirname, "../..");
const read = (path) => readFileSync(resolve(root, path), "utf8");

function runtime({ eventListeners = null, windowURL = URL } = {}) {
  const window = { URL: windowURL, atob };
  if (eventListeners) {
    window.addEventListener = (name, listener) => {
      eventListeners[name] = listener;
    };
  }
  const context = {
    AbortController,
    URL,
    clearTimeout,
    setTimeout,
    window
  };
  for (const path of ["data/items.js", "data/collections.js", "data/public-catalog.js"]) {
    vm.runInNewContext(read(path), context, { filename: path });
  }
  return context;
}

function remoteFind(overrides = {}) {
  return {
    id: "40000000-0000-4000-8000-000000000201",
    public_id: "BU-9101",
    slug: "fictional-remote-find",
    title: "Fictional Remote Find",
    collection_id: "vintage",
    price_amount: "42.00",
    price_currency: "USD",
    availability: "available",
    description: "Fictional remote record used only by a local test.",
    condition: "Good",
    is_published: true,
    sort_order: 2,
    archived_at: null,
    ...overrides
  };
}

function remotePhoto(overrides = {}) {
  return {
    id: "40000000-0000-4000-8000-000000000301",
    find_id: "40000000-0000-4000-8000-000000000201",
    storage_path: "finds/40000000-0000-4000-8000-000000000201/remote.jpg",
    role: "primary",
    sequence: 1,
    alt_text: "Fictional remote object on a plain background.",
    width: 800,
    height: 600,
    ...overrides
  };
}

function payload(overrides = {}) {
  return {
    collections: [],
    finds: [remoteFind()],
    photos: [remotePhoto()],
    relations: [],
    ...overrides
  };
}

async function normalize(context, value = payload()) {
  return context.window.BETWEEN_US_PUBLIC_CATALOG.normalizeRemoteCatalog(value, {
    staticFinds: context.window.BETWEEN_US_FINDS,
    collections: context.window.BETWEEN_US_COLLECTIONS,
    loadPhoto: async (path) => `blob:${path}`
  });
}

test("public adapter uses no browser persistence, wildcard query, or technical logging", () => {
  const source = read("data/public-catalog.js");
  assert.doesNotMatch(source, /localStorage|indexedDB|serviceWorker|select\s*\(\s*["']\*["']\s*\)/i);
  assert.doesNotMatch(source, /console\.(?:log|warn|error|debug)/);
});

test("static-only installation preserves the five authoritative Finds and legacy adapter", () => {
  const context = runtime();
  const staticFinds = Array.from(context.window.BETWEEN_US_FINDS);
  const legacy = context.window.JEWELRY_ITEMS;
  context.window.BETWEEN_US_PUBLIC_CATALOG.installCatalog(
    staticFinds,
    [],
    context.window.BETWEEN_US_COLLECTIONS
  );
  assert.deepEqual(
    Array.from(context.window.BETWEEN_US_FINDS, (find) => find.publicId),
    ["BU-0001", "BU-0002", "BU-0003", "BU-0004", "BU-0005"]
  );
  assert.equal(context.window.JEWELRY_ITEMS, legacy);
});

test("eligible remote Finds normalize after static Finds with images and deterministic ordering", async () => {
  const context = runtime();
  const second = remoteFind({
    id: "40000000-0000-4000-8000-000000000202",
    public_id: "BU-9102",
    slug: "fictional-remote-find-two",
    sort_order: 1
  });
  const normalized = await normalize(context, payload({
    finds: [remoteFind(), second],
    photos: [
      remotePhoto(),
      remotePhoto({
        id: "40000000-0000-4000-8000-000000000302",
        role: "additional",
        sequence: 2,
        storage_path: "finds/40000000-0000-4000-8000-000000000201/additional.jpg",
        alt_text: "Fictional additional view."
      })
    ]
  }));
  assert.deepEqual(
    Array.from(normalized.finds, (find) => find.publicId),
    ["BU-9102", "BU-9101"]
  );
  assert.equal(normalized.finds[1].primaryPhoto.startsWith("blob:finds/"), true);
  assert.equal(normalized.finds[1].altText, remotePhoto().alt_text);
  assert.deepEqual(
    Array.from(normalized.finds[1].photoAltTexts),
    [remotePhoto().alt_text, "Fictional additional view."]
  );
  context.window.BETWEEN_US_PUBLIC_CATALOG.installCatalog(
    Array.from(context.window.BETWEEN_US_FINDS),
    Array.from(normalized.finds),
    context.window.BETWEEN_US_COLLECTIONS
  );
  assert.deepEqual(
    Array.from(context.window.BETWEEN_US_FINDS, (find) => find.publicId),
    ["BU-0001", "BU-0002", "BU-0003", "BU-0004", "BU-0005", "BU-9102", "BU-9101"]
  );
  assert.equal(
    Array.from(context.window.BETWEEN_US_COLLECTIONS)
      .find((collection) => collection.id === "vintage").status,
    "active"
  );
});

test("schema-valid negative Find sort order remains eligible and deterministic", async () => {
  const context = runtime();
  const normalized = await normalize(context, payload({
    finds: [
      remoteFind(),
      remoteFind({
        id: "40000000-0000-4000-8000-000000000202",
        public_id: "BU-9102",
        slug: "fictional-negative-order",
        sort_order: -1
      })
    ],
    photos: []
  }));
  assert.deepEqual(
    Array.from(normalized.finds, (find) => find.publicId),
    ["BU-9102", "BU-9101"]
  );
});

test("static precedence and duplicate public-ID rejection are deterministic", async () => {
  const context = runtime();
  const normalized = await normalize(context, payload({
    finds: [
      remoteFind({ public_id: "BU-0001", sort_order: 0 }),
      remoteFind({
        id: "40000000-0000-4000-8000-000000000299",
        title: "Duplicate must not win"
      }),
      remoteFind()
    ],
    photos: []
  }));
  assert.deepEqual(Array.from(normalized.finds, (find) => find.publicId), ["BU-9101"]);
  assert.equal(normalized.finds[0].title, "Fictional Remote Find");
  assert.equal(normalized.rejected, 2);
});

test("protected and first-seen slug aliases cannot be replaced by remote records", async () => {
  const context = runtime();
  const normalized = await normalize(context, payload({
    finds: [
      remoteFind({ slug: "gold-twisted-rope-bracelet" }),
      remoteFind({
        id: "40000000-0000-4000-8000-000000000202",
        public_id: "BU-9102",
        slug: "fictional-shared-slug"
      }),
      remoteFind({
        id: "40000000-0000-4000-8000-000000000203",
        public_id: "BU-9103",
        slug: "fictional-shared-slug"
      })
    ],
    photos: []
  }));
  assert.deepEqual(Array.from(normalized.finds, (find) => find.publicId), ["BU-9102"]);
  assert.equal(normalized.rejected, 2);
  context.window.BETWEEN_US_PUBLIC_CATALOG.installCatalog(
    Array.from(context.window.BETWEEN_US_FINDS),
    Array.from(normalized.finds),
    context.window.BETWEEN_US_COLLECTIONS
  );
  assert.equal(
    context.window.BETWEEN_US_DATA.findBySlug("gold-twisted-rope-bracelet").publicId,
    "BU-0001"
  );
});

test("hidden, unpublished, archived/inactive, and malformed remote records are excluded", async () => {
  const context = runtime();
  const normalized = await normalize(context, payload({
    finds: [
      remoteFind({ public_id: "BU-9201", is_published: false }),
      remoteFind({ public_id: "BU-9202", archived_at: "2026-07-28T00:00:00Z" }),
      remoteFind({ public_id: "BU-9203", availability: "inactive" }),
      remoteFind({ public_id: "bad-id" }),
      remoteFind({ public_id: "BU-9204", title: "" })
    ],
    photos: []
  }));
  assert.equal(normalized.finds.length, 0);
  assert.equal(normalized.rejected, 5);
});

test("malformed photo metadata rejects media safely and uses the approved fallback", async () => {
  const context = runtime();
  const normalized = await normalize(context, payload({
    photos: [
      remotePhoto({ storage_path: "private/path.jpg", alt_text: "" }),
      remotePhoto({
        id: "40000000-0000-4000-8000-000000000302",
        storage_path: "finds/40000000-0000-4000-8000-000000000202/cross-find.jpg"
      })
    ]
  }));
  assert.equal(normalized.finds.length, 1);
  assert.equal(normalized.finds[0].primaryPhoto, null);
  assert.deepEqual(Array.from(normalized.finds[0].photos), []);
});

test("malformed Related Find rows are omitted without dropping an eligible Find", async () => {
  const context = runtime();
  const normalized = await normalize(context, payload({
    photos: [],
    relations: [
      null,
      { find_id: "bad", related_find_id: "also-bad", sort_order: 0 }
    ]
  }));
  assert.equal(normalized.finds.length, 1);
  assert.deepEqual(Array.from(normalized.finds[0].relatedFindIds), []);
  assert.equal(normalized.rejected, 2);
});

test("remote public-ID and registered slug routes resolve canonically after installation", async () => {
  const context = runtime();
  context.window.location = {
    href: "https://example.test/catalog/find.html?id=BU-9101"
  };
  const normalized = await normalize(context);
  context.window.BETWEEN_US_PUBLIC_CATALOG.installCatalog(
    Array.from(context.window.BETWEEN_US_FINDS),
    Array.from(normalized.finds),
    context.window.BETWEEN_US_COLLECTIONS
  );
  vm.runInNewContext(read("data/permalinks.js"), context, { filename: "data/permalinks.js" });
  const permalinks = context.window.BETWEEN_US_PERMALINKS;
  assert.equal(
    permalinks.findByRoute("https://example.test/catalog/find.html?id=BU-9101").publicId,
    "BU-9101"
  );
  assert.equal(
    permalinks.findByRoute("https://example.test/catalog/find.html?slug=fictional-remote-find").publicId,
    "BU-9101"
  );
  assert.equal(
    permalinks.currentCanonicalUrl(
      "https://example.test/catalog/find.html?slug=fictional-remote-find"
    ),
    "https://example.test/catalog/find.html?id=BU-9101"
  );
});

function publicConfiguration() {
  return {
    url: "https://m08testref123456.supabase.co/",
    publishableKey: "sb_publishable_m08_fictional_browser_key_123456"
  };
}

function base64UrlJSON(value) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function legacyAnonKey({ role = "anon", ref = "m08testref123456" } = {}) {
  return [
    base64UrlJSON({ alg: "HS256", typ: "JWT" }),
    base64UrlJSON({
      iss: "supabase",
      ref,
      role,
      iat: 1700000000,
      exp: 4102444800
    }),
    "a".repeat(43)
  ].join(".");
}

function successfulFetch(requestLog) {
  return async (input) => {
    const url = new URL(String(input));
    requestLog.push(url);
    if (url.pathname.includes("/storage/v1/object/")) {
      return { ok: true, blob: async () => ({ type: "image/jpeg" }) };
    }
    const table = url.pathname.split("/").at(-1);
    const values = {
      collections: [],
      finds: [remoteFind()],
      find_photos: [remotePhoto()],
      find_relations: []
    };
    return { ok: true, json: async () => values[table] };
  };
}

function transportFetch(requestLog, { photo = remotePhoto() } = {}) {
  return async (input, options) => {
    const url = new URL(String(input));
    requestLog.push({
      url,
      options: {
        ...options,
        headers: Object.fromEntries(Object.entries(options.headers))
      }
    });
    if (url.pathname.includes("/storage/v1/object/")) {
      return { ok: true, blob: async () => ({ type: "image/jpeg" }) };
    }
    const table = url.pathname.split("/").at(-1);
    const values = {
      collections: [],
      finds: [remoteFind()],
      find_photos: [photo],
      find_relations: []
    };
    return { ok: true, json: async () => values[table] };
  };
}

async function loadTransport(context, configuration, requestLog, options = {}) {
  return context.window.BETWEEN_US_PUBLIC_CATALOG.load({
    staticFinds: Array.from(context.window.BETWEEN_US_FINDS),
    collections: Array.from(context.window.BETWEEN_US_COLLECTIONS),
    configuration,
    fetchImplementation: transportFetch(requestLog, options),
    AbortControllerConstructor: AbortController,
    createObjectURL: () => "blob:fictional-transport-photo"
  });
}

test("opaque publishable-key requests use apikey only and the exact private Storage transport", async () => {
  const context = runtime();
  const configuration = publicConfiguration();
  const requests = [];
  const encodedPhoto = remotePhoto({
    storage_path:
      "finds/40000000-0000-4000-8000-000000000201/remote image%#.jpg"
  });
  const result = await loadTransport(context, configuration, requests, { photo: encodedPhoto });
  assert.equal(result.finds.length, 6);

  const restRequests = requests.filter(({ url }) => url.pathname.startsWith("/rest/v1/"));
  const storageRequests = requests.filter(({ url }) =>
    url.pathname.startsWith("/storage/v1/object/")
  );
  assert.equal(restRequests.length, 4);
  assert.equal(storageRequests.length, 1);
  for (const request of restRequests) {
    assert.deepEqual(request.options.headers, {
      apikey: configuration.publishableKey,
      Accept: "application/json"
    });
    assert.equal(request.options.method, "GET");
    assert.equal(request.options.cache, "no-store");
    assert.equal(request.options.credentials, "omit");
    assert.equal(request.options.referrerPolicy, "no-referrer");
    assert.equal(request.url.href.includes(configuration.publishableKey), false);
  }

  const storage = storageRequests[0];
  assert.equal(
    storage.url.pathname,
    "/storage/v1/object/authenticated/find-images/" +
      "finds/40000000-0000-4000-8000-000000000201/remote%20image%25%23.jpg"
  );
  assert.equal(storage.url.search, "");
  assert.deepEqual(storage.options.headers, {
    apikey: configuration.publishableKey,
    Accept: "application/json"
  });
  assert.equal(storage.options.method, "GET");
  assert.equal(storage.options.cache, "no-store");
  assert.equal(storage.options.credentials, "omit");
  assert.equal(storage.options.referrerPolicy, "no-referrer");
  assert.equal(storage.url.href.includes(configuration.publishableKey), false);
});

test("validated legacy anon requests retain the supported apikey and Bearer headers", async () => {
  const context = runtime();
  const key = legacyAnonKey();
  const configuration = { ...publicConfiguration(), publishableKey: key };
  const requests = [];
  const result = await loadTransport(context, configuration, requests);
  assert.equal(result.finds.length, 6);
  assert.equal(requests.length, 5);
  for (const request of requests) {
    assert.deepEqual(request.options.headers, {
      apikey: key,
      Accept: "application/json",
      Authorization: `Bearer ${key}`
    });
    assert.equal(request.options.method, "GET");
    assert.equal(request.options.cache, "no-store");
    assert.equal(request.options.credentials, "omit");
    assert.equal(request.options.referrerPolicy, "no-referrer");
    assert.equal(request.url.href.includes(key), false);
  }
  assert.equal(
    requests.at(-1).url.pathname,
    "/storage/v1/object/authenticated/find-images/" +
      "finds/40000000-0000-4000-8000-000000000201/remote.jpg"
  );
});

test("secret, service-role, access-token, and non-anon JWT credentials are rejected", async () => {
  const invalidKeys = [
    ["sb", "secret", "fictional-rejected-value-123456"].join("_"),
    legacyAnonKey({ role: "service_role" }),
    legacyAnonKey({ role: "authenticated" }),
    legacyAnonKey({ ref: "differentref123456" }),
    ["sbp", "fictionalaccesstoken123456789"].join("_")
  ];
  for (const publishableKey of invalidKeys) {
    const context = runtime();
    let requests = 0;
    const result = await context.window.BETWEEN_US_PUBLIC_CATALOG.load({
      configuration: { ...publicConfiguration(), publishableKey },
      fetchImplementation: async () => {
        requests += 1;
        throw new Error("invalid credential must not reach transport");
      },
      AbortControllerConstructor: AbortController
    });
    assert.equal(requests, 0);
    assert.equal(result.source, "static");
    assert.equal(result.finds.length, 5);
  }
});

test("browser requests exact public columns and never requests administrative fields", async () => {
  const context = runtime();
  const requests = [];
  const result = await context.window.BETWEEN_US_PUBLIC_CATALOG.load({
    staticFinds: Array.from(context.window.BETWEEN_US_FINDS),
    collections: Array.from(context.window.BETWEEN_US_COLLECTIONS),
    configuration: publicConfiguration(),
    fetchImplementation: successfulFetch(requests),
    AbortControllerConstructor: AbortController,
    createObjectURL: () => "blob:fictional-remote-photo"
  });
  assert.equal(result.finds.length, 6);
  const restRequests = requests.filter((url) => url.pathname.includes("/rest/v1/"));
  assert.equal(restRequests.length, 4);
  const expected = context.window.BETWEEN_US_PUBLIC_CATALOG;
  const byTable = Object.fromEntries(restRequests.map((url) => [
    url.pathname.split("/").at(-1),
    url.searchParams.get("select")
  ]));
  assert.equal(byTable.finds, Array.from(expected.FIND_COLUMNS).join(","));
  assert.equal(byTable.find_photos, Array.from(expected.PHOTO_COLUMNS).join(","));
  assert.equal(byTable.find_relations, Array.from(expected.RELATION_COLUMNS).join(","));
  assert.equal(byTable.collections, Array.from(expected.COLLECTION_COLUMNS).join(","));
  for (const selection of Object.values(byTable)) {
    assert.equal(selection.includes("*"), false);
    assert.doesNotMatch(selection, /created_by|updated_by|created_at|updated_at|published_at|is_featured/);
  }
  assert.ok(requests.every((url) => !url.search.includes("publishable")));
});

test("network, malformed-response, and timeout failures retain static Finds with a neutral message", async () => {
  const cases = [
    async () => { throw new Error("fictional network detail"); },
    async () => ({ ok: true, json: async () => ({ malformed: true }) }),
    (_input, options) => new Promise((_resolve, reject) => {
      options.signal.addEventListener("abort", () => reject(new Error("fictional timeout detail")));
    })
  ];
  for (const [index, fetchImplementation] of cases.entries()) {
    const context = runtime();
    const result = await context.window.BETWEEN_US_PUBLIC_CATALOG.load({
      staticFinds: Array.from(context.window.BETWEEN_US_FINDS),
      collections: Array.from(context.window.BETWEEN_US_COLLECTIONS),
      configuration: publicConfiguration(),
      fetchImplementation,
      AbortControllerConstructor: AbortController,
      timeoutMs: index === 2 ? 5 : 100
    });
    assert.equal(result.finds.length, 5);
    assert.equal(result.source, "static");
    assert.match(result.message, /temporarily unavailable/);
    assert.doesNotMatch(result.message, /fictional|supabase|https?:|key|stack/i);
  }
});

test("Storage failure keeps the eligible Find with fallback media and an accessible neutral message", async () => {
  const context = runtime();
  const result = await context.window.BETWEEN_US_PUBLIC_CATALOG.load({
    staticFinds: Array.from(context.window.BETWEEN_US_FINDS),
    collections: Array.from(context.window.BETWEEN_US_COLLECTIONS),
    configuration: publicConfiguration(),
    fetchImplementation: async (input) => {
      const url = new URL(String(input));
      if (url.pathname.includes("/storage/v1/object/")) {
        throw new Error("fictional private storage detail");
      }
      const values = {
        collections: [],
        finds: [remoteFind()],
        find_photos: [remotePhoto()],
        find_relations: []
      };
      return {
        ok: true,
        json: async () => values[url.pathname.split("/").at(-1)]
      };
    },
    AbortControllerConstructor: AbortController
  });
  assert.equal(result.finds.length, 6);
  assert.equal(result.finds.at(-1).primaryPhoto, null);
  assert.match(result.message, /photographs could not be displayed/);
  assert.doesNotMatch(result.message, /fictional|storage|supabase|https?:|key|stack/i);
});

test("an early public request failure aborts every sibling request", async () => {
  const context = runtime();
  const signals = [];
  const fetchImplementation = async (input, options) => {
    signals.push(options.signal);
    if (String(input).includes("/collections?")) {
      throw new Error("fictional early failure");
    }
    return new Promise((_resolve, reject) => {
      options.signal.addEventListener("abort", () => reject(new Error("fictional sibling abort")));
    });
  };
  const result = await context.window.BETWEEN_US_PUBLIC_CATALOG.load({
    staticFinds: Array.from(context.window.BETWEEN_US_FINDS),
    collections: Array.from(context.window.BETWEEN_US_COLLECTIONS),
    configuration: publicConfiguration(),
    fetchImplementation,
    AbortControllerConstructor: AbortController,
    timeoutMs: 100
  });
  assert.equal(result.source, "static");
  assert.equal(signals.length, 4);
  assert.ok(signals.every((signal) => signal.aborted));
});

test("a fresh loader request starts from the immutable static catalog and removes unpublished rows", async () => {
  const context = runtime();
  const requests = [];
  const revoked = [];
  context.window.URL = {
    revokeObjectURL(value) {
      revoked.push(value);
    }
  };
  const first = await context.window.BETWEEN_US_PUBLIC_CATALOG.load({
    configuration: publicConfiguration(),
    fetchImplementation: successfulFetch(requests),
    AbortControllerConstructor: AbortController,
    createObjectURL: () => "blob:fictional-first-load"
  });
  assert.equal(first.finds.length, 6);

  const second = await context.window.BETWEEN_US_PUBLIC_CATALOG.load({
    configuration: publicConfiguration(),
    fetchImplementation: async () => ({ ok: true, json: async () => [] }),
    AbortControllerConstructor: AbortController,
    createObjectURL: () => "blob:must-not-be-created"
  });
  assert.deepEqual(
    Array.from(second.finds, (find) => find.publicId),
    ["BU-0001", "BU-0002", "BU-0003", "BU-0004", "BU-0005"]
  );
  assert.deepEqual(revoked, ["blob:fictional-first-load"]);
});

test("page lifecycle preserves blob images in the back-forward cache and releases them on exit", async () => {
  const listeners = {};
  const revoked = [];
  const context = runtime({
    eventListeners: listeners,
    windowURL: {
      revokeObjectURL(value) {
        revoked.push(value);
      }
    }
  });
  await context.window.BETWEEN_US_PUBLIC_CATALOG.load({
    configuration: publicConfiguration(),
    fetchImplementation: successfulFetch([]),
    AbortControllerConstructor: AbortController,
    createObjectURL: () => "blob:fictional-lifecycle"
  });
  listeners.pagehide({ persisted: true });
  assert.deepEqual(revoked, []);
  listeners.pagehide({ persisted: false });
  assert.deepEqual(revoked, ["blob:fictional-lifecycle"]);
});
