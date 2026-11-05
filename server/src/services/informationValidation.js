export function isSafeInformationUrl(value) {
  const url = String(value || "").trim();
  if (!url) return true;
  if (/^https:\/\/[^\s]+$/i.test(url)) return true;
  return /^\/(?!\/)/.test(url) && !url.includes("\") && !/[\r\n]/.test(url);
}

export function parsePublicationWindow(startsAt, endsAt) {
  const start = startsAt ? new Date(startsAt) : undefined;
  const end = endsAt ? new Date(endsAt) : undefined;
  if ((startsAt && Number.isNaN(start.getTime())) ||
      (endsAt && Number.isNaN(end.getTime())) ||
      (start && end && end <= start)) {
    return { valid: false, start: undefined, end: undefined };
  }
  return { valid: true, start, end };
}

export function sanitizeInformationMetadata(input, type) {
  const value = input && typeof input === "object" && !Array.isArray(input) ? input : {};
  const fields = type === "directory"
    ? ["category", "contactName", "contactPhone", "email", "office", "building", "floor", "room", "openingHours", "website"]
    : ["category", "recordType", "itemStatus", "foundAt", "dateLost", "dateFound", "contactName", "contactPhone", "claimStatus", "claimantName", "claimantPhone", "claimNotes"];
  const output = {};
  for (const field of fields) {
    if (value[field] !== undefined) output[field] = String(value[field]).trim().slice(0, field === "claimNotes" ? 500 : 180);
  }
  if (type === "lost_found") {
    if (!["lost", "found"].includes(output.recordType)) output.recordType = "lost";
    if (!["open", "claim_requested", "returned", "closed"].includes(output.itemStatus)) output.itemStatus = "open";
    if (!["none", "requested", "approved", "rejected"].includes(output.claimStatus)) output.claimStatus = "none";
  }
  return output;
}

export function validateLostFoundSubmission(input = {}) {
  const title = String(input.title || "").trim().slice(0, 180);
  const body = String(input.body || "").trim().slice(0, 2000);
  const contactPhone = String(input.contactPhone || "").trim().slice(0, 25);
  const normalizedPhone = contactPhone.replace(/[\s()-]/g, "");
  if (!title || !body || !/^\+?\d{7,15}$/.test(normalizedPhone)) {
    return { valid: false, error: "Title, description and a valid contact phone number are required" };
  }
  return {
    valid: true,
    value: {
      title, body, contactPhone,
      recordType: ["lost", "found"].includes(input.recordType) ? input.recordType : "lost",
      category: String(input.category || "Other").trim().slice(0, 80),
      foundAt: String(input.foundAt || "").trim().slice(0, 180),
      dateLost: String(input.dateLost || "").trim().slice(0, 40),
      dateFound: String(input.dateFound || "").trim().slice(0, 40)
    }
  };
}
