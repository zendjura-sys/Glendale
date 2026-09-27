import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';

process.env.DB_FILE = ':memory:';
process.env.UPLOADS_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'glendale-uploads-'));

// A tiny fake of the Spotify Accounts + Web API, so the OAuth and playback flows can be tested offline.
const calls = [];
const mock = http.createServer((req, res) => {
  let body = '';
  req.on('data', (c) => (body += c));
  req.on('end', () => {
    calls.push({ method: req.method, url: req.url, body });
    const json = (status, data) => {
      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(data === undefined ? '' : JSON.stringify(data));
    };
    const track = { id: 'track0000001', name: 'Song', type: 'track', uri: 'spotify:track:track0000001', duration_ms: 1000, artists: [{ id: 'artist000001', name: 'Band' }], album: { id: 'album0000001', name: 'LP', images: [] } };
    if (req.url === '/api/token') {
      const p = new URLSearchParams(body);
      const basic = req.headers.authorization === `Basic ${Buffer.from('abcdef0123456789abcdef0123456789:0123456789abcdef0123456789abcdef').toString('base64')}`;
      if (p.get('grant_type') === 'client_credentials' && basic) return json(200, { access_token: 'APP', expires_in: 3600 });
      if (p.get('grant_type') === 'authorization_code' && p.get('code') === 'good' && (p.get('code_verifier') || basic)) {
        return json(200, { access_token: 'AT', refresh_token: 'RT', expires_in: 3600 });
      }
      return json(400, { error: 'invalid_grant' });
    }
    // The app token (Client Credentials) may only read the catalog.
    if (req.headers.authorization === 'Bearer APP' && req.url.startsWith('/v1/search')) {
      return json(200, { tracks: { items: [track] }, artists: { items: [{ id: 'artist000001', name: 'Band', type: 'artist', images: [] }] } });
    }
    if (req.headers.authorization !== 'Bearer AT') return json(401, { error: { message: 'bad token' } });
    if (req.url === '/v1/me') return json(200, { id: 'spuser', display_name: 'Spotify User', product: 'premium', images: [] });
    if (req.url.startsWith('/v1/me/playlists')) return json(200, { items: [{ id: 'playlist0001', name: 'Mix', type: 'playlist', images: [], owner: { display_name: 'me' }, tracks: { total: 3 } }] });
    if (req.url.startsWith('/v1/me/player/currently-playing')) return json(200, { is_playing: true, item: track });
    if (req.url.startsWith('/v1/me/player/devices')) return json(200, { devices: [{ id: 'dev1', name: 'Laptop', type: 'Computer', is_active: true, volume_percent: 50 }] });
    if (req.url.startsWith('/v1/me/player/play')) return json(204);
    if (req.url.startsWith('/v1/me/player')) return json(200, { is_playing: true, progress_ms: 10, device: { id: 'dev1', name: 'Laptop', type: 'Computer', volume_percent: 50 }, item: track, shuffle_state: false, repeat_state: 'off' });
    if (req.url.startsWith('/v1/me/tracks')) return json(200, {});
    return json(404, { error: { message: 'not found' } });
  });
});
await new Promise((r) => mock.listen(0, r));
const mockBase = `http://localhost:${mock.address().port}`;
process.env.SPOTIFY_ACCOUNTS_URL = mockBase;
process.env.SPOTIFY_API_URL = `${mockBase}/v1`;

const { createApp } = await import('../src/index.js');
const { renderWav } = await import('../src/demoAudio.js');

let server;
let base;
before(async () => {
  server = http.createServer(createApp());
  await new Promise((r) => server.listen(0, r));
  base = `http://localhost:${server.address().port}/api`;
});
after(() => {
  server.closeAllConnections();
  server.close();
  mock.closeAllConnections();
  mock.close();
});

async function call(token, method, url, body) {
  const isForm = body instanceof FormData;
  const res = await fetch(base + url, {
    method,
    headers: { ...(token && { Authorization: `Bearer ${token}` }), ...(body && !isForm && { 'Content-Type': 'application/json' }) },
    body: body && (isForm ? body : JSON.stringify(body)),
  });
  return { status: res.status, body: await res.json() };
}
const register = async (name, email) =>
  (await call(null, 'POST', '/auth/register', { firstName: name, lastName: 'Тест', email, password: 'secret1' })).body;

test('music: upload with tags from file name, library, playlists, posts', async () => {
  const a = await register('Аня', 'a@m.dev');
  const b = await register('Богдан', 'b@m.dev');
  const { buffer } = renderWav({ chords: [[60, 64, 67]], bars: 1 });
  const fd = new FormData();
  fd.append('audio', new Blob([buffer], { type: 'audio/wav' }), 'Kalush - Stefania.wav');
  const up = await call(a.token, 'POST', '/music', fd);
  assert.equal(up.status, 201, JSON.stringify(up.body));
  const t = up.body[0];
  assert.equal(t.title, 'Stefania');
  assert.equal(t.artist, 'Kalush');
  assert.ok(t.duration > 1);
  assert.equal(t.added, true);

  // Streaming supports range requests (seeking).
  const range = await fetch(base.replace('/api', '') + t.url, { headers: { Range: 'bytes=0-99' } });
  assert.equal(range.status, 206);

  // Another member finds it and adds it to their library.
  const found = await call(b.token, 'GET', '/music?q=stef');
  assert.equal(found.body[0].id, t.id);
  assert.equal((await call(b.token, 'POST', `/music/${t.id}/add`)).body.added, true);
  assert.equal((await call(b.token, 'GET', '/music')).body.length, 1);

  const pl = (await call(b.token, 'POST', '/playlists', { title: 'Моє' })).body;
  const withTrack = (await call(b.token, 'POST', `/playlists/${pl.id}/tracks`, { trackId: t.id })).body;
  assert.equal(withTrack.count, 1);
  assert.equal((await call(a.token, 'POST', `/playlists/${pl.id}/tracks`, { trackId: t.id })).status, 403);

  // Attach to a post; only the owner may delete the track itself.
  const post = (await call(b.token, 'POST', '/posts', { audioId: t.id })).body;
  assert.equal(post.audio.id, t.id);
  const sp = (await call(b.token, 'POST', '/posts', { text: 'Слухайте https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC' })).body;
  assert.deepEqual(sp.spotify, { type: 'track', id: '4uLU6hMCjMI75M1A2tKUQC' });
  assert.equal((await call(b.token, 'DELETE', `/music/${t.id}`)).status, 403);
  assert.equal((await call(a.token, 'DELETE', `/music/${t.id}`)).status, 200);
});

test('spotify: PKCE connect, data, playback control, now playing', async () => {
  const boss = await register('Бос', 'boss@m.dev'); // not first user, so enable via existing superadmin
  const admin = (await call(null, 'POST', '/auth/login', { email: 'a@m.dev', password: 'secret1' })).body;
  assert.equal((await call(boss.token, 'GET', '/spotify')).body.enabled, false);
  assert.equal((await call(admin.token, 'PATCH', '/admin/settings', { spotifyClientId: 'abcdef0123456789abcdef0123456789' })).status, 200);
  assert.equal((await call(null, 'GET', '/config')).body.spotifyEnabled, true);

  const connect = await call(boss.token, 'POST', '/spotify/connect', { redirectUri: 'http://localhost:5173/spotify/callback' });
  const url = new URL(connect.body.url);
  assert.equal(url.searchParams.get('code_challenge_method'), 'S256');
  assert.ok(url.searchParams.get('scope').includes('streaming'));
  const state = url.searchParams.get('state');

  assert.equal((await call(boss.token, 'POST', '/spotify/callback', { code: 'bad', state })).status, 502);
  const again = new URL((await call(boss.token, 'POST', '/spotify/connect', { redirectUri: 'http://localhost:5173/spotify/callback' })).body.url);
  const ok = await call(boss.token, 'POST', '/spotify/callback', { code: 'good', state: again.searchParams.get('state') });
  assert.equal(ok.status, 200, JSON.stringify(ok.body));

  const status = (await call(boss.token, 'GET', '/spotify')).body;
  assert.equal(status.connected, true);
  assert.equal(status.profile.displayName, 'Spotify User');
  assert.equal(status.product, 'premium');

  assert.equal((await call(boss.token, 'GET', '/spotify/playlists')).body[0].name, 'Mix');
  const player = (await call(boss.token, 'GET', '/spotify/player')).body;
  assert.equal(player.device.name, 'Laptop');
  assert.equal(player.item.name, 'Song');

  assert.equal((await call(boss.token, 'POST', '/spotify/player/play', { uris: ['spotify:track:track0000001', 'javascript:alert(1)'], deviceId: 'dev1' })).status, 200);
  const playCall = calls.find((c) => c.url.startsWith('/v1/me/player/play'));
  assert.equal(playCall.url, '/v1/me/player/play?device_id=dev1');
  assert.deepEqual(JSON.parse(playCall.body), { uris: ['spotify:track:track0000001'] });

  assert.equal((await call(boss.token, 'PUT', '/spotify/saved/track0000001')).body.saved, true);
  assert.equal((await call(boss.token, 'GET', '/spotify/token')).body.accessToken, 'AT');

  // Friends see what you're listening to; hide it and it disappears.
  const other = await register('Віра', 'v@m.dev');
  assert.equal((await call(other.token, 'GET', `/users/${boss.user.id}/spotify-now`)).body.name, 'Song');
  await call(boss.token, 'PATCH', '/spotify', { showNowPlaying: false });
  const other2 = await register('Гліб', 'g@m.dev');
  assert.equal((await call(other2.token, 'GET', `/users/${boss.user.id}/spotify-now`)).body, null);

  assert.equal((await call(boss.token, 'DELETE', '/spotify')).status, 200);
  assert.equal((await call(boss.token, 'GET', '/spotify')).body.connected, false);
});

test('music: track metadata editor and cover', async () => {
  const owner = (await call(null, 'POST', '/auth/login', { email: 'a@m.dev', password: 'secret1' })).body;
  const other = (await call(null, 'POST', '/auth/login', { email: 'b@m.dev', password: 'secret1' })).body;
  const { buffer } = renderWav({ chords: [[60, 64, 67]], bars: 1 });
  const fd = new FormData();
  fd.append('audio', new Blob([buffer], { type: 'audio/wav' }), '40b74fc09897c7.wav');
  const t = (await call(owner.token, 'POST', '/music', fd)).body[0];
  assert.equal(t.title, '40b74fc09897c7');

  const edit = { title: 'Ой у лузі', artist: 'Гурт', album: 'Альбом', genre: 'Folk', year: 2024, trackNo: 3, lyrics: 'Ой у лузі червона калина' };
  const e = await call(owner.token, 'PATCH', `/music/${t.id}`, edit);
  assert.equal(e.status, 200, JSON.stringify(e.body));
  assert.deepEqual(
    { title: e.body.title, artist: e.body.artist, album: e.body.album, genre: e.body.genre, year: e.body.year, trackNo: e.body.trackNo, lyrics: e.body.lyrics },
    edit,
  );
  assert.equal((await call(owner.token, 'PATCH', `/music/${t.id}`, { year: 99999 })).body.year, null);
  assert.equal((await call(owner.token, 'PATCH', `/music/${t.id}`, { title: '' })).status, 400);
  assert.equal((await call(other.token, 'PATCH', `/music/${t.id}`, { title: 'x' })).status, 403);

  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
  const img = new FormData();
  img.append('image', new Blob([png], { type: 'image/png' }), 'c.png');
  const c = await call(owner.token, 'POST', `/music/${t.id}/cover`, img);
  assert.equal(c.status, 200, JSON.stringify(c.body));
  assert.match(c.body.cover, /^\/uploads\/.+\.png$/);
  assert.equal((await call(owner.token, 'DELETE', `/music/${t.id}/cover`)).body.cover, null);
});

test('spotify: client secret — hidden from admins, confidential connect, catalog without a connection', async () => {
  const admin = (await call(null, 'POST', '/auth/login', { email: 'a@m.dev', password: 'secret1' })).body;
  const guest = await register('Гість', 'guest@m.dev');
  const secret = '0123456789abcdef0123456789abcdef';
  await call(admin.token, 'PATCH', '/admin/settings', { spotifyClientId: 'abcdef0123456789abcdef0123456789', spotifyClientSecret: secret });
  const settings = (await call(admin.token, 'GET', '/admin/settings')).body;
  assert.equal(settings.spotifyClientSecret, '');
  assert.equal(settings.spotifyClientSecretSet, true);
  // Saving the form with the secret left empty keeps it.
  await call(admin.token, 'PATCH', '/admin/settings', { spotifyClientSecret: '' });
  assert.equal((await call(admin.token, 'GET', '/admin/settings')).body.spotifyClientSecretSet, true);
  const log = (await call(admin.token, 'GET', '/admin/log')).body;
  assert.ok(!JSON.stringify(log).includes(secret));

  // Members who haven't connected Spotify can still search the catalog (app token).
  assert.equal((await call(guest.token, 'GET', '/spotify')).body.catalog, true);
  const found = await call(guest.token, 'GET', '/spotify/search?q=song');
  assert.equal(found.status, 200, JSON.stringify(found.body));
  assert.deepEqual(found.body.map((i) => i.type), ['artist', 'track']);
  assert.match(calls.findLast((c) => c.url.startsWith('/v1/search')).url, /market=UA/);
  assert.equal((await call(guest.token, 'GET', '/spotify/playlists')).status, 400);

  // With a secret the connection uses the classic Authorization Code flow (no PKCE challenge).
  const url = new URL((await call(guest.token, 'POST', '/spotify/connect', { redirectUri: 'http://localhost:5173/spotify/callback' })).body.url);
  assert.equal(url.searchParams.get('code_challenge'), null);
  const ok = await call(guest.token, 'POST', '/spotify/callback', { code: 'good', state: url.searchParams.get('state') });
  assert.equal(ok.status, 200, JSON.stringify(ok.body));
  assert.equal((await call(guest.token, 'GET', '/spotify')).body.connected, true);

  await call(admin.token, 'PATCH', '/admin/settings', { spotifyClientSecret: null });
  assert.equal((await call(admin.token, 'GET', '/admin/settings')).body.spotifyClientSecretSet, false);
  assert.equal((await call(guest.token, 'GET', '/spotify')).body.catalog, false);
});
