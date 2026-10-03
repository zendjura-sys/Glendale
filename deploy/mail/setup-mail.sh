#!/usr/bin/env bash
# Пошта сайту через локальний sendmail: Postfix лише на відправку (слухає тільки localhost) + підпис DKIM.
# Запуск один раз на сервері:  sudo bash /var/www/gamecon/deploy/mail/setup-mail.sh [домен]
# Повторний запуск безпечний: наявний ключ DKIM не перезаписується.
set -euo pipefail

DOMAIN="${1:-gamecon.online}"
SELECTOR="mail"
KEYDIR="/etc/opendkim/keys/$DOMAIN"

if [ "$(id -u)" -ne 0 ]; then
    echo "Запустіть через sudo." >&2
    exit 1
fi

echo "→ Встановлення Postfix і OpenDKIM для $DOMAIN"
debconf-set-selections <<EOF
postfix postfix/main_mailer_type select Internet Site
postfix postfix/mailname string $DOMAIN
EOF
DEBIAN_FRONTEND=noninteractive apt-get install -y -qq postfix opendkim opendkim-tools >/dev/null

echo "→ Postfix: лише відправка, лише з цього сервера"
echo "$DOMAIN" > /etc/mailname
postconf -e \
    "myhostname = $DOMAIN" \
    "mydomain = $DOMAIN" \
    "myorigin = \$mydomain" \
    "mydestination = localhost" \
    "inet_interfaces = loopback-only" \
    "inet_protocols = ipv4" \
    "smtp_tls_security_level = may" \
    "smtp_tls_loglevel = 1" \
    "milter_default_action = accept" \
    "milter_protocol = 6" \
    "smtpd_milters = inet:127.0.0.1:8891" \
    "non_smtpd_milters = inet:127.0.0.1:8891"

echo "→ OpenDKIM: підпис листів $DOMAIN (селектор $SELECTOR)"
mkdir -p "$KEYDIR"
if [ ! -f "$KEYDIR/$SELECTOR.private" ]; then
    opendkim-genkey -b 2048 -D "$KEYDIR" -d "$DOMAIN" -s "$SELECTOR"
fi
chown -R opendkim:opendkim /etc/opendkim
chmod 600 "$KEYDIR/$SELECTOR.private"

cat > /etc/opendkim/key.table <<EOF
$SELECTOR._domainkey.$DOMAIN $DOMAIN:$SELECTOR:$KEYDIR/$SELECTOR.private
EOF
cat > /etc/opendkim/signing.table <<EOF
*@$DOMAIN $SELECTOR._domainkey.$DOMAIN
EOF
cat > /etc/opendkim/trusted.hosts <<EOF
127.0.0.1
localhost
EOF
cat > /etc/opendkim.conf <<EOF
Syslog                  yes
UMask                   007
Mode                    sv
Canonicalization        relaxed/simple
OversignHeaders         From
KeyTable                refile:/etc/opendkim/key.table
SigningTable            refile:/etc/opendkim/signing.table
ExternalIgnoreList      /etc/opendkim/trusted.hosts
InternalHosts           /etc/opendkim/trusted.hosts
Socket                  inet:8891@127.0.0.1
PidFile                 /run/opendkim/opendkim.pid
UserID                  opendkim
EOF

systemctl enable --now opendkim postfix >/dev/null
systemctl restart opendkim postfix

IP="$(curl -4 -fsS https://api.ipify.org 2>/dev/null || hostname -I | awk '{print $1}')"
DKIM="$(sed -n 's/.*"\(.*\)".*/\1/p' "$KEYDIR/$SELECTOR.txt" | tr -d '\n')"

cat <<EOF

✅ Postfix і OpenDKIM працюють. У .env сайту:
    MAIL_MAILER=sendmail
    MAIL_SENDMAIL_PATH="/usr/sbin/sendmail -bs -i"
    MAIL_FROM_ADDRESS="no-reply@$DOMAIN"
потім: php artisan optimize && sudo systemctl restart gamecon-queue

Службові листи йдуть з no-reply@$DOMAIN («Оповіщення»),
події друзів і стрічки — з social@$DOMAIN («Соцмережі»). DKIM уже підписує обидві адреси.

Додайте DNS-записи для $DOMAIN (без них листи потраплятимуть у спам):
    TXT  @                         v=spf1 a mx ip4:$IP ~all
    TXT  $SELECTOR._domainkey      $DKIM
    TXT  _dmarc                    v=DMARC1; p=none; rua=mailto:postmaster@$DOMAIN
І попросіть хостинг налаштувати зворотний DNS (PTR) для $IP → $DOMAIN.

Перевірка: Адмін-панель → Налаштування → Пошта → «Надіслати тестовий лист»,
журнал відправки: sudo tail -f /var/log/mail.log
EOF
