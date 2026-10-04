package online.gamecon.gamecon

import android.app.AppOpsManager
import android.app.usage.UsageEvents
import android.app.usage.UsageStatsManager
import android.content.Context
import android.content.pm.ApplicationInfo
import android.content.pm.PackageManager
import android.os.Build
import android.os.Process
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.Worker
import androidx.work.WorkerParameters
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.TimeUnit

/**
 * «Граю в…» з телефона: раз на 15 хвилин дивимося, яка гра на екрані (Доступ до використання),
 * і повідомляємо GameCon. Надсилаємо лише ігри: категорія «Ігри» Android або пакет із каталогу GameCon.
 * Увімкнення — у застосунку (Налаштування → «Граю в…»); токен і налаштування Flutter кладе в SharedPreferences.
 */
object PlayingDetector {
    private const val PREFS = "FlutterSharedPreferences"
    private const val WORK = "gamecon-playing"
    private const val API = "https://gamecon.online/api/v1/me/playing/mobile"

    fun hasUsageAccess(context: Context): Boolean {
        val ops = context.getSystemService(Context.APP_OPS_SERVICE) as AppOpsManager
        val mode = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            ops.unsafeCheckOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, Process.myUid(), context.packageName)
        } else {
            @Suppress("DEPRECATION")
            ops.checkOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, Process.myUid(), context.packageName)
        }
        return mode == AppOpsManager.MODE_ALLOWED
    }

    fun schedule(context: Context, enabled: Boolean) {
        val work = WorkManager.getInstance(context)
        if (!enabled) {
            work.cancelUniqueWork(WORK)
            return
        }
        val request = PeriodicWorkRequestBuilder<PlayingWorker>(15, TimeUnit.MINUTES).build()
        work.enqueueUniquePeriodicWork(WORK, ExistingPeriodicWorkPolicy.UPDATE, request)
    }

    fun checkNow(context: Context) {
        WorkManager.getInstance(context).enqueue(OneTimeWorkRequestBuilder<PlayingWorker>().build())
    }

    /** Гра, що зараз на екрані: пакет і назва; null — гри немає. */
    fun currentGame(context: Context): Pair<String, String>? {
        if (!hasUsageAccess(context)) return null
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val known = (prefs.getString("flutter.game_packages", "") ?: "").split(',').filter { it.isNotBlank() }.toSet()
        val usage = context.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
        val end = System.currentTimeMillis()
        val events = usage.queryEvents(end - TimeUnit.MINUTES.toMillis(16), end)
        val event = UsageEvents.Event()
        var foreground: String? = null
        while (events.hasNextEvent()) {
            events.getNextEvent(event)
            @Suppress("DEPRECATION")
            when (event.eventType) {
                UsageEvents.Event.MOVE_TO_FOREGROUND -> foreground = event.packageName
                UsageEvents.Event.MOVE_TO_BACKGROUND -> if (foreground == event.packageName) foreground = null
            }
        }
        val pkg = foreground ?: return null
        if (pkg == context.packageName) return null
        val pm = context.packageManager
        val info = try {
            pm.getApplicationInfo(pkg, 0)
        } catch (e: PackageManager.NameNotFoundException) {
            return if (pkg in known) Pair(pkg, pkg) else null
        }
        val isGame = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && info.category == ApplicationInfo.CATEGORY_GAME
        if (!isGame && pkg !in known) return null
        return Pair(pkg, pm.getApplicationLabel(info).toString())
    }

    fun report(context: Context) {
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        if (!prefs.getBoolean("flutter.playing_mobile", false)) return
        val token = prefs.getString("flutter.token", null) ?: return
        val game = currentGame(context)
        val body = JSONObject()
        body.put("package", game?.first ?: JSONObject.NULL)
        body.put("label", game?.second ?: JSONObject.NULL)
        val connection = URL(API).openConnection() as HttpURLConnection
        try {
            connection.requestMethod = "POST"
            connection.connectTimeout = 15000
            connection.readTimeout = 15000
            connection.doOutput = true
            connection.setRequestProperty("Content-Type", "application/json")
            connection.setRequestProperty("Accept", "application/json")
            connection.setRequestProperty("Authorization", "Bearer $token")
            connection.setRequestProperty("User-Agent", "GameCon/1.0 (Android)")
            connection.outputStream.use { it.write(body.toString().toByteArray()) }
            connection.responseCode
        } finally {
            connection.disconnect()
        }
    }
}

class PlayingWorker(context: Context, params: WorkerParameters) : Worker(context, params) {
    override fun doWork(): Result {
        return try {
            PlayingDetector.report(applicationContext)
            Result.success()
        } catch (e: Exception) {
            Result.retry()
        }
    }
}
