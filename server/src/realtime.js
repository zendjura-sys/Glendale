import { WebSocketServer } from 'ws';
import { q, now } from './db.js';
import { userByToken } from './auth.js';

/** userId -> Set<WebSocket> */
const sockets = new Map();

export const isOnline = (userId) => sockets.has(userId);

export function send(userId, type, payload) {
  const set = sockets.get(userId);
  if (!set) return;
  const data = JSON.stringify({ type, payload });
  for (const ws of set) if (ws.readyState === ws.OPEN) ws.send(data);
}

/** Closes every socket of a user (after a ban, deletion or forced logout). */
export function kick(userId) {
  const set = sockets.get(userId);
  if (!set) return;
  for (const ws of set) ws.close(4003, 'session ended');
}

function friendIds(userId) {
  return q('SELECT friend_id AS id FROM friends WHERE user_id = ?').all(userId).map((r) => r.id);
}

function broadcastPresence(userId, online) {
  const payload = { userId, online, lastSeen: now() };
  for (const id of friendIds(userId)) send(id, 'presence', payload);
}

export function attachRealtime(server) {
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws, req) => {
    const token = new URL(req.url, 'http://x').searchParams.get('token');
    const user = token && userByToken(token);
    if (!user) return ws.close(4001, 'unauthorized');

    const uid = user.id;
    const first = !sockets.has(uid);
    if (first) sockets.set(uid, new Set());
    sockets.get(uid).add(ws);
    q('UPDATE users SET last_seen = ? WHERE id = ?').run(now(), uid);
    if (first) broadcastPresence(uid, true);

    ws.isAlive = true;
    ws.on('pong', () => (ws.isAlive = true));

    ws.on('message', (raw) => {
      let msg;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        return;
      }
      if (msg.type === 'typing' && Number.isInteger(msg.peerId)) {
        send(msg.peerId, 'typing', { userId: uid });
      }
    });

    ws.on('close', () => {
      const set = sockets.get(uid);
      if (!set) return;
      set.delete(ws);
      if (set.size === 0) {
        sockets.delete(uid);
        q('UPDATE users SET last_seen = ? WHERE id = ?').run(now(), uid);
        broadcastPresence(uid, false);
      }
    });
  });

  const interval = setInterval(() => {
    for (const ws of wss.clients) {
      if (!ws.isAlive) {
        ws.terminate();
        continue;
      }
      ws.isAlive = false;
      ws.ping();
    }
  }, 30_000);
  interval.unref();
  wss.on('close', () => clearInterval(interval));
  return wss;
}
