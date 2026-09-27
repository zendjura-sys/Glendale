# Развёртывание на social.monsory.net

Сервер `212.95.33.196`, Debian/Ubuntu. Схема такая: nginx (HTTPS, Let's Encrypt) → Node.js на `127.0.0.1:3001` (systemd).
База SQLite и загрузки хранятся в `/var/lib/glendale`.

## 1. DNS

У `monsory.net` есть wildcard-запись `A  *  212.95.33.196`, поэтому `social.monsory.net` уже указывает на сервер и отдельная запись не нужна.
Проверка: `dig +short social.monsory.net` должен вернуть `212.95.33.196`.

## 2. Установка

```bash
ssh monsory@212.95.33.196            # или root@
git clone https://github.com/zendjura-sys/Glendale.git
cd Glendale
git checkout claude/social-network-app-lq8mjb
sudo DOMAIN=social.monsory.net EMAIL=you@example.com bash deploy/install.sh
```

Если GitHub-репозиторий приватный, то либо клонируйте с токеном / deploy-ключом, либо скопируйте код со своего компьютера:
`rsync -a --exclude node_modules ./ monsory@212.95.33.196:~/Glendale/`.

Скрипт делает следующее:

- ставит nginx, certbot и Node.js 22;
- создаёт системного пользователя `glendale`;
- копирует код в `/opt/glendale`, собирает клиент;
- создаёт `/etc/glendale.env` и сервис `glendale.service`;
- настраивает vhost nginx (WebSocket `/ws`, загрузки до 60 МБ);
- выпускает сертификат (`certbot certonly`, конфиги других сайтов certbot не трогает) и включает HTTPS с редиректом HTTP → HTTPS.

Остальные сайты на сервере он не трогает. Если DNS ещё не обновился, скрипт скажет об этом. Тогда просто запустите его ещё раз позже.

## 3. После установки

1. Откройте https://social.monsory.net и зарегистрируйтесь. **Первый аккаунт становится суперадминистратором.**
   Демо-данные в продакшене выключены (`SEED=0`), потому что у демо-аккаунтов публично известные пароли.
2. Задайте язык сайта по умолчанию в «Админ-панель → Настройки → Общие» (украинский уже выбран).
3. Spotify:
   - на https://developer.spotify.com/dashboard создайте приложение (Web API + Web Playback SDK);
   - добавьте Redirect URI `https://social.monsory.net/spotify/callback`;
   - вставьте Client ID в «Админ-панель → Настройки → Интеграции».

## Обслуживание

```bash
journalctl -u glendale -f                 # логи
sudo systemctl restart glendale           # перезапуск
cd ~/Glendale && git pull && sudo DOMAIN=social.monsory.net bash deploy/install.sh   # обновление
sudo sqlite3 /var/lib/glendale/glendale.db ".backup '/root/glendale-$(date +%F).db'"  # бэкап базы
```

Для бэкапа сохраняйте `/var/lib/glendale` целиком: там база и загрузки.

## Безопасность

- Пароль root, отправленный в чат, стоит сменить: `passwd`.
- Лучше перейти на вход по SSH-ключу (`ssh-copy-id monsory@212.95.33.196`) и отключить вход по паролю и вход под root в `/etc/ssh/sshd_config`: `PasswordAuthentication no`, `PermitRootLogin no`.
