package online.gamecon.app.data

import android.content.Context
import android.net.Uri
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.media3.common.MediaItem
import androidx.media3.common.Player
import androidx.media3.exoplayer.ExoPlayer
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.MultipartBody
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.asRequestBody
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.util.concurrent.TimeUnit

const val API_ROOT = "https://gamecon.online"

class ApiException(val status: Int, message: String) : Exception(message)

class Session(context: Context) {
    private val prefs = context.getSharedPreferences("gamecon", Context.MODE_PRIVATE)

    fun token(): String? = prefs.getString("token", null)

    fun save(token: String) {
        prefs.edit().putString("token", token).apply()
    }

    fun clear() {
        prefs.edit().remove("token").apply()
    }
}

class TrackPlayer(context: Context) {
    val exo: ExoPlayer = ExoPlayer.Builder(context).build()
    var title by mutableStateOf("")
    var artist by mutableStateOf("")
    var playing by mutableStateOf(false)

    init {
        exo.addListener(object : Player.Listener {
            override fun onIsPlayingChanged(isPlaying: Boolean) {
                playing = isPlaying
            }
        })
    }

    fun play(url: String, title: String, artist: String) {
        val full = absolute(url) ?: return
        this.title = title
        this.artist = artist
        exo.setMediaItem(MediaItem.fromUri(full))
        exo.prepare()
        exo.play()
    }

    fun toggle() {
        if (exo.isPlaying) exo.pause() else exo.play()
    }

    fun release() {
        exo.release()
    }
}

fun absolute(url: String?): String? {
    if (url.isNullOrBlank() || url == "null") return null
    if (url.startsWith("http://") || url.startsWith("https://")) return url
    return API_ROOT + if (url.startsWith("/")) url else "/$url"
}

class Api(private val token: () -> String?) {
    private val http = OkHttpClient.Builder()
        .callTimeout(40, TimeUnit.SECONDS)
        .build()
    private val jsonType = "application/json; charset=utf-8".toMediaType()

    fun login(email: String, password: String) = post("/api/v1/auth/login", json("email" to email, "password" to password, "device" to "GameCon Android"))

    fun register(first: String, last: String, email: String, password: String) = post(
        "/api/v1/auth/register",
        json("first_name" to first, "last_name" to last, "email" to email, "password" to password, "password_confirmation" to password, "device" to "GameCon Android"),
    )

    fun google(idToken: String) = post("/api/v1/auth/google", json("google_token" to idToken, "device" to "GameCon Android"))

    fun discordUrl(): String = post("/api/v1/auth/discord", JSONObject()).s("url") ?: throw ApiException(422, "Discord не відповів.")

    fun exchange(code: String) = post("/api/v1/auth/exchange", json("code" to code, "device" to "GameCon Android"))

    fun twoFactor(ticket: String, code: String?, recovery: String?) = post(
        "/api/v1/auth/two-factor",
        JSONObject().apply {
            put("ticket", ticket)
            if (!code.isNullOrBlank()) put("code", code)
            if (!recovery.isNullOrBlank()) put("recovery_code", recovery)
        },
    )

    fun logout() = post("/api/v1/logout", JSONObject())

    fun me() = get("/api/v1/me").obj("user")!!.account()

    fun updateMe(fields: JSONObject) = patch("/api/v1/me", fields).obj("user")!!.account()

    fun password(current: String, next: String) = put("/api/v1/me/password", json("current_password" to current, "password" to next, "password_confirmation" to next))

    fun feed(page: Int, tab: String) = get("/api/v1/feed?page=$page&tab=$tab")

    fun createPost(body: String, image: File?) = multipart("/api/v1/posts", mapOf("body" to body, "visibility" to "public"), image?.let { listOf("images[]" to it) } ?: emptyList())

    fun likePost(id: Int) = post("/api/v1/posts/$id/like", JSONObject())

    fun comments(id: Int) = get("/api/v1/posts/$id/comments")

    fun comment(id: Int, body: String) = post("/api/v1/posts/$id/comments", json("body" to body))

    fun friends(tab: String, q: String) = get("/api/v1/friends?tab=$tab&q=${Uri.encode(q)}")

    fun friend(username: String, action: String) = when (action) {
        "accept" -> post("/api/v1/friends/$username/accept", JSONObject())
        "remove" -> delete("/api/v1/friends/$username")
        else -> post("/api/v1/friends/$username", JSONObject())
    }

    fun people(q: String) = get("/api/v1/people?q=${Uri.encode(q)}")

    fun search(q: String) = get("/api/v1/search?q=${Uri.encode(q)}")

    fun profile(username: String, page: Int) = get("/api/v1/users/$username?page=$page")

    fun notifications() = get("/api/v1/notifications")

    fun readNotifications() = post("/api/v1/notifications/read", JSONObject())

    fun conversations() = get("/api/v1/messages")

    fun conversation(id: Int) = get("/api/v1/messages/$id")

    fun sendMessage(id: Int, body: String, image: File?, voice: File?, voiceSeconds: Int) = multipart(
        "/api/v1/messages/$id",
        buildMap {
            if (body.isNotBlank()) put("body", body)
            if (voice != null) {
                put("voice_duration", voiceSeconds.toString())
                put("voice_waveform", "[]")
            }
        },
        buildList {
            if (image != null) add("images[]" to image)
            if (voice != null) add("voice" to voice)
        },
    )

    fun sendSticker(id: Int, stickerId: Int) = post("/api/v1/messages/$id", json("sticker_id" to stickerId))

    fun direct(username: String) = post("/api/v1/messages/with/$username", JSONObject())

    fun stickers() = get("/api/v1/messages/stickers")

    fun communities(tab: String, q: String) = get("/api/v1/communities?tab=$tab&q=${Uri.encode(q)}")

    fun community(slug: String) = get("/api/v1/communities/$slug")

    fun joinCommunity(slug: String) = post("/api/v1/communities/$slug/join", JSONObject())

    fun leaveCommunity(slug: String) = delete("/api/v1/communities/$slug/join")

    fun createCommunity(name: String, type: String, category: String) = post(
        "/api/v1/communities",
        json("name" to name, "type" to type, "category" to category, "privacy" to "open"),
    )

    fun photos(username: String) = get("/api/v1/users/$username/photos")

    fun album(id: Int) = get("/api/v1/albums/$id")

    fun music(tab: String, q: String, page: Int) = get("/api/v1/music?tab=$tab&q=${Uri.encode(q)}&page=$page")

    fun library(id: Int, add: Boolean) = if (add) post("/api/v1/music/tracks/$id/library", JSONObject()) else delete("/api/v1/music/tracks/$id/library")

    fun playlist(id: Int) = get("/api/v1/music/playlists/$id")

    fun createPlaylist(title: String) = post("/api/v1/music/playlists", json("title" to title))

    fun nowPlaying(id: Int?) = post("/api/v1/music/now-playing", JSONObject().apply { if (id != null) put("track_id", id) })

    fun spotifyUrl(): String = post("/api/v1/music/spotify/connect", JSONObject()).s("url") ?: throw ApiException(422, "Spotify не налаштовано.")

    fun spotifyLibrary(section: String) = get("/api/v1/music/spotify/$section")

    fun cinema(q: String, type: String, page: Int): JSONObject {
        val t = if (type.isBlank()) "" else "&type=$type"
        return get("/api/v1/cinema?q=${Uri.encode(q)}&page=$page$t")
    }

    fun movie(slug: String) = get("/api/v1/cinema/$slug")

    fun movieStatus(slug: String, status: String?) = post("/api/v1/cinema/$slug/status", JSONObject().apply { if (status != null) put("status", status) })

    fun movieRate(slug: String, rating: Int) = post("/api/v1/cinema/$slug/rate", json("rating" to rating))

    fun families(q: String) = get("/api/v1/families?q=${Uri.encode(q)}")

    fun family(slug: String) = get("/api/v1/families/$slug")

    fun familySection(slug: String, section: String) = get("/api/v1/families/$slug/$section")

    fun applyFamily(slug: String, nick: String, staticId: String) = post("/api/v1/families/$slug/apply", json("rp_nickname" to nick, "static_id" to staticId))

    fun servers(q: String, platform: String) = get("/api/v1/servers?q=${Uri.encode(q)}&platform=$platform")

    fun server(slug: String) = get("/api/v1/servers/$slug")

    fun suggestServer(name: String, platform: String) = post("/api/v1/servers", json("name" to name, "platform" to platform))

    private fun get(path: String) = call("GET", path, null)

    private fun post(path: String, body: JSONObject) = call("POST", path, body.toString().toRequestBody(jsonType))

    private fun put(path: String, body: JSONObject) = call("PUT", path, body.toString().toRequestBody(jsonType))

    private fun patch(path: String, body: JSONObject) = call("PATCH", path, body.toString().toRequestBody(jsonType))

    private fun delete(path: String) = call("DELETE", path, ByteArray(0).toRequestBody(null))

    private fun multipart(path: String, fields: Map<String, String>, files: List<Pair<String, File>>): JSONObject {
        val body = MultipartBody.Builder().setType(MultipartBody.FORM).apply {
            fields.forEach { (key, value) -> addFormDataPart(key, value) }
            files.forEach { (key, file) ->
                val type = when {
                    file.name.endsWith(".m4a") || file.name.endsWith(".mp4") -> "audio/mp4"
                    else -> "image/jpeg"
                }
                addFormDataPart(key, file.name, file.asRequestBody(type.toMediaType()))
            }
        }.build()
        return call("POST", path, body)
    }

    private fun call(method: String, path: String, body: okhttp3.RequestBody?): JSONObject {
        val builder = Request.Builder().url(API_ROOT + path).header("Accept", "application/json").header("User-Agent", "GameCon/1.0 (Android)")
        token()?.let { builder.header("Authorization", "Bearer $it") }
        if (method == "GET") builder.get() else builder.method(method, body ?: ByteArray(0).toRequestBody(null))
        http.newCall(builder.build()).execute().use { response ->
            val text = response.body?.string().orEmpty()
            if (!response.isSuccessful) throw ApiException(response.code, explain(text))
            if (text.isBlank()) return JSONObject()
            return runCatching { JSONObject(text) }.getOrElse { JSONObject() }
        }
    }
}

private fun explain(text: String): String {
    val json = runCatching { JSONObject(text) }.getOrNull() ?: return "Немає зв’язку з GameCon."
    val errors = json.optJSONObject("errors")
    if (errors != null) {
        val key = errors.keys().asSequence().firstOrNull()
        val message = key?.let { errors.optJSONArray(it)?.optString(0) }
        if (!message.isNullOrBlank()) return message
    }
    return json.optString("message").ifBlank { "Щось пішло не так." }
}

private fun json(vararg pairs: Pair<String, Any?>): JSONObject = JSONObject().apply {
    pairs.forEach { (key, value) -> if (value != null) put(key, value) }
}

fun JSONObject.s(key: String): String? = if (isNull(key)) null else optString(key).takeIf { it.isNotBlank() && it != "null" }

fun JSONObject.obj(key: String): JSONObject? = optJSONObject(key)

fun JSONObject.arr(key: String): JSONArray = optJSONArray(key) ?: JSONArray()

fun JSONArray.objects(): List<JSONObject> = buildList {
    for (i in 0 until length()) optJSONObject(i)?.let { add(it) }
}

fun JSONObject.account() = Account(
    id = optInt("id"),
    username = optString("username"),
    name = optString("name"),
    firstName = optString("first_name"),
    email = optString("email"),
    avatar = absolute(s("avatar_url")),
    cover = absolute(s("cover_url")),
    status = s("status"),
    about = s("about"),
    city = s("city"),
    role = optString("role", "user"),
    twoFactor = optBoolean("two_factor"),
    discord = optBoolean("discord"),
    google = optBoolean("google"),
    isPrivate = optBoolean("is_private"),
    discordName = s("discord_username"),
)

fun JSONObject.userCard() = UserCard(
    id = optInt("id"),
    username = optString("username"),
    name = optString("name"),
    avatar = absolute(s("avatar_url")),
    online = optBoolean("is_online"),
    verified = optBoolean("is_verified"),
    status = s("status"),
    city = s("city"),
    relation = s("relation"),
    mutual = if (has("mutual")) optInt("mutual") else null,
)

fun JSONObject.postCard() = PostCard(
    id = optInt("id"),
    body = s("body"),
    author = obj("author")?.userCard() ?: UserCard(0, "", "GameCon", null, false, false, null, null, null, null),
    createdAt = optString("created_at"),
    likes = optInt("likes_count"),
    comments = optInt("comments_count"),
    liked = optBoolean("liked"),
    images = arr("attachments").objects().mapNotNull { absolute(it.s("url")) },
    musicTitle = obj("music")?.s("title"),
    musicArtist = obj("music")?.s("artist"),
)

data class Account(
    val id: Int,
    val username: String,
    val name: String,
    val firstName: String,
    val email: String,
    val avatar: String?,
    val cover: String?,
    val status: String?,
    val about: String?,
    val city: String?,
    val role: String,
    val twoFactor: Boolean,
    val discord: Boolean,
    val google: Boolean,
    val isPrivate: Boolean,
    val discordName: String?,
)

data class UserCard(
    val id: Int,
    val username: String,
    val name: String,
    val avatar: String?,
    val online: Boolean,
    val verified: Boolean,
    val status: String?,
    val city: String?,
    val relation: String?,
    val mutual: Int?,
)

data class PostCard(
    val id: Int,
    val body: String?,
    val author: UserCard,
    val createdAt: String,
    val likes: Int,
    val comments: Int,
    val liked: Boolean,
    val images: List<String>,
    val musicTitle: String?,
    val musicArtist: String?,
)

data class Page(val items: List<JSONObject>, val page: Int, val last: Int) {
    val more get() = page < last
}

fun JSONObject.page(key: String): Page {
    val block = obj(key) ?: return Page(emptyList(), 1, 1)
    return Page(block.arr("data").objects(), block.optInt("current_page", 1), block.optInt("last_page", 1))
}
