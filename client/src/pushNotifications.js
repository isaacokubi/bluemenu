import { getApp, getApps, initializeApp } from "@firebase/app";
import { getMessaging, getToken, isSupported, onMessage } from "@firebase/messaging";

export async function enablePushNotifications(accessToken) {
  if (!accessToken || !("Notification" in window) || !("serviceWorker" in navigator)) return null;
  if (!(await isSupported())) return null;
  const configResponse = await fetch("/api/push/config");
  if (!configResponse.ok) throw new Error("Firebase web push is not configured on the server");
  const { firebase, vapidKey } = await configResponse.json();
  if (!firebase?.apiKey || !firebase?.projectId || !firebase?.messagingSenderId || !firebase?.appId || !vapidKey) return null;
  const app = getApps().length ? getApp() : initializeApp(firebase);
  const messaging = getMessaging(app);
  const permission = Notification.permission === "default" ? await Notification.requestPermission() : Notification.permission;
  if (permission !== "granted") return null;
  const registration = await navigator.serviceWorker.register("/firebase-messaging-sw.js");
  const token = await getToken(messaging, { vapidKey, serviceWorkerRegistration: registration });
  if (!token) return null;
  const response = await fetch("/api/push/register", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + accessToken },
    body: JSON.stringify({ token, platform: "web" })
  });
  if (!response.ok) throw new Error("Unable to register this browser for push notifications");
  const unsubscribe = onMessage(messaging, payload => {
    const title = payload.notification?.title || "BlueMenu";
    const body = payload.notification?.body || "You have a new workspace update.";
    if (Notification.permission === "granted") new Notification(title, { body, icon: "/favicon.ico" });
  });
  return () => {
    unsubscribe();
    fetch("/api/push/register", {
      method: "DELETE",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + accessToken },
      body: JSON.stringify({ token })
    }).catch(() => {});
  };
}
