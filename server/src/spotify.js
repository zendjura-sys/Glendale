import express from 'express';
import crypto from 'node:crypto';
import { q, now } from './db.js';
import { fail, intParam, str } from './http.js';
import { getSetting } from './settings.js';

/**
 * Spotify integration. The admin sets the Client ID (and, optionally, the Client Secret) in the admin panel;
 * every member can connect their own account.
 * - Client ID only: Authorization Code with PKCE.
 * - With the secret: classic Authorization Code (confidential client) plus an app token (Client Credentials),
 *   so the catalog (search, albums, artists, public playlists) works even for members who haven't connected.
 */
export const spotify = express.Router();

const ACCOUNTS = () => process.env.SPOTIFY_ACCOUNTS_URL || 'https://accounts.spotify.com';
const API = () => process.env.SPOTIFY_API_URL || 'https://api.spotify.com/v1';
const SCOPES = [
  'user-read-private',
  'user-read-email',
  'streaming',
  'user-read-playback-state',
  'user-modify-playback-state',
  'user-read-currently-playing',
  'user-read-recently-played',
  'user-top-read',
  'user-library-read',
  'user-library-modify',
  'playlist-read-private',
  'playlist-read-collaborative',
  'playlist-modify-private',
  'playlist-modify-public',
  'user-follow-read',
].join(' ');


const clientId = () => String(getSetting('spotifyClientId') || '').trim();
const clientSecret = () => String(getSetting('spotifyClientSecret') || '').trim();
const enabled = () => !!clientId();
/** The catalog is available without a personal connection only when the app has a secret. */
const catalogEnabled = () => enabled() && !!clientSecret();

/** state → PKCE verifier for sign-ins in progress (10 minutes). */
const pending = new Map();
const b64url = (buf) => buf.toString('base64url');

async function tokenRequest(params) {
  const secret = clientSecret();
  const res = await fetch(`${ACCOUNTS()}/api/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      // Confidential client: authenticate with the secret. Otherwise (PKCE) the client_id goes in the body.
      ...(secret && { Authorization: `Basic ${Buffer.from(`${clientId()}:${secret}`).toString('base64')}` }),
    },
    body: new URLSearchParams(secret ? params : { client_id: clientId(), ...params }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) fail(502, 'Spotify отклонил запрос: {reason}', undefined, { reason: data.error_description || data.error || res.status });
  return data;
}

async function accessToken(userId) {
  const acc = q('SELECT * FROM spotify_accounts WHERE user_id = ?').get(userId);
  if (!acc) return null;
  if (acc.expires_at - 60_000 > now()) return acc.access_token;
  const t = await tokenRequest({ grant_type: 'refresh_token', refresh_token: acc.refresh_token });
  q('UPDATE spotify_accounts SET access_token = ?, refresh_token = ?, expires_at = ? WHERE user_id = ?').run(
    t.access_token,
    t.refresh_token || acc.refresh_token,
    now() + t.expires_in * 1000,
    userId,
  );
  return t.access_token;
}

/** App-level token (Client Credentials) for catalog requests, cached until shortly before it expires. */
let appTokenCache = null;
async function appToken() {
  if (!catalogEnabled()) return null;
  const key = `${clientId()}:${clientSecret()}`;
  if (appTokenCache?.key === key && appTokenCache.expiresAt - 60_000 > now()) return appTokenCache.token;
  const t = await tokenRequest({ grant_type: 'client_credentials' });
  appTokenCache = { key, token: t.access_token, expiresAt: now() + t.expires_in * 1000 };
  return t.access_token;
}

const connectedUser = (userId) => !!q('SELECT 1 FROM spotify_accounts WHERE user_id = ?').get(userId);
/** Market for catalog requests: the member's own account when connected, otherwise the admin's setting. */
const market = (userId) => (connectedUser(userId) ? 'from_token' : String(getSetting('spotifyMarket') || 'UA'));

/**
 * Calls the Spotify Web API on behalf of a member. Returns null for empty responses (204, e.g. nothing playing).
 * `catalog: true` falls back to the app token for members who haven't connected Spotify.
 */
async function sp(userId, path, { method = 'GET', body, catalog = false } = {}) {
  if (!enabled()) fail(400, 'Интеграция со Spotify не настроена администратором');
  const userToken = await accessToken(userId);
  const token = userToken ?? (catalog ? await appToken() : null);
  if (!token) fail(400, 'Подключите Spotify в разделе «Музыка»');
  const res = await fetch(`${API()}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...(body !== undefined && { 'Content-Type': 'application/json' }) },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (res.status === 204 || res.status === 202) return null;
  const text = await res.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = {};
  }
  if (res.status === 401) {
    if (!userToken) {
      appTokenCache = null;
      fail(502, 'Ошибка Spotify: {reason}', undefined, { reason: data.error?.message || res.status });
    }
    q('DELETE FROM spotify_accounts WHERE user_id = ?').run(userId);
    fail(400, 'Доступ к Spotify отозван — подключите аккаунт заново');
  }
  if (res.status === 403 && /premium/i.test(data.error?.message || data.error?.reason || '')) {
    fail(403, 'Управление воспроизведением доступно только с Spotify Premium', 'premium_required');
  }
  if (res.status === 404 && path.startsWith('/me/player')) fail(404, 'Нет активного устройства Spotify — откройте Spotify или выберите устройство', 'no_device');
  if (!res.ok) fail(502, 'Ошибка Spotify: {reason}', undefined, { reason: data.error?.message || res.status });
  return data;
}

const image = (images) => images?.[1]?.url || images?.[0]?.url || null;

/** Compact representation of Spotify objects for the client. */
function item(o) {
  if (!o) return null;
  const type = o.type;
  return {
    type,
    id: o.id,
    name: o.name,
    subtitle:
      type === 'track'
        ? o.artists?.map((a) => a.name).join(', ')
        : type === 'album'
          ? o.artists?.map((a) => a.name).join(', ')
          : type === 'playlist'
            ? `${o.owner?.display_name ?? ''}${o.tracks?.total != null ? ` · ${o.tracks.total}` : ''}`
            : '',
    image: type === 'track' ? image(o.album?.images) : image(o.images),
    url: o.external_urls?.spotify ?? `https://open.spotify.com/${type}/${o.id}`,
    uri: o.uri ?? `spotify:${type}:${o.id}`,
    durationMs: o.duration_ms,
    artists: o.artists?.map((a) => ({ id: a.id, name: a.name })),
    album: type === 'track' && o.album ? { id: o.album.id, name: o.album.name } : undefined,
    explicit: o.explicit,
  };
}

const idParam = (v) => (/^[A-Za-z0-9]{10,40}$/.test(v || '') ? v : fail(400, 'Некорректный идентификатор Spotify'));

spotify.get('/spotify', (req, res) => {
  const acc = q('SELECT * FROM spotify_accounts WHERE user_id = ?').get(req.user.id);
  res.json({
    enabled: enabled(),
    connected: !!acc,
    catalog: catalogEnabled(),
    profile: acc ? { spotifyId: acc.spotify_id, displayName: acc.display_name, avatar: acc.avatar } : null,
    showNowPlaying: acc ? !!acc.show_now_playing : true,
    product: acc?.product ?? null,
  });
});

/** Short-lived access token for the Web Playback SDK running in the member's browser. */
spotify.get('/spotify/token', async (req, res) => {
  if (!enabled()) fail(400, 'Интеграция со Spotify не настроена администратором');
  const token = await accessToken(req.user.id);
  if (!token) fail(400, 'Подключите Spotify');
  const acc = q('SELECT expires_at FROM spotify_accounts WHERE user_id = ?').get(req.user.id);
  res.json({ accessToken: token, expiresAt: acc.expires_at });
});

spotify.post('/spotify/connect', (req, res) => {
  if (!enabled()) fail(400, 'Интеграция со Spotify не настроена администратором');
  const redirectUri = str(req.body.redirectUri, 300);
  if (!/^https?:\/\/[^/]+\/spotify\/callback$/.test(redirectUri)) fail(400, 'Некорректный адрес возврата');
  const verifier = b64url(crypto.randomBytes(48));
  const challenge = b64url(crypto.createHash('sha256').update(verifier).digest());
  const state = b64url(crypto.randomBytes(16));
  for (const [k, v] of pending) if (v.at < now() - 10 * 60_000) pending.delete(k);
  pending.set(state, { userId: req.user.id, verifier: clientSecret() ? null : verifier, redirectUri, at: now() });
  const url = new URL(`${ACCOUNTS()}/authorize`);
  url.search = new URLSearchParams({
    client_id: clientId(),
    response_type: 'code',
    redirect_uri: redirectUri,
    ...(!clientSecret() && { code_challenge_method: 'S256', code_challenge: challenge }),
    scope: SCOPES,
    state,
  }).toString();
  res.json({ url: url.toString() });
});

spotify.post('/spotify/callback', async (req, res) => {
  const flow = pending.get(str(req.body.state, 100));
  if (!flow || flow.userId !== req.user.id) fail(400, 'Сессия подключения устарела — попробуйте ещё раз');
  pending.delete(str(req.body.state, 100));
  const t = await tokenRequest({
    grant_type: 'authorization_code',
    code: str(req.body.code, 1000),
    redirect_uri: flow.redirectUri,
    ...(flow.verifier && { code_verifier: flow.verifier }),
  });
  const meRes = await fetch(`${API()}/me`, { headers: { Authorization: `Bearer ${t.access_token}` } });
  const me = await meRes.json().catch(() => ({}));
  if (!meRes.ok) fail(502, 'Не удалось получить профиль Spotify');
  q('DELETE FROM spotify_accounts WHERE spotify_id = ? AND user_id != ?').run(me.id, req.user.id);
  q(
    `INSERT INTO spotify_accounts (user_id, spotify_id, display_name, avatar, access_token, refresh_token, expires_at, connected_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET spotify_id = excluded.spotify_id, display_name = excluded.display_name,
       avatar = excluded.avatar, access_token = excluded.access_token, refresh_token = excluded.refresh_token,
       expires_at = excluded.expires_at`,
  ).run(req.user.id, me.id, me.display_name || me.id, image(me.images), t.access_token, t.refresh_token, now() + t.expires_in * 1000, now());
  q('UPDATE spotify_accounts SET product = ? WHERE user_id = ?').run(me.product || 'free', req.user.id);
  res.json({ ok: true });
});

spotify.patch('/spotify', (req, res) => {
  q('UPDATE spotify_accounts SET show_now_playing = ? WHERE user_id = ?').run(req.body.showNowPlaying ? 1 : 0, req.user.id);
  res.json({ ok: true });
});

spotify.delete('/spotify', (req, res) => {
  q('DELETE FROM spotify_accounts WHERE user_id = ?').run(req.user.id);
  res.json({ ok: true });
});

spotify.get('/spotify/playlists', async (req, res) => {
  const data = await sp(req.user.id, '/me/playlists?limit=30');
  res.json((data?.items ?? []).filter(Boolean).map(item));
});

const RANGES = ['short_term', 'medium_term', 'long_term'];
spotify.get('/spotify/top', async (req, res) => {
  const range = RANGES.includes(req.query.range) ? req.query.range : 'medium_term';
  const kind = req.query.kind === 'artists' ? 'artists' : 'tracks';
  const data = await sp(req.user.id, `/me/top/${kind}?limit=20&time_range=${range}`);
  res.json((data?.items ?? []).map(item));
});

// ───────── library ─────────

spotify.get('/spotify/saved', async (req, res) => {
  const offset = Math.max(0, Number(req.query.offset) || 0);
  const data = await sp(req.user.id, `/me/tracks?limit=50&offset=${offset}`);
  res.json({ items: (data?.items ?? []).map((i) => item(i.track)), total: data?.total ?? 0, next: data?.next ? offset + 50 : null });
});

spotify.get('/spotify/saved/contains', async (req, res) => {
  const ids = String(req.query.ids || '').split(',').filter((id) => /^[A-Za-z0-9]{10,40}$/.test(id)).slice(0, 50);
  if (!ids.length) return res.json({});
  const data = await sp(req.user.id, `/me/tracks/contains?ids=${ids.join(',')}`);
  res.json(Object.fromEntries(ids.map((id, i) => [id, !!data?.[i]])));
});

spotify.put('/spotify/saved/:id', async (req, res) => {
  await sp(req.user.id, `/me/tracks?ids=${idParam(req.params.id)}`, { method: 'PUT', body: {} });
  res.json({ saved: true });
});

spotify.delete('/spotify/saved/:id', async (req, res) => {
  await sp(req.user.id, `/me/tracks?ids=${idParam(req.params.id)}`, { method: 'DELETE', body: {} });
  res.json({ saved: false });
});

// ───────── browsing ─────────

spotify.get('/spotify/playlists/:id', async (req, res) => {
  const id = idParam(req.params.id);
  const p = await sp(req.user.id, `/playlists/${id}?fields=id,name,description,uri,type,images,owner(display_name),tracks.total,external_urls`, { catalog: true });
  const tracks = await sp(
    req.user.id,
    `/playlists/${id}/tracks?limit=100&fields=items(track(id,name,uri,type,duration_ms,explicit,external_urls,artists(id,name),album(id,name,images)))`,
    { catalog: true },
  );
  res.json({ ...item(p), description: p.description, tracks: (tracks?.items ?? []).map((i) => item(i.track)).filter((t) => t?.id) });
});

spotify.get('/spotify/albums/:id', async (req, res) => {
  const a = await sp(req.user.id, `/albums/${idParam(req.params.id)}?market=${market(req.user.id)}`, { catalog: true });
  res.json({
    ...item(a),
    releaseDate: a.release_date,
    tracks: (a.tracks?.items ?? []).map((t) => item({ ...t, album: { id: a.id, name: a.name, images: a.images } })),
  });
});

spotify.get('/spotify/artists/:id', async (req, res) => {
  const id = idParam(req.params.id);
  const [a, top, albums] = await Promise.all([
    sp(req.user.id, `/artists/${id}`, { catalog: true }),
    sp(req.user.id, `/artists/${id}/top-tracks?market=${market(req.user.id)}`, { catalog: true }),
    sp(req.user.id, `/artists/${id}/albums?include_groups=album,single&limit=20`, { catalog: true }),
  ]);
  res.json({
    ...item(a),
    followers: a.followers?.total ?? 0,
    genres: a.genres ?? [],
    topTracks: (top?.tracks ?? []).map(item),
    albums: (albums?.items ?? []).map(item),
  });
});

spotify.post('/spotify/playlists', async (req, res) => {
  const name = str(req.body.name, 100);
  if (!name) fail(400, 'Укажите название плейлиста');
  const acc = q('SELECT spotify_id FROM spotify_accounts WHERE user_id = ?').get(req.user.id);
  if (!acc) fail(400, 'Подключите Spotify');
  const p = await sp(req.user.id, `/users/${encodeURIComponent(acc.spotify_id)}/playlists`, {
    method: 'POST',
    body: { name, description: str(req.body.description, 300), public: false },
  });
  res.status(201).json(item(p));
});

spotify.post('/spotify/playlists/:id/tracks', async (req, res) => {
  const uris = (Array.isArray(req.body.uris) ? req.body.uris : []).filter((u) => /^spotify:(track|episode):[A-Za-z0-9]{10,40}$/.test(u)).slice(0, 100);
  if (!uris.length) fail(400, 'Нет треков для добавления');
  await sp(req.user.id, `/playlists/${idParam(req.params.id)}/tracks`, { method: 'POST', body: { uris } });
  res.json({ ok: true });
});

// ───────── playback (Spotify Connect) ─────────

spotify.get('/spotify/player', async (req, res) => {
  const [state, devices] = await Promise.all([sp(req.user.id, '/me/player?additional_types=episode'), sp(req.user.id, '/me/player/devices')]);
  res.json({
    isPlaying: !!state?.is_playing,
    progressMs: state?.progress_ms ?? 0,
    shuffle: !!state?.shuffle_state,
    repeat: state?.repeat_state ?? 'off',
    volume: state?.device?.volume_percent ?? null,
    device: state?.device ? { id: state.device.id, name: state.device.name, type: state.device.type } : null,
    item: item(state?.item),
    devices: (devices?.devices ?? []).map((d) => ({ id: d.id, name: d.name, type: d.type, active: d.is_active, volume: d.volume_percent })),
  });
});

const deviceQuery = (req) => (typeof req.body?.deviceId === 'string' && req.body.deviceId ? `?device_id=${encodeURIComponent(req.body.deviceId)}` : '');
const URI_RE = /^spotify:(track|episode|album|playlist|artist|show):[A-Za-z0-9]{10,40}$/;

spotify.post('/spotify/player/:action', async (req, res) => {
  const u = req.user.id;
  const dq = deviceQuery(req);
  const sep = dq ? '&' : '?';
  switch (req.params.action) {
    case 'play': {
      const body = {};
      if (URI_RE.test(req.body.contextUri || '')) body.context_uri = req.body.contextUri;
      if (Array.isArray(req.body.uris)) body.uris = req.body.uris.filter((x) => URI_RE.test(x)).slice(0, 100);
      if (req.body.offsetUri && URI_RE.test(req.body.offsetUri)) body.offset = { uri: req.body.offsetUri };
      await sp(u, `/me/player/play${dq}`, { method: 'PUT', body });
      break;
    }
    case 'pause':
      await sp(u, `/me/player/pause${dq}`, { method: 'PUT' });
      break;
    case 'next':
      await sp(u, `/me/player/next${dq}`, { method: 'POST' });
      break;
    case 'previous':
      await sp(u, `/me/player/previous${dq}`, { method: 'POST' });
      break;
    case 'seek':
      await sp(u, `/me/player/seek?position_ms=${Math.max(0, Math.round(Number(req.body.positionMs) || 0))}${dq.replace('?', '&')}`, { method: 'PUT' });
      break;
    case 'volume':
      await sp(u, `/me/player/volume?volume_percent=${Math.max(0, Math.min(100, Math.round(Number(req.body.volume) || 0)))}${dq.replace('?', '&')}`, { method: 'PUT' });
      break;
    case 'shuffle':
      await sp(u, `/me/player/shuffle?state=${req.body.state ? 'true' : 'false'}${dq.replace('?', '&')}`, { method: 'PUT' });
      break;
    case 'repeat': {
      const state = ['off', 'context', 'track'].includes(req.body.state) ? req.body.state : 'off';
      await sp(u, `/me/player/repeat?state=${state}${dq.replace('?', '&')}`, { method: 'PUT' });
      break;
    }
    case 'queue':
      if (!URI_RE.test(req.body.uri || '')) fail(400, 'Некорректный трек');
      await sp(u, `/me/player/queue?uri=${encodeURIComponent(req.body.uri)}${sep === '&' ? dq.replace('?', '&') : ''}`, { method: 'POST' });
      break;
    case 'transfer':
      if (typeof req.body.deviceId !== 'string' || !req.body.deviceId) fail(400, 'Выберите устройство');
      await sp(u, '/me/player', { method: 'PUT', body: { device_ids: [req.body.deviceId], play: !!req.body.play } });
      break;
    default:
      fail(404, 'Неизвестное действие');
  }
  res.json({ ok: true });
});

spotify.get('/spotify/recent', async (req, res) => {
  const data = await sp(req.user.id, '/me/player/recently-played?limit=20');
  const seen = new Set();
  res.json(
    (data?.items ?? [])
      .map((i) => item(i.track))
      .filter((t) => t && !seen.has(t.id) && seen.add(t.id)),
  );
});

spotify.get('/spotify/search', async (req, res) => {
  const text = str(req.query.q, 100);
  if (!text) return res.json([]);
  const data = await sp(req.user.id, `/search?type=track,album,artist,playlist&limit=8&market=${market(req.user.id)}&q=${encodeURIComponent(text)}`, {
    catalog: true,
  });
  res.json(
    [...(data?.artists?.items ?? []).slice(0, 3), ...(data?.tracks?.items ?? []), ...(data?.albums?.items ?? []), ...(data?.playlists?.items ?? [])]
      .filter(Boolean)
      .map(item),
  );
});

/** What a member is listening to right now (shown on their profile if they allow it). */
const nowCache = new Map();
spotify.get('/users/:id/spotify-now', async (req, res) => {
  const userId = intParam(req.params.id);
  const acc = enabled() && q('SELECT show_now_playing FROM spotify_accounts WHERE user_id = ?').get(userId);
  if (!acc || !acc.show_now_playing) return res.json(null);
  const hit = nowCache.get(userId);
  if (hit && hit.at > now() - 20_000) return res.json(hit.value);
  let value = null;
  try {
    const data = await sp(userId, '/me/player/currently-playing');
    if (data?.item && data.is_playing) value = item(data.item);
  } catch {
    value = null;
  }
  nowCache.set(userId, { value, at: now() });
  res.json(value);
});
