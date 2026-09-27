import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';

process.env.DB_FILE = ':memory:';
process.env.UPLOADS_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'glendale-uploads-'));

// Fake Google OAuth endpoints: the code decides which profile comes back.
const PROFILES = {
  new: { email: 'Olena@Gmail.com', email_verified: true, given_name: 'Олена', family_name: 'Гугл' },
  existing: { email: 'first@g.dev', email_verified: true, given_name: 'X' },
  unverified: { email: 'u@g.dev', email_verified: false },
};
const mock = http.createServer((req, res) => {
  let body = '';
  req.on('data', (c) => (body += c));
  req.on('end', () => {
    const json = (status, data) => {
      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(data));
    };
    if (req.url === '/token') {
      const p = new URLSearchParams(body);
      if (p.get('client_secret') !== 'GOCSPX-secret-value' || !PROFILES[p.get('code')]) return json(400, { error: 'invalid_grant' });
      return json(200, { access_token: `tok-${p.get('code')}` });
    }
    if (req.url === '/userinfo') return json(200, PROFILES[(req.headers.authorization || '').replace('Bearer tok-', '')] ?? {});
    json(404, {});
  });
});
await new Promise((r) => mock.listen(0, r));
const mockBase = `http://localhost:${mock.address().port}`;
process.env.GOOGLE_AUTH_URL = `${mockBase}/auth`;
process.env.GOOGLE_TOKEN_URL = `${mockBase}/token`;
process.env.GOOGLE_USERINFO_URL = `${mockBase}/userinfo`;

const { createApp } = await import('../src/index.js');

let server;
let base;
before(async () => {
  server = http.createServer(createApp());
  await new Promise((r) => server.listen(0, r));
  base = `http://localhost:${server.address().port}`;
});
after(() => {
  server.closeAllConnections();
  server.close();
  mock.closeAllConnections();
  mock.close();
});

async function call(token, method, url, body) {
  const res = await fetch(`${base}/api${url}`, {
    method,
    headers: { ...(token && { Authorization: `Bearer ${token}` }), ...(body && { 'Content-Type': 'application/json' }) },
    body: body && JSON.stringify(body),
  });
  return { status: res.status, body: await res.json() };
}
const location = async (url) => (await fetch(base + url, { redirect: 'manual' })).headers.get('location');

/** Runs the whole browser round trip and returns where the site sends the member back to. */
async function signIn(code) {
  const toGoogle = new URL(await location('/api/auth/google/start'));
  assert.equal(toGoogle.origin + toGoogle.pathname, `${mockBase}/auth`);
  assert.equal(toGoogle.searchParams.get('redirect_uri'), `${base}/api/auth/google/callback`);
  return location(`/api/auth/google/callback?code=${code}&state=${toGoogle.searchParams.get('state')}`);
}

test('google: disabled until configured, then signs in and registers by verified email', async () => {
  const admin = (await call(null, 'POST', '/auth/register', { firstName: 'А', lastName: 'Б', email: 'first@g.dev', password: 'secret1' })).body;
  assert.equal((await call(null, 'GET', '/config')).body.googleEnabled, false);
  assert.equal(await location('/api/auth/google/start'), '/login?google_error=disabled');

  // Invalid values are ignored; valid ones enable the button.
  await call(admin.token, 'PATCH', '/admin/settings', { googleClientId: 'not-a-client-id', googleClientSecret: 'GOCSPX-secret-value' });
  assert.equal((await call(null, 'GET', '/config')).body.googleEnabled, false);
  await call(admin.token, 'PATCH', '/admin/settings', { googleClientId: '1234567890-abcdef.apps.googleusercontent.com' });
  assert.equal((await call(null, 'GET', '/config')).body.googleEnabled, true);
  assert.equal((await call(admin.token, 'GET', '/admin/settings')).body.googleClientSecret, '');

  // A new Google account registers (email normalised) and gets a session through a one-time code.
  const back = await signIn('new');
  const code = new URL(back, base).searchParams.get('google');
  assert.ok(code, back);
  const done = await call(null, 'POST', '/auth/google/finish', { code });
  assert.equal(done.status, 200);
  assert.equal(done.body.user.email, 'olena@gmail.com');
  assert.equal(done.body.user.firstName, 'Олена');
  assert.equal(done.body.user.hasPassword, false);
  assert.equal((await call(null, 'POST', '/auth/google/finish', { code })).status, 400); // single use

  // Without a password of their own, they may set one without the "current" password.
  assert.equal((await call(done.body.token, 'POST', '/me/password', { current: '', next: 'newpass1' })).status, 200);
  assert.equal((await call(null, 'POST', '/auth/login', { email: 'olena@gmail.com', password: 'newpass1' })).status, 200);

  // An existing member with the same email signs in to their own account.
  const again = new URL(await signIn('existing'), base).searchParams.get('google');
  assert.equal((await call(null, 'POST', '/auth/google/finish', { code: again })).body.user.id, admin.user.id);

  assert.equal(await signIn('unverified'), '/login?google_error=email');
  assert.equal(await location('/api/auth/google/callback?code=new&state=forged'), '/login?google_error=expired');
  assert.equal(await location('/api/auth/google/callback?error=access_denied&state=x'), '/login?google_error=cancelled');
});

test('google: signup rules still apply', async () => {
  const admin = (await call(null, 'POST', '/auth/login', { email: 'first@g.dev', password: 'secret1' })).body;
  await call(admin.token, 'PATCH', '/admin/settings', { signupMode: 'closed' });
  PROFILES.closed = { email: 'late@g.dev', email_verified: true };
  assert.equal(await signIn('closed'), '/login?google_error=signup_closed');
  await call(admin.token, 'PATCH', '/admin/settings', { signupMode: 'approval' });
  assert.equal(await signIn('closed'), '/login?google_error=pending');
});
