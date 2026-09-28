# Kodik Catalog Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Реализовать в GameCon надёжную синхронизацию каталога и плееров Kodik: автоматическое создание и обновление тайтлов, корректную привязку источников, планировщик, массовые операции, журналирование и управление сезонами/сериями.

**Architecture:** Kodik используется как источник обнаружения и плееров, TMDB/Shikimori — для обогащения, а база GameCon остаётся источником истины. Инкрементальный курсор обрабатывается постранично и продвигается только после успешной фиксации страницы; сильные внешние идентификаторы разрешаются до сопоставления по названию. Все варианты Kodik хранятся отдельно, а совместимые поля `kodik_link` и `kodik_translations` формируются из выбранного активного варианта.

**Tech Stack:** PHP 8.2+, Laravel 13, Eloquent, Laravel HTTP Client/Queue/Scheduler, PHPUnit 12, Inertia 3, Vue 3 admin, React 19 public cinema, TypeScript 5.9, Vite 8.

**Spec:** `docs/superpowers/specs/2026-09-29-kodik-catalog-sync-design.md`

## Global Constraints

- Работать непосредственно в ветке `claude/vds-connection-3piazs`; отдельную ветку и PR не создавать.
- Не выполнять деплой: после реализации пользователь развёртывает изменения самостоятельно.
- Каждый production-шаг выполняется через red-green-refactor: сначала наблюдаемый падающий тест, затем минимальная реализация.
- Сохранять существующие ручные данные сезонов/серий и FlixCDN; синхронизация Kodik не должна их удалять.
- Не считать техническую ошибку Kodik результатом «ничего не найдено» и не обновлять `kodik_checked_at` при неуспешном запросе.
- Не логировать токены, полные query string с секретами и необработанные чувствительные ответы внешних API.
- Публичные подписи остаются украинскими; внутренние имена классов, полей и событий — английскими.
- Один коммит — одна завершённая проверяемая задача. Перед каждым коммитом просматривать `git diff --check` и целевые тесты.

## Review Focus

1. Не продвигается ли курсор после частично или полностью неуспешной страницы Kodik?
2. Исключены ли ложные слияния при конфликте сильных внешних идентификаторов?
3. Не устанавливается ли `kodik_checked_at` при 401/403, 429, transport/5xx и malformed response?
4. Обрабатывает ли полный rebind весь каталог пакетами, с явным подтверждением и без прежнего глобального лимита 500?
5. Сохраняются ли ручные сезоны/серии и их выбранное состояние при автоматической синхронизации и переключении сезона?

---

## Milestone 1 — Надёжный Kodik client и текущая привязка

### Task 1: Зафиксировать контракт Kodik API и классификацию ошибок

**Files:**
- Create: `app/Cinema/Kodik/KodikApiException.php`
- Create: `app/Cinema/Kodik/KodikPage.php`
- Create: `app/Cinema/Kodik/KodikClient.php`
- Create: `tests/Feature/Cinema/KodikClientTest.php`

**Interfaces:**

```php
final class KodikClient
{
    public function search(array $query): KodikPage;
    public function list(array $query): KodikPage;
}

final readonly class KodikPage
{
    public function __construct(
        public array $results,
        public ?string $nextPage,
        public int $total,
    ) {}
}

final class KodikApiException extends RuntimeException
{
    public function kind(): string; // auth|rate_limit|transport|server|contract
    public function retryable(): bool;
}
```

- [ ] Написать тесты Laravel HTTP fake для успешного `/search` и `/list`, пустого валидного ответа, 401/403, 429, 5xx, connection exception, невалидного JSON и отсутствующего массива `results`.
- [ ] Добавить отдельный тест, что токен передаётся в запрос, но отсутствует в тексте исключения и лог-контексте.
- [ ] Запустить `php artisan test tests/Feature/Cinema/KodikClientTest.php` и подтвердить падение из-за отсутствующих классов.
- [ ] Реализовать единый клиент с `timeout`, `connectTimeout`, ограниченным retry только для retryable-сбоев и строгой валидацией ответа.
- [ ] Повторно запустить тест; все сценарии должны пройти.
- [ ] Выполнить `git diff --check`.
- [ ] Commit: `git commit -m "Додати надійний клієнт Kodik API"`.

### Task 2: Исправить attach, чтобы сбои не маскировались как отсутствие плеера

**Files:**
- Modify: `app/Cinema/Kodik.php`
- Modify: `app/Cinema/AttachPlayerJob.php`
- Create: `tests/Feature/Cinema/KodikAttachTest.php`

**Behavior:**

```php
public function attach(Title $title, bool $force = false): KodikAttachResult;

// result status: attached|not_found|failed
// checked_at меняется только для attached/not_found после валидного ответа API
```

- [ ] Написать тесты: найденный iframe сохраняется; валидный пустой ответ ставит `not_found` и `kodik_checked_at`; техническая ошибка ставит `failed`, сохраняет причину и не меняет `kodik_checked_at`; повторная очередь retryable-ошибки не теряет исключение.
- [ ] Добавить regression-тест поиска по Shikimori, IMDb, MDL, WorldArt, украинскому, русскому и английскому названию.
- [ ] Запустить `php artisan test tests/Feature/Cinema/KodikAttachTest.php` и подтвердить падение на текущем swallowing `Throwable`.
- [ ] Перевести `Kodik` на `KodikClient`, вернуть типизированный результат и обновлять статус атомарно.
- [ ] Настроить `AttachPlayerJob`: retryable ошибки пробрасываются в очередь, auth/contract фиксируются без бесконечных повторовов.
- [ ] Запустить тоба Kodik-теста и `php artisan test --filter=CinemaTest`.
- [ ] Commit: `git commit -m "Виправити прив'язку плеєра Kodik"`.

## Milestone 2 — Модель источников, сопоставление и cron

### Task 3: Добавить схему синхронизации и модели аудита

**Files:**
- Create: `database/migrations/2026_09_29_000000_create_cinema_kodik_sync_tables.php`
- Create: `app/Cinema/KodikSource.php`
- Create: `app/Cinema/CinemaSyncRun.php`
- Create: `app/Cinema/CinemaSyncEvent.php`
- Modify: `app/Cinema/Title.php`
- Create: `tests/Feature/Cinema/KodikSchemaTest.php`

**Schema:**

- `cinema_kodik_sources`: title FK, Kodik external ID, link, translation id/title/type, quality, season/episode availability JSON, material JSON subset, active flag, timestamps; unique on Kodik item identity plus translation.
- `cinema_sync_runs`: mode, status, cursor before/after, counters, started/finished timestamps, redacted error summary.
- `cinema_sync_events`: run FK, title FK nullable, action, status, identifiers JSON, context JSON, message, created timestamp.
- `cinema_titles`: nullable/indexed `kodik_id`, `kinopoisk_id`, `kodik_synced_at`, `kodik_sync_status`, `kodik_last_error`.

- [ ] Написать schema/relationship-тесты, включая внешние ключи, индексы, JSON casts и cascade удаления источников/событий.
- [ ] Запустить `php artisan test tests/Feature/Cinema/KodikSchemaTest.php` и подтвердить падение до миграции.
- [ ] Создать миграцию и модели, добавить casts/relations/fillable в `Title`.
- [ ] Проверить `php artisan migrate:fresh --env=testing` и тест схемы.
- [ ] Commit: `git commit -m "Додати схему синхронізації каталогу Kodik"`.

### Task 4: Реализовать строгий resolver идентичности тайтла

**Files:**
- Create: `app/Cinema/Kodik/KodikIdentityResolver.php`
- Create: `app/Cinema/Kodik/KodikIdentityResolution.php`
- Create: `tests/Feature/Cinema/KodikIdentityResolverTest.php`

**Match order:** `kodik_id` → `kinopoisk_id` → `shikimori_id` → `imdb_id` → `mdl_id` → WorldArt animation ID → нормализованные названия + год.

- [ ] Написать тесты для каждого уровня приоритета, кириллицы/латиницы и альтернативных названий.
- [ ] Написать тесты объятельные конфликтные тесты: два сильных ID указывают на разные тайтлы; имя совпадает, но сильный ID конфликтует; несколько кандидатов по имени; год расходится более допустимого диапазона. Ожидание — `conflict`/`ambiguous`, без merge.
- [ ] Запустить `php artisan test tests/Feature/Cinema/KodikIdentityResolverTest.php` и подтвердить падение.
- [ ] Реализовать нормализацию строк и типизированный результат `matched|new|ambiguous|conflict` с reason/candidate IDs.
- [ ] Повторно запустить тесты resolver и текущие тесты альтернативных названий.
- [ ] Commit: `git commit -m "Додати безпечне зіставлення тайтлів Kodik"`.

### Task 5: Синхронизировать один Kodik item транзакционно

**Files:**
- Create: `app/Cinema/Kodik/KodikItemSynchronizer.php`
- Create: `app/Cinema/SyncKodikItemJob.php`
- Modify: `app/Cinema/Importer.php`
- Modify: `app/Cinema/PlayerSources.php`
- Create: `tests/Feature/Cinema/KodikItemSynchronizerTest.php`

**Flow:** resolve → enrich → filter → create/update title → upsert all source variants → select active variant → rebuild compatibility fields → emit event.

- [ ] Написать тест создания нового опубликованного тайтла при валидном iframe и прохождении фильтров.
- [ ] Написать тесты обновления существующего тайтла без потери ручных полей, FlixCDN, сезонов и серий.
- [ ] Написать тесты upsert нескольких переводов/качеств, детерминированного выбора active source и формирования `kodik_link`/`kodik_translations`.
- [ ] Написать тесты `ambiguous`, `conflict`, rejected by filters и missing iframe: тайтл не публикуется, событие содержит безопасную причину.
- [ ] Запустить тест и подтвердить падение.
- [ ] Реализовать транзакционный synchronizer и queue job с идемпотентным unique key.
- [ ] Запустить тесты item synchronizer, player sources и importer.
- [ ] Commit: `git commit -m "Додати синхронізацію матеріалів Kodik"`.

### Task 6: Реализовать постраничную синхронизацию и безопасный cursor

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

- [ ] Написать тест двух успешных страниц: каждый item поставлен в очередь, cursor сохраняется после каждой committed page.
- [ ] Написать Review Focus тест: ошибка второго item/страницы не продвигает cursor этой страницы и повторный запуск возобновляет её без пропуска.
- [ ] Написать тест идемпотентного повторного cursor/page и блокировки параллельных запусков одного mode.
- [ ] Написать command-тесты валидации mode/batch, dry-run без записи и отказа `full` без `--confirm-full`.
- [ ] Запустить оба тест-файла и подтвердить падение.
- [ ] Реализовать orchestrator и команду; сохранять����ͽȃBȃB�B�F;FBԁ������M��ѥ�����-=%-}UIM=I��FB�B�F3B�B��B�B�FB�Bԁ�����ЃFFFB�B�B�FF,��B��FB�B�B�Bԁ������M幍Iչ��������M幍ٕ�р�B��B�B�FB�B�B�FB�B�B�B�B�F/Bԁ���չѕ�̀�(��l�t�B_B�B�FFFB�FF0�FB�B�B�B�F/BԃFB�FFF,�(��l�t������聁��Ё�����Ѐ����BSB�B�B�FB��B�B�B�B�B�B�F�FB�B�FFB�B�F[B�B�Ff[F\�-�������((����Q�ͬ���BB�B�B�B�F;FB�FF0�͍���ձ�ȃB��FFF'B�FFB�FF;F'B�B�B�B�FB�B�B�B�B�FF�B�B�B܃B�FB�B�B�B�((�������((��5�����聁ɽ�ѕ̽���ͽ�������(��5�����聁������ͽ���������̽�ѽ%���������������(��5�����聁����������%�����Q�ѱ�)�������(��5�����聁ѕ��̽����ɔ������Q��й����(��ɕ�є聁ѕ��̽����ɔ�������-����M����ձ�Q��й����((��l�t�BwB�B�B�FB�FF0�͍���ձ��FB�FFF,聥��ɕ���х��B�B�B�B�F/BԀ���B�B�B�FF��ɕ��������B�B�B�FB�FB�B����ݥѡ���=ٕɱ��������FFF'B�FFB�FF;F'B�B䃁��������Ѽ������р�B�FFB�FGFFF<�B�B�B�FB�FB�F/B�(��l�t�BwB�B�B�FB�FF0�ɕ�ɕ�ͥ���FB�FF�B�B�FB�B�B�B�B�FF�Q5�B�BԃB�B�B�FFB�B�B�F�B�FB�FFF8�B�B�FB�B�B�B�FFB�B�FF8�-�����B�FB�B�F?B�B�F�B��B�FB�B�B�F3B�FB�F�B�B�B�F/B��幍�ɽ���ȸ(��l�t�BwB�B�B�FB�FF0�FB�FF�ɕ��䁵��ͥ���ͽ�ɍ�̃B�B�B܀�зFB�FB�B�B�B�B�B�B�B�B�FB�B�B�B��B�B�FB�BԃFB�FB�B�FB�FB�B�B�B�F#B�B�B�B�(��l�t�B_B�B�FFFB�FF0�FB�B�B�B�F/BԃFB�FFF,�B��B�B�B�FB�B�FB�B�FF0�B�B�B�B�B�B�BԸ(��l�t�BB�B�B�B�F;FB�FF0�͍���ձ��B��B�B�B�B�B�B�FB�B�B�B�B�BԃB�B�B�B�B�F�FB�FB�B�FF2��]��"=�]--=��]R��-]M]��RD�D"&Vg&W6�����	}�=-�-��'F�6�FW7BFW7G2�fVGW&R�6��V����F��66�VGV�UFW7B��FW7G2�fVGW&R�6��V�FW7B������6��֗C�v�B6��֗B��-	�mM���}�-�--��-�}�2��]��m}mm���F��&ࠢ22֖�W7F��R2(	B	�-�������=����-�R��]m����222F6���	M�-�-�-���}��-���R�-����M���-�"��F������f��W3�������F�g���6��V��6��V�6WGF��w2�� ��7&VFS��6��V����F�����F�����'E�Ɩ7��� ��7&VFS�FW7G2�fVGW&R�6��V����F�����'E�Ɩ7�FW7B�� ����6WGF��w2w&�W3���6��FV�BG�W2��V'2����vVB�&��6�VB6�V�G&�W2�vV�&W2�G&�6�F���2�G&�6�F���G�R�&F��w2�vR�����R�G&�7FGW6W2�4�&��&Vv����f��&�ƗG���7FW"�FW67&�F���&WV�&V�V�G2�&�6�Ɨ7B�WFFR'V�W2�WF��V&Ɨ6�ࠢ���	���-�F&�R�G&�fV�-]-��mM�=�M���-������m�����r�FV�����	}M����--�]}����RFVfV�G2���-��R�R��-�"=�]--=���R��=����-���R-�-���}]��"��M--]mM���RWF��V&Ɨ6�-�������-��M����g&�R����	}�=-�-�-]"���M--]M�-��M]��R����
]��}�--��Ɩ7������}m�]����M�==m�����������66WFVB�&V�V7FVB�&V6��]}=��--������	}�=-�-�-]-��Ɩ7���FV�7��6�&�旦W"����6��֗C�v�B6��֗B��-	M�M-�Mm��-�m���-2��F��&ࠢ222F6���	M�-�-�F֖��M��}�=��"���=�"��-�]���727F���0����f��W3�����7&VFS��GG�6��G&���W'2�F֖��6��V���F��6��G&���W"�� ��7&VFS��GG�&WVW7G2�F֖��WFFT6��V���F��6WGF��w5&WVW7B�� ����F�g��&�WFW2�vV"�� ����F�g���GG�6��G&���W'2�F֖��6��V�F֖�6��G&���W"�� ��7&VFS�FW7G2�fVGW&R�6��V��6��V���F��F֖�FW7B�� ����V�G���G3�����FW�@�tUB�F֖��6��V����F���'V�0�tUB�F֖��6��V����F���'V�2��'V���WfV�G0��5B�F֖��6��V����F���7��0��5B�F֖��6��V����F���&V&��@�tUB�F֖��6��V����F���6WGF��w0�UB�F֖��6��V����F���6WGF��w0� �����	���-�WF��fƖFF����v��F���-]-�-]BV�G���G2����	���-�&Wf�Wrf�7W2-]"�����=�&V&��C�]r6��f�&�F���(	BC##�6��f�&�F���(	B-]�-��2}�-]-��6�V�2��R�=��}�-]-�S-��������	���-�-]"֗76��v����-��]"-�����-�-��]r-��M��=�7F�fR6�W&6R��R�]]}���-]"=�]--=������F������	���-�-]"&VF7F���-��]��U$�VW'�"WfV�G2�&WFV�F���6�V�W�WfV�G23M�]��'V�2�M�]�����	}�=-�-�-]"���M--]M�-��M]��R����
]��}�--�6��G&���W"�&WVW7B�&�WFW2�VWVRF�7F6���}�-�2�}�]��-�-=��=��}]��=�'VƲGF6���]m��M]�]=��-��]���-������MR����	}�=-�-�YZ[�t`�-t`t`�b�4.4`t`�bt-t`t`�,�`�c�bt.4-H�[�[XS�\�][ۜ�\���[�[XU\���H�H��[Z]��]��[Z][H�%4/�-4,4`�.4.�-t`4`�,�,4/t/tc�4`t.4/tat`4/�/te�-�,4a�e�e4c���ZȘ������\��L�4(4-t,4.�.4-�/�,�,4`�c4,�.�.�,4-4.�.��Z��[�����4.�][���4,�4,4-4/4.4/t.�-B�����[\Ί���H[�Y�N��\��\��\�ڜ��Y�\��YZ[���[�[XK�[�^��YX�HܙX]N��\��\��\�ڜ��Y�\��YZ[���[�[XK���Z��[�˝�YX�HܙX]N��\��\��\�ڜ��Y�\��YZ[���[�[XK���Z��˝�YX�HܙX]N��\��\��\�ڜ��Y�\��YZ[���[�[XK���Z��][��˝�YX��H�H4(t/t,4a�,4.�,4`4,4`tb4.4`4.4`�c�X��[��X]\�Kt`�-t`t`�����TH�۝�X��4,�.�.�,4-4.�.4/�/�.�`�a�,4c�`��[����[�\��Y�[�]Y]�[��4.�YX�Y�۝^�4/�`4/�,�-t`4.4`�c падение.
- [ ] Добавить токументированный props/API contract и UI: режим запуска, dry-run, confirmation для full rebind, прогресс/counters, фильтры логов, просмотр события, группы настроек с украинскими подписями.
- [ ] В UI запретить повторный запуск активного mode, показать retryable/terminal статус и не отображать секреты.
- [ ] Запустить `npm run typecheck` и исправить все ошибки.
- [ ] Запустить `npm run build` и убедиться, что чанки админки собираются.
- [ ] Запустить backend admin-тесты.
- [ ] Commit: `git commit -m "Додати інтерфейс синхронізації Kodik"`.

## Milestone 4 — Сезоны, серии и публичный player

### Task 11: Завершить ручное управление сезонами и сериями в admin UI

**Files:*

- Modify: `resources/js/Pages/Admin/Cinema/Index.vue`
- Create: `resources/js/Pages/Admin/Cinema/SeasonsModal.vue`
- Modify: `app/Http/Controllers/Admin/CinemaAdminController.php`
- Modify: `tests/Feature/CinemaTest.php`

- [ ] Расширить backend feature-тесты: create/update/delete/reorder season и episode, validation, принадлежность эпизода сезону, защита от удаления чужих записей.
- [ ] Добавить Review Focus тест, что повторная Kodik-синхронизация не удаляет вручную созданные сезоны/серии их metadata.
- [ ] Запустить тесты и зафиксировать ожидаемое падение недостающего контракта.
- [ ] Реализовать модалку: список сезонов, форма сезона, список серий выбранного сезона, форма серии, удаление с подтверждением, состояния loading/error/success.
- [ ] Не создавать второй источник истины для Kodik episode data: ручные сущности остаются независимыми и имеют приоритет для каталожной разметки.
- [ ] Запустить `php artisan test --filter=CinemaTest`, `npm run typecheck`, `npm run build`.
- [ ] Commit: `git commit -m "Додати керування сезонами та серіями"`.

### Task 12: Исправить сквозное переключение сезона/серии и источника Kodik

**Files:**
- Modify: `resources/app/pages/Cinema.tsx`
- Modify: `app/Http/Controllers/Api/V2/CinemaController.php`
- Modify: `app/Cinema/PlayerSources.php`
- Modify: `tests/Feature/CinemaTest.php`

**Selection rules:**

- При смене сезона выбирается серия 1 этого сезона либо первая доступная серия.
- Активная карточка серии и параметры iframe всегда соответствуют текущим season/episode.
- Смена перевода сохраняет season/episode, если вариант их поддерживает; иначе применяется ближайшая валидная комбинация.
- Недоступный Kodik остаётся видимой disabled-вкладкой; FlixCDN открывается автоматически только когда он доступен.

- [ ] Написать/обновить feature-тест player endpoint для source/translation/season/episode и fallback rules.
- [ ] Добавить regression-контракт для Bleach: смена сезона сбрасывает выбранную серию на первую и возвращает новый iframe URL.
- [ ] Запустить backend тест и подтвердить падение текущего контракта, если оно есть.
- [ ] Обновить player DTO/controller и React state/effects без сброса пользовательского выбора несвязанным rerender.
- [ ] Запустить `php artisan test --filter=CinemaTest`, `npm run typecheck`, `npm run build`.
- [ ] Провести ручной smoke-check на узком viewport: Kodik-only, FlixCDN-only, оба источника, 1 сезон, несколько сезонов, недоступный перевод.
- [ ] Commit: `git commit -m "Синхронізувати вибір сезону і серії"`.

## Final Verification

- [ ] Выполнить `php artisan migrate:fresh --env=testing`.
- [ ] Выполнить `php artisan test`; сохранить точное количество пройденных тестов и отсутствие failures/errors.
- [ ] Выполнить `npm run typecheck`.
- [ ] Выполнить `npm run build`.
- [ ] Выполнить `php artisan cinema:kodik-sync --mode=incremental --dry-run --batch=5` с тестовым/разрешённым токеном и убедиться, что база не изменилась.
- [ ] Выполнить staging smoke-run incremental и проверить cursor/run/events без раскрытия токена.
- [ ] Проверить Review Focus пятью отдельными целевыми тестами.
- [ ] Выполнить `git diff --check` и убедиться, что рабочее дерево содержит только ожидаемые изменения.
- [ ] Обновить эксплуатационную документацию с командами cron/queue, обязательными env vars, безопасным rollback миграций и инструкцией ручного запуска.
- [ ] Финальный commit документации: `git commit -m "Документувати синхронізацію Kodik"`.
- [ ] Не выполнять production deploy; передать пользователю commit SHA, список миграций, cron/worker prerequisites и команды деплоя.
