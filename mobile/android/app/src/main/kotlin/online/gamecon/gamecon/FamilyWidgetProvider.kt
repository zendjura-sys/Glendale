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
 * Віджет «Моя сім’я» на головному екрані. Дані кладе Flutter (lib/family_widget.dart) у SharedPreferences;
 * тут лише малюємо. Планове оновлення Android (раз на 30 хв) просить Flutter у фоні завантажити свіжі дані.
 */
class FamilyWidgetProvider : HomeWidgetProvider() {
    override fun onUpdate(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray, widgetData: SharedPreferences) {
        for (id in appWidgetIds) {
            val views = RemoteViews(context.packageName, R.layout.family_widget)
            fun text(key: String, fallback: String = "") = widgetData.getString(key, null) ?: fallback

            views.setTextViewText(R.id.widget_title, text("fw_title", "GameCon"))
            views.setTextViewText(R.id.widget_rank, text("fw_rank", "Відкрийте застосунок, щоб показати свою сім’ю"))
            // Що показувати, обирають у застосунку (Налаштування → Віджет): порожнє значення — блок прихований.
            fun show(view: Int, key: String): Boolean {
                val value = text(key)
                views.setTextViewText(view, value)
                views.setViewVisibility(view, if (value.isEmpty()) View.GONE else View.VISIBLE)
                return value.isNotEmpty()
            }
            val balance = show(R.id.widget_balance, "fw_balance")
            views.setTextViewText(R.id.widget_balance_label, text("fw_balance_label", "Ваш рахунок у сім’ї"))
            views.setViewVisibility(R.id.widget_balance_label, if (balance) View.VISIBLE else View.GONE)
            val chips = listOf(show(R.id.widget_week, "fw_week"), show(R.id.widget_place, "fw_place"), show(R.id.widget_bizwar, "fw_bizwar"))
            views.setViewVisibility(R.id.widget_chips, if (chips.any { it }) View.VISIBLE else View.GONE)
            show(R.id.widget_event, "fw_event")
            views.setTextViewText(R.id.widget_updated, text("fw_updated"))

            val slug = text("fw_slug")
            val open = Uri.parse(if (slug.isEmpty()) "gamecon://widget/families" else "gamecon://widget/family/$slug")
            views.setOnClickPendingIntent(R.id.widget_root, HomeWidgetLaunchIntent.getActivity(context, MainActivity::class.java, open))
            views.setOnClickPendingIntent(R.id.widget_refresh, HomeWidgetBackgroundIntent.getBroadcast(context, Uri.parse("gamecon://widget/refresh")))

            appWidgetManager.updateAppWidget(id, views)
        }
    }

    override fun onUpdate(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray) {
        super.onUpdate(context, appWidgetManager, appWidgetIds)
        // Планове оновлення: свіжі дані з сервера (без відкриття застосунку). Лише коли дані застаріли —
        // інакше перемальовування після збереження знову запускало б завантаження по колу.
        val saved = HomeWidgetPlugin.getData(context).getString("fw_ts", null)?.toLongOrNull() ?: 0L
        if (System.currentTimeMillis() - saved < STALE_MS) return
        try {
            HomeWidgetBackgroundIntent.getBroadcast(context, Uri.parse("gamecon://widget/refresh")).send()
        } catch (_: Exception) {
        }
    }

    companion object {
        private const val STALE_MS = 25L * 60 * 1000
    }
}
