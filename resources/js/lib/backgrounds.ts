import { useSyncExternalStore } from 'react';
import { tr } from '@/lib/i18n';
import type { SiteBackgroundPrefs, SiteBackgroundPreset } from '@/types';

/** Сцени фону в порядку показу (як Backgrounds::PRESETS на сервері). */
export function BACKGROUNDS(): {
    id: SiteBackgroundPreset;
    name: string;
    hint: string;
}[] {
    return [
        {
            id: 'dune',
            name: tr('Дюна'),
            hint: tr('Пустеля, де день повільно стає ніччю'),
        },
        { id: 'aurora', name: tr('Аврора'), hint: tr('Кольорове сяйво') },
        {
            id: 'night',
            name: tr('Зоряна ніч'),
            hint: tr('Зорі й падаючі метеори'),
        },
        { id: 'ocean', name: tr('Океан'), hint: tr('Хвилі й промені світла') },
        { id: 'mesh', name: tr('Туман'), hint: tr('Теплі розмиті кольори') },
        { id: 'none', name: tr('Без фону'), hint: tr('Однотонне тло') },
    ];
}

export const DEFAULT_BACKGROUND: SiteBackgroundPrefs = {
    preset: 'dune',
    motion: true,
    video: null,
};

/*
 * Попередній перегляд у налаштуваннях: фон міняється одразу, ще до «Зберегти».
 * null — показувати збережене з профілю.
 */
let preview: SiteBackgroundPrefs | null = null;
/** Відеофон сторінки (профіль учасника GameCon+): показується поверх власного вибору гостя. */
let pageVideo: string | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());
const subscribe = (listener: () => void) => {
    listeners.add(listener);

    return () => listeners.delete(listener);
};

export function setBackgroundPreview(value: SiteBackgroundPrefs | null) {
    preview = value;
    notify();
}

export function useBackgroundPreview(): SiteBackgroundPrefs | null {
    return useSyncExternalStore(
        subscribe,
        () => preview,
        () => null,
    );
}

export function setPageBackgroundVideo(id: string | null) {
    pageVideo = id;
    notify();
}

export function usePageBackgroundVideo(): string | null {
    return useSyncExternalStore(
        subscribe,
        () => pageVideo,
        () => null,
    );
}

/** ID відео з посилання YouTube (дзеркало Backgrounds::youtubeId) — для миттєвого перегляду. */
export function youtubeId(url: string): string | null {
    const value = url.trim();
    if (/^[\w-]{11}$/.test(value)) return value;
    try {
        const link = new URL(
            value.includes('://') ? value : `https://${value}`,
        );
        const host = link.hostname.replace(/^(www\.|m\.|music\.)/, '');
        let id: string | null = null;
        if (host === 'youtu.be') id = link.pathname.split('/')[1] ?? null;
        else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
            id =
                link.searchParams.get('v') ??
                link.pathname.match(
                    /^\/(?:shorts|embed|live|v)\/([^/?]+)/,
                )?.[1] ??
                null;
        }

        return id && /^[\w-]{11}$/.test(id) ? id : null;
    } catch {
        return null;
    }
}
