# GameCon SDK для Flutter (ігри й застосунки)

Вхід **кодом пристрою** (у грі не потрібен браузер), друзі онлайн, статус у грі, запрошення,
досягнення, таблиці лідерів і готовий оверлей **GameConOverlay** (безбарвне матове скло).

Пакети: `http`, `shared_preferences`, `url_launcher`. Скопіюйте `gamecon_sdk.dart` і `gc_overlay_widget.dart`.

```dart
final sdk = GameConSdk(clientId: 'CLIENT_ID');
await sdk.restore();

// Оверлей поверх гри: капсула «друзі онлайн», панель за натиском, кнопка входу з кодом.
Stack(children: [const GameView(), GameConOverlay(sdk: sdk, presence: 'В матчі')]);

await sdk.unlockAchievement('first_win');
await sdk.submitScore('weekly', 1520);
```

Повний оверлей GameCon (паті, чат, сім’я/клан, крапля з панеллю) — `sdk.overlayUrl()` у
`webview_flutter` з прозорим фоном. Вхід у звичайних застосунках через браузер — `../gamecon_auth`.
