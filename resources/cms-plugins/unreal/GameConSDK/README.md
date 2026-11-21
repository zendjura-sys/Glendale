# GameCon SDK для Unreal Engine 5

1. gamecon.online/developers → «Новий застосунок» **без секрету** (публічний).
2. Скопіюйте `GameConSDK` у `Plugins/` проєкту, перезберіть (плагін вмикає WebBrowserWidget).
3. `Config/DefaultGame.ini`:
    ```ini
    [/Script/GameConSDK.GameConSubsystem]
    ClientId=CLIENT_ID
    ```
4. Blueprint: _Get Game Instance → Get Subsystem (GameCon)_:
    - **Start Device Login** → подія **On Login Code** (покажіть UserCode і VerificationUri чи QR з
      VerificationUriComplete) → **On Login Done**;
    - **Set Presence**, **Load Friends Online** (→ On Friends Loaded), **Unlock Achievement**, **Submit Score**.
5. Оверлей GameCon: UMG-віджет **Web Browser** на весь екран з прозорим фоном, Initial URL —
   **Overlay Url**. Віджети GameCon (паті, чат, сім’я/клан, крапля) — у кутах, кліки поза ними
   проходять у гру (Visibility віджета — Not Hit-Testable (Self Only)).

Вхід кодом пристрою (RFC 8628): у грі не потрібен браузер — гравець підтверджує з телефона.
Токени зберігаються в GameUserSettings.ini й оновлюються самі.
