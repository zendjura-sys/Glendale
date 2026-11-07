import { usePage } from '@inertiajs/react';
import { useSyncExternalStore } from 'react';

/** Браузер просить економити дані (Android «Заощадження трафіку», Chrome Lite). */
function browserSaveData(): boolean {
    return Boolean(
        (navigator as Navigator & { connection?: { saveData?: boolean } })
            .connection?.saveData,
    );
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

    return pref || browser;
}
