# Скиллы Claude Code для проекта

Официальные скиллы Anthropic, скопированные в репозиторий, чтобы работать в любой сессии с проектом
(Claude Code в облаке и на компьютере). Лицензия — Apache-2.0, текст в `LICENSE.txt` каждого скилла.

| Скилл | Откуда | Зачем |
|---|---|---|
| frontend-design | anthropics/claude-plugins-official → plugins/frontend-design | продуманный дизайн интерфейсов |
| claude-automation-recommender | anthropics/claude-plugins-official → plugins/claude-code-setup | советует хуки, скиллы и MCP для проекта |
| skill-creator | anthropics/skills | создание своих скиллов |
| mcp-builder | anthropics/skills | создание MCP-серверов |
| webapp-testing | anthropics/skills | проверка сайта через Playwright |
| web-artifacts-builder | anthropics/skills | сложные HTML-артефакты (React, Tailwind, shadcn/ui) |
| algorithmic-art, theme-factory, internal-comms, slack-gif-creator | anthropics/skills | примеры (example-skills) |

Не скопированы: docx, pdf, pptx, xlsx (лицензия Anthropic «All rights reserved», распространять нельзя;
в облачных сессиях они и так доступны), canvas-design (5,6 МБ шрифтов), brand-guidelines (фирменный стиль
Anthropic), doc-coauthoring (без файла лицензии).

## Сторонні скіли (MIT / Apache-2.0)

| Скіл | Звідки | Навіщо |
|---|---|---|
| design-taste-frontend, open-design | Leonxlnx/taste-skill, nexu-io/open-design | смак у дизайні, каталог брендових DESIGN.md (ставив Cursor) |
| hallmark | Nutlope/hallmark | нові сторінки, що виглядають задизайненими, а не згенерованими |
| anatomy | wheresryan22/anatomy | ізометричні SVG-схеми «як це працює» (без прикладів, 25 МБ) |
| impeccable | pbakaus/impeccable | дизайн, аудит і полірування інтерфейсу |
| ponytail, ponytail-* | DietrichGebert/ponytail | найменша зміна, рев’ю й аудит репозиторію |
| matt-code-review, tdd, to-spec, to-tickets, implement… | mattpocock/skills (engineering, productivity, misc) | специфікація → задачі → тести → рев’ю; `code-review` перейменовано на `matt-code-review` (вбудований має ту саму назву) |
| security-audit | cloudflare/security-audit-skill | аудит безпеки з перевіркою знахідок |
| laravel-*, dart-flutter-patterns, flutter-dart-code-review, react-*, typescript-patterns, frontend-a11y, api-design, e2e-testing, tdd-workflow, mysql-patterns, redis-patterns, security-scan, agent-security-hardening | affaan-m/ECC (Everything Claude Code) | вибірка під стек проєкту з 1089 скілів; хуки ECC не ставились |
| seo, seo-* (24) + агенти в `.claude/agents` | AgriciDaniel/claude-seo | SEO-аудити; без розширень під платні API (Ahrefs, DataForSEO, Bing тощо). Python-залежності: `.claude/skills/seo/scripts/claude-seo setup` |

Не встановлено: Claude-Code-Game-Studios (Donchitos) — це шаблон нового репозиторію студії ігор
(78 скілів і 49 агентів під розробку гри), а не набір для GameCon.

**Правила проекта важнее скиллов:** интерфейс строится из существующих компонентов и стилей проекта
(AGENTS.md, docs/ARCHITECTURE.md: иконки только Lucide, виджеты приложения из `mobile/lib/widgets.dart`),
даже если frontend-design советует иное.

Обновить: скачать репозитории заново и заменить папки (`git clone --depth 1 https://github.com/anthropics/skills`).
