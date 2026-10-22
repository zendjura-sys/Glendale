# Секреты и ключи: где лежат и как ими пользоваться

**В репозитории нет и не должно быть ни одного настоящего ключа.** Репозиторий публичный: всё, что
попало в коммит (даже удалённое потом), видно всем и остаётся в истории. Этот файл описывает **где**
лежат секреты и **как** код их получает — без значений.

---

## 1. Три места, где живут секреты

| Где                                                         | Что там                                                                                                                                           | Кто меняет                        |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| **Админка → Інтеграції** (таблица настроек, `SiteSettings`) | ключи внешних сервисов: видеоплееры 1–3, TMDB, Spotify, AcoustID, Last.fm, Discogs, Discord, Telegram, Steam, DeepL, Sightengine, FCM, LiveKit, … | администратор сайта через админку |
| **`.env` на сервере** (`/var/www/gamecon/.env`)             | `APP_KEY`, пароли БД и Redis, почта, Reverb, запасные значения ключей интеграций                                                                  | только владелец сервера           |
| **GitHub → Settings → Secrets and variables → Actions**     | ключ подписи Android‑приложения и пароли к нему                                                                                                   | только владелец репозитория       |

Шаблоны без значений: `.env.example` (локально), `deploy/.env.production.example` (сервер).

---

## 2. Секреты в админке (`SiteSettings`)

- Список секретных ключей — константа `SiteSettings::SECRETS` в `app/Support/Settings/SiteSettings.php`.
  Сейчас там: `spotify_client_secret`, `kodik_token`, `kodik_links_key`, `videoseed_token`,
  `flixcdn_token`, `tmdb_token`, `omdb_key`, `discord_client_secret`, `discord_bot_token`,
  `fcm_service_account`, `livekit_api_secret`, `rawg_key`, `igdb_client_secret`, `steam_api_key`,
  `deepl_key`, `maxmind_license_key`, `vapid_private`, `telegram_bot_token`, `telegram_webhook_secret`,
  `twitch_client_secret`, `sightengine_secret`, `google_play_service_account` (ключ сервисного аккаунта с доступом
  к Google Play Developer API; пусто — используется `fcm_service_account`), `google_play_rtdn_token` (секрет в адресе
  Pub/Sub push, создаётся сам), `monobank_acquiring_token` (X-Token эквайринга monobank;
  запасной вариант — `MONOBANK_ACQUIRING_TOKEN` в `.env`). `donatello_token` остался в списке только для
  старых данных — Donatello больше не используется. Метаданные музыки (`Services/Music/*`, все три необязательны):
  `acoustid_key` (ключ приложения AcoustID — распознавание трека по отпечатку `fpcalc`; получить:
  https://acoustid.org/new-application; запасной вариант — `ACOUSTID_KEY`), `lastfm_key` (API key Last.fm —
  теги, биографии, похожие исполнители; https://www.last.fm/api/account/create; `LASTFM_KEY`), `discogs_token`
  (Personal access token Discogs — релизы, обложки, фото исполнителей; https://www.discogs.com/settings/developers;
  `DISCOGS_TOKEN`). MusicBrainz, Cover Art Archive и LRCLIB ключей не требуют.
  Перевод и орфография (необязательны): `libretranslate_key` (ключ своего LibreTranslate — обычно не нужен:
  сервер слушает только `127.0.0.1`; адрес — обычная настройка `libretranslate_url`, запасной вариант —
  `LIBRETRANSLATE_URL` / `LIBRETRANSLATE_KEY`), `languagetool_key` (API key LanguageTool Premium вместе с
  логином `languagetool_username`; свой сервер LanguageTool ключа не требует; `LANGUAGETOOL_KEY`).
  LibreTranslate ставится на сервер по желанию: `INSTALL_LIBRETRANSLATE=1` при деплое (~2–4 ГБ RAM,
  несколько ГБ диска), см. ARCHITECTURE.md § 8.
- Хранятся **зашифрованными** (`Crypt::encryptString`, ключ шифрования — `APP_KEY` из `.env`).
- **Только запись:** админка никогда не показывает значение (маска), пустое поле = «оставить как есть»,
  явная очистка = удалить. `SiteSettings::public()` их не отдаёт; на клиент они не попадают.

Как код читает секрет:

```php
// 1) из админки, 2) запасной вариант — из .env через config/services.php
$token = $this->settings->secret('kodik_token') ?: config('services.kodik.token');
```

Как записать (только в коде админки или в тестах с фейковым значением):

```php
app(SiteSettings::class)->putSecret('kodik_token', $value); // null или '' — удалить
```

Новый секрет добавляется так:

1. ключ в `SiteSettings::DEFAULTS` (значение `null`) **и** в `SiteSettings::SECRETS`;
2. поле `type => 'secret'` в `Admin\IntegrationController` (с `rules` для формата);
3. запасной `env('…')` в `config/services.php` + пустая строка в `.env.example`;
4. чтение через `->secret('…') ?: config('…')`.

---

## 3. `.env` на сервере

- `APP_KEY` — **нельзя менять и пересоздавать** (`php artisan key:generate` на живом сервере):
  все секреты из админки, сессии и зашифрованные поля станут нечитаемыми.
- `DB_*`, `REDIS_*`, `MAIL_*`, `REVERB_*`, `LIVEKIT_*`, `FIREBASE_*` и запасные ключи интеграций
  (`KODIK_TOKEN`, `VIDEOSEED_TOKEN`, `TMDB_TOKEN`, … — полный список имён в `config/services.php`).
- Деплой (`deploy/remote.sh`) `.env` не трогает. Если `.env` нет — деплой останавливается.

---

## 4. GitHub Actions

Имена секретов, которые ждёт `.github/workflows/app-build.yml`:

| Секрет                    | Что это                                                     |
| ------------------------- | ----------------------------------------------------------- |
| `GAMECON_KEYSTORE_BASE64` | файл ключа загрузки Android (`gamecon-upload.jks`) в base64 |
| `GAMECON_STORE_PASSWORD`  | пароль хранилища ключей                                     |
| `GAMECON_KEY_ALIAS`       | имя ключа                                                   |
| `GAMECON_KEY_PASSWORD`    | пароль ключа                                                |

Без них сборка релиза останавливается с ошибкой (специально — неподписанный релиз не нужен).
Ключ загрузки и ключ подписи Google Play — разные: Play Market переподписывает приложение своим ключом,
поэтому APK из Actions и версия из Play Market не ставятся друг поверх друга.

---

## 5. Что публично «по природе» (это не утечка)

- `mobile/android/app/google-services.json` — Firebase‑конфиг Android. Он всё равно внутри каждого APK.
  Защита — ограничения ключа в Google Cloud Console (пакет `online.gamecon.app` + SHA‑1 подписей).
- `VITE_*` переменные — попадают в JS сайта, поэтому туда кладут только публичные значения.
- `googleWebClientId` в `mobile/lib/auth_screen.dart` — публичный OAuth client id.

---

## 6. Правила (для людей и ИИ‑агентов)

1. **Никогда не коммитить значения**: ни в код, ни в тесты, ни в доки, ни в сообщения коммитов и PR.
   В тестах — только явно фейковые строки (`'kodik-token'`, `'partnerkey1234567890'`).
2. **Не выводить секреты** в логи, исключения, ответы API, toast‑сообщения, артефакты CI.
3. Не коммитить: `.env*` (кроме `*.example`), `*.jks`, `*.keystore`, `key.properties`, `.mcp.json`,
   service account JSON, бэкапы БД. Они в `.gitignore` — не убирать их оттуда.
4. Получил ключ в чате или задаче → положить в админку / `.env` / GitHub Secrets, **не в код**.
5. Не использовать чужие ключи (из декомпилированных приложений, чужих репозиториев, слитых конфигов).
6. Нашёл ключ в истории git → считать его скомпрометированным: отозвать и выпустить новый у
   провайдера, затем заменить в админке. Удаление коммита ключ не «спасает».
7. Не трогать рабочие секреты без прямой просьбы владельца: не менять, не очищать, не «проверять» их
   реальными запросами, не перевыпускать `APP_KEY`.
