package com.bluemenu.discovery

import android.Manifest
import android.app.Activity
import android.app.NotificationChannel
import android.app.NotificationManager
import android.os.Build
import android.bluetooth.BluetoothManager
import android.bluetooth.BluetoothAdapter
import android.bluetooth.le.ScanCallback
import android.bluetooth.le.ScanResult
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.Gravity
import android.view.View
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.util.Locale
import java.util.concurrent.Executors
import com.google.firebase.messaging.FirebaseMessaging

class MainActivity : Activity() {
    private val worker = Executors.newSingleThreadExecutor()
    private val main = Handler(Looper.getMainLooper())
    private val seen = mutableSetOf<String>()
    private lateinit var status: TextView
    private lateinit var results: LinearLayout
    private var scanning = false

    private val scanner by lazy {
        (getSystemService(BLUETOOTH_SERVICE) as BluetoothManager).adapter.bluetoothLeScanner
    }

    private val callback = object : ScanCallback() {
        override fun onScanResult(callbackType: Int, result: ScanResult) {
            val identifier = parseIBeaconUuid(result) ?: return
            synchronized(seen) {
                if (!seen.add(identifier)) return
            }
            resolveVenue(identifier)
        }

        override fun onScanFailed(errorCode: Int) {
            main.post { status.text = "Bluetooth scan failed ($errorCode). Check Bluetooth and permissions." }
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        if (Build.VERSION.SDK_INT >= 26) getSystemService(NotificationManager::class.java).createNotificationChannel(NotificationChannel("bluemenu_updates", "BlueMenu updates", NotificationManager.IMPORTANCE_DEFAULT))
        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(28, 36, 28, 24)
            setBackgroundColor(0xFFF4F7F3.toInt())
        }
        val title = TextView(this).apply {
            text = "BlueMenu Nearby"
            textSize = 26f
            setTextColor(0xFF1D4938.toInt())
            gravity = Gravity.CENTER_VERTICAL
        }
        val intro = TextView(this).apply {
            text = "Find participating venues nearby. Select a result to open its live menu, agenda or guest information."
            textSize = 14f
            setTextColor(0xFF627368.toInt())
            setPadding(0, 12, 0, 18)
        }
        status = TextView(this).apply {
            text = "Ready to scan for BlueMenu beacons."
            textSize = 13f
            setTextColor(0xFF365D48.toInt())
            setPadding(0, 10, 0, 16)
        }
        val start = Button(this).apply {
            text = "Scan nearby"
            setOnClickListener { requestScanPermissionAndStart() }
        }
        val background = Button(this).apply { text = "Enable background discovery"; setOnClickListener { requestBackgroundDiscovery() } }
        val stopBackground = Button(this).apply { text = "Stop background discovery"; setOnClickListener { stopService(Intent(this@MainActivity, BeaconScanService::class.java)); status.text = "Background discovery stopped." } }
        val stop = Button(this).apply {
            text = "Stop scanning"
            setOnClickListener { stopScanning() }
        }
        results = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
        root.addView(title)
        root.addView(intro)
        root.addView(start)
        root.addView(stop)
        root.addView(background)
        root.addView(stopBackground)
        root.addView(status)
        root.addView(results)
        setContentView(root)
    }

    private fun requestScanPermissionAndStart() {
        val needed = if (Build.VERSION.SDK_INT >= 31) {
            arrayOf(Manifest.permission.BLUETOOTH_SCAN, Manifest.permission.BLUETOOTH_CONNECT)
        } else {
            arrayOf(Manifest.permission.ACCESS_FINE_LOCATION)
        }
        val missing = needed.filter { checkSelfPermission(it) != PackageManager.PERMISSION_GRANTED }
        if (missing.isNotEmpty()) {
            requestPermissions(missing.toTypedArray(), 41)
            return
        }
        startScanning()
    }

    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode == 41 && grantResults.isNotEmpty() && grantResults.all { it == PackageManager.PERMISSION_GRANTED }) {
            startScanning()
        } else if (requestCode == 41) {
            status.text = "Bluetooth permission is required to discover nearby BlueMenu beacons."
        } else if (requestCode == 43 && grantResults.isNotEmpty() && grantResults.all { it == PackageManager.PERMISSION_GRANTED }) {
            startBackgroundDiscovery()
        } else if (requestCode == 43) { status.text = "Notification permission is needed to show background discovery status." }
        else if (requestCode == 44 && grantResults.isNotEmpty() && grantResults.all { it == PackageManager.PERMISSION_GRANTED }) { startBackgroundDiscovery() }
        else if (requestCode == 44) { status.text = "Bluetooth permission is required for background discovery." }
    }

    private fun requestBackgroundDiscovery() {
        if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(arrayOf(Manifest.permission.POST_NOTIFICATIONS), 43)
            return
        }
        startBackgroundDiscovery()
    }

    private fun startBackgroundDiscovery() {
        val needed = if (Build.VERSION.SDK_INT >= 31) arrayOf(Manifest.permission.BLUETOOTH_SCAN, Manifest.permission.BLUETOOTH_CONNECT) else arrayOf(Manifest.permission.ACCESS_FINE_LOCATION)
        val missing = needed.filter { checkSelfPermission(it) != PackageManager.PERMISSION_GRANTED }
        if (missing.isNotEmpty()) { requestPermissions(missing.toTypedArray(), 44); return }
        val adapter = (getSystemService(BLUETOOTH_SERVICE) as BluetoothManager).adapter
        if (adapter == null) { status.text = "Bluetooth is not available on this phone."; return }
        if (!adapter.isEnabled) { status.text = "Turn on Bluetooth to enable background discovery."; startActivityForResult(Intent(BluetoothAdapter.ACTION_REQUEST_ENABLE), 45); return }
        try {
            val intent = Intent(this, BeaconScanService::class.java)
            if (Build.VERSION.SDK_INT >= 26) startForegroundService(intent) else startService(intent)
            status.text = "Background discovery enabled. Android displays an ongoing notification while scanning."
        } catch (error: Exception) {
            status.text = "Could not enable background discovery: ${error.message}"
        }
    }

    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode == 42 && resultCode == RESULT_OK) startScanning()
        if (requestCode == 45 && resultCode == RESULT_OK) startBackgroundDiscovery()
    }

    private fun startScanning() {
        val adapter = (getSystemService(BLUETOOTH_SERVICE) as BluetoothManager).adapter
        if (adapter == null) { status.text = "Bluetooth is not available on this phone."; return }
        if (!adapter.isEnabled) { startActivityForResult(Intent(BluetoothAdapter.ACTION_REQUEST_ENABLE), 42); return }
        if (Build.VERSION.SDK_INT >= 31 && checkSelfPermission(Manifest.permission.BLUETOOTH_SCAN) != PackageManager.PERMISSION_GRANTED) return
        if (scanner == null) {
            status.text = "This device does not have an available Bluetooth LE scanner."
            return
        }
        try {
            synchronized(seen) { seen.clear() }
            results.removeAllViews()
            scanner.startScan(callback)
            scanning = true
            status.text = "Scanning for BlueMenu iBeacon UUIDs for 30 seconds…"
            main.postDelayed({ stopScanning() }, 30_000)
        } catch (error: SecurityException) {
            status.text = "Bluetooth permission was denied. Enable Nearby devices permission in Settings."
        } catch (error: Exception) {
            status.text = "Could not start scanning: ${error.message}"
        }
    }

    private fun stopScanning() {
        if (!scanning) return
        try {
            if (Build.VERSION.SDK_INT < 31 || checkSelfPermission(Manifest.permission.BLUETOOTH_SCAN) == PackageManager.PERMISSION_GRANTED) {
                scanner?.stopScan(callback)
            }
        } catch (_: Exception) { }
        scanning = false
        status.text = "Scan stopped. Tap Scan nearby to search again."
    }

    private fun parseIBeaconUuid(result: ScanResult): String? {
        val record = result.scanRecord ?: return null
        val data = record.getManufacturerSpecificData(0x004C) ?: return null
        if (data.size < 18 || data[0] != 0x02.toByte() || data[1] != 0x15.toByte()) return null
        val bytes = data.copyOfRange(2, 18)
        val hex = bytes.joinToString("") { "%02x".format(it.toInt() and 0xff) }
        return (hex.substring(0, 8) + "-" + hex.substring(8, 12) + "-" +
            hex.substring(12, 16) + "-" + hex.substring(16, 20) + "-" +
            hex.substring(20, 32)).lowercase(Locale.US)
    }

    private fun resolveVenue(identifier: String) {
        worker.execute {
            var connection: HttpURLConnection? = null
            try {
                val base = BuildConfig.API_BASE_URL.trimEnd('/')
                if (base.contains("your-api-domain.example")) throw IllegalStateException("Set BLUEMENU_API_BASE_URL in the Android build configuration.")
                connection = (URL("$base/api/public/discovery/$identifier").openConnection() as HttpURLConnection).apply {
                    requestMethod = "GET"
                    connectTimeout = 7000
                    readTimeout = 7000
                }
                if (connection.responseCode !in 200..299) return@execute
                val body = connection.inputStream.bufferedReader().use { it.readText() }
                val json = JSONObject(body)
                val location = json.getJSONObject("location")
                val slug = location.optString("publicSlug", "")
                if (slug.isNotBlank()) {
                    getSharedPreferences("bluemenu", MODE_PRIVATE).edit().putString("public_slug", slug).apply()
                    try { FirebaseMessaging.getInstance().token.addOnSuccessListener { token -> PushRegistration.register(this, token, slug) } } catch (_: Exception) { }
                }
                val device = json.getJSONObject("device")
                val target = device.getString("targetUrl")
                val publicUrl = if (target.startsWith("https://")) target else base + if (target.startsWith("/")) target else "/$target"
                main.post { addVenue(location.optString("name", "BlueMenu venue"), publicUrl, identifier) }
            } catch (error: Exception) {
                main.post { status.text = "A beacon was detected, but BlueMenu could not resolve it: ${error.message}" }
            } finally {
                connection?.disconnect()
            }
        }
    }

    private fun addVenue(name: String, url: String, identifier: String) {
        val card = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(18, 14, 18, 14)
            setBackgroundColor(0xFFFFFFFF.toInt())
        }
        val label = TextView(this).apply {
            text = name
            textSize = 17f
            setTextColor(0xFF1D4938.toInt())
        }
        val detail = TextView(this).apply {
            text = "Nearby BlueMenu beacon · $identifier"
            textSize = 10f
            setTextColor(0xFF718176.toInt())
            setPadding(0, 5, 0, 8)
        }
        val open = Button(this).apply {
            text = "Open menu or information"
            setOnClickListener { startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url))) }
        }
        card.addView(label)
        card.addView(detail)
        card.addView(open)
        results.addView(card)
        status.text = "BlueMenu venue found. Tap a result to open it."
    }

    override fun onDestroy() {
        stopScanning()
        worker.shutdownNow()
        super.onDestroy()
    }
}
