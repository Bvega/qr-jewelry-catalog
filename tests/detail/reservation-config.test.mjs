import assert from "node:assert/strict";
import test from "node:test";
import {
  APPROVED_RESERVATION_TEMPLATE,
  loadFindDetailRuntime
} from "../../scripts/lib/find-detail-contracts.mjs";

const { reservation, finds } = loadFindDetailRuntime();

test("reservation configuration exposes the exact approved boundary", () => {
  assert.deepEqual(Object.keys(reservation), [
    "channel",
    "messageTemplate",
    "includeUrl",
    "manualConfirmation",
    "paymentMethod",
    "pickupMode"
  ]);
  assert.ok(Object.isFrozen(reservation));
  assert.equal(reservation.channel, "share");
  assert.equal(reservation.messageTemplate, APPROVED_RESERVATION_TEMPLATE);
  assert.equal(reservation.includeUrl, true);
  assert.equal(reservation.manualConfirmation, true);
  assert.equal(reservation.paymentMethod, "cash");
  assert.equal(reservation.pickupMode, "local-arrangement");
});

test("approved template tokens resolve to the exact Find title and permanent public ID", () => {
  const find = finds[0];
  const message = reservation.messageTemplate
    .replace(/\{title\}/g, find.title)
    .replace(/\{publicId\}/g, find.publicId);

  assert.equal(
    message,
    "Hello, I’m interested in reserving Gold Twisted Rope Bracelet (BU-0001) from Between Us. Is it still available?"
  );
});

test("reservation configuration invents no contact recipient or destination", () => {
  for (const key of ["recipient", "phone", "email", "whatsapp", "messenger", "account", "address"]) {
    assert.equal(Object.hasOwn(reservation, key), false);
  }
  assert.equal(Object.values(reservation).some((value) => /@|tel:|mailto:|wa\.me/i.test(String(value))), false);
});
