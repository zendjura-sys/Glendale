# GameCon SDK для Unity

Вхід через GameCon **кодом пристрою** (гравець вводить код на gamecon.online/link з телефона — у грі
не потрібен браузер), друзі онлайн, статус у грі, запрошення, досягнення, таблиці лідерів і оверлей.

## Встановлення

1. gamecon.online/developers → «Новий застосунок» **без секрету** (публічний). Права: profile, friends,
   presence, invites, achievements (і chat, voice, groups, music — за потреби).
2. Unity → Window → Package Manager → «+» → _Add package from disk…_ → `com.gamecon.sdk/package.json`.
3. Найпростіше — готовий HUD: додайте компонент **GameConHud** на будь-який об’єкт сцени, вставте Client ID.
   F9 — список друзів, капсула «друзі онлайн» у куті.

## Код

```csharp
var gc = new GameCon.GameConClient("CLIENT_ID");
if (!gc.SignedIn) {
    var code = await gc.StartDeviceLogin();          // покажіть code.user_code і code.verification_uri (чи QR з verification_uri_complete)
    await gc.WaitForLogin(code);                     // гравець підтвердив на телефоні
}
var me = await gc.GetMe();
await gc.SetPresence("В матчі · Dust2", lobby: "lobby-42");
var friends = await gc.GetFriendsOnline();
await gc.UnlockAchievement("first_win");
await gc.SubmitScore("weekly", 1520);
```

Повний оверлей GameCon (паті, чат, сім’я/клан, крапля з панеллю) — `gc.OverlayUrl()` у WebView-плагіні
з прозорим фоном (напр. 3D WebView, UnityWebBrowser): кліки поза віджетами проходять у гру.
