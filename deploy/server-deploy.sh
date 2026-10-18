#!/usr/bin/env bash
# Деплой прямо на сервері (без локального комп'ютера): бекап бази → код із клону → deploy/remote.sh.
#
#   read -s -p "GitHub token: " GH_TOKEN; echo; export GH_TOKEN
#   rm -rf /root/gamecon-src && git clone --depth 1 -b <гілка> \
#       "https://x-access-token:$GH_TOKEN@github.com/zendjura-sys/Glendale.git" /root/gamecon-src
#   bash /root/gamecon-src/deploy/server-deploy.sh
#
# Клон береться з теки, де лежить цей скрипт; .env, storage, vendor і node_modules на сервері не чіпаємо.
set -euo pipefail

SRC="$(cd "$(dirname "$0")/.." && pwd)"
APP=/var/www/gamecon
OWNER=$(stat -c %U "$APP/vendor" 2>/dev/null || stat -c %U "$APP")

[ -d "$SRC/.git" ] || { echo "✗ $SRC — не git-клон" >&2; exit 1; }
[ -f "$APP/.env" ] || { echo "✗ Немає $APP/.env" >&2; exit 1; }
echo "→ Код: $(git -C "$SRC" log -1 --format='%h %s'), папка: $APP, власник: $OWNER"

# 1. Резервна копія бази.
env_get() { grep -E "^$1=" "$APP/.env" | head -1 | cut -d= -f2- | sed -e 's/^"//' -e 's/"$//'; }
DB=$(env_get DB_DATABASE); U=$(env_get DB_USERNAME); P=$(env_get DB_PASSWORD); H=$(env_get DB_HOST)
BACKUP=/root/gamecon-$(date +%F-%H%M).sql.gz
mysqldump -h"${H:-127.0.0.1}" -u"$U" -p"$P" --single-transaction "$DB" | gzip > "$BACKUP"
if [ "$(stat -c %s "$BACKUP")" -lt 1000 ]; then
    echo "✗ Бекап підозріло малий: $BACKUP — зупиняюсь" >&2
    exit 1
fi
echo "✓ Бекап: $BACKUP ($(du -h "$BACKUP" | cut -f1))"

# 2. Режим обслуговування ще на старому коді: новий код може потребувати пакетів, яких у vendor поки немає
#    (artisan після rsync, але до composer install, падає — і сайт не закривався б на час оновлення).
(cd "$APP" && php artisan down --retry=15 >/dev/null 2>&1) || true
# 3. Код поверх (.env, завантаження й залежності лишаються).
git -C "$SRC" log -1 --format='%h %s' > "$SRC/REVISION"
rsync -a --delete \
    --exclude='/.git' --exclude='/.env' --exclude='/storage/' --exclude='/vendor/' \
    --exclude='/node_modules/' --exclude='/public/build/' --exclude='/public/storage' \
    --exclude='/bootstrap/cache/*.php' \
    "$SRC/" "$APP/"
chown -R "$OWNER":www-data "$APP"

# 4. Залежності, збірка, міграції, перезапуск сервісів (remote.sh наприкінці знімає режим обслуговування).
cd "$APP"
if [ "$OWNER" != root ] && sudo -n -u "$OWNER" sudo -n true 2>/dev/null; then
    sudo -u "$OWNER" bash deploy/remote.sh
else
    bash deploy/remote.sh
    chown -R "$OWNER":www-data "$APP"
fi

echo "✅ Готово. Відкат бази за потреби: gunzip -c $BACKUP | mysql -u$U -p $DB"
