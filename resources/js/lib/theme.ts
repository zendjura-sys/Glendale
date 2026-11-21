/**
 * Тема сайту: «Неоновий синій» (темна) і «Крижана Арктика» (світла).
 * Вибір: system (як на пристрої), dark, light. Світла тема є лише в стилі «gamecon» (App\Support\Skins);
 * у решті стилів сторінка лишається темною. Перший кадр ставить скрипт у app.blade.php, тут — зміни після.
 */
export type ThemePref = 'system' | 'dark' | 'light' | 'schedule';

/** Чи зараз «темний» час за розкладом (місцевий час пристрою; проміжок може переходити через північ). */
export function isDarkTime(
    from: string,
    to: string,
    now = new Date(),
): boolean {
    const m = now.getHours() * 60 + now.getMinutes();
    const p = (s: string) => {
        const [h, mm] = s.split(':').map(Number);
        return (h || 0) * 60 + (mm || 0);
    };
    const f = p(from);
    const t = p(to);
    return f <= t ? m >= f && m < t : m >= f || m < t;
}

const STORAGE_KEY = 'gc-theme';
const LIGHT_SKINS = ['gamecon'];

export function resolveTheme(pref: string, skin: string): 'light' | 'dark' {
    if (!LIGHT_SKINS.includes(skin)) return 'dark';
    if (pref === 'light') return 'light';
    if (pref === 'dark') return 'dark';
    if (pref === 'schedule') {
        const root = document.documentElement;
        return isDarkTime(
            root.dataset.darkFrom ?? '19:00',
            root.dataset.darkTo ?? '07:00',
        )
            ? 'dark'
            : 'light';
    }

    return window.matchMedia('(prefers-color-scheme: light)').matches
        ? 'light'
        : 'dark';
}

export function applyTheme(pref: string, skin?: string): 'light' | 'dark' {
    const root = document.documentElement;
    const theme = resolveTheme(pref, skin ?? root.dataset.skin ?? 'gamecon');
    const changed = root.dataset.theme !== theme;
    const reduce = window.matchMedia(
        '(prefers-reduced-motion: reduce)',
    ).matches;
    // Зміна теми — плавне переливання старої в нову (View Transitions); без руху — миттєво.
    if (
        changed &&
        !reduce &&
        typeof document.startViewTransition === 'function' &&
        document.visibilityState === 'visible'
    ) {
        root.classList.add('gc-theme-vt');
        const transition = document.startViewTransition(() =>
            setTheme(root, pref, theme),
        );
        const clear = () => root.classList.remove('gc-theme-vt');
        transition.finished.then(clear, clear);

        return theme;
    }
    setTheme(root, pref, theme);

    return theme;
}

function setTheme(root: HTMLElement, pref: string, theme: 'light' | 'dark') {
    root.dataset.theme = theme;
    root.dataset.themePref = pref;
    root.classList.toggle('dark', theme === 'dark');
    root.classList.toggle('light', theme === 'light');
    root.style.colorScheme = theme;
    const meta = document.querySelector<HTMLMetaElement>(
        'meta[name=theme-color]',
    );
    if (meta) meta.content = theme === 'light' ? '#f9fafc' : '#131313';

    // Токени VKUI — одразу, щоб у знімок нового стану потрапили й вони.
    if (root.classList.contains('gc-vk')) {
        root.classList.remove('vkui--vkCom--light', 'vkui--vkCom--dark');
        root.classList.add(`vkui--vkCom--${theme}`);
    }
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
