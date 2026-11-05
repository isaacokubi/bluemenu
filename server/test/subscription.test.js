import test from "node:test";
import assert from "node:assert/strict";
import { PLAN_CATALOG } from "../src/models/Subscription.js";

test("publishes the proposal's KES subscription prices and starter quotas",()=>{
 assert.equal(PLAN_CATALOG.starter.monthly,500);
 assert.equal(PLAN_CATALOG.business.monthly,1500);
 assert.equal(PLAN_CATALOG.professional.monthly,3500);
 assert.equal(PLAN_CATALOG.starter.limits.locations,1);
 assert.equal(PLAN_CATALOG.business.limits.locations,3);
 assert.equal(PLAN_CATALOG.professional.limits.locations,10);
 assert.equal(PLAN_CATALOG.enterprise.monthly,null);
});
test("all self-service plans have a yearly price and useful product features",()=>{
 for(const id of ["starter","business","professional"]){
  assert.ok(PLAN_CATALOG[id].annual>0);
  assert.ok(PLAN_CATALOG[id].features.length>0);
  for(const value of Object.values(PLAN_CATALOG[id].limits))assert.ok(Number.isInteger(value)&&value>0);
 }
 assert.equal(PLAN_CATALOG.enterprise.limits.locations,null);
});
