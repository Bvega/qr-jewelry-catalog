// item.js — Renders the product detail view on item.html.
// Reads the item id from the URL, finds the matching item in
// window.JEWELRY_ITEMS (set by data/items.js), and renders it
// into #itemDetail.


// --- Step 1: Get the detail container from the page ----------

var detail = document.getElementById("itemDetail");


// --- Step 2: Guard — stop if the container isn't found -------

if (!detail) {
  console.error("item.js: Could not find #itemDetail on the page.");
}

else {

  // --- Step 3: Read the item id from the URL query string ----
  // Example URL: item.html?id=3  →  itemId = 3

  var params = new URLSearchParams(window.location.search);
  var itemId = parseInt(params.get("id"), 10);


  // --- Step 4: Find the matching item in the data ------------

  var item = null;

  if (window.JEWELRY_ITEMS && itemId) {
    window.JEWELRY_ITEMS.forEach(function (candidate) {
      if (candidate.id === itemId) {
        item = candidate;
      }
    });
  }


  // --- Step 5: Show "not found" if no match ------------------

  if (!item) {
    detail.innerHTML =
      '<p class="catalog-placeholder">' +
        'Item not found. <a href="index.html">Back to catalog</a>.' +
      '</p>';
  }


  // --- Step 6: Render the full product detail ----------------

  else {

    // Update the browser tab title to match the item name
    document.title = item.name + " — Jewelry Catalog";

    // --- Image ---
    var imageHTML;
    if (item.image) {
      imageHTML =
        '<img class="detail-image" src="' + item.image + '" alt="' + item.name + '"' +
        ' onerror="this.style.display=\'none\'; this.nextElementSibling.style.display=\'flex\';">' +
        '<div class="card-image-placeholder detail-image" style="display:none;">No photo yet</div>';
    } else {
      imageHTML = '<div class="card-image-placeholder detail-image">No photo yet</div>';
    }

    // --- Availability badge ---
    var badgeClass = "badge badge-" + item.status;
    var badgeLabel = item.status.charAt(0).toUpperCase() + item.status.slice(1);

    // --- Category label (capitalize first letter) ---
    var categoryLabel = item.category.charAt(0).toUpperCase() + item.category.slice(1);

    // --- Related items section ---
    // Find each related item object by matching relatedIds to the full list
    var relatedItems = [];
    if (item.relatedIds && window.JEWELRY_ITEMS) {
      window.JEWELRY_ITEMS.forEach(function (candidate) {
        if (item.relatedIds.indexOf(candidate.id) !== -1) {
          relatedItems.push(candidate);
        }
      });
    }

    // Build a small card for each related item
    var relatedHTML = "";
    if (relatedItems.length > 0) {
      var relatedCardsHTML = "";

      relatedItems.forEach(function (related) {
        var relatedImageHTML;
        if (related.image) {
          relatedImageHTML =
            '<img class="card-image" src="' + related.image + '" alt="' + related.name + '"' +
            ' onerror="this.style.display=\'none\'; this.nextElementSibling.style.display=\'flex\';">' +
            '<div class="card-image-placeholder" style="display:none;">No photo yet</div>';
        } else {
          relatedImageHTML = '<div class="card-image-placeholder">No photo yet</div>';
        }

        var relatedBadgeClass = "badge badge-" + related.status;
        var relatedBadgeLabel = related.status.charAt(0).toUpperCase() + related.status.slice(1);

        relatedCardsHTML +=
          '<a class="card" href="item.html?id=' + related.id + '">' +
            relatedImageHTML +
            '<div class="card-body">' +
              '<p class="card-title">' + related.name + '</p>' +
              '<p class="card-price">$' + related.price + '</p>' +
              '<span class="' + relatedBadgeClass + '">' + relatedBadgeLabel + '</span>' +
            '</div>' +
          '</a>';
      });

      relatedHTML =
        '<section class="related-section">' +
          '<h2 class="related-heading">You may also like</h2>' +
          '<div class="related-grid">' + relatedCardsHTML + '</div>' +
        '</section>';
    }

    // --- Assemble the full detail view ---
    detail.innerHTML =
      '<article class="detail-card">' +
        imageHTML +
        '<div class="detail-body">' +
          '<p class="detail-category">' + categoryLabel + '</p>' +
          '<h2 class="detail-title">' + item.name + '</h2>' +
          '<p class="detail-price">$' + item.price + '</p>' +
          '<span class="' + badgeClass + '">' + badgeLabel + '</span>' +
          '<p class="detail-description">' + item.description + '</p>' +
        '</div>' +
      '</article>' +
      relatedHTML;
  }
}
