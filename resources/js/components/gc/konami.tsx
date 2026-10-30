import { usePage } from '@inertiajs/react';
import { useEffect } from 'react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { tr } from '@/lib/i18n';
import { usePlugin } from '@/lib/plugins';

const CODE = [
    'ArrowUp',
    'ArrowUp',
    'ArrowDown',
    'ArrowDown',
    'ArrowLeft',
    'ArrowRight',
    'ArrowLeft',
    'ArrowRight',
    'b',
    'a',
];

/** Пасхалка: старий код відкриває секретне досягнення. */
export function Konami() {
    const on = usePlugin('secret_achievements');
    const signedIn = Boolean(usePage().props.auth.user);

    useEffect(() => {
        if (!on || !signedIn) return;
        let step = 0;
        const onKey = (event: KeyboardEvent) => {
            const key =
                event.key.length === 1 ? event.key.toLowerCase() : event.key;
            step = key === CODE[step] ? step + 1 : key === CODE[0] ? 1 : 0;
            if (step < CODE.length) return;
            step = 0;
            void api<{ unlocked: boolean }>('POST', '/secrets/konami').then(
                (data) => {
                    if (data.unlocked) {
                        toast.success(tr('Секретне досягнення: «Старий код»'));
                    }
                },
            );
        };
        window.addEventListener('keydown', onKey);

        return () => window.removeEventListener('keydown', onKey);
    }, [on, signedIn]);

    return null;
}
