import { usePage } from '@inertiajs/react';
import { useEffect, useSyncExternalStore } from 'react';

/** Браузер просить економити дані (Android «Заощадження трафіку», Chrome Lite). */
function browserSaveData(): boolean {
    return Boolean(
        (navigator as Navigator & { connection?: { saveData?: boolean } })
            .connection?.saveData,
    );
}

/** Синхрон для prefetch поза React: `document.documentElement.dataset.dataSaver`. */
export function syncDataSaverFlag(on: boolean): void {
    if (typeof document === 'undefined') return;
    if (on) {
        document.documentElement.dataset.dataSaver = '1';
    } else {
        delete document.documentElement.dataset.dataSaver;
    }
}

/**
 * Режим економії трафіку: увімкнено в Налаштування → Оформлення або браузер просить економити дані.
 * Тоді фото в стрічці вантажаться по дотику, а відео не грає саме.
 */
export function useDataSaver(): boolean {
    const pref = usePage().props.auth?.user?.data_saver === true;
    const browser = useSyncExternalStore(
        () => () => {},
        browserSaveData,
        () => false,
    );
    const on = pref || browser;

    useEffect(() => {
        syncDataSaverFlag(on);
    }, [on]);

    return on;
}
