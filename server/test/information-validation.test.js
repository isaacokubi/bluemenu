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


test("lost-and-found submissions validate and normalize contact details", async () => {
  const { validateLostFoundSubmission } = await import("../src/services/informationValidation.js");
  assert.equal(validateLostFoundSubmission({title:"Found wallet",body:"Near reception",contactPhone:"0707 476 586",recordType:"found"}).valid,true);
  assert.equal(validateLostFoundSubmission({title:"Found wallet",body:"Near reception",contactPhone:"not-a-phone"}).valid,false);
  assert.equal(validateLostFoundSubmission({title:"  Lost keys  ",body:"  At the library  ",contactPhone:"+254708374149"}).value.title,"Lost keys");
});

test("directory and lost-and-found metadata is allow-listed and bounded", async () => {
  const { sanitizeInformationMetadata } = await import("../src/services/informationValidation.js");
  const directory=sanitizeInformationMetadata({category:"Office",office:"Admissions",unexpected:"private"},"directory");
  assert.equal(directory.office,"Admissions");
  assert.equal("unexpected" in directory,false);
  const lost=sanitizeInformationMetadata({recordType:"invalid",itemStatus:"invalid",claimStatus:"invalid",claimNotes:"x".repeat(900)},"lost_found");
  assert.equal(lost.recordType,"lost");
  assert.equal(lost.itemStatus,"open");
  assert.equal(lost.claimStatus,"none");
  assert.equal(lost.claimNotes.length,500);
});
