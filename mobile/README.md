# BlueMenu Nearby — Android companion

This native Android companion scans for participating **iBeacon** advertisements while the app is open, extracts the configured Proximity UUID, resolves it through the BlueMenu API and lets the visitor open the venue's public page.

## Build

Open `mobile/android` in Android Studio (JDK 17 and Android SDK 35). Set the API base URL in the Gradle project properties:

```properties
BLUEMENU_API_BASE_URL=https://your-deployed-api-domain
```

For local device testing, use your computer's LAN IP and port 5000, not localhost on the phone. The Android app must be able to reach the API over the network.

## Configure an iBeacon

1. Configure the beacon to advertise the Apple iBeacon manufacturer frame (company ID 0x004C).
2. Set its 16-byte Proximity UUID.
3. In the BlueMenu workspace, add a discovery point with type **BLE beacon**, identifier equal to that UUID (BlueMenu normalizes the identifier to lowercase), and target URL such as `/p/your-location-slug`.
4. Install the companion app on an Android phone and tap **Scan nearby**.

The app supports a foreground scan and an explicit **Continue scanning in background** action. Background mode runs a user-visible low-power BLE foreground service with an ongoing notification; use Stop scanning to stop it. Android permission prompts are required. OEM battery management may still throttle scans, so test on the exact target phones. QR and NFC remain the universal fallback for iPhones and phones without the companion app.

## Notes

- The companion currently supports iBeacon UUID manufacturer frames. Eddystone and custom BLE service advertisements are not supported. The background service is now implemented but requires physical-device battery and screen-lock testing. Firebase push registration is currently implemented for authenticated web workspaces; this unauthenticated companion app does not yet bind Android FCM tokens to a workspace user.
- The app opens public content in the phone's browser; it does not embed a webview or collect customer identity.
- Configure HTTPS for production APIs. Use a LAN IP only for local device testing.

## CI debug APK

GitHub Actions builds a debug APK for this companion. Open the latest successful **BlueMenu CI** run on the repository's Actions page and download the artifact named `bluemenu-nearby-debug-apk`. It is a debug build, not a Play Store release. A separate manual workflow produces a signed release APK when the four Android signing secrets are configured. Set your deployed API URL in the Gradle property when producing a production-configured build, and test with your own beacon hardware before distributing it.
