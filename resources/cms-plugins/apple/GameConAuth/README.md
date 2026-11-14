# Увійти через GameCon — iOS і macOS (Swift)

1. На GameCon створіть застосунок **без секрету**, адреса повернення `com.example.game://oauth`.
2. Додайте `GameConAuth.swift` у проєкт (iOS 15+ / macOS 12+, без залежностей).
3. Використання:
   ```swift
   let gamecon = GameConAuth(clientId: "ВАШ_CLIENT_ID", redirect: URL(string: "com.example.game://oauth")!)
   let profile = try await gamecon.signIn()
   print(profile.preferred_username)
   ```
