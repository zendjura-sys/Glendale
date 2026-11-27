import { useCallback, useEffect, useRef, useState } from 'react';

export type User = { id: number; name: string; username?: string; avatar_url?: string | null; is_online?: boolean; first_name?: string };

/** Запит до GameCon через Main (токен там); помилка — Error з українським текстом сервера. */
export async function api<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await window.gamecon.request<T>(method, path, body);
    if (!res.ok) throw new Error(res.message);
    return res.data;
}

/**
 * Дані модуля: завантаження, оновлення кожні `every` мс і за подіями синхронізації з інших вікон
 * (наприклад, повідомлення, надіслане у віджеті, одразу з’являється в єдиному вікні).
 */
export function useLive<T>(path: string | null, every: number, topics: string[] = []): { data: T | null; error: string | null; reload: () => Promise<void> } {
    const [data, setData] = useState<T | null>(null);
    const [error, setError] = useState<string | null>(null);
    const topicsRef = useRef(topics);
    const reload = useCallback(async () => {
        if (!path) return;
        try {
            setData(await api<T>('GET', path));
            setError(null);
        } catch (e) {
            setError((e as Error).message);
        }
    }, [path]);
    useEffect(() => {
        void reload();
        const timer = window.setInterval(() => void reload(), every);
        const off = window.gamecon.sync.on(({ topic }) => {
            if (topicsRef.current.includes(topic)) void reload();
        });
        return () => {
            window.clearInterval(timer);
            off();
        };
    }, [reload, every]);
    return { data, error, reload };
}

export function ago(iso?: string | null): string {
    if (!iso) return '';
    const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
    if (s < 60) return 'щойно';
    if (s < 3600) return `${Math.floor(s / 60)} хв тому`;
    if (s < 86400) return `${Math.floor(s / 3600)} год тому`;
    return new Date(iso).toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' });
}
