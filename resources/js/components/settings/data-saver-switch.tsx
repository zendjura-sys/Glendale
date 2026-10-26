import { router, usePage } from '@inertiajs/react';
import { Gauge } from 'lucide-react';
import { useState } from 'react';
import { SettingsSwitch } from '@/layouts/settings/layout';
import { tr } from '@/lib/i18n';

/** «Економія трафіку»: фото в стрічці по дотику, відео й живий фон не грають самі. */
export function DataSaverSwitch() {
    const saved = usePage().props.auth.user?.data_saver === true;
    const [pending, setPending] = useState<boolean | null>(null);

    return (
        <SettingsSwitch
            icon={<Gauge />}
            label={tr('Економія трафіку')}
            hint={tr(
                'Фото в стрічці завантажуються по дотику, відео й живий фон не грають самі',
            )}
            checked={pending ?? saved}
            onChange={(on) => {
                setPending(on);
                router.patch(
                    '/settings/data-saver',
                    { data_saver: on },
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
