import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { parseFile } from 'music-metadata';
import { db, q, tx, now } from './db.js';
import { fail, intParam, str, need, beforeParam, PAGE } from './http.js';
import { uploadAudio, uploadsDir } from './uploads.js';
import { trackJson, getTrack, getUser, userShort } from './models.js';
import { isStaff } from './auth.js';
import { censor } from './settings.js';

/** Music: personal libraries, uploads, playlists. Mounted inside the authenticated API router. */
export const music = express.Router();

const COVER_EXT = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif' };

/** Reads tags (title, artist, album, duration, embedded cover) from an uploaded audio file. */
async function readTags(file) {
  try {
    const meta = await parseFile(file.path, { duration: true, skipCovers: false });
    const pic = meta.common.picture?.[0];
    let cover = null;
    if (pic && COVER_EXT[pic.format]) {
      const name = crypto.randomBytes(16).toString('hex') + COVER_EXT[pic.format];
      fs.writeFileSync(path.join(uploadsDir, name), pic.data);
      cover = `/uploads/${name}`;
    }
    return {
      title: meta.common.title,
      artist: meta.common.artist || meta.common.albumartist,
      album: meta.common.album,
      duration: meta.format.duration ?? 0,
      cover,
    };
  } catch {
    return {};
  }
}

const baseName = (name) => name.replace(/\.[^.]+$/, '').replace(/[_]+/g, ' ').trim();

/** "Artist - Title.mp3" → { artist, title } when the file has no tags. */
function fromFileName(original) {
  const name = baseName(Buffer.from(original, 'latin1').toString('utf8'));
  const m = /^(.+?)\s+[-–—]\s+(.+)$/.exec(name);
  return m ? { artist: m[1], title: m[2] } : { artist: '', title: name };
}

const tracksOf = (rows, meId) => rows.map((t) => trackJson(t, meId));

// ───────── library ─────────

music.get('/music', (req, res) => {
  const me = req.user.id;
  const search = str(req.query.q, 100).toLowerCase();
  const section = req.query.section;
  const before = beforeParam(req);
  let rows;
  if (section === 'all' || search) {
    rows = search
      ? q(
          `SELECT * FROM tracks WHERE (ulower(title) LIKE ? OR ulower(artist) LIKE ? OR ulower(album) LIKE ?) AND id < ?
           ORDER BY plays DESC, id DESC LIMIT ${PAGE}`,
        ).all(`%${search}%`, `%${search}%`, `%${search}%`, before)
      : q(`SELECT * FROM tracks WHERE id < ? ORDER BY id DESC LIMIT ${PAGE}`).all(before);
  } else if (section === 'popular') {
    rows = q('SELECT * FROM tracks ORDER BY plays DESC, id DESC LIMIT 50').all();
  } else {
    const userId = intParam(req.query.userId) ?? me;
    // Library pagination uses the time a track was added.
    rows = q(
      `SELECT t.*, ut.added_at FROM user_tracks ut JOIN tracks t ON t.id = ut.track_id
       WHERE ut.user_id = ? AND ut.added_at < ? ORDER BY ut.added_at DESC LIMIT 200`,
    ).all(userId, intParam(req.query.before) ?? Number.MAX_SAFE_INTEGER);
  }
  res.json(tracksOf(rows, me));
});

music.post('/music', uploadAudio.array('audio', 10), async (req, res) => {
  need(req, 'can_upload', 'Загрузка файлов недоступна для вашего уровня');
  if (!req.files?.length) fail(400, 'Выберите аудиофайлы');
  const created = [];
  for (const file of req.files) {
    const tags = await readTags(file);
    const guess = fromFileName(file.originalname);
    const single = req.files.length === 1;
    const title = censor(str(single ? req.body.title : '', 200) || tags.title || guess.title || 'Без названия');
    const artist = censor(str(single ? req.body.artist : '', 200) || tags.artist || guess.artist || '');
    const t = now();
    const id = tx(() => {
      const r = q(
        'INSERT INTO tracks (owner_id, title, artist, album, duration, file, cover, size, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      ).run(req.user.id, title, artist, tags.album || '', tags.duration || 0, `/uploads/${file.filename}`, tags.cover, file.size, t);
      const trackId = Number(r.lastInsertRowid);
      q('INSERT INTO user_tracks (user_id, track_id, added_at) VALUES (?, ?, ?)').run(req.user.id, trackId, t);
      return trackId;
    });
    created.push(trackJson(getTrack(id), req.user.id));
  }
  res.status(201).json(created);
});

function ownTrack(req) {
  const t = getTrack(intParam(req.params.id));
  if (!t) fail(404, 'Аудиозапись не найдена');
  if (t.owner_id !== req.user.id && !isStaff(req.level)) fail(403, 'Можно изменять только свои аудиозаписи');
  return t;
}

music.patch('/music/:id', (req, res) => {
  const t = ownTrack(req);
  const title = req.body.title !== undefined ? censor(str(req.body.title, 200)) : t.title;
  if (!title) fail(400, 'Укажите название');
  const artist = req.body.artist !== undefined ? censor(str(req.body.artist, 200)) : t.artist;
  q('UPDATE tracks SET title = ?, artist = ? WHERE id = ?').run(title, artist, t.id);
  res.json(trackJson(getTrack(t.id), req.user.id));
});

music.delete('/music/:id', (req, res) => {
  const t = ownTrack(req);
  q('DELETE FROM tracks WHERE id = ?').run(t.id);
  for (const f of [t.file, t.cover]) {
    if (f?.startsWith('/uploads/')) fs.rm(path.join(uploadsDir, path.basename(f)), () => {});
  }
  res.json({ ok: true });
});

music.post('/music/:id/add', (req, res) => {
  const t = getTrack(intParam(req.params.id));
  if (!t) fail(404, 'Аудиозапись не найдена');
  q('INSERT OR IGNORE INTO user_tracks (user_id, track_id, added_at) VALUES (?, ?, ?)').run(req.user.id, t.id, now());
  res.json(trackJson(t, req.user.id));
});

music.delete('/music/:id/add', (req, res) => {
  const t = getTrack(intParam(req.params.id));
  if (!t) fail(404, 'Аудиозапись не найдена');
  q('DELETE FROM user_tracks WHERE user_id = ? AND track_id = ?').run(req.user.id, t.id);
  res.json(trackJson(t, req.user.id));
});

music.post('/music/:id/play', (req, res) => {
  q('UPDATE tracks SET plays = plays + 1 WHERE id = ?').run(intParam(req.params.id));
  res.json({ ok: true });
});

// ───────── playlists ─────────

function playlistJson(p, meId, withTracks = false) {
  const tracks = q(
    'SELECT t.* FROM playlist_tracks pt JOIN tracks t ON t.id = pt.track_id WHERE pt.playlist_id = ? ORDER BY pt.position',
  ).all(p.id);
  return {
    id: p.id,
    title: p.title,
    description: p.description,
    createdAt: p.created_at,
    owner: userShort(getUser(p.owner_id)),
    count: tracks.length,
    duration: Math.round(tracks.reduce((s, t) => s + t.duration, 0)),
    covers: tracks.map((t) => t.cover).filter(Boolean).slice(0, 4),
    tracks: withTracks ? tracksOf(tracks, meId) : undefined,
  };
}

function ownPlaylist(req) {
  const p = q('SELECT * FROM playlists WHERE id = ?').get(intParam(req.params.id));
  if (!p) fail(404, 'Плейлист не найден');
  if (p.owner_id !== req.user.id) fail(403, 'Это не ваш плейлист');
  return p;
}

music.get('/users/:id/playlists', (req, res) => {
  const rows = q('SELECT * FROM playlists WHERE owner_id = ? ORDER BY id DESC').all(intParam(req.params.id));
  res.json(rows.map((p) => playlistJson(p, req.user.id)));
});

music.post('/playlists', (req, res) => {
  const title = censor(str(req.body.title, 100));
  if (!title) fail(400, 'Укажите название плейлиста');
  const r = q('INSERT INTO playlists (owner_id, title, description, created_at) VALUES (?, ?, ?, ?)').run(
    req.user.id,
    title,
    censor(str(req.body.description, 500)),
    now(),
  );
  res.status(201).json(playlistJson(q('SELECT * FROM playlists WHERE id = ?').get(Number(r.lastInsertRowid)), req.user.id, true));
});

music.get('/playlists/:id', (req, res) => {
  const p = q('SELECT * FROM playlists WHERE id = ?').get(intParam(req.params.id));
  if (!p) fail(404, 'Плейлист не найден');
  res.json(playlistJson(p, req.user.id, true));
});

music.patch('/playlists/:id', (req, res) => {
  const p = ownPlaylist(req);
  const title = req.body.title !== undefined ? censor(str(req.body.title, 100)) : p.title;
  if (!title) fail(400, 'Укажите название плейлиста');
  q('UPDATE playlists SET title = ?, description = ? WHERE id = ?').run(
    title,
    req.body.description !== undefined ? censor(str(req.body.description, 500)) : p.description,
    p.id,
  );
  res.json(playlistJson(q('SELECT * FROM playlists WHERE id = ?').get(p.id), req.user.id, true));
});

music.delete('/playlists/:id', (req, res) => {
  const p = ownPlaylist(req);
  q('DELETE FROM playlists WHERE id = ?').run(p.id);
  res.json({ ok: true });
});

music.post('/playlists/:id/tracks', (req, res) => {
  const p = ownPlaylist(req);
  const t = getTrack(intParam(req.body.trackId));
  if (!t) fail(404, 'Аудиозапись не найдена');
  const pos = q('SELECT COALESCE(MAX(position), 0) + 1 AS n FROM playlist_tracks WHERE playlist_id = ?').get(p.id).n;
  q('INSERT OR IGNORE INTO playlist_tracks (playlist_id, track_id, position, added_at) VALUES (?, ?, ?, ?)').run(p.id, t.id, pos, now());
  res.json(playlistJson(p, req.user.id, true));
});

music.delete('/playlists/:id/tracks/:trackId', (req, res) => {
  const p = ownPlaylist(req);
  q('DELETE FROM playlist_tracks WHERE playlist_id = ? AND track_id = ?').run(p.id, intParam(req.params.trackId));
  res.json(playlistJson(p, req.user.id, true));
});

export const musicCount = (userId) => db.prepare('SELECT COUNT(*) AS c FROM user_tracks WHERE user_id = ?').get(userId).c;
