#!/usr/bin/env bash
# Сервер голосових кімнат LiveKit на тому ж VDS, що й сайт.
# Запуск один раз:  sudo bash /var/www/gamecon/deploy/livekit/setup-livekit.sh [voice-домен] [домен-сайту]
# Повторний запуск безпечний: ключі зберігаються, конфіг і сервіс оновлюються.
set -euo pipefail

VOICE="${1:-voice.gamecon.online}"
SITE="${2:-gamecon.online}"
APP=/var/www/gamecon
CONF=/etc/livekit.yaml

if [ "$(id -u)" -ne 0 ]; then
    echo "Запустіть через sudo." >&2
    exit 1
fi

echo "→ LiveKit для $VOICE"
if ! command -v livekit-server >/dev/null; then
    curl -sSL https://get.livekit.io | bash
fi

# Ключі: беремо з .env сайту, якщо вже є, інакше генеруємо.
KEY="$(grep -E '^LIVEKIT_API_KEY=' "$APP/.env" 2>/dev/null | cut -d= -f2- | tr -d '"' || true)"
SECRET="$(grep -E '^LIVEKIT_API_SECRET=' "$APP/.env" 2>/dev/null | cut -d= -f2- | tr -d '"' || true)"
if [ -z "$KEY" ] || [ -z "$SECRET" ]; then
    KEY="API$(openssl rand -hex 6)"
    SECRET="$(openssl rand -base64 36 | tr -d '/+=\n' | cut -c1-48)"
fi

cat > "$CONF" <<YAML
# Згенеровано deploy/livekit/setup-livekit.sh
port: 7880
bind_addresses: ["127.0.0.1"]
rtc:
  tcp_port: 7881
  port_range_start: 50000
  port_range_end: 60000
  use_external_ip: true
turn:
  enabled: true
  domain: $VOICE
  udp_port: 3478
keys:
  $KEY: $SECRET
webhook:
  api_key: $KEY
  urls:
    - https://$SITE/api/livekit/webhook
room:
  empty_timeout: 120
  max_participants: 50
logging:
  level: info
YAML
chmod 600 "$CONF"

cat > /etc/systemd/system/livekit.service <<UNIT
[Unit]
Description=LiveKit (голосові кімнати GameCon)
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
systemctl enable --now livekit >/dev/null
systemctl restart livekit

echo "→ Порти для звуку (UDP 50000–60000, TCP 7881, TURN UDP 3478)"
if command -v ufw >/dev/null && ufw status | grep -q active; then
    ufw allow 7881/tcp >/dev/null
    ufw allow 3478/udp >/dev/null
    ufw allow 50000:60000/udp >/dev/null
fi

echo "→ nginx: wss://$VOICE → 127.0.0.1:7880"
CERT=/etc/letsencrypt/live/$VOICE
if [ ! -f "$CERT/fullchain.pem" ]; then
    if openssl x509 -in "/etc/letsencrypt/live/$SITE/fullchain.pem" -noout -text 2>/dev/null | grep -q "DNS:\*\.${SITE}"; then
        CERT=/etc/letsencrypt/live/$SITE
    else
        certbot certonly --nginx -d "$VOICE" --non-interactive --agree-tos --register-unsafely-without-email
    fi
fi
sed -e "s#__VOICE__#$VOICE#g" -e "s#__CERT__#$CERT#g" "$APP/deploy/nginx/voice.conf" > "/etc/nginx/sites-available/$VOICE.conf"
ln -sf "/etc/nginx/sites-available/$VOICE.conf" "/etc/nginx/sites-enabled/$VOICE.conf"
nginx -t
systemctl reload nginx

echo "→ Ключі в .env сайту"
touch "$APP/.env"
for pair in "LIVEKIT_URL=wss://$VOICE" "LIVEKIT_API_KEY=$KEY" "LIVEKIT_API_SECRET=$SECRET"; do
    name="${pair%%=*}"
    if grep -qE "^$name=" "$APP/.env"; then
        sed -i "s#^$name=.*#$pair#" "$APP/.env"
    else
        echo "$pair" >> "$APP/.env"
    fi
done
(cd "$APP" && php artisan config:clear >/dev/null && php artisan optimize >/dev/null) || true

cat <<DONE

✅ LiveKit працює: wss://$VOICE (API Key: $KEY; секрет записано в $APP/.env і $CONF).
   DNS: A-запис $VOICE → IP цього сервера (якщо ще немає).
   Перевірка: Адмін-панель → Інтеграції → Голосові кімнати → «Перевірити».
   Журнал: sudo journalctl -u livekit -f
DONE
