# GameCon

Социальная сеть для геймеров — **gamecon.online**: лента, профили, друзья, сообщения, сообщества,
музыка, кино, GTA RP‑серверы, семьи и кланы, голосовые комнаты, звонки, совместный просмотр.

- **Сайт:** Laravel 13 + Inertia + React 19 (TypeScript), MariaDB, Redis, Reverb.
- **Приложение:** Flutter (Android), папка [`mobile/`](mobile/), работает с тем же бэкендом.

| Документ | О чём |
|---|---|
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | как всё устроено, структура и карта связей |
| [docs/SECRETS.md](docs/SECRETS.md) | где лежат ключи и как их использовать (без значений) |
| [AGENTS.md](AGENTS.md) | правила для ИИ‑агентов (Codex, Cursor, Claude) и для людей |
| [docs/web-vs-app-checklist.md](docs/web-vs-app-checklist.md) | сверка функций сайта и приложения |
| [docs/backlog.md](docs/backlog.md) | список идей и задач |

## Быстрый старт (локально)

```bash
cp .env.example .env && php artisan key:generate   # только локально, не на сервере!
composer install && npm install
php artisan migrate --seed
composer run dev            # сайт, очередь, Vite

cd mobile && flutter pub get && flutter run
```

Ключи интеграций локально не обязательны: без них соответствующие разделы просто выключены.
