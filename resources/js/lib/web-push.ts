import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';

export type WebPushState = {
    /** Браузер уміє Web Push (на iPhone — лише сайт, доданий на головний екран). */
    supported: boolean;
    permission: NotificationPermission | 'unsupported';
    subscribed: boolean;
    busy: boolean;
    error: string | null;
    enable: () => Promise<void>;
    disable: () => Promise<void>;
};

function isSupported(): boolean {
    return (
        typeof window !== 'undefined' &&
        window.isSecureContext &&
        'serviceWorker' in navigator &&
        'PushManager' in window &&
        'Notification' in window
    );
}

function keyBytes(base64url: string): Uint8Array<ArrayBuffer> {
    const padded = (base64url + '='.repeat((4 - (base64url.length % 4)) % 4))
        .replace(/-/g, '+')
        .replace(/_/g, '/');
    const raw = window.atob(padded);
    const bytes = new Uint8Array(new ArrayBuffer(raw.length));
    for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);

    return bytes;
}

async function registration(): Promise<ServiceWorkerRegistration> {
    return navigator.serviceWorker.register('/sw.js', { scope: '/' });
}

/** Сповіщення сайту в браузері: стан і ввімкнення/вимкнення. */
export function useWebPush(): WebPushState {
    const supported = isSupported();
    const [permission, setPermission] = useState<WebPushState['permission']>(
        supported ? Notification.permission : 'unsupported',
    );
    const [subscribed, setSubscribed] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!supported) return;
        navigator.serviceWorker
            .getRegistration('/')
            .then((reg) => reg?.pushManager.getSubscription())
            .then((sub) => setSubscribed(Boolean(sub)))
            .catch(() => setSubscribed(false));
    }, [supported]);

    const enable = useCallback(async () => {
        if (!supported) return;
        setBusy(true);
        setError(null);
        try {
            const result = await Notification.requestPermission();
            setPermission(result);
            if (result !== 'granted') return;
            const { key } = await api<{ key: string }>('GET', '/push/web/key');
            const reg = await registration();
            await navigator.serviceWorker.ready;
            const existing = await reg.pushManager.getSubscription();
            const sub =
                existing ??
                (await reg.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey: keyBytes(key),
                }));
            await api(
                'POST',
                '/push/web',
                sub.toJSON() as Record<string, unknown>,
            );
            setSubscribed(true);
        } catch (e) {
            setError(e instanceof Error ? e.message : String(e));
        } finally {
            setBusy(false);
        }
    }, [supported]);

    const disable = useCallback(async () => {
        if (!supported) return;
        setBusy(true);
        setError(null);
        try {
            const reg = await navigator.serviceWorker.getRegistration('/');
            const sub = await reg?.pushManager.getSubscription();
            if (sub) {
                await api('DELETE', '/push/web', { endpoint: sub.endpoint });
                await sub.unsubscribe();
            }
            setSubscribed(false);
        } catch (e) {
            setError(e instanceof Error ? e.message : String(e));
        } finally {
            setBusy(false);
        }
    }, [supported]);

    return { supported, permission, subscribed, busy, error, enable, disable };
}
