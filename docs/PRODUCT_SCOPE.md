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


## Proposal completion status — November 2026

Added in this delivery: tenant-scoped room inventory and room availability lookup; meeting resolution records with approval identity; attendance reports by date range; in-app notifications; bounded offline event ingestion with user/org idempotency; and queue-ticket creation. AI meeting assistance/menu description routes already exist and require an OpenAI key. Existing visitor check-in/out, queue transitions, campaign/advertising primitives and appointment management remain available.

Important production boundaries: availability currently derives room occupancy from confirmed/in-house reservations but does not assign a specific room or lock capacity transactionally; push notifications are not sent (in-app only); offline events are accepted/idempotently stored but not replayed into domain mutations; Android BLE remains foreground-only; release APK signing requires operator-owned keystore; live M-Pesa billing/reconciliation needs production credentials/callback verification. Full table-capacity locking, subscription automation, advertising marketplace settlement, AI recommendations quality controls, security audit and real-device pilot acceptance remain outstanding and must not be represented as complete.
