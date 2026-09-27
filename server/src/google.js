import express from 'express';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { q, now } from './db.js';
import { fail, str } from './http.js';
import { getSetting } from './settings.js';
import { createSession, clientIp, insertUser, assertCanLogin, hashPassword } from './auth.js';
import { meFull } from './models.js';
import { uploadsDir } from './uploads.js';

/**
 * "Sign in with Google" (OAuth 2.0 Authorization Code, confidential client).
 * The admin sets the Client ID and Secret in the admin panel. A Google account signs in to the member with the
 * same (verified) email, or registers a new member under the site's signup rules.
 *
 * Flow: /auth/google/start → Google → /auth/google/callback → /login?google=<one-time code>
 *       → the page exchanges the code for a session with POST /auth/google/finish.
 * The session token never appears in a URL.
 */
export const google = express.Router();

const AUTH_URL = () => process.env.GOOGLE_AUTH_URL || 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = () => process.env.GOOGLE_TOKEN_URL || 'https://oauth2.googleapis.com/token';
const USERINFO_URL = () => process.env.GOOGLE_USERINFO_URL || 'https://openidconnect.googleapis.com/v1/userinfo';

const clientId = () => String(getSetting('googleClientId') || '').trim();
const clientSecret = () => String(getSetting('googleClientSecret') || '').trim();
const enabled = () => !!(clientId() && clientSecret());

const TTL = 10 * 60_000;
/** state → { at } for sign-ins in progress; one-time code → { userId, at } for finishing them. */
const states = new Map();
const codes = new Map();
const sweep = (map) => {
  for (const [k, v] of map) if (v.at < now() - TTL) map.delete(k);
};
const random = () => crypto.randomBytes(24).toString('base64url');

const redirectUri = (req) => `${req.protocol}://${req.get('host')}/api/auth/google/callback`;

google.get('/auth/google/start', (req, res) => {
  if (!enabled()) return res.redirect('/login?google_error=disabled');
  sweep(states);
  const state = random();
  states.set(state, { at: now() });
  const url = new URL(AUTH_URL());
  url.search = new URLSearchParams({
    client_id: clientId(),
    redirect_uri: redirectUri(req),
    response_type: 'code',
    scope: 'openid email profile',
    state,
    prompt: 'select_account',
  }).toString();
  res.redirect(url.toString());
});

/** Saves the Google profile photo as the new member's avatar (best effort). */
async function savePicture(url) {
  if (!/^https:\/\/[\w.-]+\.googleusercontent\.com\//.test(url || '')) return null;
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(5000) });
    const type = r.headers.get('content-type') || '';
    const ext = type.includes('png') ? '.png' : type.includes('webp') ? '.webp' : type.includes('jpeg') || type.includes('jpg') ? '.jpg' : null;
    if (!r.ok || !ext) return null;
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length > 5 * 1024 * 1024) return null;
    const name = crypto.randomBytes(16).toString('hex') + ext;
    fs.writeFileSync(path.join(uploadsDir, name), buf);
    return `/uploads/${name}`;
  } catch {
    return null;
  }
}

google.get('/auth/google/callback', async (req, res) => {
  const back = (error) => res.redirect(`/login?google_error=${encodeURIComponent(error)}`);
  if (req.query.error) return back(req.query.error === 'access_denied' ? 'cancelled' : 'failed');
  const state = str(req.query.state, 100);
  if (!states.has(state)) return back('expired');
  states.delete(state);
  if (!enabled()) return back('disabled');

  try {
    const tokenRes = await fetch(TOKEN_URL(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code: str(req.query.code, 2000),
        client_id: clientId(),
        client_secret: clientSecret(),
        redirect_uri: redirectUri(req),
        grant_type: 'authorization_code',
      }),
    });
    const token = await tokenRes.json().catch(() => ({}));
    if (!tokenRes.ok || !token.access_token) return back('failed');

    // The profile comes straight from Google over TLS, so no local JWT verification is needed.
    const infoRes = await fetch(USERINFO_URL(), { headers: { Authorization: `Bearer ${token.access_token}` } });
    const info = await infoRes.json().catch(() => ({}));
    const email = String(info.email || '').toLowerCase();
    if (!infoRes.ok || !email || info.email_verified === false || info.email_verified === 'false') return back('email');

    const ip = clientIp(req);
    let user = q('SELECT * FROM users WHERE email = ?').get(email);
    if (!user) {
      const firstName = str(info.given_name, 50) || str(info.name, 50) || email.split('@')[0].slice(0, 50);
      const lastName = str(info.family_name, 50) || '—';
      // Random password: the member signs in with Google and may set a password in Settings without the old one.
      user = insertUser({
        firstName,
        lastName,
        email,
        passwordHash: hashPassword(random()),
        hasPassword: false,
        ip,
        avatar: await savePicture(info.picture),
      });
    }
    assertCanLogin(user, ip);

    sweep(codes);
    const code = random();
    codes.set(code, { userId: user.id, at: now() });
    res.redirect(`/login?google=${code}`);
  } catch (e) {
    back(e.code || 'failed');
  }
});

google.post('/auth/google/finish', (req, res) => {
  const code = str(req.body?.code, 100);
  const entry = codes.get(code);
  codes.delete(code);
  if (!entry || entry.at < now() - TTL) fail(400, 'Не удалось войти через Google');
  const user = q('SELECT * FROM users WHERE id = ?').get(entry.userId);
  if (!user) fail(400, 'Не удалось войти через Google');
  res.json({ token: createSession(user.id), user: meFull(user) });
});
