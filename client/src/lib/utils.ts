import type { UserShort } from './types';

export const fullName = (u: Pick<UserShort, 'firstName' | 'lastName'>) => `${u.firstName} ${u.lastName}`;

const MONTHS = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
const MONTHS_FULL = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];

const pad = (n: number) => String(n).padStart(2, '0');
const hm = (d: Date) => `${d.getHours()}:${pad(d.getMinutes())}`;

function dayDiff(ts: number) {
  const d = new Date(ts);
  const today = new Date();
  const a = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const b = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  return Math.round((b - a) / 86_400_000);
}

export function plural(n: number, one: string, few: string, many: string) {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}

/** VK-style relative date: "только что", "5 минут назад", "сегодня в 14:05", "12 мар в 9:00". */
export function formatDate(ts: number) {
  const diff = Date.now() - ts;
  if (diff < 60_000) return 'только что';
  if (diff < 3_600_000) {
    const m = Math.floor(diff / 60_000);
    return `${m} ${plural(m, 'минуту', 'минуты', 'минут')} назад`;
  }
  const d = new Date(ts);
  const days = dayDiff(ts);
  if (days === 0) return `сегодня в ${hm(d)}`;
  if (days === 1) return `вчера в ${hm(d)}`;
  const year = d.getFullYear() !== new Date().getFullYear() ? ` ${d.getFullYear()}` : '';
  return `${d.getDate()} ${MONTHS[d.getMonth()]}${year} в ${hm(d)}`;
}

/** Short time for dialog lists: "14:05", "вчера", "12 мар". */
export function formatShort(ts: number) {
  const d = new Date(ts);
  const days = dayDiff(ts);
  if (days === 0) return hm(d);
  if (days === 1) return 'вчера';
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

export const formatTime = (ts: number) => hm(new Date(ts));

export function formatDay(ts: number) {
  const days = dayDiff(ts);
  if (days === 0) return 'Сегодня';
  if (days === 1) return 'Вчера';
  const d = new Date(ts);
  const year = d.getFullYear() !== new Date().getFullYear() ? ` ${d.getFullYear()}` : '';
  return `${d.getDate()} ${MONTHS_FULL[d.getMonth()]}${year}`;
}

export function formatBirthday(value: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return value;
  return `${Number(m[3])} ${MONTHS_FULL[Number(m[2]) - 1]} ${m[1]} г.`;
}

export function lastSeenText(u: UserShort) {
  if (u.online) return 'онлайн';
  return `был(а) в сети ${formatDate(u.lastSeen)}`;
}

export function countLabel(n: number, one: string, few: string, many: string) {
  return `${n.toLocaleString('ru-RU')} ${plural(n, one, few, many)}`;
}
