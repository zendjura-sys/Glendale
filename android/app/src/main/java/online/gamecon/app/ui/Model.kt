package online.gamecon.app.ui

import android.app.Application
import android.content.Intent
import android.net.Uri
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import online.gamecon.app.data.Account
import online.gamecon.app.data.Api
import online.gamecon.app.data.Session
import online.gamecon.app.data.TrackPlayer

class GameConModel(app: Application) : AndroidViewModel(app) {
    val session = Session(app)
    val api = Api { session.token() }
    val player = TrackPlayer(app)

    var token by mutableStateOf(session.token())
        private set
    var me by mutableStateOf<Account?>(null)
    var handoff by mutableStateOf<Uri?>(null)
    var notice by mutableStateOf<String?>(null)

    fun saveToken(value: String) {
        session.save(value)
        token = value
        viewModelScope.launch(Dispatchers.IO) {
            runCatching { api.me() }.onSuccess { me = it }
        }
    }

    fun logout() {
        viewModelScope.launch(Dispatchers.IO) { runCatching { api.logout() } }
        session.clear()
        token = null
        me = null
    }

    fun consume(intent: Intent?) {
        val data = intent?.data ?: return
        if (data.scheme == "gamecon") handoff = data
    }

    override fun onCleared() {
        player.release()
    }
}
