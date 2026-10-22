package online.gamecon.gamecon

import android.content.pm.PackageManager
import com.ryanheise.audioservice.AudioServiceActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel
import java.security.MessageDigest

// Медіасесія плеєра (фон, шторка, заблокований екран) потребує AudioServiceActivity.
class MainActivity : AudioServiceActivity() {
    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        // Скрипт плеєра в iframe балансера (див. FrameScriptPlugin).
        flutterEngine.plugins.add(FrameScriptPlugin())
        // SHA-1 підпису встановленого застосунку — для діагностики входу через Google (DEVELOPER_ERROR).
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, "gamecon/app").setMethodCallHandler { call, result ->
            when (call.method) {
                "signingSha1" -> result.success(signingSha1())
                // «Граю в…» з телефона: доступ до використання й фонова перевірка гри на екрані.
                "usageAccess" -> result.success(PlayingDetector.hasUsageAccess(this))
                "openUsageAccess" -> {
                    startActivity(android.content.Intent(android.provider.Settings.ACTION_USAGE_ACCESS_SETTINGS))
                    result.success(true)
                }
                "playingSchedule" -> {
                    PlayingDetector.schedule(this, call.argument<Boolean>("enabled") == true)
                    result.success(true)
                }
                "playingCheck" -> {
                    PlayingDetector.checkNow(this)
                    result.success(true)
                }
                // «Вивід звуку» в плеєрі: системний перемикач навушників, колонок і Cast.
                "audioOutput" -> result.success(showOutputSwitcher())
                "bluetoothSettings" -> {
                    startActivity(android.content.Intent(android.provider.Settings.ACTION_BLUETOOTH_SETTINGS))
                    result.success(true)
                }
                else -> result.notImplemented()
            }
        }
    }

    /** Системний перемикач виводу звуку: Android 14+ — MediaRouter2, Android 11–13 — діалог SystemUI. */
    private fun showOutputSwitcher(): Boolean {
        return try {
            if (android.os.Build.VERSION.SDK_INT >= 34) {
                android.media.MediaRouter2.getInstance(this).showSystemOutputSwitcher()
            } else if (android.os.Build.VERSION.SDK_INT >= 30) {
                sendBroadcast(
                    android.content.Intent("com.android.systemui.action.LAUNCH_MEDIA_OUTPUT_DIALOG")
                        .setPackage("com.android.systemui")
                        .putExtra("package_name", packageName),
                )
                true
            } else {
                false
            }
        } catch (e: Exception) {
            false
        }
    }

    private fun signingSha1(): List<String> {
        val info = packageManager.getPackageInfo(packageName, PackageManager.GET_SIGNING_CERTIFICATES).signingInfo
            ?: return emptyList()
        val signatures = if (info.hasMultipleSigners()) info.apkContentsSigners else info.signingCertificateHistory
        return signatures.orEmpty().map { signature ->
            MessageDigest.getInstance("SHA-1").digest(signature.toByteArray()).joinToString(":") { "%02X".format(it) }
        }
    }
}
