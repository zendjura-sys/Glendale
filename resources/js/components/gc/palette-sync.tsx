import { usePage } from '@inertiajs/react';
import { useEffect } from 'react';
import { applyTheme, followSystemTheme, readGuestTheme } from '@/lib/theme';

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
    // Стиль інтерфейсу (Налаштування → Вигляд) — так само на <html>.
    useEffect(() => {
        document.documentElement.dataset.skin = skin;
    }, [skin]);
    // Тема (світла/темна): залежить і від стилю — світла є не в кожному.
    useEffect(() => {
        applyTheme(theme, skin);
        if (theme !== 'system') return;

        return followSystemTheme(() => applyTheme('system', skin));
    }, [theme, skin]);

    return null;
}
