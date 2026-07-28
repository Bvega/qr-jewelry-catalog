// app.js — Renders Collections and discovery views on index.html.
// The normalized Finds in data/items.js are the display source. Permanent
// links come from the shared permalink runtime; numeric routes remain direct
// compatibility surfaces for already-distributed URLs and QR codes.

function escapeHTML(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function availabilityLabel(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function getNormalizedFinds() {
  if (Array.isArray(window.BETWEEN_US_FINDS)) {
    return window.BETWEEN_US_FINDS;
  }

  // Preserve the isolated M01 renderer contract when only the legacy global is
  // supplied. Production index.html always loads the normalized global.
  if (Array.isArray(window.JEWELRY_ITEMS)) {
    return window.JEWELRY_ITEMS.map(function (item) {
      return {
        publicId: "",
        legacyId: item.id,
        title: item.name,
        collection: "jewelry",
        description: item.description,
        availability: item.status,
        price: { amount: item.price, currency: "USD" },
        primaryPhoto: item.image,
        altText: item.name
      };
    });
  }

  return [];
}

function isUnavailablePhoto(path) {
  return Boolean(
    path &&
    window.BETWEEN_US_MEDIA &&
    typeof window.BETWEEN_US_MEDIA.isUnavailable === "function" &&
    window.BETWEEN_US_MEDIA.isUnavailable(path)
  );
}

function findImageHTML(find, imageClass, placeholderClass) {
  if (!find.primaryPhoto || isUnavailablePhoto(find.primaryPhoto)) {
    return '<div class="' + placeholderClass + '">No photo yet</div>';
  }

  return '<img class="' + imageClass + '" src="' + escapeHTML(find.primaryPhoto) + '" alt="' +
    escapeHTML(find.altText) + '" onerror="this.style.display=\'none\'; this.nextElementSibling.style.display=\'flex\';">' +
    '<div class="' + placeholderClass + '" style="display:none;">No photo yet</div>';
}

function publicFindURL(find) {
  if (
    window.BETWEEN_US_PERMALINKS &&
    typeof window.BETWEEN_US_PERMALINKS.permalinkFor === "function"
  ) {
    var permalink = window.BETWEEN_US_PERMALINKS.permalinkFor(find);
    if (permalink) return permalink;
  }

  // Preserve the isolated pre-normalization renderer fallback. Production
  // pages always load the permalink runtime and normalized public ID.
  return find.publicId
    ? "find.html?id=" + encodeURIComponent(find.publicId)
    : "item.html?id=" + find.legacyId;
}

// One renderer supplies every standard card in Explore, Featured, and Latest.
function createFindCard(find) {
  var item = {
    id: find.legacyId,
    name: find.title,
    price: find.price.amount,
    description: find.description,
    status: find.availability,
    image: find.primaryPhoto,
    altText: find.altText
  };
  var card = document.createElement("a");
  var badgeClass = "badge badge-" + item.status;
  var badgeLabel = availabilityLabel(item.status);

  card.className = "card";
  card.href = publicFindURL(find);
  card.innerHTML =
    findImageHTML({ primaryPhoto: item.image, altText: item.altText }, "card-image", "card-image-placeholder") +
    '<div class="card-body">' +
      '<p class="card-title">' + escapeHTML(item.name) + '</p>' +
      '<p class="card-price">$' + escapeHTML(item.price) + '</p>' +
      '<p class="card-description">' + escapeHTML(item.description) + '</p>' +
      '<span class="' + badgeClass + '">' + badgeLabel + '</span>' +
      '<span class="card-link">View Find <span aria-hidden="true">&rarr;</span></span>' +
    '</div>';

  return card;
}

function renderFindCards(container, finds) {
  if (!container) return;

  container.innerHTML = "";

  if (finds.length === 0) {
    var emptyState = document.createElement("p");
    emptyState.className = "catalog-placeholder catalog-empty-state";
    emptyState.textContent = "No Finds are available in this Collection yet.";
    container.appendChild(emptyState);
    return;
  }

  finds.forEach(function (find) {
    container.appendChild(createFindCard(find));
  });
}

function renderCollections(container, collections) {
  if (!container) return;

  container.innerHTML = "";

  collections.forEach(function (collection, index) {
    var card = document.createElement("article");
    var isActive = collection.status === "active";
    var number = String(index + 1).padStart(2, "0");

    card.className = "collection-card " +
      (isActive ? "collection-card-active" : "collection-card-coming-soon");
    card.innerHTML =
      '<span class="collection-number" aria-hidden="true">' + number + '</span>' +
      '<h3>' + escapeHTML(collection.label) + '</h3>' +
      '<p class="collection-description">' + escapeHTML(collection.description) + '</p>' +
      '<p class="collection-status">' + (isActive ? "Current Collection" : "Coming Soon") + '</p>' +
      (isActive
        ? '<a class="collection-action" href="#explore">Explore ' + escapeHTML(collection.label) + '</a>'
        : "");
    container.appendChild(card);
  });
}

function resolveFinds(publicIds) {
  if (!window.BETWEEN_US_DATA || typeof window.BETWEEN_US_DATA.findByPublicId !== "function") {
    return [];
  }

  return publicIds.map(function (publicId) {
    return window.BETWEEN_US_DATA.findByPublicId(publicId);
  }).filter(function (find) {
    return find !== null;
  });
}

function renderWeeklyFind(container, find) {
  if (!container || !find) return;

  var badgeClass = "badge badge-" + find.availability;
  var badgeLabel = availabilityLabel(find.availability);

  container.innerHTML =
    '<div class="weekly-media">' +
      findImageHTML(find, "weekly-image", "card-image-placeholder weekly-image-placeholder") +
    '</div>' +
    '<div class="weekly-body">' +
      '<p class="weekly-public-id">' + escapeHTML(find.publicId) + '</p>' +
      '<h3>' + escapeHTML(find.title) + '</h3>' +
      '<p class="weekly-description">' + escapeHTML(find.description) + '</p>' +
      '<p class="weekly-price">$' + escapeHTML(find.price.amount) + '</p>' +
      '<span class="' + badgeClass + '">' + badgeLabel + '</span>' +
      '<a class="button button-primary weekly-action" href="' + escapeHTML(publicFindURL(find)) + '">View Find</a>' +
    '</div>';
}

function initializeCatalogPage(loadResult) {
  var finds = getNormalizedFinds();
  var collections = Array.isArray(window.BETWEEN_US_COLLECTIONS)
    ? window.BETWEEN_US_COLLECTIONS
    : [];
  var discovery = window.BETWEEN_US_DISCOVERY || null;
  var collectionGrid = document.getElementById("collectionGrid");
  var catalogGrid = document.getElementById("catalogGrid");
  var featuredGrid = document.getElementById("featuredGrid");
  var latestGrid = document.getElementById("latestGrid");
  var weeklyFeature = document.getElementById("weeklyFeature");
  var collectionFilters = document.getElementById("collectionFilters");
  var resultsSummary = document.getElementById("resultsSummary");
  var availabilityStatus = document.getElementById("catalogAvailabilityStatus");

  if (availabilityStatus) {
    availabilityStatus.textContent = loadResult && loadResult.message ? loadResult.message : "";
    availabilityStatus.hidden = !availabilityStatus.textContent;
  }

  renderCollections(collectionGrid, collections);

  if (discovery) {
    renderFindCards(featuredGrid, resolveFinds(discovery.featuredFindIds));
    renderFindCards(latestGrid, resolveFinds(discovery.latestFindIds));
    renderWeeklyFind(
      weeklyFeature,
      window.BETWEEN_US_DATA.findByPublicId(discovery.weeklyFindId)
    );
  }

  if (!catalogGrid) {
    return;
  } else if (finds.length === 0) {
    catalogGrid.innerHTML = '<p class="catalog-placeholder">No Finds found.</p>';
  } else {
    var activeFilterId = null;
    var filterButtons = [];
    var activeCollections = collections.filter(function (collection) {
      return collection.status === "active";
    });

  function collectionById(collectionId) {
    return activeCollections.find(function (collection) {
      return collection.id === collectionId;
    }) || null;
  }

  function updateFilter(collectionId) {
    var selectedCollection = collectionId === null ? null : collectionById(collectionId);

    if (collectionId !== null && !selectedCollection) return;

    activeFilterId = selectedCollection ? selectedCollection.id : null;
    var filteredFinds = selectedCollection
      ? finds.filter(function (find) { return find.collection === selectedCollection.id; })
      : finds.slice();

    filterButtons.forEach(function (button) {
      var buttonId = button.getAttribute("data-collection-id");
      var isSelected = activeFilterId === null
        ? buttonId === "all"
        : buttonId === activeFilterId;
      button.setAttribute("aria-pressed", String(isSelected));
    });

    renderFindCards(catalogGrid, filteredFinds);

    if (resultsSummary) {
      var countLabel = filteredFinds.length + (filteredFinds.length === 1 ? " Find" : " Finds");
      resultsSummary.textContent = selectedCollection
        ? countLabel + " in " + selectedCollection.label
        : countLabel;
    }
  }

  function addFilterButton(label, collectionId) {
    if (!collectionFilters) return;

    var button = document.createElement("button");
    button.type = "button";
    button.className = "collection-filter";
    button.textContent = label;
    button.setAttribute("data-collection-id", collectionId || "all");
    button.setAttribute("aria-pressed", "false");
    button.addEventListener("click", function () {
      updateFilter(collectionId);
    });
    filterButtons.push(button);
    collectionFilters.appendChild(button);
  }

  if (collectionFilters) {
    collectionFilters.innerHTML = "";
    addFilterButton("All Finds", null);
    activeCollections.forEach(function (collection) {
      addFilterButton(collection.label, collection.id);
    });
  }

    updateFilter(null);
  }

  // Re-align a direct in-page target after each data-driven render.
  if (window.location && window.location.hash) {
    var hashTarget = document.getElementById(window.location.hash.slice(1));

    if (hashTarget && typeof hashTarget.scrollIntoView === "function") {
      if (typeof window.requestAnimationFrame === "function") {
        window.requestAnimationFrame(function () {
          hashTarget.scrollIntoView({ block: "start", behavior: "instant" });
        });
      } else {
        hashTarget.scrollIntoView({ block: "start", behavior: "instant" });
      }
    }
  }
}

// Render the protected static catalog immediately. A successful remote request
// then replaces it with the static-first hybrid view.
initializeCatalogPage({ message: "" });
if (
  window.BETWEEN_US_PUBLIC_CATALOG &&
  window.BETWEEN_US_PUBLIC_CATALOG.ready &&
  typeof window.BETWEEN_US_PUBLIC_CATALOG.ready.then === "function"
) {
  window.BETWEEN_US_PUBLIC_CATALOG.ready.then(initializeCatalogPage);
}
