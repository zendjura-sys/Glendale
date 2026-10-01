#!/usr/bin/env bash
# Виконується на сервері в /var/www/gamecon після синхронізації коду.
set -euo pipefail
cd /var/www/gamecon

if [ ! -f .env ]; then
    echo "Немає .env — створіть його з deploy/.env.production.example" >&2
    exit 1
fi

php artisan down --retry=15 2>/dev/null || true
trap 'php artisan up 2>/dev/null || true' EXIT

composer install --no-dev --no-interaction --prefer-dist --optimize-autoloader --no-progress
npm ci --no-audit --no-fund --loglevel=error
npm run build

php artisan migrate --force
php artisan db:seed --force
php artisan storage:link 2>/dev/null || true
php artisan optimize

sudo chown -R cursor-agent:www-data storage bootstrap/cache
sudo chmod -R ug+rwX storage bootstrap/cache

sudo systemctl reload php8.3-fpm
sudo systemctl restart gamecon-queue gamecon-reverb gamecon-scheduler

echo "✅ Деплой завершено: $(git log -1 --format='%h %s' 2>/dev/null || cat REVISION 2>/dev/null)"
