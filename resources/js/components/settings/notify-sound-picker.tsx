import { router, usePage } from '@inertiajs/react';
import { Volume2, VolumeX } from 'lucide-react';
import { useState } from 'react';
import { tr } from '@/lib/i18n';
import { NOTIFY_SOUNDS, playNotifySound } from '@/lib/sounds';
import type { NotifySound } from '@/lib/sounds';
import { cn } from '@/lib/utils';

const LABELS: Record<NotifySound, string> = {
    off: tr('Без звуку'),
    soft: tr('Дзвіночок'),
    pixel: tr('8-біт'),
    arcade: tr('Монетка'),
    drop: tr('Крапля'),
};

/** Звук нових повідомлень і сповіщень: вибір одразу зберігається й програється для прослуховування. */
export function NotifySoundPicker() {
    const saved = (usePage().props.auth.user?.notify_sound ??
        'soft') as NotifySound;
    const [value, setValue] = useState<NotifySound>(saved);

    return (
        <div className="flex flex-wrap gap-2 px-4 py-3">
            {NOTIFY_SOUNDS.map((sound) => {
                const Icon = sound === 'off' ? VolumeX : Volume2;

                return (
                    <button
                        key={sound}
                        type="button"
                        aria-pressed={value === sound}
                        onClick={() => {
                            setValue(sound);
                            playNotifySound(sound, true);
                            router.patch(
                                '/settings/notify-sound',
                                { notify_sound: sound },
                                {
                                    preserveScroll: true,
                                    preserveState: true,
                                    onError: () => setValue(saved),
                                },
                            );
                        }}
                        className={cn(
                            'inline-flex min-h-11 items-center gap-2 rounded-control px-3 text-sm transition',
                            value === sound
                                ? 'bg-white text-gc-ink'
                                : 'bg-white/[0.06] text-white/75 hover:bg-white/10',
                        )}
                    >
                        <Icon className="size-4" />
                        {LABELS[sound]}
                    </button>
                );
            })}
        </div>
    );
}
