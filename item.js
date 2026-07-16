// item.js — Renders normalized Find Details and manual reservation controls.
// Numeric item.html?id=N routes remain the public compatibility surface.

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

function isUnavailablePhoto(path) {
  return Boolean(
    path &&
    window.BETWEEN_US_MEDIA &&
    typeof window.BETWEEN_US_MEDIA.isUnavailable === "function" &&
    window.BETWEEN_US_MEDIA.isUnavailable(path)
  );
}

function orderedUsablePhotos(find) {
  var ordered = [];

  function addPhoto(path) {
    if (
      typeof path === "string" &&
      path.length > 0 &&
      ordered.indexOf(path) === -1 &&
      !isUnavailablePhoto(path)
    ) {
      ordered.push(path);
    }
  }

  addPhoto(find.primaryPhoto);
  if (Array.isArray(find.photos)) {
    find.photos.forEach(addPhoto);
  }

  return ordered;
}

function collectionLabel(collectionId) {
  var collections = Array.isArray(window.BETWEEN_US_COLLECTIONS)
    ? window.BETWEEN_US_COLLECTIONS
    : [];

  for (var index = 0; index < collections.length; index += 1) {
    if (collections[index].id === collectionId) {
      return collections[index].label;
    }
  }

  return "Collection unavailable";
}

function formatCurrency(price) {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: price.currency
    }).format(price.amount);
  } catch (error) {
    return price.currency + " " + price.amount;
  }
}

function fallbackPhotoHTML(extraClass, hidden) {
  return '<div class="card-image-placeholder detail-image-fallback ' + (extraClass || "") + '"' +
    (hidden ? " hidden" : "") + '>' +
      '<span>No photo yet</span>' +
      '<small>Details are still available below.</small>' +
    '</div>';
}

function galleryHTML(find, photos) {
  if (photos.length === 0) {
    return '<div class="detail-gallery" aria-label="Photos for ' + escapeHTML(find.title) + '">' +
      fallbackPhotoHTML("detail-gallery-empty", false) +
    '</div>';
  }

  var thumbnailHTML = "";
  if (photos.length > 1) {
    thumbnailHTML = '<div class="gallery-thumbnails" aria-label="Choose a photo">' +
      photos.map(function (photo, index) {
        return '<button class="gallery-thumbnail" type="button" data-photo-index="' + index + '"' +
          ' aria-label="View photo ' + (index + 1) + ' of ' + photos.length + ' for ' +
          escapeHTML(find.title) + '" aria-pressed="' + (index === 0 ? "true" : "false") + '">' +
          '<img src="' + escapeHTML(photo) + '" alt="" />' +
        '</button>';
      }).join("") +
    '</div>' +
    '<p class="gallery-status visually-hidden" id="galleryStatus" aria-live="polite" aria-atomic="true"></p>';
  }

  return '<div class="detail-gallery" aria-label="Photos for ' + escapeHTML(find.title) + '">' +
    '<div class="gallery-primary">' +
      '<img class="detail-image" id="galleryMainImage" src="' + escapeHTML(photos[0]) +
        '" alt="' + escapeHTML(find.altText) + '" />' +
      fallbackPhotoHTML("", true) +
    '</div>' +
    thumbnailHTML +
  '</div>';
}

function relatedFindsFor(find) {
  if (!window.BETWEEN_US_DATA || typeof window.BETWEEN_US_DATA.findByPublicId !== "function") {
    return [];
  }

  return find.relatedFindIds.map(function (publicId) {
    return window.BETWEEN_US_DATA.findByPublicId(publicId);
  }).filter(function (relatedFind) {
    return relatedFind !== null;
  });
}

function relatedImageHTML(find) {
  var photo = orderedUsablePhotos(find)[0];

  if (!photo) {
    return '<div class="card-image-placeholder">No photo yet</div>';
  }

  return '<img class="card-image" src="' + escapeHTML(photo) + '" alt="' +
    escapeHTML(find.altText) + '" onerror="this.style.display=\'none\'; this.nextElementSibling.style.display=\'flex\';">' +
    '<div class="card-image-placeholder" style="display:none;">No photo yet</div>';
}

function relatedHTML(find) {
  var relatedFinds = relatedFindsFor(find);
  if (relatedFinds.length === 0) return "";

  var cards = relatedFinds.map(function (relatedFind) {
    var badgeClass = "badge badge-" + relatedFind.availability;

    return '<a class="card" href="item.html?id=' + relatedFind.legacyId + '">' +
      relatedImageHTML(relatedFind) +
      '<div class="card-body">' +
        '<p class="card-title">' + escapeHTML(relatedFind.title) + '</p>' +
        '<p class="card-price">' + escapeHTML(formatCurrency(relatedFind.price)) + '</p>' +
        '<span class="' + badgeClass + '">' + availabilityLabel(relatedFind.availability) + '</span>' +
        '<span class="card-link">View Find <span aria-hidden="true">&rarr;</span></span>' +
      '</div>' +
    '</a>';
  }).join("");

  return '<section class="related-section" aria-labelledby="related-title">' +
    '<h2 class="related-heading" id="related-title">Related Finds</h2>' +
    '<div class="related-grid">' + cards + '</div>' +
  '</section>';
}

function buildReservationMessage(find, configuration) {
  return configuration.messageTemplate
    .replace(/\{title\}/g, find.title)
    .replace(/\{publicId\}/g, find.publicId);
}

function completeReservationMessage(message, shareURL, configuration) {
  return configuration.includeUrl ? message + "\n\n" + shareURL : message;
}

function reservationHTML(find, shareURL) {
  var configuration = window.BETWEEN_US_RESERVATION;
  var message = buildReservationMessage(find, configuration);
  var completeMessage = completeReservationMessage(message, shareURL, configuration);
  var availabilityHTML = "";

  if (find.availability === "available") {
    availabilityHTML = '<button class="button button-primary reservation-button" type="button" id="reserveMessageBtn">' +
      'Reserve by Message</button>';
  } else if (find.availability === "reserved") {
    availabilityHTML = '<p class="reservation-unavailable">This Find is currently reserved.</p>';
  } else {
    availabilityHTML = '<p class="reservation-unavailable">This Find has been sold.</p>';
  }

  return '<section class="reservation-panel" aria-labelledby="reservation-title">' +
    '<p class="eyebrow">Local reservation request</p>' +
    '<h2 id="reservation-title">Reserve This Find</h2>' +
    '<p>The owner confirms availability manually.</p>' +
    '<p>Payment is cash. Local pickup details are arranged by message after availability is confirmed.</p>' +
    availabilityHTML +
    '<p class="reservation-status" id="reservationStatus" role="status" aria-live="polite" aria-atomic="true"></p>' +
    '<label class="reservation-fallback-label" id="reservationFallbackLabel" for="reservationMessageFallback" hidden>' +
      'Copy this reservation message</label>' +
    '<textarea class="reservation-message-fallback" id="reservationMessageFallback" rows="6" readonly hidden>' +
      escapeHTML(completeMessage) + '</textarea>' +
  '</section>';
}

function sharingHTML(shareURL) {
  return '<section class="share-section" aria-labelledby="share-title">' +
    '<h2 id="share-title">Share This Find</h2>' +
    '<div class="share-link-box">' +
      '<span class="share-url">' + escapeHTML(shareURL) + '</span>' +
      '<button class="copy-btn" type="button" id="copyLinkBtn">Copy Find link</button>' +
      '<span class="copy-confirm" id="copyConfirm" role="status" aria-live="polite" hidden>Link copied</span>' +
    '</div>' +
  '</section>';
}

function qrHTML() {
  return '<section class="qr-section" aria-labelledby="qr-title">' +
    '<h2 class="qr-label" id="qr-title">Scan QR code</h2>' +
    '<div id="qrCodeCanvas" class="qr-canvas-wrapper"></div>' +
    '<p class="qr-fallback" id="qrFallback" hidden>QR code could not be generated.</p>' +
    '<button class="qr-download-btn" type="button" id="qrDownloadBtn">Download QR code</button>' +
  '</section>';
}

function isShareCancellation(error) {
  return Boolean(error && (error.name === "AbortError" || error.code === 20));
}

function copyReservationToClipboard(completeMessage, status, fallback, fallbackLabel) {
  if (
    typeof navigator === "undefined" ||
    !navigator.clipboard ||
    typeof navigator.clipboard.writeText !== "function"
  ) {
    fallback.hidden = false;
    fallbackLabel.hidden = false;
    status.textContent = "Could not copy automatically. Select and copy the message below, then paste it into your preferred messaging application.";
    return;
  }

  try {
    Promise.resolve(navigator.clipboard.writeText(completeMessage)).then(function () {
      fallback.hidden = true;
      fallbackLabel.hidden = true;
      status.textContent = "Reservation message copied. Paste it into your preferred messaging application.";
    }).catch(function () {
      fallback.hidden = false;
      fallbackLabel.hidden = false;
      status.textContent = "Could not copy automatically. Select and copy the message below, then paste it into your preferred messaging application.";
    });
  } catch (error) {
    fallback.hidden = false;
    fallbackLabel.hidden = false;
    status.textContent = "Could not copy automatically. Select and copy the message below, then paste it into your preferred messaging application.";
  }
}

function wireGallery(find, photos, detail) {
  var mainImage = document.getElementById("galleryMainImage");
  if (!mainImage) return;

  var fallback = mainImage.nextElementSibling;
  var status = document.getElementById("galleryStatus");
  var thumbnailButtons = detail.querySelectorAll
    ? Array.prototype.slice.call(detail.querySelectorAll(".gallery-thumbnail"))
    : [];

  mainImage.addEventListener("error", function () {
    mainImage.hidden = true;
    if (fallback) fallback.hidden = false;
  });

  function selectPhoto(index) {
    mainImage.src = photos[index];
    mainImage.alt = find.altText;
    mainImage.hidden = false;
    if (fallback) fallback.hidden = true;

    thumbnailButtons.forEach(function (button, buttonIndex) {
      button.setAttribute("aria-pressed", String(buttonIndex === index));
    });

    if (status) {
      status.textContent = "Photo " + (index + 1) + " of " + photos.length + " selected.";
    }
  }

  thumbnailButtons.forEach(function (button, index) {
    button.addEventListener("click", function () {
      selectPhoto(index);
    });
    button.addEventListener("keydown", function (event) {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      event.preventDefault();
      var offset = event.key === "ArrowRight" ? 1 : -1;
      var nextIndex = (index + offset + thumbnailButtons.length) % thumbnailButtons.length;
      thumbnailButtons[nextIndex].focus();
      selectPhoto(nextIndex);
    });
  });
}

function wireReservation(find, shareURL) {
  var button = document.getElementById("reserveMessageBtn");
  if (!button) return;

  var configuration = window.BETWEEN_US_RESERVATION;
  var message = buildReservationMessage(find, configuration);
  var completeMessage = completeReservationMessage(message, shareURL, configuration);
  var status = document.getElementById("reservationStatus");
  var fallback = document.getElementById("reservationMessageFallback");
  var fallbackLabel = document.getElementById("reservationFallbackLabel");

  button.addEventListener("click", function () {
    fallback.hidden = true;
    fallbackLabel.hidden = true;
    status.textContent = "";

    if (
      configuration.channel === "share" &&
      typeof navigator !== "undefined" &&
      typeof navigator.share === "function"
    ) {
      var shareData = {
        title: "Between Us reservation request",
        text: message
      };
      if (configuration.includeUrl) shareData.url = shareURL;

      try {
        Promise.resolve(navigator.share(shareData)).then(function () {
          status.textContent = "Reservation request shared. The owner will still confirm availability manually.";
        }).catch(function (error) {
          if (isShareCancellation(error)) {
            status.textContent = "Sharing was canceled. Nothing was sent.";
            return;
          }
          copyReservationToClipboard(completeMessage, status, fallback, fallbackLabel);
        });
      } catch (error) {
        copyReservationToClipboard(completeMessage, status, fallback, fallbackLabel);
      }
      return;
    }

    copyReservationToClipboard(completeMessage, status, fallback, fallbackLabel);
  });
}

function wireGeneralCopy(shareURL) {
  var copyBtn = document.getElementById("copyLinkBtn");
  var copyConfirm = document.getElementById("copyConfirm");
  if (!copyBtn || !copyConfirm) return;

  copyBtn.addEventListener("click", function () {
    if (!navigator.clipboard || typeof navigator.clipboard.writeText !== "function") return;

    navigator.clipboard.writeText(shareURL).then(function () {
      copyConfirm.hidden = false;
      setTimeout(function () {
        copyConfirm.hidden = true;
      }, 2000);
    });
  });
}

function wireQRCode(find, shareURL) {
  var qrContainer = document.getElementById("qrCodeCanvas");
  var qrFallback = document.getElementById("qrFallback");
  var qrDownloadBtn = document.getElementById("qrDownloadBtn");

  if (qrContainer && typeof QRCode !== "undefined") {
    try {
      new QRCode(qrContainer, {
        text: shareURL,
        width: 160,
        height: 160,
        colorDark: "#2c2c2c",
        colorLight: "#ffffff"
      });

      if (qrDownloadBtn) {
        qrDownloadBtn.addEventListener("click", function () {
          var canvas = qrContainer.querySelector("canvas");
          var img = qrContainer.querySelector("img");
          var link = document.createElement("a");

          link.download = "jewelry-item-" + find.legacyId + "-qr.png";

          if (canvas) {
            link.href = canvas.toDataURL("image/png");
          } else if (img) {
            link.href = img.src;
          } else {
            return;
          }

          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        });
      }
    } catch (error) {
      if (qrFallback) qrFallback.hidden = false;
      if (qrDownloadBtn) qrDownloadBtn.hidden = true;
    }
  } else {
    if (qrFallback) qrFallback.hidden = false;
    if (qrDownloadBtn) qrDownloadBtn.hidden = true;
  }
}

var detail = document.getElementById("itemDetail");

if (!detail) {
  console.error("item.js: Could not find #itemDetail on the page.");
} else {
  var params = new URLSearchParams(window.location.search);
  var itemId = parseInt(params.get("id"), 10);
  var find = null;

  if (
    window.BETWEEN_US_DATA &&
    typeof window.BETWEEN_US_DATA.findByLegacyId === "function" &&
    itemId
  ) {
    find = window.BETWEEN_US_DATA.findByLegacyId(itemId);
  }

  if (!find) {
    document.title = "Find not found | Between Us Finds";
    detail.innerHTML =
      '<div class="not-found-state">' +
        '<p class="eyebrow">Between Us Finds</p>' +
        '<h1>Find not found.</h1>' +
        '<p>This Find may no longer be available, or the link may be incomplete.</p>' +
        '<a class="button button-primary" href="index.html#explore">Back to Explore</a>' +
      '</div>';
  } else {
    document.title = find.title + " | Between Us Finds";

    var photos = orderedUsablePhotos(find);
    var shareURL = window.location.href;
    var badgeClass = "badge badge-" + find.availability;
    var conditionHTML = typeof find.condition === "string" && find.condition.trim().length > 0
      ? '<p class="detail-condition"><span>Condition:</span> ' + escapeHTML(find.condition.trim()) + '</p>'
      : "";

    detail.innerHTML =
      '<article class="detail-card">' +
        galleryHTML(find, photos) +
        '<div class="detail-body">' +
          '<p class="detail-public-id">Find ID: <strong>' + escapeHTML(find.publicId) + '</strong></p>' +
          '<p class="detail-collection">Collection: ' + escapeHTML(collectionLabel(find.collection)) + '</p>' +
          '<h1 class="detail-title">' + escapeHTML(find.title) + '</h1>' +
          '<p class="detail-price">' + escapeHTML(formatCurrency(find.price)) + '</p>' +
          '<p class="detail-availability">Availability: <span class="' + badgeClass + '">' +
            availabilityLabel(find.availability) + '</span></p>' +
          '<p class="detail-description">' + escapeHTML(find.description) + '</p>' +
          conditionHTML +
          reservationHTML(find, shareURL) +
        '</div>' +
      '</article>' +
      '<div class="detail-utilities">' +
        sharingHTML(shareURL) +
        qrHTML() +
      '</div>' +
      relatedHTML(find);

    wireGallery(find, photos, detail);
    wireReservation(find, shareURL);
    wireGeneralCopy(shareURL);
    wireQRCode(find, shareURL);
  }
}
