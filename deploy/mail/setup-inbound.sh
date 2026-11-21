#!/usr/bin/env bash
# Вхідна пошта @gamecon.online на цьому сервері й веб-клієнт на mail.gamecon.online:
#   Postfix — приймання листів на 25, відправка з поштових програм на 587 (лише з паролем);
#   Dovecot — скриньки в /var/vmail, IMAP 993; Rspamd — антиспам (спам падає в «Спам»/Junk);
#   Roundcube — веб-пошта (nginx + PHP-FPM, власна база SQLite, база сайту не потрібна).
#   Roundcube — офіційний реліз (ROUNDCUBE_VERSION, перевірка SHA-256): пакет Ubuntu 1.6 падає на PHP 8.5
#   (array_first). Оновлення — нові версія й сума нижче й повторний запуск скрипта (схема бази оновиться сама).
# Запуск один раз, після deploy/mail/setup-mail.sh:  sudo bash deploy/mail/setup-inbound.sh [домен]
# Повторний запуск безпечний: скриньки, паролі й ключі не перезаписуються.
# Скриньки: sudo bash deploy/mail/mailbox.sh add ім'я@gamecon.online
# DNS (вручну, у Hostinger): MX @ → mail.gamecon.online, пріоритет 10. A для mail.* уже є (запис *).
set -euo pipefail

DOMAIN="${1:-gamecon.online}"
MAILHOST="mail.$DOMAIN"
CERT="/etc/letsencrypt/live/$DOMAIN"
DIR="$(cd "$(dirname "$0")" && pwd)"
PHP_FPM_SOCK="/run/php/php$(php -r 'echo PHP_MAJOR_VERSION.".".PHP_MINOR_VERSION;')-fpm.sock"
VMAIL_ID=5000
ROUNDCUBE_VERSION=1.7.5
ROUNDCUBE_SHA256=93a66c94e3efff7db93187c1c9d7f35546647a3e1e7b9327cc87911564edf9d1
RC_DATA=/var/lib/roundcube-gamecon

if [ "$(id -u)" -ne 0 ]; then
    echo "Запустіть через sudo." >&2
    exit 1
fi
[ -f "$CERT/fullchain.pem" ] || { echo "✗ Немає сертифіката $CERT (потрібен *.$DOMAIN)" >&2; exit 1; }

echo "→ Пакети: Dovecot, Rspamd, PHP-модулі для Roundcube"
DEBIAN_FRONTEND=noninteractive apt-get install -y -qq --no-install-recommends \
    dovecot-imapd dovecot-lmtpd dovecot-sieve dovecot-managesieved rspamd \
    "php$(php -r 'echo PHP_MAJOR_VERSION.".".PHP_MINOR_VERSION;')-intl" >/dev/null
# Пакет Roundcube з Ubuntu (якщо колись ставили) не потрібен — він несумісний із PHP 8.5.
if dpkg -s roundcube-core >/dev/null 2>&1; then
    DEBIAN_FRONTEND=noninteractive apt-get purge -y -qq roundcube-core roundcube-sqlite3 roundcube-plugins roundcube >/dev/null
fi

echo "→ Сховище скриньок /var/vmail (користувач vmail)"
getent group vmail >/dev/null || groupadd --system --gid "$VMAIL_ID" vmail
id vmail >/dev/null 2>&1 || useradd --system --uid "$VMAIL_ID" --gid vmail --home-dir /var/vmail \
    --no-create-home --shell /usr/sbin/nologin vmail
install -d -o vmail -g vmail -m 0750 /var/vmail
[ -f /etc/dovecot/users ] || install -o root -g dovecot -m 0640 /dev/null /etc/dovecot/users
for f in vmailbox virtual sender_login; do
    [ -f "/etc/postfix/$f" ] || install -m 0644 /dev/null "/etc/postfix/$f"
done
# Службові адреси: системна пошта (Fail2Ban тощо) лишається в локальній скриньці root.
grep -q "^root@$DOMAIN " /etc/postfix/virtual || echo "root@$DOMAIN root@localhost" >> /etc/postfix/virtual

echo "→ Dovecot: віртуальні скриньки замість системних користувачів"
# Вхід системними обліковками (PAM) вимкнено: пошта — лише для скриньок з /etc/dovecot/users.
sed -i 's/^!include auth-system.conf.ext/#!include auth-system.conf.ext/' /etc/dovecot/conf.d/10-auth.conf
install -d -m 0755 /etc/dovecot/sieve
cat > /etc/dovecot/sieve/spam-to-junk.sieve <<'EOF'
require ["fileinto"];
# Rspamd позначає спам заголовком X-Spam: Yes — такі листи кладемо в Junk.
if header :is "X-Spam" "Yes" {
    fileinto "Junk";
    stop;
}
EOF
cat > /etc/dovecot/local.conf <<EOF
# Керує deploy/mail/setup-inbound.sh — ручні правки тут перезапишуться.
protocols = imap lmtp sieve
# rsyslog на сервері вимкнено — власний журнал (його читає Fail2Ban).
log_path = /var/log/dovecot.log
mail_driver = maildir
mail_home = /var/vmail/%{user | domain}/%{user | username}
mail_path = ~/Maildir
mail_inbox_path =
mail_uid = vmail
mail_gid = vmail
first_valid_uid = $VMAIL_ID
last_valid_uid = $VMAIL_ID

auth_mechanisms = plain login
auth_allow_cleartext = no
passdb passwd-file {
  passwd_file_path = /etc/dovecot/users
}
userdb passwd-file {
  passwd_file_path = /etc/dovecot/users
}

ssl = required
ssl_server_cert_file = $CERT/fullchain.pem
ssl_server_key_file = $CERT/privkey.pem
ssl_min_protocol = TLSv1.2

namespace inbox {
  mailbox Drafts {
    auto = subscribe
  }
  mailbox Junk {
    auto = subscribe
  }
  mailbox Trash {
    auto = subscribe
  }
  mailbox Sent {
    auto = subscribe
  }
}

# Лише IMAPS (993) і ManageSieve; нешифрований IMAP 143 вимкнено.
service imap-login {
  inet_listener imap {
    port = 0
  }
}
service lmtp {
  unix_listener /var/spool/postfix/private/dovecot-lmtp {
    mode = 0600
    user = postfix
    group = postfix
  }
}
service auth {
  unix_listener /var/spool/postfix/private/auth {
    mode = 0660
    user = postfix
    group = postfix
  }
}

protocol lmtp {
  auth_username_format = %{user | lower}
  mail_plugins {
    sieve = yes
  }
}
sieve_script spam {
  type = before
  path = /etc/dovecot/sieve/spam-to-junk.sieve
}
EOF
sievec /etc/dovecot/sieve/spam-to-junk.sieve
doveconf -n >/dev/null

echo "→ Postfix: приймання для $DOMAIN, доставка в Dovecot, відправка на 587 лише з паролем"
postconf -e \
    "inet_interfaces = all" \
    "smtpd_tls_cert_file = $CERT/fullchain.pem" \
    "smtpd_tls_key_file = $CERT/privkey.pem" \
    "smtpd_tls_security_level = may" \
    "smtpd_tls_protocols = >=TLSv1.2" \
    "smtpd_tls_mandatory_protocols = >=TLSv1.2" \
    "smtpd_tls_auth_only = yes" \
    "smtpd_helo_required = yes" \
    "disable_vrfy_command = yes" \
    "message_size_limit = 52428800" \
    "virtual_mailbox_domains = $DOMAIN" \
    "virtual_mailbox_maps = texthash:/etc/postfix/vmailbox" \
    "virtual_alias_maps = texthash:/etc/postfix/virtual" \
    "virtual_transport = lmtp:unix:private/dovecot-lmtp" \
    "smtpd_sasl_type = dovecot" \
    "smtpd_sasl_path = private/auth" \
    "smtpd_sender_login_maps = texthash:/etc/postfix/sender_login" \
    "smtpd_recipient_restrictions = permit_mynetworks permit_sasl_authenticated reject_unauth_destination" \
    "smtpd_milters = inet:127.0.0.1:11332 inet:127.0.0.1:8891" \
    "non_smtpd_milters = inet:127.0.0.1:8891"
postconf -M "submission/inet=submission inet n - y - - smtpd"
for option in \
    "syslog_name=postfix/submission" \
    "smtpd_tls_security_level=encrypt" \
    "smtpd_sasl_auth_enable=yes" \
    "smtpd_client_restrictions=permit_sasl_authenticated,reject" \
    "smtpd_sender_restrictions=reject_sender_login_mismatch" \
    "smtpd_recipient_restrictions=permit_sasl_authenticated,reject" \
    "milter_macro_daemon_name=ORIGINATING"; do
    postconf -P "submission/inet/$option"
done
postfix check

echo "→ Roundcube $ROUNDCUBE_VERSION на $MAILHOST"
RC="/opt/roundcube-$ROUNDCUBE_VERSION"
if [ ! -f "$RC/index.php" ]; then
    archive=$(mktemp)
    curl -fsSL -o "$archive" \
        "https://github.com/roundcube/roundcubemail/releases/download/$ROUNDCUBE_VERSION/roundcubemail-$ROUNDCUBE_VERSION-complete.tar.gz"
    echo "$ROUNDCUBE_SHA256  $archive" | sha256sum -c --quiet - || { echo "✗ Контрольна сума Roundcube не збігається" >&2; exit 1; }
    install -d -m 0755 "$RC"
    tar -xzf "$archive" -C "$RC" --strip-components=1 --no-same-owner
    rm -f "$archive"
    rm -rf "$RC/installer"
fi
install -d -o www-data -g www-data -m 0750 "$RC_DATA" "$RC_DATA/temp"
install -d -o www-data -g adm -m 0750 /var/log/roundcube
# Ключ шифрування сесій — один на всі версії (інакше після оновлення всіх розлогінить).
if [ ! -s "$RC_DATA/des_key" ]; then
    head -c 24 /dev/urandom | base64 | tr -d '/+=' | head -c 24 > "$RC_DATA/des_key"
fi
chown root:www-data "$RC_DATA/des_key"
chmod 0640 "$RC_DATA/des_key"
DES_KEY=$(cat "$RC_DATA/des_key")
cat > "$RC/config/config.inc.php" <<EOF
<?php
// Керує deploy/mail/setup-inbound.sh — ручні правки тут перезапишуться.
\$config = [];
\$config['db_dsnw'] = 'sqlite:///$RC_DATA/roundcube.sqlite?mode=0640';
\$config['temp_dir'] = '$RC_DATA/temp/';
\$config['log_dir'] = '/var/log/roundcube/';
\$tls = ['ssl' => ['peer_name' => '$MAILHOST', 'verify_peer' => true]];
\$config['imap_host'] = 'ssl://127.0.0.1:993';
\$config['imap_conn_options'] = \$tls;
\$config['smtp_host'] = 'tls://127.0.0.1:587';
\$config['smtp_conn_options'] = \$tls;
\$config['smtp_user'] = '%u';
\$config['smtp_pass'] = '%p';
\$config['username_domain'] = '$DOMAIN';
\$config['mail_domain'] = '$DOMAIN';
\$config['des_key'] = '$DES_KEY';
\$config['product_name'] = 'GameCon Mail';
\$config['support_url'] = '';
\$config['skin'] = 'elastic';
\$config['language'] = 'uk_UA';
\$config['plugins'] = ['archive', 'zipdownload', 'managesieve', 'markasjunk'];
\$config['managesieve_host'] = 'tls://127.0.0.1:4190';
\$config['managesieve_conn_options'] = \$tls;
\$config['markasjunk_learning_driver'] = null;
\$config['enable_installer'] = false;
\$config['enable_spellcheck'] = false;
\$config['ip_check'] = true;
\$config['use_https'] = true;
\$config['session_lifetime'] = 60;
\$config['login_autocomplete'] = 0;
\$config['log_logins'] = true;
EOF
chown root:www-data "$RC/config/config.inc.php"
chmod 0640 "$RC/config/config.inc.php"
# Нова база — схема з релізу; наявна — оновлення схеми до цієї версії.
if [ ! -s "$RC_DATA/roundcube.sqlite" ]; then
    sudo -u www-data sqlite3 "$RC_DATA/roundcube.sqlite" < "$RC/SQL/sqlite.initial.sql"
else
    sudo -u www-data php "$RC/bin/updatedb.sh" --package=roundcube --dir="$RC/SQL" >/dev/null
fi
ln -sfn "$RC" /opt/roundcube

sed "s#__PHP_FPM_SOCK__#$PHP_FPM_SOCK#; s#__MAILHOST__#$MAILHOST#g; s#__CERT__#$CERT#g" \
    "$DIR/../nginx/mail.gamecon.online.conf" > /etc/nginx/sites-enabled/mail.gamecon.online.conf
nginx -t

echo "→ Fail2Ban: підбір паролів до пошти"
for log in /var/log/dovecot.log /var/log/roundcube/errors.log; do
    [ -f "$log" ] || touch "$log"
done
chown www-data:adm /var/log/roundcube/errors.log
cat > /etc/logrotate.d/gamecon-dovecot <<'EOF'
/var/log/dovecot.log {
    weekly
    rotate 8
    compress
    missingok
    notifempty
    postrotate
        doveadm log reopen 2>/dev/null || true
    endscript
}
EOF
cat > /etc/fail2ban/jail.d/gamecon-mail.conf <<'EOF'
[postfix-sasl]
enabled = true
port = smtp,submission
backend = auto
logpath = /var/log/mail.log

[dovecot]
enabled = true
port = imaps,sieve
backend = auto
logpath = /var/log/dovecot.log

[roundcube-auth]
enabled = true
port = http,https
logpath = /var/log/roundcube/errors.log
EOF

echo "→ Оновлення сертифіката перезапускає пошту"
cat > /etc/letsencrypt/renewal-hooks/deploy/gamecon-mail.sh <<'EOF'
#!/bin/sh
systemctl reload postfix dovecot
EOF
chmod 0755 /etc/letsencrypt/renewal-hooks/deploy/gamecon-mail.sh

echo "→ Фаєрвол: 25 (приймання), 587 (відправка), 993 (IMAP), 4190 (фільтри)"
for port in 25 587 993 4190; do ufw allow "$port/tcp" >/dev/null; done

# inet_interfaces Postfix змінює лише повний перезапуск, не reload.
systemctl restart dovecot rspamd postfix
systemctl reload nginx
systemctl restart fail2ban
echo "✅ Пошта $DOMAIN: веб-клієнт https://$MAILHOST"
echo "   Скринька:  sudo bash $DIR/mailbox.sh add ім'я@$DOMAIN"
echo "   DNS:       MX @ → $MAILHOST (пріоритет 10)"
