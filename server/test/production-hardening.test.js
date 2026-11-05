import test from "node:test";
import assert from "node:assert/strict";
import { RoomNight,TableSlot,OfflineEvent,PaymentTransaction,DeviceToken,Reservation,TableBooking,Campaign,CampaignSettlement } from "../src/models/index.js";

const uniqueIndex = (model, fields) => model.schema.indexes().some(([keys, options]) =>
  options.unique === true && Object.keys(keys).join(",") === fields.join(",")
);

test("room-night allocations enforce one reservation per room per night", () => {
  assert.equal(uniqueIndex(RoomNight, ["room", "night"]), true);
  assert.ok(Reservation.schema.path("assignedRooms"));
});

test("restaurant table holds have a unique location and half-hour slot key", () => {
  assert.equal(uniqueIndex(TableSlot, ["location", "slotStart"]), true);
  assert.ok(TableBooking.schema.path("capacityHeld"));
  assert.ok(TableBooking.schema.path("capacitySlot"));
});

test("offline replay event IDs are unique per organization and authenticated user", () => {
  assert.equal(uniqueIndex(OfflineEvent, ["organization", "user", "eventId"]), true);
  assert.ok(OfflineEvent.schema.path("state"));
  assert.ok(OfflineEvent.schema.path("leaseUntil"));
});

test("payment and push token identifiers cannot be reused across records", () => {
  assert.equal(uniqueIndex(PaymentTransaction, ["checkoutRequestId"]), true);
  assert.equal(uniqueIndex(PaymentTransaction, ["receipt"]), true);
  assert.equal(uniqueIndex(DeviceToken, ["token"]), true);
});

test("sponsored campaigns require a paid state and moderation state", () => {
  assert.ok(Campaign.schema.path("paymentStatus"));
  assert.ok(Campaign.schema.path("reviewStatus"));
  assert.ok(Campaign.schema.path("checkoutRequestId"));
  assert.equal(uniqueIndex(CampaignSettlement, ["campaign"]), true);
});
