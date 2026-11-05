import test from "node:test";
import assert from "node:assert/strict";
import { Room,RestaurantTable,OfflineEvent,PaymentTransaction,CampaignSettlement,Campaign,Location } from "../src/models/index.js";

const hasUniqueIndex=(model,fields)=>model.schema.indexes().some(([keys,options])=>options.unique===true&&Object.keys(keys).join(",")===fields.join(","));

test("hotel and restaurant inventory expose write-lock versions",()=>{
  assert.ok(Room.schema.path("lockVersion"));
  assert.ok(RestaurantTable.schema.path("lockVersion"));
});

test("offline event replay is unique per organization and user",()=>{
  assert.equal(hasUniqueIndex(OfflineEvent,["organization","user","eventId"]),true);
});

test("M-Pesa payment ledger is idempotent by checkout and receipt",()=>{
  assert.equal(hasUniqueIndex(PaymentTransaction,["checkoutRequestId"]),true);
  assert.equal(hasUniqueIndex(PaymentTransaction,["receipt"]),true);
});

test("paid sponsored campaigns support moderation and a unique publisher settlement",()=>{
  assert.ok(Campaign.schema.path("reviewStatus"));
  assert.equal(hasUniqueIndex(CampaignSettlement,["campaign"]),true);
  assert.ok(Location.schema.path("adRevenueSharePercent"));
  assert.ok(Location.schema.path("adPayoutPhone"));
});
