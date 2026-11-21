package online.gamecon.gamecon

import android.appwidget.AppWidgetManager
import android.content.Context
import android.content.SharedPreferences
import android.net.Uri
import android.view.View
import android.widget.RemoteViews
import es.antonborri.home_widget.HomeWidgetBackgroundIntent
import es.antonborri.home_widget.HomeWidgetLaunchIntent
import es.antonborri.home_widget.HomeWidgetPlugin
import es.antonborri.home_widget.HomeWidgetProvider

/**
 * Віджет «Пульс GameCon». Дані кладе Flutter (lib/pulse_widget.dart) у SharedPreferences; тут лише малюємо.
 * Кожен лічильник відкриває свій розділ застосунку; планове оновлення просить Flutter завантажити свіже у фоні.
 */
class PulseWidgetProvider : HomeWidgetProvider() {
    override fun onUpdate(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray, widgetData: SharedPreferences) {
        for (id in appWidgetIds) {
            val views = RemoteViews(context.packageName, R.layout.pulse_widget)
            fun text(key: String, fallback: String = "") = widgetData.getString(key, null) ?: fallback
            fun open(path: String) = HomeWidgetLaunchIntent.getActivity(context, MainActivity::class.java, Uri.parse("gamecon://widget/$path"))

            views.setTextViewText(R.id.pulse_title, text("pw_title", "GameCon"))
            views.setTextViewText(R.id.pulse_messages, text("pw_messages", "—"))
            views.setTextViewText(R.id.pulse_messages_label, text("pw_messages_label", "Чати"))
            views.setTextViewText(R.id.pulse_notifications, text("pw_notifications", "—"))
            views.setTextViewText(R.id.pulse_notifications_label, text("pw_notifications_label", "Сповіщення"))
            views.setTextViewText(R.id.pulse_friends, text("pw_friends", "—"))
            views.setTextViewText(R.id.pulse_friends_label, text("pw_friends_label", "Онлайн"))
            for ((view, key) in listOf(R.id.pulse_playing to "pw_playing", R.id.pulse_progress to "pw_progress")) {
                val value = text(key)
                views.setTextViewText(view, value)
                views.setViewVisibility(view, if (value.isEmpty()) View.GONE else View.VISIBLE)
            }
            views.setTextViewText(R.id.pulse_updated, text("pw_updated"))

            views.setOnClickPendingIntent(R.id.pulse_root, open("feed"))
            views.setOnClickPendingIntent(R.id.pulse_messages_box, open("messages"))
            views.setOnClickPendingIntent(R.id.pulse_notifications_box, open("notifications"))
            views.setOnClickPendingIntent(R.id.pulse_friends_box, open("friends"))
            views.setOnClickPendingIntent(R.id.pulse_progress, open("quests"))
            views.setOnClickPendingIntent(R.id.pulse_refresh, HomeWidgetBackgroundIntent.getBroadcast(context, Uri.parse("gamecon://widget/pulse-refresh")))

            appWidgetManager.updateAppWidget(id, views)
        }
    }

    override fun onUpdate(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray) {
        super.onUpdate(context, appWidgetManager, appWidgetIds)
        // Лише коли дані застаріли — інакше перемальовування після збереження запускало б завантаження по колу.
        val saved = HomeWidgetPlugin.getData(context).getString("pw_ts", null)?.toLongOrNull() ?: 0L
        if (System.currentTimeMillis() - saved < STALE_MS) return
        try {
            HomeWidgetBackgroundIntent.getBroadcast(context, Uri.parse("gamecon://widget/pulse-refresh")).send()
        } catch (_: Exception) {
        }
    }

    companion object {
        private const val STALE_MS = 25L * 60 * 1000
    }
}
