// app.js — Renders the current Finds grid on index.html.
// Reads from window.JEWELRY_ITEMS (set by data/items.js).
// Builds one card per item and injects them into #catalogGrid.


// --- Step 1: Get the catalog container from the page ----------

var grid = document.getElementById("catalogGrid");


// --- Step 2: Guard — stop if the container isn't found --------

if (!grid) {
  console.error("app.js: Could not find #catalogGrid on the page.");
}


// --- Step 3: Guard — stop if item data wasn't loaded ----------

else if (!window.JEWELRY_ITEMS || window.JEWELRY_ITEMS.length === 0) {
  grid.innerHTML = '<p class="catalog-placeholder">No Finds found.</p>';
}


// --- Step 4: Render a card for each item ----------------------

else {

  // Clear the loading placeholder before inserting real cards
  grid.innerHTML = "";

  window.JEWELRY_ITEMS.forEach(function (item) {

    // Build the card element
    var card = document.createElement("a");
    card.className = "card";
    card.href = "item.html?id=" + item.id;

    // --- Image area ---
    // Use a styled div as a placeholder when no real image exists yet
    var imageHTML;
    if (item.image) {
      imageHTML = '<img class="card-image" src="' + item.image + '" alt="' + item.name + '" onerror="this.style.display=\'none\'; this.nextElementSibling.style.display=\'flex\';">'
               + '<div class="card-image-placeholder" style="display:none;">No photo yet</div>';
    } else {
      imageHTML = '<div class="card-image-placeholder">No photo yet</div>';
    }

    // --- Availability badge ---
    // Map the status value to the matching CSS class
    var badgeClass = "badge badge-" + item.status;
    var badgeLabel = item.status.charAt(0).toUpperCase() + item.status.slice(1);

    // --- Assemble the full card HTML ---
    card.innerHTML =
      imageHTML +
      '<div class="card-body">' +
        '<p class="card-title">' + item.name + '</p>' +
        '<p class="card-price">$' + item.price + '</p>' +
        '<p class="card-description">' + item.description + '</p>' +
        '<span class="' + badgeClass + '">' + badgeLabel + '</span>' +
        '<span class="card-link">View Find <span aria-hidden="true">&rarr;</span></span>' +
      '</div>';

    // Add the finished card to the grid
    grid.appendChild(card);
  });
}
