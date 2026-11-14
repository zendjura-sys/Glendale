# Увійти через GameCon — Flarum 1.8+

1. Розпакуйте архів у `packages/gamecon-flarum-login` у корені форуму.
2. `composer config repositories.gamecon path packages/gamecon-flarum-login && composer require gamecon/flarum-login:*`
3. Адмінка → Розширення → «Увійти через GameCon» → увімкніть і вставте Client ID та Secret.
4. На GameCon вкажіть адресу повернення: `https://ваш-форум/auth/gamecon`.
