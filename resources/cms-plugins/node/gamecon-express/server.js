// Express + Passport: «Увійти через GameCon» (OAuth 2.1, PKCE і state).
// GAMECON_CLIENT_ID=… GAMECON_CLIENT_SECRET=… SESSION_SECRET=… APP_URL=https://ваш-сайт npm start
import express from 'express';
import session from 'express-session';
import passport from 'passport';
import OAuth2Strategy from 'passport-oauth2';

const BASE = process.env.GAMECON_URL ?? 'https://gamecon.online';
const APP_URL = process.env.APP_URL ?? 'http://localhost:3000';

const strategy = new OAuth2Strategy(
  {
    authorizationURL: `${BASE}/oauth/authorize`,
    tokenURL: `${BASE}/oauth/token`,
    clientID: process.env.GAMECON_CLIENT_ID,
    clientSecret: process.env.GAMECON_CLIENT_SECRET,
    callbackURL: `${APP_URL}/auth/gamecon/callback`,
    scope: ['profile', 'email'],
    scopeSeparator: ' ',
    state: true,
    pkce: true,
  },
  async (accessToken, _refreshToken, _params, _profile, done) => {
    try {
      const res = await fetch(`${BASE}/api/developer/v1/userinfo`, { headers: { Authorization: `Bearer ${accessToken}` } });
      const me = await res.json();
      // Тут знайдіть або створіть користувача у своїй базі за me.sub.
      done(null, { id: me.sub, username: me.preferred_username, name: me.name, email: me.email, avatar: me.picture });
    } catch (err) {
      done(err);
    }
  },
);
passport.use('gamecon', strategy);
passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((user, done) => done(null, user));

const app = express();
app.use(session({ secret: process.env.SESSION_SECRET ?? 'change-me', resave: false, saveUninitialized: false, cookie: { sameSite: 'lax', secure: APP_URL.startsWith('https') } }));
app.use(passport.initialize());
app.use(passport.session());

app.get('/auth/gamecon', passport.authenticate('gamecon'));
app.get('/auth/gamecon/callback', passport.authenticate('gamecon', { failureRedirect: '/' }), (_req, res) => res.redirect('/'));
app.get('/', (req, res) => {
  res.send(req.user
    ? `Привіт, ${req.user.name || req.user.username}! <a href="/logout">Вийти</a>`
    : '<a href="/auth/gamecon">Увійти через GameCon</a>');
});
app.get('/logout', (req, res, next) => req.logout((err) => (err ? next(err) : res.redirect('/'))));

app.listen(3000, () => console.log(`GameCon login: ${APP_URL}`));
