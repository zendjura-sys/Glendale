import { tr } from './i18n';
import { getLang } from './i18n';

const TOKEN_KEY = 'token';

/** Спільний API платформи: той самий, що й у Flutter-застосунку. */
export const API_BASE = '/api/v2';

/** Шлях, під яким змонтовано SPA (зараз — корінь сайту). */
export const APP_BASE: string = (window as unknown as { APP_BASE?: string }).APP_BASE ?? '';

/** Службові адреси SPA на сервері: вхід, міст сесії, вихід. */
export const PLATFORM = '/platform';

/**
 * Якщо людина вже увійшла на сайті (сесія Laravel), обмінюємо сесію на
 * токен API — щоб не просити входити вдруге. POST із CSRF-токеном сторінки.
 */
export async function bridgeSession(): Promise<boolean> {
  const csrf = document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content;
  if (!csrf) return false;
  try {
    const res = await fetch(`${PLATFORM}/session-token`, {
      method: 'POST',
      headers: { 'X-CSRF-TOKEN': csrf, Accept: 'application/json' },
      credentials: 'same-origin',
    });
    if (!res.ok) return false;
    const data = (await res.json()) as { token?: string };
    if (!data.token) return false;
    setToken(data.token);
    return true;
  } catch {
    return false;
  }
}

export const getToken = () => {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
};

export const setToken = (token: string | null) => {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* storage unavailable */
  }
};

export class ApiError extends Error {
  constructor(public status: number, message: string, public code?: string) {
    super(message);
  }
}

let onUnauthorized: () => void = () => {};
export const setUnauthorizedHandler = (fn: () => void) => (onUnauthorized = fn);

export async function api<T = unknown>(path: string, options: { method?: string; body?: unknown } = {}): Promise<T> {
  const headers: Record<string, string> = { 'Accept-Language': getLang(), Accept: 'application/json' };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  let body: BodyInit | undefined;
  if (options.body instanceof FormData) body = options.body;
  else if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(options.body);
  }

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, { method: options.method ?? (body ? 'POST' : 'GET'), headers, body });
  } catch {
    throw new ApiError(0, tr('Нет соединения с сервером'));
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && token) onUnauthorized();
    if (data.code === 'maintenance') window.dispatchEvent(new Event('maintenance'));
    // Laravel повертає помилки валідації як { message, errors: { поле: [..] } }.
    const firstError = data.errors ? (Object.values(data.errors as Record<string, string[]>)[0]?.[0] ?? null) : null;
    throw new ApiError(res.status, data.error || firstError || data.message || tr('Что-то пошло не так'), data.code);
  }
  return data as T;
}

export const form = (fields: Record<string, string | Blob | null | undefined>) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) if (v != null) fd.append(k, v);
  return fd;
};

/**
 * Особиста розмова — у мессенджері родини (/messenger, сторінки на Vue).
 * Сервер створює або знаходить діалог і перенаправляє в нього, тому це
 * звичайна відправка форми з CSRF-токеном сторінки, а не запит API.
 */
export function openDirect(userId: number) {
  const csrf = document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content ?? '';
  const f = document.createElement('form');
  f.method = 'POST';
  f.action = `/messenger/direct/${userId}`;
  const t = document.createElement('input');
  t.type = 'hidden';
  t.name = '_token';
  t.value = csrf;
  f.appendChild(t);
  document.body.appendChild(f);
  f.submit();
}
