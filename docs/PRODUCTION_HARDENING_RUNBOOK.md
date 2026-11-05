# BlueMenu production hardening and launch runbook

This release adds transactional capacity allocation, Firebase web push, a replayable offline-command endpoint, Daraja reconciliation, paid sponsored-campaign intake and publisher settlement accounting, grounded AI menu recommendations, Android foreground BLE scanning, and a signed-APK workflow. CI targets Node.js 20; Firebase browser SDK packages are pinned to compatible releases.

## 1. Database requirements

**MongoDB replica set / Atlas is required.** Room allocation, table-slot holds, and offline command replay use MongoDB transactions. A standalone MongoDB server does not support those transactions. Before production, verify the connection is to an Atlas replica set or a replica-set deployment and ensure unique indexes have finished building.

Room assignment is made when a staff member confirms a reservation. One unique room/night allocation is written for each occupied night. Check-in requires an assigned room; checkout/cancellation releases the allocation. A duplicate-key race returns HTTP 409 and must be retried after refreshing availability.

Restaurant table capacity is configured per location through `Location.tableCapacity` (default 50 covers per 30-minute slot). Confirmed/seated bookings hold covers; completed/cancelled/no-show bookings release them. Configure the location capacity before accepting live bookings. Existing legacy confirmed bookings created before capacity holds may need a one-time reconciliation/migration before enabling this feature.

## 2. Firebase web push

Set the following server environment variables:

- `FIREBASE_SERVICE_ACCOUNT_BASE64`: base64-encoded Firebase service-account JSON (private).
- `FIREBASE_WEB_API_KEY`, `FIREBASE_WEB_AUTH_DOMAIN`, `FIREBASE_WEB_PROJECT_ID`, `FIREBASE_WEB_MESSAGING_SENDER_ID`, `FIREBASE_WEB_APP_ID`: Firebase web app config (public).
- `FIREBASE_WEB_VAPID_KEY`: Web Push certificate public key.

The workspace asks the browser for notification permission after sign-in, registers its FCM token at `POST /api/push/register`, and receives foreground/background web push. The service-account private key must only exist in Render environment variables, never in Git.

The current Android companion app is a public BLE discovery app and does not have a signed-in account/session. Its token cannot safely be associated with a workspace user yet. Android FCM delivery requires adding Firebase Android app configuration (`google-services.json`) and a user-authenticated registration flow to the Android client. Do not reuse a web token or invent an account identity.

## 3. M-Pesa and subscription billing

Configure live Daraja credentials only after Safaricom has approved the production app and shortcode/till. Required variables are `DARAJA_ENV=production`, consumer key/secret, shortcode, passkey, transaction type, callback URL, and till number for Buy Goods. Callback URL must be public HTTPS.

Callbacks validate the checkout ID, M-Pesa receipt format, exact expected amount, and normalized payer phone before activating a subscription or marking a sponsored campaign paid. A unique payment ledger prevents duplicate checkout IDs and receipt reuse. Sponsored campaigns remain unpublished until both paid and approved by a workspace owner/manager.

The reconciliation endpoint `POST /api/payments/daraja/reconcile` uses `DARAJA_RECONCILE_SECRET`. A successful STK query is not enough to activate a payment: only the matching verified callback contains the receipt/amount/phone metadata required by this implementation.

**Standard Daraja STK Push is not a silent recurring debit mandate.** Each renewal requires the customer to authorize an STK prompt unless Safaricom provides a separately approved recurring/standing-order product for this merchant. The scheduled billing job moves expired subscriptions to past_due and suspends them after the grace period; it does not debit customers automatically.

Set `BILLING_RECONCILE_SECRET` for `POST /api/subscriptions/reconcile`. A scheduled job can run:

```bash
API_BASE_URL=https://YOUR-API-DOMAIN \
DARAJA_RECONCILE_SECRET=... \
BILLING_RECONCILE_SECRET=... \
npm run reconcile -w server
```

The repository includes `.github/workflows/reconcile.yml`, scheduled every 15 minutes and manually runnable. Add GitHub Actions secrets `API_BASE_URL`, `DARAJA_RECONCILE_SECRET`, and `BILLING_RECONCILE_SECRET` to enable it. Alternatively, run the command from a Render Cron Job every 10–15 minutes. The job exits non-zero if an endpoint or secret is unavailable.

## 4. Sponsored advertising marketplace

Workspace owners/managers can submit a sponsored campaign through `POST /api/workspace/advertising/campaigns`. The campaign is charged using an M-Pesa STK request, remains unpublished while payment is pending, and requires review approval after payment. Existing non-sponsored campaigns retain the existing publishing workflow.

This release records sponsor charges and creates a publisher settlement ledger when a paid campaign is approved. Each location can configure a payout phone and publisher revenue share (default 70%); the ledger records gross amount, platform fee and publisher amount. An owner/manager can record a payout reference after verifying the actual transfer. **The transfer itself is not automated.** Automated B2C payout requires Safaricom B2C/settlement product approval, initiator/security credentials, payout callback endpoints, tax/invoice rules, and a reconciled settlement account. Do not advertise automatic payouts until those are implemented and tested.

## 5. AI menu recommendations

`POST /api/ai/menu-recommendations` uses only items from a published menu in the signed-in organization's locations. The server validates returned item IDs against that menu and returns actual menu prices/allergens, not AI-invented facts. Set `OPENAI_API_KEY`; recommendations remain unavailable when it is missing.

## 6. Android BLE background service

The Android companion now has an explicit **Continue scanning in background** action. It starts a user-visible low-power foreground service with a persistent notification, uses Android 12+ nearby-device permissions, and stops when the user taps Stop scanning. Android may still throttle scans due to OEM battery policies; a foreground service is not a guarantee of identical behavior on every device.

Test on the target Samsung models with screen locked, app swiped from recents, battery saver on/off, Bluetooth toggled, permission denied/re-enabled, and after reboot. Measure idle drain over at least 8 hours and compare with scanning disabled. The service must not be advertised as continuous location tracking.

## 7. Signed Android APK

The manual GitHub Actions workflow `.github/workflows/android-release.yml` builds and uploads a signed release APK. Add these GitHub repository Actions secrets:

- `ANDROID_KEYSTORE_BASE64`: base64 of your private JKS/PKCS12 keystore.
- `ANDROID_KEYSTORE_PASSWORD`
- `ANDROID_KEY_ALIAS`
- `ANDROID_KEY_PASSWORD`

Do not commit the keystore or passwords. Run the **BlueMenu signed Android release** workflow manually and provide the public HTTPS API URL. The release workflow intentionally fails if any signing secret is missing. The debug APK from normal CI is not a production-signed release. Back up the keystore securely; losing it can prevent updates to the same Android application ID.

## 8. Security and privacy review

Implemented controls: Helmet headers, allow-listed CORS, auth/public rate limits, JWT token-version revocation, organization-scoped database queries, role checks, audit events, bounded JSON bodies, HTTPS-only public campaign links, secret-protected scheduled reconciliation, FCM token ownership scoped to the authenticated user, and idempotent offline event IDs.

Before launch, an operator/security reviewer must still: rotate all credentials; confirm production CORS origins; restrict Render environment access; verify MongoDB backups/restore; review Cloudinary upload access; run dependency and static-analysis scans; test account deletion/data export/retention policy; perform tenant-isolation and authorization penetration tests; and verify that logs never expose tokens, service-account JSON, phone numbers, or payment secrets.

## 9. Pilot acceptance checklist

- [ ] Atlas replica set connected and indexes built.
- [ ] Reservation concurrency test: two simultaneous requests cannot allocate the same room/night.
- [ ] Table capacity concurrency test: simultaneous confirmations cannot exceed slot covers.
- [ ] Check-in requires a room assignment; checkout releases allocation.
- [ ] FCM web push tested on HTTPS in Chrome/Android and desktop browser, foreground and background.
- [ ] Offline replay tested with disconnect/reconnect, duplicate event IDs, invalid event payloads, and concurrent retries.
- [ ] Daraja sandbox callback tests: success, cancellation, timeout, wrong amount, wrong phone, duplicate callback, reused receipt.
- [ ] Production Daraja credentials and callback URL approved by Safaricom.
- [ ] Subscription grace/suspension cron tested with controlled dates.
- [ ] Sponsored campaign payment and moderation tested; payout feature remains disabled until separately approved.
- [ ] AI recommendations tested for nonexistent item IDs, allergens, budget, and empty menus.
- [ ] Android BLE tested on physical target devices, screen locked, and battery drain measured.
- [ ] Signed release APK verified with `apksigner verify`; keystore backup documented.
- [ ] Restore drill, security review, privacy review, and pilot owner sign-off completed.

A CI pass verifies compilation/builds only. It does not substitute for live Daraja credentials, Firebase project setup, Android hardware testing, a release keystore, security review, or pilot sign-off.
