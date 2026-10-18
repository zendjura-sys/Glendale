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

**Правила проекта важнее скиллов:** интерфейс строится из существующих компонентов и стилей проекта
(AGENTS.md, docs/ARCHITECTURE.md: иконки только Lucide, виджеты приложения из `mobile/lib/widgets.dart`),
даже если frontend-design советует иное.

Обновить: скачать репозитории заново и заменить папки (`git clone --depth 1 https://github.com/anthropics/skills`).
