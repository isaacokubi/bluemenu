import crypto from "node:crypto";
import { DeviceToken } from "../models/index.js";

let cachedAccessToken = null;
let cachedTokenExpiresAt = 0;

function serviceAccount() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON || (process.env.FIREBASE_SERVICE_ACCOUNT_BASE64 ? Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64, "base64").toString("utf8") : "");
  if (!raw) return null;
  let account;
  try { account = JSON.parse(raw); } catch { throw new Error("FIREBASE_SERVICE_ACCOUNT_BASE64 must decode to valid service-account JSON"); }
  if (!account.client_email || !account.private_key || !account.project_id) throw new Error("Firebase service account is missing client_email, private_key or project_id");
  account.private_key = account.private_key.replace(/\\n/g, "\n");
  return account;
}

function base64url(value) {
  return Buffer.from(value).toString("base64url");
}

async function firebaseAccessToken(account) {
  if (cachedAccessToken && cachedTokenExpiresAt > Date.now() + 60000) return cachedAccessToken;
  const now = Math.floor(Date.now() / 1000);
  const unsigned = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" })) + "." +
    base64url(JSON.stringify({ iss: account.client_email, scope: "https://www.googleapis.com/auth/firebase.messaging", aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600 }));
  const signer = crypto.createSign("RSA-SHA256");
  signer.update(unsigned);
  signer.end();
  const assertion = unsigned + "." + signer.sign(account.private_key, "base64url");
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }),
    signal: AbortSignal.timeout(15000)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.access_token) throw new Error(data.error_description || "Unable to obtain Firebase messaging access token");
  cachedAccessToken = data.access_token;
  cachedTokenExpiresAt = Date.now() + Number(data.expires_in || 3600) * 1000;
  return cachedAccessToken;
}

export async function sendOrganizationPush({ organization, user = null, title, body, data = {} }) {
  const account = serviceAccount();
  if (!account) return { configured: false, sent: 0, failed: 0 };
  const filter = { organization, active: true, ...(user ? { user } : {}) };
  const devices = await DeviceToken.find(filter).limit(500).lean();
  if (!devices.length) return { configured: true, sent: 0, failed: 0 };
  const accessToken = await firebaseAccessToken(account);
  let sent = 0, failed = 0;
  for (let i = 0; i < devices.length; i += 20) {
    const batch = devices.slice(i, i + 20);
    const outcomes = await Promise.all(batch.map(async device => {
      try {
        const response = await fetch("https://fcm.googleapis.com/v1/projects/" + encodeURIComponent(account.project_id) + "/messages:send", {
          method: "POST",
          headers: { Authorization: "Bearer " + accessToken, "Content-Type": "application/json" },
          body: JSON.stringify({ message: {
            token: device.token,
            notification: { title, body },
            data: Object.fromEntries(Object.entries(data).map(([key, value]) => [key, String(value)])),
            android: { priority: "HIGH", notification: { channel_id: "bluemenu_updates" } },
            webpush: { notification: { title, body, icon: "/favicon.ico" } }
          } }),
          signal: AbortSignal.timeout(15000)
        });
        const result = await response.json().catch(() => ({}));
        if (response.ok) return { success: true };
        const code = result.error?.details?.find(item => item.errorCode)?.errorCode || result.error?.status;
        if (["UNREGISTERED", "INVALID_ARGUMENT"].includes(code)) await DeviceToken.updateOne({ _id: device._id }, { $set: { active: false } });
        return { success: false };
      } catch (error) {
        console.warn("FCM send failed:", error.message);
        return { success: false };
      }
    }));
    sent += outcomes.filter(item => item.success).length;
    failed += outcomes.filter(item => !item.success).length;
  }
  return { configured: true, sent, failed };
}
