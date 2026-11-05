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
