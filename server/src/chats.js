import express from 'express';
import { q, tx, now } from './db.js';
import { fail, intParam, str, need } from './http.js';
import { upload, fileUrl } from './uploads.js';
import { send } from './realtime.js';
import { censor } from './settings.js';
import { areFriends, getUser, getTrack, trackJson, spotifyRef, userShort, pushCounters } from './models.js';

/** Group chats ("беседы"): many members, roles, system messages, per-member read state. */
export const chats = express.Router();


const MAX_MEMBERS = 500;

const memberIds = (chatId) => q('SELECT user_id FROM chat_members WHERE chat_id = ?').all(chatId).map((r) => r.user_id);
const membership = (chatId, userId) => q('SELECT * FROM chat_members WHERE chat_id = ? AND user_id = ?').get(chatId, userId);

function parseSystem(text) {
  try {
    const v = JSON.parse(text);
    if (v && typeof v.k === 'string') return { key: v.k, params: v.p ?? {} };
  } catch {
    /* legacy plain text */
  }
  return { key: text, params: {} };
}

export function chatMessageJson(m) {
  return {
    id: m.id,
    chatId: m.chat_id,
    fromId: m.from_id,
    author: m.from_id ? userShort(getUser(m.from_id)) : null,
    kind: m.kind,
    text: m.kind === 'system' ? '' : m.text,
    system: m.kind === 'system' ? parseSystem(m.text) : null,
    image: m.image,
    audio: trackJson(getTrack(m.audio_id)),
    spotify: m.kind === 'text' ? spotifyRef(m.text) : null,
    createdAt: m.created_at,
  };
}

function broadcast(chatId, type, payload, ids = memberIds(chatId)) {
  for (const id of ids) send(id, type, payload);
}

function post(chatId, fromId, { text = '', image = null, audioId = null, kind = 'text' }) {
  const r = q('INSERT INTO chat_messages (chat_id, from_id, kind, text, image, audio_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
    chatId,
    fromId,
    kind,
    text,
    image,
    audioId,
    now(),
  );
  const id = Number(r.lastInsertRowid);
  if (fromId) q('UPDATE chat_members SET last_read_id = ? WHERE chat_id = ? AND user_id = ?').run(id, chatId, fromId);
  const msg = chatMessageJson(q('SELECT * FROM chat_messages WHERE id = ?').get(id));
  broadcast(chatId, 'chat_message', { chatId, message: msg });
  for (const uid of memberIds(chatId)) if (uid !== fromId) pushChatCounters(uid);
  return msg;
}

/** System messages are stored as translatable templates: { k: key, p: params }. */
const system = (chatId, actorId, key, params = {}) => post(chatId, actorId, { text: JSON.stringify({ k: key, p: params }), kind: 'system' });
const nameOf = (u) => `${u.first_name} ${u.last_name}`;

export function unreadChats(userId) {
  return q(
    `SELECT COUNT(*) AS c FROM chat_members cm
     WHERE cm.user_id = ? AND EXISTS (
       SELECT 1 FROM chat_messages m WHERE m.chat_id = cm.chat_id AND m.id > cm.last_read_id AND (m.from_id IS NULL OR m.from_id != ?)
     )`,
  ).get(userId, userId).c;
}

const pushChatCounters = (userId) => pushCounters(userId);

function chatJson(c, meId, full = false) {
  const me = membership(c.id, meId);
  const last = q('SELECT * FROM chat_messages WHERE chat_id = ? ORDER BY id DESC LIMIT 1').get(c.id);
  const members = q(
    `SELECT u.*, cm.role, cm.last_read_id FROM chat_members cm JOIN users u ON u.id = cm.user_id WHERE cm.chat_id = ?
     ORDER BY CASE cm.role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 ELSE 2 END, cm.joined_at`,
  ).all(c.id);
  return {
    id: c.id,
    title: c.title,
    avatar: c.avatar,
    ownerId: c.owner_id,
    createdAt: c.created_at,
    membersCount: members.length,
    myRole: me?.role ?? null,
    lastMessage: last ? chatMessageJson(last) : null,
    unread: me
      ? q('SELECT COUNT(*) AS c FROM chat_messages WHERE chat_id = ? AND id > ? AND (from_id IS NULL OR from_id != ?)').get(c.id, me.last_read_id, meId).c
      : 0,
    // Highest message id read by someone other than me — drives the "read" checkmarks.
    readUpTo: Math.max(0, ...members.filter((m) => m.id !== meId).map((m) => m.last_read_id)),
    previewMembers: members.slice(0, 4).map(userShort),
    members: full ? members.map((m) => ({ ...userShort(m), role: m.role, lastReadId: m.last_read_id })) : undefined,
  };
}

function requireMember(req) {
  const c = q('SELECT * FROM chats WHERE id = ?').get(intParam(req.params.id));
  if (!c) fail(404, 'Беседа не найдена');
  const m = membership(c.id, req.user.id);
  if (!m) fail(403, 'Вы не участник этой беседы');
  return { chat: c, me: m };
}
const isChatAdmin = (m) => m.role === 'owner' || m.role === 'admin';

chats.get('/chats', (req, res) => {
  const rows = q(
    `SELECT c.* FROM chats c JOIN chat_members cm ON cm.chat_id = c.id WHERE cm.user_id = ?
     ORDER BY COALESCE((SELECT MAX(id) FROM chat_messages WHERE chat_id = c.id), 0) DESC`,
  ).all(req.user.id);
  res.json(rows.map((c) => chatJson(c, req.user.id)));
});

chats.post('/chats', (req, res) => {
  need(req, 'can_message', 'Отправка сообщений недоступна для вашего уровня');
  const me = req.user.id;
  const title = censor(str(req.body.title, 100));
  if (!title) fail(400, 'Укажите название беседы');
  const ids = [...new Set((Array.isArray(req.body.memberIds) ? req.body.memberIds : []).map(intParam).filter((id) => id && id !== me))];
  if (!ids.length) fail(400, 'Добавьте хотя бы одного участника');
  if (ids.length >= MAX_MEMBERS) fail(400, 'В беседе может быть не больше {n} участников', undefined, { n: MAX_MEMBERS });
  for (const id of ids) if (!getUser(id) || !areFriends(me, id)) fail(403, 'В беседу можно добавлять только друзей');
  const t = now();
  const chatId = tx(() => {
    const id = Number(q('INSERT INTO chats (title, owner_id, created_at) VALUES (?, ?, ?)').run(title, me, t).lastInsertRowid);
    q("INSERT INTO chat_members (chat_id, user_id, role, joined_at) VALUES (?, ?, 'owner', ?)").run(id, me, t);
    for (const uid of ids) q('INSERT INTO chat_members (chat_id, user_id, joined_at) VALUES (?, ?, ?)').run(id, uid, t);
    return id;
  });
  system(chatId, me, '{actor} создал(а) беседу «{title}»', { actor: nameOf(req.user), title });
  res.status(201).json(chatJson(q('SELECT * FROM chats WHERE id = ?').get(chatId), me, true));
});

chats.get('/chats/:id', (req, res) => {
  const { chat } = requireMember(req);
  res.json(chatJson(chat, req.user.id, true));
});

chats.patch('/chats/:id', (req, res) => {
  const { chat, me } = requireMember(req);
  if (!isChatAdmin(me)) fail(403, 'Изменять беседу могут только администраторы');
  const title = censor(str(req.body.title, 100));
  if (!title) fail(400, 'Укажите название беседы');
  if (title !== chat.title) {
    q('UPDATE chats SET title = ? WHERE id = ?').run(title, chat.id);
    system(chat.id, req.user.id, '{actor} изменил(а) название беседы на «{title}»', { actor: nameOf(req.user), title });
    broadcast(chat.id, 'chat_updated', { chatId: chat.id });
  }
  res.json(chatJson(q('SELECT * FROM chats WHERE id = ?').get(chat.id), req.user.id, true));
});

chats.post('/chats/:id/avatar', upload.single('image'), (req, res) => {
  const { chat, me } = requireMember(req);
  if (!isChatAdmin(me)) fail(403, 'Изменять беседу могут только администраторы');
  if (!req.file) fail(400, 'Файл не выбран');
  q('UPDATE chats SET avatar = ? WHERE id = ?').run(fileUrl(req.file), chat.id);
  system(chat.id, req.user.id, '{actor} обновил(а) фотографию беседы', { actor: nameOf(req.user) });
  broadcast(chat.id, 'chat_updated', { chatId: chat.id });
  res.json(chatJson(q('SELECT * FROM chats WHERE id = ?').get(chat.id), req.user.id, true));
});

chats.post('/chats/:id/members', (req, res) => {
  const { chat } = requireMember(req);
  const ids = [...new Set((Array.isArray(req.body.userIds) ? req.body.userIds : []).map(intParam).filter(Boolean))].filter((id) => !membership(chat.id, id));
  if (!ids.length) fail(400, 'Выберите, кого добавить');
  if (memberIds(chat.id).length + ids.length > MAX_MEMBERS) fail(400, 'В беседе может быть не больше {n} участников', undefined, { n: MAX_MEMBERS });
  for (const id of ids) if (!getUser(id) || !areFriends(req.user.id, id)) fail(403, 'Добавлять можно только своих друзей');
  const t = now();
  // New members see history from the moment they join.
  const lastId = q('SELECT COALESCE(MAX(id), 0) AS id FROM chat_messages WHERE chat_id = ?').get(chat.id).id;
  for (const id of ids) q('INSERT INTO chat_members (chat_id, user_id, last_read_id, joined_at) VALUES (?, ?, ?, ?)').run(chat.id, id, lastId, t);
  for (const id of ids) system(chat.id, req.user.id, '{actor} добавил(а) {user}', { actor: nameOf(req.user), user: nameOf(getUser(id)) });
  broadcast(chat.id, 'chat_updated', { chatId: chat.id });
  res.json(chatJson(chat, req.user.id, true));
});

chats.delete('/chats/:id/members/:userId', (req, res) => {
  const { chat, me } = requireMember(req);
  const targetId = intParam(req.params.userId);
  const target = membership(chat.id, targetId);
  if (!target) fail(404, 'Участник не найден');
  const leaving = targetId === req.user.id;
  if (!leaving) {
    if (!isChatAdmin(me)) fail(403, 'Исключать участников могут только администраторы');
    if (target.role === 'owner' || (target.role === 'admin' && me.role !== 'owner')) fail(403, 'Недостаточно прав');
  }
  const before = memberIds(chat.id);
  const u = getUser(targetId);
  system(
    chat.id,
    req.user.id,
    leaving ? '{user} покинул(а) беседу' : '{actor} исключил(а) {user}',
    { actor: nameOf(req.user), user: nameOf(u) },
  );
  q('DELETE FROM chat_members WHERE chat_id = ? AND user_id = ?').run(chat.id, targetId);
  // If the owner leaves, the longest-standing admin (or member) takes over.
  if (target.role === 'owner') {
    const heir = q("SELECT user_id FROM chat_members WHERE chat_id = ? ORDER BY CASE role WHEN 'admin' THEN 0 ELSE 1 END, joined_at LIMIT 1").get(chat.id);
    if (heir) {
      q("UPDATE chat_members SET role = 'owner' WHERE chat_id = ? AND user_id = ?").run(chat.id, heir.user_id);
      q('UPDATE chats SET owner_id = ? WHERE id = ?').run(heir.user_id, chat.id);
    }
  }
  if (!memberIds(chat.id).length) q('DELETE FROM chats WHERE id = ?').run(chat.id);
  broadcast(chat.id, 'chat_updated', { chatId: chat.id, removedUserId: targetId }, before);
  res.json({ ok: true });
});

chats.patch('/chats/:id/members/:userId', (req, res) => {
  const { chat, me } = requireMember(req);
  if (me.role !== 'owner') fail(403, 'Назначать администраторов может только создатель беседы');
  const targetId = intParam(req.params.userId);
  const target = membership(chat.id, targetId);
  if (!target || target.role === 'owner') fail(400, 'Нельзя изменить роль этого участника');
  const role = req.body.role === 'admin' ? 'admin' : 'member';
  q('UPDATE chat_members SET role = ? WHERE chat_id = ? AND user_id = ?').run(role, chat.id, targetId);
  const u = getUser(targetId);
  system(chat.id, req.user.id, role === 'admin' ? '{user} теперь администратор беседы' : '{user} больше не администратор беседы', { user: nameOf(u) });
  broadcast(chat.id, 'chat_updated', { chatId: chat.id });
  res.json(chatJson(chat, req.user.id, true));
});

chats.get('/chats/:id/messages', (req, res) => {
  const { chat } = requireMember(req);
  const before = intParam(req.query.before) ?? Number.MAX_SAFE_INTEGER;
  const rows = q('SELECT * FROM chat_messages WHERE chat_id = ? AND id < ? ORDER BY id DESC LIMIT 50').all(chat.id, before);
  res.json({ items: rows.map(chatMessageJson).reverse(), hasMore: rows.length === 50 });
});

chats.post('/chats/:id/messages', upload.single('image'), (req, res) => {
  const { chat } = requireMember(req);
  need(req, 'can_message', 'Отправка сообщений недоступна для вашего уровня');
  if (req.file) need(req, 'can_upload', 'Загрузка фотографий недоступна для вашего уровня');
  const text = censor(str(req.body.text, 4000));
  const image = fileUrl(req.file);
  const audioId = intParam(req.body.audioId);
  if (audioId && !getTrack(audioId)) fail(404, 'Аудиозапись не найдена');
  if (!text && !image && !audioId) fail(400, 'Сообщение не может быть пустым');
  res.status(201).json(post(chat.id, req.user.id, { text, image, audioId }));
});

chats.post('/chats/:id/read', (req, res) => {
  const { chat, me } = requireMember(req);
  const lastId = q('SELECT COALESCE(MAX(id), 0) AS id FROM chat_messages WHERE chat_id = ?').get(chat.id).id;
  if (lastId > me.last_read_id) {
    q('UPDATE chat_members SET last_read_id = ? WHERE chat_id = ? AND user_id = ?').run(lastId, chat.id, req.user.id);
    broadcast(chat.id, 'chat_read', { chatId: chat.id, userId: req.user.id, lastReadId: lastId });
    pushChatCounters(req.user.id);
  }
  res.json({ ok: true });
});

chats.delete('/chats/:id/messages/:messageId', (req, res) => {
  const { chat, me } = requireMember(req);
  const m = q('SELECT * FROM chat_messages WHERE id = ? AND chat_id = ?').get(intParam(req.params.messageId), chat.id);
  if (!m || m.kind === 'system') fail(404, 'Сообщение не найдено');
  if (m.from_id !== req.user.id && !isChatAdmin(me)) fail(403, 'Можно удалять только свои сообщения');
  q('DELETE FROM chat_messages WHERE id = ?').run(m.id);
  broadcast(chat.id, 'chat_message_deleted', { chatId: chat.id, id: m.id });
  res.json({ ok: true });
});

/** Relays a typing indicator to the other members (called from the WebSocket handler). */
export function chatTyping(chatId, userId) {
  if (!membership(chatId, userId)) return;
  for (const id of memberIds(chatId)) if (id !== userId) send(id, 'typing', { userId, chatId });
}
