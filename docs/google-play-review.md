# Google Play: GameCon+ в приложении и проверка модераторами

## Как устроено (мультиплатформенный аккаунт)

- GameCon+ привязан к **аккаунту GameCon**. Купить его можно только на сайте, в разделе GameCon+ → «Рахунок».
- Приложение **ничего не продаёт**: оно лишь узнаёт статус через `GET /api/v1/user/subscription-status`
  (`is_pro`, `expires_at`, `plan_name`, `style`) и открывает функции, если GameCon+ активен.
- Статус обновляется при запуске, входе, возврате в приложение (не чаще раза в 5 минут)
  и по кнопке «Перевірити статус».
- В меню приложения есть пункт «GameCon+»: список преимуществ, текущий статус, нейтральный текст,
  кнопки «Перевірити статус» и «Зрозуміло».
- Если сервер отвечает ошибкой лимита (например, «З GameCon+ — до 25 персонажів»), в снекбаре
  появляется кнопка «Що таке GameCon+?», которая открывает ту же информационную панель.

Код: `mobile/lib/subscription.dart`, `app/Http/Controllers/Api/SubscriptionStatusController.php`.
Тест `tests/Feature/AppSubscriptionStatusTest.php` проверяет, что в ответах для приложения нет цен,
сумм, слов «balance/billing/checkout», ссылок на оплату и донат-сервисов.

## Чего в приложении быть не должно (иначе бан)

1. Кнопок «Купить», «Оплатить», «Оформить», «Upgrade».
2. Цен в любой валюте.
3. Ссылок на `/plus`, `/pricing`, `/plus/billing` и страницы донат-сервисов — ни в браузере, ни в WebView.
4. Текстов в духе «купите на сайте», «на сайте дешевле», а также призывов перейти на сайт за GameCon+.

Эти правила продублированы в `docs/web-vs-app-checklist.md` и в комментарии в начале `subscription.dart`.

## Тестовый аккаунт для модераторов

На сервере (после деплоя):

```bash
cd /var/www/gamecon
php artisan plus:review-account
```

Команда создаст или обновит аккаунт `play-review@gamecon.online` с подтверждённой почтой и GameCon+
на 365 дней и **один раз** покажет новый пароль. Чтобы только продлить GameCon+, не меняя пароль:
`php artisan plus:review-account --keep-password`. Перед каждой отправкой версии на проверку
убедитесь, что срок не истекает в ближайшие недели.

## Текст для Play Console → App content → App access

Выберите **«All or some functionality is restricted»** → **Add new instructions**:

- **Name:** GameCon+ test account
- **Username:** `play-review@gamecon.online`
- **Password:** (пароль из команды выше)
- **Any other information required to access your app:**

```
GameCon is a multi-platform social network for gamers. Accounts are shared between our
website and this Android app. Optional premium features (GameCon+) are granted to the user
account; the app itself does not sell anything and contains no purchase flows, prices or
links to external payment pages.

We provide pre-activated test credentials so the review team can test all GameCon+ features
directly without payment. Sign in with the email and password above on the login screen
("Email" sign-in). The GameCon+ status is shown in Menu → GameCon+ ("Check status" refreshes
it from the server).

The account has no two-factor authentication.
```

Если у аккаунта включена двухфакторная проверка, модератор не сможет войти: не включайте её
на этом аккаунте. Проверяющие Google обычно заходят из США: если в Админка → «Блокування країн»
закрыты какие-то страны, убедитесь, что США среди них нет.
