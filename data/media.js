// Authoritative registry for local media paths known to be unavailable.
// Find records keep their approved paths; renderers consult this registry so
// the browser does not make preventable requests for known missing files.

var betweenUsUnavailableMediaPaths = Object.freeze([
  "assets/images/placeholder-ring-silver.jpg",
  "assets/images/placeholder-earrings-pearl.jpg"
]);

function isUnavailableMedia(path) {
  return betweenUsUnavailableMediaPaths.indexOf(path) !== -1;
}

window.BETWEEN_US_MEDIA = Object.freeze({
  unavailablePaths: betweenUsUnavailableMediaPaths,
  isUnavailable: isUnavailableMedia
});
