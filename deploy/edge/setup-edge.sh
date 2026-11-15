#!/usr/bin/env bash
# Edge-вузол GameCon: LiveKit (голос, дзвінки, трансляції) + CDN-кеш для збірки й медіа.
# Розраховано на окрему машину без власного домену — напр. Oracle Cloud Always Free (Ampere A1, Ubuntu 22.04/24.04).
#
# Запуск на вузлі (один раз; повторний запуск безпечний — ключі й кеш лишаються):
#   sudo bash setup-edge.sh                         # ім'я вузла = <ip-через-дефіси>.sslip.io
#   sudo bash setup-edge.sh --host voice.gamecon.online --cache-gb 150
# Щоб не міняти ключі LiveKit на сайті, передайте поточні (з .env основного сервера):
#   sudo LIVEKIT_API_KEY=… LIVEKIT_API_SECRET=… bash setup-edge.sh
# Ключі нікуди не комітяться: лежать лише в /etc/livekit.yaml на вузлі й у .env сайту.
set -euo pipefail

ORIGIN="gamecon.online"
HOST=""
CACHE_GB=120
EMAIL=""
while [ $# -gt 0 ]; do
    case "$1" in
        --origin) ORIGIN="$2"; shift 2 ;;
        --host) HOST="$2"; shift 2 ;;
        --cache-gb) CACHE_GB="$2"; shift 2 ;;
        --email) EMAIL="$2"; shift 2 ;;
        *) echo "Невідомий параметр: $1" >&2; exit 1 ;;
    esac
done

if [ "$(id -u)" -ne 0 ]; then
    echo "Запустіть через sudo." >&2
    exit 1
fi

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEMPLATE="$DIR/../nginx/edge.conf"
[ -f "$TEMPLATE" ] || { echo "Немає $TEMPLATE — запускайте з копії репозиторію (папка deploy/)." >&2; exit 1; }

echo "→ Пакети"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq nginx certbot curl openssl iptables-persistent >/dev/null

IP="$(curl -fsS4 --max-time 5 https://api.ipify.org || curl -fsS4 --max-time 5 https://ifconfig.me || true)"
if [ -z "$HOST" ]; then
    [ -n "$IP" ] || { echo "Не вдалося визначити публічний IP — вкажіть --host." >&2; exit 1; }
    # Без домену: sslip.io повертає цей самий IP, а Let's Encrypt видає на ім'я сертифікат.
    HOST="${IP//./-}.sslip.io"
fi
echo "   Вузол: $HOST (IP ${IP:-?}), сайт: $ORIGIN, кеш до ${CACHE_GB} ГБ"

echo "→ Брандмауер (у образах Oracle iptables за замовчуванням закриває все, крім SSH)"
open_port() {
    local proto="$1" port="$2"
    iptables -C INPUT -p "$proto" --dport "$port" -j ACCEPT 2>/dev/null \
        || iptables -I INPUT -p "$proto" --dport "$port" -j ACCEPT
}
open_port tcp 80
open_port tcp 443
open_port tcp 7881      # LiveKit RTC через TCP (коли UDP закритий)
open_port udp 3478      # TURN/UDP
open_port tcp 5349      # TURN/TLS (корпоративні мережі)
open_port udp 50000:60000
netfilter-persistent save >/dev/null
if command -v ufw >/dev/null && ufw status | grep -q active; then
    for rule in 80/tcp 443/tcp 7881/tcp 3478/udp 5349/tcp 50000:60000/udp; do ufw allow "$rule" >/dev/null; done
fi

echo "→ Сертифікат Let's Encrypt для $HOST"
mkdir -p /var/www/letsencrypt /var/cache/gamecon-edge
chown www-data:www-data /var/cache/gamecon-edge
CERT="/etc/letsencrypt/live/$HOST"
if [ ! -f "$CERT/fullchain.pem" ]; then
    # Тимчасовий HTTP-сервер лише для перевірки ACME.
    cat > /etc/nginx/sites-available/gamecon-edge.conf <<NGINX
server {
    listen 80 default_server;
    server_name $HOST;
    location ^~ /.well-known/acme-challenge/ { root /var/www/letsencrypt; }
    location / { return 404; }
}
NGINX
    rm -f /etc/nginx/sites-enabled/default
    ln -sf /etc/nginx/sites-available/gamecon-edge.conf /etc/nginx/sites-enabled/gamecon-edge.conf
    nginx -t && systemctl reload nginx
    if [ -n "$EMAIL" ]; then MAIL=(--email "$EMAIL"); else MAIL=(--register-unsafely-without-email); fi
    certbot certonly --webroot -w /var/www/letsencrypt -d "$HOST" --non-interactive --agree-tos "${MAIL[@]}"
fi
# Після продовження сертифіката: nginx і LiveKit (TURN/TLS) підхоплюють новий.
mkdir -p /etc/letsencrypt/renewal-hooks/deploy
cat > /etc/letsencrypt/renewal-hooks/deploy/gamecon-edge.sh <<'HOOK'
#!/bin/sh
systemctl reload nginx
systemctl restart livekit
HOOK
chmod +x /etc/letsencrypt/renewal-hooks/deploy/gamecon-edge.sh

echo "→ LiveKit"
if ! command -v livekit-server >/dev/null; then
    curl -sSL https://get.livekit.io | bash
fi
CONF=/etc/livekit.yaml
KEY="${LIVEKIT_API_KEY:-}"
SECRET="${LIVEKIT_API_SECRET:-}"
if { [ -z "$KEY" ] || [ -z "$SECRET" ]; } && [ -f "$CONF" ]; then
    # Повторний запуск: ключі з чинного конфігу.
    KEY="$(awk '/^keys:/{getline; sub(/^ +/,""); split($0,a,": "); print a[1]}' "$CONF")"
    SECRET="$(awk '/^keys:/{getline; sub(/^ +/,""); split($0,a,": "); print a[2]}' "$CONF")"
fi
if [ -z "$KEY" ] || [ -z "$SECRET" ]; then
    KEY="API$(openssl rand -hex 6)"
    SECRET="$(openssl rand -base64 36 | tr -d '/+=\n' | cut -c1-48)"
    NEW_KEYS=1
fi
cat > "$CONF" <<YAML
# Згенеровано deploy/edge/setup-edge.sh
port: 7880
bind_addresses: ["127.0.0.1"]
rtc:
  tcp_port: 7881
  port_range_start: 50000
  port_range_end: 60000
  # Oracle й інші хмари дають приватну адресу за NAT 1:1 — публічну LiveKit дізнається сам.
  use_external_ip: true
turn:
  enabled: true
  domain: $HOST
  udp_port: 3478
  tls_port: 5349
  cert_file: $CERT/fullchain.pem
  key_file: $CERT/privkey.pem
keys:
  $KEY: $SECRET
webhook:
  api_key: $KEY
  urls:
    - https://$ORIGIN/api/livekit/webhook
room:
  empty_timeout: 120
  max_participants: 100
logging:
  level: info
YAML
chmod 600 "$CONF"

cat > /etc/systemd/system/livekit.service <<UNIT
[Unit]
Description=LiveKit (голос GameCon, edge-вузол)
After=network-online.target
Wants=network-online.target

[Service]
ExecStart=/usr/local/bin/livekit-server --config $CONF
Restart=always
RestartSec=3
LimitNOFILE=65536

[Install]
WantedBy=multi-user.target
UNIT
systemctl daemon-reload
systemctl enable livekit >/dev/null
systemctl restart livekit

echo "→ nginx: CDN-кеш і проксі LiveKit"
sed -e "s#__HOST__#$HOST#g" -e "s#__ORIGIN__#$ORIGIN#g" -e "s#__CERT__#$CERT#g" -e "s#__CACHE_GB__#$CACHE_GB#g" \
    "$TEMPLATE" > /etc/nginx/sites-available/gamecon-edge.conf
rm -f /etc/nginx/sites-enabled/default
ln -sf /etc/nginx/sites-available/gamecon-edge.conf /etc/nginx/sites-enabled/gamecon-edge.conf
nginx -t
systemctl reload nginx

echo "→ Перевірка"
sleep 2
curl -fsS "https://$HOST/edge-health" >/dev/null && echo "   https://$HOST/edge-health — ok" || echo "   ⚠ edge-health не відповідає — перевірте Security List в Oracle (порти нижче)."
curl -fsSI "https://$HOST/images/help/login.webp" 2>/dev/null | grep -i '^x-edge-cache' || echo "   (CDN: перший запит до сайту ще не пройшов — це нормально, якщо сайт ще без цього файлу)"

cat <<DONE

✅ Edge-вузол працює: https://$HOST

1) Oracle Cloud → VCN → Security List (Ingress) — відкрийте, якщо ще ні:
   TCP 80, 443, 7881, 5349 · UDP 3478, 50000–60000 (джерело 0.0.0.0/0)

2) Адмін-панель → Інтеграції → «Edge-вузол: сервер голосу й файлів»:
   Адреса вузла: https://$HOST → «Перевірити»
   «Сервер голосу» й «Сервер файлів» → «Edge-вузол» → «Зберегти».
   Якщо вузол упаде, сайт за 1–2 хв сам повернеться на основний сервер.
DONE
if [ "${NEW_KEYS:-0}" = 1 ]; then
    cat <<DONE
   Нові ключі LiveKit вузла — впишіть у ту саму картку (поля «API Key/Secret LiveKit на вузлі»):
   API Key:    $KEY
   API Secret: $SECRET
DONE
fi
cat <<DONE
   Журнали: journalctl -u livekit -f · /var/log/nginx/error.log
DONE
