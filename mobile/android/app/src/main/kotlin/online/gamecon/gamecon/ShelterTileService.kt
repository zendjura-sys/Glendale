package online.gamecon.gamecon

import android.net.Uri
import android.service.quicksettings.Tile
import android.service.quicksettings.TileService
import es.antonborri.home_widget.HomeWidgetBackgroundIntent
import es.antonborri.home_widget.HomeWidgetPlugin

/**
 * Плитка «Я в укритті» у шторці швидких налаштувань. Стан — з даних віджета «Тривога» (aw_shelter, кладе Flutter);
 * натискання одразу перемикає плитку й просить Flutter у фоні поставити чи зняти статус на сервері.
 */
class ShelterTileService : TileService() {
    override fun onStartListening() {
        super.onStartListening()
        render(HomeWidgetPlugin.getData(this).getString("aw_shelter", null) == "1")
    }

    override fun onClick() {
        super.onClick()
        val on = qsTile?.state != Tile.STATE_ACTIVE
        HomeWidgetPlugin.getData(this).edit().putString("aw_shelter", if (on) "1" else "0").apply()
        render(on)
        try {
            HomeWidgetBackgroundIntent.getBroadcast(this, Uri.parse("gamecon://widget/shelter-set?on=${if (on) 1 else 0}")).send()
        } catch (_: Exception) {
        }
    }

    private fun render(on: Boolean) {
        val tile = qsTile ?: return
        tile.state = if (on) Tile.STATE_ACTIVE else Tile.STATE_INACTIVE
        tile.updateTile()
    }
}
