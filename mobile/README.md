# BlueMenu Nearby — Android companion

This native Android companion scans for participating **iBeacon** advertisements in the foreground or, when the user opts in, through a low-power foreground service with an ongoing notification. It extracts the configured Proximity UUID, resolves it through the BlueMenu API and lets the visitor open the venue's public page.

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

Foreground scans run for 30 seconds. The optional background scanner is a user-started Android foreground service and shows an ongoing notification; the user can stop it at any time. It uses low-power BLE scan mode and does not request location updates. Android permission prompts are required. Android OEM battery managers and Doze may still pause or terminate scanning; test on target devices. QR and NFC remain the universal fallback for iPhones and phones without the companion app.

## Notes

- The companion currently supports iBeacon UUID manufacturer frames, foreground/background BLE scanning, FCM token registration after venue discovery, and notification display. Eddystone and custom BLE service advertisements are not implemented.
- The app opens public content in the phone's browser; it does not embed a webview or collect customer identity.
- Configure HTTPS for production APIs. Use a LAN IP only for local device testing.

## CI debug APK

GitHub Actions builds a debug APK for this companion. Open the latest successful **BlueMenu CI** run on the repository's Actions page and download the artifact named `bluemenu-nearby-debug-apk`. It is a debug build, not a Play Store release. A signed release workflow is enabled when the GitHub keystore secrets and BLUEMENU_API_BASE_URL repository variable are configured. Firebase Android config is supplied as the FIREBASE_ANDROID_CONFIG_BASE64 secret; the API also requires FCM_SERVICE_ACCOUNT_JSON. Test with physical beacon hardware and measure battery use before distribution.
