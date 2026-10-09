import { usePage } from '@inertiajs/react';

/** Увімкнений інтегрований плагін. Невідомий ключ і відсутня мапа лишаються увімкненими. */
export function usePlugin(key: string): boolean {
    const plugins = usePage().props.plugins;

    return plugins?.[key] !== false;
}
