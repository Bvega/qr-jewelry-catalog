// item.js — Renders normalized Find Details, permanent sharing utilities, and
// manual reservation controls for canonical, slug-alias, and legacy routes.

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

function altTextForPhoto(find, photo) {
  var index = Array.isArray(find.photos) ? find.photos.indexOf(photo) : -1;
  if (
    index >= 0 &&
    Array.isArray(find.photoAltTexts) &&
    typeof find.photoAltTexts[index] === "string" &&
    find.photoAltTexts[index].trim().length > 0
  ) {
    return find.photoAltTexts[index];
  }
  return find.altText;
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
        '" alt="' + escapeHTML(altTextForPhoto(find, photos[0])) + '" />' +
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

    var relatedURL = window.BETWEEN_US_PERMALINKS.permalinkFor(relatedFind);

    return '<a class="card" href="' + escapeHTML(relatedURL) + '">' +
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

function sharingHTML(canonicalURL) {
  return '<section class="share-section" aria-labelledby="share-title">' +
    '<h2 id="share-title">Share This Find</h2>' +
    '<p class="share-intro">Share or copy this permanent Find link.</p>' +
    '<div class="share-link-box">' +
      '<label class="share-link-label" for="shareUrlDisplay">Permanent Find link</label>' +
      '<textarea class="share-url" id="shareUrlDisplay" rows="2" readonly spellcheck="false">' +
        escapeHTML(canonicalURL) + '</textarea>' +
      '<div class="share-actions">' +
        '<button class="copy-btn" type="button" id="shareFindBtn">Share Find</button>' +
        '<button class="copy-btn" type="button" id="copyLinkBtn">Copy Link</button>' +
      '</div>' +
      '<p class="share-status" id="shareStatus" role="status" aria-live="polite" aria-atomic="true"></p>' +
      '<p class="manual-copy-instruction" id="manualCopyInstruction" hidden>' +
        'Select and copy this link manually.</p>' +
    '</div>' +
  '</section>';
}

function qrHTML() {
  return '<section class="qr-section" aria-labelledby="qr-title">' +
    '<h2 class="qr-label" id="qr-title">Scan QR code</h2>' +
    '<p class="qr-description">Scan to open this Find\'s permanent link.</p>' +
    '<div id="qrCodeCanvas" class="qr-canvas-wrapper" aria-label="Permanent Find QR code"></div>' +
    '<p class="qr-status" id="qrStatus" role="status" aria-live="polite" aria-atomic="true"></p>' +
    '<div class="qr-actions">' +
      '<button class="qr-download-btn" type="button" id="qrRetryBtn" hidden>Retry QR</button>' +
      '<button class="qr-download-btn" type="button" id="qrDownloadBtn" disabled aria-disabled="true">' +
        'Download QR code</button>' +
    '</div>' +
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
    mainImage.alt = altTextForPhoto(find, photos[index]);
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

function secondaryCopy(text) {
  if (
    !document.body ||
    typeof document.createElement !== "function" ||
    typeof document.execCommand !== "function"
  ) {
    return false;
  }

  var temporary = document.createElement("textarea");
  temporary.value = text;
  temporary.setAttribute("readonly", "");
  temporary.setAttribute("aria-hidden", "true");
  temporary.style.position = "fixed";
  temporary.style.left = "-9999px";

  try {
    document.body.appendChild(temporary);
    if (typeof temporary.select !== "function") return false;
    temporary.select();
    if (typeof temporary.setSelectionRange === "function") {
      temporary.setSelectionRange(0, temporary.value.length);
    }
    return document.execCommand("copy") === true;
  } catch (error) {
    return false;
  } finally {
    if (temporary.parentNode) {
      temporary.parentNode.removeChild(temporary);
    } else if (typeof document.body.removeChild === "function") {
      try {
        document.body.removeChild(temporary);
      } catch (error) {
        // The temporary control may already have been removed.
      }
    }
  }
}

function copyText(text) {
  var clipboardAvailable =
    typeof navigator !== "undefined" &&
    navigator.clipboard &&
    typeof navigator.clipboard.writeText === "function" &&
    (!window || window.isSecureContext !== false);

  if (!clipboardAvailable) {
    return Promise.resolve(secondaryCopy(text));
  }

  try {
    return Promise.resolve(navigator.clipboard.writeText(text)).then(function () {
      return true;
    }).catch(function () {
      return secondaryCopy(text);
    });
  } catch (error) {
    return Promise.resolve(secondaryCopy(text));
  }
}

function wireGeneralSharing(find, canonicalURL) {
  var shareButton = document.getElementById("shareFindBtn");
  var copyButton = document.getElementById("copyLinkBtn");
  var status = document.getElementById("shareStatus");
  var manualInstruction = document.getElementById("manualCopyInstruction");
  if (!shareButton || !copyButton || !status || !manualInstruction) return;

  function prepareCopy() {
    manualInstruction.hidden = true;
    status.textContent = "";

    return copyText(canonicalURL).then(function (copied) {
      if (copied) {
        status.textContent = "Link copied.";
        return true;
      }

      manualInstruction.hidden = false;
      status.textContent = "Copying was not available. Select and copy the link manually.";
      return false;
    });
  }

  copyButton.addEventListener("click", prepareCopy);
  shareButton.addEventListener("click", function () {
    manualInstruction.hidden = true;
    status.textContent = "";

    if (typeof navigator === "undefined" || typeof navigator.share !== "function") {
      prepareCopy();
      return;
    }

    var shareData = {
      title: find.title + " | Between Us",
      text: "Take a look at " + find.title + " from Between Us.",
      url: canonicalURL
    };

    try {
      Promise.resolve(navigator.share(shareData)).then(function () {
        status.textContent = "Find shared.";
      }).catch(function (error) {
        if (isShareCancellation(error)) {
          status.textContent = "Share was canceled.";
          return;
        }

        manualInstruction.hidden = false;
        status.textContent = "Sharing was not available. Use Copy Link or select the link manually.";
      });
    } catch (error) {
      manualInstruction.hidden = false;
      status.textContent = "Sharing was not available. Use Copy Link or select the link manually.";
    }
  });
}

function validImageURL(value) {
  return typeof value === "string" && /^(?:data:image\/|blob:|https?:\/\/)/i.test(value);
}

function pngSourceFromImage(image) {
  if (!image || !validImageURL(image.src)) return null;
  if (/^data:image\/png(?:;|,)/i.test(image.src)) return image.src;

  try {
    var conversionCanvas = document.createElement("canvas");
    conversionCanvas.width = image.naturalWidth || image.width || 160;
    conversionCanvas.height = image.naturalHeight || image.height || 160;
    var context = conversionCanvas.getContext("2d");
    if (!context) return null;
    context.drawImage(image, 0, 0, conversionCanvas.width, conversionCanvas.height);
    var source = conversionCanvas.toDataURL("image/png");
    return /^data:image\/png(?:;|,)/i.test(source) ? source : null;
  } catch (error) {
    return null;
  }
}

function setDownloadAvailability(button, available) {
  if (!button) return;
  button.disabled = !available;
  button.setAttribute("aria-disabled", String(!available));
}

function qrConstructor() {
  if (window && typeof window.QRCode === "function") return window.QRCode;
  if (typeof QRCode === "function") return QRCode;
  return null;
}

function wireQRCode(find, canonicalURL) {
  var qrContainer = document.getElementById("qrCodeCanvas");
  var qrStatus = document.getElementById("qrStatus");
  var qrRetryBtn = document.getElementById("qrRetryBtn");
  var qrDownloadBtn = document.getElementById("qrDownloadBtn");

  if (!qrContainer || !qrStatus || !qrDownloadBtn) return;

  function outputElements() {
    return {
      canvas: qrContainer.querySelector("canvas"),
      image: qrContainer.querySelector("img")
    };
  }

  function markOutputAccessible(output) {
    if (output.canvas && typeof output.canvas.setAttribute === "function") {
      output.canvas.setAttribute("role", "img");
      output.canvas.setAttribute("aria-label", "QR code for " + find.title);
    }
    if (output.image) {
      output.image.alt = "QR code for " + find.title;
    }
  }

  function showGenerationFailure() {
    setDownloadAvailability(qrDownloadBtn, false);
    qrStatus.textContent = "QR generation is temporarily unavailable. Use Copy Link instead.";
    if (qrRetryBtn) qrRetryBtn.hidden = false;
  }

  function renderQRCode() {
    qrContainer.innerHTML = "";
    qrStatus.textContent = "";
    setDownloadAvailability(qrDownloadBtn, false);
    if (qrRetryBtn) qrRetryBtn.hidden = true;

    var Constructor = qrConstructor();
    if (!Constructor) {
      showGenerationFailure();
      return;
    }

    try {
      new Constructor(qrContainer, {
        text: canonicalURL,
        width: 160,
        height: 160,
        colorDark: "#2c2c2c",
        colorLight: "#ffffff"
      });
    } catch (error) {
      showGenerationFailure();
      return;
    }

    var output = outputElements();
    if (!output.canvas && !output.image) {
      showGenerationFailure();
      return;
    }

    markOutputAccessible(output);
    setDownloadAvailability(qrDownloadBtn, true);
    qrStatus.textContent = "QR code ready for scanning.";
  }

  if (qrRetryBtn) {
    qrRetryBtn.addEventListener("click", renderQRCode);
  }

  qrDownloadBtn.addEventListener("click", function () {
    var output = outputElements();
    var pngSource = null;

    try {
      if (output.canvas && typeof output.canvas.toDataURL === "function") {
        var canvasSource = output.canvas.toDataURL("image/png");
        if (/^data:image\/png(?:;|,)/i.test(canvasSource)) {
          pngSource = canvasSource;
        }
      }
    } catch (error) {
      pngSource = null;
    }

    if (!pngSource && output.image) {
      pngSource = pngSourceFromImage(output.image);
    }

    if (pngSource) {
      var link = document.createElement("a");
      link.download = "between-us-" + find.publicId + "-qr.png";
      link.href = pngSource;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      qrStatus.textContent = "QR download prepared.";
      return;
    }

    if (output.image && validImageURL(output.image.src)) {
      var fallbackLink = document.createElement("a");
      fallbackLink.href = output.image.src;
      fallbackLink.target = "_blank";
      fallbackLink.rel = "noopener";
      document.body.appendChild(fallbackLink);
      fallbackLink.click();
      document.body.removeChild(fallbackLink);
      qrStatus.textContent = "A PNG download could not be prepared. The QR image was opened so you can save it.";
      return;
    }

    qrStatus.textContent = "The QR download could not be prepared. Use Copy Link instead.";
  });

  renderQRCode();
}

function updateCanonicalMetadata(canonicalURL) {
  var canonicalLink = document.getElementById("canonicalLink");
  if (!canonicalLink) return;

  if (canonicalURL) {
    canonicalLink.setAttribute("href", canonicalURL);
  } else if (typeof canonicalLink.removeAttribute === "function") {
    canonicalLink.removeAttribute("href");
  } else {
    canonicalLink.setAttribute("href", "");
  }
}

function renderFindDetail(loadResult) {
  var detail = document.getElementById("itemDetail");
  var availabilityStatus = document.getElementById("catalogAvailabilityStatus");
  if (availabilityStatus) {
    availabilityStatus.textContent = loadResult && loadResult.message ? loadResult.message : "";
    availabilityStatus.hidden = !availabilityStatus.textContent;
  }

  if (!detail) return;

  var permalinks = window.BETWEEN_US_PERMALINKS;
  var find = null;
  var canonicalURL = null;

  if (
    permalinks &&
    typeof permalinks.findByRoute === "function" &&
    typeof permalinks.currentCanonicalUrl === "function"
  ) {
    find = permalinks.findByRoute(window.location);
    canonicalURL = permalinks.currentCanonicalUrl(window.location);
  }

  if (!find || !canonicalURL) {
    updateCanonicalMetadata(null);
    document.title = "Find not found | Between Us Finds";
    detail.innerHTML =
      '<div class="not-found-state" role="status">' +
        '<p class="eyebrow">Between Us Finds</p>' +
        '<h1>Find not found.</h1>' +
        '<p>This Find may no longer be available, or the link may be incomplete.</p>' +
        '<a class="button button-primary" href="index.html#explore">Back to Explore</a>' +
      '</div>';
  } else {
    updateCanonicalMetadata(canonicalURL);
    document.title = find.title + " | Between Us Finds";

    var photos = orderedUsablePhotos(find);
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
          reservationHTML(find, canonicalURL) +
        '</div>' +
      '</article>' +
      '<div class="detail-utilities">' +
        sharingHTML(canonicalURL) +
        qrHTML() +
      '</div>' +
      relatedHTML(find);

    wireGallery(find, photos, detail);
    wireReservation(find, canonicalURL);
    wireGeneralSharing(find, canonicalURL);
    wireQRCode(find, canonicalURL);
  }
}

var initialPermalinks = window.BETWEEN_US_PERMALINKS;
var initialFind = initialPermalinks && typeof initialPermalinks.findByRoute === "function"
  ? initialPermalinks.findByRoute(window.location)
  : null;
var publicCatalogReady = window.BETWEEN_US_PUBLIC_CATALOG &&
  window.BETWEEN_US_PUBLIC_CATALOG.ready;

// Static routes render without waiting for the network. Remote routes resolve
// independently after the bounded public-catalog request.
if (initialFind || !publicCatalogReady || typeof publicCatalogReady.then !== "function") {
  renderFindDetail({ message: "" });
}
if (publicCatalogReady && typeof publicCatalogReady.then === "function") {
  publicCatalogReady.then(renderFindDetail);
}
