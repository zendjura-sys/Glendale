# gamecon-auth — Linux (і macOS/Windows)

Встановлення командою (посилання з персональним підписом — на сторінці «Розробникам → Linux»):

    curl -fsSL "<посилання>" | sh

Вручну: `install -m 755 gamecon_auth.py ~/.local/bin/gamecon-auth` (потрібен python3).

1. На GameCon створіть застосунок **без секрету** (публічний), адреса повернення `http://127.0.0.1/callback`.
2. `gamecon-auth login --client-id ВАШ_CLIENT_ID`
3. `gamecon-auth me`, `gamecon-auth token`, `gamecon-auth logout`.

У своєму застосунку (GTK, Qt, CLI): `from gamecon_auth import login, me`.
