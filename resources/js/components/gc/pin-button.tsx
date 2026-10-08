import { Pin } from 'lucide-react';
import { useState } from 'react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { tr } from '@/lib/i18n';

export function PinButton({
    kind,
    id,
    pinned,
}: {
    kind: 'game' | 'server' | 'movie';
    id: number;
    pinned: boolean;
}) {
    const [on, setOn] = useState(pinned);

    const toggle = async () => {
        const previous = on;
        setOn(!previous);
        try {
            const response = await api<{ pinned: boolean }>('POST', '/me/pin', { kind, id });
            setOn(response.pinned);
        } catch {
            setOn(previous);
        }
    };

    return (
        <button
            type="button"
            onClick={toggle}
            aria-pressed={on}
            className={cn(
                'inline-flex h-11 items-center gap-2 rounded-xl border border-white/15 bg-white/[0.08] px-4 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/15',
                on && 'text-gc-lilac-200',
            )}
        >
            <Pin className={cn('size-4', on && 'fill-current')} />
            {on ? tr('На сторінці') : tr('На сторінку')}
        </button>
    );
}
