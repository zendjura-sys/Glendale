package online.gamecon.gamecon

import android.appwidget.AppWidgetManager
import android.content.Context
import android.content.SharedPreferences
import android.graphics.Color
import android.net.Uri
import android.view.View
import android.widget.RemoteViews
import es.antonborri.home_widget.HomeWidgetBackgroundIntent
import es.antonborri.home_widget.HomeWidgetLaunchIntent
import es.antonborri.home_widget.HomeWidgetPlugin
import es.antonborri.home_widget.HomeWidgetProvider

/**
 * Віджет «Тривога в моєму місці». Дані кладе Flutter (lib/alert_widget.dart): місце, статус, колір типу тривоги,
 * скільки триває. Тут лише малюємо; планове оновлення просить Flutter завантажити свіже у фоні.
 */
class AlertWidgetProvider : HomeWidgetProvider() {
    override fun onUpdate(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray, widgetData: SharedPreferences) {
        for (id in appWidgetIds) {
            val views = RemoteViews(context.packageName, R.layout.alert_widget)
            fun text(key: String, fallback: String = "") = widgetData.getString(key, null) ?: fallback

            val color = try {
                Color.parseColor(text("aw_color", "#8B93B3"))
            } catch (_: IllegalArgumentException) {
                Color.parseColor("#8B93B3")
            }
            views.setTextViewText(R.id.alert_place, text("aw_place", "GameCon"))
            views.setTextViewText(R.id.alert_status, text("aw_status", "Відкрийте застосунок"))
            views.setTextColor(R.id.alert_status, color)
            views.setInt(R.id.alert_dot, "setColorFilter", color)
            val since = text("aw_since")
            views.setTextViewText(R.id.alert_since, since)
            views.setViewVisibility(R.id.alert_since, if (since.isEmpty()) View.GONE else View.VISIBLE)
            views.setTextViewText(R.id.alert_updated, text("aw_updated"))

            views.setOnClickPendingIntent(R.id.alert_root, HomeWidgetLaunchIntent.getActivity(context, MainActivity::class.java, Uri.parse("gamecon://widget/alerts")))
            views.setOnClickPendingIntent(R.id.alert_refresh, HomeWidgetBackgroundIntent.getBroadcast(context, Uri.parse("gamecon://widget/alert-refresh")))

            appWidgetManager.updateAppWidget(id, views)
        }
    }

    override fun onUpdate(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray) {
        super.onUpdate(context, appWidgetManager, appWidgetIds)
        // Лише коли дані застаріли — інакше перемальовування після збереження запускало б завантаження по колу.
        val saved = HomeWidgetPlugin.getData(context).getString("aw_ts", null)?.toLongOrNull() ?: 0L
        if (System.currentTimeMillis() - saved < STALE_MS) return
        try {
            HomeWidgetBackgroundIntent.getBroadcast(context, Uri.parse("gamecon://widget/alert-refresh")).send()
        } catch (_: Exception) {
        }
    }

    companion object {
        private const val STALE_MS = 10L * 60 * 1000
    }
}
