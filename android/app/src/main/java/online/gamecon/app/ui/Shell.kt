@file:OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)

package online.gamecon.app.ui

import android.Manifest
import android.media.MediaRecorder
import android.os.Build
import android.net.Uri
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.browser.customtabs.CustomTabsIntent
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Add
import androidx.compose.material.icons.rounded.Chat
import androidx.compose.material.icons.rounded.Groups
import androidx.compose.material.icons.rounded.Home
import androidx.compose.material.icons.rounded.Menu
import androidx.compose.material.icons.rounded.Movie
import androidx.compose.material.icons.rounded.MusicNote
import androidx.compose.material.icons.rounded.Notifications
import androidx.compose.material.icons.rounded.Pause
import androidx.compose.material.icons.rounded.People
import androidx.compose.material.icons.rounded.Person
import androidx.compose.material.icons.rounded.Photo
import androidx.compose.material.icons.rounded.PlayArrow
import androidx.compose.material.icons.rounded.Search
import androidx.compose.material.icons.rounded.Settings
import androidx.compose.material.icons.rounded.SportsEsports
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.NavigationBarItemDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.navigation.NavHostController
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import coil.compose.AsyncImage
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import online.gamecon.app.data.absolute
import online.gamecon.app.data.arr
import online.gamecon.app.data.objects
import online.gamecon.app.data.page
import online.gamecon.app.data.postCard
import online.gamecon.app.data.s
import online.gamecon.app.data.userCard
import org.json.JSONObject
import java.io.File

private data class Tab(val route: String, val label: String, val icon: ImageVector)

private val tabs = listOf(
    Tab("feed", "Новини", Icons.Rounded.Home),
    Tab("messages", "Чати", Icons.Rounded.Chat),
    Tab("friends", "Друзі", Icons.Rounded.People),
    Tab("me", "Сторінка", Icons.Rounded.Person),
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun Shell(model: GameConModel) {
    val nav = rememberNavController()
    val back by nav.currentBackStackEntryAsState()
    val route = back?.destination?.route ?: "feed"
    var menu by remember { mutableStateOf(false) }
    val sheet = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    val scope = rememberCoroutineScope()

    Stage {
        Scaffold(
            containerColor = Color.Transparent,
            bottomBar = {
                Column(Modifier.navigationBarsPadding()) {
                    if (model.player.title.isNotEmpty()) {
                        Row(
                            Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 6.dp).clip(RoundedCornerShape(16.dp)).padding(8.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Column(Modifier.weight(1f)) {
                                Text(model.player.title, color = Ink, fontFamily = Onest, fontWeight = FontWeight.SemiBold, maxLines = 1)
                                Text(model.player.artist, color = Muted, fontFamily = Onest, fontSize = 12.sp, maxLines = 1)
                            }
                            IconButton(onClick = { model.player.toggle() }) {
                                Icon(if (model.player.playing) Icons.Rounded.Pause else Icons.Rounded.PlayArrow, null, tint = Color.White)
                            }
                        }
                    }
                    NavigationBar(containerColor = Color(0xFF070A16)) {
                        tabs.forEach { tab ->
                            val selected = route == tab.route || (tab.route == "me" && route.startsWith("profile"))
                            NavigationBarItem(
                                selected = selected,
                                onClick = {
                                    val dest = if (tab.route == "me") "profile/${model.me?.username ?: "me"}" else tab.route
                                    nav.navigate(dest) { popUpTo("feed") { saveState = true }; launchSingleTop = true; restoreState = true }
                                },
                                icon = { Icon(tab.icon, tab.label) },
                                label = { Text(tab.label, fontSize = 11.sp) },
                                colors = NavigationBarItemDefaults.colors(
                                    selectedIconColor = Color.White,
                                    selectedTextColor = Color.White,
                                    indicatorColor = Indigo.copy(alpha = 0.35f),
                                    unselectedIconColor = Muted,
                                    unselectedTextColor = Muted,
                                ),
                            )
                        }
                        NavigationBarItem(
                            selected = menu,
                            onClick = { menu = true },
                            icon = { Icon(Icons.Rounded.Menu, "Меню") },
                            label = { Text("Меню", fontSize = 11.sp) },
                            colors = NavigationBarItemDefaults.colors(unselectedIconColor = Muted, unselectedTextColor = Muted, indicatorColor = Indigo.copy(alpha = 0.35f)),
                        )
                    }
                }
            },
        ) { padding ->
            NavHost(nav, startDestination = "feed", modifier = Modifier.padding(padding)) {
                composable("feed") { FeedScreen(model, nav) }
                composable("messages") { MessagesScreen(model, nav) }
                composable("chat/{id}", listOf(navArgument("id") { type = NavType.IntType })) { ChatScreen(model, it.arguments?.getInt("id") ?: 0) }
                composable("friends") { FriendsScreen(model, nav) }
                composable("people") { PeopleScreen(model, nav) }
                composable("profile/{username}") { ProfileScreen(model, nav, it.arguments?.getString("username").orEmpty()) }
                composable("communities") { CommunitiesScreen(model, nav) }
                composable("community/{slug}") { CommunityScreen(model, nav, it.arguments?.getString("slug").orEmpty()) }
                composable("photos") { PhotosScreen(model) }
                composable("music") { MusicScreen(model) }
                composable("cinema") { CinemaScreen(model, nav) }
                composable("movie/{slug}") { MovieScreen(model, it.arguments?.getString("slug").orEmpty()) }
                composable("families") { FamiliesScreen(model, nav) }
                composable("family/{slug}") { FamilyScreen(model, nav, it.arguments?.getString("slug").orEmpty()) }
                composable("servers") { ServersScreen(model, nav) }
                composable("server/{slug}") { ServerScreen(model, nav, it.arguments?.getString("slug").orEmpty()) }
                composable("notifications") { NotificationsScreen(model) }
                composable("settings") { SettingsScreen(model) }
            }
        }
    }

    if (menu) {
        ModalBottomSheet(onDismissRequest = { menu = false }, sheetState = sheet, containerColor = Deep) {
            Text("GameCon", fontFamily = Unbounded, fontWeight = FontWeight.Bold, color = Ink, modifier = Modifier.padding(horizontal = 20.dp))
            listOf(
                "people" to ("Люди" to Icons.Rounded.Search),
                "communities" to ("Спільноти" to Icons.Rounded.Groups),
                "photos" to ("Фото" to Icons.Rounded.Photo),
                "servers" to ("Сервери GTA" to Icons.Rounded.SportsEsports),
                "music" to ("Музика" to Icons.Rounded.MusicNote),
                "cinema" to ("Кіно" to Icons.Rounded.Movie),
                "families" to ("Сім’ї" to Icons.Rounded.Groups),
                "notifications" to ("Сповіщення" to Icons.Rounded.Notifications),
                "settings" to ("Налаштування" to Icons.Rounded.Settings),
            ).forEach { (dest, pair) ->
                TextButton(onClick = {
                    menu = false
                    scope.launch { nav.navigate(dest) { launchSingleTop = true } }
                }, modifier = Modifier.fillMaxWidth()) {
                    Icon(pair.second, null, tint = Cyan)
                    Text("  ${pair.first}", color = Ink, fontFamily = Onest, modifier = Modifier.weight(1f))
                }
            }
            TextButton(onClick = { menu = false; model.logout() }, modifier = Modifier.fillMaxWidth().padding(bottom = 24.dp)) {
                Text("Вийти", color = Pink, fontFamily = Onest)
            }
        }
    }
}

@Composable
private fun FeedScreen(model: GameConModel, nav: NavHostController) {
    var tab by remember { mutableStateOf("friends") }
    var text by remember { mutableStateOf("") }
    var page by remember { mutableIntStateOf(1) }
    val scope = rememberCoroutineScope()
    Load(tab to page, { model.api.feed(page, tab) }) { json, reload ->
        val posts = json.page("posts").items.map { it.postCard() }
        LazyColumn(contentPadding = PaddingValues(16.dp)) {
            item {
                Wordmark()
                Row(Modifier.padding(vertical = 12.dp)) {
                    FilterChip(tab != "discover", { tab = "friends"; page = 1 }, { Text("Стрічка") })
                    Spacer(Modifier.size(8.dp))
                    FilterChip(tab == "discover", { tab = "discover"; page = 1 }, { Text("Цікаве") })
                }
                GcField(text, { text = it }, "Що нового?")
                Spacer(Modifier.height(8.dp))
                PrimaryButton("Опублікувати") {
                    scope.launch {
                        runCatching { withContext(Dispatchers.IO) { model.api.createPost(text, null) } }
                        text = ""
                        reload()
                    }
                }
                Spacer(Modifier.height(12.dp))
            }
            items(posts, key = { it.id }) { post ->
                var card by remember(post.id) { mutableStateOf(post) }
                PostView(card, { nav.navigate("profile/${card.author.username}") }, {
                    scope.launch {
                        val result = runCatching { withContext(Dispatchers.IO) { model.api.likePost(card.id) } }.getOrNull()
                        if (result != null) card = card.copy(liked = result.optBoolean("liked"), likes = result.optInt("likes_count"))
                    }
                }, { nav.navigate("profile/${card.author.username}") })
            }
            item {
                if (json.page("posts").more) TextButton({ page += 1 }) { Text("Ще", color = Cyan) }
            }
        }
    }
}

@Composable
private fun MessagesScreen(model: GameConModel, nav: NavHostController) {
    Load(Unit, { model.api.conversations() }) { json, _ ->
        val rows = json.arr("conversations").objects()
        LazyColumn(contentPadding = PaddingValues(16.dp)) {
            item { Text("Чати", style = androidx.compose.material3.MaterialTheme.typography.titleLarge) }
            items(rows, key = { it.optInt("id") }) { row ->
                Glass(Modifier.fillMaxWidth().padding(vertical = 6.dp)) {
                    TextButton(onClick = { nav.navigate("chat/${row.optInt("id")}") }, modifier = Modifier.fillMaxWidth()) {
                        Column(Modifier.weight(1f)) {
                            Text(row.optString("title"), color = Ink, fontFamily = Onest, fontWeight = FontWeight.SemiBold)
                            Text(row.optJSONObject("last_message")?.optString("preview").orEmpty(), color = Muted, fontFamily = Onest, maxLines = 1)
                        }
                        if (row.optInt("unread") > 0) Text(row.optInt("unread").toString(), color = Cyan)
                    }
                }
            }
        }
    }
}

@Composable
private fun ChatScreen(model: GameConModel, id: Int) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var text by remember { mutableStateOf("") }
    var recorder by remember { mutableStateOf<MediaRecorder?>(null) }
    var voiceFile by remember { mutableStateOf<File?>(null) }
    val mic = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
        if (!granted) model.notice = "Немає доступу до мікрофона"
    }
    Load(id, { model.api.conversation(id) }) { json, reload ->
        val messages = json.optJSONObject("history")?.arr("messages")?.objects().orEmpty()
        Column(Modifier.fillMaxSize().padding(12.dp)) {
            Text(json.optJSONObject("conversation")?.optString("title") ?: "Чат", fontFamily = Unbounded, color = Ink)
            LazyColumn(Modifier.weight(1f), reverseLayout = false) {
                items(messages, key = { it.optInt("id") }) { message ->
                    val own = message.optJSONObject("user")?.optInt("id") == model.me?.id
                    Glass(Modifier.fillMaxWidth(if (own) 0.86f else 0.86f).padding(vertical = 4.dp)) {
                        Text(message.optJSONObject("user")?.optString("name").orEmpty(), color = Cyan, fontSize = 12.sp, fontFamily = Onest)
                        message.s("body")?.let { Text(it, color = Ink, fontFamily = Onest) }
                        message.optJSONObject("sticker")?.s("url")?.let { AsyncImage(absolute(it), null, Modifier.size(96.dp)) }
                        message.arr("attachments").objects().forEach { file ->
                            val url = absolute(file.s("url"))
                            when (file.s("type")) {
                                "image" -> AsyncImage(url, null, Modifier.fillMaxWidth().height(160.dp).clip(RoundedCornerShape(12.dp)), contentScale = ContentScale.Crop)
                                "voice" -> TextButton({ url?.let { model.player.play(it, "Голосове", "") } }) { Text("Голосове", color = Cyan) }
                                else -> Text(file.s("name") ?: "Файл", color = Muted, fontFamily = Onest)
                            }
                        }
                    }
                }
            }
            Row(verticalAlignment = Alignment.CenterVertically) {
                GcField(text, { text = it }, "Повідомлення")
            }
            Row {
                TextButton(onClick = {
                    if (text.isBlank()) return@TextButton
                    val body = text
                    text = ""
                    scope.launch {
                        runCatching { withContext(Dispatchers.IO) { model.api.sendMessage(id, body, null, null, 0) } }
                        reload()
                    }
                }) { Text("Надіслати", color = Cyan) }
                TextButton(onClick = {
                    if (recorder == null) {
                        mic.launch(Manifest.permission.RECORD_AUDIO)
                        val file = File(context.cacheDir, "voice.m4a")
                        @Suppress("DEPRECATION")
                        val rec = (if (Build.VERSION.SDK_INT >= 31) MediaRecorder(context) else MediaRecorder()).apply {
                            setAudioSource(MediaRecorder.AudioSource.MIC)
                            setOutputFormat(MediaRecorder.OutputFormat.MPEG_4)
                            setAudioEncoder(MediaRecorder.AudioEncoder.AAC)
                            setOutputFile(file.absolutePath)
                            prepare()
                            start()
                        }
                        voiceFile = file
                        recorder = rec
                    } else {
                        runCatching { recorder?.stop() }
                        recorder?.release()
                        recorder = null
                        val file = voiceFile
                        scope.launch {
                            if (file != null) runCatching { withContext(Dispatchers.IO) { model.api.sendMessage(id, "", null, file, 3) } }
                            reload()
                        }
                    }
                }) { Text(if (recorder == null) "Голос" else "Стоп", color = Pink) }
            }
        }
    }
}

@Composable
private fun FriendsScreen(model: GameConModel, nav: NavHostController) {
    var tab by remember { mutableStateOf("all") }
    Load(tab, { model.api.friends(tab, "") }) { json, reload ->
        val users = json.page("users").items.map { it.userCard() }
        LazyColumn(contentPadding = PaddingValues(16.dp)) {
            item {
                Text("Друзі", style = androidx.compose.material3.MaterialTheme.typography.titleLarge)
                Row(Modifier.horizontalScroll(rememberScrollState()).padding(vertical = 8.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    listOf("all" to "Усі", "online" to "Онлайн", "requests" to "Заявки", "outgoing" to "Надіслані").forEach { (key, label) ->
                        FilterChip(tab == key, { tab = key }, { Text(label) })
                    }
                }
                TextButton({ nav.navigate("people") }) { Text("Знайти людей", color = Cyan) }
            }
            items(users, key = { it.username }) { user ->
                UserRow(user) {
                    val action = when (user.relation) {
                        "incoming" -> "accept"
                        "friends", "outgoing" -> "remove"
                        else -> "request"
                    }
                    val label = when (action) { "accept" -> "Прийняти"; "remove" -> "Скасувати"; else -> "Додати" }
                    TextButton({ scopeAction(model) { model.api.friend(user.username, action); reload() } }) { Text(label, color = Cyan) }
                }
            }
        }
    }
}

@Composable
private fun PeopleScreen(model: GameConModel, nav: NavHostController) {
    var q by remember { mutableStateOf("") }
    Load(q, { model.api.people(q) }) { json, _ ->
        val users = json.page("users").items.map { it.userCard() }
        LazyColumn(contentPadding = PaddingValues(16.dp)) {
            item {
                Text("Люди", style = androidx.compose.material3.MaterialTheme.typography.titleLarge)
                GcField(q, { q = it }, "Пошук")
            }
            items(users, key = { it.username }) { user ->
                UserRow(user) {
                    TextButton({ nav.navigate("profile/${user.username}") }) { Text("Профіль", color = Cyan) }
                }
            }
        }
    }
}

@Composable
private fun ProfileScreen(model: GameConModel, nav: NavHostController, username: String) {
    val name = if (username == "me") model.me?.username.orEmpty() else username
    Load(name, { model.api.profile(name, 1) }) { json, _ ->
        val user = json.optJSONObject("user")?.userCard()
        val posts = json.page("posts").items.map { it.postCard() }
        LazyColumn(contentPadding = PaddingValues(16.dp)) {
            item {
                if (user != null) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Avatar(user.avatar, user.name, 72.dp, user.online)
                        Column(Modifier.padding(start = 12.dp)) {
                            Text(user.name, fontFamily = Unbounded, color = Ink, fontWeight = FontWeight.Bold)
                            Text("@${user.username}", color = Muted, fontFamily = Onest)
                            Text(json.optJSONObject("user")?.s("about") ?: user.status.orEmpty(), color = Ink, fontFamily = Onest)
                        }
                    }
                    Row {
                        TextButton({ nav.navigate("photos") }) { Text("Фото", color = Cyan) }
                        if (user.username != model.me?.username) {
                            TextButton({
                                scopeAction(model) {
                                    val chat = model.api.direct(user.username)
                                    withContext(Dispatchers.Main) { nav.navigate("chat/${chat.optInt("id")}") }
                                }
                            }) { Text("Написати", color = Cyan) }
                        }
                    }
                }
            }
            items(posts, key = { it.id }) { post -> PostView(post, {}, {}, {}) }
        }
    }
}

@Composable
private fun CommunitiesScreen(model: GameConModel, nav: NavHostController) {
    var tab by remember { mutableStateOf("discover") }
    var name by remember { mutableStateOf("") }
    Load(tab, { model.api.communities(tab, "") }) { json, reload ->
        val rows = json.page("communities").items
        LazyColumn(contentPadding = PaddingValues(16.dp)) {
            item {
                Text("Спільноти", style = androidx.compose.material3.MaterialTheme.typography.titleLarge)
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    listOf("mine" to "Мої", "managed" to "Керую", "discover" to "Усі").forEach { (key, label) ->
                        FilterChip(tab == key, { tab = key }, { Text(label) })
                    }
                }
                GcField(name, { name = it }, "Назва нової спільноти")
                TextButton({
                    scopeAction(model) { model.api.createCommunity(name, "group", "games"); reload() }
                }) { Text("Створити", color = Cyan) }
            }
            items(rows, key = { it.optString("slug") }) { row ->
                Glass(Modifier.fillMaxWidth().padding(vertical = 6.dp)) {
                    TextButton({ nav.navigate("community/${row.optString("slug")}") }) {
                        Column {
                            Text(row.optString("name"), color = Ink, fontFamily = Onest, fontWeight = FontWeight.SemiBold)
                            Text(row.optString("category_label") + " · " + row.optInt("members_count"), color = Muted, fontFamily = Onest)
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun CommunityScreen(model: GameConModel, nav: NavHostController, slug: String) {
    Load(slug, { model.api.community(slug) }) { json, reload ->
        val community = json.optJSONObject("community")
        val posts = json.page("posts").items.map { it.postCard() }
        LazyColumn(contentPadding = PaddingValues(16.dp)) {
            item {
                Text(community?.optString("name") ?: slug, fontFamily = Unbounded, color = Ink)
                Text(community?.s("description") ?: "", color = Muted, fontFamily = Onest)
                val member = community?.s("membership")
                TextButton({
                    scopeAction(model) {
                        if (member == null) model.api.joinCommunity(slug) else model.api.leaveCommunity(slug)
                        reload()
                    }
                }) { Text(if (member == null) "Вступити" else "Покинути", color = Cyan) }
            }
            items(posts, key = { it.id }) { post -> PostView(post, { nav.navigate("profile/${post.author.username}") }, {}, {}) }
        }
    }
}

@Composable
private fun PhotosScreen(model: GameConModel) {
    val username = model.me?.username.orEmpty()
    var albumId by remember { mutableStateOf<Int?>(null) }
    if (albumId == null) {
        Load(username, { model.api.photos(username) }) { json, _ ->
            val albums = json.arr("albums").objects()
            LazyColumn(contentPadding = PaddingValues(16.dp)) {
                item { Text("Фото", style = androidx.compose.material3.MaterialTheme.typography.titleLarge) }
                items(albums, key = { it.optInt("id") }) { album ->
                    Glass(Modifier.fillMaxWidth().padding(vertical = 6.dp)) {
                        TextButton({ albumId = album.optInt("id") }) {
                            Text(album.optString("title", album.optString("name")), color = Ink, fontFamily = Onest)
                        }
                    }
                }
            }
        }
    } else {
        val selected = albumId ?: return
        Load(selected, { model.api.album(selected) }) { json, _ ->
            val photos = json.page("photos").items
            LazyColumn(contentPadding = PaddingValues(16.dp)) {
                item { TextButton({ albumId = null }) { Text("Назад", color = Cyan) } }
                items(photos, key = { it.optInt("id") }) { photo ->
                    AsyncImage(absolute(photo.s("url")), null, Modifier.fillMaxWidth().height(240.dp).padding(bottom = 8.dp).clip(RoundedCornerShape(16.dp)), contentScale = ContentScale.Crop)
                }
            }
        }
    }
}

@Composable
private fun MusicScreen(model: GameConModel) {
    val context = LocalContext.current
    var tab by remember { mutableStateOf("mine") }
    LaunchedEffectSpotify(model)
    Load(tab to model.handoff, { model.api.music(tab, "", 1) }) { json, reload ->
        val tracks = json.page("tracks").items
        LazyColumn(contentPadding = PaddingValues(16.dp)) {
            item {
                Text("Музика", style = androidx.compose.material3.MaterialTheme.typography.titleLarge)
                Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    listOf("mine" to "Моє", "discover" to "Цікаве", "playlists" to "Плейлисти", "spotify" to "Spotify").forEach { (key, label) ->
                        FilterChip(tab == key, { tab = key }, { Text(label) })
                    }
                }
                if (tab == "spotify" && json.optJSONObject("spotify")?.optJSONObject("account") == null) {
                    TextButton({
                        scopeAction(model) {
                            val url = model.api.spotifyUrl()
                            withContext(Dispatchers.Main) { CustomTabsIntent.Builder().build().launchUrl(context, Uri.parse(url)) }
                        }
                    }) { Text("Під’єднати Spotify", color = Cyan) }
                }
            }
            items(tracks, key = { it.optInt("id") }) { track ->
                Glass(Modifier.fillMaxWidth().padding(vertical = 4.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Column(Modifier.weight(1f)) {
                            Text(track.optString("title"), color = Ink, fontFamily = Onest, fontWeight = FontWeight.SemiBold)
                            Text(track.optString("artist"), color = Muted, fontFamily = Onest, fontSize = 12.sp)
                        }
                        IconButton({
                            val url = track.s("url")
                            if (url != null) {
                                model.player.play(url, track.optString("title"), track.optString("artist"))
                                scopeAction(model) { model.api.nowPlaying(track.optInt("id")) }
                            }
                        }) { Icon(Icons.Rounded.PlayArrow, null, tint = Color.White) }
                        IconButton({
                            scopeAction(model) { model.api.library(track.optInt("id"), !track.optBoolean("in_library")); reload() }
                        }) { Icon(Icons.Rounded.Add, null, tint = if (track.optBoolean("in_library")) Cyan else Muted) }
                    }
                }
            }
        }
    }
}

@Composable
private fun LaunchedEffectSpotify(model: GameConModel) {
    val uri = model.handoff
    if (uri?.host == "spotify") model.handoff = null
}

@Composable
private fun CinemaScreen(model: GameConModel, nav: NavHostController) {
    var q by remember { mutableStateOf("") }
    Load(q, { model.api.cinema(q, "", 1) }) { json, _ ->
        val movies = json.page("movies").items
        LazyColumn(contentPadding = PaddingValues(16.dp)) {
            item {
                Text("Кіно", style = androidx.compose.material3.MaterialTheme.typography.titleLarge)
                GcField(q, { q = it }, "Пошук фільму")
            }
            items(movies, key = { it.optString("slug") }) { movie ->
                Glass(Modifier.fillMaxWidth().padding(vertical = 6.dp)) {
                    TextButton({ nav.navigate("movie/${movie.optString("slug")}") }) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            AsyncImage(absolute(movie.s("poster")), null, Modifier.size(64.dp, 92.dp).clip(RoundedCornerShape(10.dp)), contentScale = ContentScale.Crop)
                            Column(Modifier.padding(start = 12.dp)) {
                                Text(movie.optString("title"), color = Ink, fontFamily = Onest, fontWeight = FontWeight.SemiBold)
                                Text("${movie.optString("type_label")} · ${movie.opt("year")}", color = Muted, fontFamily = Onest)
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun MovieScreen(model: GameConModel, slug: String) {
    var link by remember { mutableStateOf<String?>(null) }
    Load(slug, { model.api.movie(slug) }) { json, reload ->
        val movie = json.optJSONObject("movie")
        val players = json.arr("players").objects()
        LazyColumn(contentPadding = PaddingValues(16.dp)) {
            item {
                Text(movie?.optString("title") ?: slug, fontFamily = Unbounded, color = Ink)
                Text(movie?.s("description") ?: "", color = Ink, fontFamily = Onest, modifier = Modifier.padding(vertical = 8.dp))
                if (link != null) {
                    AndroidView(
                        factory = { ctx ->
                            WebView(ctx).apply {
                                settings.javaScriptEnabled = true
                                settings.domStorageEnabled = true
                                webViewClient = WebViewClient()
                                setBackgroundColor(android.graphics.Color.parseColor("#05070F"))
                                loadUrl(link!!)
                            }
                        },
                        modifier = Modifier.fillMaxWidth().height(220.dp).clip(RoundedCornerShape(16.dp)),
                    )
                }
                players.forEach { player ->
                    TextButton({ link = player.s("link") }) { Text(player.optString("provider_label", "Дивитися"), color = Cyan) }
                }
                Row {
                    listOf("planned" to "Потім", "watching" to "Дивлюся", "watched" to "Бачив", "dropped" to "Закинув").forEach { (status, label) ->
                        TextButton({ scopeAction(model) { model.api.movieStatus(slug, status); reload() } }) { Text(label, color = Gold, fontSize = 12.sp) }
                    }
                }
            }
        }
    }
}

@Composable
private fun FamiliesScreen(model: GameConModel, nav: NavHostController) {
    var q by remember { mutableStateOf("") }
    Load(q, { model.api.families(q) }) { json, _ ->
        LazyColumn(contentPadding = PaddingValues(16.dp)) {
            item {
                Text("Сім’ї", style = androidx.compose.material3.MaterialTheme.typography.titleLarge)
                GcField(q, { q = it }, "Пошук")
                Text("Мої", color = Muted, fontFamily = Onest, modifier = Modifier.padding(top = 8.dp))
            }
            items(json.arr("mine").objects(), key = { "m" + it.optString("slug") }) { row ->
                TextButton({ nav.navigate("family/${row.optString("slug")}") }) { Text(row.optString("name") + " [" + row.optString("tag") + "]", color = Ink) }
            }
            item { Text("Каталог", color = Muted, fontFamily = Onest) }
            items(json.page("families").items, key = { it.optString("slug") }) { row ->
                TextButton({ nav.navigate("family/${row.optString("slug")}") }) { Text(row.optString("name"), color = Ink, fontFamily = Onest) }
            }
        }
    }
}

@Composable
private fun FamilyScreen(model: GameConModel, nav: NavHostController, slug: String) {
    var section by remember { mutableStateOf("overview") }
    var nick by remember { mutableStateOf("") }
    var staticId by remember { mutableStateOf("") }
    Load(slug to section, {
        if (section == "overview") model.api.family(slug) else model.api.familySection(slug, section)
    }) { json, reload ->
        LazyColumn(contentPadding = PaddingValues(16.dp)) {
            item {
                val family = json.optJSONObject("family")
                Text(family?.optString("name") ?: json.optJSONObject("family")?.optString("name") ?: slug, fontFamily = Unbounded, color = Ink)
                Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    listOf("overview" to "Огляд", "members" to "Учасники", "bank" to "Банк", "warehouse" to "Склад", "events" to "Події", "reports" to "Звіти").forEach { (key, label) ->
                        FilterChip(section == key, { section = key }, { Text(label, fontSize = 12.sp) })
                    }
                }
                if (json.optJSONObject("member") == null && section == "overview") {
                    GcField(nick, { nick = it }, "Ім’я_Прізвище")
                    GcField(staticId, { staticId = it }, "Static ID")
                    TextButton({ scopeAction(model) { model.api.applyFamily(slug, nick, staticId); reload() } }) { Text("Подати заявку", color = Cyan) }
                }
                json.optInt("chat_id").takeIf { it > 0 }?.let { chat ->
                    TextButton({ nav.navigate("chat/$chat") }) { Text("Чат сім’ї", color = Cyan) }
                }
                json.optJSONObject("member")?.let { member ->
                    Text("${member.optString("display")} · ${member.optString("rank_title")} · баланс ${member.opt("balance")}", color = Ink, fontFamily = Onest)
                }
                json.optJSONObject("family")?.s("description")?.let { Text(it, color = Muted, fontFamily = Onest, modifier = Modifier.padding(top = 6.dp)) }
                json.arr("members").objects().forEach { member ->
                    Text("${member.optString("display")} · ${member.optString("rank_title")}", color = Ink, fontFamily = Onest, modifier = Modifier.padding(top = 6.dp))
                }
                json.arr("transactions").objects().forEach { row ->
                    Text("${row.optString("type_label")} ${row.opt("amount")} · ${row.optString("comment")}", color = Ink, fontFamily = Onest, fontSize = 13.sp)
                }
                json.arr("items").objects().forEach { item ->
                    Text("${item.optString("name")} · ${item.opt("quantity")} ${item.optString("unit")}", color = Ink, fontFamily = Onest)
                }
                json.arr("events").objects().forEach { event ->
                    Text("${event.optString("title")} · ${event.optString("type_label")}", color = Ink, fontFamily = Onest)
                }
                json.arr("reports").objects().forEach { report ->
                    Text("${report.optString("type_label")} · ${report.optString("status")} · ${report.opt("reward")}", color = Ink, fontFamily = Onest)
                }
            }
        }
    }
}

@Composable
private fun ServersScreen(model: GameConModel, nav: NavHostController) {
    var q by remember { mutableStateOf("") }
    var name by remember { mutableStateOf("") }
    Load(q, { model.api.servers(q, "") }) { json, reload ->
        LazyColumn(contentPadding = PaddingValues(16.dp)) {
            item {
                Text("Сервери", style = androidx.compose.material3.MaterialTheme.typography.titleLarge)
                GcField(q, { q = it }, "Пошук")
                GcField(name, { name = it }, "Запропонувати сервер")
                TextButton({ scopeAction(model) { model.api.suggestServer(name, "pc"); reload() } }) { Text("Надіслати", color = Cyan) }
            }
            items(json.arr("servers").objects(), key = { it.optString("slug") }) { server ->
                Glass(Modifier.fillMaxWidth().padding(vertical = 6.dp)) {
                    TextButton({ nav.navigate("server/${server.optString("slug")}") }) {
                        Column {
                            Text(server.optString("name"), color = Ink, fontFamily = Onest, fontWeight = FontWeight.SemiBold)
                            Text("${server.optString("platform_label")} · онлайн ${server.opt("players_online")}", color = Muted, fontFamily = Onest)
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun ServerScreen(model: GameConModel, nav: NavHostController, slug: String) {
    Load(slug, { model.api.server(slug) }) { json, _ ->
        val server = json.optJSONObject("server")
        LazyColumn(contentPadding = PaddingValues(16.dp)) {
            item {
                Text(server?.optString("name") ?: slug, fontFamily = Unbounded, color = Ink)
                Text(server?.s("description") ?: "", color = Ink, fontFamily = Onest)
            }
            items(json.arr("families").objects(), key = { it.optString("slug") }) { family ->
                TextButton({ nav.navigate("family/${family.optString("slug")}") }) { Text(family.optString("name"), color = Cyan) }
            }
        }
    }
}

@Composable
private fun NotificationsScreen(model: GameConModel) {
    Load(Unit, { model.api.notifications() }) { json, reload ->
        val rows = json.arr("notifications").objects()
        LazyColumn(contentPadding = PaddingValues(16.dp)) {
            item {
                Text("Сповіщення", style = androidx.compose.material3.MaterialTheme.typography.titleLarge)
                TextButton({ scopeAction(model) { model.api.readNotifications(); reload() } }) { Text("Прочитати всі", color = Cyan) }
            }
            items(rows, key = { it.optString("id") }) { row ->
                Glass(Modifier.fillMaxWidth().padding(vertical = 4.dp)) {
                    Text(row.optString("text"), color = if (row.optBoolean("read")) Muted else Ink, fontFamily = Onest)
                }
            }
        }
    }
}

@Composable
private fun SettingsScreen(model: GameConModel) {
    var status by remember { mutableStateOf(model.me?.status.orEmpty()) }
    var city by remember { mutableStateOf(model.me?.city.orEmpty()) }
    var about by remember { mutableStateOf(model.me?.about.orEmpty()) }
    var current by remember { mutableStateOf("") }
    var next by remember { mutableStateOf("") }
    val scope = rememberCoroutineScope()
    Column(Modifier.fillMaxSize().padding(16.dp)) {
        Text("Налаштування", fontFamily = Unbounded, color = Ink, fontWeight = FontWeight.Bold, fontSize = 22.sp)
        Text(model.me?.email.orEmpty(), color = Muted, fontFamily = Onest)
        Text("Google: ${if (model.me?.google == true) "під’єднано" else "ні"} · Discord: ${model.me?.discordName ?: "ні"}", color = Muted, fontFamily = Onest, modifier = Modifier.padding(bottom = 8.dp))
        GcField(status, { status = it }, "Статус")
        GcField(city, { city = it }, "Місто")
        GcField(about, { about = it }, "Про себе")
        Spacer(Modifier.height(8.dp))
        PrimaryButton("Зберегти") {
            scope.launch {
                runCatching {
                    withContext(Dispatchers.IO) {
                        model.api.updateMe(JSONObject().apply {
                            put("status", status)
                            put("city", city)
                            put("about", about)
                        })
                    }
                }.onSuccess { model.me = it }
            }
        }
        Spacer(Modifier.height(16.dp))
        GcField(current, { current = it }, "Поточний пароль", password = true)
        GcField(next, { next = it }, "Новий пароль", password = true)
        TextButton({
            scope.launch { runCatching { withContext(Dispatchers.IO) { model.api.password(current, next) } } }
        }) { Text("Змінити пароль", color = Cyan) }
        TextButton({ model.logout() }) { Text("Вийти", color = Pink) }
    }
}

private fun scopeAction(model: GameConModel, block: suspend () -> Unit) {
    // Called from click handlers that already have a composition. Launch via a process-wide scope on the model.
    model.launch(block)
}

private fun GameConModel.launch(block: suspend () -> Unit) {
    viewModelScope.launch {
        runCatching { withContext(Dispatchers.IO) { block() } }.onFailure { notice = it.message }
    }
}
