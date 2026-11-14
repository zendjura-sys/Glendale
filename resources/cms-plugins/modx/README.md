# Увійти через GameCon — MODX Revolution 2.8 / 3.x

1. Розпакуйте архів у корінь сайту (з’явиться `core/components/gamecon/`).
2. Системні налаштування → Створити:
   - `gamecon.client_id` — Client ID застосунку GameCon
   - `gamecon.client_secret` — Client Secret
   - `gamecon.base_url` — `https://gamecon.online`
   - (необов’язково) `gamecon.default_group` — група для нових користувачів
3. Елементи → Плагіни → Новий «GameConLogin», «Статичний» → файл
   `core/components/gamecon/elements/plugins/gamecon.plugin.php`, подія **OnWebPageInit**.
4. Елементи → Сніпети → Новий «GameConLogin», «Статичний» → файл
   `core/components/gamecon/elements/snippets/gameconlogin.snippet.php`.
5. Вставте `[[!GameConLogin]]` у шаблон чи форму входу.
6. На GameCon вкажіть адресу повернення: `https://ваш-сайт/?gamecon=callback`.
