import { safeStorage } from 'electron';
import type { CoreStore } from './native';

/** Сервер GameCon (для локальної перевірки — GAMECON_API=http://127.0.0.1:8123). */
export const API_ROOT = (process.env.GAMECON_API ?? 'https://gamecon.online').replace(/\/$/, '');

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
        try {
            const res = await fetch(url, {
                method,
                headers: {
                    Accept: 'application/json',
                    'Content-Type': 'application/json',
                    'X-Locale': 'uk',
                    'User-Agent': 'GameCon-PC/1.2611',
                    ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
                },
                body: body === undefined ? undefined : JSON.stringify(body),
                signal: AbortSignal.timeout(30_000),
            });
            const text = await res.text();
            const data = text ? (JSON.parse(text) as unknown) : null;
            if (res.status === 401) this.clear();
            if (!res.ok) {
                const message = (data as { message?: string } | null)?.message ?? `Помилка ${res.status}`;
                return { ok: false, status: res.status, message };
            }
            return { ok: true, status: res.status, data };
        } catch {
            return { ok: false, status: 0, message: 'Немає зв’язку з GameCon.' };
        }
    }
}
