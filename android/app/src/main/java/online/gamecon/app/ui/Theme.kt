@file:OptIn(androidx.compose.ui.text.ExperimentalTextApi::class)

package online.gamecon.app.ui

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontVariation
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp
import online.gamecon.app.R

val Void = Color(0xFF05070F)
val Abyss = Color(0xFF0A0E1C)
val Deep = Color(0xFF0F1426)
val Ink = Color(0xFFEEF1FF)
val Muted = Color(0xFF8B93B3)
val Blue = Color(0xFF4F8BFF)
val Indigo = Color(0xFF6D5DFC)
val Pink = Color(0xFFF04FD8)
val Cyan = Color(0xFF38E1FF)
val Gold = Color(0xFFF5C451)
val Brand = Brush.linearGradient(listOf(Blue, Color(0xFF8B6BFF), Pink))

private fun face(res: Int, weight: FontWeight) = Font(
    res,
    weight,
    variationSettings = FontVariation.Settings(FontVariation.weight(weight.weight)),
)

val Onest = FontFamily(face(R.font.onest, FontWeight.Normal), face(R.font.onest, FontWeight.Medium), face(R.font.onest, FontWeight.SemiBold), face(R.font.onest, FontWeight.Bold))
val Unbounded = FontFamily(face(R.font.unbounded, FontWeight.Medium), face(R.font.unbounded, FontWeight.Bold))

private val Colors = darkColorScheme(
    primary = Indigo,
    onPrimary = Color.White,
    background = Void,
    onBackground = Ink,
    surface = Deep,
    onSurface = Ink,
    surfaceVariant = Abyss,
    outline = Color.White.copy(alpha = 0.08f),
)

@Composable
fun GameConTheme(content: @Composable () -> Unit) {
    MaterialTheme(colorScheme = Colors, typography = MaterialTheme.typography.copy(
        headlineMedium = TextStyle(fontFamily = Unbounded, fontWeight = FontWeight.Bold, fontSize = 28.sp, color = Ink),
        titleLarge = TextStyle(fontFamily = Unbounded, fontWeight = FontWeight.Bold, fontSize = 22.sp, color = Ink),
        titleMedium = TextStyle(fontFamily = Unbounded, fontWeight = FontWeight.Medium, fontSize = 16.sp, color = Ink),
        bodyLarge = TextStyle(fontFamily = Onest, fontSize = 16.sp, color = Ink),
        bodyMedium = TextStyle(fontFamily = Onest, fontSize = 14.sp, color = Ink),
        labelLarge = TextStyle(fontFamily = Onest, fontWeight = FontWeight.SemiBold, fontSize = 14.sp),
    ), content = content)
}
