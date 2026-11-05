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
import android.os.ParcelUuid
import android.util.Log
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.util.Locale
import java.util.concurrent.Executors

class BeaconScanService : Service() {
    private val worker=Executors.newSingleThreadExecutor()
    private val seen=mutableSetOf<String>()
    private val channelId="bluemenu_background_scan"
    private val scanner by lazy {(getSystemService(BLUETOOTH_SERVICE) as BluetoothManager).adapter?.bluetoothLeScanner}
    private val callback=object:ScanCallback(){
        override fun onScanResult(callbackType:Int,result:ScanResult){val id=parseUuid(result)?:return;synchronized(seen){if(!seen.add(id))return};resolve(id)}
        override fun onScanFailed(errorCode:Int){Log.w("BlueMenuBLE","Background scan failed: $errorCode")}
    }
    override fun onCreate(){super.onCreate();createChannel();startForeground(7001,buildStatus("Scanning nearby BlueMenu beacons"))}
    override fun onStartCommand(intent:Intent?,flags:Int,startId:Int):Int{
        if(intent?.action=="STOP"){stopScan();stopSelf();return START_NOT_STICKY}
        if(Build.VERSION.SDK_INT>=31&&checkSelfPermission(Manifest.permission.BLUETOOTH_SCAN)!=PackageManager.PERMISSION_GRANTED){stopSelf();return START_NOT_STICKY}
        try{val settings=ScanSettings.Builder().setScanMode(ScanSettings.SCAN_MODE_LOW_POWER).build();scanner?.startScan(null,settings,callback)?:throw IllegalStateException("BLE scanner unavailable")}catch(e:SecurityException){Log.e("BlueMenuBLE","Bluetooth permission missing",e);stopSelf()}catch(e:Exception){Log.e("BlueMenuBLE","Unable to start scan",e);stopSelf()}
        return START_STICKY
    }
    private fun buildStatus(text:String):Notification=Notification.Builder(this,channelId).setSmallIcon(android.R.drawable.stat_sys_data_bluetooth).setContentTitle("BlueMenu Nearby").setContentText(text).setOngoing(true).setCategory(Notification.CATEGORY_SERVICE).build()
    private fun createChannel(){if(Build.VERSION.SDK_INT>=26){val manager=getSystemService(NotificationManager::class.java);manager.createNotificationChannel(NotificationChannel(channelId,"BlueMenu nearby discovery",NotificationManager.IMPORTANCE_LOW).apply{description="Shows when background beacon discovery is active"})}}
    private fun parseUuid(result:ScanResult):String?{val data=result.scanRecord?.getManufacturerSpecificData(0x004C)?:return null;if(data.size<18||data[0]!=0x02.toByte()||data[1]!=0x15.toByte())return null;val hex=data.copyOfRange(2,18).joinToString(""){"%02x".format(it.toInt() and 0xff)};return (hex.substring(0,8)+"-"+hex.substring(8,12)+"-"+hex.substring(12,16)+"-"+hex.substring(16,20)+"-"+hex.substring(20,32)).lowercase(Locale.US)}
    private fun resolve(identifier:String){worker.execute{var c:HttpURLConnection?=null;try{val base=BuildConfig.API_BASE_URL.trimEnd('/');c=(URL("$base/api/public/discovery/$identifier").openConnection() as HttpURLConnection).apply{connectTimeout=7000;readTimeout=7000};if(c.responseCode !in 200..299)return@execute;val json=JSONObject(c.inputStream.bufferedReader().use{it.readText()});val location=json.getJSONObject("location");val target=json.getJSONObject("device").getString("targetUrl");val page=if(target.startsWith("https://"))target else base+(if(target.startsWith("/"))target else "/$target");showVenue(location.optString("name","BlueMenu venue"),page,identifier)}catch(e:Exception){Log.w("BlueMenuBLE","Beacon resolution failed",e)}finally{c?.disconnect()}}}
    private fun showVenue(name:String,url:String,id:String){val open=Intent(Intent.ACTION_VIEW,Uri.parse(url));val pending=PendingIntent.getActivity(this,id.hashCode(),open,PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE);val notification=Notification.Builder(this,channelId).setSmallIcon(android.R.drawable.stat_sys_data_bluetooth).setContentTitle("BlueMenu venue nearby").setContentText(name).setStyle(Notification.BigTextStyle().bigText("$name is nearby. Tap to open its menu or information.")).setContentIntent(pending).setAutoCancel(true).build();getSystemService(NotificationManager::class.java).notify(id.hashCode(),notification)}
    private fun stopScan(){try{scanner?.stopScan(callback)}catch(e:Exception){Log.w("BlueMenuBLE","Stop scan",e)}}
    override fun onDestroy(){stopScan();worker.shutdownNow();super.onDestroy()}
    override fun onBind(intent:Intent?):IBinder?=null
}
