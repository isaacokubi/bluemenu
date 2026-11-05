export function isSafeInformationUrl(value) {
  const url = String(value || "").trim();
  if (!url) return true;
  if (/^https:\/\/[^\s]+$/i.test(url)) return true;
  return /^\/(?!\/)/.test(url) && !url.includes("\\") && !/[\r\n]/.test(url);
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
