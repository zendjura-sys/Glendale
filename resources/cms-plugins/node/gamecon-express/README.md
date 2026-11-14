# Увійти через GameCon — Node.js (Express + Passport)

```bash
npm install
GAMECON_CLIENT_ID=… GAMECON_CLIENT_SECRET=… SESSION_SECRET=… APP_URL=https://ваш-сайт npm start
```

Адреса повернення для застосунку GameCon: `https://ваш-сайт/auth/gamecon/callback`.
Стратегія `gamecon` — у `server.js`; перенесіть її у свій застосунок.
