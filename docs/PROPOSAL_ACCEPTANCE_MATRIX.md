# BlueMenu proposal-to-production acceptance matrix

This document maps the approved BlueMenu Smart Information Ecosystem proposal to repository evidence and release gates. A route, model or README mention is not by itself proof of production acceptance.

## Status definitions

- **Implemented (code evidence):** repository documentation and source structure indicate a workflow exists. It still requires the listed tests.
- **Partial / acceptance required:** a foundation exists, but real-provider, device, concurrency, security or operational proof is outstanding.
- **Not evidenced:** this audit did not find sufficient repository evidence. Do not advertise it as complete until implemented and tested.

## Proposal coverage

| Proposal capability | Current repository evidence | Status / release gate |
|---|---|---|
| Multi-tenant organizations and locations | Organization, Location and tenant-scoped models/routes; workspace roles | Implemented (code evidence); prove cross-tenant read/write isolation |
| Restaurant menus, categories, prices, images, availability | Menu/category/item schemas, workspace/public APIs, Cloudinary signature route | Implemented (code evidence); test real Cloudinary upload and public publishing |
| QR access and public pages | Public location pages and QR sharing | Implemented (code evidence); test generated links on Android/iOS camera apps |
| BLE beacon registry and resolution | DiscoveryDevice model/API; Android companion | Partial; physical iBeacon and Eddystone tests, permission/OEM/battery acceptance required |
| NFC mapping | Discovery-device type and public resolution | Partial; validate real NFC tags and device/browser handoff |
| Android discovery and push | Native companion and FCM integration documented | Partial; Firebase credentials, physical device and signed release APK required |
| School meetings and agendas | Agenda model, meeting types/status, minutes and action items | Implemented (code evidence); test attendance, permissions, reminders and full lifecycle |
| Meeting resolutions | MeetingResolution model and ecosystem workflow evidence | Partial; prove approval/rejection audit trail and role restrictions |
| Restaurant orders and kitchen workflow | Order model, public order endpoint and staff status workflow | Implemented (code evidence); concurrency, idempotency and payment reconciliation tests |
| Hotel guest services and room service | ServiceRequest workflow | Implemented (code evidence); test staff assignment and guest-facing status |
| Hotel reservations and room allocation | Reservation/Room models and transaction-based allocation runbook | Partial; replica-set concurrency and real booking acceptance required |
| Restaurant table bookings | TableBooking/RestaurantTable models and transactional allocation runbook | Partial; simultaneous last-table and capacity tests required |
| Inventory and stock movements | InventoryItem/StockMovement models and adjustment endpoints | Implemented (code evidence); verify negative stock prevention and menu integration |
| Queues and appointments | QueueTicket/Appointment models and public/workspace endpoints | Implemented (code evidence); test queue ordering, cancellation and notification delivery |
| Visitor registration | Visitor model and check-in/check-out endpoints | Implemented (code evidence); test consent, retention and access restrictions |
| Announcements, documents, events and digital signage | InformationItem model and information routes; signage content type | Partial; verify display/player client, scheduling, expiry, access and emergency priority |
| Transport routes and timetables | TransportRoute schema evidence | Partial; verify complete CRUD/public timetable UI, fares, schedule timezone and tests |
| Customer loyalty | Loyalty account/transaction schema evidence | Partial; verify earn/redeem APIs, atomic balance updates, idempotency and customer UI |
| Lost and found | InformationItem-backed tenant-scoped reports, moderation, public open-record feed, atomic first-claim request and staff approve/reopen/return controls | Implemented (code evidence); validate abuse controls, retention policy, claim identity checks and full lifecycle with pilot users |
| Department/building directories and navigation | InformationItem-backed location-scoped directory records, workspace authoring, public directory cards and client-side search across names, categories, departments, buildings, floors and rooms | Partial; map/navigation integration and pilot content verification remain |
| Digital document distribution | InformationItem document type is present | Partial; secure file handling, audience permissions, expiry and download audit required |
| Advertising and nearby promotions | Campaign model, public feed and payment lifecycle documented | Partial; validate paid/unpaid lifecycle, budgets, date windows and consent |
| AI menu and meeting assistance | Authenticated AI routes documented | Partial; provider key, rate/cost limits, output validation and human approval required |
| Offline public information and command replay | PWA caching and idempotent replay documented | Partial; offline/online/restart/retry and conflict tests required |
| M-Pesa order and subscription payments | Daraja STK Push/callback verification documented | Partial; Safaricom production approval, HTTPS callback and sandbox/production acceptance required |
| Subscriptions and plan enforcement | Plans, trial, checkout and quota enforcement documented | Partial; verify renewals, downgrade/expiry and payment reconciliation |
| Analytics and reporting | Tenant-scoped analytics endpoint documented | Partial; verify calculations, privacy, date windows and tenant boundaries |
| Security, audit and privacy | JWT, roles, audit logs, rate limits, security runbook | Partial; automated authorization tests, secret scan, dependency audit, backup restore and independent review required |
| Internationalization and multi-currency | KES default and selected AI translation documented | Partial; locale-aware formatting, currency handling and content translation across all user surfaces required |

## Critical acceptance gates

These gates cannot be completed by source-code inspection alone.

### Environment and provider gates
- [ ] Production MongoDB Atlas URI configured; transactions verified on replica set.
- [ ] Production JWT secret and exact CORS origins configured.
- [ ] Cloudinary upload and deletion tested with production credentials.
- [ ] Verified email sender and password-recovery delivery tested.
- [ ] Firebase service account and Android Firebase configuration installed.
- [ ] OpenAI key, model, spend limits and rate limits configured.
- [ ] Daraja sandbox tests passed; production app/shortcode and callback approved by Safaricom.
- [ ] Trusted subscription renewal scheduler deployed and protected by a secret.
- [ ] Production API and web deployment health checks pass.

### Android and physical-device gates
- [ ] Debug APK builds and installs.
- [ ] Signed release APK builds from protected keystore secrets.
- [ ] iBeacon discovery tested on supported physical Android devices.
- [ ] Eddystone-UID discovery tested with configured hardware.
- [ ] Android permission flows tested on supported OS versions.
- [ ] Foreground/background behavior, reboot, Doze and OEM battery controls tested.
- [ ] FCM registration, token rotation, denied permission and delivery failures tested.
- [ ] QR and NFC fallbacks tested on Android and iOS.
- [ ] Battery usage measured during a representative extended pilot.

### Business workflow gates
- [ ] Two simultaneous bookings for the last hotel room: exactly one succeeds.
- [ ] Two simultaneous bookings for the last suitable restaurant table: exactly one succeeds.
- [ ] Over-capacity table party is rejected.
- [ ] Reservation cancellation/check-out releases capacity correctly.
- [ ] Order prices are always calculated by the server.
- [ ] Duplicate order and offline command retries do not create duplicates.
- [ ] M-Pesa duplicate, delayed, failed, wrong amount, wrong phone and wrong receipt callbacks are rejected or reconciled safely.
- [ ] Unpaid campaigns cannot appear as paid/active inventory.
- [ ] Meeting attendance, minutes, resolutions and action-item permissions are verified.
- [ ] Public endpoints never expose drafts, internal content or another tenant's records.

### Release engineering gates
- [ ] `npm install` succeeds from a clean checkout.
- [ ] `npm run check -w server` passes.
- [ ] `npm run build` passes.
- [ ] Android debug build passes in CI.
- [ ] Automated API, authorization, validation and tenant-isolation tests pass.
- [ ] Dependency and secret scans pass.
- [ ] Backup restore and data export/deletion procedures are exercised.
- [ ] Vercel and Render production health checks pass after deployment.
- [ ] Pilot acceptance is signed off by a restaurant, school and hotel representative.

## MongoDB Atlas collection-budget constraint

The BlueMenu owner reported an Atlas total of 497 collections against a 500-collection cluster limit after removing the unused `ReadAllDB` collections. This is a cluster-wide limit, not a BlueMenu-only limit. Do not add one collection per feature or tenant. Reuse existing collections where appropriate, consolidate related bounded records into existing documents, and review index/collection impact before any new model is deployed. Never delete another project's database or collection to make room for BlueMenu.

## Release decision

The repository has a substantial implementation foundation, but the system must not be labelled fully production-ready until all applicable gates above have test evidence. Missing third-party credentials, physical beacons/devices, Safaricom approval, production hosting access and customer pilot sign-off are external dependencies and must be recorded as blocked rather than falsely marked complete.
