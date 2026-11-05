# BlueMenu Integration, Pilot and Release Runbook

This runbook separates code-delivered capabilities from steps that require real provider accounts, deployment configuration, physical hardware or business approval.

## Implemented workspace capabilities

- Information publishing supports announcements, resources, signage and events, with organization/location scope, public/internal visibility, priority and publication windows.
- Event ticketing supports capacity limits, free ticket confirmation, paid-ticket M-Pesa STK initiation, callback verification against amount and phone, and one-time staff check-in.
- Transport management supports locations, origins/destinations, ordered stops, weekday departure times and KES fares. Active routes appear on public location pages.
- Loyalty management supports customer profiles, point credits, manager/owner adjustments, transaction history and idempotency keys. Point redemption is disabled until a tenant defines reward value, expiry, eligibility and refund rules.
- Media management signs Cloudinary uploads server-side, stores tenant-scoped asset records and supports images (15 MB), documents (25 MB) and videos (100 MB). Media is sent directly from the browser to Cloudinary; the API secret is never sent to the browser.

## Required production configuration

Configure these values in the API hosting provider's secret/environment settings. Never commit real values.

| Capability | Required configuration | Validation |
|---|---|---|
| Database | MONGODB_URI | Atlas connection succeeds; restore test completed |
| Authentication | JWT_SECRET (32+ characters) | Production API refuses weak/missing secret |
| M-Pesa | DARAJA_ENV, DARAJA_CONSUMER_KEY, DARAJA_CONSUMER_SECRET, DARAJA_SHORTCODE, DARAJA_PASSKEY, DARAJA_CALLBACK_URL | Use sandbox first; callback must be public HTTPS and point to /api/payments/daraja/callback |
| Buy Goods M-Pesa | DARAJA_TRANSACTION_TYPE=CustomerBuyGoodsOnline, DARAJA_TILL_NUMBER | Confirm shortcode/till pairing with Safaricom |
| Media | CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET | Upload, verify, copy URL and delete a test asset |
| Push notifications | FCM_SERVICE_ACCOUNT_JSON | Test token registration, send, token rotation and invalid-token cleanup on physical devices |
| Email recovery | RESEND_API_KEY, RESEND_FROM_EMAIL, APP_BASE_URL | Verify sender domain and test recovery end to end |
| AI assistance | OPENAI_API_KEY, optional AI_MODEL | Confirm provider access, rate limits and human approval before publishing |
| Scheduled subscription renewal | CRON_SECRET | Configure a trusted scheduler to call the renewal endpoint; inspect logs and failed renewals |

Set CLIENT_ORIGIN to the exact production frontend origin(s). Use HTTPS for all production endpoints.

## Event ticket acceptance

1. Create an event on a location, set a capacity (0 means unlimited) and a whole-KES ticket price.
2. Publish the event publicly.
3. Confirm the public location page displays the ticket form and remaining capacity.
4. Reserve a free ticket and verify it is confirmed.
5. Reserve a paid ticket in Daraja sandbox; verify the STK request remains pending until callback.
6. Send a successful callback with the exact checkout ID, amount, receipt and expected phone; verify the ticket becomes paid.
7. Send failed and duplicate callbacks; verify a failed ticket releases capacity once and a duplicate callback does not settle twice.
8. Try to exceed capacity concurrently; no more tickets than capacity may be issued.
9. Check in a valid ticket; verify a second check-in is rejected and unpaid/failed tickets cannot be checked in.

## Transport and loyalty acceptance

- Create, update and disable transport routes in one tenant; verify public routes only show active routes for the selected location.
- Confirm weekday values are 0–6, times are 24-hour HH:mm, fares are non-negative whole KES values and stops are sorted by order.
- Create a loyalty account using a Kenyan mobile number; verify normalized phone uniqueness within a tenant.
- Credit points with an idempotency key; replay the same request and verify the balance does not increase twice.
- Verify negative adjustments require owner/manager access, cannot reduce a balance below zero, and create an audit record.
- Verify one organization's route, customer, balance and transaction data cannot be read or changed by another organization.

## Cloudinary acceptance

- Upload an image, PDF/document and video under their configured limits.
- Attempt files above 15 MB image, 25 MB raw/document and 100 MB video limits; reject before sending to Cloudinary.
- Confirm the browser receives only a short-lived signature and API key, never the API secret.
- Verify returned Cloudinary signatures server-side before registering assets.
- Confirm assets are scoped to the authenticated organization and optional location.
- Delete a test asset and verify the Cloudinary object and registry record are both removed.
- Verify public content uses only HTTPS Cloudinary URLs and that deleting an asset is treated as a destructive action.

## BLE and mobile pilot

- Use at least one physical iBeacon and one Eddystone-UID beacon with known UUID/namespace/instance values.
- Test Android permission prompts, Bluetooth disabled state, foreground scan, background restrictions, screen-off behavior, battery use and app relaunch on supported Android versions.
- Verify a beacon resolves only to its registered active location and does not trigger covert tracking or unsolicited notifications.
- Test QR and NFC fallback paths on Android and iOS. iOS does not yet have a native BlueMenu BLE companion in this repository; QR/NFC/HTTPS PWA access is the supported cross-platform fallback.
- Record device model, Android/iOS version, app build, beacon firmware and test results for each pilot.

## Security, privacy and operational release gates

- Run cross-tenant API tests for every model and route, including public/internal information visibility, ticket operations, media deletion, loyalty adjustments and location ownership.
- Test owner/manager/editor/viewer permissions, rate limits, malformed IDs, oversized inputs, replayed callbacks and duplicate idempotency keys.
- Review dependency audit findings and patch or document accepted risks before production.
- Verify database backup scheduling, point-in-time recovery where available, restore into a separate database, exports and account deletion.
- Configure uptime/error monitoring, structured logs, alerts, incident ownership and support escalation.
- Perform a security review of file uploads, public endpoints, payment callbacks and Android permissions.
- Obtain business acceptance from one restaurant, one hotel and one school/organization before general release.

## Android release artifact

The CI pipeline builds a debug APK. A signed release APK is only produced after repository secrets are configured:
- ANDROID_KEYSTORE_BASE64
- ANDROID_KEYSTORE_PASSWORD
- ANDROID_KEY_ALIAS
- ANDROID_KEY_PASSWORD

Also configure the repository variable BLUEMENU_API_BASE_URL to the production API URL. Store the keystore and passwords securely; do not commit them. Configure FIREBASE_ANDROID_CONFIG_BASE64 if the Android Firebase client configuration is required. Download and test the signed artifact on supported physical devices before distribution.

## Release decision

A successful source build is not a production sign-off. Do not announce M-Pesa, FCM, email, AI, iOS BLE, real-beacon background discovery or signed APK distribution as production-ready until the corresponding acceptance steps above pass with real credentials and devices.
