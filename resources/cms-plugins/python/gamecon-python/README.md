# Увійти через GameCon — Python (Flask / FastAPI, Authlib)

```bash
pip install -r requirements.txt
export GAMECON_CLIENT_ID=… GAMECON_CLIENT_SECRET=… SECRET_KEY=…
flask --app flask_app run            # Flask
uvicorn fastapi_app:app --reload     # FastAPI
```

Адреса повернення для застосунку GameCon: `https://ваш-сайт/auth/gamecon/callback`.
Django: те саме через `authlib.integrations.django_client` (налаштування `oauth.register` ідентичні).
