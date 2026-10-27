# Чек-лист функций сайта для сверки с приложением

Снимок на **9 октября 2026**: сайт — коммит `df1e7f4` (ветка `cursor/app-redesign-b6da`),
приложение — **1.1.29+40** (`mobile/pubspec.yaml`).

Список собран из маршрутов (`routes/web.php`, `routes/settings.php`, Fortify) и страниц
(`resources/js/pages/**`). У каждого пункта указано, где он на сайте, чтобы его было легко найти.

## ⚠️ Оплата в приложении — правила Google Play (иначе бан)

- **Білінг только на сайте.** Раздела «Рахунок» (`/plus/billing`), пополнения донатом, покупок с рахунку
  и автопродления в приложении нет — ни экрана, ни запросов к `/plus/billing/*`.
- **Никаких кнопок и ссылок на внешнюю оплату:** не открывать `/plus/billing`, `/plus`, `/pricing`,
  страницы донат-сервисов (Donatello, Diaka, Donatik, Buy Me a Coffee, Patreon) ни через браузер,
  ни через WebView, и не писать «купите на сайте».
- Цифровые покупки внутри приложения — только через Google Play Billing (`mobile/lib/play_billing.dart`):
  цены и планы из Google Play, покупку проверяет сервер (`POST /api/v1/google-play/verify`).
- Показывать уже купленное можно: значок GameCon+, оформление профиля, срок действия.

## Инструкция для Cursor

1. Для каждого пункта найдите аналог в приложении (`mobile/lib/**`, запросы через `api.dart`
   к `/api/v1/...` или `Api.site('/...')`) и поставьте отметку:
    - `[x]` — есть и работает так же;
    - `[~]` — есть частично (напишите, чего не хватает);
    - `[ ]` — нет в приложении.
2. Пункты с пометкой **«только сайт»** в приложении не нужны, их не отмечайте.
3. В конце заполните таблицу «Итог»: только `[ ]` и `[~]`, с файлом сайта и предложением,
   куда это добавить в приложении. Код пока не пишите — сначала список.
4. Не считайте функцию отсутствующей только потому, что маршрут в приложении другой: приложение
   ходит в `/api/v1/*` (`routes/api.php`), там те же контроллеры.

---

## 1. Вход и аккаунт

- [ ] Вход по email и паролю — `pages/auth/login.tsx`
- [ ] Регистрация — `pages/auth/register.tsx`
- [ ] Забыл пароль / сброс пароля — `pages/auth/forgot-password.tsx`, `reset-password.tsx`
- [ ] Подтверждение email — `pages/auth/verify-email.tsx`
- [ ] Двухфакторная аутентификация: вход с кодом — `pages/auth/two-factor-challenge.tsx`
- [ ] Двухфакторная аутентификация: включение и коды восстановления — `components/two-factor-setup-modal.tsx`, `pages/settings/security.tsx`
- [ ] Ключи доступа (passkeys) — `config/fortify.php` (`Features::passkeys`), `pages/settings/security.tsx`
- [ ] Вход через Discord — `GET /auth/discord`
- [ ] Вход через Google (Firebase) — `POST /auth/firebase`
- [ ] Отвязка Discord / Google — `DELETE /auth/social/{provider}`
- [ ] Смена пароля — `PUT /settings/password`
- [ ] Удаление аккаунта — `DELETE /settings/profile`
- [ ] Выбор языка (uk, en, de, … — список из админки), в т. ч. на экране входа — `components/gc/language-switcher.tsx`, `POST /locale`
- [ ] Отписка от писем по ссылке — `/mail/unsubscribe/{user}` (**только сайт**)

## 2. Профиль и настройки

- [ ] Своя страница и чужой профиль (`/me`, `/{username}`, `/id{id}`) — `pages/profile/show.tsx`
- [ ] Аватар: загрузка и удаление — `POST/DELETE /me/avatar`
- [ ] Обложка профиля — `POST /me/cover`
- [ ] Редактирование профиля: имя, ник, статус, о себе, город, сайт, пол, день рождения — `pages/settings/profile.tsx`
- [ ] Приватность: закрытый профиль, кто может писать — `pages/settings/profile.tsx`
- [ ] «Граю в…»: в профиле только во время игры; настройка в «Налаштування → Профіль» — `components/gc/playing.tsx` (`PlayingSettingsCard`, `PlayingDialog`)
- [ ] «Граю в…»: автоматически (Discord / Steam / приложение), привязка Steam — `PUT /me/playing/auto`, `POST/DELETE /me/playing/steam`
- [ ] «Граю в…»: ручной выбор сервера или игры, поиск, срок — `PUT /me/playing`, `GET /me/playing/search`
- [ ] Достижения и уровень (бейджи, прогресс опыта) — `components/gc/achievements.tsx`
- [ ] Галочка верификации — `components/gc/verified-badge.tsx`
- [ ] Нижняя панель: выбор разделов — `pages/settings/navigation.tsx`, `PUT /settings/navigation`
- [ ] Подключённые аккаунты (список, отвязка) — `pages/settings/security.tsx`

## 3. Лента, посты, комментарии

- [ ] Лента новостей — `pages/feed/index.tsx`, `GET /feed`
- [ ] Дни рождения друзей в ленте — `FeedController` (блок birthdays)
- [ ] Создание поста: текст, фото, музыкальный трек — `components/gc/post-composer.tsx`
- [ ] Видимость поста: «Усім» / «Друзям» / «Тільки мені» — `post-composer.tsx`
- [ ] Пост от имени сообщества — `post-composer.tsx` («Від імені спільноти»)
- [ ] Страница поста — `pages/posts/show.tsx`
- [ ] Лайк поста — `POST /posts/{post}/like`
- [ ] Закрепление поста — `POST /posts/{post}/pin`
- [ ] Удаление поста — `DELETE /posts/{post}`
- [ ] Комментарии: список, добавление, удаление, лайк — `components/gc/comments.tsx`
- [ ] «Перекласти» для постов и комментариев — `components/gc/translate.tsx`, `POST /translate`
- [ ] Истории: лента, создание, просмотр, удаление — `components/gc/stories.tsx`, `/stories*`
- [ ] Истории: реакция, ответ, список просмотревших — `POST /stories/{story}/react`, `/reply`, `GET /viewers`

## 4. Друзья, люди, поиск, уведомления

- [ ] Друзья: список, заявки, принять, добавить, удалить — `pages/friends/index.tsx`, `/friends/{user}*`
- [ ] Поиск людей с фильтрами — `pages/people/index.tsx`
- [ ] Быстрый поиск (людей и сообществ) в шапке — `components/gc/quick-search.tsx`, `GET /search/quick`
- [ ] Уведомления: список, «прочитать все», счётчик — `components/gc/notifications-menu.tsx`, `/notifications`
- [ ] Push-уведомления (в приложении FCM) — сервер `app/Services/Push`
- [ ] Объявление администрации (полоса сверху; текст из админки, настройка `maintenance_message`) — `layouts/social-layout.tsx` (`site.announcement`)

## 5. Сообщения и звонки

- [ ] Список бесед, непрочитанные — `components/messenger/conversation-list.tsx`
- [ ] Личный чат, история, «друкує…», «в мережі» — `chat-view.tsx`
- [ ] Отправка: текст, эмодзи, стикеры — `composer.tsx`, `emoji-panel.tsx`, `GET /messages/stickers`
- [ ] Вложения: фото, файл; скачивание вложений — `composer.tsx`, `GET /messages/attachments/{id}`
- [ ] Голосовые сообщения (запись, отправка, прослушивание) — `composer.tsx`
- [ ] Отправить контакт — `contact-share-dialog.tsx`
- [ ] Ответ на сообщение, редактирование, удаление — `message-bubble.tsx`, `PATCH/DELETE .../messages/{message}`
- [ ] «Перекласти» сообщение — `message-bubble.tsx`
- [ ] Жалоба на сообщение — `report-dialog.tsx`, `POST .../messages/{message}/report`
- [ ] Выключить уведомления беседы — `POST /messages/{conversation}/mute`
- [ ] Групповые чаты: создание, участники (добавить/удалить), название, аватар — `new-chat-dialog.tsx`, `group-info-dialog.tsx`
- [ ] Написать пользователю из профиля — `GET /messages/with/{user}`
- [ ] Аудиозвонок в личном и групповом чате, входящий звонок — `components/gc/incoming-call.tsx`, `/messages/{conversation}/call`, `/calls/{call}/*`
- [ ] «Слухати музику разом» из чата — `chat-view.tsx`

## 6. Сообщества

- [ ] Каталог сообществ, поиск — `pages/communities/index.tsx`
- [ ] Создание сообщества — `components/communities/create-community-dialog.tsx`
- [ ] Страница сообщества, стена, вступить / выйти — `pages/communities/show.tsx`
- [ ] Закрытые группы: заявки, одобрить / отклонить — `pages/communities/members.tsx`
- [ ] Участники и роли — `PATCH /c/{community}/members/{user}`
- [ ] Настройки: название, адрес, описание, статус, город, сайт, тип (група / публічна сторінка), открытая / закрытая, стена — `pages/communities/settings.tsx`
- [ ] Аватар и обложка сообщества — `POST /c/{community}/images/{field}`
- [ ] Фото сообщества — `GET /c/{community}/photos`
- [ ] Удаление сообщества — `DELETE /c/{community}`
- [ ] Голосовые комнаты сообщества — `components/gc/voice-rooms.tsx`

## 7. Фотографии

- [ ] Мои фото и фото пользователя — `pages/photos/*`, `/photos/u/{user}`
- [ ] Альбомы: создать, переименовать, удалить, загрузить фото — `/albums*`
- [ ] Просмотр фото: лайк, комментарии, описание, удаление — `components/photos/photo-viewer.tsx`
- [ ] Сделать фото обложкой альбома — `POST /photos/{photo}/cover`

## 8. Музыка

- [ ] Моя музыка, поиск, музыка пользователя — `pages/music/*`
- [ ] Загрузка треков с метаданными, редактирование, удаление, скачивание — `upload-dialog.tsx`, `edit-track-dialog.tsx`
- [ ] Добавить трек себе / убрать — `/music/tracks/{track}/library`
- [ ] Плейлисты: создать, изменить, удалить, добавить/убрать трек — `/music/playlists*`
- [ ] Общий плеер и полноэкранный плеер с перемоткой — `components/music/player-bar.tsx`
- [ ] Поделиться треком — `share-track-dialog.tsx`
- [ ] Spotify: подключение, библиотека, плейлисты, поиск, воспроизведение — `components/music/spotify-panel.tsx`, `/music/spotify/*`
- [ ] «Сейчас слушаю» в профиле (Spotify) — `/music/now-playing`, `PATCH /music/spotify` (`show_now_playing`)
- [ ] Слушать вместе: создать, пригласить, очередь, управление — `/music/together`, `/listen/{party}*`

## 9. Кино

- [ ] Каталог фильмов, поиск — `pages/cinema/index.tsx`
- [ ] Страница фильма, просмотр (плеер) — `pages/cinema/show.tsx`, `GET /play/embed`
- [ ] Мои фильмы и статусы (смотрю / посмотрел / …) — `/cinema/my`, `PATCH /cinema/{movie}/status`
- [ ] Оценка фильма — `PUT /cinema/{movie}/rating`
- [ ] Комментарии к фильму — `/cinema/{movie}/comments`
- [ ] Поделиться фильмом — `components/cinema/share-movie-dialog.tsx`
- [ ] Совместный просмотр: создать, пригласить, синхронизация, чат, голос — `/cinema/{movie}/watch`, `/watch/{party}*`

## 10. Сервера GTA

- [ ] Каталог серверов: ПК / мобильные, поиск, сортировка — `pages/servers/index.tsx`
- [ ] Фильтр по языку и заголовок по языку («Українські», «Німецькі»…) — `ServerController@index`
- [ ] Страница сервера — `pages/servers/show.tsx`
- [ ] Предложить сервер — `POST /servers/suggest`, `components/servers/server-form.tsx`
- [ ] События сервера: создать, удалить, «піду / не піду» — `/events/server/*`

## 11. Игры и кланы

- [ ] Каталог игр: поиск, разделы, A–Z — `pages/games/index.tsx`
- [ ] Страница игры, языки игры — `pages/games/show.tsx`
- [ ] События игры (в т. ч. из Discord): создать, удалить, «піду» — `/events/game/*`
- [ ] Кланы: каталог, фильтр по игре и типу (клан / гильдия) — `pages/clans/index.tsx`
- [ ] Создание клана — `pages/clans/create.tsx`
- [ ] Страница клана: вступить, выйти, участники, роли — `pages/clans/show.tsx`
- [ ] Новости клана — `/clans/{clan}/news*`
- [ ] Мероприятия клана, «піду» — `/clans/{clan}/events*`
- [ ] Взносы: внести, проверить, траты — `/clans/{clan}/contributions*`, `/spend`
- [ ] Чат клана — `GET /clans/{clan}/chat`
- [ ] Настройки клана — `POST /clans/{clan}/settings`

## 12. Календарь событий

- [ ] Общий календарь: семьи, кланы, сервера, игры в одной ленте — `pages/events/index.tsx`
- [ ] «Піду / не піду» и напоминание за полчаса — `EventController`, push

## 13. Семьи

- [ ] Каталог семей, создание семьи — `pages/families/index.tsx`, `create.tsx`
- [ ] Публичная страница семьи, заявка на вступление и её отзыв — `pages/families/public.tsx`, `/f/{family}/apply`
- [ ] Обзор семьи — `pages/families/overview.tsx`
- [ ] Отчёты: подать, мои отчёты — `pages/families/reports.tsx`
- [ ] Очередь проверки: одобрить / отклонить, массово, история за 30 дней, доказательства — `pages/families/queue.tsx`
- [ ] Банк: баланс, история, вывод (заявка, оплата, отмена, подтверждение), депозиты, ручная операция — `pages/families/bank.tsx`
- [ ] Склад: предметы, перемещение, журнал с доказательствами — `pages/families/warehouse.tsx`
- [ ] Участники: принять / отклонить, исключить, ранги, передать лидерство, баланс — `pages/families/members.tsx`
- [ ] Дисциплина: предупреждения, наказания, отмена, временный мьют — `pages/families/discipline.tsx`
- [ ] Мероприятия семьи, «піду», закрытие — `pages/families/events.tsx`
- [ ] Рейтинг — `pages/families/rating.tsx`
- [ ] Журнал действий (аудит) — `pages/families/audit.tsx`
- [ ] Чат семьи — `GET /f/{family}/chat`
- [ ] Голосовые комнаты семьи — `components/gc/voice-rooms.tsx`
- [ ] Настройки: профиль семьи, правила и ставки — `pages/families/settings.tsx`
- [ ] Настройки: боты Discord и Telegram (вебхуки, тест) — `PUT /f/{family}/settings/webhooks`, `/test`
- [ ] Настройки: еженедельный отчёт по личному счёту — `POST /f/{family}/settings/digest`
- [ ] Выйти из семьи — `POST /f/{family}/leave`
- [ ] Виджет семьи на главном экране (в приложении — Android-виджет) — `components/gc/widget.tsx`

## 14. Голосовые комнаты

- [ ] Список комнат, создание, вход — `/voice/{type}/{id}`, `/voice/rooms/{room}/join`
- [ ] Изменение, удаление комнаты — `PATCH/DELETE /voice/rooms/{room}`
- [ ] Модерация участников (выключить микрофон, выгнать) — `POST /voice/rooms/{room}/members/{user}`
- [ ] Панель текущего звонка — `components/gc/voice-bar.tsx`

## 15. Прочее

- [ ] Ссылка на Google Play — `components/gc/play-store.tsx` (**только сайт**)
- [ ] Установка как PWA — `public/sw.js`, manifest (**только сайт**)
- [ ] Главная страница для гостей — `pages/welcome.tsx` (**только сайт**)
- [ ] Админ-панель и модерация — `pages/admin/*` (**только сайт**)

## 16. Новое (октябрь 2026)

- [x] Турниры и челленджи серверов: список, сетка, таблица, заявка, результат со скриншотом, управление организатора — `pages/tournaments/*`, `mobile/lib/tournaments.dart` (создание турнира — только сайт)
- [x] Подбор тиммейтов: анкета, «Шукаю зараз», совместимость, приглашение в пати — `pages/party/match.tsx`, `mobile/lib/teammates.dart`
- [x] Сезонный пропуск — `pages/season/index.tsx`, `mobile/lib/season.dart` (админка сезонов — только сайт)
- [x] Комнаты «Слухати разом» для групп — `pages/music/rooms.tsx`, `mobile/lib/listen_rooms.dart` (политика «кто может открывать» — только сайт)
- [x] Станции групп в «Радіо» — `pages/music/radio.tsx`, `mobile/lib/music_home.dart`
- [x] GameCon Connect — `lib/connect.ts`, `mobile/lib/connect.dart`
- [x] Вход на сайт через приложение — `pages/auth/app-login.tsx`, `mobile/lib/app_login.dart`
- [x] Game Card — `pages/profile/card.tsx`, `mobile/lib/game_card.dart`
- [x] Прогресс приглашений — `pages/invite/index.tsx`, `mobile/lib/extras.dart` (`InviteScreen`)
- [x] Ранковий дайджест: переключатель — `components/settings/digest-switch.tsx`, `mobile/lib/settings.dart` (`DigestSwitch`)
- [x] «Показувати, що я слухаю» — `components/music/listening-switch.tsx`, `mobile/lib/music.dart`
- [x] Офлайн-музыка — **только приложение** (`mobile/lib/downloads.dart`)
- [x] Виджеты Android «Моя сім’я» и «Пульс GameCon» — **только приложение**
- [x] Стандарты безопасности детей `/child-safety` и причина жалобы «Загроза дитині» — сайт и приложение
- [x] Довідка `/help` — **только сайт** (в приложении ссылки открываются в браузере)
- [x] Музыка в ботах Discord/Telegram — **только сайт** (настройки ботов группы)
- [ ] Роздачі ігор (Epic, Steam, GOG) и подписка на них — `pages/games/deals.tsx`; в приложении пока нет (нужен мост `games/deals`)
- [ ] Бажане и сповіщення про знижку, ціни магазинів на сторінці гри — `components/games/game-prices.tsx`; в приложении пока нет
- [ ] «Чи потягне мій ПК» (збірка + вимоги Steam) — `components/games/pc-check.tsx`; в приложении пока нет (ПК-функция, низкий приоритет)
- [ ] Тема профілю за грою — `components/settings/game-theme-picker.tsx`, кольори в `profile.accent`; приложению нужен мост `settings/game-theme` и отрисовка accent
- [ ] Звук сповіщень — `components/settings/notify-sound-picker.tsx`, `lib/sounds.ts`; в приложении — системные звуки push (свой выбор пока не сделан)
- [~] Анімації ніку «Неон» и «Веселка» — сайт везде (лента, комментарии, карточки); приложение показывает их как обычный цвет ника
- [ ] Своя іконка застосунку — **только приложение**, ещё не сделано
- [ ] Оцінка гравців GameCon на сторінці гри — `components/games/community-rating.tsx`; в приложении нет
- [ ] Wrapped: слайд «Ігровий рік» — `pages/wrapped.tsx`; в приложении нет нового слайда
- [ ] Опитування в історіях — `components/gc/stories.tsx`; в приложении нет
- [ ] Реакції на повідомлення й відеокружки — `components/messenger/*`; в приложении нет
- [ ] «Дякую» під гідами й коментарями, лічильник у профілі — `components/gc/thanks-button.tsx`; в приложении нет
- [ ] Запрошення в паті й голосову кімнату за посиланням — `pages/join/show.tsx`; приложению нужна обработка `/join/{token}`
- [ ] Джерела переходів в аналітиці сервера, тижневий дайджест спільноти, автомодерація груп — только сайт
- [ ] Шпалери й «Музика гри» на сторінці гри — `pages/games/show.tsx`; в приложении нет
- [ ] Економія трафіку — сайт; в приложении есть свой режим, не синхронизирован
- [ ] Статті `/articles` — `pages/articles/*`; в приложении нет (мост `articles`)
- [x] Офлайн-режим сайту (service worker) — только сайт; гарячі клавіші J/K/L — только сайт
- [ ] Відкриті гостям сторінки ігор і профілів (SEO, `layouts/public-layout.tsx`) — только сайт
- [ ] Бэклог ігор «хочу — граю — пройшов — кинув» — `pages/games/backlog.tsx`, перемикач на сторінці гри, блок «Ігри» в профілі; мост готовий (`site/games/backlog`, `site/games/{game}/backlog`), екрана в приложении нет
- [ ] Плитки меню «Музики» з обкладинками на ПК (`/music/menu-covers`) — только сайт ПК
- [ ] Статус з емодзі й таймером — `components/gc/status-dialog.tsx`, емодзі на аватарі; мост готовий (`site/me/status`), поля `status_emoji`/`status_until` уже в `/me` приложения, экрана выбора нет
- [ ] «Готовий грати зараз» — `components/party/ready-to-play.tsx` (стрічка, «Пошук паті»), позначка в профілі; мост готовий (`site/ready`), экрана в приложении нет
- [ ] «Кліп тижня» в «Моментах» (переможець, лідер, архів) — `components/moments/clip-of-week.tsx`; сповіщення `clip_of_week` и бейдж приходят и в приложение, блока на экране «Моменты» нет
- [ ] «Поки тебе не було» в групах — `components/messenger/catch-up.tsx`; міст готовий (`site/messages/{id}/catch-up`), картки в чаті приложения нет
- [ ] Голосування за час гри в «Пошуку паті» — `components/party/time-poll.tsx`, третій варіант часу у формі; міст готовий (`site/party/{id}/time`, `site/party/{id}/time/{slot}`, `time_poll` у картці паті), екрана в приложении нет
- [ ] Канали спільнот — `pages/communities/channels.tsx`, `components/communities/channel-*.tsx`, `voice-channel.tsx`; міст готовий (`site/c/{slug}/channels…`, `site/c/{slug}/channel-categories…`; текстові канали — звичайні бесіди `site/messages/{id}`), екрана в приложении нет
- [ ] Доступ до спільноти й каталог — `components/communities/access-card.tsx`, пароль у `join-button.tsx`, добірки й сортування в `pages/communities/index.tsx`; міст готовий (`site/c/{slug}/settings/access`, `password` у `POST /api/v1/communities/{slug}/join` і `site/c/{slug}/join`, `sort` і `sections` у `site/communities`), у приложении нет окна пароля и подборок
- [ ] Інструменти чату — `chat-shared-dialog.tsx`, `doc-preview.tsx`, `restrict-dialog.tsx`, `chat-background.tsx`; міст готовий (`site/messages/{id}/shared`, `…/members/{user}/restrict`, `…/background`, `site/messages/attachments/{id}/preview`; `timeout_until` і `background` у деталях бесіди), у приложении нет панели материалов, фона и меню наказаний
- [ ] Боти бесіди (привітання, автопости) — `components/messenger/chat-bots-dialog.tsx`, повідомлення бота з позначкою «бот» у `message-bubble.tsx`; міст готовий (`site/messages/{id}/bots…`, поле `bot` у повідомленні), у приложении нет диалога ботов и плашки «бот»
- [ ] ШІ (Claude або OpenAI-сумісний, ключ в адмінці): ШІ-редактор у полі вводу (`ai-writer.tsx`), «Підсумок від ШІ» (`ai-summary-dialog.tsx`), вкладка «ШІ-бот» у ботах бесіди, «Написати з ШІ» в описі спільноти; міст готовий (`site/ai/rewrite`, `site/messages/{id}/ai/summary`, `site/messages/{id}/bots/ai`, `site/c/{slug}/ai/description`), у застосунку цих кнопок ще немає
- [ ] Бан гостя гостьового чату — кнопка в `message-bubble.tsx` і `guest-ban-dialog.tsx`; міст готовий (`site/messages/{id}/messages/{msg}/ban-guest`), у застосунку кнопки ще немає
- [ ] Новини й патчі гри (`components/games/game-news.tsx`, міст `site/games/{slug}/news`) і баннер «Паті зібрана» з кнопкою «Зайти в голосову» (поле `voice_room` у паті) — у застосунку ще немає
- [ ] #Згадки ігор (поле `games` у записі), лідерборд гри (`leaderboard` на сторінці гри), «Сумісність N%» (`compatibility` у профілі) — у застосунку ще немає
- [ ] Рідкість бейджів («є у 2% людей») — поле `rarity` у бейджах уже приходить у приложение, не показується
- [~] Режими скрізь: сервер уже ховає за режимом плагіни, бейджі, блоки профілю, картки в постах і чатах, події, сповіщення, дайджест і Wrapped (мост віддає те саме); приложению осталось спрятать свои тексты-упоминания и пункти (списки друзів «Рейд»/«Кіно», «Картка» в чаті) по `user.modules`

---

## Итог (заполняет Cursor)

| #   | Функция | Статус (`[ ]` / `[~]`) | Где на сайте | Чего не хватает / куда добавить в приложении |
| --- | ------- | ---------------------- | ------------ | -------------------------------------------- |
|     |         |                        |              |                                              |
