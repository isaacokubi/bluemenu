const isBuyGoods = () => process.env.DARAJA_TRANSACTION_TYPE === "CustomerBuyGoodsOnline";
export function normalizePhone(value) {
  let phone = String(value || "").replace(/\D/g, "");
  if (phone.startsWith("0")) phone = "254" + phone.slice(1);
  if (phone.startsWith("7") || phone.startsWith("1")) phone = "254" + phone;
  return /^254[17]\d{8}$/.test(phone) ? phone : null;
}

export function darajaConfigurationError(env = process.env) {
  const required = ["DARAJA_CONSUMER_KEY", "DARAJA_CONSUMER_SECRET", "DARAJA_SHORTCODE", "DARAJA_PASSKEY", "DARAJA_CALLBACK_URL"];
  const missing = required.filter(key => !String(env[key] || "").trim());
  if (env.DARAJA_TRANSACTION_TYPE === "CustomerBuyGoodsOnline" && !String(env.DARAJA_TILL_NUMBER || "").trim()) missing.push("DARAJA_TILL_NUMBER");
  if (missing.length) return "M-Pesa configuration is incomplete. Missing: " + missing.join(", ") + ".";
  try {
    const callback = new URL(env.DARAJA_CALLBACK_URL);
    if (callback.protocol !== "https:") return "DARAJA_CALLBACK_URL must be a publicly reachable HTTPS URL.";
  } catch {
    return "DARAJA_CALLBACK_URL must be a valid HTTPS URL.";
  }
  return null;
}

function kenyaTimestamp() {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Nairobi", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).formatToParts(new Date());
  const value = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return value.year + value.month + value.day + value.hour + value.minute + value.second;
}

async function parseProviderResponse(response, fallback) {
  let data;
  try { data = await response.json(); } catch { throw new Error(fallback + " (provider returned an invalid response)"); }
  if (!response.ok) throw new Error(data.errorMessage || data.error || data.ResponseDescription || fallback);
  return data;
}

async function accessToken() {
  const base = process.env.DARAJA_ENV === "production" ? "https://api.safaricom.co.ke" : "https://sandbox.safaricom.co.ke";
  const auth = Buffer.from(process.env.DARAJA_CONSUMER_KEY + ":" + process.env.DARAJA_CONSUMER_SECRET).toString("base64");
  const response = await fetch(base + "/oauth/v1/generate?grant_type=client_credentials", {
    headers: { Authorization: "Basic " + auth },
    signal: AbortSignal.timeout(15000)
  });
  const data = await parseProviderResponse(response, "Unable to authenticate with Daraja");
  if (!data.access_token) throw new Error(data.errorMessage || "Daraja did not return an access token");
  return { token: data.access_token, base };
}

export async function initiateStkPush({ phone, amount, accountReference, transactionDesc }) {
  const configurationError = darajaConfigurationError();
  if (configurationError) throw new Error(configurationError);
  const normalized = normalizePhone(phone);
  if (!normalized) throw new Error("Enter a valid Kenyan M-Pesa number, such as 07XXXXXXXX");
  const value = Math.round(Number(amount));
  if (!Number.isSafeInteger(value) || value < 1) throw new Error("M-Pesa amount must be a positive whole number");
  const { token, base } = await accessToken();
  const timestamp = kenyaTimestamp();
  const shortcode = process.env.DARAJA_SHORTCODE;
  const buyGoods = isBuyGoods();
  const payload = {
    BusinessShortCode: shortcode,
    Password: Buffer.from(shortcode + process.env.DARAJA_PASSKEY + timestamp).toString("base64"),
    Timestamp: timestamp,
    TransactionType: buyGoods ? "CustomerBuyGoodsOnline" : "CustomerPayBillOnline",
    Amount: value,
    PartyA: normalized,
    PartyB: buyGoods ? process.env.DARAJA_TILL_NUMBER : shortcode,
    PhoneNumber: normalized,
    CallBackURL: process.env.DARAJA_CALLBACK_URL,
    AccountReference: String(accountReference || "BlueMenu").slice(0, 12),
    TransactionDesc: String(transactionDesc || "BlueMenu order").slice(0, 13)
  };
  const response = await fetch(base + "/mpesa/stkpush/v1/processrequest", {
    method: "POST",
    headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(20000)
  });
  const data = await parseProviderResponse(response, "M-Pesa STK request failed");
  if (data.ResponseCode !== "0" || !data.CheckoutRequestID) throw new Error(data.errorMessage || data.ResponseDescription || "M-Pesa STK request failed");
  return {
    checkoutRequestId: data.CheckoutRequestID,
    merchantRequestId: data.MerchantRequestID,
    customerMessage: data.CustomerMessage || "Check your phone and enter your M-Pesa PIN"
  };
}

export async function queryStkPush(checkoutRequestId) {
  const configurationError = darajaConfigurationError();
  if (configurationError) throw new Error(configurationError);
  if (!/^ws_CO_[A-Za-z0-9]+$/.test(String(checkoutRequestId || ""))) throw new Error("Invalid Daraja checkout request ID");
  const { token, base } = await accessToken();
  const timestamp = kenyaTimestamp();
  const shortcode = process.env.DARAJA_SHORTCODE;
  const payload = {
    BusinessShortCode: shortcode,
    Password: Buffer.from(shortcode + process.env.DARAJA_PASSKEY + timestamp).toString("base64"),
    Timestamp: timestamp,
    CheckoutRequestID: checkoutRequestId
  };
  const response = await fetch(base + "/mpesa/stkpushquery/v1/query", {
    method: "POST",
    headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(20000)
  });
  return parseProviderResponse(response, "Daraja STK query failed");
}

export function verifyDarajaCallback(body) {
  const callback = body?.Body?.stkCallback;
  if (!callback?.CheckoutRequestID || !Number.isInteger(Number(callback.ResultCode)) || Number(callback.ResultCode) < 0) return null;
  const metadata = callback.CallbackMetadata?.Item || [];
  const value = name => metadata.find(item => item.Name === name)?.Value;
  return {
    checkoutRequestId: String(callback.CheckoutRequestID),
    resultCode: Number(callback.ResultCode),
    resultDescription: String(callback.ResultDesc || ""),
    receipt: value("MpesaReceiptNumber") ? String(value("MpesaReceiptNumber")) : null,
    amount: value("Amount") !== undefined ? Number(value("Amount")) : null,
    phone: value("PhoneNumber") !== undefined ? String(value("PhoneNumber")) : null
  };
}
