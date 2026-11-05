importScripts("https://www.gstatic.com/firebasejs/11.0.2/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/11.0.2/firebase-messaging-compat.js");

const firebaseConfigPromise = fetch("/api/push/config")
  .then(response => response.ok ? response.json() : Promise.reject(new Error("Firebase config unavailable")))
  .then(({ firebase }) => {
    if (!firebase?.apiKey || !firebase?.projectId) throw new Error("Firebase web messaging is not configured");
    firebase.initializeApp(firebase);
    const messaging = firebase.messaging();
    messaging.onBackgroundMessage(payload => {
      const title = payload.notification?.title || "BlueMenu";
      const options = {
        body: payload.notification?.body || "You have a new workspace update.",
        icon: "/favicon.ico",
        data: payload.data || {}
      };
      self.registration.showNotification(title, options);
    });
  });

self.addEventListener("install", event => event.waitUntil(firebaseConfigPromise));
self.addEventListener("activate", event => event.waitUntil(self.clients.claim()));
self.addEventListener("notificationclick", event => {
  event.notification.close();
  event.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(windows => {
    const existing = windows.find(client => "focus" in client);
    if (existing) return existing.focus();
    return self.clients.openWindow("/");
  }));
});
