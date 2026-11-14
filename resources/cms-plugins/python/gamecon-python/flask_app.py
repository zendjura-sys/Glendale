"""Flask + Authlib: «Увійти через GameCon» (OAuth 2.1 з PKCE).

GAMECON_CLIENT_ID=… GAMECON_CLIENT_SECRET=… SECRET_KEY=… flask --app flask_app run
Адреса повернення: https://ваш-сайт/auth/gamecon/callback
"""
import os

from authlib.integrations.flask_client import OAuth
from flask import Flask, redirect, session, url_for

BASE = os.environ.get("GAMECON_URL", "https://gamecon.online")

app = Flask(__name__)
app.secret_key = os.environ["SECRET_KEY"]

oauth = OAuth(app)
oauth.register(
    "gamecon",
    client_id=os.environ["GAMECON_CLIENT_ID"],
    client_secret=os.environ["GAMECON_CLIENT_SECRET"],
    authorize_url=f"{BASE}/oauth/authorize",
    access_token_url=f"{BASE}/oauth/token",
    userinfo_endpoint=f"{BASE}/api/developer/v1/userinfo",
    client_kwargs={"scope": "profile email", "code_challenge_method": "S256", "token_endpoint_auth_method": "client_secret_post"},
)


@app.route("/")
def index():
    user = session.get("user")
    if user:
        return f'Привіт, {user.get("name") or user["preferred_username"]}! <a href="/logout">Вийти</a>'
    return '<a href="/auth/gamecon">Увійти через GameCon</a>'


@app.route("/auth/gamecon")
def login():
    return oauth.gamecon.authorize_redirect(url_for("callback", _external=True))


@app.route("/auth/gamecon/callback")
def callback():
    token = oauth.gamecon.authorize_access_token()
    # Тут знайдіть або створіть користувача у своїй базі за userinfo["sub"].
    session["user"] = oauth.gamecon.userinfo(token=token)
    return redirect("/")


@app.route("/logout")
def logout():
    session.pop("user", None)
    return redirect("/")
