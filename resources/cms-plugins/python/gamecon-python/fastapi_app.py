"""FastAPI + Authlib: «Увійти через GameCon» (OAuth 2.1 з PKCE).

GAMECON_CLIENT_ID=… GAMECON_CLIENT_SECRET=… SECRET_KEY=… uvicorn fastapi_app:app
Адреса повернення: https://ваш-сайт/auth/gamecon/callback
"""
import os

from authlib.integrations.starlette_client import OAuth
from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse, RedirectResponse
from starlette.middleware.sessions import SessionMiddleware

BASE = os.environ.get("GAMECON_URL", "https://gamecon.online")

app = FastAPI()
app.add_middleware(SessionMiddleware, secret_key=os.environ["SECRET_KEY"], same_site="lax")

oauth = OAuth()
oauth.register(
    "gamecon",
    client_id=os.environ["GAMECON_CLIENT_ID"],
    client_secret=os.environ["GAMECON_CLIENT_SECRET"],
    authorize_url=f"{BASE}/oauth/authorize",
    access_token_url=f"{BASE}/oauth/token",
    userinfo_endpoint=f"{BASE}/api/developer/v1/userinfo",
    client_kwargs={"scope": "profile email", "code_challenge_method": "S256", "token_endpoint_auth_method": "client_secret_post"},
)


@app.get("/", response_class=HTMLResponse)
async def index(request: Request):
    user = request.session.get("user")
    if user:
        return f'Привіт, {user.get("name") or user["preferred_username"]}! <a href="/logout">Вийти</a>'
    return '<a href="/auth/gamecon">Увійти через GameCon</a>'


@app.get("/auth/gamecon")
async def login(request: Request):
    return await oauth.gamecon.authorize_redirect(request, request.url_for("callback"))


@app.get("/auth/gamecon/callback")
async def callback(request: Request):
    token = await oauth.gamecon.authorize_access_token(request)
    # Тут знайдіть або створіть користувача у своїй базі за userinfo["sub"].
    request.session["user"] = await oauth.gamecon.userinfo(token=token)
    return RedirectResponse("/")


@app.get("/logout")
async def logout(request: Request):
    request.session.pop("user", None)
    return RedirectResponse("/")
