package online.gamecon.auth

import android.app.Activity
import android.content.Intent
import android.net.Uri
import net.openid.appauth.AuthorizationException
import net.openid.appauth.AuthorizationRequest
import net.openid.appauth.AuthorizationResponse
import net.openid.appauth.AuthorizationService
import net.openid.appauth.AuthorizationServiceConfiguration
import net.openid.appauth.ResponseTypeValues
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import kotlin.concurrent.thread

/**
 * «Увійти через GameCon» для Android на AppAuth (Custom Tabs, PKCE — автоматично).
 * Публічний клієнт: без секрету. Адреса повернення — своя схема, напр. com.example.game://oauth
 */
class GameConAuth(
    private val activity: Activity,
    private val clientId: String,
    private val redirect: Uri,
    private val base: String = "https://gamecon.online",
) {
    private val config = AuthorizationServiceConfiguration(
        Uri.parse("$base/oauth/authorize"),
        Uri.parse("$base/oauth/token"),
    )
    private val service = AuthorizationService(activity)

    /** Відкриває вхід; результат прийде в onActivityResult із [requestCode]. */
    fun start(requestCode: Int = 4242, scope: String = "profile email") {
        val request = AuthorizationRequest.Builder(config, clientId, ResponseTypeValues.CODE, redirect)
            .setScope(scope)
            .build()
        activity.startActivityForResult(service.getAuthorizationRequestIntent(request), requestCode)
    }

    /** Обмін коду на токен і профіль (sub, preferred_username, name, email, picture). */
    fun finish(data: Intent?, done: (profile: JSONObject?, error: String?) -> Unit) {
        val response = data?.let { AuthorizationResponse.fromIntent(it) }
        val error = data?.let { AuthorizationException.fromIntent(it) }
        if (response == null) return done(null, error?.errorDescription ?: "Вхід скасовано")
        service.performTokenRequest(response.createTokenExchangeRequest()) { token, ex ->
            val access = token?.accessToken ?: return@performTokenRequest done(null, ex?.errorDescription ?: "Немає токена")
            thread {
                try {
                    val conn = URL("$base/api/developer/v1/userinfo").openConnection() as HttpURLConnection
                    conn.setRequestProperty("Authorization", "Bearer $access")
                    val profile = JSONObject(conn.inputStream.bufferedReader().readText())
                    activity.runOnUiThread { done(profile, null) }
                } catch (e: Exception) {
                    activity.runOnUiThread { done(null, e.message) }
                }
            }
        }
    }

    fun dispose() = service.dispose()
}
