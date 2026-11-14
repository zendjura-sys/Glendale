import { router, usePage } from '@inertiajs/react';
import { Headphones } from 'lucide-react';
import { useState } from 'react';
import { SettingsSwitch } from '@/layouts/settings/layout';
import { tr } from '@/lib/i18n';

/** Чи бачать інші, що людина слухає (одне налаштування сайту й застосунку для всієї музики). */
export function useShowListening(): boolean {
    return usePage().props.auth.user?.show_listening !== false;
}

/**
 * «Показувати, що я слухаю»: зберігається одразу, без кнопки «Зберегти».
 * Перемикач змінюється відразу, а якщо сервер відмовив — повертається назад.
 */
export function ListeningSwitch() {
    const saved = useShowListening();
    const [pending, setPending] = useState<boolean | null>(null);

    return (
        <SettingsSwitch
            icon={<Headphones />}
            label={tr('Показувати, що я слухаю')}
            hint={tr('Друзі бачать трек у профілі й у «Зараз слухають»')}
            checked={pending ?? saved}
            onChange={(on) => {
                setPending(on);
                router.patch(
                    '/settings/listening',
                    { show_listening: on },
                    {
                        preserveScroll: true,
                        preserveState: true,
                        onFinish: () => setPending(null),
                    },
                );
            }}
        />
    );
}
