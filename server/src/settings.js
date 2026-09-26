import { q } from './db.js';

/** Site-wide settings managed from the admin panel. Stored as JSON in the `settings` table. */
export const DEFAULTS = {
  siteTitle: 'Glendale',
  siteDescription: 'Социальная сеть для общения с друзьями и сообществами',
  signupMode: 'open', // 'open' | 'approval' | 'closed'
  maintenance: false,
  maintenanceMessage: 'Мы проводим технические работы и скоро вернёмся.',
  bannedEmails: '', // one per line; "*@domain.com" bans a whole domain
  bannedIps: '', // one per line; a trailing "*" matches a prefix
  bannedWords: '', // one per line; replaced with *** in posts, comments and messages
  lockAttempts: 5, // failed logins before the account is temporarily locked (0 = off)
  lockMinutes: 15,
  accentColor: '#4c5bf5',
  aurora: true,
  wallForFriendsOnly: true,
};

const cache = new Map();

export function getSetting(key) {
  if (cache.has(key)) return cache.get(key);
  const row = q('SELECT value FROM settings WHERE key = ?').get(key);
  const value = row ? JSON.parse(row.value) : DEFAULTS[key];
  cache.set(key, value);
  return value;
}

export function getAllSettings() {
  return Object.fromEntries(Object.keys(DEFAULTS).map((k) => [k, getSetting(k)]));
}

/** Validates and stores the known keys from `patch`; unknown keys are ignored. */
export function updateSettings(patch) {
  for (const [key, def] of Object.entries(DEFAULTS)) {
    if (patch[key] === undefined) continue;
    let value = patch[key];
    if (typeof def === 'boolean') value = !!value;
    else if (typeof def === 'number') {
      value = Number(value);
      if (!Number.isFinite(value) || value < 0) continue;
      value = Math.min(Math.round(value), 100000);
    } else {
      value = String(value).slice(0, key.startsWith('banned') ? 20000 : 2000);
    }
    if (key === 'signupMode' && !['open', 'approval', 'closed'].includes(value)) continue;
    if (key === 'accentColor' && !/^#[0-9a-f]{6}$/i.test(value)) continue;
    if (key === 'siteTitle' && !value.trim()) continue;
    q('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(
      key,
      JSON.stringify(value),
    );
    cache.set(key, value);
  }
  return getAllSettings();
}

/** Public subset served to every client (also before login). */
export function publicConfig() {
  const s = getAllSettings();
  return {
    siteTitle: s.siteTitle,
    siteDescription: s.siteDescription,
    signupMode: s.signupMode,
    maintenance: s.maintenance,
    maintenanceMessage: s.maintenanceMessage,
    accentColor: s.accentColor,
    aurora: s.aurora,
  };
}

const lines = (text) =>
  String(text)
    .split(/\r?\n/)
    .map((l) => l.trim().toLowerCase())
    .filter(Boolean);

export function isEmailBanned(email) {
  const e = email.toLowerCase();
  return lines(getSetting('bannedEmails')).some((rule) => (rule.startsWith('*@') ? e.endsWith(rule.slice(1)) : e === rule));
}

export function isIpBanned(ip) {
  if (!ip) return false;
  return lines(getSetting('bannedIps')).some((rule) => (rule.endsWith('*') ? ip.startsWith(rule.slice(0, -1)) : ip === rule));
}

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Replaces censored words with asterisks (whole words, case-insensitive, Cyrillic-aware). */
export function censor(text) {
  const words = lines(getSetting('bannedWords'));
  if (!words.length || !text) return text;
  const re = new RegExp(`(?<![\\p{L}\\p{N}])(${words.map(escapeRe).join('|')})(?![\\p{L}\\p{N}])`, 'giu');
  return text.replace(re, (m) => '*'.repeat(m.length));
}
