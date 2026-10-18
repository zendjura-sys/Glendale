/**
 * Тема сайту: «Неоновий синій» (темна) і «Крижана Арктика» (світла).
 * Вибір: system (як на пристрої), dark, light. Світла тема є лише в стилі «gamecon» (App\Support\Skins);
 * у решті стилів сторінка лишається темною. Перший кадр ставить скрипт у app.blade.php, тут — зміни після.
 */
export type ThemePref = 'system' | 'dark' | 'light';

const STORAGE_KEY = 'gc-theme';
const LIGHT_SKINS = ['gamecon'];

export function resolveTheme(pref: string, skin: string): 'light' | 'dark' {
    if (!LIGHT_SKINS.includes(skin)) return 'dark';
    if (pref === 'light') return 'light';
    if (pref === 'dark') return 'dark';

    return window.matchMedia('(prefers-color-scheme: light)').matches
        ? 'light'
        : 'dark';
}

export function applyTheme(pref: string, skin?: string): 'light' | 'dark' {
    const root = document.documentElement;
    const theme = resolveTheme(pref, skin ?? root.dataset.skin ?? 'gamecon');
    root.dataset.theme = theme;
    root.dataset.themePref = pref;
    root.classList.toggle('dark', theme === 'dark');
    root.classList.toggle('light', theme === 'light');
    root.style.colorScheme = theme;
    const meta = document.querySelector<HTMLMetaElement>(
        'meta[name=theme-color]',
    );
    if (meta) meta.content = theme === 'light' ? '#e9f1f8' : '#05070f';

    return theme;
}

/** Вибір гостя (без акаунта) живе лише в цьому браузері. */
export function readGuestTheme(): ThemePref {
    try {
        const value = localStorage.getItem(STORAGE_KEY);

        return value === 'light' || value === 'dark' ? value : 'system';
    } catch {
        return 'system';
    }
}

export function saveGuestTheme(pref: ThemePref): void {
    try {
        localStorage.setItem(STORAGE_KEY, pref);
    } catch {
        // Приватне вікно — вибір діє до перезавантаження.
    }
}

/** «Як на пристрої»: стежимо за перемиканням теми в системі. Повертає відписку. */
export function followSystemTheme(onChange: () => void): () => void {
    const query = window.matchMedia('(prefers-color-scheme: light)');
    query.addEventListener('change', onChange);

    return () => query.removeEventListener('change', onChange);
}
