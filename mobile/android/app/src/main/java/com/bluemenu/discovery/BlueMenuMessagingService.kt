package com.bluemenu.discovery

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.Executors

object PushRegistration {
    private val worker = Executors.newSingleThreadExecutor()

    fun register(context: Context, token: String, slug: String) {
        worker.execute {
            var connection: HttpURLConnection? = null
            try {
                val base = BuildConfig.API_BASE_URL.trimEnd('/')
                val safeSlug = Uri.encode(slug)
                connection = (URL("$base/api/public-bookings/$safeSlug/push-token").openConnection() as HttpURLConnection).apply {
                    requestMethod = "POST"
                    connectTimeout = 8000
                    readTimeout = 8000
                    doOutput = true
                    setRequestProperty("Content-Type", "application/json")
                }
                val body = JSONObject().put("token", token).toString().toByteArray()
                connection.outputStream.use { it.write(body) }
                connection.responseCode
            } catch (_: Exception) {
                // Token registration retries when the next venue is discovered or Firebase rotates the token.
            } finally {
                connection?.disconnect()
            }
        }
    }
}

class BlueMenuMessagingService : FirebaseMessagingService() {
    override fun onNewToken(token: String) {
        super.onNewToken(token)
        val slug = getSharedPreferences("bluemenu", Context.MODE_PRIVATE).getString("public_slug", null)
        if (!slug.isNullOrBlank()) PushRegistration.register(this, token, slug)
    }

    override fun onMessageReceived(message: RemoteMessage) {
        super.onMessageReceived(message)
        val channel = "bluemenu_updates"
        if (Build.VERSION.SDK_INT >= 26) {
            getSystemService(NotificationManager::class.java).createNotificationChannel(
                NotificationChannel(channel, "BlueMenu updates", NotificationManager.IMPORTANCE_DEFAULT)
            )
        }
        val title = message.notification?.title ?: message.data["title"] ?: "BlueMenu update"
        val body = message.notification?.body ?: message.data["body"] ?: "There is a new update from a nearby venue."
        val target = message.data["url"]
        val intent = if (!target.isNullOrBlank()) Intent(Intent.ACTION_VIEW, Uri.parse(target)) else Intent(this, MainActivity::class.java)
        val pending = PendingIntent.getActivity(
            this,
            System.currentTimeMillis().toInt(),
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        val notification = Notification.Builder(this, channel)
            .setSmallIcon(android.R.drawable.stat_sys_data_bluetooth)
            .setContentTitle(title)
            .setContentText(body)
            .setContentIntent(pending)
            .setAutoCancel(true)
            .build()
        getSystemService(NotificationManager::class.java).notify(System.currentTimeMillis().toInt(), notification)
    }
}
