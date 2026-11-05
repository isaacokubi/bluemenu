import test from "node:test";
import assert from "node:assert/strict";
import {normalizeCustomerPhone,validateTransportRoute} from "../src/services/ecosystemValidation.js";
test("normalizes Kenyan mobile numbers",()=>{assert.equal(normalizeCustomerPhone("0707476586"),"254707476586");assert.equal(normalizeCustomerPhone("+254 708 374 149"),"254708374149");assert.equal(normalizeCustomerPhone("123"),null);});
test("accepts valid transport schedules and sorts stops",()=>{const result=validateTransportRoute({name:"Town shuttle",origin:"CBD",destination:"Airport",stops:[{name:"Airport",order:2},{name:"CBD",order:1}],departures:[{daysOfWeek:[1,2,3],departureTime:"08:30",fareKES:250}]});assert.equal(result.valid,true);assert.equal(result.value.stops[0].name,"CBD");});
test("rejects invalid transport times, weekdays and fares",()=>{for(const departure of [{daysOfWeek:[1],departureTime:"25:00",fareKES:1},{daysOfWeek:[7],departureTime:"08:00",fareKES:1},{daysOfWeek:[1],departureTime:"08:00",fareKES:-1}])assert.equal(validateTransportRoute({name:"R",origin:"A",destination:"B",departures:[departure]}).valid,false);});
test("requires route endpoints and bounded stop data",()=>{assert.equal(validateTransportRoute({name:"R"}).valid,false);assert.equal(validateTransportRoute({name:"R",origin:"A",destination:"B",stops:[{name:""}]}).valid,false);});
