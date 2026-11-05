# MongoDB Atlas setup

1. Create a free or paid cluster in MongoDB Atlas.
2. Create a database user and a strong password.
3. In Network Access, allow the deployment server's outbound IP addresses. For initial local development, allow your current IP (avoid permanently opening access to everyone).
4. Copy the Atlas connection string and replace the username, password and database name.
5. Put it in `server/.env` as `MONGODB_URI=...`. Do not commit the real URI.
6. Install dependencies with `npm install` from the repository root, then run `npm run dev`.

For Render, add `MONGODB_URI` under the API service's Environment settings. Set `CLIENT_ORIGIN` to the deployed web app origin.

The server connects to MongoDB before opening its HTTP port. Health is available at `/api/health`; its database field reports connected/disconnected.

## Initial collections
- organizations
- locations
- menus (with embedded categories and menu items)
- agendas (with embedded agenda items)
- discoverydevices (BLE beacon, QR and NFC registrations)

Public read endpoints:
- `GET /api/public/location/:slug`
- `GET /api/public/location/:slug/menu`
- `GET /api/public/location/:slug/agendas`

Initial write endpoints under `/api/admin` are scaffolding only. They must be protected with authentication, authorization, validation and audit logging before public production use.
