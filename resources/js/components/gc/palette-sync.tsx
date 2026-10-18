import { usePage } from '@inertiajs/react';
import { useEffect } from 'react';

/**
 * Палітра акаунта на <html data-palette>. Рендериться в макетах, а не в withApp:
 * usePage() працює лише всередині сторінки Inertia.
 */
export function PaletteSync() {
    const user = usePage().props.auth.user;
    const palette = user?.palette ?? 'aurora';
    const skin = user?.skin ?? 'flat';

    useEffect(() => {
        document.documentElement.dataset.palette = palette;
    }, [palette]);
    // Стиль інтерфейсу (Налаштування → Вигляд) — так само на <html>.
    useEffect(() => {
        document.documentElement.dataset.skin = skin;
    }, [skin]);

    return null;
}
