# Увійти через GameCon — Flutter (Android, iOS, macOS, Windows, Linux, Web)

```yaml
dependencies:
  flutter_web_auth_2: ^4.0.0
  http: ^1.2.0
  crypto: ^3.0.3
```

Налаштуйте схему повернення за інструкцією flutter_web_auth_2 (Android-маніфест, iOS Info.plist).
На GameCon створіть застосунок **без секрету** з адресами повернення:
`com.example.game://oauth` (мобільні, macOS) і `http://localhost:43823/callback` (Windows, Linux).

```dart
final gamecon = GameConAuth(clientId: 'ВАШ_CLIENT_ID', redirect: 'com.example.game://oauth');
final me = await gamecon.signIn();
```
