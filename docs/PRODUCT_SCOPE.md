# BlueMenu product scope

## Purpose
Give venues and institutions a simple, mobile-first way to publish current information and let nearby visitors access it without paper menus or printed agendas.

## Delivery and discovery
- BLE beacon: broadcasts a compact BlueMenu venue identifier / URL hint for a compatible app or supported scanner.
- QR code: universally practical entry point; place at tables, reception, classrooms and noticeboards.
- NFC: tap-to-open link where supported.
- Web/PWA: content opens in a browser and can be cached for low-connectivity environments.
- Important: Bluetooth advertising alone does not universally launch a web page on iOS/Android. Pair proximity discovery with QR/NFC or a companion app.

## Initial workflows
### Restaurant
Menu sections, item descriptions, prices in local currency, availability, dietary/allergen notes, specials and later table ordering/payment.

### Hotel
Room service menu, facilities, Wi-Fi/help information, check-in guidance, local attractions and service requests.

### School / meeting
Meeting agenda, presenter, time allocation, notes, attendance, resolutions, action owners and minutes.

### Other expansion
Church programmes and announcements; event schedules; clinic service directories; retail catalogues; tourism itineraries; transport notices.

## Platform principles
- Organization → locations → published content hierarchy
- Tenant isolation and role-based permissions
- Fast, responsive and accessible UI
- QR-first fallback and offline/PWA support
- Audit history for edits and publishing
- Kenya-first support for KES, M-Pesa and local connectivity


## Consolidated workflow delivery (2026-11)

### Implemented server workflows
- Hotel rooms: tenant-scoped room inventory, active/inactive controls, room-type filtering, and date-overlap availability lookup against confirmed/in-house reservations. Reservation requests remain pending until staff confirms them; room allocation is not yet persisted to an individual room.
- Meeting resolutions: create proposals tied to an organization-owned agenda, list them, and approve/reject/defer with approver identity and timestamp.
- Attendance: date-bounded meeting-level report with registered/present/absent counts and attendance percentages.
- Visitor/queue: existing visitor check-in/check-out and queue status controls; added authenticated ticket creation with daily sequence.
- Notifications: in-app notification creation/list/read tracking. A push provider is not invoked by this endpoint.
- Offline sync: bounded batch ingestion (max 100), organization/user scoped event IDs, duplicate detection and acceptance receipts. Events are recorded for later processing; this endpoint does not replay arbitrary mutations.
- AI: meeting assistant and menu description endpoints already available; require OPENAI_API_KEY and return configuration errors when absent.
- Existing public reservations/table requests and workspace management were added in the preceding commits.

### Production items still requiring environment or device validation
- Room assignment, race-safe capacity locking and full hotel check-in/check-out automation; table-capacity conflict locking/calendar UX.
- Frontend forms/screens for resolution workflows, room management/availability, attendance exports, and push opt-in; the API alone does not constitute completed UX.
- Real FCM/APNs credentials and client token registration; current notifications are in-app only.
- Durable offline queue replay into business commands with per-command authorization/validation; currently ingestion/idempotency only.
- Android BLE background operation: requires foreground-service lifecycle, Android-version-specific permission behavior, battery tests and physical-device validation. Current scanner is foreground-only.
- Production-signed APK: requires release keystore/signing secrets owned by the operator; CI debug APK is not a signed production release.
- Subscription automatic renewal/settlement: requires live Daraja/provider credentials, callback URL verification, reconciliation and real payment tests. Never mark payments paid from client requests.
- Advertising marketplace settlement, recommendation quality review, security/privacy assessment, pilot deployment and acceptance sign-off remain operational/product work.

### Verification
Run `npm run check` from `server/`, `npm run build` from `client/`, and the Android Gradle build in CI. Passing syntax checks is not a substitute for database-backed integration tests or payment/device verification.
