import type { UserShort } from './types';
import { locale, tr, tp } from './i18n';

export { countLabel } from './i18n';

export const fullName = (u: Pick<UserShort, 'firstName' | 'lastName'>) => `${u.firstName} ${u.lastName}`;

/** Plural form for `n`; `forms` are the Russian source forms joined by "|" (translated per language). */
export const plural = (n: number, forms: string) => tp(n, forms);

const time = (d: Date) => d.toLocaleTimeString(locale(), { hour: 'numeric', minute: '2-digit' });

function dayDiff(ts: number) {
  const d = new Date(ts);
  const today = new Date();
  const a = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const b = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  return Math.round((b - a) / 86_400_000);
}

const sameYear = (d: Date) => d.getFullYear() === new Date().getFullYear();

/** Relative post/comment date: "только что", "5 минут назад", "сегодня в 14:05", "12 мар в 9:00". */
export function formatDate(ts: number) {
  const diff = Date.now() - ts;
  if (diff < 60_000) return tr('только что');
  if (diff < 3_600_000) {
    return new Intl.RelativeTimeFormat(locale(), { numeric: 'auto' }).format(-Math.floor(diff / 60_000), 'minute');
  }
  const d = new Date(ts);
  const days = dayDiff(ts);
  if (days === 0) return tr('сегодня в {time}', { time: time(d) });
  if (days === 1) return tr('вчера в {time}', { time: time(d) });
  const date = d.toLocaleDateString(locale(), { day: 'numeric', month: 'short', ...(sameYear(d) ? {} : { year: 'numeric' }) });
  return tr('{date} в {time}', { date, time: time(d) });
}

/** Short time for conversation lists: "14:05", "вчера", "12 мар". */
export function formatShort(ts: number) {
  const d = new Date(ts);
  const days = dayDiff(ts);
  if (days === 0) return time(d);
  if (days === 1) return tr('вчера');
  return d.toLocaleDateString(locale(), { day: 'numeric', month: 'short' });
}

export const formatTime = (ts: number) => time(new Date(ts));

/** Day separator in chats: "Сегодня", "Вчера", "12 марта". */
export function formatDay(ts: number) {
  const days = dayDiff(ts);
  if (days === 0) return tr('Сегодня');
  if (days === 1) return tr('Вчера');
  const d = new Date(ts);
  return d.toLocaleDateString(locale(), { day: 'numeric', month: 'long', ...(sameYear(d) ? {} : { year: 'numeric' }) });
}

export function formatBirthday(value: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return value;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).toLocaleDateString(locale(), { day: 'numeric', month: 'long', year: 'numeric' });
}

export function lastSeenText(u: UserShort) {
  if (u.online) return tr('онлайн');
  return tr('был(а) в сети {when}', { when: formatDate(u.lastSeen) });
}

export const formatNumber = (n: number) => n.toLocaleString(locale());
