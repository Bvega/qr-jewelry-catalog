// Permanent, static-host-safe Find routing and URL generation.
// Normalized Find records remain owned by data/items.js; this runtime only
// resolves those records and builds deployment-relative absolute URLs.

(function () {
  "use strict";

  function locationURL(locationLike) {
    var candidate = locationLike;

    if (!candidate && window.location) {
      candidate = window.location;
    }

    try {
      if (typeof candidate === "string") {
        return new URL(candidate);
      }
      if (candidate && typeof candidate.href === "string") {
        return new URL(candidate.href);
      }
    } catch (error) {
      return null;
    }

    return null;
  }

  function routeName(url) {
    var segments = url.pathname.split("/");
    return segments[segments.length - 1];
  }

  function hasExactParameters(parameters, expectedName) {
    var names = [];
    parameters.forEach(function (value, name) {
      names.push(name);
    });

    return names.length === 1 && names[0] === expectedName &&
      parameters.getAll(expectedName).length === 1;
  }

  function findByRoute(locationLike) {
    var url = locationURL(locationLike);
    var data = window.BETWEEN_US_DATA;

    if (!url || !data) return null;

    var name = routeName(url);
    var parameters = url.searchParams;

    if (name === "find.html") {
      if (hasExactParameters(parameters, "id")) {
        var publicId = parameters.get("id");
        return publicId && typeof data.findByPublicId === "function"
          ? data.findByPublicId(publicId)
          : null;
      }

      if (hasExactParameters(parameters, "slug")) {
        var slug = parameters.get("slug");
        return slug && typeof data.findBySlug === "function"
          ? data.findBySlug(slug)
          : null;
      }

      return null;
    }

    if (name === "item.html" && hasExactParameters(parameters, "id")) {
      var legacyValue = parameters.get("id");
      if (!/^[1-9]\d*$/.test(legacyValue)) return null;

      var legacyId = Number(legacyValue);
      return Number.isSafeInteger(legacyId) && typeof data.findByLegacyId === "function"
        ? data.findByLegacyId(legacyId)
        : null;
    }

    return null;
  }

  function registeredFind(findOrPublicId) {
    var publicId = typeof findOrPublicId === "string"
      ? findOrPublicId
      : findOrPublicId && findOrPublicId.publicId;

    if (
      typeof publicId !== "string" ||
      !window.BETWEEN_US_DATA ||
      typeof window.BETWEEN_US_DATA.findByPublicId !== "function"
    ) {
      return null;
    }

    return window.BETWEEN_US_DATA.findByPublicId(publicId);
  }

  function urlFor(route, parameterName, parameterValue, locationLike) {
    var current = locationURL(locationLike);
    if (!current) return null;

    try {
      var generated = new URL(route, current);
      generated.search = "";
      generated.hash = "";
      generated.searchParams.set(parameterName, parameterValue);
      return generated.href;
    } catch (error) {
      return null;
    }
  }

  function permalinkFor(findOrPublicId, locationLike) {
    var find = registeredFind(findOrPublicId);
    return find ? urlFor("find.html", "id", find.publicId, locationLike) : null;
  }

  function legacyUrlFor(findOrPublicId, locationLike) {
    var find = registeredFind(findOrPublicId);
    return find && Number.isInteger(find.legacyId)
      ? urlFor("item.html", "id", String(find.legacyId), locationLike)
      : null;
  }

  function slugAliasFor(findOrPublicId, locationLike) {
    var find = registeredFind(findOrPublicId);
    return find && typeof find.slug === "string"
      ? urlFor("find.html", "slug", find.slug, locationLike)
      : null;
  }

  function currentCanonicalUrl(locationLike) {
    var find = findByRoute(locationLike);
    return find ? permalinkFor(find, locationLike) : null;
  }

  window.BETWEEN_US_PERMALINKS = Object.freeze({
    findByRoute: findByRoute,
    permalinkFor: permalinkFor,
    legacyUrlFor: legacyUrlFor,
    slugAliasFor: slugAliasFor,
    currentCanonicalUrl: currentCanonicalUrl
  });
}());
