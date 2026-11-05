const DATABASE = "bluemenu-offline";
const STORE = "commands";

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: "eventId" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function withStore(mode, action) {
  const db = await openDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE, mode);
      const store = transaction.objectStore(STORE);
      const result = action(store);
      transaction.oncomplete = () => resolve(result?.result ?? result);
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error || new Error("Offline queue transaction aborted"));
    });
  } finally {
    db.close();
  }
}

export async function queueOfflineCommand(eventType, payload) {
  if (!("indexedDB" in window)) throw new Error("This browser does not support durable offline storage");
  const eventId = crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + "-" + Math.random().toString(36).slice(2);
  const event = { eventId, eventType, payload, state: "queued", createdAt: new Date().toISOString() };
  await withStore("readwrite", store => store.add(event));
  return event;
}

export async function getOfflineQueue() {
  return withStore("readonly", store => store.getAll());
}

export async function flushOfflineQueue(accessToken) {
  if (!accessToken || !navigator.onLine) return { processed: 0, failed: 0, pending: 0 };
  const events = (await getOfflineQueue()).filter(item => item.state === "queued");
  let processed = 0, failed = 0;
  for (let offset = 0; offset < events.length; offset += 100) {
    const batch = events.slice(offset, offset + 100);
    const response = await fetch("/api/workspace/offline-sync", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + accessToken },
      body: JSON.stringify({ events: batch.map(({ eventId, eventType, payload }) => ({ eventId, eventType, payload })) })
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || "Offline changes could not be synchronized");
    for (const result of body.results || []) {
      if (["processed", "duplicate"].includes(result.status)) {
        await withStore("readwrite", store => store.delete(result.eventId));
        processed++;
      } else if (result.status === "rejected") {
        await withStore("readwrite", store => store.put({ ...batch.find(item => item.eventId === result.eventId), state: "failed", error: result.reason || "Rejected" }));
        failed++;
      }
    }
  }
  const remaining = await getOfflineQueue();
  return { processed, failed, pending: remaining.filter(item => item.state === "queued").length };
}
