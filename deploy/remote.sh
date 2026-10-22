#!/usr/bin/env bash
# Виконується на сервері в /var/www/gamecon після синхронізації коду.
set -euo pipefail
cd /var/www/gamecon

if [ ! -f .env ]; then
    echo "Немає .env — створіть його з deploy/.env.production.example" >&2
    exit 1
fi

# ffmpeg/ffprobe — кодек і якість треків (Lossless / Hi-Res), теги, обкладинки й копії AAC для браузера.
# Ставимо один раз; не вдалося — деплой не зупиняємо: музика працює, лише без розбору кодеків.
command -v ffprobe >/dev/null 2>&1 \
    || { sudo apt-get update -qq && sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq ffmpeg >/dev/null; } \
    || echo "⚠ ffmpeg не встановлено: sudo apt-get install ffmpeg" >&2

# fpcalc (Chromaprint) — відбиток звуку для розпізнавання треків через AcoustID. Так само: один раз, без зупинки деплою.
command -v fpcalc >/dev/null 2>&1 \
    || { sudo apt-get update -qq && sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq libchromaprint-tools >/dev/null; } \
    || echo "⚠ fpcalc не встановлено: sudo apt-get install libchromaprint-tools" >&2

# Hunspell зі словниками uk_UA / en_US — перевірка орфографії текстів адміністрації. Один раз, без зупинки деплою.
{ command -v hunspell >/dev/null 2>&1 && [ -f /usr/share/hunspell/uk_UA.dic ] && [ -f /usr/share/hunspell/en_US.dic ]; } \
    || { sudo apt-get update -qq && sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq hunspell hunspell-uk hunspell-en-us >/dev/null; } \
    || echo "⚠ hunspell не встановлено: sudo apt-get install hunspell hunspell-uk hunspell-en-us" >&2

# LibreTranslate — запасний перекладач, коли вичерпано ліміт DeepL. Лише на прохання: INSTALL_LIBRETRANSLATE=1
# (потрібно 2–4 ГБ RAM і кілька ГБ диска). Невдача деплой не зупиняє.
if [ "${INSTALL_LIBRETRANSLATE:-}" = 1 ]; then
    bash deploy/libretranslate.sh || echo "⚠ LibreTranslate не встановлено — див. deploy/libretranslate.sh" >&2
fi

# Залежності ставимо до першого artisan: новий код може посилатися на щойно додані пакети.
# Скрипти composer (package:discover) запускаємо вже після режиму обслуговування.
composer install --no-dev --no-interaction --prefer-dist --optimize-autoloader --no-progress --no-scripts
php artisan down --retry=15 >/dev/null 2>&1 || true
trap 'php artisan up >/dev/null 2>&1 || true' EXIT
composer run-script post-autoload-dump --no-interaction
# Кеш маршрутів від попереднього релізу: без очищення Wayfinder під час збірки не бачить нових маршрутів.
php artisan optimize:clear
npm ci --no-audit --no-fund --loglevel=error
npm run build

php artisan migrate --force
php artisan db:seed --force
php artisan storage:link 2>/dev/null || true
php artisan optimize

sudo chown -R cursor-agent:www-data storage bootstrap/cache
sudo chmod -R ug+rwX storage bootstrap/cache

# Версія PHP-FPM залежить від релізу Ubuntu (24.04 — 8.3, 26.04 — 8.5): беремо ту, що встановлена.
PHP_FPM="php$(php -r 'echo PHP_MAJOR_VERSION.".".PHP_MINOR_VERSION;')-fpm"
sudo systemctl reload "$PHP_FPM"
sudo systemctl restart gamecon-queue gamecon-reverb gamecon-scheduler

echo "✅ Деплой завершено: $(git log -1 --format='%h %s' 2>/dev/null || cat REVISION 2>/dev/null)"
