import express from 'express';
import { q, tx, now } from './db.js';
import { hashPassword, verifyPassword, createSession, requireAuth, levelOf, isStaff, clientIp } from './auth.js';
import { fail, intParam, str, PAGE, beforeParam, page, errorHandler, need } from './http.js';
import { getSetting, publicConfig, isEmailBanned, isIpBanned, censor } from './settings.js';
import { upload, fileUrl } from './uploads.js';
import { music, musicCount } from './music.js';
import { spotify } from './spotify.js';
import { chats } from './chats.js';
import { send } from './realtime.js';
import {
  userShort,
  userFull,
  groupShort,
  getUser,
  getGroup,
  areFriends,
  friendshipStatus,
  isGroupAdmin,
  hydratePosts,
  hydrateComment,
  hydrateMessage,
  hydrateNotification,
  notify,
  counters,
  pushCounters,
  meFull,
  trackJson,
  getTrack,
  spotifyRef,
} from './models.js';

export const api = express.Router();

/** Flood control: minimum pause between posts for the member's level. */
function checkFlood(req) {
  const seconds = req.level.flood_seconds;
  if (!seconds) return;
  const last = q('SELECT created_at FROM posts WHERE author_id = ? ORDER BY id DESC LIMIT 1').get(req.user.id);
  if (last && now() - last.created_at < seconds * 1000) fail(429, `Подождите ${seconds} сек. перед следующей публикацией`);
}

// ───────────────────────────── public ─────────────────────────────

api.get('/config', (_req, res) => res.json(publicConfig()));

// ───────────────────────────── auth ─────────────────────────────

api.post('/auth/register', (req, res) => {
  const firstName = str(req.body.firstName, 50);
  const lastName = str(req.body.lastName, 50);
  const email = str(req.body.email, 120).toLowerCase();
  const password = typeof req.body.password === 'string' ? req.body.password : '';
  if (!firstName || !lastName) fail(400, 'Укажите имя и фамилию');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail(400, 'Некорректный email');
  if (password.length < 6) fail(400, 'Пароль должен быть не короче 6 символов');
  if (q('SELECT 1 FROM users WHERE email = ?').get(email)) fail(409, 'Пользователь с таким email уже существует');

  const mode = getSetting('signupMode');
  if (mode === 'closed') fail(403, 'Регистрация временно закрыта');
  if (getSetting('maintenance')) fail(503, getSetting('maintenanceMessage'), 'maintenance');
  const ip = clientIp(req);
  if (isEmailBanned(email) || isIpBanned(ip)) fail(403, 'Регистрация с этим адресом запрещена');

  // The very first account of a fresh installation becomes the superadmin.
  const hasSuperadmin = q("SELECT 1 FROM users u JOIN levels l ON l.id = u.level_id WHERE l.type = 'superadmin'").get();
  const levelId = hasSuperadmin
    ? q('SELECT id FROM levels WHERE is_default = 1').get().id
    : q("SELECT id FROM levels WHERE type = 'superadmin'").get().id;
  const approved = mode === 'approval' && hasSuperadmin ? 0 : 1;

  const t = now();
  const r = q(
    `INSERT INTO users (first_name, last_name, email, password_hash, level_id, approved, signup_ip, last_ip, created_at, last_seen)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(firstName, lastName, email, hashPassword(password), levelId, approved, ip, ip, t, t);
  const user = getUser(Number(r.lastInsertRowid));
  if (!approved) return res.status(202).json({ pending: true, message: 'Заявка на регистрацию отправлена. Вы сможете войти после одобрения администратором.' });
  res.status(201).json({ token: createSession(user.id), user: meFull(user) });
});

api.post('/auth/login', (req, res) => {
  const email = str(req.body.email, 120).toLowerCase();
  const password = typeof req.body.password === 'string' ? req.body.password : '';
  const user = q('SELECT * FROM users WHERE email = ?').get(email);
  if (!user) fail(401, 'Неверный email или пароль');

  // Temporary lock after repeated failed attempts (anti brute force).
  if (user.locked_until > now()) {
    const minutes = Math.ceil((user.locked_until - now()) / 60000);
    fail(429, `Слишком много неудачных попыток. Попробуйте через ${minutes} мин.`);
  }
  if (!verifyPassword(password, user.password_hash)) {
    const attempts = user.failed_logins + 1;
    const limit = getSetting('lockAttempts');
    const lock = limit > 0 && attempts >= limit;
    q('UPDATE users SET failed_logins = ?, locked_until = ? WHERE id = ?').run(
      lock ? 0 : attempts,
      lock ? now() + getSetting('lockMinutes') * 60000 : 0,
      user.id,
    );
    fail(401, 'Неверный email или пароль');
  }
  if (!user.enabled) fail(403, 'Аккаунт заблокирован администрацией', 'banned');
  if (!user.approved) fail(403, 'Аккаунт ожидает одобрения администратором', 'pending');
  const staff = isStaff(levelOf(user));
  const ip = clientIp(req);
  if (!staff && isIpBanned(ip)) fail(403, 'Доступ с вашего адреса ограничен', 'banned');
  if (!staff && getSetting('maintenance')) fail(503, getSetting('maintenanceMessage'), 'maintenance');

  q('UPDATE users SET failed_logins = 0, locked_until = 0, last_ip = ? WHERE id = ?').run(ip, user.id);
  res.json({ token: createSession(user.id), user: meFull(user) });
});

api.use(requireAuth);
api.use(music);
api.use(spotify);
api.use(chats);

api.post('/auth/logout', (req, res) => {
  q('DELETE FROM sessions WHERE token = ?').run(req.token);
  res.json({ ok: true });
});

// ───────────────────────────── me / users ─────────────────────────────

api.get('/me', (req, res) => {
  res.json({ user: meFull(req.user), counters: counters(req.user.id) });
});

api.get('/counters', (req, res) => res.json(counters(req.user.id)));

api.patch('/me', (req, res) => {
  const fields = { firstName: 'first_name', lastName: 'last_name', status: 'status', bio: 'bio', city: 'city', birthday: 'birthday' };
  const limits = { firstName: 50, lastName: 50, status: 140, bio: 1000, city: 80, birthday: 10 };
  for (const [key, col] of Object.entries(fields)) {
    if (req.body[key] === undefined) continue;
    const value = str(req.body[key], limits[key]);
    if ((key === 'firstName' || key === 'lastName') && !value) fail(400, 'Имя и фамилия не могут быть пустыми');
    if (key === 'birthday' && value && !/^\d{4}-\d{2}-\d{2}$/.test(value)) fail(400, 'Некорректная дата рождения');
    q(`UPDATE users SET ${col} = ? WHERE id = ?`).run(value, req.user.id);
  }
  res.json(meFull(getUser(req.user.id)));
});

api.post('/me/password', (req, res) => {
  const current = typeof req.body.current === 'string' ? req.body.current : '';
  const next = typeof req.body.next === 'string' ? req.body.next : '';
  if (!verifyPassword(current, req.user.password_hash)) fail(400, 'Неверный текущий пароль');
  if (next.length < 6) fail(400, 'Пароль должен быть не короче 6 символов');
  tx(() => {
    q('UPDATE users SET password_hash = ? WHERE id = ?').run(hashPassword(next), req.user.id);
    // Sign out every other session.
    q('DELETE FROM sessions WHERE user_id = ? AND token != ?').run(req.user.id, req.token);
  });
  res.json({ ok: true });
});

api.post('/me/avatar', upload.single('image'), (req, res) => {
  need(req, 'can_upload', 'Загрузка фотографий недоступна для вашего уровня');
  if (!req.file) fail(400, 'Файл не выбран');
  const url = fileUrl(req.file);
  tx(() => {
    q('UPDATE users SET avatar = ? WHERE id = ?').run(url, req.user.id);
    q("INSERT INTO photos (user_id, url, album, created_at) VALUES (?, ?, 'profile', ?)").run(req.user.id, url, now());
  });
  res.json(meFull(getUser(req.user.id)));
});

api.post('/me/cover', upload.single('image'), (req, res) => {
  need(req, 'can_upload', 'Загрузка фотографий недоступна для вашего уровня');
  if (!req.file) fail(400, 'Файл не выбран');
  q('UPDATE users SET cover = ? WHERE id = ?').run(fileUrl(req.file), req.user.id);
  res.json(meFull(getUser(req.user.id)));
});

api.get('/users/:id', (req, res) => {
  const u = getUser(intParam(req.params.id));
  if (!u) fail(404, 'Пользователь не найден');
  const me = req.user.id;
  const friendsSample = q(
    'SELECT u.* FROM friends f JOIN users u ON u.id = f.friend_id WHERE f.user_id = ? ORDER BY RANDOM() LIMIT 6',
  ).all(u.id);
  const mutual = q(
    `SELECT COUNT(*) AS c FROM friends a JOIN friends b ON a.friend_id = b.friend_id
     WHERE a.user_id = ? AND b.user_id = ?`,
  ).get(me, u.id).c;
  const photosSample = q('SELECT id, url FROM photos WHERE user_id = ? ORDER BY id DESC LIMIT 4').all(u.id);
  const groupsSample = q(
    'SELECT g.* FROM group_members m JOIN groups g ON g.id = m.group_id WHERE m.user_id = ? ORDER BY m.created_at DESC LIMIT 5',
  ).all(u.id);

  res.json({
    ...userFull(u),
    friendship: friendshipStatus(me, u.id),
    counts: {
      friends: q('SELECT COUNT(*) AS c FROM friends WHERE user_id = ?').get(u.id).c,
      followers: q('SELECT COUNT(*) AS c FROM friend_requests WHERE to_id = ?').get(u.id).c,
      photos: q('SELECT COUNT(*) AS c FROM photos WHERE user_id = ?').get(u.id).c,
      groups: q('SELECT COUNT(*) AS c FROM group_members WHERE user_id = ?').get(u.id).c,
      posts: q("SELECT COUNT(*) AS c FROM posts WHERE owner_type = 'user' AND owner_id = ?").get(u.id).c,
      music: musicCount(u.id),
      mutual: u.id === me ? 0 : mutual,
    },
    friendsSample: friendsSample.map(userShort),
    photosSample,
    groupsSample: groupsSample.map((g) => groupShort(g, me)),
  });
});

api.get('/users/:id/friends', (req, res) => {
  const id = intParam(req.params.id);
  const filter = req.query.filter;
  let rows = q(
    `SELECT u.* FROM friends f JOIN users u ON u.id = f.friend_id WHERE f.user_id = ?
     ORDER BY u.last_seen DESC`,
  ).all(id);
  if (filter === 'mutual') {
    const mine = new Set(q('SELECT friend_id FROM friends WHERE user_id = ?').all(req.user.id).map((r) => r.friend_id));
    rows = rows.filter((u) => mine.has(u.id));
  }
  let items = rows.map(userShort);
  if (filter === 'online') items = items.filter((u) => u.online);
  res.json(items);
});

api.get('/users/:id/groups', (req, res) => {
  const rows = q(
    'SELECT g.* FROM group_members m JOIN groups g ON g.id = m.group_id WHERE m.user_id = ? ORDER BY m.created_at DESC',
  ).all(intParam(req.params.id));
  res.json(rows.map((g) => groupShort(g, req.user.id)));
});

// ───────────────────────────── friends ─────────────────────────────

api.get('/friends/requests', (req, res) => {
  const me = req.user.id;
  const incoming = q(
    'SELECT u.* FROM friend_requests r JOIN users u ON u.id = r.from_id WHERE r.to_id = ? ORDER BY r.created_at DESC',
  ).all(me);
  const outgoing = q(
    'SELECT u.* FROM friend_requests r JOIN users u ON u.id = r.to_id WHERE r.from_id = ? ORDER BY r.created_at DESC',
  ).all(me);
  res.json({ incoming: incoming.map(userShort), outgoing: outgoing.map(userShort) });
});

api.get('/friends/suggestions', (req, res) => {
  const me = req.user.id;
  // Friends of friends first, then everyone else.
  const rows = q(
    `SELECT u.*, (
        SELECT COUNT(*) FROM friends a JOIN friends b ON a.friend_id = b.friend_id
        WHERE a.user_id = ? AND b.user_id = u.id
     ) AS mutual
     FROM users u
     WHERE u.id != ?
       AND u.id NOT IN (SELECT friend_id FROM friends WHERE user_id = ?)
       AND u.id NOT IN (SELECT to_id FROM friend_requests WHERE from_id = ?)
       AND u.id NOT IN (SELECT from_id FROM friend_requests WHERE to_id = ?)
     ORDER BY mutual DESC, u.last_seen DESC LIMIT 20`,
  ).all(me, me, me, me, me);
  res.json(rows.map((u) => ({ ...userShort(u), mutual: u.mutual })));
});

api.post('/friends/:id', (req, res) => {
  const me = req.user.id;
  const other = intParam(req.params.id);
  if (!getUser(other) || other === me) fail(404, 'Пользователь не найден');
  const status = friendshipStatus(me, other);
  const t = now();
  if (status === 'incoming') {
    tx(() => {
      q('DELETE FROM friend_requests WHERE from_id = ? AND to_id = ?').run(other, me);
      q('INSERT OR IGNORE INTO friends (user_id, friend_id, created_at) VALUES (?, ?, ?)').run(me, other, t);
      q('INSERT OR IGNORE INTO friends (user_id, friend_id, created_at) VALUES (?, ?, ?)').run(other, me, t);
    });
    notify(other, me, 'friend_accept');
    pushCounters(me);
  } else if (status === 'none') {
    q('INSERT INTO friend_requests (from_id, to_id, created_at) VALUES (?, ?, ?)').run(me, other, t);
    notify(other, me, 'friend_request');
    pushCounters(other);
  }
  res.json({ friendship: friendshipStatus(me, other) });
});

api.delete('/friends/:id', (req, res) => {
  const me = req.user.id;
  const other = intParam(req.params.id);
  const status = friendshipStatus(me, other);
  tx(() => {
    if (status === 'friends') {
      q('DELETE FROM friends WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)').run(me, other, other, me);
      // As in VK, the removed friend stays as a follower (their request to you).
      q('INSERT OR IGNORE INTO friend_requests (from_id, to_id, created_at) VALUES (?, ?, ?)').run(other, me, now());
    } else {
      q('DELETE FROM friend_requests WHERE (from_id = ? AND to_id = ?) OR (from_id = ? AND to_id = ?)').run(me, other, other, me);
    }
  });
  pushCounters(me);
  pushCounters(other);
  res.json({ friendship: friendshipStatus(me, other) });
});

// ───────────────────────────── posts ─────────────────────────────

function wallQuery(ownerType, ownerId, before) {
  return q(
    `SELECT * FROM posts WHERE owner_type = ? AND owner_id = ? AND id < ? ORDER BY id DESC LIMIT ${PAGE}`,
  ).all(ownerType, ownerId, before);
}

api.get('/wall/:type/:id', (req, res) => {
  const type = req.params.type === 'group' ? 'group' : 'user';
  const rows = wallQuery(type, intParam(req.params.id), beforeParam(req));
  res.json(page(hydratePosts(rows, req.user.id)));
});

api.get('/feed', (req, res) => {
  const me = req.user.id;
  const before = beforeParam(req);
  let rows;
  if (req.query.tab === 'popular') {
    // "Рекомендации": all public posts, not only from friends and communities.
    rows = q(`SELECT * FROM posts WHERE id < ? ORDER BY id DESC LIMIT ${PAGE}`).all(before);
  } else {
    rows = q(
      `SELECT * FROM posts WHERE id < ? AND (
         (owner_type = 'user' AND (owner_id = ? OR owner_id IN (SELECT friend_id FROM friends WHERE user_id = ?)
                                    OR owner_id IN (SELECT to_id FROM friend_requests WHERE from_id = ?)))
         OR (owner_type = 'group' AND owner_id IN (SELECT group_id FROM group_members WHERE user_id = ?))
       ) ORDER BY id DESC LIMIT ${PAGE}`,
    ).all(before, me, me, me, me);
  }
  res.json(page(hydratePosts(rows, me)));
});

api.get('/posts/:id', (req, res) => {
  const p = q('SELECT * FROM posts WHERE id = ?').get(intParam(req.params.id));
  if (!p) fail(404, 'Запись не найдена');
  res.json(hydratePosts([p], req.user.id)[0]);
});

api.post('/posts', upload.single('image'), (req, res) => {
  const me = req.user.id;
  need(req, 'can_post', 'Публикация записей недоступна для вашего уровня');
  if (req.file) need(req, 'can_upload', 'Загрузка фотографий недоступна для вашего уровня');
  checkFlood(req);
  const text = censor(str(req.body.text, 10000));
  const image = fileUrl(req.file);
  const audioId = intParam(req.body.audioId);
  if (audioId && !getTrack(audioId)) fail(404, 'Аудиозапись не найдена');
  const spotify = spotifyRef(str(req.body.spotify, 300)) ? str(req.body.spotify, 300) : '';
  if (!text && !image && !audioId && !spotify) fail(400, 'Запись не может быть пустой');
  const ownerType = req.body.ownerType === 'group' ? 'group' : 'user';
  const ownerId = intParam(req.body.ownerId) ?? me;
  let fromGroup = 0;

  if (ownerType === 'user') {
    if (!getUser(ownerId)) fail(404, 'Пользователь не найден');
    if (ownerId !== me && getSetting('wallForFriendsOnly') && !areFriends(me, ownerId)) fail(403, 'Писать на стене могут только друзья');
  } else {
    if (!getGroup(ownerId)) fail(404, 'Сообщество не найдено');
    if (!isGroupAdmin(ownerId, me)) fail(403, 'Публиковать записи могут только администраторы сообщества');
    fromGroup = 1;
  }

  const t = now();
  const r = q(
    'INSERT INTO posts (author_id, owner_type, owner_id, from_group, text, image, audio_id, spotify, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
  ).run(me, ownerType, ownerId, fromGroup, text, image, audioId, spotify, t);
  const postId = Number(r.lastInsertRowid);
  if (image) q("INSERT INTO photos (user_id, url, album, created_at) VALUES (?, ?, 'wall', ?)").run(me, image, t);
  if (ownerType === 'user' && ownerId !== me) notify(ownerId, me, 'wall_post', { postId, text: text.slice(0, 120) });

  const post = q('SELECT * FROM posts WHERE id = ?').get(postId);
  res.status(201).json(hydratePosts([post], me)[0]);
});

api.delete('/posts/:id', (req, res) => {
  const p = q('SELECT * FROM posts WHERE id = ?').get(intParam(req.params.id));
  if (!p) fail(404, 'Запись не найдена');
  if (!hydratePosts([p], req.user.id)[0].canDelete) fail(403, 'Нет прав на удаление');
  q('DELETE FROM posts WHERE id = ?').run(p.id);
  res.json({ ok: true });
});

function postOr404(id) {
  const p = q('SELECT * FROM posts WHERE id = ?').get(intParam(id));
  if (!p) fail(404, 'Запись не найдена');
  return p;
}

api.post('/posts/:id/like', (req, res) => {
  const p = postOr404(req.params.id);
  const r = q('INSERT OR IGNORE INTO likes (post_id, user_id, created_at) VALUES (?, ?, ?)').run(p.id, req.user.id, now());
  if (r.changes) notify(p.author_id, req.user.id, 'like', { postId: p.id });
  res.json(hydratePosts([p], req.user.id)[0]);
});

api.delete('/posts/:id/like', (req, res) => {
  const p = postOr404(req.params.id);
  q('DELETE FROM likes WHERE post_id = ? AND user_id = ?').run(p.id, req.user.id);
  res.json(hydratePosts([p], req.user.id)[0]);
});

api.get('/posts/:id/likes', (req, res) => {
  const p = postOr404(req.params.id);
  const rows = q('SELECT u.* FROM likes l JOIN users u ON u.id = l.user_id WHERE l.post_id = ? ORDER BY l.created_at DESC LIMIT 100').all(p.id);
  res.json(rows.map(userShort));
});

api.post('/posts/:id/repost', (req, res) => {
  const me = req.user.id;
  let p = postOr404(req.params.id);
  // Reposting a repost shares the original, like VK does.
  if (p.repost_of) p = q('SELECT * FROM posts WHERE id = ?').get(p.repost_of) ?? p;
  if (q('SELECT 1 FROM posts WHERE repost_of = ? AND author_id = ?').get(p.id, me)) fail(409, 'Вы уже поделились этой записью');
  need(req, 'can_post', 'Публикация записей недоступна для вашего уровня');
  const text = censor(str(req.body?.text, 2000));
  const r = q(
    "INSERT INTO posts (author_id, owner_type, owner_id, text, repost_of, created_at) VALUES (?, 'user', ?, ?, ?, ?)",
  ).run(me, me, text, p.id, now());
  notify(p.author_id, me, 'repost', { postId: p.id });
  const created = q('SELECT * FROM posts WHERE id = ?').get(Number(r.lastInsertRowid));
  res.status(201).json(hydratePosts([created], me)[0]);
});

api.get('/posts/:id/comments', (req, res) => {
  const p = postOr404(req.params.id);
  const rows = q('SELECT * FROM comments WHERE post_id = ? ORDER BY id ASC LIMIT 500').all(p.id);
  res.json(rows.map(hydrateComment));
});

api.post('/posts/:id/comments', (req, res) => {
  const p = postOr404(req.params.id);
  need(req, 'can_comment', 'Комментирование недоступно для вашего уровня');
  const text = censor(str(req.body.text, 4000));
  if (!text) fail(400, 'Комментарий не может быть пустым');
  const r = q('INSERT INTO comments (post_id, author_id, text, created_at) VALUES (?, ?, ?, ?)').run(p.id, req.user.id, text, now());
  notify(p.author_id, req.user.id, 'comment', { postId: p.id, text: text.slice(0, 120) });
  res.status(201).json(hydrateComment(q('SELECT * FROM comments WHERE id = ?').get(Number(r.lastInsertRowid))));
});

api.delete('/comments/:id', (req, res) => {
  const c = q('SELECT * FROM comments WHERE id = ?').get(intParam(req.params.id));
  if (!c) fail(404, 'Комментарий не найден');
  const p = q('SELECT * FROM posts WHERE id = ?').get(c.post_id);
  const allowed = c.author_id === req.user.id || hydratePosts([p], req.user.id)[0].canDelete;
  if (!allowed) fail(403, 'Нет прав на удаление');
  q('DELETE FROM comments WHERE id = ?').run(c.id);
  res.json({ ok: true });
});

// ───────────────────────────── messages ─────────────────────────────

api.get('/dialogs', (req, res) => {
  const me = req.user.id;
  const rows = q(
    `SELECT m.* FROM messages m
     JOIN (
       SELECT MAX(id) AS id FROM messages WHERE from_id = ? OR to_id = ?
       GROUP BY CASE WHEN from_id = ? THEN to_id ELSE from_id END
     ) last ON last.id = m.id
     ORDER BY m.id DESC`,
  ).all(me, me, me);
  res.json(
    rows.map((m) => {
      const peerId = m.from_id === me ? m.to_id : m.from_id;
      return {
        peer: userShort(getUser(peerId)),
        lastMessage: hydrateMessage(m),
        unread: q('SELECT COUNT(*) AS c FROM messages WHERE from_id = ? AND to_id = ? AND is_read = 0').get(peerId, me).c,
      };
    }),
  );
});

api.get('/messages/:peerId', (req, res) => {
  const me = req.user.id;
  const peer = intParam(req.params.peerId);
  const rows = q(
    `SELECT * FROM messages WHERE ((from_id = ? AND to_id = ?) OR (from_id = ? AND to_id = ?)) AND id < ?
     ORDER BY id DESC LIMIT 50`,
  ).all(me, peer, peer, me, beforeParam(req));
  res.json({ items: rows.map(hydrateMessage).reverse(), hasMore: rows.length === 50 });
});

api.post('/messages/:peerId', upload.single('image'), (req, res) => {
  const me = req.user.id;
  const peer = intParam(req.params.peerId);
  if (!getUser(peer)) fail(404, 'Пользователь не найден');
  need(req, 'can_message', 'Отправка сообщений недоступна для вашего уровня');
  if (req.file) need(req, 'can_upload', 'Загрузка фотографий недоступна для вашего уровня');
  const text = censor(str(req.body.text, 4000));
  const image = fileUrl(req.file);
  const audioId = intParam(req.body.audioId);
  if (audioId && !getTrack(audioId)) fail(404, 'Аудиозапись не найдена');
  if (!text && !image && !audioId) fail(400, 'Сообщение не может быть пустым');
  const r = q('INSERT INTO messages (from_id, to_id, text, image, audio_id, is_read, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
    me,
    peer,
    text,
    image,
    audioId,
    peer === me ? 1 : 0,
    now(),
  );
  const msg = hydrateMessage(q('SELECT * FROM messages WHERE id = ?').get(Number(r.lastInsertRowid)));
  const sender = userShort(req.user);
  send(peer, 'message', { message: msg, peer: sender });
  if (peer !== me) {
    send(me, 'message', { message: msg, peer: userShort(getUser(peer)) });
    pushCounters(peer);
  }
  res.status(201).json(msg);
});

api.post('/messages/:peerId/read', (req, res) => {
  const me = req.user.id;
  const peer = intParam(req.params.peerId);
  const r = q('UPDATE messages SET is_read = 1 WHERE from_id = ? AND to_id = ? AND is_read = 0').run(peer, me);
  if (r.changes) {
    send(peer, 'read', { peerId: me });
    pushCounters(me);
  }
  res.json({ ok: true });
});

api.delete('/messages/item/:id', (req, res) => {
  const m = q('SELECT * FROM messages WHERE id = ?').get(intParam(req.params.id));
  if (!m || m.from_id !== req.user.id) fail(404, 'Сообщение не найдено');
  q('DELETE FROM messages WHERE id = ?').run(m.id);
  send(m.to_id, 'message_deleted', { id: m.id, peerId: m.from_id });
  send(m.from_id, 'message_deleted', { id: m.id, peerId: m.to_id });
  pushCounters(m.to_id);
  res.json({ ok: true });
});

// ───────────────────────────── groups ─────────────────────────────

api.get('/groups', (req, res) => {
  const search = str(req.query.q, 100);
  const rows = search
    ? q('SELECT * FROM groups WHERE ulower(name) LIKE ? ORDER BY id DESC LIMIT 50').all(`%${search.toLowerCase()}%`)
    : q(
        `SELECT g.* FROM groups g LEFT JOIN group_members m ON m.group_id = g.id
         GROUP BY g.id ORDER BY COUNT(m.user_id) DESC LIMIT 50`,
      ).all();
  res.json(rows.map((g) => groupShort(g, req.user.id)));
});

api.post('/groups', (req, res) => {
  need(req, 'can_create_groups', 'Создание сообществ недоступно для вашего уровня');
  const name = censor(str(req.body.name, 100));
  if (!name) fail(400, 'Укажите название сообщества');
  const description = censor(str(req.body.description, 2000));
  const t = now();
  const id = tx(() => {
    const r = q('INSERT INTO groups (name, description, owner_id, created_at) VALUES (?, ?, ?, ?)').run(name, description, req.user.id, t);
    const gid = Number(r.lastInsertRowid);
    q("INSERT INTO group_members (group_id, user_id, role, created_at) VALUES (?, ?, 'admin', ?)").run(gid, req.user.id, t);
    return gid;
  });
  res.status(201).json(groupShort(getGroup(id), req.user.id));
});

api.get('/groups/:id', (req, res) => {
  const g = getGroup(intParam(req.params.id));
  if (!g) fail(404, 'Сообщество не найдено');
  const membersSample = q(
    'SELECT u.* FROM group_members m JOIN users u ON u.id = m.user_id WHERE m.group_id = ? ORDER BY RANDOM() LIMIT 6',
  ).all(g.id);
  const admins = q(
    "SELECT u.* FROM group_members m JOIN users u ON u.id = m.user_id WHERE m.group_id = ? AND m.role = 'admin'",
  ).all(g.id);
  const friendsInGroup = q(
    `SELECT COUNT(*) AS c FROM group_members m JOIN friends f ON f.friend_id = m.user_id
     WHERE m.group_id = ? AND f.user_id = ?`,
  ).get(g.id, req.user.id).c;
  res.json({
    ...groupShort(g, req.user.id),
    membersSample: membersSample.map(userShort),
    admins: admins.map(userShort),
    friendsInGroup,
  });
});

api.patch('/groups/:id', (req, res) => {
  const g = getGroup(intParam(req.params.id));
  if (!g) fail(404, 'Сообщество не найдено');
  if (!isGroupAdmin(g.id, req.user.id)) fail(403, 'Нет прав');
  if (req.body.name !== undefined) {
    const name = str(req.body.name, 100);
    if (!name) fail(400, 'Укажите название сообщества');
    q('UPDATE groups SET name = ? WHERE id = ?').run(name, g.id);
  }
  if (req.body.description !== undefined) q('UPDATE groups SET description = ? WHERE id = ?').run(str(req.body.description, 2000), g.id);
  res.json(groupShort(getGroup(g.id), req.user.id));
});

for (const col of ['avatar', 'cover']) {
  api.post(`/groups/:id/${col}`, upload.single('image'), (req, res) => {
    const g = getGroup(intParam(req.params.id));
    if (!g) fail(404, 'Сообщество не найдено');
    if (!isGroupAdmin(g.id, req.user.id)) fail(403, 'Нет прав');
    if (!req.file) fail(400, 'Файл не выбран');
    q(`UPDATE groups SET ${col} = ? WHERE id = ?`).run(fileUrl(req.file), g.id);
    res.json(groupShort(getGroup(g.id), req.user.id));
  });
}

api.delete('/groups/:id', (req, res) => {
  const g = getGroup(intParam(req.params.id));
  if (!g) fail(404, 'Сообщество не найдено');
  if (g.owner_id !== req.user.id) fail(403, 'Удалить сообщество может только владелец');
  tx(() => {
    q("DELETE FROM posts WHERE owner_type = 'group' AND owner_id = ?").run(g.id);
    q('DELETE FROM groups WHERE id = ?').run(g.id);
  });
  res.json({ ok: true });
});

api.post('/groups/:id/join', (req, res) => {
  const g = getGroup(intParam(req.params.id));
  if (!g) fail(404, 'Сообщество не найдено');
  q("INSERT OR IGNORE INTO group_members (group_id, user_id, role, created_at) VALUES (?, ?, 'member', ?)").run(g.id, req.user.id, now());
  res.json(groupShort(g, req.user.id));
});

api.delete('/groups/:id/join', (req, res) => {
  const g = getGroup(intParam(req.params.id));
  if (!g) fail(404, 'Сообщество не найдено');
  if (g.owner_id === req.user.id) fail(400, 'Владелец не может покинуть сообщество');
  q('DELETE FROM group_members WHERE group_id = ? AND user_id = ?').run(g.id, req.user.id);
  res.json(groupShort(g, req.user.id));
});

api.get('/groups/:id/members', (req, res) => {
  const rows = q(
    'SELECT u.*, m.role FROM group_members m JOIN users u ON u.id = m.user_id WHERE m.group_id = ? ORDER BY m.role, u.first_name LIMIT 500',
  ).all(intParam(req.params.id));
  res.json(rows.map((u) => ({ ...userShort(u), role: u.role })));
});

// ───────────────────────────── photos ─────────────────────────────

api.get('/users/:id/photos', (req, res) => {
  const rows = q(`SELECT * FROM photos WHERE user_id = ? AND id < ? ORDER BY id DESC LIMIT ${PAGE}`).all(
    intParam(req.params.id),
    beforeParam(req),
  );
  res.json(page(rows.map((p) => ({ id: p.id, url: p.url, album: p.album, createdAt: p.created_at }))));
});

api.post('/photos', upload.array('images', 10), (req, res) => {
  need(req, 'can_upload', 'Загрузка фотографий недоступна для вашего уровня');
  if (!req.files?.length) fail(400, 'Файлы не выбраны');
  const t = now();
  const ids = tx(() =>
    req.files.map((f) => Number(q('INSERT INTO photos (user_id, url, created_at) VALUES (?, ?, ?)').run(req.user.id, fileUrl(f), t).lastInsertRowid)),
  );
  res.status(201).json(ids.map((id) => {
    const p = q('SELECT * FROM photos WHERE id = ?').get(id);
    return { id: p.id, url: p.url, album: p.album, createdAt: p.created_at };
  }));
});

api.delete('/photos/:id', (req, res) => {
  const p = q('SELECT * FROM photos WHERE id = ?').get(intParam(req.params.id));
  if (!p || p.user_id !== req.user.id) fail(404, 'Фотография не найдена');
  q('DELETE FROM photos WHERE id = ?').run(p.id);
  res.json({ ok: true });
});

// ───────────────────────────── notifications ─────────────────────────────

api.get('/notifications', (req, res) => {
  const rows = q(`SELECT * FROM notifications WHERE user_id = ? AND id < ? ORDER BY id DESC LIMIT ${PAGE}`).all(
    req.user.id,
    beforeParam(req),
  );
  res.json(page(rows.map(hydrateNotification)));
});

api.post('/notifications/read', (req, res) => {
  q('UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0').run(req.user.id);
  pushCounters(req.user.id);
  res.json({ ok: true });
});

// ───────────────────────────── search ─────────────────────────────

api.get('/search', (req, res) => {
  const search = str(req.query.q, 100);
  if (!search) return res.json({ users: [], groups: [], posts: [], tracks: [] });
  const like = `%${search.toLowerCase()}%`;
  const users = q(
    `SELECT * FROM users WHERE ulower(first_name || ' ' || last_name) LIKE ? OR ulower(last_name || ' ' || first_name) LIKE ?
       OR ulower(city) LIKE ?
     ORDER BY last_seen DESC LIMIT 30`,
  ).all(like, like, like);
  const groups = q('SELECT * FROM groups WHERE ulower(name) LIKE ? OR ulower(description) LIKE ? LIMIT 20').all(like, like);
  const posts = q('SELECT * FROM posts WHERE ulower(text) LIKE ? ORDER BY id DESC LIMIT 20').all(like);
  const tracks = q('SELECT * FROM tracks WHERE ulower(title) LIKE ? OR ulower(artist) LIKE ? ORDER BY plays DESC LIMIT 20').all(like, like);
  res.json({
    users: users.map((u) => ({ ...userShort(u), city: u.city, friendship: friendshipStatus(req.user.id, u.id) })),
    groups: groups.map((g) => groupShort(g, req.user.id)),
    posts: hydratePosts(posts, req.user.id),
    tracks: tracks.map((t) => trackJson(t, req.user.id)),
  });
});

// ───────────────────────────── reports & announcements ─────────────────────────────

export const REPORT_CATEGORIES = {
  spam: 'Спам',
  abuse: 'Оскорбления',
  inappropriate: 'Неприемлемый контент',
  fake: 'Фейк или мошенничество',
  copyright: 'Нарушение авторских прав',
  other: 'Другое',
};

const reportTargetExists = {
  post: (id) => q('SELECT 1 FROM posts WHERE id = ?').get(id),
  comment: (id) => q('SELECT 1 FROM comments WHERE id = ?').get(id),
  user: (id) => q('SELECT 1 FROM users WHERE id = ?').get(id),
  group: (id) => q('SELECT 1 FROM groups WHERE id = ?').get(id),
  message: (id) => q('SELECT 1 FROM messages WHERE id = ?').get(id),
};

api.post('/reports', (req, res) => {
  const type = str(req.body.targetType, 20);
  const id = intParam(req.body.targetId);
  const category = str(req.body.category, 30);
  if (!reportTargetExists[type] || !id || !reportTargetExists[type](id)) fail(404, 'Объект жалобы не найден');
  if (!REPORT_CATEGORIES[category]) fail(400, 'Выберите причину жалобы');
  if (q("SELECT 1 FROM reports WHERE reporter_id = ? AND target_type = ? AND target_id = ? AND status = 'open'").get(req.user.id, type, id)) {
    fail(409, 'Вы уже пожаловались на это');
  }
  q('INSERT INTO reports (reporter_id, target_type, target_id, category, description, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(
    req.user.id,
    type,
    id,
    category,
    str(req.body.description, 1000),
    now(),
  );
  res.status(201).json({ ok: true });
});

api.get('/announcements', (_req, res) => {
  const rows = q('SELECT * FROM announcements WHERE active = 1 ORDER BY id DESC LIMIT 3').all();
  res.json(rows.map((a) => ({ id: a.id, title: a.title, body: a.body, createdAt: a.created_at })));
});

// ───────────────────────────── errors ─────────────────────────────

api.use((req, res) => res.status(404).json({ error: 'Метод не найден' }));
api.use(errorHandler);
