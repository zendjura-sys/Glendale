# Увійти через GameCon — NodeBB 3/4

1. Розпакуйте в `node_modules/nodebb-plugin-sso-gamecon` і виконайте там `npm install --omit=dev`
   (або `npm install /шлях/до/nodebb-plugin-sso-gamecon` у корені NodeBB).
2. Адмінка → Розширення → Плагіни → увімкніть «sso-gamecon», перезапустіть NodeBB.
3. Адмінка → Соціальний вхід → GameCon: Client ID, Secret.
4. На GameCon адреса повернення: `https://ваш-форум/auth/gamecon/callback`.
