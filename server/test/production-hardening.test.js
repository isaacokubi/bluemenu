import test from "node:test";
import assert from "node:assert/strict";
import { Room,RestaurantTable,OfflineEvent,PaymentTransaction,CampaignSettlement,Campaign,Location } from "../src/models/index.js";

const hasUniqueIndex=(model,fields)=>model.schema.indexes().some(([keys,options])=>options.unique===true&&Object.keys(keys).join(",")===fields.join(","));

test("hotel rooms and restaurant tables have lock-version fields",()=>{
  assert.ok(Room.schema.path("lockVersion"));
  assert.ok(RestaurantTable.schema.path("lockVersion"));
});

test("offline event IDs are unique per organization and user",()=>{
  assert.equal(hasUniqueIndex(OfflineEvent,["organization","user","eventId"]),true);
});

test("M-Pesa callback ledger is unique by checkout ID and receipt",()=>{
  assert.equal(hasUniqueIndex(PaymentTransaction,["checkoutRequestId"]),true);
  assert.equal(hasUniqueIndex(PaymentTransaction,["receipt"]),true);
});

test("sponsored campaigns support moderation and one settlement ledger",()=>{
  assert.ok(Campaign.schema.path("reviewStatus"));
  assert.equal(hasUniqueIndex(CampaignSettlement,["campaign"]),true);
  assert.ok(Location.schema.path("adRevenueSharePercent"));
  assert.ok(Location.schema.path("adPayoutPhone"));
});
