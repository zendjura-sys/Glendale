import { usePage } from '@inertiajs/react';
import { useEffect } from 'react';
import { applyTheme, followSystemTheme, readGuestTheme } from '@/lib/theme';

/** Застосувати свій акцент (або повернути колір стилю, якщо null). */
export function applyAccent(color: string | null) {
    const root = document.documentElement;
    if (color) {
        root.dataset.accent = '';
        root.style.setProperty('--user-accent', color);
    } else {
        delete root.dataset.accent;
        root.style.removeProperty('--user-accent');
    }
}

/**
 * Палітра акаунта на <html data-palette>. Рендериться в макетах, а не в withApp:
 * usePage() працює лише всередині сторінки Inertia.
 */
export function PaletteSync() {
    const user = usePage().props.auth.user;
    const palette = user?.palette ?? 'aurora';
    const skin = user?.skin ?? 'gamecon';
    const theme = user ? (user.theme ?? 'system') : readGuestTheme();

    useEffect(() => {
        document.documentElement.dataset.palette = palette;
    }, [palette]);
    // Свій акцентний колір (№296) — перекриває акцент стилю на всьому сайті.
    const accent = user?.accent ?? null;
    useEffect(() => applyAccent(accent), [accent]);
    // Стиль інтерфейсу (Налаштування → Вигляд) — так само на <html>.
    useEffect(() => {
        document.documentElement.dataset.skin = skin;
    }, [skin]);
    // Тема (світла/темна): залежить і від стилю — світла є не в кожному.
    // Розклад темної теми (№231): межі — на <html>, перевірка щохвилини.
    const from = user?.theme_schedule?.from ?? '19:00';
    const to = user?.theme_schedule?.to ?? '07:00';
    useEffect(() => {
        document.documentElement.dataset.darkFrom = from;
        document.documentElement.dataset.darkTo = to;
        if (theme !== 'schedule') return;
        applyTheme('schedule', skin);
        const timer = window.setInterval(
            () => applyTheme('schedule', skin),
            60_000,
        );
        return () => window.clearInterval(timer);
    }, [theme, skin, from, to]);
    useEffect(() => {
        applyTheme(theme, skin);
        if (theme !== 'system') return;

        return followSystemTheme(() => applyTheme('system', skin));
    }, [theme, skin]);

    return null;
}
