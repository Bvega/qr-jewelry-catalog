// M08 hybrid public catalog adapter.
//
// Supabase RLS is the publication boundary. The checks here are a second
// defensive layer before remote rows enter the existing public renderers.
(function () {
  "use strict";

  var FIND_COLUMNS = Object.freeze([
    "id",
    "public_id",
    "slug",
    "title",
    "collection_id",
    "price_amount",
    "price_currency",
    "availability",
    "description",
    "condition",
    "is_published",
    "sort_order",
    "archived_at"
  ]);
  var PHOTO_COLUMNS = Object.freeze([
    "id",
    "find_id",
    "storage_path",
    "role",
    "sequence",
    "alt_text",
    "width",
    "height"
  ]);
  var RELATION_COLUMNS = Object.freeze(["find_id", "related_find_id", "sort_order"]);
  var COLLECTION_COLUMNS = Object.freeze(["id", "label", "status", "sort_order", "description"]);
  var AVAILABILITY = Object.freeze(["available", "reserved", "sold"]);
  var PUBLIC_ID_PATTERN = /^BU-[0-9]{4,}$/;
  var SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
  var UUID_PATTERN =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  var STORAGE_PATH_PATTERN =
    /^finds\/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\/[^/]+$/i;
  var DEFAULT_TIMEOUT_MS = 5000;
  var managedObjectURLs = [];
  var activeController = null;
  var initialStaticFinds = Array.isArray(window.BETWEEN_US_FINDS)
    ? window.BETWEEN_US_FINDS.slice()
    : [];
  var initialCollections = Array.isArray(window.BETWEEN_US_COLLECTIONS)
    ? window.BETWEEN_US_COLLECTIONS.slice()
    : [];

  function freezeFind(find) {
    find.price = Object.freeze(find.price);
    find.photos = Object.freeze(find.photos.slice());
    find.photoAltTexts = Object.freeze(find.photoAltTexts.slice());
    find.relatedFindIds = Object.freeze(find.relatedFindIds.slice());
    return Object.freeze(find);
  }

  function safeText(value, maximum) {
    if (typeof value !== "string") return null;
    var text = value.trim();
    return text.length > 0 && text.length <= maximum ? text : null;
  }

  function optionalText(value, maximum) {
    if (value === null || value === undefined || value === "") return null;
    return safeText(value, maximum);
  }

  function positiveDimension(value) {
    return value === null || (Number.isInteger(value) && value > 0);
  }

  function normalizePhoto(row) {
    if (!row || typeof row !== "object" || Array.isArray(row)) return null;
    if (
      typeof row.id !== "string" ||
      !UUID_PATTERN.test(row.id) ||
      typeof row.find_id !== "string" ||
      !UUID_PATTERN.test(row.find_id) ||
      typeof row.storage_path !== "string" ||
      !STORAGE_PATH_PATTERN.test(row.storage_path) ||
      row.storage_path.split("/")[1].toLowerCase() !== row.find_id.toLowerCase() ||
      (row.role !== "primary" && row.role !== "additional") ||
      !Number.isInteger(row.sequence) ||
      row.sequence < 1 ||
      !positiveDimension(row.width) ||
      !positiveDimension(row.height)
    ) {
      return null;
    }
    var altText = safeText(row.alt_text, 500);
    if (!altText) return null;
    return {
      id: row.id,
      findId: row.find_id,
      storagePath: row.storage_path,
      role: row.role,
      sequence: row.sequence,
      altText: altText
    };
  }

  function normalizeFind(row, collectionIds) {
    if (!row || typeof row !== "object" || Array.isArray(row)) return null;
    var publicId = typeof row.public_id === "string" ? row.public_id : "";
    var title = safeText(row.title, 200);
    var description = safeText(row.description, 5000);
    var condition = optionalText(row.condition, 500);
    var slug = optionalText(row.slug, 160);
    var amount = Number(row.price_amount);
    var sortOrder = Number(row.sort_order);

    if (
      row.is_published !== true ||
      row.archived_at !== null ||
      !PUBLIC_ID_PATTERN.test(publicId) ||
      !title ||
      !description ||
      !collectionIds.has(row.collection_id) ||
      !Number.isFinite(amount) ||
      amount <= 0 ||
      row.price_currency !== "USD" ||
      AVAILABILITY.indexOf(row.availability) === -1 ||
      (slug !== null && !SLUG_PATTERN.test(slug)) ||
      !Number.isInteger(sortOrder) ||
      typeof row.id !== "string" ||
      !UUID_PATTERN.test(row.id)
    ) {
      return null;
    }

    return {
      databaseId: row.id,
      publicId: publicId,
      legacyId: null,
      slug: slug,
      title: title,
      collection: row.collection_id,
      legacyCategory: null,
      description: description,
      condition: condition,
      availability: row.availability,
      price: { amount: amount, currency: "USD" },
      photos: [],
      photoAltTexts: [],
      primaryPhoto: null,
      altText: title,
      relatedFindIds: [],
      featured: false,
      createdAt: null,
      updatedAt: null,
      sortOrder: sortOrder
    };
  }

  function normalizeRelation(row) {
    if (!row || typeof row !== "object" || Array.isArray(row)) return null;
    if (
      !UUID_PATTERN.test(row.find_id || "") ||
      !UUID_PATTERN.test(row.related_find_id || "") ||
      row.find_id === row.related_find_id ||
      !Number.isInteger(row.sort_order) ||
      row.sort_order < 0
    ) {
      return null;
    }
    return {
      find_id: row.find_id,
      related_find_id: row.related_find_id,
      sort_order: row.sort_order
    };
  }

  function remoteOrder(left, right) {
    return left.sortOrder - right.sortOrder ||
      left.publicId.localeCompare(right.publicId) ||
      left.databaseId.localeCompare(right.databaseId);
  }

  function requestURL(configuration, table, columns, order) {
    var url = new URL("rest/v1/" + table, configuration.url);
    url.searchParams.set("select", columns.join(","));
    if (order) url.searchParams.set("order", order);
    return url;
  }

  function decodeBase64UrlJSON(value) {
    if (typeof value !== "string" || !/^[A-Za-z0-9_-]+$/.test(value)) return null;
    if (typeof window.atob !== "function") return null;
    try {
      var normalized = value.replace(/-/g, "+").replace(/_/g, "/");
      var padding = normalized.length % 4;
      if (padding) normalized += "=".repeat(4 - padding);
      return JSON.parse(window.atob(normalized));
    } catch (error) {
      return null;
    }
  }

  function isValidatedLegacyAnonKey(key, projectReference) {
    var segments = typeof key === "string" ? key.split(".") : [];
    if (segments.length !== 3 || !/^[A-Za-z0-9_-]{16,}$/.test(segments[2])) return false;
    var header = decodeBase64UrlJSON(segments[0]);
    var payload = decodeBase64UrlJSON(segments[1]);
    return Boolean(
      header &&
      payload &&
      header.alg === "HS256" &&
      (header.typ === undefined || header.typ === "JWT") &&
      payload.iss === "supabase" &&
      payload.role === "anon" &&
      Number.isInteger(payload.iat) &&
      Number.isInteger(payload.exp) &&
      payload.exp > payload.iat &&
      (payload.ref === undefined || payload.ref === projectReference)
    );
  }

  function configurationDetails(configuration) {
    if (!configuration || typeof configuration !== "object") return null;
    if (typeof configuration.publishableKey !== "string") return null;
    var key = configuration.publishableKey;
    try {
      var url = new URL(configuration.url);
      var remote = url.protocol === "https:" &&
        /^[a-z0-9-]+\.supabase\.co$/.test(url.hostname);
      var local = url.protocol === "http:" &&
        url.hostname === "127.0.0.1" &&
        url.port === "54321";
      if (
        (!remote && !local) ||
        url.username ||
        url.password ||
        url.pathname !== "/" ||
        url.search ||
        url.hash
      ) return null;
      var projectReference = remote
        ? url.hostname.slice(0, -".supabase.co".length)
        : "local-m07b3";
      var modernPublishable = /^sb_publishable_[A-Za-z0-9_-]{16,}$/.test(key);
      var legacyAnon = isValidatedLegacyAnonKey(key, projectReference);
      if (!modernPublishable && !legacyAnon) return null;
      return { legacyAnon: legacyAnon };
    } catch (error) {
      return null;
    }
  }

  function requestHeaders(configuration) {
    var headers = {
      apikey: configuration.publishableKey,
      Accept: "application/json"
    };
    var details = configurationDetails(configuration);
    if (details && details.legacyAnon) {
      headers.Authorization = "Bearer " + configuration.publishableKey;
    }
    return headers;
  }

  async function fetchRows(fetchImplementation, configuration, table, columns, order, signal) {
    var response = await fetchImplementation(requestURL(configuration, table, columns, order), {
      method: "GET",
      headers: requestHeaders(configuration),
      signal: signal,
      credentials: "omit",
      cache: "no-store",
      referrerPolicy: "no-referrer"
    });
    if (!response || response.ok !== true) throw new Error("Public catalog request failed.");
    var rows = await response.json();
    if (!Array.isArray(rows)) throw new Error("Public catalog response was malformed.");
    return rows;
  }

  function encodeStoragePath(path) {
    return path.split("/").map(encodeURIComponent).join("/");
  }

  async function downloadPhoto(
    fetchImplementation,
    configuration,
    storagePath,
    signal,
    createObjectURL
  ) {
    var url = new URL(
      "storage/v1/object/authenticated/find-images/" + encodeStoragePath(storagePath),
      configuration.url
    );
    var response = await fetchImplementation(url, {
      method: "GET",
      headers: requestHeaders(configuration),
      signal: signal,
      credentials: "omit",
      cache: "no-store",
      referrerPolicy: "no-referrer"
    });
    if (!response || response.ok !== true || typeof response.blob !== "function") return null;
    var blob = await response.blob();
    if (!blob || typeof createObjectURL !== "function") return null;
    var objectURL = createObjectURL(blob);
    if (objectURL) managedObjectURLs.push(objectURL);
    return objectURL;
  }

  function releaseObjectURLs() {
    if (window.URL && typeof window.URL.revokeObjectURL === "function") {
      managedObjectURLs.forEach(function (url) {
        try {
          window.URL.revokeObjectURL(url);
        } catch (error) {
          // A browser may have already released a page-local object URL.
        }
      });
    }
    managedObjectURLs = [];
  }

  function cancelActiveRequest() {
    if (activeController && typeof activeController.abort === "function") {
      activeController.abort();
    }
    activeController = null;
  }

  function derivedCollections(collections, finds) {
    var populated = new Set(finds.map(function (find) { return find.collection; }));
    return Object.freeze(collections.map(function (collection) {
      return Object.freeze({
        id: collection.id,
        label: collection.label,
        description: collection.description,
        status: populated.has(collection.id) ? "active" : "coming-soon",
        sortOrder: collection.sortOrder
      });
    }));
  }

  async function normalizeRemoteCatalog(payload, options) {
    options = options || {};
    var staticFinds = Array.isArray(options.staticFinds) ? options.staticFinds : [];
    var collections = Array.isArray(options.collections) ? options.collections : [];
    var collectionIds = new Set(collections.map(function (collection) { return collection.id; }));
    var protectedIds = new Set(staticFinds.map(function (find) { return find.publicId; }));
    var seen = new Set(protectedIds);
    var seenSlugs = new Set(staticFinds.map(function (find) {
      return find.slug;
    }).filter(Boolean));
    var remote = [];
    var rejected = 0;
    var mediaFailures = 0;

    var photosByFind = new Map();
    var rawPhotos = Array.isArray(payload && payload.photos) ? payload.photos : [];
    var rawFinds = Array.isArray(payload && payload.finds) ? payload.finds : [];
    var rawRelations = Array.isArray(payload && payload.relations) ? payload.relations : [];

    for (var rawPhoto of rawPhotos) {
      var photo = normalizePhoto(rawPhoto);
      if (!photo) {
        rejected += 1;
        continue;
      }
      if (!photosByFind.has(photo.findId)) photosByFind.set(photo.findId, []);
      photosByFind.get(photo.findId).push(photo);
    }
    photosByFind.forEach(function (photos) {
      photos.sort(function (left, right) {
        if (left.role !== right.role) return left.role === "primary" ? -1 : 1;
        return left.sequence - right.sequence || left.id.localeCompare(right.id);
      });
    });

    var candidates = rawFinds.map(function (row) {
      return normalizeFind(row, collectionIds);
    }).filter(function (find) {
      if (!find) rejected += 1;
      return find !== null;
    }).sort(remoteOrder);

    var publicIdByDatabaseId = new Map(candidates.map(function (find) {
      return [find.databaseId, find.publicId];
    }));
    var relationsByFind = new Map();
    var relations = rawRelations.map(normalizeRelation).filter(function (relation) {
      if (!relation) rejected += 1;
      return relation !== null;
    });
    relations.sort(function (left, right) {
      return Number(left.sort_order) - Number(right.sort_order) ||
        String(left.related_find_id).localeCompare(String(right.related_find_id));
    }).forEach(function (relation) {
      if (!relation || typeof relation !== "object") return;
      var sourceId = publicIdByDatabaseId.get(relation.find_id);
      var relatedId = publicIdByDatabaseId.get(relation.related_find_id);
      if (!sourceId || !relatedId || sourceId === relatedId) return;
      if (!relationsByFind.has(relation.find_id)) relationsByFind.set(relation.find_id, []);
      var related = relationsByFind.get(relation.find_id);
      if (related.indexOf(relatedId) === -1) related.push(relatedId);
    });

    for (var candidate of candidates) {
      if (seen.has(candidate.publicId) || (candidate.slug && seenSlugs.has(candidate.slug))) {
        rejected += 1;
        continue;
      }
      seen.add(candidate.publicId);
      if (candidate.slug) seenSlugs.add(candidate.slug);

      var photoMetadata = photosByFind.get(candidate.databaseId) || [];
      var loadedPhotos = [];
      for (var photoMetadataItem of photoMetadata) {
        try {
          var photoURL = await options.loadPhoto(photoMetadataItem.storagePath);
          if (photoURL) {
            loadedPhotos.push({
              url: photoURL,
              altText: photoMetadataItem.altText,
              role: photoMetadataItem.role,
              sequence: photoMetadataItem.sequence
            });
          } else {
            mediaFailures += 1;
          }
        } catch (error) {
          // Missing or denied media uses the accepted public fallback.
          mediaFailures += 1;
        }
      }
      loadedPhotos.sort(function (left, right) {
        if (left.role !== right.role) return left.role === "primary" ? -1 : 1;
        return left.sequence - right.sequence;
      });

      var photoURLs = loadedPhotos.map(function (photo) { return photo.url; });
      candidate.photos = photoURLs;
      candidate.photoAltTexts = loadedPhotos.map(function (photo) { return photo.altText; });
      candidate.primaryPhoto = photoURLs[0] || null;
      candidate.altText = loadedPhotos[0] ? loadedPhotos[0].altText : candidate.title;
      candidate.relatedFindIds = relationsByFind.get(candidate.databaseId) || [];
      delete candidate.databaseId;
      delete candidate.sortOrder;
      remote.push(freezeFind(candidate));
    }

    return Object.freeze({
      finds: Object.freeze(remote),
      rejected: rejected,
      mediaFailures: mediaFailures
    });
  }

  function installCatalog(staticFinds, remoteFinds, collections) {
    var merged = Object.freeze(staticFinds.concat(remoteFinds));
    var byPublicId = Object.create(null);
    var byLegacyId = Object.create(null);
    var bySlug = Object.create(null);

    merged.forEach(function (find) {
      byPublicId[find.publicId] = find;
      if (Number.isInteger(find.legacyId)) byLegacyId[find.legacyId] = find;
      if (typeof find.slug === "string" && find.slug && !bySlug[find.slug]) {
        bySlug[find.slug] = find;
      }
    });

    window.BETWEEN_US_FINDS = merged;
    window.BETWEEN_US_DATA = Object.freeze({
      findByPublicId: function (publicId) {
        return typeof publicId === "string" ? byPublicId[publicId] || null : null;
      },
      findByLegacyId: function (legacyId) {
        return Number.isInteger(legacyId) ? byLegacyId[legacyId] || null : null;
      },
      findBySlug: function (slug) {
        return typeof slug === "string" ? bySlug[slug] || null : null;
      }
    });
    window.BETWEEN_US_COLLECTIONS = derivedCollections(collections, merged);
    return merged;
  }

  function validConfiguration(configuration) {
    return configurationDetails(configuration) !== null;
  }

  async function load(options) {
    options = options || {};
    var staticFinds = Array.isArray(options.staticFinds)
      ? options.staticFinds.slice()
      : initialStaticFinds.slice();
    var collections = Array.isArray(options.collections)
      ? options.collections.slice()
      : initialCollections.slice();
    var configuration = options.configuration || window.BETWEEN_US_PUBLIC_CONFIG;
    var fetchImplementation = options.fetchImplementation || window.fetch;
    var AbortControllerConstructor = options.AbortControllerConstructor || window.AbortController;
    var createObjectURL = options.createObjectURL ||
      (window.URL && typeof window.URL.createObjectURL === "function"
        ? window.URL.createObjectURL.bind(window.URL)
        : null);
    var timeoutMs = Number.isFinite(options.timeoutMs) && options.timeoutMs > 0
      ? options.timeoutMs
      : DEFAULT_TIMEOUT_MS;
    cancelActiveRequest();
    releaseObjectURLs();

    if (
      !validConfiguration(configuration) ||
      typeof fetchImplementation !== "function" ||
      typeof AbortControllerConstructor !== "function"
    ) {
      installCatalog(staticFinds, [], collections);
      return Object.freeze({
        finds: window.BETWEEN_US_FINDS,
        collections: window.BETWEEN_US_COLLECTIONS,
        source: "static",
        message: ""
      });
    }

    var controller = new AbortControllerConstructor();
    activeController = controller;
    var timer = setTimeout(function () { controller.abort(); }, timeoutMs);

    try {
      var rows = await Promise.all([
        fetchRows(
          fetchImplementation,
          configuration,
          "collections",
          COLLECTION_COLUMNS,
          "sort_order.asc,id.asc",
          controller.signal
        ),
        fetchRows(
          fetchImplementation,
          configuration,
          "finds",
          FIND_COLUMNS,
          "sort_order.asc,public_id.asc,id.asc",
          controller.signal
        ),
        fetchRows(
          fetchImplementation,
          configuration,
          "find_photos",
          PHOTO_COLUMNS,
          "find_id.asc,sequence.asc",
          controller.signal
        ),
        fetchRows(
          fetchImplementation,
          configuration,
          "find_relations",
          RELATION_COLUMNS,
          "find_id.asc,sort_order.asc,related_find_id.asc",
          controller.signal
        )
      ]);
      var remote = await normalizeRemoteCatalog({
        collections: rows[0],
        finds: rows[1],
        photos: rows[2],
        relations: rows[3]
      }, {
        staticFinds: staticFinds,
        collections: collections,
        loadPhoto: function (path) {
          return downloadPhoto(
            fetchImplementation,
            configuration,
            path,
            controller.signal,
            createObjectURL
          );
        }
      });
      installCatalog(staticFinds, remote.finds, collections);
      return Object.freeze({
        finds: window.BETWEEN_US_FINDS,
        collections: window.BETWEEN_US_COLLECTIONS,
        source: remote.finds.length > 0 ? "hybrid" : "static",
        message: remote.rejected > 0 || remote.mediaFailures > 0
          ? "Some newer Finds or photographs could not be displayed. The available catalog is shown."
          : ""
      });
    } catch (error) {
      controller.abort();
      installCatalog(staticFinds, [], collections);
      return Object.freeze({
        finds: window.BETWEEN_US_FINDS,
        collections: window.BETWEEN_US_COLLECTIONS,
        source: "static",
        message: "Some newer Finds are temporarily unavailable. The original catalog remains available."
      });
    } finally {
      clearTimeout(timer);
      if (activeController === controller) activeController = null;
    }
  }

  var ready = load();
  if (typeof window.addEventListener === "function") {
    window.addEventListener("pagehide", function (event) {
      if (event && event.persisted === true) return;
      cancelActiveRequest();
      releaseObjectURLs();
    });
  }
  window.BETWEEN_US_PUBLIC_CATALOG = Object.freeze({
    FIND_COLUMNS: FIND_COLUMNS,
    PHOTO_COLUMNS: PHOTO_COLUMNS,
    RELATION_COLUMNS: RELATION_COLUMNS,
    COLLECTION_COLUMNS: COLLECTION_COLUMNS,
    normalizeRemoteCatalog: normalizeRemoteCatalog,
    installCatalog: installCatalog,
    cancelActiveRequest: cancelActiveRequest,
    releaseObjectURLs: releaseObjectURLs,
    load: load,
    ready: ready
  });
}());
