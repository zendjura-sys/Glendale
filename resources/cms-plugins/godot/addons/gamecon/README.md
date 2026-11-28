# GameCon SDK для Godot 4

1. gamecon.online/developers → «Новий застосунок» **без секрету** (публічний).
2. Скопіюйте `addons/gamecon` у проєкт → Project → Project Settings → Plugins → увімкніть **GameCon SDK**
   (з’явиться автозавантаження `GameCon`).
3. На старті гри: `GameCon.client_id = "CLIENT_ID"`.
4. Готовий HUD: CanvasLayer зі скриптом `addons/gamecon/hud.gd` — кнопка входу з кодом, капсула
   «друзі онлайн», F9 — список друзів.

```gdscript
if not GameCon.is_signed_in():
    var code = await GameCon.start_device_login()   # покажіть code.user_code і code.verification_uri
    await GameCon.wait_for_login(code)
await GameCon.set_presence("В матчі · Арена")
var friends = await GameCon.friends_online()
await GameCon.unlock_achievement("first_win")
await GameCon.submit_score("weekly", 1520)
```

Вхід кодом пристрою (RFC 8628): у грі не потрібен браузер — гравець підтверджує з телефона.
