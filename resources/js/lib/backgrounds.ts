import { useSyncExternalStore } from 'react';
import { tr } from '@/lib/i18n';
import type {
    SiteBackgroundPrefs,
    SiteBackgroundPreset,
    VideoBackground,
} from '@/types';

/** Сцени фону в порядку показу (як Backgrounds::presets() на сервері); фірмовий — якщо завантажений. */
export function BACKGROUNDS(custom = false): {
    id: SiteBackgroundPreset;
    name: string;
    hint: string;
}[] {
    return [
        ...(custom
            ? [
                  {
                      id: 'custom' as const,
                      name: tr('Фірмовий'),
                      hint: tr('Фон від команди GameCon'),
                  },
              ]
            : []),
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
    preset: 'aurora',
    motion: true,
    video: null,
};

/*
 * Попередній перегляд у налаштуваннях: фон міняється одразу, ще до «Зберегти».
 * null — показувати збережене з профілю.
 */
let preview: SiteBackgroundPrefs | null = null;
/** Відеофон сторінки (профіль учасника GameCon+): показується поверх власного вибору гостя. */
let pageVideo: VideoBackground | null = null;
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

export function setPageBackgroundVideo(video: VideoBackground | null) {
    pageVideo = video;
    notify();
}

export function usePageBackgroundVideo(): VideoBackground | null {
    return useSyncExternalStore(
        subscribe,
        () => pageVideo,
        () => null,
    );
}

const PHONE = '(max-width: 767px)';

/** Смартфон чи ПК/планшет — який файл відеофону показувати. */
export function useIsPhone(): boolean {
    return useSyncExternalStore(
        (listener) => {
            const query = window.matchMedia(PHONE);
            query.addEventListener('change', listener);

            return () => query.removeEventListener('change', listener);
        },
        () => window.matchMedia(PHONE).matches,
        () => false,
    );
}

/** Файл відеофону під екран: вертикальний для смартфона, горизонтальний для ПК і планшета. */
export function videoSource(
    video: VideoBackground,
    phone: boolean,
): string | null {
    return phone
        ? (video.mobile ?? video.desktop)
        : (video.desktop ?? video.mobile);
}
