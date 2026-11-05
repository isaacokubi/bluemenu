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

The app currently scans in the foreground for 30 seconds at a time. It does not run as a background service and does not continuously track location. Android permission prompts are required. QR and NFC remain the universal fallback for iPhones and phones without the companion app.

## Notes

- The companion currently supports iBeacon UUID manufacturer frames. Eddystone, custom BLE service advertisements, background scanning, notification delivery and store signing are future work.
- The app opens public content in the phone's browser; it does not embed a webview or collect customer identity.
- Configure HTTPS for production APIs. Use a LAN IP only for local device testing.

## CI debug APK

GitHub Actions builds a debug APK for this companion. Open the latest successful **BlueMenu CI** run on the repository's Actions page and download the artifact named `bluemenu-nearby-debug-apk`. It is a debug build, not a Play Store release. Set your deployed API URL in the Gradle property when producing a production-configured build, and test with your own beacon hardware before distributing it.
