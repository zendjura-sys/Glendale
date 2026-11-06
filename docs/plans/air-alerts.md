# План: «Мапа тривог та радар цілей» (лише для України)

Статус: **заплановано, не розпочато**. Сайт, адмінка, міст `/api/v1/site/*` і застосунок `mobile/`.
Перед роботою — `AGENTS.md`, `docs/ARCHITECTURE.md`, `docs/SECRETS.md`.

## 1. Модуль, плагін і налаштування

- Плагін `air_alerts` у `config/plugins.php` (увімкнений за замовчуванням).
- `SiteSettings::DEFAULTS` і `SiteSettings::SECRETS`: `alerts_in_ua_token`; налаштування `alerts_monitor_channels` (типово `'kpszsu'`).
- Картка «Мапа тривог (alerts.in.ua)» в `Admin\IntegrationController` і `pages/admin/integrations.tsx`; усі зміни — `Log::info(...)`.

## 2. Міграція й моделі (наступний вільний номер, зараз 000194)

- Таблиця `air_threats`: `id`, `type` (`uav`, `missile`, `ballistic`, `kab`, `mig`, `artillery`), `region_slug`, `place_name`, `title`,
  `lat`, `lng` (float), `course_deg` (nullable smallint), `speed_kmh` (smallint, 0), `source_ref` (nullable, unique),
  `detected_at`, `expires_at`, timestamps.
- Користувач (у preferences, як заведено): `alert_region` (slug області), тумблер пушів про тривогу у своєму регіоні, статус «В укритті».

## 3. Сервіс `app/Services/Alerts/AirAlertService.php`

- Довідник 25 регіонів (24 області + м. Київ + АР Крим): slug, назва, центр (lat, lng), основні міста для прив’язки цілей.
- `state()`: кеш 15 с; з токеном — `https://api.alerts.in.ua/v1/alerts/active.json` (таймаут 3 с), інакше чи при збої —
  відкритий `https://ubilling.net.ua/aerialalerts/`. Повертає стан областей (`active`, `type`: `air_raid` | `artillery` | `partial`,
  `started_at`, тривалість), прапорці `mig_active`, `ballistic_threat`, активні `air_threats` (`expires_at > now()`) і стрічку зведень.
- `syncThreats()` (команда `alerts:sync` щохвилини в `routes/console.php`): розбір публічної сторінки `https://t.me/s/kpszsu`
  (або каналів з `alerts_monitor_channels`) — тип загрози за ключовими словами, населений пункт / область, курс
  («північний», «західний»… → `course_deg`), запис у `air_threats` з `expires_at` (БпЛА — 25 хв, ракети — 10 хв).
  Нова тривога в регіоні — пуш тим, у кого обрано цей `alert_region`.
- `isAvailableFor(Request $request)`: `VisitorCountry` == `'UA'`, або `user->country === 'UA'`, або явно обрано `alert_region`.

## 4. Маршрути, контролер, міст

- `App\Http\Controllers\AirAlertController`:
    - `GET /alerts` — Inertia `alerts/index` (мапа, цілі, вибір регіону, «🛡️ В укритті», пам’ятка для гостей: 112/101/102);
    - `GET /alerts/state` — JSON для опитування;
    - `PUT /alerts/preferences` — `alert_region`, пуші, швидкий статус «🛡️ В укритті (тривога)».
- Дзеркальні маршрути в `Route::prefix('site')` (`routes/api.php`) і перевірка в `AppSiteParityTest`.

## 5. Сайт

- `pages/alerts/index.tsx`: SVG/гео-мапа областей, підсвітка тривог, цілі (БпЛА, ракети, КАБ, балістика) з векторами курсу,
  живі таймери, стрічка зведень, блок «Інформація для гостей України».
- Інформер у `side-rail.tsx` / шапці: якщо в обраній області тривога — плашка з таймером і кнопкою «В укритті».
- Дизайн: темне скло без фіолетового й рожевого, без тіней і обводок, лише Lucide, `motion` + `useReducedMotion`.

## 6. Застосунок

- `mobile/lib/alerts.dart` — «Мапа тривог» в Arctic Glass: зведення (області в тривозі, свій регіон, «🛡️ Я в укритті»),
  мапа (`CustomPainter` + `InteractiveViewer`, вектори курсу), список областей з таймерами, стрічка цілей, вибір області й пушів.
- Пункт меню, коли плагін увімкнено і людина з України (або ввімкнула показ).
- Тест `mobile/test/alerts_preview_test.dart`; версія в `pubspec.yaml`, `whatsNewVersion`, `_whatsNewCurrent()`, CHANGELOG сайту.

## 7. Перевірки

Усі рядки через `tr()`, коментарі українською, без `dart format` на цілих файлах; повний набір перевірок з `AGENTS.md`.

## Зауваження до узгодження перед стартом

- Розбір `t.me/s/…` — не офіційний API: формат може змінитися, варто мати запасний стан «дані тимчасово недоступні».
- `ubilling.net.ua` — неофіційне джерело; лишаємо як запасне, основне — alerts.in.ua з токеном.
- Координати цілей — лише приблизні (центр міста/області з повідомлення), без точних позицій і без даних від користувачів;
  жодних місць влучань і роботи ППО. Підпис «за даними Повітряних сил ЗСУ».

## Статус (2026-11-06)

Зроблено: бекенд (UkraineAlarm → alerts.in.ua → ubilling, каталог із ~90 відкритих каналів з вагою довіри,
злиття однакових міток і впевненість 0–100), сайт (мапа з Кримом, рухомі цілі зі слідом, фільтри шарів, звук,
«В укритті», вкладка «Джерела», кнопка «Мапа тривог» у сайдбарі).

### Наступне — веб

1. Різні значки цілей за типом (дрон, крилата ракета, балістика, КАБ, літак, артилерія) — як в агрегаторах;
   напрям значка — за курсом.
2. Типи тривог: повітряна, артобстріл, вуличні бої, хімічна, радіаційна (UkraineAlarm `AIR`, `ARTILLERY`,
   `URBAN_FIGHTS`, `CHEMICAL`, `NUCLEAR`; alerts.in.ua `alert_type`), рівні загрози (жовтий/червоний) — колір і легенда.
3. Заливка районів (raion) і громад, а не всієї області: межі районів (GeoJSON адмінрівня 2, 136 районів, офіційні
   межі 2020 р.) — окремий спрощений файл; статус району — з UkraineAlarm (`regionType: District/Community`)
   чи alerts.in.ua (`location_type: raion/hromada`).

### Відкладено — застосунок (не збирати, поки робимо веб)

Код уже в репозиторії й проходить `flutter analyze`/`flutter test`, але версію не підвищено, тож збірка не запускалась:
`mobile/lib/alerts.dart` (екран, мапа з рухомими цілями, кнопка), `ukraine_outline.dart`, канал push `air_alerts`
(звук будильника, `channelSettings` у `MainActivity.kt`), свій звук із файлу, тест `alerts_preview_test.dart`.
Перед збіркою: перенести значки цілей, типи тривог і райони з веб-частини; потім `version` +1,
`whatsNewVersion` і `_whatsNewCurrent()`.
