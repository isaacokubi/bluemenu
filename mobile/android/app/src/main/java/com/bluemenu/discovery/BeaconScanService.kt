package com.bluemenu.discovery

import android.Manifest
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.bluetooth.BluetoothManager
import android.bluetooth.le.ScanCallback
import android.bluetooth.le.ScanResult
import android.bluetooth.le.ScanSettings
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationManagerCompat
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.util.Locale
import java.util.concurrent.Executors

class BeaconScanService : Service() {
    companion object {
        const val ACTION_START = "com.bluemenu.discovery.START_SCAN"
        const val ACTION_STOP = "com.bluemenu.discovery.STOP_SCAN"
        private const val CHANNEL = "bluemenu_beacon_scan"
        private const val NOTIFICATION_ID = 7101
    }

    private val worker = Executors.newSingleThreadExecutor()
    private val seen = mutableSetOf<String>()
    private var scanning = false
    private val scanner by lazy { (getSystemService(BLUETOOTH_SERVICE) as BluetoothManager).adapter?.bluetoothLeScanner }

    private val callback = object : ScanCallback() {
        override fun onScanResult(callbackType: Int, result: ScanResult) {
            val identifier = parseIBeaconUuid(result) ?: return
            synchronized(seen) { if (!seen.add(identifier)) return }
            resolveVenue(identifier)
        }
        override fun onScanFailed(errorCode: Int) {
            updateNotification("Bluetooth scan paused (error $errorCode). Open BlueMenu Nearby to retry.")
        }
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        val manager = getSystemService(NOTIFICATION_SERVICE) as NotificationManager
        if (Build.VERSION.SDK_INT >= 26) manager.createNotificationChannel(
            NotificationChannel(CHANNEL, "BlueMenu nearby discovery", NotificationManager.IMPORTANCE_LOW).apply {
                description = "Visible notification while nearby venue discovery is running"
            }
        )
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == ACTION_STOP) {
            stopScan()
            stopForeground(STOP_FOREGROUND_REMOVE)
            stopSelf()
            return START_NOT_STICKY
        }
        val notification = buildNotification("Scanning nearby BlueMenu beacons")
        if (Build.VERSION.SDK_INT >= 29) {
            startForeground(NOTIFICATION_ID, notification, android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_CONNECTED_DEVICE)
        } else startForeground(NOTIFICATION_ID, notification)
        startScan()
        return START_STICKY
    }

    private fun startScan() {
        if (Build.VERSION.SDK_INT >= 31 &&
            (checkSelfPermission(Manifest.permission.BLUETOOTH_SCAN) != PackageManager.PERMISSION_GRANTED ||
             checkSelfPermission(Manifest.permission.BLUETOOTH_CONNECT) != PackageManager.PERMISSION_GRANTED)) {
            updateNotification("Nearby-device permission is required. Open the app to grant it.")
            stopSelf()
            return
        }
        try {
            synchronized(seen) { seen.clear() }
            val adapter = (getSystemService(BLUETOOTH_SERVICE) as BluetoothManager).adapter
            if (adapter?.isEnabled != true) {
                updateNotification("Bluetooth is off. Turn it on and restart discovery.")
                stopSelf()
                return
            }
            val activeScanner = scanner
            if (activeScanner == null) {
                updateNotification("Bluetooth LE scanning is unavailable on this device.")
                stopSelf()
                return
            }
            activeScanner.startScan(null, ScanSettings.Builder().setScanMode(ScanSettings.SCAN_MODE_LOW_POWER).build(), callback)
            scanning = true
            updateNotification("Scanning in the background. Tap to open BlueMenu Nearby.")
        } catch (error: SecurityException) {
            updateNotification("Bluetooth permission was denied. Open the app to enable it.")
            stopSelf()
        } catch (error: Exception) {
            updateNotification("Could not start nearby discovery: ${error.message}")
            stopSelf()
        }
    }

    private fun stopScan() {
        if (!scanning) return
        try { scanner?.stopScan(callback) } catch (_: Exception) { }
        scanning = false
    }

    private fun parseIBeaconUuid(result: ScanResult): String? {
        val data = result.scanRecord?.getManufacturerSpecificData(0x004C) ?: return null
        if (data.size < 18 || data[0] != 0x02.toByte() || data[1] != 0x15.toByte()) return null
        val hex = data.copyOfRange(2, 18).joinToString("") { "%02x".format(it.toInt() and 0xff) }
        return (hex.substring(0,8)+"-"+hex.substring(8,12)+"-"+hex.substring(12,16)+"-"+hex.substring(16,20)+"-"+hex.substring(20,32)).lowercase(Locale.US)
    }

    private fun resolveVenue(identifier: String) {
        worker.execute {
            var connection: HttpURLConnection? = null
            try {
                val base = BuildConfig.API_BASE_URL.trimEnd('/')
                if (base.contains("your-api-domain.example")) return@execute
                connection = (URL("$base/api/public/discovery/$identifier").openConnection() as HttpURLConnection).apply {
                    connectTimeout = 7000
                    readTimeout = 7000
                }
                if (connection.responseCode !in 200..299) return@execute
                val body = connection.inputStream.bufferedReader().use { it.readText() }
                val json = JSONObject(body)
                val location = json.getJSONObject("location")
                val device = json.getJSONObject("device")
                val target = device.getString("targetUrl")
                val targetUrl = if (target.startsWith("https://")) target else base + if (target.startsWith("/")) target else "/$target"
                updateNotification("BlueMenu venue found: ${location.optString("name", "Nearby venue")}", targetUrl)
            } catch (_: Exception) {
                updateNotification("A nearby beacon was detected. Open the app for details.")
            } finally { connection?.disconnect() }
        }
    }

    private fun buildNotification(text: String, url: String? = null): Notification {
        val openIntent = if (url != null) Intent(Intent.ACTION_VIEW, Uri.parse(url)) else Intent(this, MainActivity::class.java)
        val pending = PendingIntent.getActivity(this, 7102, openIntent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        val builder = if (Build.VERSION.SDK_INT >= 26) Notification.Builder(this, CHANNEL) else Notification.Builder(this)
        return builder.setSmallIcon(android.R.drawable.stat_sys_data_bluetooth)
            .setContentTitle("BlueMenu Nearby").setContentText(text).setContentIntent(pending)
            .setOngoing(true).setOnlyAlertOnce(true).build()
    }

    private fun updateNotification(text: String, url: String? = null) {
        val manager = getSystemService(NOTIFICATION_SERVICE) as NotificationManager
        manager.notify(NOTIFICATION_ID, buildNotification(text, url))
    }

    override fun onDestroy() {
        stopScan()
        worker.shutdownNow()
        super.onDestroy()
    }
}
