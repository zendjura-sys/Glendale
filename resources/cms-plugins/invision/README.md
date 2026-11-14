# GameCon для Invision Community 4.7 / 5

## Варіант А — дополнення (рекомендовано)

Дополнення `applications/gamecon` — вхід через GameCon зараз і нові функції GameCon згодом.

1. Завантажте папку `applications/gamecon` у `applications/` форуму.
2. ACP → System → Applications → GameCon → Install.
3. ACP → GameCon → Settings: Client ID, Secret.
4. На GameCon адреса повернення:
   `https://ваш-форум/index.php?app=gamecon&module=system&controller=login&do=callback`
5. Кнопку додайте посиланням `index.php?app=gamecon&module=system&controller=login`
   (меню, блок «Custom» або шаблон входу).

## Варіант Б — вбудований модуль «Other OAuth 2.0» (без коду)

### 1. Застосунок на GameCon
Розробникам → Новий застосунок → адреса повернення:

    https://ваш-форум/oauth/callback/

(для IPS 4.x без дружніх URL — `https://ваш-форум/index.php?app=core&module=system&controller=login`)

### 2. Модуль входу в IPS
ACP → System → Login & Registration → Create New → **Other OAuth 2.0**:

| Поле | Значення |
|---|---|
| Name | GameCon |
| Client Identifier | ваш Client ID |
| Client Secret | ваш Client Secret |
| Authorization Endpoint | https://gamecon.online/oauth/authorize |
| Token Endpoint | https://gamecon.online/oauth/token |
| Authentication method | Client secret in request body |
| Scopes to request | profile email |
| User Information Endpoint | https://gamecon.online/api/developer/v1/userinfo |
| User ID | sub |
| Display name field | preferred_username |
| Email address field | email |
| Profile photo field | picture |
| Profile URL field | profile |
| Button colour | #4F46E5 |
| Button text | Увійти через GameCon |
| Button icon | файл `gamecon-icon.svg` з цього архіву |

Збережіть і увімкніть модуль. Кнопка з’явиться у формі входу й реєстрації.
