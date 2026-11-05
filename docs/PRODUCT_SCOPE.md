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
