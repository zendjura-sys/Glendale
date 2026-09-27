import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { AsyncLocalStorage } from 'node:async_hooks';

/**
 * Server-side translations share the client dictionaries (/locales/*.json): the Russian source text is the key.
 * The request language comes from the Accept-Language header (sent by the web client).
 */
const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../locales');
export const LANGS = ['uk', 'en', 'zh', 'de', 'fr', 'es', 'ru', 'ja', 'kk'];
const dicts = Object.fromEntries(
  LANGS.map((l) => {
    try {
      return [l, JSON.parse(fs.readFileSync(path.join(dir, `${l}.json`), 'utf8'))];
    } catch {
      return [l, {}];
    }
  }),
);

const store = new AsyncLocalStorage();

export function pickLang(header) {
  for (const part of String(header || '').split(',')) {
    const code = part.trim().split(';')[0].toLowerCase().split('-')[0];
    if (LANGS.includes(code)) return code;
  }
  return 'uk';
}

/** Express middleware: remembers the request language for the rest of the request. */
export function languageMiddleware(req, _res, next) {
  req.lang = pickLang(req.get('accept-language'));
  store.run({ lang: req.lang }, next);
}

export const currentLang = () => store.getStore()?.lang ?? 'uk';

export function translate(message, params, lang = currentLang()) {
  const s = (dicts[lang] && dicts[lang][message]) || message;
  return params ? s.replace(/\{(\w+)\}/g, (m, k) => (params[k] !== undefined ? String(params[k]) : m)) : s;
}
