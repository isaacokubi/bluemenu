# BlueMenu production readiness and pilot runbook

## Implemented in the production-readiness batch

- **Hotel room allocation:** confirming a reservation now allocates concrete room IDs inside a MongoDB transaction. Room lock-version writes serialize competing confirmations. Check-in is allowed only from confirmed; check-out only from checked-in. Room availability remains advisory until confirmation.
- **Restaurant table capacity:** table inventory can be created and maintained. Confirming a booking allocates one or more active tables whose combined seats fit the party, inside a transaction. The default reservation window is two hours.
- **Push delivery:** server uses Firebase Cloud Messaging HTTP v1 with a service-account JSON secret. Staff tokens can be registered through authenticated workspace routes. Android app obtains FCM tokens, associates them with a venue after beacon resolution, and registers them through the public venue endpoint. Push sends record sent/partial/failed status; invalid tokens are disabled.
- **Offline replay:** browser queue persists queue-ticket creation and meeting attendance check-ins. It retries on reconnect and has a manual sync control. The server idempotently replays supported commands in transactions: `queue.create`, `visitor.check_in`, `service_request.create`, `attendance.check_in`, `inventory.receive`, and `inventory.issue`. Inventory replay writes the stock movement and updates stock in the same transaction; stock issues are rejected if inventory is insufficient. Unsupported commands are rejected and reported; they are never silently accepted.
- **Background BLE:** Android now offers opt-in foreground-service scanning in low-power mode with a persistent notification and venue notifications. This is not guaranteed continuous scanning on every OEM/Android power policy; users can stop it.
- **Release signing:** CI can build a signed release APK when repository signing secrets and the production API URL variable exist. Debug builds continue without signing secrets.
- **M-Pesa subscriptions:** owners explicitly opt in to scheduled renewal STK prompts. A trusted scheduler calls the renewal endpoint; each renewal still requires the customer to enter their M-Pesa PIN. Successful callbacks are validated against checkout ID, amount, receipt and phone. This is not a silent merchant-initiated recurring debit.
- **Advertising marketplace:** paid campaigns can be created using a KES budget and Daraja STK Push. Campaign callback reconciliation validates amount, receipt and phone; sponsored campaigns require owner/manager moderation before publication. A payment ledger records successful and failed STK callbacks idempotently by checkout ID and receipt. Approved campaigns create a publisher settlement ledger with a configurable location revenue share, platform fee, payout phone and manual payout-reference reconciliation. The ledger does not initiate B2C transfers; those require separately approved Safaricom B2C credentials and compliance controls. Public campaign feeds hide unpaid budgeted campaigns.
- **AI:** menu translation (English, Kiswahili, French, Arabic, German) and menu pairing/upsell recommendations are available through authenticated AI endpoints. The existing meeting assistant remains available. Recommendations are generated from supplied menu data and are not sales/popularity analytics.

## Required configuration — never commit these values

### API service
Set these in the API hosting provider:
- `MONGODB_URI`: production MongoDB Atlas URI. Atlas replica-set transactions are required for booking allocation and offline command replay.
- `JWT_SECRET`: random secret with at least 32 characters.
- `CLIENT_ORIGIN`: comma-separated exact HTTPS origins for the deployed web app; no wildcard.
- `FCM_SERVICE_ACCOUNT_JSON`: one-line JSON for a Firebase service account with Firebase Cloud Messaging send permission.
- `OPENAI_API_KEY` and optionally `AI_MODEL`: menu translation and recommendations.
- `CRON_SECRET`: random secret used only by the renewal scheduler.
- `DARAJA_RECONCILE_SECRET`: independent random secret for the pending STK-query reconciliation endpoint.
- Daraja production values: `DARAJA_ENV=production`, `DARAJA_CONSUMER_KEY`, `DARAJA_CONSUMER_SECRET`, `DARAJA_SHORTCODE`, `DARAJA_PASSKEY`, `DARAJA_CALLBACK_URL=https://YOUR_API_DOMAIN/api/payments/daraja/callback`; for Buy Goods also set `DARAJA_TRANSACTION_TYPE=CustomerBuyGoodsOnline` and `DARAJA_TILL_NUMBER`. Safaricom must have the callback URL registered and the production app/shortcode approved.
- Cloudinary and Resend settings if media upload and account recovery are used.

### Firebase Android
1. Create/register Android app package `com.bluemenu.discovery` in Firebase.
2. Download its `google-services.json`, base64-encode it, and save it as GitHub Actions secret `FIREBASE_ANDROID_CONFIG_BASE64`.
3. Set `FCM_SERVICE_ACCOUNT_JSON` on the API service. Never commit the JSON file or service-account private key.
4. Build and install the APK, open a venue beacon once so its slug is stored, allow notifications, then send a test notification from the workspace. Android token registration is venue-scoped.

### Signed Android release
Create and securely back up an Android upload/release keystore. Add GitHub Actions repository secrets:
- `ANDROID_KEYSTORE_BASE64`
- `ANDROID_KEYSTORE_PASSWORD`
- `ANDROID_KEY_ALIAS`
- `ANDROID_KEY_PASSWORD`

Add repository variable `BLUEMENU_API_BASE_URL` with the production API origin (for example `https://api.example.com`, no trailing path). Push to main or run the CI workflow; the `release-apk` job skips safely until all signing values and the API URL are present. Store a second secure backup of the keystore outside GitHub.

### Scheduled subscription renewals
Configure an external trusted scheduler (for example a Render Cron Job) to POST to:
`https://YOUR_API_DOMAIN/api/subscriptions/renewals/run`
with header `x-cron-secret: YOUR_CRON_SECRET`. Run hourly. Do not expose the secret in browser code or logs. The route sends opt-in STK prompts for due subscriptions; customers approve them with their PIN. Safaricom Daraja does not silently debit a customer from the prior STK consent.

## Database and acceptance tests

Run:
```bash
npm install
npm run check -w server
npm run build
gradle -p mobile/android :app:assembleDebug -PBLUEMENU_API_BASE_URL=https://YOUR_API_DOMAIN
```

Before pilot sign-off, test with two independent staff sessions:
1. Confirm two overlapping room reservations simultaneously for the same last room; exactly one must succeed.
2. Confirm two overlapping table bookings simultaneously for the same last table; exactly one must succeed. Confirm a party larger than all available seats is rejected.
3. Verify room status transitions and check-out release availability for later dates.
4. Send an FCM test to one Android device, revoke notification permission, rotate the token, and verify invalid tokens are disabled.
5. Queue queue-ticket and attendance commands offline, force-close/reopen the app, reconnect, sync twice, and verify no duplicate tickets/check-ins.
6. Test Android 12, 13, 14 and 15 permissions, background scanning, reboot, Doze, battery saver and vendor-specific restrictions. Measure battery drain for at least 8 hours on target devices.
7. Test Daraja sandbox success, cancellation, timeout, duplicate callback, wrong amount, wrong phone and duplicate receipt. Only provider-verified callback may settle a payment.
8. Test paid/unpaid ad campaign lifecycle, callback retries, date windows, click tracking and budget reporting.
9. Verify AI outputs preserve IDs, ingredients, allergen notes and prices; manually review translations before publication.
10. Verify the payment ledger rejects reused checkout IDs/receipts and that sponsored campaigns remain unpublished until paid and approved.
11. Verify publisher settlement share calculations, payout-phone configuration and manual payout-reference audit trail; do not treat a manually entered reference as an automated B2C transfer.
12. Run tenant-isolation tests, role tests, CSRF/CORS checks, rate-limit checks, secret scanning, production dependency audit, backup restore and data deletion/export exercises.

## Known release blockers / honest boundaries

- This repository does not currently have a BlueMenu API service configured in the connected Render workspace. A live API deployment also needs the owner's production MongoDB URI, exact web origin, Daraja credentials, Firebase service account and AI key. Do not point a service at a dummy database or start charging customers with sandbox credentials.
- No production Android keystore is present in the repository or connected GitHub secrets. Signed APK generation is conditional and cannot produce a production artifact until the owner supplies the keystore secrets.
- CI can compile the Android foreground service, but cannot perform real-device Bluetooth background reliability, OEM power-management or battery-life acceptance. Those require physical Android devices and beacons.
- MongoDB transaction code requires a replica set. A standalone local MongoDB server will not pass transaction-based acceptance.
- Safaricom STK callbacks are validated against transaction data, but the production Daraja app/shortcode and callback registration must be approved by Safaricom.
- AI routes require a paid/authorized OpenAI API key and should be cost-limited at deployment. Human approval is required before publishing translations/recommendations.
- A security/privacy checklist and pilot test plan are included; this is not an independent penetration test, legal data-protection opinion or signed customer acceptance report.

## Incident and rollback
- Keep the previous Render/Vercel deployment available until health checks and pilot acceptance pass.
- Back up MongoDB before applying schema/index changes. New indexes are created by Mongoose model initialization; review index build impact for large datasets.
- If booking transactions fail because the database is not a replica set, disable booking confirmation rather than reverting to race-prone availability checks.
- If FCM or AI credentials are unavailable, in-app notifications and non-AI workflows remain available; do not display false push/AI success.
