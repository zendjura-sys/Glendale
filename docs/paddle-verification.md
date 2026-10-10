# Paddle: верификация сайта и запуск оплаты — пошаговый мануал

Порядок важен: сначала деплой и реквизиты на сайте, потом заявка в Paddle, потом ключи и цены в админке.

---

## 0. Перед заявкой — что должно быть на сайте

1. **Задеплоить ветку** с Paddle и юридическими страницами:
    ```bash
    composer install --no-dev --optimize-autoloader   # добавился laravel/cashier-paddle
    php artisan migrate --force                       # миграции 000079–000085
    npm ci && npm run build
    php artisan optimize
    ```
2. **Заполнить реквизиты в `.env`** (их видит проверяющий Paddle — имя должно совпадать с тем, что в аккаунте Paddle):
    ```dotenv
    LEGAL_OPERATOR="Иван Иванов"        # ФИО физлица или название ФОП/компании — КАК В АККАУНТЕ PADDLE
    LEGAL_EMAIL=support@gamecon.online   # рабочий ящик, на него будут писать покупатели
    LEGAL_ADDRESS="г. Киев, Украина"     # можно город/страну; полный адрес — по желанию
    LEGAL_COUNTRY=Ukraine                # право этой страны применяется в Terms
    LEGAL_UPDATED=2026-10-12             # меняйте при правке документов
    ```
    Затем `php artisan config:cache`.
3. **Проверить, что открывается без входа** (в окне инкогнито):
    - https://gamecon.online/pricing
    - https://gamecon.online/terms
    - https://gamecon.online/privacy
    - https://gamecon.online/refund-policy
    - футер с этими ссылками и строкой «Payments securely processed by Paddle as Merchant of Record» внизу любой страницы, включая главную и вход.
4. **Почта `LEGAL_EMAIL` должна принимать письма** — Paddle иногда пишет туда для проверки.

> ⚠️ **Риск: раздел «Кино».** Paddle запрещает продажу товаров, связанных с нарушением авторских прав, и проверяющий может открыть сайт целиком. Сторонние плееры (Kodik, Videoseed) с фильмами — это то, что может вызвать отказ, даже если подписка за кино не берёт денег. На время проверки рекомендую выключить модуль «Кино» для гостей (Админка → Модули) или целиком, а в описании бизнеса не упоминать фильмы. В Terms уже прописано, что видео не хранятся на наших серверах и встраиваются сторонние плееры, но это не гарантия одобрения.

---

## 1. Аккаунт Paddle

1. Зарегистрироваться на https://www.paddle.com → **Sign up** (сразу создаётся и sandbox: https://sandbox-vendors.paddle.com).
2. **Business details**: тип — Individual / Sole trader (или компания), страна — Ukraine, ФИО/название **точно как `LEGAL_OPERATOR`**.
3. Пройти KYC (паспорт/ID, иногда селфи) и указать банковские реквизиты для выплат (Payouts).

> Примечание: одобрение физлица без ФОП — на усмотрение Paddle. Если откажут — оформить ФОП и указать его название в `LEGAL_OPERATOR`.

---

## 2. Форма верификации сайта (Website / Domain approval)

**Где:** Paddle Dashboard → **Checkout → Website approval** (или в онбординге «Verify your website») → **Add domain**.

| Поле в форме         | Что вписать                                                              |
| -------------------- | ------------------------------------------------------------------------ |
| **Web domain**       | `gamecon.online` (без `https://` и без `www`, если сайт на голом домене) |
| **Pricing page**     | `https://gamecon.online/pricing`                                         |
| **Terms of service** | `https://gamecon.online/terms`                                           |
| **Privacy policy**   | `https://gamecon.online/privacy`                                         |
| **Refund policy**    | `https://gamecon.online/refund-policy`                                   |

Если форма спрашивает дополнительно:

- **What do you sell / Product description** (на английском):
    > GameCon is a social network for gamers. GameCon+ is an optional SaaS subscription (monthly/yearly, personal or family) that unlocks cosmetic and convenience features: a profile badge and name color, animated avatar and cover, avatar frames, higher limits for RP characters, pinned posts, party listings and chat file size, extra stickers and reactions. Users can gift GameCon+ to friends. Game server owners can buy time-limited promotion of their server listing (top placement, highlighted card, banner, always labeled as an ad). All core features of the network stay free.
- **How is the product delivered?** — `Instantly, online, in the user's account after payment (digital SaaS).`
- **Pricing model** — `Recurring subscriptions (monthly/yearly) and one-time purchases (gifts, server promotion).`
- **Do you sell physical goods / content you don't own?** — `No physical goods. No third-party content is sold.`

Ответ приходит обычно за 1–3 рабочих дня. При отказе Paddle присылает список замечаний — пришлите их мне, поправлю документы/страницы.

### Что именно проверяет Paddle (и где это у нас)

| Требование Paddle                   | Где выполнено                                                           |
| ----------------------------------- | ----------------------------------------------------------------------- |
| Цены видны без регистрации          | `/pricing` — строится из каталога и показывает только товары с Price ID |
| Описание продукта                   | `/pricing`, раздел 7 Terms                                              |
| Юр. имя продавца в Terms            | `LEGAL_OPERATOR` в шапке Terms/Privacy                                  |
| Paddle как Merchant of Record       | Terms §7, Refund §1, футер на всех страницах                            |
| Политика возврата с понятным сроком | Refund: 14 дней, двойные списания, отмена в 1 клик                      |
| Политика конфиденциальности         | `/privacy` (GDPR, Paddle как получатель данных)                         |
| Контакт для покупателей             | `LEGAL_EMAIL` во всех документах                                        |

---

## 3. Настройка Paddle после одобрения

Сначала всё делаем в **sandbox**, потом повторяем в live.

1. **Товары и цены:** Catalog → Products → New product. Создайте товары и цены (валюта UAH; если Paddle не даёт UAH — USD/EUR, тогда обновите цены на `/pricing` в `config/plus.php`):

    | Ключ в админке                             | Товар                      | Цена         | Тип                |
    | ------------------------------------------ | -------------------------- | ------------ | ------------------ |
    | `plus_month`                               | GameCon+ Monthly           | 149 ₴        | recurring, 1 month |
    | `plus_year`                                | GameCon+ Yearly            | 1290 ₴       | recurring, 1 year  |
    | `family_month`                             | GameCon+ Family Monthly    | 399 ₴        | recurring, 1 month |
    | `family_year`                              | GameCon+ Family Yearly     | 3490 ₴       | recurring, 1 year  |
    | `gift_month`                               | GameCon+ Gift (1 month)    | 149 ₴        | one-time           |
    | `gift_year`                                | GameCon+ Gift (1 year)     | 1290 ₴       | one-time           |
    | `promo_top_7` / `promo_top_30`             | Server Top 7/30 days       | 499 / 1490 ₴ | one-time           |
    | `promo_highlight_7` / `promo_highlight_30` | Highlighted card 7/30 days | 199 / 590 ₴  | one-time           |
    | `promo_banner_30`                          | Catalog banner 30 days     | 2490 ₴       | one-time           |

    Товары, которые не хотите продавать, просто не создавайте и не вписывайте Price ID — они исчезнут и с `/pricing`, и с сайта.

2. **Ключи:** Developer Tools → Authentication:
    - **API key** (`pdl_...`) — права на transactions, customers, subscriptions, adjustments (read/write);
    - **Client-side token** (`test_...` в sandbox, `live_...` в live);
    - **Seller ID** — в шапке Developer Tools.
3. **Вебхук:** Developer Tools → Notifications → **New destination**:
    - URL: `https://gamecon.online/paddle/webhook`
    - события: `subscription.*`, `transaction.*`, `customer.*`, `adjustment.*`
    - скопировать **Secret key**.
4. **Checkout settings:** Checkout → Checkout settings → **Default payment link**: `https://gamecon.online/plus`.
5. **Брендинг:** Checkout → Branding — цвет кнопок `#6366F1`, логотип GameCon. (Тему light/dark и язык сайт передаёт сам.)

## 4. Админка GameCon

**Админка → Интеграции → Paddle:**

1. Включить **Sandbox**, вписать Seller ID, Client-side token, API key, Webhook secret → **Сохранить** → **Проверить** (должно быть «OK»).
2. В блоке цен вписать Price ID (`pri_...`) для каждого товара.
3. Открыть `/pricing` — должны остаться только товары с Price ID.

Секреты (API key, Webhook secret) хранятся write-only: после сохранения их не видно, пустое поле = оставить старое значение.

## 5. Тест в sandbox

1. Войти на сайт → `/plus` → «Оформить» → в окне оплаты карта `4242 4242 4242 4242`, любой будущий срок, CVC `100`.
2. Проверить: значок GameCon+ появился сразу; в Paddle → Transactions — платёж; в админке → GameCon+ → Платежи — запись.
3. «Скасувати» на `/plus` → подписка помечена отменённой, доступ до конца периода; «Відновити» возвращает.
4. «Чеки й картка» открывает кабинет Paddle.
5. Подарок другу и продвижение сервера — тоже оплатить тестовой картой.
6. Возврат: Paddle → Transactions → платёж → **Refund** → после одобрения доступ/подарок/промо снимаются автоматически.
7. Developer Tools → Notifications → Logs: все события должны быть со статусом **200**.

## 6. Переход в live

1. Повторить шаги 3–4 в live-кабинете (vendors.paddle.com): товары, ключи, вебхук, брендинг.
2. В админке выключить **Sandbox** и вписать live-ключи и live Price ID.
3. Сделать одну реальную покупку на минимальную сумму и вернуть её себе.

---

## Если документы нужно поменять

- Тексты: `resources/views/legal/{terms,privacy,refund}/{язык}.blade.php`. Главный — `en`, при расхождениях действует он.
- Новый язык = новый файл, код трогать не нужно.
- После правок поменять `LEGAL_UPDATED` в `.env` и выполнить `php artisan config:cache`.
- Тексты составлены как надёжный шаблон под Paddle, но перед запуском их стоит показать юристу, особенно разделы об ограничении ответственности и праве изменять платные функции без уведомления (в ЕС это работает только «в пределах, разрешённых законом»).
