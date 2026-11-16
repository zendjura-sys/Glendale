#!/usr/bin/env bash
# Права для Laravel на проді (див. коміти 7684343a / 68c1b85a):
# — storage і bootstrap/cache: власник деплою + група www-data, setgid;
# — storage/framework/views і views-cli: лише www-data (Blade touch() → інакше 500).
#
#   sudo bash deploy/fix-perms.sh
#   sudo bash deploy/fix-perms.sh /var/www/gamecon
set -euo pipefail

APP="${1:-/var/www/gamecon}"
cd "$APP"

OWNER="$(stat -c %U "$APP")"
# На агентському деплої файли може писати cursor-agent — лишаємо йому запис через групу.
DEPLOY_CANDIDATES=("$OWNER")
if id cursor-agent >/dev/null 2>&1; then
    DEPLOY_CANDIDATES+=("cursor-agent")
fi
for u in "${DEPLOY_CANDIDATES[@]}"; do
    if id "$u" >/dev/null 2>&1 && ! id -nG "$u" | tr ' ' '\n' | grep -qx www-data; then
        usermod -aG www-data "$u" 2>/dev/null || true
    fi
done

mkdir -p \
    storage/app/public \
    storage/framework/{cache,sessions,views,views-cli} \
    storage/logs \
    bootstrap/cache

# Спільний запис деплою й PHP-FPM / черги.
chown -R "$OWNER":www-data storage bootstrap/cache
chmod -R ug+rwX storage bootstrap/cache
find storage bootstrap/cache -type d -exec chmod 2775 {} \;

# Журнали: setgid + rw для групи (monsory і www-data пишуть в один файл).
chmod g+s storage/logs
chown "$OWNER":www-data storage/logs/*.log 2>/dev/null || true
chmod 664 storage/logs/*.log 2>/dev/null || true

# Blade: змінити mtime може лише власник файлу. Артефакти від artisan (не www-data)
# дають 500 «touch(): Utime failed: Operation not permitted» на кожній сторінці.
find storage/framework/views storage/framework/views-cli -type f -delete 2>/dev/null || true
chown -R www-data:www-data storage/framework/views storage/framework/views-cli
chmod -R ug+rwX storage/framework/views storage/framework/views-cli
find storage/framework/views storage/framework/views-cli -type d -exec chmod 2775 {} \;

echo "✓ Права: storage/bootstrap → $OWNER:www-data, views → www-data:www-data ($APP)"
