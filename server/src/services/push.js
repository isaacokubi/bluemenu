import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";
import { DeviceToken } from "../models/index.js";

function firebaseApp() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON || (process.env.FIREBASE_SERVICE_ACCOUNT_BASE64 ? Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64, "base64").toString("utf8") : "");
  if (!raw) return null;
  let serviceAccount;
  try { serviceAccount = JSON.parse(raw); } catch { throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON must contain valid service-account JSON"); }
  if (serviceAccount.private_key) serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, "\n");
  return getApps()[0] || initializeApp({ credential: cert(serviceAccount), projectId: serviceAccount.project_id });
}

export async function sendOrganizationPush({ organization, user = null, title, body, data = {} }) {
  const app = firebaseApp();
  if (!app) return { configured: false, sent: 0, failed: 0 };
  const filter = { organization, active: true, ...(user ? { user } : {}) };
  const devices = await DeviceToken.find(filter).limit(500).lean();
  if (!devices.length) return { configured: true, sent: 0, failed: 0 };
  const messaging = getMessaging(app);
  let sent = 0, failed = 0;
  for (let i = 0; i < devices.length; i += 500) {
    const batch = devices.slice(i, i + 500);
    const response = await messaging.sendEachForMulticast({
      tokens: batch.map(item => item.token),
      notification: { title, body },
      data: Object.fromEntries(Object.entries(data).map(([key, value]) => [key, String(value)])),
      android: { priority: "high", notification: { channelId: "bluemenu_updates" } },
      webpush: { notification: { title, body, icon: "/favicon.ico" } }
    });
    sent += response.successCount;
    failed += response.failureCount;
    const invalid = [];
    response.responses.forEach((item, index) => {
      if (!item.success && ["messaging/invalid-registration-token", "messaging/registration-token-not-registered"].includes(item.error?.code)) invalid.push(batch[index]._id);
    });
    if (invalid.length) await DeviceToken.updateMany({ _id: { $in: invalid } }, { $set: { active: false } });
  }
  return { configured: true, sent, failed };
}
