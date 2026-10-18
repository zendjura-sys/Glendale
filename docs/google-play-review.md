# Google Play: GameCon+ в приложении и проверка модераторами

## Как устроено (мультиплатформенный аккаунт)

- GameCon+ привязан к **аккаунту GameCon**: купленный на сайте или в приложении, он действует везде.
- В приложении GameCon+ покупается **только через Google Play Billing** (`mobile/lib/play_billing.dart`,
  пакет `in_app_purchase` 3.3 + `in_app_purchase_android` 0.5.4 = **Play Billing Library 8**). Цены, периоды
  и пробные периоды показывает Google Play (ProductDetails); сервер отдаёт только ID подписок и `account_id`
  (`GET /api/v1/google-play` → obfuscatedAccountId).
- Каждую покупку проверяет сервер: токен → `POST /api/v1/google-play/verify` → Google Play Developer API
  (subscriptionsv2) → acknowledge → доступ в `plus_grants`. Приложение само доступ не включает.
- Продления, отмены и возвраты приходят через RTDN (Pub/Sub) и ежедневную проверку `billing:tick`.
- Статус: `GET /api/v1/user/subscription-status` (`is_pro`, `expires_at`, `plan_name`, `style`; для подписки
  из Google Play — `store`, `auto_renew`, `manage_url` на страницу подписки в Google Play).
- В приложении: Меню → GameCon+ — преимущества, статус, планы Google Play, «Відновити покупки»,
  «Керувати підпискою в Google Play», «Перевірити статус».

Код: `mobile/lib/play_billing.dart`, `mobile/lib/subscription.dart`, `app/Services/Billing/GooglePlay.php`,
`Api/GooglePlayController`, `GooglePlayRtdnController`. Тест `tests/Feature/AppSubscriptionStatusTest.php`
проверяет, что в ответах для приложения нет цен сайта, ссылок на оплату сайта и донат-сервисов.

## Актуальные требования Google (октябрь 2026)

- С 31 августа 2026 новые приложения и обновления должны использовать **Play Billing Library 8+**
  (продление по запросу — до 1 ноября 2026). У нас PBL 8.0.0 — требование выполнено.
- Внешние ссылки на оплату и альтернативный биллинг Google разрешает лишь в отдельных программах (ЕЭЗ,
  Великобритания, США) с отдельной регистрацией и комиссией — мы ими **не пользуемся**: в приложении только
  Google Play Billing.

## Включить продажу (один раз, владелец)

1. Play Console → Монетизация → Подписки: создать подписку с ID `gamecon_plus` (или свой — тогда указать его
   в админке), базовые планы (например, месяц и год), по желанию — пробный период.
2. Play Console → Пользователи и разрешения: дать сервисному аккаунту (Firebase или отдельный) права
   «Просмотр финансовых данных» и «Управление заказами и подписками».
3. Play Console → Монетизация → Настройки монетизации → Real-time developer notifications: Pub/Sub-топик
   с push-подпиской на адрес из Админка → Інтеграції → Google Play (`…/billing/google-play/rtdn?token=…`).
4. Админка → Інтеграції → Google Play: ключ сервисного аккаунта (или оставить ключ Firebase), ID подписок,
   включить «Продавати GameCon+ у застосунку».
5. Проверить покупку тестовым аккаунтом (Play Console → Тестирование лицензий) во внутреннем тесте.

## Чего в приложении быть не должно (иначе бан)

1. Оплаты мимо Google Play Billing: ссылок и WebView на `/plus`, `/pricing`, `/plus/billing`, донат-сервисы.
2. Цен сайта и своих цен — в приложении только цены, которые вернул Google Play.
3. Текстов в духе «купите на сайте», «на сайте дешевле».

Эти правила продублированы в `AGENTS.md`, `docs/web-vs-app-checklist.md` и в начале `subscription.dart`.

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
account. In the app GameCon+ is sold only through Google Play Billing (subscriptions); there are
no links to external payment pages.

We provide pre-activated test credentials so the review team can test all GameCon+ features
directly without payment. Sign in with the email and password above on the login screen
("Email" sign-in). The GameCon+ status is shown in Menu → GameCon+ ("Check status" refreshes
it from the server).

The account has no two-factor authentication.
```

Если у аккаунта включена двухфакторная проверка, модератор не сможет войти: не включайте её
на этом аккаунте. Проверяющие Google обычно заходят из США: если в Админка → «Блокування країн»
закрыты какие-то страны, убедитесь, что США среди них нет.
