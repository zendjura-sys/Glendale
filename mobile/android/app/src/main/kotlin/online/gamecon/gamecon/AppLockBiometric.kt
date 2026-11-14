package online.gamecon.gamecon

import android.app.Activity
import android.content.pm.PackageManager
import android.hardware.biometrics.BiometricManager
import android.hardware.biometrics.BiometricPrompt
import android.os.Build
import android.os.CancellationSignal

/**
 * Біометрія для блокування застосунку без зовнішніх бібліотек: системний BiometricPrompt (API 28+),
 * працює з будь-якою Activity (AudioServiceActivity не є FragmentActivity). Нижче Android 9 — лише PIN.
 */
object AppLockBiometric {
    fun available(activity: Activity): Boolean {
        if (Build.VERSION.SDK_INT < 28) return false
        if (Build.VERSION.SDK_INT >= 30) {
            val manager = activity.getSystemService(BiometricManager::class.java) ?: return false
            return manager.canAuthenticate(BiometricManager.Authenticators.BIOMETRIC_WEAK) == BiometricManager.BIOMETRIC_SUCCESS
        }
        if (Build.VERSION.SDK_INT >= 29) {
            @Suppress("DEPRECATION")
            val manager = activity.getSystemService(BiometricManager::class.java) ?: return false
            @Suppress("DEPRECATION")
            return manager.canAuthenticate() == BiometricManager.BIOMETRIC_SUCCESS
        }
        val pm = activity.packageManager
        return pm.hasSystemFeature(PackageManager.FEATURE_FINGERPRINT)
    }

    fun authenticate(activity: Activity, title: String, cancel: String, done: (Boolean) -> Unit) {
        if (Build.VERSION.SDK_INT < 28) {
            done(false)
            return
        }
        var answered = false
        fun finish(ok: Boolean) {
            if (!answered) {
                answered = true
                done(ok)
            }
        }
        val prompt = BiometricPrompt.Builder(activity)
            .setTitle(title)
            .setNegativeButton(cancel, activity.mainExecutor) { _, _ -> finish(false) }
            .build()
        prompt.authenticate(CancellationSignal(), activity.mainExecutor, object : BiometricPrompt.AuthenticationCallback() {
            override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult?) = finish(true)
            override fun onAuthenticationError(errorCode: Int, errString: CharSequence?) = finish(false)
        })
    }
}
