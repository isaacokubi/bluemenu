import test from "node:test";
import assert from "node:assert/strict";
import {fcmConfigured} from "../src/services/fcm.js";

test("Firebase push stays disabled until a complete service account is configured",()=>{
 const previous=process.env.FCM_SERVICE_ACCOUNT_JSON;
 try{
  delete process.env.FCM_SERVICE_ACCOUNT_JSON;
  assert.equal(fcmConfigured(),false);
  process.env.FCM_SERVICE_ACCOUNT_JSON=JSON.stringify({project_id:"demo",client_email:"firebase@example.test",private_key:"not-a-real-key"});
  assert.equal(fcmConfigured(),true);
  process.env.FCM_SERVICE_ACCOUNT_JSON="{invalid";
  assert.equal(fcmConfigured(),false);
 }finally{if(previous===undefined)delete process.env.FCM_SERVICE_ACCOUNT_JSON;else process.env.FCM_SERVICE_ACCOUNT_JSON=previous;}
});
