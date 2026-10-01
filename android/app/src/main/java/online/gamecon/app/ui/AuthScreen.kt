package online.gamecon.app.ui

import android.net.Uri
import androidx.browser.customtabs.CustomTabsIntent
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.credentials.CredentialManager
import androidx.credentials.CustomCredential
import androidx.credentials.GetCredentialRequest
import com.google.android.libraries.identity.googleid.GetGoogleIdOption
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import online.gamecon.app.R
import online.gamecon.app.data.account
import online.gamecon.app.data.obj
import online.gamecon.app.data.s
import org.json.JSONObject

@Composable
fun AuthScreen(model: GameConModel) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var mode by remember { mutableStateOf("login") }
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var first by remember { mutableStateOf("") }
    var last by remember { mutableStateOf("") }
    var error by remember { mutableStateOf<String?>(null) }
    var busy by remember { mutableStateOf(false) }
    var ticket by remember { mutableStateOf<String?>(null) }
    var code by remember { mutableStateOf("") }

    fun accept(json: JSONObject) {
        if (json.optBoolean("two_factor")) {
            ticket = json.s("ticket")
            return
        }
        val token = json.s("token") ?: return
        model.saveToken(token)
        model.me = json.obj("user")?.account()
    }

    LaunchedEffect(model.handoff) {
        val uri = model.handoff ?: return@LaunchedEffect
        if (uri.host != "auth") return@LaunchedEffect
        model.handoff = null
        val failure = uri.getQueryParameter("error")
        val exchange = uri.getQueryParameter("code")
        val pending = uri.getQueryParameter("ticket")
        when {
            !failure.isNullOrBlank() -> error = Uri.decode(failure)
            !exchange.isNullOrBlank() -> {
                busy = true
                runCatching { withContext(Dispatchers.IO) { model.api.exchange(exchange) } }
                    .onSuccess { accept(it) }
                    .onFailure { error = it.message }
                busy = false
            }
            !pending.isNullOrBlank() -> ticket = pending
        }
    }

    Stage {
        Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(24.dp)) {
            Spacer(Modifier.height(48.dp))
            Wordmark()
            Text("Соціальна мережа гравців", color = Muted, fontFamily = Onest, modifier = Modifier.padding(top = 8.dp, bottom = 28.dp))
            Glass {
                if (ticket != null) {
                    Text("Код із застосунку", fontFamily = Unbounded, color = Ink)
                    Spacer(Modifier.height(12.dp))
                    GcField(code, { code = it }, "Код", keyboard = KeyboardType.Number)
                    Spacer(Modifier.height(12.dp))
                    PrimaryButton("Підтвердити", !busy) {
                        scope.launch {
                            busy = true
                            runCatching { withContext(Dispatchers.IO) { model.api.twoFactor(ticket!!, code, null) } }
                                .onSuccess { accept(it) }
                                .onFailure { error = it.message }
                            busy = false
                        }
                    }
                } else {
                    Text(if (mode == "login") "Вхід" else "Реєстрація", fontFamily = Unbounded, fontWeight = FontWeight.Bold, fontSize = 22.sp, color = Ink)
                    Spacer(Modifier.height(14.dp))
                    if (mode == "register") {
                        GcField(first, { first = it }, "Ім’я")
                        Spacer(Modifier.height(8.dp))
                        GcField(last, { last = it }, "Прізвище")
                        Spacer(Modifier.height(8.dp))
                    }
                    GcField(email, { email = it }, "Пошта", keyboard = KeyboardType.Email)
                    Spacer(Modifier.height(8.dp))
                    GcField(password, { password = it }, "Пароль", password = true)
                    if (error != null) Text(error!!, color = Pink, fontFamily = Onest, modifier = Modifier.padding(top = 8.dp))
                    Spacer(Modifier.height(14.dp))
                    PrimaryButton(if (mode == "login") "Увійти" else "Створити акаунт", !busy) {
                        scope.launch {
                            busy = true
                            error = null
                            val result = runCatching {
                                withContext(Dispatchers.IO) {
                                    if (mode == "login") model.api.login(email.trim(), password) else model.api.register(first.trim(), last.trim(), email.trim(), password)
                                }
                            }
                            result.onSuccess { accept(it) }.onFailure { error = it.message }
                            busy = false
                        }
                    }
                    Spacer(Modifier.height(8.dp))
                    PrimaryButton("Увійти через Google", !busy) {
                        scope.launch {
                            busy = true
                            error = null
                            runCatching {
                                val option = GetGoogleIdOption.Builder()
                                    .setFilterByAuthorizedAccounts(false)
                                    .setServerClientId(context.getString(R.string.google_web_client_id))
                                    .setAutoSelectEnabled(false)
                                    .build()
                                val request = GetCredentialRequest.Builder().addCredentialOption(option).build()
                                val result = CredentialManager.create(context).getCredential(context, request)
                                val credential = result.credential
                                if (credential is CustomCredential && credential.type == GoogleIdTokenCredential.TYPE_GOOGLE_ID_TOKEN_CREDENTIAL) {
                                    val id = GoogleIdTokenCredential.createFrom(credential.data).idToken
                                    withContext(Dispatchers.IO) { model.api.google(id) }
                                } else {
                                    throw IllegalStateException("Google не повернув токен.")
                                }
                            }.onSuccess { accept(it) }.onFailure { error = it.message ?: "Вхід через Google скасовано." }
                            busy = false
                        }
                    }
                    Spacer(Modifier.height(8.dp))
                    PrimaryButton("Увійти через Discord", !busy) {
                        scope.launch {
                            busy = true
                            error = null
                            runCatching { withContext(Dispatchers.IO) { model.api.discordUrl() } }
                                .onSuccess { url ->
                                    CustomTabsIntent.Builder().setShowTitle(false).build().launchUrl(context, Uri.parse(url))
                                }
                                .onFailure { error = it.message }
                            busy = false
                        }
                    }
                }
            }
            TextButton(onClick = { mode = if (mode == "login") "register" else "login"; error = null }) {
                Text(if (mode == "login") "Немає акаунта? Реєстрація" else "Вже є акаунт? Увійти", color = Cyan, fontFamily = Onest)
            }
        }
    }
}

@Composable
fun GcField(value: String, onChange: (String) -> Unit, label: String, password: Boolean = false, keyboard: KeyboardType = KeyboardType.Text) {
    OutlinedTextField(
        value = value,
        onValueChange = onChange,
        modifier = Modifier.fillMaxWidth(),
        label = { Text(label) },
        singleLine = true,
        visualTransformation = if (password) PasswordVisualTransformation() else VisualTransformation.None,
        keyboardOptions = KeyboardOptions(keyboardType = keyboard),
        shape = androidx.compose.foundation.shape.RoundedCornerShape(16.dp),
        colors = OutlinedTextFieldDefaults.colors(
            focusedBorderColor = Indigo,
            unfocusedBorderColor = Color.White.copy(alpha = 0.12f),
            focusedTextColor = Ink,
            unfocusedTextColor = Ink,
            cursorColor = Cyan,
            focusedLabelColor = Cyan,
            unfocusedLabelColor = Muted,
        ),
    )
}
