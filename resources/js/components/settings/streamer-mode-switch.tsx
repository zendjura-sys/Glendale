import { router, usePage } from '@inertiajs/react';
import { MonitorPlay } from 'lucide-react';
import { useEffect, useState } from 'react';
import { SettingsSwitch } from '@/layouts/settings/layout';
import { tr } from '@/lib/i18n';
import { usePlugin } from '@/lib/plugins';

/** Позначає <html> класом gc-streamer: особисте ([data-private]) розмивається. */
export function useStreamerMode() {
    const on = usePage().props.auth?.user?.streamer_mode === true;

    useEffect(() => {
        document.documentElement.classList.toggle('gc-streamer', on);
    }, [on]);
}

/** «Режим стримера»: пошта, номер, тексти листування й сповіщень на екрані розмиті. */
export function StreamerModeSwitch() {
    const plugin = usePlugin('streamer_mode');
    const saved = usePage().props.auth.user?.streamer_mode === true;
    const [pending, setPending] = useState<boolean | null>(null);
    if (!plugin) return null;

    return (
        <SettingsSwitch
            icon={<MonitorPlay />}
            label={tr('Режим стримера')}
            hint={tr(
                'Пошта, номер, тексти листування й сповіщень розмиті — можна показувати екран на стрімі',
            )}
            checked={pending ?? saved}
            onChange={(on) => {
                setPending(on);
                router.patch(
                    '/settings/streamer-mode',
                    { streamer_mode: on },
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
