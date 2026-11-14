package online.gamecon.gamecon

import android.Manifest
import android.annotation.SuppressLint
import android.bluetooth.BluetoothClass
import android.bluetooth.BluetoothManager
import android.content.Context
import android.content.pm.PackageManager
import android.media.AudioAttributes
import android.media.AudioDeviceInfo
import android.media.AudioManager
import android.net.nsd.NsdManager
import android.net.nsd.NsdServiceInfo
import android.net.wifi.WifiManager
import android.net.wifi.p2p.WifiP2pManager
import android.os.Build
import android.os.Handler
import android.os.Looper

/**
 * GameCon Connect: пошук пристроїв для відтворення, як у Spotify Connect.
 *  - виводи звуку телефона (динамік, дротові, Bluetooth, USB) і який із них зараз грає;
 *  - спарені Bluetooth-навушники й колонки (потрібен дозвіл BLUETOOTH_CONNECT);
 *  - Google Cast у тій самій мережі (mDNS);
 *  - пристрої поруч через Wi-Fi Direct (Android 13+, дозвіл NEARBY_WIFI_DEVICES);
 *  - замок multicast для пошуку DLNA-телевізорів і колонок (SSDP робить Dart).
 */
object ConnectScan {
    private val main = Handler(Looper.getMainLooper())
    private var multicastLock: WifiManager.MulticastLock? = null

    private val KINDS = mapOf(
        AudioDeviceInfo.TYPE_BUILTIN_SPEAKER to "phone",
        AudioDeviceInfo.TYPE_WIRED_HEADSET to "wired",
        AudioDeviceInfo.TYPE_WIRED_HEADPHONES to "wired",
        AudioDeviceInfo.TYPE_BLUETOOTH_A2DP to "bluetooth",
        AudioDeviceInfo.TYPE_USB_DEVICE to "usb",
        AudioDeviceInfo.TYPE_USB_HEADSET to "usb",
        AudioDeviceInfo.TYPE_HEARING_AID to "bluetooth",
        26 to "bluetooth", // TYPE_BLE_HEADSET
        27 to "bluetooth", // TYPE_BLE_SPEAKER
    )

    /** Підключені виводи звуку; `active` — куди зараз іде музика. */
    fun outputs(ctx: Context): List<Map<String, Any?>> {
        val am = ctx.getSystemService(Context.AUDIO_SERVICE) as AudioManager
        val devices = am.getDevices(AudioManager.GET_DEVICES_OUTPUTS).filter { KINDS.containsKey(it.type) }
        val activeKeys: Set<String>? = if (Build.VERSION.SDK_INT >= 33) {
            try {
                val attrs = AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_MEDIA).build()
                am.getDevicesForAttributes(attrs).map { "${it.type}|${it.address}" }.toSet()
            } catch (e: Exception) {
                null
            }
        } else {
            null
        }
        // Без API 33: Android віддає музику останньому підключеному — Bluetooth > дротові/USB > динамік.
        val rank = mapOf("bluetooth" to 3, "wired" to 2, "usb" to 2, "phone" to 1)
        val best = devices.maxByOrNull { rank[KINDS[it.type]] ?: 0 }
        val seen = HashSet<String>()
        return devices.mapNotNull { d ->
            val kind = KINDS[d.type] ?: return@mapNotNull null
            val address = if (Build.VERSION.SDK_INT >= 28) d.address ?: "" else ""
            val key = "$kind|${d.productName}|$address"
            if (!seen.add(key)) return@mapNotNull null
            mapOf(
                "id" to "out:${d.id}",
                "name" to if (kind == "phone") null else d.productName?.toString(),
                "kind" to kind,
                "address" to address,
                "active" to (activeKeys?.contains("${d.type}|$address") ?: (d.id == best?.id)),
            )
        }
    }

    fun hasPermission(ctx: Context, permission: String): Boolean =
        ctx.checkSelfPermission(permission) == PackageManager.PERMISSION_GRANTED

    /** Спарені аудіопристрої Bluetooth; null — немає дозволу (Android 12+). */
    @SuppressLint("MissingPermission")
    fun bonded(ctx: Context): List<Map<String, Any?>>? {
        if (Build.VERSION.SDK_INT >= 31 && !hasPermission(ctx, Manifest.permission.BLUETOOTH_CONNECT)) return null
        val adapter = (ctx.getSystemService(Context.BLUETOOTH_SERVICE) as? BluetoothManager)?.adapter ?: return emptyList()
        if (!adapter.isEnabled) return emptyList()
        return try {
            adapter.bondedDevices
                .filter { it.bluetoothClass?.majorDeviceClass == BluetoothClass.Device.Major.AUDIO_VIDEO }
                .map { mapOf("name" to (it.name ?: it.address), "address" to it.address) }
        } catch (e: SecurityException) {
            null
        }
    }

    /** Google Cast у локальній мережі (mDNS) за [ms] мілісекунд. */
    fun cast(ctx: Context, ms: Long, done: (List<Map<String, Any?>>) -> Unit) {
        val nsd = ctx.getSystemService(Context.NSD_SERVICE) as? NsdManager ?: return done(emptyList())
        val found = LinkedHashMap<String, Map<String, Any?>>()
        val listener = object : NsdManager.DiscoveryListener {
            override fun onServiceFound(info: NsdServiceInfo) {
                // «Chromecast-1a2b…» → без хвоста-ідентифікатора.
                val name = info.serviceName.replace(Regex("-[0-9a-f]{16,}$"), "").replace('-', ' ')
                synchronized(found) { found[info.serviceName] = mapOf("id" to "cast:${info.serviceName}", "name" to name, "kind" to "cast") }
            }
            override fun onServiceLost(info: NsdServiceInfo) {}
            override fun onDiscoveryStarted(type: String) {}
            override fun onDiscoveryStopped(type: String) {}
            override fun onStartDiscoveryFailed(type: String, code: Int) {}
            override fun onStopDiscoveryFailed(type: String, code: Int) {}
        }
        try {
            nsd.discoverServices("_googlecast._tcp", NsdManager.PROTOCOL_DNS_SD, listener)
        } catch (e: Exception) {
            return done(emptyList())
        }
        main.postDelayed({
            try {
                nsd.stopServiceDiscovery(listener)
            } catch (_: Exception) {
            }
            done(synchronized(found) { found.values.toList() })
        }, ms)
    }

    /** Пристрої поруч через Wi-Fi Direct; null — не підтримується чи немає дозволу. */
    @SuppressLint("MissingPermission")
    fun wifiDirect(ctx: Context, ms: Long, done: (List<Map<String, Any?>>?) -> Unit) {
        if (Build.VERSION.SDK_INT < 33 || !hasPermission(ctx, Manifest.permission.NEARBY_WIFI_DEVICES)) return done(null)
        val manager = ctx.getSystemService(Context.WIFI_P2P_SERVICE) as? WifiP2pManager ?: return done(null)
        val channel = manager.initialize(ctx, Looper.getMainLooper(), null) ?: return done(null)
        try {
            manager.discoverPeers(channel, null)
        } catch (e: Exception) {
            return done(null)
        }
        main.postDelayed({
            try {
                manager.requestPeers(channel) { list ->
                    val peers = list?.deviceList.orEmpty().map {
                        // primaryDeviceType «7-…» — дисплей (телевізор, Miracast), «11-…» — аудіо.
                        val type = it.primaryDeviceType ?: ""
                        mapOf(
                            "id" to "p2p:${it.deviceAddress}",
                            "name" to (it.deviceName?.takeIf { n -> n.isNotBlank() } ?: it.deviceAddress),
                            "kind" to when {
                                type.startsWith("7-") -> "display"
                                type.startsWith("11-") -> "audio"
                                type.startsWith("10-") -> "phone"
                                else -> "other"
                            },
                        )
                    }
                    try {
                        manager.stopPeerDiscovery(channel, null)
                    } catch (_: Exception) {
                    }
                    done(peers)
                }
            } catch (e: Exception) {
                done(null)
            }
        }, ms)
    }

    /** Без замка Wi-Fi відкидає multicast — DLNA-пристрої (SSDP) не відповідали б. */
    @Suppress("DEPRECATION")
    fun multicast(ctx: Context, held: Boolean) {
        val wifi = ctx.applicationContext.getSystemService(Context.WIFI_SERVICE) as? WifiManager ?: return
        val lock = multicastLock ?: wifi.createMulticastLock("gamecon:connect").also {
            it.setReferenceCounted(false)
            multicastLock = it
        }
        if (held && !lock.isHeld) lock.acquire()
        if (!held && lock.isHeld) lock.release()
    }
}
