#!/usr/bin/env bash
#
# Пересобирает ZIP-пакеты аддонов из исходников в modules/src.
#
# Зачем это здесь: сами модули ставятся в CMS загрузкой ZIP через админку,
# поэтому раньше их исходники жили только во временной папке сборки. Когда
# хостер закрыл VDS, единственная копия установленных модулей исчезла вместе
# с сервером. Теперь исходники лежат в репозитории, а этот скрипт в любой
# момент собирает из них ZIP заново — терять больше нечего.
#
# Usage:
#   ./modules/build.sh            # собрать все
#   ./modules/build.sh telegram   # собрать один

set -euo pipefail

cd "$(dirname "$0")"
SRC_DIR="src"
DIST_DIR="dist"

# Имя пакета в ZIP-файле. Версия в имя подставляется из manifest.json:
# когда она была зашита здесь, поднятая версия модуля уезжала в архив со
# старым номером в названии, и в админке лежали два «1.0» с разным кодом.
declare -A ZIP_NAME=(
    [reports]='Reports'
    [progression]='Progression'
    [member-center]='MemberCenter'
    [family-goals]='FamilyGoals'
    [family-events]='FamilyEvents'
    [ai-assistant]='AiAssistant'
    [notifications]='Notifications'
    [bonuses]='Bonuses'
    [messenger]='Messenger'
)

command -v zip >/dev/null 2>&1 || { echo "Нужен zip: apt-get install -y zip" >&2; exit 1; }

mkdir -p "$DIST_DIR"
targets=("${@:-}")
[ -z "${targets[0]}" ] && targets=("${!ZIP_NAME[@]}")

for m in "${targets[@]}"; do
    name="${ZIP_NAME[$m]:-}"
    [ -n "$name" ] || { echo "Неизвестный модуль: $m" >&2; exit 1; }
    [ -f "$SRC_DIR/$m/manifest.json" ] || { echo "Нет manifest.json у $m" >&2; exit 1; }

    # Загрузчик админки ждёт имя вида (Modules)(версия)Имя.zip.
    version="$(sed -n 's/.*"version"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "$SRC_DIR/$m/manifest.json" | head -1)"
    [ -n "$version" ] || { echo "Не удалось прочитать version из manifest.json у $m" >&2; exit 1; }
    out="(Modules)(${version})${name}.zip"

    # Старые архивы того же модуля убираем: иначе в dist копятся пакеты
    # разных версий и неясно, какой из них актуальный.
    rm -f "$DIST_DIR/(Modules)("*")${name}.zip"
    # -j не используем: структура папок (src/, routes/, migrations/) — часть
    # контракта манифеста, установщик ищет файлы именно по этим путям.
    ( cd "$SRC_DIR/$m" && zip -rq "../../$DIST_DIR/$out" . -x '.*' )
    printf '%-16s -> %s (%s)\n' "$m" "$out" "$(du -h "$DIST_DIR/$out" | cut -f1)"
done
