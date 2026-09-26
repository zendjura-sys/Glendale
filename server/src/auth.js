import crypto from 'node:crypto';
import { q, now } from './db.js';
import { getSetting, isIpBanned } from './settings.js';

export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password, stored) {
  const [salt, hash] = stored.split(':');
  const candidate = crypto.scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, 'hex');
  return candidate.length === expected.length && crypto.timingSafeEqual(candidate, expected);
}

export function createSession(userId) {
  const token = crypto.randomBytes(32).toString('base64url');
  q('INSERT INTO sessions (token, user_id, created_at) VALUES (?, ?, ?)').run(token, userId, now());
  return token;
}

/** Active (not banned) user for a session token. */
export function userByToken(token) {
  return q('SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ? AND u.enabled = 1').get(token);
}

export const levelOf = (user) => q('SELECT * FROM levels WHERE id = ?').get(user.level_id) ?? q('SELECT * FROM levels WHERE is_default = 1').get();

export const isStaff = (level) => ['superadmin', 'admin', 'moderator'].includes(level?.type);
export const isAdminLevel = (level) => level?.type === 'superadmin' || level?.type === 'admin';

export const clientIp = (req) => (req.ip || '').replace(/^::ffff:/, '');

export function requireAuth(req, res, next) {
  const header = req.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  const user = token && userByToken(token);
  if (!user) return res.status(401).json({ error: 'Требуется авторизация' });
  const level = levelOf(user);
  if (!isStaff(level)) {
    if (isIpBanned(clientIp(req))) return res.status(403).json({ error: 'Доступ с вашего адреса ограничен', code: 'banned' });
    if (getSetting('maintenance')) return res.status(503).json({ error: getSetting('maintenanceMessage'), code: 'maintenance' });
  }
  req.user = user;
  req.level = level;
  req.token = token;
  next();
}
