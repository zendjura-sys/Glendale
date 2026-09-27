# Кнопка "Задеплоїти" — одноразове налаштування

Сайт (www-data) ніколи не отримує прав root. Кнопка в адмінці лише пише файл
`storage/app/deploy/trigger`, який сайт і так має право писати. За цим файлом
стежить systemd-юніт — і саме він, окремо від сайту, запускає
`deploy/setup-vps.sh` від root.

Виконати один раз на сервері (через SSH, від root):

```bash
# 1. Папка для логу/статусу деплою повинна існувати ДО увімкнення .path-юніта
mkdir -p /var/www/laravel/storage/app/deploy
chown -R www-data:www-data /var/www/laravel/storage/app/deploy

# 2. Скопіювати юніти
cp /var/www/laravel/deploy/systemd/monsory-deploy.service /etc/systemd/system/
cp /var/www/laravel/deploy/systemd/monsory-deploy.path /etc/systemd/system/

# 3. Якщо шлях до проєкту інший (не /var/www/laravel) — підправити шлях
#    у ОБОХ файлах перед копіюванням (WorkingDirectory/ExecStart у .service,
#    PathChanged у .path).

# 4. Перечитати конфігурацію systemd і увімкнути стеження
systemctl daemon-reload
systemctl enable --now monsory-deploy.path

# 5. Перевірити, що стеження активне
systemctl status monsory-deploy.path
```

Готово. Тепер кнопка "🚀 Задеплоїти" в `Аддони → Деплой на сервер` працює сама.

## Як це перевірити

Натиснути кнопку в адмінці, і за кілька секунд подивитись:

```bash
systemctl status monsory-deploy.service   # чи запустився / чи завершився успішно
tail -f /var/www/laravel/storage/app/deploy/log.txt   # той самий лог, що в адмінці
journalctl -u monsory-deploy.service -f   # повний системний журнал сервісу
```

## Безпека цього підходу

- Сайт (PHP-FPM під www-data) ніколи не викликає `sudo`, не тримає ключів
  root і не має жодного шляху до привілейованого виконання напряму —
  єдина дія, яку він може зробити, це записати файл у теку, куди й так
  має доступ.
- Фактичне виконання `deploy/setup-vps.sh` від root відбувається повністю
  поза процесом сайту — його запускає сам systemd, за подією від ядра
  (inotify), а не за прямою командою від PHP.
- Кнопка в адмінці захищена тим самим правом `addons.manage`, що й
  завантаження ZIP-пакетів — тобто лише ролі з доступом до керування
  аддонами можуть її натиснути.

## Якщо потрібно вимкнути

```bash
systemctl disable --now monsory-deploy.path
```

Кнопка в адмінці лишиться, просто перестане щось запускати — статус
зависне на "Очікує на таймер сервера…", що є явною підказкою, що
стеження вимкнено.

## Discord-бот (коли з'явиться токен)

`php artisan discord:bot` (app/Console/Commands/DiscordBotServe.php) —
заготовка під майбутній проєкт, поки без команд/логіки. На відміну від
DiscordPHP
тримає постійне WebSocket-з'єднання — тому це окремий довгоживучий
процес, а не маршрут. Навмисно НЕ підключений до setup-vps.sh: без
токена команда сама відмовляється стартувати, і тримати завжди
запущений (і завжди падаючий без токена) сервіс під час КОЖНОГО деплою
сайту — зайвий ризик для того, чим поки ніхто не користується.

Коли з'явиться `DISCORD_BOT_TOKEN` в `.env` — той самий підхід, що й
`laravel-worker.service` для черги (генерується прямо в setup-vps.sh):

```bash
cat > /etc/systemd/system/discord-bot.service <<'UNIT'
[Unit]
Description=Monsory — Discord bot (Gateway)
After=network.target

[Service]
User=www-data
Group=www-data
Restart=always
RestartSec=5
WorkingDirectory=/var/www/laravel
ExecStart=/usr/bin/php artisan discord:bot

[Install]
WantedBy=multi-user.target
UNIT
systemctl daemon-reload
systemctl enable --now discord-bot
```
