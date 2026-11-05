# BlueMenu

**Bluetooth-powered digital menus, agendas and guest information.**

BlueMenu is a multi-tenant platform for restaurants, hotels, schools, churches, events and other organizations to publish mobile-friendly information. Bluetooth Low Energy (BLE) beacons advertise nearby BlueMenu experiences; phones open the experience through QR, NFC or a short web link (BLE itself does not universally open webpages on every phone).

## Technology
- React + Vite responsive web interface
- Node.js + Express REST API
- MongoDB Atlas + Mongoose
- BLE/QR/NFC-ready discovery model

## Run locally
Requirements: Node.js 20+ and a MongoDB Atlas cluster or local MongoDB instance.

```bash
npm install
cp server/.env.example server/.env
# Set MONGODB_URI in server/.env
npm run dev
```

Web app: http://localhost:5173 | API readiness: http://localhost:5000/api/health | Liveness: http://localhost:5000/api/health/live

See [MongoDB setup](docs/MONGODB_SETUP.md) for database configuration and API endpoints.

## Implemented foundation
- Tenant/location management, role-based workspace and secure publishing.
- QR generation, BLE beacon registry, NFC mapping, PWA and Android discovery companion.
- Restaurant ordering, hotel guest requests, school/event agendas and attendee check-in.
- JWT authentication, recovery, audit trail, tenant analytics and subscription trial/plan management.
- M-Pesa order and subscription STK Push callbacks with receipt, amount and phone verification.

## Remaining proposal roadmap
- Hotel room reservations, inventory/stock controls and restaurant table booking.
- School meeting minutes, resolutions, task ownership and richer attendance reports.
- Visitor books, queue tickets, appointments, lost-and-found and feedback.
- Advertisement campaigns/marketplace, opt-in proximity promotions and digital signage.
- AI menu translation/recommendations and meeting notes/action extraction.
- Push notifications, richer offline synchronization and Android field-tested background discovery.
- Production hardening, accessibility review, pilot measurement and data-protection review.

Never commit secrets; configure environment variables in deployment platforms.


## Business workspace

The business portal is available from the **Business portal** link on the public site. A new organization can register its owner account, organization type and first location. Owners can sign in, create menu and meeting-agenda drafts, publish or unpublish them, and remove content. Passwords are hashed with bcrypt and sessions use signed JWTs.

Set these server environment variables:

```env
MONGODB_URI=your_mongodb_atlas_connection_string
JWT_SECRET=use-a-long-random-secret-at-least-32-bytes
CLIENT_ORIGIN=http://localhost:5173
```

### Workspace API

- `POST /api/auth/register` — create an owner account, organization and first location.
- `POST /api/auth/login` — sign in and receive a seven-day bearer token.
- `GET /api/auth/me` — get the signed-in account.
- `GET /api/workspace/overview` — load organization locations, menus, agendas and counts.
- `POST /api/workspace/menus` and `PATCH /api/workspace/menus/:id` — create and update/publish menus.
- `POST /api/workspace/agendas` and `PATCH /api/workspace/agendas/:id` — create and update/publish agendas.
- `DELETE /api/workspace/menus/:id` and `DELETE /api/workspace/agendas/:id` — owner/manager deletion.
- `GET /api/public/location/:slug/menu` and `GET /api/public/location/:slug/agendas` — published content only.

A public location page is available at `/p/:publicSlug`. Copy the public slug from the location record in MongoDB or the registration response and append it to your site URL. Unpublished drafts are not exposed by public endpoints.

**Bluetooth note:** BLE beacon advertisements can help a nearby phone discover a venue, but browsers and phone operating systems do not universally auto-open a website from a BLE signal. Use a QR code, NFC tag or short URL as the reliable cross-platform entry point; a later native Android companion app can provide richer BLE discovery.


## Current functional modules

- Multi-tenant organizations with multiple locations.
- Owner, manager, editor and viewer roles; one-time staff invitations.
- Email password recovery through Resend; password resets invalidate active sessions.
- Menu builder supporting multiple items per category, KES prices and Cloudinary image uploads.
- Published public menu and agenda pages with QR sharing.
- Customer orders with server-calculated prices, idempotency keys and staff order-status workflow.
- Hotel and venue service requests with staff handling.
- School, church and event agenda publishing, attendee registration and check-in codes.
- BLE beacon, QR and NFC discovery-point registry and public identifier lookup.
- Installable PWA with offline caching for public information.
- Safaricom Daraja STK Push integration, activated when credentials and an HTTPS callback are configured.
- API security headers, CORS allowlist and rate limits.

## Optional integrations

Add the relevant values to server/.env or your hosting provider's environment settings:

```env
# Cloudinary
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=

# Resend password recovery email
RESEND_API_KEY=
RESEND_FROM_EMAIL=BlueMenu <no-reply@your-verified-domain.example>
APP_BASE_URL=https://your-public-app-domain.example

# Safaricom Daraja
DARAJA_ENV=sandbox
DARAJA_CONSUMER_KEY=
DARAJA_CONSUMER_SECRET=
DARAJA_SHORTCODE=
# Required only for CustomerBuyGoodsOnline transactions
DARAJA_TILL_NUMBER=
DARAJA_PASSKEY=
DARAJA_CALLBACK_URL=https://your-api-domain.example/api/payments/daraja/callback
```

The Daraja callback must be publicly reachable over HTTPS. BlueMenu rejects HTTP callback URLs before initiating a payment. For PayBill, set `DARAJA_TRANSACTION_TYPE=CustomerPayBillOnline`; for Buy Goods, set `DARAJA_TRANSACTION_TYPE=CustomerBuyGoodsOnline` and provide `DARAJA_TILL_NUMBER`. Start with sandbox credentials. BlueMenu only marks an M-Pesa order paid after a successful provider callback with matching amount and payer phone. Do not manually mark an M-Pesa payment as paid.

### Additional API routes

- POST /api/auth/forgot-password and /api/auth/reset-password — email account recovery.
- POST /api/auth/accept-invite — accept a one-time staff invitation.
- POST /api/public/location/:slug/orders — submit an order using published item IDs and server-side prices.
- GET /api/public/location/:slug/orders/:orderNumber — check order status.
- POST /api/public/location/:slug/requests — submit a venue service request.
- POST /api/public/location/:slug/agendas/:agendaId/register — register an attendee.
- POST /api/public/location/:slug/agendas/:agendaId/check-in — check in with a registration code.
- POST /api/payments/daraja/callback — Safaricom payment callback.
- POST /api/workspace/team/invites — create staff invitation.
- POST /api/workspace/media/signature — request a scoped Cloudinary upload signature.
- POST /api/workspace/discovery-devices — register a BLE, QR or NFC discovery point.

**Bluetooth limitation:** BlueMenu stores BLE beacon identifiers and resolves them to public location content. A BLE signal cannot universally force iOS or Android to open a webpage. QR, NFC and short links remain the reliable cross-platform fallback. An initial Android companion app is in mobile/android. It scans iBeacon UUIDs while the app is open; background scanning, Eddystone support, signed APK builds and physical beacon testing remain outstanding. See mobile/README.md.

**Production checklist:** configure MongoDB, JWT, exact CORS origins, HTTPS app/API URLs, Cloudinary, a verified Resend sender and Daraja production credentials. Live payments, email delivery, media uploads and beacon hardware need real provider credentials and field testing.

## Plans and subscription billing

BlueMenu creates a 14-day Starter trial for new organizations. The workspace shows plan status and self-service pricing (KES):
- Starter: KSh 500/month or KSh 5,000/year; 1 location, 5 menus/agendas, 2 team accounts.
- Business: KSh 1,500/month or KSh 15,000/year; 3 locations, 30 menus/agendas, 10 team accounts.
- Professional: KSh 3,500/month or KSh 35,000/year; 10 locations, 150 menus/agendas, 40 team accounts.
- Enterprise: custom quotation.

The API exposes `GET /api/subscriptions/plans`, authenticated `GET /api/subscriptions/me`, and owner-only `POST /api/subscriptions/checkout` with `{plan,billingCycle,phone}`. Subscription activation is callback-driven: the Daraja callback verifies checkout ID, receipt, amount and payer phone before switching the tenant to active. Configure the same Daraja environment variables used for order payments and a public HTTPS callback at `/api/payments/daraja/callback`. Creation quotas are enforced server-side; viewing and existing records remain accessible when trial or billing is overdue.

## Extended service workflows
- **Inventory:** `GET/POST /api/workspace/inventory`, `PATCH /api/workspace/inventory/:id`, and `POST /api/workspace/inventory/:id/adjust`. Stock movements retain before/after quantities, actor, reason and time; issue operations reject negative stock.
- **Appointments:** public `POST /api/public/location/:slug/appointments`; organization staff list and update status through `/api/workspace/appointments`.
- **Visitor register:** public check-in `POST /api/public/location/:slug/visitors`; staff use `GET /api/workspace/visitors` and `PATCH /api/workspace/visitors/:id/checkout`.
- **Queue management:** public `POST /api/public/location/:slug/queue`; staff monitor and update `/api/workspace/queue`.
- **School meeting follow-up:** agenda records now include meeting type/status, minutes and action items with owners, due dates and workflow status.
- **Analytics:** owner/manager-only `GET /api/workspace/analytics?days=30` returns organization-scoped paid revenue, order totals, attendance, service request counts and published content.
