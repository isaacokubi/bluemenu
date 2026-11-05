# BlueMenu Smart Information Ecosystem

**Bluetooth-powered digital menus, smart agendas, proximity information distribution and business management platform**

**Tagline:** Information at Your Fingertips.  
**Initial market:** Kenya.  
**Commercial model:** Multi-tenant SaaS.

## Vision

BlueMenu provides one configurable information and service platform for restaurants, hotels, schools, churches, hospitals, retailers, tourism operators, events and public-service organizations. Bluetooth Low Energy is the proximity-discovery layer; QR, NFC, web links and offline caching provide inclusive fallback access.

A beacon does not automatically open a web page on every phone. A compatible mobile application must detect it and ask the user to open the relevant information. The web page then delivers the content. The platform must never use Bluetooth for covert tracking or unsolicited advertising.

## Problems addressed

- Printing costs and stale menus, agendas and notices.
- Fragmented communication between organizations and the people they serve.
- Manual ordering, room-service requests, reservations and queue handling.
- Manual meeting registration, attendance, minutes and action tracking.
- Poor visibility into customer engagement and operational performance.
- Unreliable internet access at some venues.

## Core product areas

1. **Restaurant operations:** categorized menus, item availability, dietary/allergen details, orders, kitchen workflow, table booking, receipts, inventory and payment reconciliation.
2. **Hotel guest services:** room-service menus, guest directory, room inventory, reservations, housekeeping, maintenance and guest requests.
3. **School and meeting management:** agendas, recurring meetings, invitations, calendars, attendance, minutes, resolutions, assigned actions and reminders.
4. **Proximity discovery:** BLE beacon registry, iBeacon and Eddystone-UID identifiers, beacon-to-location mapping, Android scanning, user consent and discovery diagnostics.
5. **Information publishing:** organization-wide or location-specific announcements, public notices, emergency messages, documents, events and digital noticeboards.
6. **Smart operations:** appointments, visitor registration, queue tickets, service requests and operational reports.
7. **Advertising:** approved campaigns, schedule windows, opt-in nearby promotions, payment status, impressions and click reporting.
8. **AI assistance:** menu descriptions, translations, pairings, agenda drafting, minutes assistance, summaries and action extraction. Human approval is required before publication.
9. **Commercial platform:** tenant onboarding, plans, subscription billing, M-Pesa checkout, usage limits and enterprise support.
10. **Industry extensions:** church programmes, tourism guides, retail catalogues, event programmes and transport timetables. Regulated clinical records are explicitly outside the generic public-information module.

## Roles and tenant isolation

Each organization owns its users, locations, menus, agendas, beacons, information, bookings, orders, campaigns, settings and billing. Roles include owner, manager, editor and viewer, with permissions enforced by the API. Editors may prepare drafts; sensitive publication and destructive actions are reserved for owners/managers.

## Architecture

- Web: React, Vite and responsive PWA.
- API: Node.js, Express and JWT authentication.
- Data: MongoDB Atlas and Mongoose.
- Mobile: native Android companion for BLE discovery; iOS requires a separate supported discovery strategy.
- Media: Cloudinary.
- Payments: Safaricom Daraja M-Pesa.
- Notifications: Firebase Cloud Messaging and email.
- Hosting: Vercel web frontend, Render API, MongoDB Atlas database.
- Access: BLE discovery plus QR, NFC, Wi-Fi and HTTPS web pages.

## Current implementation in this repository

The codebase already contains authentication, organization/location workspaces, menus, agendas, public pages, QR/NFC/ BLE discovery records, Android iBeacon and Eddystone-UID scanning, ordering, hotel and table booking workflows, room management, meeting registration/attendance, minutes/resolutions, service requests, appointments, visitor registration, queue tickets, inventory, campaigns, AI endpoints, analytics, offline event queueing, notifications, M-Pesa integrations and subscription plans.

The information publishing module adds:
- Organization-wide or location-specific announcements, documents, digital signage and event records.
- Public or internal visibility.
- Normal, important and emergency priority.
- Optional publication start/end windows.
- Draft creation by editors and publication/deletion controls for owners/managers.
- Public delivery of published, public and currently active information on each location page.
- HTTPS/relative-link validation and organization-scoped API queries.

## Delivery priorities and acceptance

### Priority 1 — Functional completion
- Verify all tenant boundaries and role permissions.
- Complete end-to-end information publishing, public display and scheduled visibility.
- Complete offline queue replay, duplicate prevention and conflict handling.
- Validate beacon identifier normalization, beacon-to-location mapping and discovery notification behavior.
- Validate orders, reservations, room allocation, attendance and payments.

### Priority 2 — Real-world integrations
- Test BLE with physical iBeacon and Eddystone devices on supported Android versions and OEM devices.
- Measure battery usage and background restrictions; explain Android permission and notification requirements.
- Test FCM delivery and token rotation with real devices.
- Complete Daraja sandbox and approved production credential testing.
- Complete Cloudinary, email and AI provider configuration.
- Define an iOS experience that respects platform BLE/background limitations; QR/NFC/web access remains available.

### Priority 3 — Commercial readiness
- Security assessment, tenant-isolation tests and dependency review.
- Backup restoration and data export/deletion exercises.
- Monitoring, alerting, incident response and support process.
- Pilot deployments with one restaurant, one hotel and one school.
- Validate subscription pricing, onboarding costs and beacon hardware support.

## Security and privacy requirements

Use HTTPS, secure password hashing, short-lived/rotatable credentials where supported, least-privilege role checks, organization-scoped database queries, API rate limits, audit records, upload validation, payment callback verification, backup/restore tests and user consent for proximity features. Public information must never expose internal-only content. Payment status must only be settled by verified provider callbacks. Emergency public notices require authorized approval and an audit trail.

## Commercial model

Proposed introductory prices, subject to market validation:

| Plan | Indicative monthly price | Intended customers |
|---|---:|---|
| Starter | KSh 500 | Small businesses |
| Business | KSh 1,500 | Restaurants and schools |
| Professional | KSh 3,500 | Larger venues |
| Enterprise | Custom | Chains and institutional groups |

Additional revenue may come from premium AI, advertising, transaction services where lawful, beacon hardware, installation, training, custom integrations and enterprise support.

## Pilot success measures

Measure number of onboarded organizations and locations, beacon detections, QR/NFC opens, menu and agenda engagement, orders, service requests, meeting attendance, notice views, printing-cost savings, uptime, payment reconciliation accuracy, customer satisfaction and subscription conversion.

## Important release boundaries

Source code and CI success do not prove real-world readiness. Production launch requires real provider credentials, physical Android devices and beacons, payment callback approval, notification credentials, a signed Android release keystore, security testing, backup/restore verification and pilot acceptance. The Android companion does not guarantee continuous background scanning on every handset. No production M-Pesa, push, AI or email integration should be represented as live until its provider configuration and end-to-end tests succeed.
