import test from "node:test";
import assert from "node:assert/strict";
import { isSafeInformationUrl, parsePublicationWindow } from "../src/services/informationValidation.js";

test("information links allow HTTPS and single-slash internal paths", () => {
  assert.equal(isSafeInformationUrl("https://example.com/resource.pdf"), true);
  assert.equal(isSafeInformationUrl("/documents/policy.pdf"), true);
  assert.equal(isSafeInformationUrl(""), true);
});

test("information links reject executable and protocol-relative URLs", () => {
  assert.equal(isSafeInformationUrl("javascript:alert(1)"), false);
  assert.equal(isSafeInformationUrl("data:text/html,hello"), false);
  assert.equal(isSafeInformationUrl("//evil.example/file"), false);
  assert.equal(isSafeInformationUrl("/\\\\evil.example"), false);
});

test("publication windows accept optional dates and ordered ranges", () => {
  assert.equal(parsePublicationWindow("", "").valid, true);
  assert.equal(parsePublicationWindow("2026-11-05T08:00:00Z", "2026-11-06T08:00:00Z").valid, true);
});

test("publication windows reject invalid and reversed dates", () => {
  assert.equal(parsePublicationWindow("not-a-date", "").valid, false);
  assert.equal(parsePublicationWindow("2026-11-07", "2026-11-06").valid, false);
});
