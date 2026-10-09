import { usePage } from '@inertiajs/react';
import { useEffect } from 'react';

/**
 * Палітра акаунта на <html data-palette>. Рендериться в макетах, а не в withApp:
 * usePage() працює лише всередині сторінки Inertia.
 */
export function PaletteSync() {
    const palette = usePage().props.auth.user?.palette ?? 'aurora';

    useEffect(() => {
        document.documentElement.dataset.palette = palette;
    }, [palette]);

    return null;
}
