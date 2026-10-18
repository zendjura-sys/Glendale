import { Bell } from 'lucide-react';
import { useState } from 'react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { tr } from '@/lib/i18n';

export function FollowButton({
    kind,
    id,
    following,
    className,
}: {
    kind: 'game' | 'server';
    id: number;
    following: boolean;
    className?: string;
}) {
    const [on, setOn] = useState(following);

    const toggle = async () => {
        const previous = on;
        setOn(!previous);
        try {
            const response = await api<{ following: boolean }>(
                'POST',
                '/follows',
                { kind, id },
            );
            setOn(response.following);
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
                on && 'border-gc-lilac-400/40 text-gc-lilac-200',
                className,
            )}
        >
            <Bell className={cn('size-4', on && 'fill-current')} />
            {on ? tr('Друзі в грі') : tr('Коли друг зайде')}
        </button>
    );
}
