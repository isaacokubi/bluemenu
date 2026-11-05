# BlueMenu

**Bluetooth-powered digital menus, agendas and guest information.**

BlueMenu is a multi-tenant platform for restaurants, hotels, schools, churches, events and other organizations to publish mobile-friendly information. Bluetooth Low Energy (BLE) beacons advertise nearby BlueMenu experiences; phones open the experience through QR, NFC or a short web link (BLE itself cannot reliably open webpages on every phone).

## Foundation
- React + Vite responsive web interface
- Express REST API and health endpoint
- PostgreSQL schema for organizations, locations, menus, menu items, agendas and agenda items
- Demo menu and school meeting agenda
- BLE/QR/NFC-ready discovery model

## Run locally
Requirements: Node.js 20+ and PostgreSQL 15+.

```bash
npm install
cp server/.env.example server/.env
# Create a PostgreSQL database and set DATABASE_URL in server/.env
npm run db:setup
npm run dev
```

Web app: http://localhost:5173 | API: http://localhost:5000/api/health

## Roadmap
1. Tenant/location management and publishing dashboard
2. QR/BLE beacon discovery and offline/PWA experience
3. Restaurant ordering, hotel guest services and school meeting tools
4. Authentication, roles, analytics, subscriptions and payments
5. Native Android companion app and field testing

Never commit secrets; configure environment variables in deployment platforms.