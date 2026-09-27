import { q } from './db.js';

/** Site-wide settings managed from the admin panel. Stored as JSON in the `settings` table. */
export const DEFAULTS = {
  siteTitle: 'Glendale',
  siteDescription: 'Соціальна мережа для спілкування з друзями та спільнотами',
  signupMode: 'open', // 'open' | 'approval' | 'closed'
  maintenance: false,
  maintenanceMessage: 'Ми проводимо технічні роботи й скоро повернемося.',
  bannedEmails: '', // one per line; "*@domain.com" bans a whole domain
  bannedIps: '', // one per line; a trailing "*" matches a prefix
  bannedWords: '', // one per line; replaced with *** in posts, comments and messages
  lockAttempts: 5, // failed logins before the account is temporarily locked (0 = off)
  lockMinutes: 15,
  accentColor: '#4c5bf5',
  aurora: true,
  wallForFriendsOnly: true,
  spotifyClientId: '',
  spotifyClientSecret: '',
  spotifyMarket: 'UA', // country for catalog requests made with the app token
  googleClientId: '',
  googleClientSecret: '',
  // Digital Asset Links for the Android app (JSON from PWABuilder / Bubblewrap), served at /.well-known/assetlinks.json.
  androidAssetLinks: '',
  defaultLanguage: 'uk',
};

/** Never sent back to the browser; the admin panel only sees whether they are set. */
export const SECRET_KEYS = ['spotifyClientSecret', 'googleClientSecret'];

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

function isJsonArray(text) {
  try {
    return Array.isArray(JSON.parse(text));
  } catch {
    return false;
  }
}

/** Settings for the admin panel: secrets are replaced by `<key>Set` flags. */
export function adminSettings() {
  const all = getAllSettings();
  for (const key of SECRET_KEYS) {
    all[`${key}Set`] = !!String(all[key] || '').trim();
    all[key] = '';
  }
  return all;
}

/**
 * Validates and stores the known keys from `patch`; unknown keys are ignored.
 * Secrets: an empty string keeps the stored value, `null` clears it.
 */
export function updateSettings(patch) {
  for (const [key, def] of Object.entries(DEFAULTS)) {
    if (patch[key] === undefined) continue;
    let value = patch[key];
    if (SECRET_KEYS.includes(key)) {
      if (value === '') continue;
      if (value === null) value = '';
    }
    if (typeof def === 'boolean') value = !!value;
    else if (typeof def === 'number') {
      value = Number(value);
      if (!Number.isFinite(value) || value < 0) continue;
      value = Math.min(Math.round(value), 100000);
    } else {
      value = String(value).slice(0, key.startsWith('banned') || key === 'androidAssetLinks' ? 20000 : 2000);
    }
    if (key === 'signupMode' && !['open', 'approval', 'closed'].includes(value)) continue;
    if (key === 'accentColor' && !/^#[0-9a-f]{6}$/i.test(value)) continue;
    if (['spotifyClientId', 'spotifyClientSecret'].includes(key) && value && !/^[0-9a-zA-Z]{16,64}$/.test(value.trim())) continue;
    if (key === 'spotifyMarket' && !/^[A-Z]{2}$/.test(value)) continue;
    if (key === 'androidAssetLinks' && value.trim() && !isJsonArray(value)) continue;
    if (key === 'googleClientId' && value && !/^[\w.-]{10,200}\.apps\.googleusercontent\.com$/.test(value.trim())) continue;
    if (key === 'googleClientSecret' && value && !/^[\w-]{10,100}$/.test(value.trim())) continue;
    if (typeof value === 'string' && (key.endsWith('ClientId') || SECRET_KEYS.includes(key))) value = value.trim();
    if (key === 'siteTitle' && !value.trim()) continue;
    if (key === 'defaultLanguage' && !['uk', 'en', 'zh', 'de', 'fr', 'es', 'ru', 'ja', 'kk'].includes(value)) continue;
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
    spotifyEnabled: !!String(s.spotifyClientId || '').trim(),
    googleEnabled: !!(String(s.googleClientId || '').trim() && String(s.googleClientSecret || '').trim()),
    // The login page shows demo credentials only when the demo accounts actually exist.
    demoAccounts: !!q("SELECT 1 FROM users WHERE email = 'demo@glendale.app'").get(),
    defaultLanguage: s.defaultLanguage,
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
