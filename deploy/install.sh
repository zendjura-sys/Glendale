#!/usr/bin/env bash
# Installs or updates Glendale on a Debian/Ubuntu server behind nginx with a Let's Encrypt certificate.
# Run as root (or with sudo) from a checkout of the repository on the server:
#
#   sudo DOMAIN=social.monsory.net EMAIL=you@example.com bash deploy/install.sh
#
# Safe to re-run: later runs update the code, rebuild and restart the service, and keep data and settings.
set -euo pipefail

DOMAIN="${DOMAIN:-social.monsory.net}"
EMAIL="${EMAIL:-}"                  # for Let's Encrypt expiry notices (optional)
APP_DIR=/opt/glendale
DATA_DIR=/var/lib/glendale
ENV_FILE=/etc/glendale.env
PORT="${PORT:-3001}"
SRC_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

[ "$(id -u)" -eq 0 ] || { echo "Запустите через sudo / Run as root"; exit 1; }
[ -f "$SRC_DIR/server/src/index.js" ] || { echo "Не найден код Glendale рядом со скриптом: $SRC_DIR"; exit 1; }
step() { printf '\n\033[1;34m==> %s\033[0m\n' "$*"; }

step "Пакеты: nginx, certbot, rsync"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq nginx certbot python3-certbot-nginx rsync curl ca-certificates >/dev/null

step "Node.js 22 (нужен 22.5+ для встроенного SQLite)"
need_node=1
if command -v node >/dev/null; then
  v="$(node -p 'process.versions.node')"
  if node -e 'const [a,b]=process.versions.node.split(".").map(Number);process.exit(a>22||(a===22&&b>=5)?0:1)'; then need_node=0; fi
  echo "Установлен Node.js $v"
fi
if [ "$need_node" -eq 1 ]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash - >/dev/null
  apt-get install -y -qq nodejs >/dev/null
fi
node -v

step "Пользователь и каталоги"
id glendale >/dev/null 2>&1 || useradd --system --home "$APP_DIR" --shell /usr/sbin/nologin glendale
mkdir -p "$APP_DIR" "$DATA_DIR/uploads"
chown -R glendale:glendale "$DATA_DIR"

step "Код -> $APP_DIR"
rsync -a --delete \
  --exclude .git --exclude .npm --exclude node_modules --exclude 'client/dist' \
  --exclude 'server/data' --exclude 'server/uploads' --exclude 'data' --exclude 'uploads' \
  "$SRC_DIR/" "$APP_DIR/"
chown -R glendale:glendale "$APP_DIR"

step "Зависимости и сборка клиента"
cd "$APP_DIR"
sudo -u glendale -H npm ci --no-audit --no-fund
sudo -u glendale -H npm run build
# Runtime needs only production dependencies.
sudo -u glendale -H npm prune --omit=dev --no-audit --no-fund

step "Настройки окружения ($ENV_FILE)"
if [ ! -f "$ENV_FILE" ]; then
  cat > "$ENV_FILE" <<EOF
NODE_ENV=production
HOST=127.0.0.1
PORT=$PORT
DB_FILE=$DATA_DIR/glendale.db
UPLOADS_DIR=$DATA_DIR/uploads
# Не заполнять базу демо-данными: у демо-аккаунтов публично известные пароли.
# Первый зарегистрированный аккаунт станет суперадминистратором.
SEED=0
EOF
  chmod 640 "$ENV_FILE"
  chown root:glendale "$ENV_FILE"
else
  echo "Оставляю существующий $ENV_FILE"
fi

step "systemd"
install -m 644 "$APP_DIR/deploy/glendale.service" /etc/systemd/system/glendale.service
systemctl daemon-reload
systemctl enable glendale >/dev/null
systemctl restart glendale
sleep 2
systemctl is-active --quiet glendale || { journalctl -u glendale -n 40 --no-pager; exit 1; }
curl -fsS "http://127.0.0.1:$PORT/api/config" >/dev/null && echo "Приложение отвечает на 127.0.0.1:$PORT"

step "nginx: $DOMAIN"
conf="/etc/nginx/sites-available/$DOMAIN"
if [ ! -f "$conf" ]; then
  sed -e "s/social\.monsory\.net/$DOMAIN/g" -e "s/127\.0\.0\.1:3001/127.0.0.1:$PORT/g" "$APP_DIR/deploy/nginx.conf" > "$conf"
  ln -sf "$conf" "/etc/nginx/sites-enabled/$DOMAIN"
else
  echo "Оставляю существующий $conf (в нём может быть блок HTTPS от certbot)"
fi
nginx -t
systemctl reload nginx

step "HTTPS (Let's Encrypt)"
server_ip="$(curl -fsS https://api.ipify.org || true)"
dns_ip="$(getent ahostsv4 "$DOMAIN" | awk 'NR==1{print $1}' || true)"
if [ -z "$dns_ip" ]; then
  echo "DNS: $DOMAIN пока не резолвится. Добавьте A-запись $DOMAIN -> ${server_ip:-<IP сервера>} и запустите скрипт ещё раз."
elif [ -n "$server_ip" ] && [ "$dns_ip" != "$server_ip" ]; then
  echo "DNS: $DOMAIN указывает на $dns_ip, а у сервера $server_ip. Исправьте A-запись и запустите скрипт ещё раз."
elif [ -d "/etc/letsencrypt/live/$DOMAIN" ]; then
  echo "Сертификат уже есть; certbot продлевает его автоматически."
else
  if [ -n "$EMAIL" ]; then mail=(--email "$EMAIL"); else mail=(--register-unsafely-without-email); fi
  certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos --redirect "${mail[@]}"
fi

step "Готово"
cat <<EOF
Сайт:            https://$DOMAIN
Логи:            journalctl -u glendale -f
Перезапуск:      systemctl restart glendale
Данные:          $DATA_DIR (база и загрузки — бэкапьте эту папку)
Обновление:      git pull && sudo DOMAIN=$DOMAIN bash deploy/install.sh

Дальше:
  1. Зарегистрируйтесь на https://$DOMAIN — первый аккаунт станет суперадминистратором.
  2. Spotify: на developer.spotify.com добавьте Redirect URI https://$DOMAIN/spotify/callback,
     а Client ID укажите в Админ-панель → Настройки → Интеграции.
EOF
