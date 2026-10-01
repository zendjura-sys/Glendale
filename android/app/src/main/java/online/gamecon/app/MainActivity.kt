package online.gamecon.app

import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import androidx.lifecycle.ViewModelProvider
import online.gamecon.app.ui.AuthScreen
import online.gamecon.app.ui.GameConModel
import online.gamecon.app.ui.GameConTheme
import online.gamecon.app.ui.Shell

class MainActivity : ComponentActivity() {
    private val model by lazy { ViewModelProvider(this)[GameConModel::class.java] }

    override fun onCreate(savedInstanceState: Bundle?) {
        installSplashScreen()
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        model.consume(intent)
        setContent {
            GameConTheme {
                if (model.token == null) AuthScreen(model) else Shell(model)
            }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        model.consume(intent)
    }
}
