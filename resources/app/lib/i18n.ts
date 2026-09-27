/**
 * Minimal i18n: the Russian source string is the message key (gettext style), each language has a flat
 * dictionary `{ source: translation }` in /locales. Missing keys fall back to the source text.
 *
 *   tr('Новости')                         → "Новини"
 *   tr('Удалить {name}?', { name })       → interpolation with {placeholders}
 *   tp(3, 'друг|друга|друзей')           → plural forms; translations list the forms their language needs,
 *                                           in Intl.PluralRules order (e.g. en "friend|friends", ja "友達")
 */
import uk from '../locales/uk.json';

// The default language ships in the main bundle; the others are separate chunks loaded on demand.
const LOADERS = import.meta.glob<{ default: Record<string, string> }>(['../locales/*.json', '!../locales/uk.json']);

export const LANGUAGES = [
  { code: 'uk', name: 'Українська', flag: '🇺🇦' },
  { code: 'en', name: 'English', flag: '🇬🇧' },
  { code: 'zh', name: '中文', flag: '🇨🇳' },
  { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
  { code: 'fr', name: 'Français', flag: '🇫🇷' },
  { code: 'es', name: 'Español', flag: '🇪🇸' },
  { code: 'ru', name: 'Русский', flag: '🏳️' },
  { code: 'ja', name: '日本語', flag: '🇯🇵' },
  { code: 'kk', name: 'Қазақша', flag: '🇰🇿' },
] as const;

export type Lang = (typeof LANGUAGES)[number]['code'];
export const DEFAULT_LANG: Lang = 'uk';

const DICTS: Partial<Record<Lang, Record<string, string>>> = { uk, ru: {} };

/** Loads a language's dictionary (no-op when already loaded). Missing files fall back to source text. */
export async function loadLang(lang: Lang) {
  if (DICTS[lang]) return;
  const load = LOADERS[`../locales/${lang}.json`];
  DICTS[lang] = load ? (await load()).default : {};
}

/** BCP-47 tags for Intl (dates, numbers, plural rules). */
const LOCALE: Record<Lang, string> = { uk: 'uk-UA', en: 'en-GB', zh: 'zh-CN', de: 'de-DE', fr: 'fr-FR', es: 'es-ES', ru: 'ru-RU', ja: 'ja-JP', kk: 'kk-KZ' };

const STORAGE_KEY = 'lang';
const isLang = (v: unknown): v is Lang => LANGUAGES.some((l) => l.code === v);

function initial(): Lang {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (isLang(saved)) return saved;
  } catch {
    /* storage unavailable */
  }
  return DEFAULT_LANG;
}

let current: Lang = initial();
let explicit = (() => {
  try {
    return isLang(localStorage.getItem(STORAGE_KEY));
  } catch {
    return false;
  }
})();
const listeners = new Set<() => void>();

export const getLang = () => current;
export const locale = () => LOCALE[current];
/** True once the visitor picked a language themselves (then the site default no longer applies). */
export const hasExplicitLang = () => explicit;

export async function setLang(lang: Lang, remember = true) {
  if (!isLang(lang)) return;
  if (remember) {
    explicit = true;
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      /* storage unavailable */
    }
  }
  if (lang === current) return;
  await loadLang(lang);
  current = lang;
  document.documentElement.lang = lang;
  listeners.forEach((l) => l());
}

export function onLangChange(fn: () => void) {
  listeners.add(fn);
  return () => void listeners.delete(fn);
}

const fill = (s: string, params?: Record<string, string | number>) =>
  params ? s.replace(/\{(\w+)\}/g, (m, k) => (params[k] !== undefined ? String(params[k]) : m)) : s;

export function tr(key: string, params?: Record<string, string | number>) {
  return fill(DICTS[current]?.[key] || key, params);
}

const CATEGORY_ORDER = ['zero', 'one', 'two', 'few', 'many', 'other'] as const;
const rulesCache = new Map<string, { rules: Intl.PluralRules; cats: string[] }>();
function pluralInfo(lang: Lang) {
  let hit = rulesCache.get(lang);
  if (!hit) {
    const rules = new Intl.PluralRules(LOCALE[lang]);
    // Integer categories only, in canonical order: ru/uk → one|few|many, en → one|other, ja/zh → other.
    const cats = CATEGORY_ORDER.filter((c) => rules.resolvedOptions().pluralCategories.includes(c) && c !== 'zero' && c !== 'two');
    hit = { rules, cats: lang === 'ru' || lang === 'uk' ? ['one', 'few', 'many'] : cats };
    rulesCache.set(lang, hit);
  }
  return hit;
}

/** Picks the plural form of `forms` (pipe-separated) for `n` in the current language. */
export function tp(n: number, forms: string, params?: Record<string, string | number>) {
  const translated = (DICTS[current]?.[forms] || forms).split('|');
  // Untranslated keys are Russian forms: pick with Russian rules.
  const lang: Lang = DICTS[current]?.[forms] ? current : 'ru';
  const { rules, cats } = pluralInfo(lang);
  const cat = rules.select(Math.abs(n));
  let idx = cats.indexOf(cat === 'many' && !cats.includes('many') ? 'other' : cat);
  if (idx < 0) idx = cats.indexOf('other');
  if (idx < 0 || idx >= translated.length) idx = translated.length - 1;
  return fill(translated[idx], { n, ...params });
}

/** "5 друзей" in any language: number + correct form. */
export const countLabel = (n: number, forms: string) => `${n.toLocaleString(locale())} ${tp(n, forms)}`;
