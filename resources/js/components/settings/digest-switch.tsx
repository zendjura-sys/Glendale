import { router, usePage } from '@inertiajs/react';
import { Sunrise } from 'lucide-react';
import { useState } from 'react';
import { SettingsSwitch } from '@/layouts/settings/layout';
import { tr } from '@/lib/i18n';

/**
 * «Ранковий дайджест»: одне налаштування сайту й застосунку, зберігається одразу.
 * Якщо сервер відмовив — перемикач повертається назад.
 */
export function DigestSwitch() {
    const saved = usePage().props.auth.user?.morning_digest !== false;
    const [pending, setPending] = useState<boolean | null>(null);

    return (
        <SettingsSwitch
            icon={<Sunrise />}
            label={tr('Ранковий дайджест')}
            hint={tr(
                'О 9:00 — що чекає сьогодні: події, турніри, дні народження друзів і непрочитане',
            )}
            checked={pending ?? saved}
            onChange={(on) => {
                setPending(on);
                router.patch(
                    '/settings/digest',
                    { morning_digest: on },
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
