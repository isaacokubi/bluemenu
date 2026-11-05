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
