// item.js — Renders the Find detail view on item.html.
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
    document.title = "Find not found | Between Us Finds";
    detail.innerHTML =
      '<div class="not-found-state">' +
        '<p class="eyebrow">Between Us Finds</p>' +
        '<h1>Find not found.</h1>' +
        '<p>This Find may no longer be available, or the link may be incomplete.</p>' +
        '<a class="button button-primary" href="index.html#explore">Back to Explore</a>' +
      '</div>';
  }


  // --- Step 6: Render the full product detail ----------------

  else {

    // Update the browser tab title to match the item name
    document.title = item.name + " | Between Us Finds";

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
              '<span class="card-link">View Find <span aria-hidden="true">&rarr;</span></span>' +
            '</div>' +
          '</a>';
      });

      relatedHTML =
        '<section class="related-section">' +
          '<h2 class="related-heading">Related Finds</h2>' +
          '<div class="related-grid">' + relatedCardsHTML + '</div>' +
        '</section>';
    }

    // --- Share link box ---
    // Shows the current page URL so the seller can copy and share it.
    // The copy button is wired up after innerHTML is set below.
    var shareURL = window.location.href;

    var shareLinkHTML =
      '<div class="share-link-box">' +
        '<span class="share-url">' + shareURL + '</span>' +
        '<button class="copy-btn" id="copyLinkBtn">Copy Find link</button>' +
        '<span class="copy-confirm" id="copyConfirm">Link copied</span>' +
      '</div>';

    // --- QR code section ---
    // The empty div #qrCodeCanvas is where the QR image will be drawn.
    // QR generation happens after innerHTML is set (the div must exist first).
    var qrSectionHTML =
      '<div class="qr-section">' +
        '<p class="qr-label">Scan QR code</p>' +
        '<div id="qrCodeCanvas" class="qr-canvas-wrapper"></div>' +
        '<p class="qr-fallback" id="qrFallback" style="display:none;">' +
          'QR code could not be generated.' +
        '</p>' +
        '<button class="qr-download-btn" id="qrDownloadBtn">Download QR code</button>' +
      '</div>';

    // --- Assemble the full detail view ---
    detail.innerHTML =
      '<article class="detail-card">' +
        imageHTML +
        '<div class="detail-body">' +
          '<p class="detail-category">' + categoryLabel + '</p>' +
          '<h1 class="detail-title">' + item.name + '</h1>' +
          '<p class="detail-price">$' + item.price + '</p>' +
          '<span class="' + badgeClass + '">' + badgeLabel + '</span>' +
          '<p class="detail-description">' + item.description + '</p>' +
          shareLinkHTML +
          qrSectionHTML +
        '</div>' +
      '</article>' +
      relatedHTML;

    // --- Wire up the copy button ---
    // Must run after innerHTML is set so the button exists in the DOM.
    var copyBtn = document.getElementById("copyLinkBtn");
    var copyConfirm = document.getElementById("copyConfirm");

    if (copyBtn) {
      copyBtn.addEventListener("click", function () {
        navigator.clipboard.writeText(shareURL).then(function () {
          copyConfirm.style.display = "inline";
          setTimeout(function () {
            copyConfirm.style.display = "none";
          }, 2000);
        });
      });
    }

    // --- Step 7: Generate the QR code ---
    // QRCode is a global provided by the qrcodejs CDN script in item.html.
    // It draws a canvas (or img in older browsers) inside the target element.

    var qrContainer = document.getElementById("qrCodeCanvas");
    var qrFallback  = document.getElementById("qrFallback");
    var qrDownloadBtn = document.getElementById("qrDownloadBtn");

    if (qrContainer && typeof QRCode !== "undefined") {
      try {
        new QRCode(qrContainer, {
          text:       shareURL,
          width:      160,
          height:     160,
          colorDark:  "#2c2c2c",
          colorLight: "#ffffff"
        });

        // --- Wire up the download button ---
        // qrcodejs renders a <canvas> in modern browsers.
        // Convert it to a PNG data URL and trigger a file download.
        if (qrDownloadBtn) {
          qrDownloadBtn.addEventListener("click", function () {
            var canvas = qrContainer.querySelector("canvas");
            var img    = qrContainer.querySelector("img");
            var link   = document.createElement("a");

            link.download = "jewelry-item-" + item.id + "-qr.png";

            if (canvas) {
              link.href = canvas.toDataURL("image/png");
            } else if (img) {
              // Older browser fallback: qrcodejs used an <img> tag
              link.href = img.src;
            } else {
              return;
            }

            // Append, click, and remove — ensures download works across browsers
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
          });
        }

      } catch (err) {
        // QR generation threw an error — show the fallback message
        if (qrFallback)    qrFallback.style.display    = "block";
        if (qrDownloadBtn) qrDownloadBtn.style.display = "none";
      }

    } else {
      // QRCode library did not load — show the fallback message
      if (qrFallback)    qrFallback.style.display    = "block";
      if (qrDownloadBtn) qrDownloadBtn.style.display = "none";
    }
  }
}
