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

Web app: http://localhost:5173 | API: http://localhost:5000/api/health

See [MongoDB setup](docs/MONGODB_SETUP.md) for database configuration and API endpoints.

## Roadmap
1. Tenant/location management and secure publishing dashboard
2. QR generation, BLE beacon discovery and offline/PWA experience
3. Restaurant ordering, hotel guest services and school meeting tools
4. Authentication, role-based permissions, audit logs, analytics and subscriptions
5. Native Android companion app and field testing

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
DARAJA_PASSKEY=
DARAJA_CALLBACK_URL=https://your-api-domain.example/api/payments/daraja/callback
```

The Daraja callback must be publicly reachable over HTTPS. Start with sandbox credentials. BlueMenu only marks an M-Pesa order paid after a successful provider callback with matching amount and payer phone. Do not manually mark an M-Pesa payment as paid.

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
