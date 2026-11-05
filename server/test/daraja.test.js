import test from "node:test";
import assert from "node:assert/strict";
import { normalizePhone, verifyDarajaCallback } from "../src/services/daraja.js";

test("normalizes Kenyan mobile numbers to international format", () => {
  assert.equal(normalizePhone("0707 476 586"), "254707476586");
  assert.equal(normalizePhone("+254 708 374 149"), "254708374149");
  assert.equal(normalizePhone("708374149"), "254708374149");
});

test("rejects malformed or non-Kenyan phone numbers", () => {
  assert.equal(normalizePhone("12345"), null);
  assert.equal(normalizePhone("+255712345678"), null);
  assert.equal(normalizePhone(""), null);
});

test("extracts a successful Daraja callback without trusting missing metadata", () => {
  const result = verifyDarajaCallback({
    Body: { stkCallback: {
      CheckoutRequestID: "ws_CO_123",
      ResultCode: 0,
      ResultDesc: "The service request is processed successfully.",
      CallbackMetadata: { Item: [
        { Name: "Amount", Value: 850 },
        { Name: "MpesaReceiptNumber", Value: "QAB123XYZ" },
        { Name: "PhoneNumber", Value: 254708374149 }
      ] }
    } }
  });
  assert.equal(result.checkoutRequestId, "ws_CO_123");
  assert.equal(result.resultCode, 0);
  assert.equal(result.amount, 850);
  assert.equal(result.receipt, "QAB123XYZ");
  assert.equal(result.phone, "254708374149");
});

test("rejects callbacks without a checkout identifier or valid result code", () => {
  assert.equal(verifyDarajaCallback({ Body: { stkCallback: { ResultCode: 0 } } }), null);
  assert.equal(verifyDarajaCallback({ Body: { stkCallback: { CheckoutRequestID: "x", ResultCode: "not-a-code" } } }), null);
});

test("requires an HTTPS callback and all required Daraja settings", async () => {
  const { darajaConfigurationError } = await import("../src/services/daraja.js");
  const base = {
    DARAJA_CONSUMER_KEY: "key",
    DARAJA_CONSUMER_SECRET: "secret",
    DARAJA_SHORTCODE: "174379",
    DARAJA_PASSKEY: "passkey",
    DARAJA_CALLBACK_URL: "https://api.example.com/api/payments/daraja/callback"
  };
  assert.equal(darajaConfigurationError(base), null);
  assert.match(darajaConfigurationError({ ...base, DARAJA_CALLBACK_URL: "http://localhost:5000/callback" }), /HTTPS/);
  assert.match(darajaConfigurationError({ ...base, DARAJA_TRANSACTION_TYPE: "CustomerBuyGoodsOnline" }), /DARAJA_TILL_NUMBER/);
  assert.equal(darajaConfigurationError({ ...base, DARAJA_TRANSACTION_TYPE: "CustomerBuyGoodsOnline", DARAJA_TILL_NUMBER: "123456" }), null);
});

test("rejects negative Daraja result codes", () => {
  assert.equal(verifyDarajaCallback({ Body: { stkCallback: { CheckoutRequestID: "x", ResultCode: -1 } } }), null);
});
