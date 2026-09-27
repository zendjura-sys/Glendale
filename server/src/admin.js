import express from 'express';
import fs from 'node:fs';
import { db, q, tx, now } from './db.js';
import { requireAuth, isStaff, isAdminLevel, levelOf, createSession, hashPassword } from './auth.js';
import { fail, intParam, str, errorHandler } from './http.js';
import { translate } from './i18n.js';
import { adminSettings, getAllSettings, updateSettings } from './settings.js';
import { userShort, groupShort, getUser, getGroup, hydratePosts } from './models.js';
import { kick } from './realtime.js';
import { REPORT_CATEGORIES } from './api.js';

/**
 * Admin panel API (/api/admin). Moderators get the moderation sections (dashboard, reports, content);
 * admins and the superadmin get everything else.
 */
export const admin = express.Router();

const PER_PAGE = 25;
const DAY = 86_400_000;

admin.use(requireAuth);
admin.use((req, _res, next) => {
  if (!isStaff(req.level)) fail(403, 'Нет доступа к админ-панели');
  next();
});

const adminOnly = (req, _res, next) => {
  if (!isAdminLevel(req.level)) fail(403, 'Раздел доступен только администраторам');
  next();
};

const isSuper = (req) => req.level.type === 'superadmin';

function log(req, action, target = '', details = '') {
  q('INSERT INTO admin_log (admin_id, action, target, details, created_at) VALUES (?, ?, ?, ?, ?)').run(
    req.user.id,
    action,
    target,
    typeof details === 'string' ? details : JSON.stringify(details),
    now(),
  );
}

const pageParam = (req) => Math.max(1, intParam(req.query.page) ?? 1);
const likeParam = (req) => `%${str(req.query.q, 100).toLowerCase()}%`;
const userLabel = (u) => (u ? `${u.first_name} ${u.last_name} (#${u.id})` : '');

function adminUser(u) {
  const l = levelOf(u);
  return {
    ...userShort(u),
    email: u.email,
    level: { id: l.id, title: l.title, type: l.type },
    enabled: !!u.enabled,
    approved: !!u.approved,
    verified: !!u.verified,
    signupIp: u.signup_ip,
    lastIp: u.last_ip,
    createdAt: u.created_at,
    lockedUntil: u.locked_until,
  };
}

/** Daily counts for the last `days` days from `table.created_at`. */
function series(table, days, where = '1 = 1') {
  const from = new Date();
  from.setHours(0, 0, 0, 0);
  const start = from.getTime() - (days - 1) * DAY;
  const rows = db
    .prepare(
      `SELECT CAST((created_at - ?) / ${DAY} AS INTEGER) AS d, COUNT(*) AS c FROM ${table}
       WHERE created_at >= ? AND ${where} GROUP BY d`,
    )
    .all(start, start);
  const out = Array.from({ length: days }, (_, i) => ({ date: start + i * DAY, count: 0 }));
  for (const r of rows) if (out[r.d]) out[r.d].count = r.c;
  return out;
}

const count = (sql, ...args) => q(sql).get(...args).c;

// ───────────────────────────── dashboard ─────────────────────────────

admin.get('/dashboard', (req, res) => {
  const weekAgo = now() - 7 * DAY;
  const recentUsers = q('SELECT * FROM users ORDER BY id DESC LIMIT 6').all();
  let dbSize = 0;
  try {
    const file = db.prepare('PRAGMA database_list').get()?.file;
    if (file) dbSize = fs.statSync(file).size;
  } catch {
    /* in-memory database */
  }
  res.json({
    totals: {
      users: count('SELECT COUNT(*) AS c FROM users'),
      newUsersWeek: count('SELECT COUNT(*) AS c FROM users WHERE created_at >= ?', weekAgo),
      online: count('SELECT COUNT(*) AS c FROM users WHERE last_seen >= ?', now() - 5 * 60_000),
      posts: count('SELECT COUNT(*) AS c FROM posts'),
      postsWeek: count('SELECT COUNT(*) AS c FROM posts WHERE created_at >= ?', weekAgo),
      comments: count('SELECT COUNT(*) AS c FROM comments'),
      messages: count('SELECT COUNT(*) AS c FROM messages'),
      groups: count('SELECT COUNT(*) AS c FROM groups'),
      photos: count('SELECT COUNT(*) AS c FROM photos'),
      openReports: count("SELECT COUNT(*) AS c FROM reports WHERE status = 'open'"),
      pendingUsers: count('SELECT COUNT(*) AS c FROM users WHERE approved = 0'),
      bannedUsers: count('SELECT COUNT(*) AS c FROM users WHERE enabled = 0'),
    },
    activity: {
      signups: series('users', 14),
      posts: series('posts', 14),
      messages: series('messages', 14),
    },
    recentUsers: recentUsers.map(adminUser),
    system: {
      node: process.version,
      uptime: Math.round(process.uptime()),
      memory: process.memoryUsage().rss,
      dbSize,
    },
  });
});

// ───────────────────────────── members ─────────────────────────────

admin.get('/users', adminOnly, (req, res) => {
  const where = [];
  const args = [];
  if (req.query.q) {
    where.push("(ulower(first_name || ' ' || last_name) LIKE ? OR ulower(email) LIKE ? OR CAST(id AS TEXT) = ?)");
    args.push(likeParam(req), likeParam(req), str(req.query.q, 20));
  }
  const level = intParam(req.query.level);
  if (level) {
    where.push('level_id = ?');
    args.push(level);
  }
  const status = req.query.status;
  if (status === 'banned') where.push('enabled = 0');
  if (status === 'pending') where.push('approved = 0');
  if (status === 'verified') where.push('verified = 1');
  if (status === 'active') where.push('enabled = 1 AND approved = 1');
  const w = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const total = db.prepare(`SELECT COUNT(*) AS c FROM users ${w}`).get(...args).c;
  const sort = req.query.sort === 'last_seen' ? 'last_seen DESC' : req.query.sort === 'name' ? 'first_name, last_name' : 'id DESC';
  const rows = db.prepare(`SELECT * FROM users ${w} ORDER BY ${sort} LIMIT ${PER_PAGE} OFFSET ?`).all(...args, (pageParam(req) - 1) * PER_PAGE);
  res.json({ items: rows.map(adminUser), total, perPage: PER_PAGE });
});

function targetUser(req) {
  const u = getUser(intParam(req.params.id));
  if (!u) fail(404, 'Пользователь не найден');
  if (levelOf(u).type === 'superadmin' && !isSuper(req)) fail(403, 'Суперадминистратора может изменять только суперадминистратор');
  return u;
}

admin.get('/users/:id', adminOnly, (req, res) => {
  const u = getUser(intParam(req.params.id));
  if (!u) fail(404, 'Пользователь не найден');
  res.json({
    ...adminUser(u),
    stats: {
      posts: count('SELECT COUNT(*) AS c FROM posts WHERE author_id = ?', u.id),
      comments: count('SELECT COUNT(*) AS c FROM comments WHERE author_id = ?', u.id),
      messages: count('SELECT COUNT(*) AS c FROM messages WHERE from_id = ?', u.id),
      friends: count('SELECT COUNT(*) AS c FROM friends WHERE user_id = ?', u.id),
      groups: count('SELECT COUNT(*) AS c FROM group_members WHERE user_id = ?', u.id),
      photos: count('SELECT COUNT(*) AS c FROM photos WHERE user_id = ?', u.id),
      sessions: count('SELECT COUNT(*) AS c FROM sessions WHERE user_id = ?', u.id),
      reportsAgainst: count("SELECT COUNT(*) AS c FROM reports WHERE target_type = 'user' AND target_id = ?", u.id),
    },
  });
});

function applyUserPatch(req, u, body) {
  const changes = {};
  if (body.firstName !== undefined) {
    const v = str(body.firstName, 50);
    if (!v) fail(400, 'Имя не может быть пустым');
    changes.first_name = v;
  }
  if (body.lastName !== undefined) {
    const v = str(body.lastName, 50);
    if (!v) fail(400, 'Фамилия не может быть пустой');
    changes.last_name = v;
  }
  if (body.email !== undefined) {
    const v = str(body.email, 120).toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) fail(400, 'Некорректный email');
    if (q('SELECT 1 FROM users WHERE email = ? AND id != ?').get(v, u.id)) fail(409, 'Email уже занят');
    changes.email = v;
  }
  if (body.levelId !== undefined) {
    const level = q('SELECT * FROM levels WHERE id = ?').get(intParam(body.levelId));
    if (!level) fail(400, 'Уровень не найден');
    if (level.type === 'superadmin' && !isSuper(req)) fail(403, 'Назначить суперадминистратора может только суперадминистратор');
    if (u.id === req.user.id && level.id !== u.level_id) fail(400, 'Нельзя изменить собственный уровень');
    changes.level_id = level.id;
  }
  for (const [key, col] of [
    ['enabled', 'enabled'],
    ['approved', 'approved'],
    ['verified', 'verified'],
  ]) {
    if (body[key] === undefined) continue;
    if (key === 'enabled' && !body.enabled && u.id === req.user.id) fail(400, 'Нельзя заблокировать самого себя');
    changes[col] = body[key] ? 1 : 0;
  }
  if (body.password) {
    if (String(body.password).length < 6) fail(400, 'Пароль должен быть не короче 6 символов');
    changes.password_hash = hashPassword(String(body.password));
  }
  if (body.unlock) {
    changes.locked_until = 0;
    changes.failed_logins = 0;
  }
  const cols = Object.keys(changes);
  if (!cols.length) return changes;
  db.prepare(`UPDATE users SET ${cols.map((c) => `${c} = ?`).join(', ')} WHERE id = ?`).run(...Object.values(changes), u.id);
  // A ban or password reset ends every open session.
  if (changes.enabled === 0 || changes.password_hash) {
    q('DELETE FROM sessions WHERE user_id = ?').run(u.id);
    kick(u.id);
  }
  return changes;
}

admin.patch('/users/:id', adminOnly, (req, res) => {
  const u = targetUser(req);
  const changes = applyUserPatch(req, u, req.body);
  const { password_hash, ...logged } = changes;
  log(req, 'user.update', userLabel(u), { ...logged, ...(password_hash ? { password: 'changed' } : {}) });
  res.json(adminUser(getUser(u.id)));
});

admin.delete('/users/:id', adminOnly, (req, res) => {
  const u = targetUser(req);
  if (u.id === req.user.id) fail(400, 'Нельзя удалить собственный аккаунт');
  q('DELETE FROM users WHERE id = ?').run(u.id);
  kick(u.id);
  log(req, 'user.delete', userLabel(u));
  res.json({ ok: true });
});

admin.post('/users/:id/login-as', adminOnly, (req, res) => {
  const u = targetUser(req);
  if (!u.enabled) fail(400, 'Пользователь заблокирован');
  log(req, 'user.login_as', userLabel(u));
  res.json({ token: createSession(u.id) });
});

admin.post('/users/:id/logout-all', adminOnly, (req, res) => {
  const u = targetUser(req);
  q('DELETE FROM sessions WHERE user_id = ?').run(u.id);
  kick(u.id);
  log(req, 'user.logout_all', userLabel(u));
  res.json({ ok: true });
});

admin.post('/users/bulk', adminOnly, (req, res) => {
  const ids = Array.isArray(req.body.ids) ? req.body.ids.map(intParam).filter(Boolean).slice(0, 500) : [];
  const action = str(req.body.action, 20);
  const patches = {
    approve: { approved: true },
    enable: { enabled: true },
    disable: { enabled: false },
    verify: { verified: true },
  };
  if (!ids.length) fail(400, 'Не выбраны пользователи');
  if (!patches[action] && action !== 'delete') fail(400, 'Неизвестное действие');
  let done = 0;
  const skipped = [];
  tx(() => {
    for (const id of ids) {
      const u = getUser(id);
      if (!u) continue;
      if ((levelOf(u).type === 'superadmin' && !isSuper(req)) || (u.id === req.user.id && action !== 'approve' && action !== 'verify')) {
        skipped.push(id);
        continue;
      }
      if (action === 'delete') q('DELETE FROM users WHERE id = ?').run(id);
      else applyUserPatch(req, u, patches[action]);
      done++;
    }
  });
  log(req, `user.bulk_${action}`, `${done} польз.`, { ids });
  res.json({ done, skipped });
});

// ───────────────────────────── member levels ─────────────────────────────

const LEVEL_FLAGS = ['can_post', 'can_comment', 'can_message', 'can_create_groups', 'can_upload'];

function levelJson(l) {
  return {
    id: l.id,
    title: l.title,
    description: l.description,
    type: l.type,
    isDefault: !!l.is_default,
    floodSeconds: l.flood_seconds,
    permissions: Object.fromEntries(LEVEL_FLAGS.map((f) => [f, !!l[f]])),
    members: count('SELECT COUNT(*) AS c FROM users WHERE level_id = ?', l.id),
  };
}

admin.get('/levels', adminOnly, (_req, res) => {
  res.json(q("SELECT * FROM levels ORDER BY CASE type WHEN 'superadmin' THEN 0 WHEN 'admin' THEN 1 WHEN 'moderator' THEN 2 ELSE 3 END, id").all().map(levelJson));
});

function saveLevel(req, id) {
  const b = req.body;
  const existing = id ? q('SELECT * FROM levels WHERE id = ?').get(id) : null;
  if (id && !existing) fail(404, 'Уровень не найден');
  const title = b.title !== undefined ? str(b.title, 60) : existing?.title;
  if (!title) fail(400, 'Укажите название уровня');
  let type = existing?.type ?? 'user';
  if (b.type !== undefined && existing?.type !== 'superadmin') {
    if (!['admin', 'moderator', 'user'].includes(b.type)) fail(400, 'Недопустимый тип уровня');
    if (b.type === 'admin' && !isSuper(req) && existing?.type !== 'admin') fail(403, 'Создавать уровни администраторов может только суперадминистратор');
    type = b.type;
  }
  if (existing?.type === 'superadmin' && !isSuper(req)) fail(403, 'Уровень суперадминистратора может менять только суперадминистратор');
  const perms = { ...Object.fromEntries(LEVEL_FLAGS.map((f) => [f, existing ? existing[f] : 1])) };
  for (const f of LEVEL_FLAGS) if (b.permissions?.[f] !== undefined) perms[f] = b.permissions[f] ? 1 : 0;
  const flood = b.floodSeconds !== undefined ? Math.max(0, Math.min(3600, Number(b.floodSeconds) || 0)) : existing?.flood_seconds ?? 0;
  const description = b.description !== undefined ? str(b.description, 300) : existing?.description ?? '';

  return tx(() => {
    let levelId = id;
    if (existing) {
      q(
        `UPDATE levels SET title = ?, description = ?, type = ?, can_post = ?, can_comment = ?, can_message = ?,
         can_create_groups = ?, can_upload = ?, flood_seconds = ? WHERE id = ?`,
      ).run(title, description, type, perms.can_post, perms.can_comment, perms.can_message, perms.can_create_groups, perms.can_upload, flood, id);
    } else {
      levelId = Number(
        q(
          `INSERT INTO levels (title, description, type, can_post, can_comment, can_message, can_create_groups, can_upload, flood_seconds, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        ).run(title, description, type, perms.can_post, perms.can_comment, perms.can_message, perms.can_create_groups, perms.can_upload, flood, now())
          .lastInsertRowid,
      );
    }
    if (b.isDefault && type === 'user') {
      q('UPDATE levels SET is_default = 0').run();
      q('UPDATE levels SET is_default = 1 WHERE id = ?').run(levelId);
    }
    return q('SELECT * FROM levels WHERE id = ?').get(levelId);
  });
}

admin.post('/levels', adminOnly, (req, res) => {
  const l = saveLevel(req, null);
  log(req, 'level.create', l.title);
  res.status(201).json(levelJson(l));
});

admin.patch('/levels/:id', adminOnly, (req, res) => {
  const l = saveLevel(req, intParam(req.params.id));
  log(req, 'level.update', l.title);
  res.json(levelJson(l));
});

admin.delete('/levels/:id', adminOnly, (req, res) => {
  const l = q('SELECT * FROM levels WHERE id = ?').get(intParam(req.params.id));
  if (!l) fail(404, 'Уровень не найден');
  if (l.type === 'superadmin' || l.is_default) fail(400, 'Этот уровень нельзя удалить');
  tx(() => {
    q('UPDATE users SET level_id = (SELECT id FROM levels WHERE is_default = 1) WHERE level_id = ?').run(l.id);
    q('DELETE FROM levels WHERE id = ?').run(l.id);
  });
  log(req, 'level.delete', l.title);
  res.json({ ok: true });
});

// ───────────────────────────── reports ─────────────────────────────

function reportTarget(type, id) {
  switch (type) {
    case 'post': {
      const p = q('SELECT * FROM posts WHERE id = ?').get(id);
      return p && { exists: true, text: p.text, image: p.image, author: userShort(getUser(p.author_id)), link: `/wall/${p.id}` };
    }
    case 'comment': {
      const c = q('SELECT * FROM comments WHERE id = ?').get(id);
      return c && { exists: true, text: c.text, author: userShort(getUser(c.author_id)), link: `/wall/${c.post_id}` };
    }
    case 'user': {
      const u = getUser(id);
      return u && { exists: true, text: `${u.first_name} ${u.last_name}`, author: userShort(u), link: `/id/${u.id}` };
    }
    case 'group': {
      const g = getGroup(id);
      return g && { exists: true, text: g.name, author: userShort(getUser(g.owner_id)), link: `/club/${g.id}` };
    }
    case 'message': {
      const m = q('SELECT * FROM messages WHERE id = ?').get(id);
      return m && { exists: true, text: m.text, image: m.image, author: userShort(getUser(m.from_id)), link: null };
    }
  }
  return null;
}

admin.get('/reports', (req, res) => {
  const status = ['open', 'resolved', 'dismissed'].includes(req.query.status) ? req.query.status : 'open';
  const rows = q(`SELECT * FROM reports WHERE status = ? ORDER BY id DESC LIMIT ${PER_PAGE} OFFSET ?`).all(status, (pageParam(req) - 1) * PER_PAGE);
  res.json({
    total: count('SELECT COUNT(*) AS c FROM reports WHERE status = ?', status),
    perPage: PER_PAGE,
    categories: REPORT_CATEGORIES,
    items: rows.map((r) => ({
      id: r.id,
      targetType: r.target_type,
      targetId: r.target_id,
      category: r.category,
      categoryLabel: REPORT_CATEGORIES[r.category] ?? r.category,
      description: r.description,
      status: r.status,
      resolution: r.resolution,
      createdAt: r.created_at,
      resolvedAt: r.resolved_at,
      reporter: userShort(getUser(r.reporter_id)),
      resolvedBy: r.resolved_by ? userShort(getUser(r.resolved_by)) : null,
      target: reportTarget(r.target_type, r.target_id) ?? { exists: false },
      duplicates: count(
        "SELECT COUNT(*) AS c FROM reports WHERE target_type = ? AND target_id = ? AND status = 'open'",
        r.target_type,
        r.target_id,
      ),
    })),
  });
});

const deleteTarget = {
  post: (id) => q('DELETE FROM posts WHERE id = ?').run(id),
  comment: (id) => q('DELETE FROM comments WHERE id = ?').run(id),
  group: (id) =>
    tx(() => {
      q("DELETE FROM posts WHERE owner_type = 'group' AND owner_id = ?").run(id);
      q('DELETE FROM groups WHERE id = ?').run(id);
    }),
  message: (id) => q('DELETE FROM messages WHERE id = ?').run(id),
  user: () => {},
};

function authorOf(type, id) {
  const sql = {
    post: 'SELECT author_id AS uid FROM posts WHERE id = ?',
    comment: 'SELECT author_id AS uid FROM comments WHERE id = ?',
    group: 'SELECT owner_id AS uid FROM groups WHERE id = ?',
    message: 'SELECT from_id AS uid FROM messages WHERE id = ?',
    user: 'SELECT id AS uid FROM users WHERE id = ?',
  }[type];
  return q(sql).get(id)?.uid ?? null;
}

admin.post('/reports/:id/resolve', (req, res) => {
  const r = q('SELECT * FROM reports WHERE id = ?').get(intParam(req.params.id));
  if (!r) fail(404, 'Жалоба не найдена');
  const action = str(req.body.action, 20);
  if (!['dismiss', 'delete', 'ban', 'delete_ban'].includes(action)) fail(400, 'Неизвестное действие');
  const uid = authorOf(r.target_type, r.target_id);
  const notes = [];
  tx(() => {
    if (action === 'delete' || action === 'delete_ban') {
      deleteTarget[r.target_type](r.target_id);
      notes.push('контент удалён');
    }
    if ((action === 'ban' || action === 'delete_ban') && uid) {
      const author = getUser(uid);
      if (author && isStaff(levelOf(author))) fail(403, 'Нельзя заблокировать сотрудника через жалобу');
      if (author) {
        q('UPDATE users SET enabled = 0 WHERE id = ?').run(uid);
        q('DELETE FROM sessions WHERE user_id = ?').run(uid);
        kick(uid);
        notes.push('автор заблокирован');
      }
    }
    // Close every open report about the same object.
    q(
      `UPDATE reports SET status = ?, resolved_by = ?, resolved_at = ?, resolution = ?
       WHERE target_type = ? AND target_id = ? AND status = 'open'`,
    ).run(action === 'dismiss' ? 'dismissed' : 'resolved', req.user.id, now(), notes.join(', ') || 'отклонена', r.target_type, r.target_id);
  });
  log(req, `report.${action}`, `${r.target_type} #${r.target_id}`, notes.join(', '));
  res.json({ ok: true });
});

// ───────────────────────────── content moderation ─────────────────────────────

admin.get('/posts', (req, res) => {
  const search = str(req.query.q, 100);
  const rows = search
    ? q(`SELECT * FROM posts WHERE ulower(text) LIKE ? ORDER BY id DESC LIMIT ${PER_PAGE} OFFSET ?`).all(likeParam(req), (pageParam(req) - 1) * PER_PAGE)
    : q(`SELECT * FROM posts ORDER BY id DESC LIMIT ${PER_PAGE} OFFSET ?`).all((pageParam(req) - 1) * PER_PAGE);
  const total = search ? count('SELECT COUNT(*) AS c FROM posts WHERE ulower(text) LIKE ?', likeParam(req)) : count('SELECT COUNT(*) AS c FROM posts');
  res.json({ items: hydratePosts(rows, req.user.id), total, perPage: PER_PAGE });
});

admin.delete('/posts/:id', (req, res) => {
  const p = q('SELECT * FROM posts WHERE id = ?').get(intParam(req.params.id));
  if (!p) fail(404, 'Запись не найдена');
  q('DELETE FROM posts WHERE id = ?').run(p.id);
  log(req, 'post.delete', `#${p.id}`, p.text.slice(0, 120));
  res.json({ ok: true });
});

admin.get('/comments', (req, res) => {
  const search = str(req.query.q, 100);
  const where = search ? 'WHERE ulower(text) LIKE ?' : '';
  const args = search ? [likeParam(req)] : [];
  const rows = db.prepare(`SELECT * FROM comments ${where} ORDER BY id DESC LIMIT ${PER_PAGE} OFFSET ?`).all(...args, (pageParam(req) - 1) * PER_PAGE);
  res.json({
    items: rows.map((c) => ({ id: c.id, postId: c.post_id, text: c.text, createdAt: c.created_at, author: userShort(getUser(c.author_id)) })),
    total: db.prepare(`SELECT COUNT(*) AS c FROM comments ${where}`).get(...args).c,
    perPage: PER_PAGE,
  });
});

admin.delete('/comments/:id', (req, res) => {
  const c = q('SELECT * FROM comments WHERE id = ?').get(intParam(req.params.id));
  if (!c) fail(404, 'Комментарий не найден');
  q('DELETE FROM comments WHERE id = ?').run(c.id);
  log(req, 'comment.delete', `#${c.id}`, c.text.slice(0, 120));
  res.json({ ok: true });
});

admin.get('/groups', (req, res) => {
  const search = str(req.query.q, 100);
  const where = search ? 'WHERE ulower(name) LIKE ?' : '';
  const args = search ? [likeParam(req)] : [];
  const rows = db.prepare(`SELECT * FROM groups ${where} ORDER BY id DESC LIMIT ${PER_PAGE} OFFSET ?`).all(...args, (pageParam(req) - 1) * PER_PAGE);
  res.json({
    items: rows.map((g) => ({
      ...groupShort(g, req.user.id),
      owner: userShort(getUser(g.owner_id)),
      posts: count("SELECT COUNT(*) AS c FROM posts WHERE owner_type = 'group' AND owner_id = ?", g.id),
    })),
    total: db.prepare(`SELECT COUNT(*) AS c FROM groups ${where}`).get(...args).c,
    perPage: PER_PAGE,
  });
});

admin.delete('/groups/:id', (req, res) => {
  const g = getGroup(intParam(req.params.id));
  if (!g) fail(404, 'Сообщество не найдено');
  deleteTarget.group(g.id);
  log(req, 'group.delete', `${g.name} (#${g.id})`);
  res.json({ ok: true });
});

// ───────────────────────────── announcements ─────────────────────────────

const annJson = (a) => ({
  id: a.id,
  title: a.title,
  body: a.body,
  active: !!a.active,
  createdAt: a.created_at,
  author: a.author_id ? userShort(getUser(a.author_id)) : null,
});

admin.get('/announcements', adminOnly, (_req, res) => {
  res.json(q('SELECT * FROM announcements ORDER BY id DESC').all().map(annJson));
});

admin.post('/announcements', adminOnly, (req, res) => {
  const title = str(req.body.title, 150);
  if (!title) fail(400, 'Укажите заголовок');
  const r = q('INSERT INTO announcements (title, body, author_id, active, created_at) VALUES (?, ?, ?, ?, ?)').run(
    title,
    str(req.body.body, 3000),
    req.user.id,
    req.body.active === false ? 0 : 1,
    now(),
  );
  log(req, 'announcement.create', title);
  res.status(201).json(annJson(q('SELECT * FROM announcements WHERE id = ?').get(Number(r.lastInsertRowid))));
});

admin.patch('/announcements/:id', adminOnly, (req, res) => {
  const a = q('SELECT * FROM announcements WHERE id = ?').get(intParam(req.params.id));
  if (!a) fail(404, 'Объявление не найдено');
  const title = req.body.title !== undefined ? str(req.body.title, 150) : a.title;
  if (!title) fail(400, 'Укажите заголовок');
  q('UPDATE announcements SET title = ?, body = ?, active = ? WHERE id = ?').run(
    title,
    req.body.body !== undefined ? str(req.body.body, 3000) : a.body,
    req.body.active !== undefined ? (req.body.active ? 1 : 0) : a.active,
    a.id,
  );
  log(req, 'announcement.update', title);
  res.json(annJson(q('SELECT * FROM announcements WHERE id = ?').get(a.id)));
});

admin.delete('/announcements/:id', adminOnly, (req, res) => {
  const a = q('SELECT * FROM announcements WHERE id = ?').get(intParam(req.params.id));
  if (!a) fail(404, 'Объявление не найдено');
  q('DELETE FROM announcements WHERE id = ?').run(a.id);
  log(req, 'announcement.delete', a.title);
  res.json({ ok: true });
});

// ───────────────────────────── settings ─────────────────────────────

admin.get('/settings', adminOnly, (_req, res) => res.json(adminSettings()));

admin.patch('/settings', adminOnly, (req, res) => {
  const before = getAllSettings();
  const after = updateSettings(req.body ?? {});
  // The audit log names changed keys only, never secret values.
  const changed = Object.keys(after).filter((k) => JSON.stringify(after[k]) !== JSON.stringify(before[k]));
  if (changed.length) log(req, 'settings.update', changed.join(', '));
  res.json(adminSettings());
});

// ───────────────────────────── statistics ─────────────────────────────

admin.get('/stats', adminOnly, (req, res) => {
  const days = [7, 30, 90].includes(Number(req.query.days)) ? Number(req.query.days) : 30;
  const since = now() - days * DAY;
  const topPosters = q(
    `SELECT author_id, COUNT(*) AS c FROM posts WHERE created_at >= ? GROUP BY author_id ORDER BY c DESC LIMIT 5`,
  ).all(since);
  const topGroups = q(
    `SELECT g.*, COUNT(m.user_id) AS members FROM groups g LEFT JOIN group_members m ON m.group_id = g.id
     GROUP BY g.id ORDER BY members DESC LIMIT 5`,
  ).all();
  res.json({
    days,
    series: {
      signups: series('users', days),
      posts: series('posts', days),
      comments: series('comments', days),
      messages: series('messages', days),
      likes: series('likes', days),
    },
    topPosters: topPosters.map((r) => ({ user: userShort(getUser(r.author_id)), posts: r.c })),
    topGroups: topGroups.map((g) => ({ id: g.id, name: g.name, avatar: g.avatar, members: g.members })),
    levels: q('SELECT l.title, COUNT(u.id) AS c FROM levels l LEFT JOIN users u ON u.level_id = l.id GROUP BY l.id ORDER BY c DESC').all().map((r) => ({
      title: r.title,
      count: r.c,
    })),
  });
});

// ───────────────────────────── audit log ─────────────────────────────

admin.get('/log', adminOnly, (req, res) => {
  const rows = q(`SELECT * FROM admin_log ORDER BY id DESC LIMIT ${PER_PAGE} OFFSET ?`).all((pageParam(req) - 1) * PER_PAGE);
  res.json({
    items: rows.map((r) => ({
      id: r.id,
      action: r.action,
      target: r.target,
      details: r.details,
      createdAt: r.created_at,
      admin: r.admin_id ? userShort(getUser(r.admin_id)) : null,
    })),
    total: count('SELECT COUNT(*) AS c FROM admin_log'),
    perPage: PER_PAGE,
  });
});

admin.use((req, res) => res.status(404).json({ error: translate('Метод не найден', null, req.lang) }));
admin.use(errorHandler);
