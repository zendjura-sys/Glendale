#!/usr/bin/env bash
# Поштові скриньки @gamecon.online (див. setup-inbound.sh). Пароль вводиться з клавіатури й ніде не зберігається
# відкритим текстом — у /etc/dovecot/users лише хеш ARGON2ID.
#   sudo bash deploy/mail/mailbox.sh add ім'я@gamecon.online     — нова скринька (або новий пароль)
#   sudo bash deploy/mail/mailbox.sh alias з@gamecon.online на@gamecon.online
#   sudo bash deploy/mail/mailbox.sh list
#   sudo bash deploy/mail/mailbox.sh remove ім'я@gamecon.online — лише вхід; листи лишаються в /var/vmail
set -euo pipefail

USERS=/etc/dovecot/users
VMAIL_ID=$(id -u vmail)

if [ "$(id -u)" -ne 0 ]; then
    echo "Запустіть через sudo." >&2
    exit 1
fi

valid() { [[ "$1" =~ ^[a-z0-9._-]+@[a-z0-9.-]+\.[a-z]+$ ]] || { echo "✗ Некоректна адреса: $1" >&2; exit 1; }; }

# Postfix бере адреси скриньок і власників відправника з цього ж списку.
sync_postfix() {
    cut -d: -f1 "$USERS" | awk -F@ 'NF==2 {print $0, $2"/"$1"/"}' > /etc/postfix/vmailbox
    cut -d: -f1 "$USERS" | awk 'NF {print $0, $0}' > /etc/postfix/sender_login
    awk 'NF==2 {print $1, $2}' /etc/postfix/virtual >> /etc/postfix/sender_login
    systemctl reload postfix
}

case "${1:-}" in
    add)
        address=$(echo "${2:-}" | tr 'A-Z' 'a-z'); valid "$address"
        read -r -s -p "Пароль для $address (від 12 символів): " password; echo
        read -r -s -p "Ще раз: " again; echo
        [ "$password" = "$again" ] || { echo "✗ Паролі не збігаються" >&2; exit 1; }
        [ ${#password} -ge 12 ] || { echo "✗ Пароль закороткий" >&2; exit 1; }
        hash=$(doveadm pw -s ARGON2ID -p "$password")
        domain=${address#*@}; user=${address%@*}
        grep -v "^$address:" "$USERS" > "$USERS.new" || true
        echo "$address:$hash:$VMAIL_ID:$VMAIL_ID::/var/vmail/$domain/$user::" >> "$USERS.new"
        install -o root -g dovecot -m 0640 "$USERS.new" "$USERS" && rm -f "$USERS.new"
        # Службові адреси домену ведуть у першу скриньку.
        for service in postmaster abuse; do
            grep -q "^$service@$domain " /etc/postfix/virtual || echo "$service@$domain $address" >> /etc/postfix/virtual
        done
        sync_postfix
        echo "✓ $address — вхід на https://mail.$domain"
        ;;
    alias)
        from=$(echo "${2:-}" | tr 'A-Z' 'a-z'); to=$(echo "${3:-}" | tr 'A-Z' 'a-z'); valid "$from"; valid "$to"
        grep -v "^$from " /etc/postfix/virtual > /etc/postfix/virtual.new || true
        echo "$from $to" >> /etc/postfix/virtual.new && mv /etc/postfix/virtual.new /etc/postfix/virtual
        sync_postfix
        echo "✓ $from → $to"
        ;;
    remove)
        address=$(echo "${2:-}" | tr 'A-Z' 'a-z'); valid "$address"
        grep -v "^$address:" "$USERS" > "$USERS.new" || true
        install -o root -g dovecot -m 0640 "$USERS.new" "$USERS" && rm -f "$USERS.new"
        sync_postfix
        echo "✓ Вхід для $address вимкнено (листи лишилися в /var/vmail)"
        ;;
    list)
        echo "Скриньки:"; cut -d: -f1 "$USERS" | sed 's/^/  /'
        echo "Переадресації:"; sed 's/^/  /' /etc/postfix/virtual
        ;;
    *)
        sed -n '2,8p' "$0"
        exit 1
        ;;
esac
