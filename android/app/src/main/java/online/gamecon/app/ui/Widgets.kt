package online.gamecon.app.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Favorite
import androidx.compose.material.icons.rounded.FavoriteBorder
import androidx.compose.material.icons.rounded.Verified
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import online.gamecon.app.data.PostCard
import online.gamecon.app.data.UserCard
import androidx.compose.foundation.Canvas

@Composable
fun Stage(content: @Composable () -> Unit) {
    Box(Modifier.fillMaxSize().background(Void)) {
        Box(
            Modifier.size(280.dp).background(
                Brush.radialGradient(listOf(Indigo.copy(alpha = 0.28f), Color.Transparent)),
                CircleShape,
            ),
        )
        Box(
            Modifier.align(Alignment.TopEnd).size(220.dp).background(
                Brush.radialGradient(listOf(Pink.copy(alpha = 0.18f), Color.Transparent)),
                CircleShape,
            ),
        )
        content()
    }
}

@Composable
fun LogoMark(mark: Dp = 42.dp) {
    Box(Modifier.size(mark), contentAlignment = Alignment.Center) {
        Box(Modifier.fillMaxSize().clip(RoundedCornerShape(mark * 0.3f)).background(Brand))
        Box(
            Modifier.fillMaxSize().padding(mark * 0.045f).clip(RoundedCornerShape(mark * 0.28f)).background(Color(0xFF0B0F22)),
        )
        Canvas(Modifier.fillMaxSize(0.48f)) {
            val w = this.size.width
            val h = this.size.height
            val path = Path().apply {
                moveTo(w * 0.08f, h * 0.02f)
                lineTo(w * 0.08f, h * 0.98f)
                lineTo(w * 0.98f, h * 0.5f)
                close()
            }
            drawPath(path, Brush.linearGradient(listOf(Color(0xFF6FA2FF), Color(0xFF8B6BFF), Pink)))
        }
    }
}

@Composable
fun Wordmark() {
    Row(verticalAlignment = Alignment.CenterVertically) {
        LogoMark(36.dp)
        Spacer(Modifier.size(10.dp))
        Text("Game", fontFamily = Unbounded, fontWeight = FontWeight.Bold, fontSize = 22.sp, color = Color.White)
        Text("Con", fontFamily = Unbounded, fontWeight = FontWeight.Bold, fontSize = 22.sp, style = TextStyle(brush = Brand))
    }
}

@Composable
fun Glass(modifier: Modifier = Modifier, content: @Composable () -> Unit) {
    Column(
        modifier.clip(RoundedCornerShape(22.dp)).background(Color.White.copy(alpha = 0.045f)).border(1.dp, Color.White.copy(alpha = 0.08f), RoundedCornerShape(22.dp)).padding(14.dp),
    ) { content() }
}

@Composable
fun Avatar(url: String?, name: String, size: Dp = 44.dp, online: Boolean = false) {
    Box {
        if (url != null) {
            AsyncImage(url, name, Modifier.size(size).clip(CircleShape), contentScale = ContentScale.Crop)
        } else {
            Box(Modifier.size(size).clip(CircleShape).background(Brand), contentAlignment = Alignment.Center) {
                Text(name.take(1).uppercase(), color = Color.White, fontFamily = Unbounded, fontWeight = FontWeight.Bold)
            }
        }
        if (online) {
            Box(Modifier.align(Alignment.BottomEnd).size(size * 0.28f).clip(CircleShape).background(Color(0xFF34D399)).border(2.dp, Void, CircleShape))
        }
    }
}

@Composable
fun PrimaryButton(text: String, enabled: Boolean = true, onClick: () -> Unit) {
    Box(
        Modifier.fillMaxWidth().height(52.dp).clip(RoundedCornerShape(16.dp)).background(if (enabled) Brand else Brush.linearGradient(listOf(Muted, Muted))).clickable(enabled) { onClick() },
        contentAlignment = Alignment.Center,
    ) {
        Text(text, color = Color.White, fontFamily = Onest, fontWeight = FontWeight.SemiBold, fontSize = 16.sp)
    }
}

@Composable
fun FieldLabel(text: String) {
    Text(text, color = Muted, fontFamily = Onest, fontSize = 12.sp)
}

@Composable
fun <T> Load(key: Any, block: suspend () -> T, content: @Composable (T, () -> Unit) -> Unit) {
    val scope = rememberCoroutineScope()
    var data by remember(key) { mutableStateOf<T?>(null) }
    var error by remember(key) { mutableStateOf<String?>(null) }
    var loading by remember(key) { mutableStateOf(true) }
    fun reload() {
        scope.launch {
            loading = true
            error = null
            try {
                data = withContext(Dispatchers.IO) { block() }
            } catch (e: Exception) {
                error = e.message ?: "Помилка"
            }
            loading = false
        }
    }
    LaunchedEffect(key) { reload() }
    when {
        data == null && loading -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { CircularProgressIndicator(color = Indigo) }
        data == null -> Column(Modifier.fillMaxSize().padding(24.dp), verticalArrangement = Arrangement.Center, horizontalAlignment = Alignment.CenterHorizontally) {
            Text(error ?: "Порожньо", color = Ink, fontFamily = Onest)
            TextButton(onClick = { reload() }) { Text("Спробувати знову", color = Cyan) }
        }
        else -> content(data!!, ::reload)
    }
}

@Composable
fun UserRow(user: UserCard, trailing: @Composable () -> Unit = {}) {
    Row(Modifier.fillMaxWidth().padding(vertical = 8.dp), verticalAlignment = Alignment.CenterVertically) {
        Avatar(user.avatar, user.name, online = user.online)
        Column(Modifier.weight(1f).padding(horizontal = 12.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(user.name, color = Ink, fontFamily = Onest, fontWeight = FontWeight.SemiBold, maxLines = 1, overflow = TextOverflow.Ellipsis)
                if (user.verified) Icon(Icons.Rounded.Verified, null, tint = Cyan, modifier = Modifier.padding(start = 4.dp).size(16.dp))
            }
            Text(listOfNotNull(user.status, user.city, user.mutual?.let { "$it спільних" }).joinToString(" · ").ifBlank { "@${user.username}" }, color = Muted, fontSize = 12.sp, maxLines = 1, overflow = TextOverflow.Ellipsis, fontFamily = Onest)
        }
        trailing()
    }
}

@Composable
fun PostView(post: PostCard, onAuthor: () -> Unit, onLike: () -> Unit, onOpen: () -> Unit) {
    Glass(Modifier.fillMaxWidth().padding(bottom = 12.dp).clickable { onOpen() }) {
        Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.clickable { onAuthor() }) {
            Avatar(post.author.avatar, post.author.name, 40.dp, post.author.online)
            Column(Modifier.padding(start = 10.dp)) {
                Text(post.author.name, color = Ink, fontFamily = Onest, fontWeight = FontWeight.SemiBold)
                Text("@${post.author.username}", color = Muted, fontSize = 12.sp, fontFamily = Onest)
            }
        }
        if (!post.body.isNullOrBlank()) {
            Text(post.body, color = Ink, fontFamily = Onest, modifier = Modifier.padding(top = 10.dp))
        }
        post.images.firstOrNull()?.let { url ->
            AsyncImage(url, null, Modifier.fillMaxWidth().padding(top = 10.dp).height(220.dp).clip(RoundedCornerShape(16.dp)), contentScale = ContentScale.Crop)
        }
        if (post.musicTitle != null) {
            Text("${post.musicArtist ?: ""} — ${post.musicTitle}", color = Cyan, fontFamily = Onest, fontSize = 13.sp, modifier = Modifier.padding(top = 8.dp))
        }
        Row(Modifier.padding(top = 8.dp), verticalAlignment = Alignment.CenterVertically) {
            Icon(if (post.liked) Icons.Rounded.Favorite else Icons.Rounded.FavoriteBorder, null, tint = if (post.liked) Pink else Muted, modifier = Modifier.size(20.dp).clickable { onLike() })
            Text(" ${post.likes}", color = Muted, fontFamily = Onest, fontSize = 13.sp)
            Text("   ${post.comments} коментарів", color = Muted, fontFamily = Onest, fontSize = 13.sp, modifier = Modifier.clickable { onOpen() })
        }
    }
}
