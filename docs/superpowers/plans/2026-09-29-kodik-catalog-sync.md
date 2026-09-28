# Kodik Catalog Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Реализовать в GameCon надёжную синхронизацию каталога и плееров Kodik: автоматическое создание и обновление тайтлов, корректную привязку источников, cron, массовые операции, журнал и управление сезонами/сериями.

**Architecture:** Kodik — источник обнаружения и плееров, TMDB/Shikimori — обогащение, база GameCon — источник истины. Курсор продвигается только после успешной фиксации страницы. Сильные внешние ID разрешаются до сопоставления по названию. Все варианты Kodik хранятся отдельно; совместимые поля `kodik_link` и `kodik_translations` строятся из активного варианта.

**Tech Stack:** PHP 8.2+, Laravel 13, Eloquent, Queue/Scheduler, PHPUnit 12, Inertia 3, Vue 3, React 19, TypeScript 5.9, Vite 8.

**Spec:** `docs/superpowers/specs/2026-09-29-kodik-catalog-sync-design.md`

## Global Constraints

- Работать прямо в `claude/vds-connection-3piazs`; не создавать ветку или PR.
- Не выполнять deploy.
- Каждый production-шаг: падающий тест → минимальная реализация → зелёный тест → commit.
- Не удалять ручные сезоны/серии и FlixCDN.
- Не обновлять `kodik_checked_at` при технической ошибке Kodik.
- Не логировать токены и URL с секретными query-параметрами.
- UI остаётся украинским.
- Перед коммитом: целевые тесты и `git diff --check`.

## Review Focus

1. Курсор не продвигается после ошибки страницы.
2. Конфликт сильных ID никогда не приводит к merge.
3. `kodik_checked_at` не меняется при 401/403, 429, transport/5xx и malformed response.
4. Full rebind обрабатывает весь каталог пакетами, требует подтверждение и не ограничен 500 строками.
5. Ручные сезоны/серии сохраняются, а выбранная серия корректно меняется вместе с сезоном.

---

## Milestone 1 — Надёжный Kodik API и attach

### Task 1: Строгий Kodik client

**Files:**
- Create: `app/Cinema/Kodik/KodikApiException.php`
- Create: `app/Cinema/Kodik/KodikPage.php`
- Create: `app/Cinema/Kodik/KodikClient.php`
- Create: `tests/Feature/Cinema/KodikClientTest.php`

**Interfaces:**
```php
final class KodikClient {
    public function search(array $query): KodikPage;
    public function list(array $query): KodikPage;
}
final readonly class KodikPage {
    public function __construct(
        public array $results,
        public ?string $nextPage,
        public int $total,
    ) {}
}
final class KodikApiException extends RuntimeException {
    public function kind(): string; // auth|rate_limit|transport|server|contract
    public function retryable(): bool;
}
```

- [ ] Написать HTTP fake тесты: успешные `/search` и `/list`, валидный empty, 401/403, 429, 5xx, connection exception, invalid JSON, отсутствующий `results`.
- [ ] Проверить, что token отсутствует в exception/log context.
- [ ] Запустить тест и подтвердить падение из-за отсутствующих классов.
- [ ] Реализовать timeout/connectTimeout, retry только retryable-сбоев и строгий response contract.
- [ ] Запустить `php artisan test tests/Feature/Cinema/KodikClientTest.php`.
- [ ] Commit: `Додати надійний клієнт Kodik API`.

### Task 2: Исправить attach и retry

**Files:**
- Modify: `app/Cinema/Kodik.php`
- Modify: `app/Cinema/AttachPlayerJob.php`
- Create: `app/Cinema/Kodik/KodikAttachResult.php`
- Create: `tests/Feature/Cinema/KodikAttachTest.php`

- [ ] Тест: iframe найден → `attached`; валидный empty → `not_found` и checked_at; технический сбой → `failed`, error сохранён, checked_at не изменён.
- [ ] Regression: поиск по Shikimori, IMDb, MDL, WorldArt и UA/RU/EN названиям.
- [ ] Подтвердить падение на текущем swallowing `Throwable`.
- [ ] Перевести `Kodik` на client и типизированный result.
- [ ] Retryable exception пробрасывать в очередь; auth/contract фиксировать без бесконечного retry.
- [ ] Запустить Kodik tests и `php artisan test --filter=CinemaTest`.
- [ ] Commit: `Виправити прив'язку плеєра Kodik`.

## Milestone 2 — Источники, identity и cron

### Task 3: Схема синхронизации

**Files:**
- Create: `database/migrations/2026_09_29_000000_create_cinema_kodik_sync_tables.php`
- Create: `app/Cinema/KodikSource.php`
- Create: `app/Cinema/CinemaSyncRun.php`
- Create: `app/Cinema/CinemaSyncEvent.php`
- Modify: `app/Cinema/Title.php`
- Create: `tests/Feature/Cinema/KodikSchemaTest.php`

**Schema:**
- `cinema_kodik_sources`: title FK, external ID, link, translation ID/title/type, quality, season/episode JSON, material subset JSON, active, timestamps.
- `cinema_sync_runs`: mode/status, cursor before/after, counters, started/finished, redacted error.
- `cinema_sync_events`: run/title FK, action/status, identifiers/context JSON, message, created_at.
- `cinema_titles`: indexed nullable `kodik_id`, `kinopoisk_id`, `kodik_synced_at`, `kodik_sync_status`, `kodik_last_error`.

- [ ] Сначала написать schema/relations/casts/cascade тесты.
- [ ] Создать миграцию и модели.
- [ ] Запустить `php artisan migrate:fresh --env=testing` и schema test.
- [ ] Commit: `Додати схему синхронізації каталогу Kodik`.

### Task 4: Безопасный identity resolver

**Files:**
- Create: `app/Cinema/Kodik/KodikIdentityResolver.php`
- Create: `app/Cinema/Kodik/KodikIdentityResolution.php`
- Create: `tests/Feature/Cinema/KodikIdentityResolverTest.php`

**Order:** kodik_id → kinopoisk_id → shikimori_id → imdb_id → mdl_id → WorldArt animation ID → normalized names + year.

- [ ] Тесты каждого уровня, кириллицы/латиницы и альтернативных названий.
- [ ] Обязательные тесты конфликтов: сильные ID ведут к разным titles; имя совпало при конфликте ID; несколько name candidates; incompatible year.
- [ ] Ожидать `matched|new|ambiguous|conflict`; conflict/ambiguous не merge.
- [ ] Реализовать resolver и запустить тест.
- [ ] Commit: `Додати безпечне зіставлення тайтлів Kodik`.

### Task 5: Транзакционная синхронизация item

**Files:**
- Create: `app/Cinema/Kodik/KodikItemSynchronizer.php`
- Create: `app/Cinema/SyncKodikItemJob.php`
- Modify: `app/Cinema/Importer.php`
- Modify: `app/Cinema/PlayerSources.php`
- Create: `tests/Feature/Cinema/KodikItemSynchronizerTest.php`

- [ ] Тест создания опубликованного title при valid iframe и passed policy.
- [ ] Тест update без потери manual fields, FlixCDN, seasons/episodes.
- [ ] Тест upsert переводов/качеств, deterministic active source, rebuilding compatibility fields.
- [ ] Тесты ambiguous/conflict/rejected/missing iframe: не публиковать, записать безопасное событие.
- [ ] Реализовать flow: resolve → enrich → policy → title → sources → active → compatibility → event.
- [ ] Сделать job идемпотентным по Kodik item identity.
- [ ] Запустить tests и commit: `Додати синхронізацію матеріалів Kodik`.

### Task 6: Catalog synchronizer и CLI

**Files:**
- Create: `app/Cinema/Kodik/KodikCatalogSynchronizer.php`
- Create: `app/Console/Commands/SyncKodikCinema.php`
- Create: `tests/Feature/Cinema/KodikCatalogSynchronizerTest.php`
- Create: `tests/Feature/Cinema/SyncKodikCinemaCommandTest.php`

**Command:**
```text
php artisan cinema:kodik-sync
  --mode=incremental|reconcile|missing|full
  --batch=100
  --cursor=
  --dry-run
  --confirm-full
```

- [ ] Тест двух pages: items queued, cursor сохраняется после committed page.
- [ ] Review Focus: ошибка item/page не продвигает cursor; restart повторяет страницу без пропуска.
- [ ] Тест idempotent repeat и lock параллельных запусков одного mode.
- [ ] Command tests: mode/batch validation, dry-run without writes, full без confirmation отклонён.
- [ ] Реализовать orchestrator; `CinemaSettings::KODIK_CURSOR` менять только после commit страницы.
- [ ] Сохранять run/events/counters.
- [ ] Запустить tests и commit: `Додати команду синхронізації Kodik`.

### Task 7: Scheduler и AutoImport

**Files:**
- Modify: `routes/console.php`
- Modify: `app/Console/Commands/AutoImportCinema.php`
- Modify: `app/Cinema/ImportTitleJob.php`
- Modify: `tests/Feature/CinemaTest.php`
- Create: `tests/Feature/Cinema/KodikScheduleTest.php`

- [ ] Тест расписания: incremental /10 min, reconcile hourly, withoutOverlapping; auto-import hourly сохранён.
- [ ] Regression: TMDB auto-import не запускает вторую несовместимую Kodik attach цепочку.
- [ ] Тест retry missing source сразу после technical failure, без 24h блокировки.
- [ ] Реализовать schedule/delegation.
- [ ] Запустить tests и commit: `Підключити автоматичну синхронізацію Kodik`.

## Milestone 3 — Policy, logs и mass actions

### Task 8: Import policy

**Files:**
- Modify: `app/Cinema/CinemaSettings.php`
- Create: `app/Cinema/Kodik/KodikImportPolicy.php`
- Create: `tests/Feature/Cinema/KodikImportPolicyTest.php`

- [ ] Table-driven tests: content types, years, country allow/deny, genres, translations/type, ratings, age/MPAA, anime/drama status, CAMRip, regions, poster/description, blacklist, update rules, auto-publish.
- [ ] Безопасные defaults не скрывают существующие titles; auto-publish только при valid iframe.
- [ ] Реализовать `accepted/rejected(reason)`.
- [ ] Запустить policy/item tests и commit: `Додати фільтри імпорту Kodik`.

### Task 9: Admin API и mass operations

**Files:**
- Create: `app/Http/Controllers/Admin/CinemaKodikController.php`
- Create: `app/Http/Requests/Admin/UpdateCinemaKodikSettingsRequest.php`
- Modify: `routes/web.php`
- Modify: `app/Http/Controllers/Admin/CinemaAdminController.php`
- Create: `tests/Feature/Cinema/CinemaKodikAdminTest.php`

**Endpoints:** runs, run events, sync, rebind, settings GET/PUT under `/admin/cinema/kodik`.

- [ ] Auth/validation/pagination tests.
- [ ] Full rebind: no confirmation → 422; confirmed → chunk whole catalog, no global 500 limit.
- [ ] Missing mode обновляет только titles без valid active source и не перезаписывает существующий Kodik.
- [ ] Redaction token/query; retention events 30 days, runs 90 days.
- [ ] Реализовать controller/request/routes и заменить старый bulk attach делегированием.
- [ ] Запустить admin/Cinema tests и commit: `Додати керування синхронізацією Kodik`.

### Task 10: Admin UI Kodik Sync, Logs, Settings

**Files:**
- Modify: `resources/js/Pages/Admin/Cinema/Index.vue`
- Create: `resources/js/Pages/Admin/Cinema/KodikSync.vue`
- Create: `resources/js/Pages/Admin/Cinema/KodikLog.vue`
- Create: `resources/js/Pages/Admin/Cinema/KodikSettings.vue`

- [ ] Сначала backend contract test для runs/counters/paginated events/redacted context.
- [ ] UI: mode, dry-run, confirmation full, progress, counters, log filters/details, grouped settings, украинские labels.
- [ ] Запретить повтор active mode; показывать retryable/terminal status; не показывать secrets.
- [ ] Запустить `npm run typecheck`, `npm run build`, backend admin tests.
- [ ] Commit: `Додати інтерфейс синхронізації Kodik`.

## Milestone 4 — Seasons, episodes и public player

### Task 11: Admin seasons/episodes UI

**Files:**
- Modify: `resources/js/Pages/Admin/Cinema/Index.vue`
- Create: `resources/js/Pages/Admin/Cinema/SeasonsModal.vue`
- Modify: `app/Http/Controllers/Admin/CinemaAdminController.php`
- Modify: `tests/Feature/CinemaTest.php`

- [ ] Backend tests: create/update/delete/reorder season/episode, validation, ownership.
- [ ] Review Focus: повторная Kodik sync не удаляет manual seasons/episodes/metadata.
- [ ] Реализовать modal: lists, forms, delete confirmation, loading/error/success.
- [ ] Ручные entities независимы от Kodik episode data и приоритетны для catalog markup.
- [ ] Запустить Cinema tests, typecheck, build.
- [ ] Commit: `Додати керування сезонами та серіями`.

### Task 12: Сквозное переключение player

**Files:**
- Modify: `resources/app/pages/Cinema.tsx`
- Modify: `app/Http/Controllers/Api/V2/CinemaController.php`
- Modify: `app/Cinema/PlayerSources.php`
- Modify: `tests/Feature/CinemaTest.php`

**Rules:**
- Смена сезона выбирает episode 1 либо первый доступный.
- Active episode и iframe всегда соответствуют season/episode.
- Смена translation сохраняет selection, если поддерживается; иначе выбирает ближайшую valid combination.
- Kodik tab видима disabled при отсутствии; FlixCDN auto-open только если доступен.

- [ ] Player endpoint tests: source/translation/season/episode/fallback.
- [ ] Bleach regression: season switch сбрасывает episode и возвращает новый iframe URL.
- [ ] Обновить DTO/controller и React state/effects.
- [ ] Запустить Cinema tests, typecheck, build.
- [ ] Manual narrow viewport smoke: Kodik-only, FlixCDN-only, both, one/many seasons, unavailable translation.
- [ ] Commit: `Синхронізувати вибір сезону і серії`.

## Final Verification

- [ ] `php artisan migrate:fresh --env=testing`
- [ ] `php artisan test` — зафиксировать точное число passed и отсутствие failures/errors.
- [ ] `npm run typecheck`
- [ ] `npm run build`
- [ ] `php artisan cinema:kodik-sync --mode=incremental --dry-run --batch=5` — DB unchanged.
- [ ] Staging incremental smoke: проверить cursor/run/events и redaction.
- [ ] Запустить пять Review Focus regression tests отдельно.
- [ ] `git diff --check`; рабочее дерево содержит только ожидаемые изменения.
- [ ] Документировать cron/queue, env vars, migration rollback и ручной запуск.
- [ ] Не deploy; передать пользователю commit SHA, migrations, cron/worker prerequisites и deploy commands.
