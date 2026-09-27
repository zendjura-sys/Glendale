import crypto from 'node:crypto';
import { q, now } from './db.js';
import { getSetting, isIpBanned, isEmailBanned } from './settings.js';
import { fail } from './http.js';
import { translate } from './i18n.js';

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
  if (!user) return res.status(401).json({ error: translate('Требуется авторизация', null, req.lang) });
  const level = levelOf(user);
  if (!isStaff(level)) {
    if (isIpBanned(clientIp(req))) return res.status(403).json({ error: translate('Доступ с вашего адреса ограничен', null, req.lang), code: 'banned' });
    if (getSetting('maintenance')) return res.status(503).json({ error: getSetting('maintenanceMessage'), code: 'maintenance' });
  }
  req.user = user;
  req.level = level;
  req.token = token;
  next();
}

/**
 * Creates an account, applying the site's signup rules (closed signup, bans, approval).
 * The very first account of a fresh installation becomes the superadmin.
 * Returns the new user row.
 */
export function insertUser({ firstName, lastName, email, passwordHash, ip, avatar = null, hasPassword = true }) {
  const mode = getSetting('signupMode');
  if (mode === 'closed') fail(403, 'Регистрация временно закрыта', 'signup_closed');
  if (getSetting('maintenance')) fail(503, getSetting('maintenanceMessage'), 'maintenance');
  if (isEmailBanned(email) || isIpBanned(ip)) fail(403, 'Регистрация с этим адресом запрещена', 'banned');

  const hasSuperadmin = q("SELECT 1 FROM users u JOIN levels l ON l.id = u.level_id WHERE l.type = 'superadmin'").get();
  const levelId = hasSuperadmin
    ? q('SELECT id FROM levels WHERE is_default = 1').get().id
    : q("SELECT id FROM levels WHERE type = 'superadmin'").get().id;
  const approved = mode === 'approval' && hasSuperadmin ? 0 : 1;
  const t = now();
  const r = q(
    `INSERT INTO users (first_name, last_name, email, password_hash, has_password, level_id, approved, signup_ip, last_ip, avatar, created_at, last_seen)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(firstName, lastName, email, passwordHash, hasPassword ? 1 : 0, levelId, approved, ip, ip, avatar, t, t);
  return q('SELECT * FROM users WHERE id = ?').get(Number(r.lastInsertRowid));
}

/** Checks shared by every way of signing in (password, Google). Throws when the member may not log in. */
export function assertCanLogin(user, ip) {
  if (!user.enabled) fail(403, 'Аккаунт заблокирован администрацией', 'banned');
  if (!user.approved) fail(403, 'Аккаунт ожидает одобрения администратором', 'pending');
  const staff = isStaff(levelOf(user));
  if (!staff && isIpBanned(ip)) fail(403, 'Доступ с вашего адреса ограничен', 'banned');
  if (!staff && getSetting('maintenance')) fail(503, getSetting('maintenanceMessage'), 'maintenance');
  q('UPDATE users SET failed_logins = 0, locked_until = 0, last_ip = ? WHERE id = ?').run(ip, user.id);
}
