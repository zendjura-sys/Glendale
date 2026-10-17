import { usePage } from '@inertiajs/react';

/** Увімкнений інтегрований плагін. Невідомий ключ і відсутня мапа лишаються увімкненими. */
export function usePlugin(key: string): boolean {
    const plugins = usePage().props.plugins;

    return plugins?.[key] !== false;
}

/** Можливість інтерфейсу за режимом соцмережі (історії, трансляції, «Граю в…»). */
export function useFeature(key: 'stories' | 'live' | 'playing'): boolean {
    return usePage().props.features?.[key] !== false;
}
