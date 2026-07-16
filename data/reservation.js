// Configurable boundary for the manual Reserve by Message experience.
// No contact recipient is configured or implied by this static catalog.

window.BETWEEN_US_RESERVATION = Object.freeze({
  channel: "share",
  messageTemplate: "Hello, I’m interested in reserving {title} ({publicId}) from Between Us. Is it still available?",
  includeUrl: true,
  manualConfirmation: true,
  paymentMethod: "cash",
  pickupMode: "local-arrangement"
});
