# Увійти через GameCon — Android (Kotlin, AppAuth)

1. На GameCon створіть застосунок **без секрету**, адреса повернення: `com.example.game://oauth` (ваш applicationId).
2. `build.gradle.kts`:
   ```kotlin
   dependencies { implementation("net.openid:appauth:0.11.1") }
   android { defaultConfig { manifestPlaceholders["appAuthRedirectScheme"] = "com.example.game" } }
   ```
3. Скопіюйте `GameConAuth.kt` і в Activity:
   ```kotlin
   val gamecon = GameConAuth(this, "ВАШ_CLIENT_ID", Uri.parse("com.example.game://oauth"))
   loginButton.setOnClickListener { gamecon.start() }
   override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
       super.onActivityResult(requestCode, resultCode, data)
       if (requestCode == 4242) gamecon.finish(data) { profile, error -> /* профіль або помилка */ }
   }
   ```
