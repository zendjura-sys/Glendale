#!/usr/bin/env python3
"""gamecon-auth — «Увійти через GameCon» для Linux (і macOS/Windows) без залежностей.

Нативний застосунок — публічний клієнт: без секрету, OAuth 2.1 + PKCE, адреса повернення
http://127.0.0.1/callback (порт будь-який, RFC 8252). Зареєструйте її у своєму застосунку GameCon.

  gamecon-auth login --client-id ID [--scope "profile email"]
  gamecon-auth me        # профіль (sub, preferred_username, name, email, picture)
  gamecon-auth token     # чинний access token (оновлює сам)
  gamecon-auth logout

Як модуль: from gamecon_auth import login, me
"""
import argparse
import base64
import hashlib
import http.server
import json
import os
import secrets
import sys
import threading
import time
import urllib.parse
import urllib.request
import webbrowser

BASE = os.environ.get("GAMECON_URL", "https://gamecon.online").rstrip("/")
STORE = os.path.join(os.environ.get("XDG_CONFIG_HOME", os.path.expanduser("~/.config")), "gamecon", "token.json")


def _b64(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


def _post(path: str, form: dict) -> dict:
    req = urllib.request.Request(BASE + path, data=urllib.parse.urlencode(form).encode(), headers={"Accept": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=20) as res:
            return json.load(res)
    except urllib.error.HTTPError as err:
        return json.load(err)


def _save(data: dict) -> None:
    os.makedirs(os.path.dirname(STORE), mode=0o700, exist_ok=True)
    data["obtained_at"] = int(time.time())
    with open(STORE, "w") as fh:
        json.dump(data, fh)
    os.chmod(STORE, 0o600)


def login(client_id: str, scope: str = "profile email", open_browser: bool = True) -> dict:
    """Відкриває браузер, ловить повернення на 127.0.0.1 і повертає токени."""
    verifier = _b64(secrets.token_bytes(48))
    state = _b64(secrets.token_bytes(24))
    result: dict = {}

    class Handler(http.server.BaseHTTPRequestHandler):
        def do_GET(self):  # noqa: N802
            query = dict(urllib.parse.parse_qsl(urllib.parse.urlparse(self.path).query))
            if urllib.parse.urlparse(self.path).path != "/callback":
                self.send_response(404)
                self.end_headers()
                return
            result.update(query)
            ok = query.get("state") == state and "code" in query
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.end_headers()
            self.wfile.write(("<h2>Готово — можна повернутися до застосунку.</h2>" if ok else "<h2>Вхід скасовано.</h2>").encode())

        def log_message(self, *args):
            pass

    server = http.server.HTTPServer(("127.0.0.1", 0), Handler)
    redirect = f"http://127.0.0.1:{server.server_port}/callback"
    url = BASE + "/oauth/authorize?" + urllib.parse.urlencode({
        "response_type": "code",
        "client_id": client_id,
        "redirect_uri": redirect,
        "scope": scope,
        "state": state,
        "code_challenge": _b64(hashlib.sha256(verifier.encode()).digest()),
        "code_challenge_method": "S256",
    })
    thread = threading.Thread(target=server.handle_request, daemon=True)
    thread.start()
    print("Відкрийте в браузері, якщо не відкрилося само:\n" + url, file=sys.stderr)
    if open_browser:
        webbrowser.open(url)
    thread.join(timeout=300)
    server.server_close()
    if result.get("state") != state or "code" not in result:
        raise SystemExit(result.get("error_description") or "Вхід не завершено.")
    token = _post("/oauth/token", {
        "grant_type": "authorization_code",
        "code": result["code"],
        "redirect_uri": redirect,
        "client_id": client_id,
        "code_verifier": verifier,
    })
    if "access_token" not in token:
        raise SystemExit(token.get("error_description") or "GameCon не видав токен.")
    token["client_id"] = client_id
    _save(token)
    return token


def token() -> str:
    """Чинний access token; прострочений — оновлює через refresh token."""
    with open(STORE) as fh:
        data = json.load(fh)
    if time.time() < data.get("obtained_at", 0) + int(data.get("expires_in", 0)) - 60:
        return data["access_token"]
    fresh = _post("/oauth/token", {"grant_type": "refresh_token", "refresh_token": data["refresh_token"], "client_id": data["client_id"]})
    if "access_token" not in fresh:
        raise SystemExit("Сесія закінчилась — виконайте gamecon-auth login.")
    fresh["client_id"] = data["client_id"]
    _save(fresh)
    return fresh["access_token"]


def me() -> dict:
    req = urllib.request.Request(BASE + "/api/developer/v1/userinfo", headers={"Authorization": "Bearer " + token(), "Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=20) as res:
        return json.load(res)


def main() -> None:
    parser = argparse.ArgumentParser(prog="gamecon-auth", description="Увійти через GameCon")
    sub = parser.add_subparsers(dest="cmd", required=True)
    p_login = sub.add_parser("login", help="увійти через браузер")
    p_login.add_argument("--client-id", required=True)
    p_login.add_argument("--scope", default="profile email")
    p_login.add_argument("--no-browser", action="store_true")
    sub.add_parser("me", help="показати профіль")
    sub.add_parser("token", help="надрукувати access token")
    sub.add_parser("logout", help="забути токени")
    args = parser.parse_args()
    if args.cmd == "login":
        login(args.client_id, args.scope, not args.no_browser)
        print(json.dumps(me(), ensure_ascii=False, indent=2))
    elif args.cmd == "me":
        print(json.dumps(me(), ensure_ascii=False, indent=2))
    elif args.cmd == "token":
        print(token())
    elif args.cmd == "logout":
        if os.path.exists(STORE):
            os.remove(STORE)
        print("Готово.")


if __name__ == "__main__":
    main()
