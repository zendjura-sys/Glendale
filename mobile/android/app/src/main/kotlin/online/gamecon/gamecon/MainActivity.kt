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
        // SHA-1 підпису встановленого застосунку — для діагностики входу через Google (DEVELOPER_ERROR).
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, "gamecon/app").setMethodCallHandler { call, result ->
            if (call.method == "signingSha1") result.success(signingSha1()) else result.notImplemented()
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
