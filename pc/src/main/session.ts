import { safeStorage } from 'electron';
import type { CoreStore } from './native';

/** Сервер GameCon (для локальної перевірки — GAMECON_API=http://127.0.0.1:8123). */
export const API_ROOT = (process.env.GAMECON_API ?? 'https://gamecon.online').replace(/\/$/, '');

/** Форма з файлами (звіти з доказами, фото): поля й файли передаються з інтерфейсу як є. */
export type Upload = { __form: true; fields: Record<string, string | number | boolean | (string | number)[] | null | undefined>; files: { field: string; name: string; type: string; data: ArrayBuffer }[] };
const isUpload = (b: unknown): b is Upload => !!b && typeof b === 'object' && (b as { __form?: unknown }).__form === true;

export type ApiResult = { ok: true; status: number; data: unknown } | { ok: false; status: number; message: string };

/**
 * Сесія й запити до API — лише в Main: токен шифрується засобами ОС (safeStorage) і ніколи не
 * потрапляє в інтерфейс, а запити з Node не впираються в CORS.
 */
export class Session {
    private token: string | null = null;

    constructor(private readonly store: CoreStore) {
        const saved = store.get('session') as { token?: string; encrypted?: boolean } | null;
        if (saved?.token) {
            try {
                this.token = saved.encrypted ? safeStorage.decryptString(Buffer.from(saved.token, 'base64')) : saved.token;
            } catch {
                this.token = null;
            }
        }
    }

    get signedIn(): boolean {
        return this.token !== null;
    }

    save(token: string): void {
        this.token = token;
        const encrypted = safeStorage.isEncryptionAvailable();
        this.store.set('session', { token: encrypted ? safeStorage.encryptString(token).toString('base64') : token, encrypted });
    }

    clear(): void {
        this.token = null;
        this.store.set('session', null);
    }

    async request(method: string, path: string, body?: unknown): Promise<ApiResult> {
        const url = path.startsWith('http') ? path : `${API_ROOT}${path}`;
        let payload: BodyInit | undefined;
        if (isUpload(body)) {
            const form = new FormData();
            for (const [k, v] of Object.entries(body.fields)) {
                if (v === null || v === undefined) continue;
                if (Array.isArray(v)) v.forEach((x) => form.append(`${k}[]`, String(x)));
                else form.append(k, typeof v === 'boolean' ? (v ? '1' : '0') : String(v));
            }
            for (const f of body.files) form.append(f.field, new Blob([f.data], { type: f.type }), f.name);
            payload = form;
        } else if (body !== undefined) payload = JSON.stringify(body);
        try {
            const res = await fetch(url, {
                method,
                headers: {
                    Accept: 'application/json',
                    ...(isUpload(body) ? {} : { 'Content-Type': 'application/json' }),
                    'X-Locale': 'uk',
                    'User-Agent': 'GameCon-PC/1.2611',
                    ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
                },
                body: payload,
                signal: AbortSignal.timeout(30_000),
            });
            const text = await res.text();
            let data: unknown = null;
            try {
                data = text ? (JSON.parse(text) as unknown) : null;
            } catch {
                data = null;
            }
            if (res.status === 401) this.clear();
            if (!res.ok) {
                const errors = (data as { errors?: Record<string, string[]> } | null)?.errors;
                const first = errors ? Object.values(errors)[0]?.[0] : undefined;
                const message = first ?? (data as { message?: string } | null)?.message ?? `Помилка ${res.status}`;
                return { ok: false, status: res.status, message };
            }
            return { ok: true, status: res.status, data };
        } catch {
            return { ok: false, status: 0, message: 'Немає зв’язку з GameCon.' };
        }
    }

    /** Приватний файл (докази звітів, фото складу) — як data: URL, бо токен є лише тут. */
    async blob(path: string): Promise<string | null> {
        const url = path.startsWith('http') ? path : `${API_ROOT}${path}`;
        if (!url.startsWith(API_ROOT)) return null;
        try {
            const res = await fetch(url, { headers: this.token ? { Authorization: `Bearer ${this.token}` } : {}, signal: AbortSignal.timeout(30_000) });
            if (!res.ok) return null;
            const type = res.headers.get('content-type') ?? 'image/jpeg';
            return `data:${type};base64,${Buffer.from(await res.arrayBuffer()).toString('base64')}`;
        } catch {
            return null;
        }
    }
}
