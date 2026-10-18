import { Bookmark } from 'lucide-react';
import { useState } from 'react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { tr } from '@/lib/i18n';

type Kind = 'post' | 'movie' | 'game' | 'server';

export function SaveButton({
    kind,
    id,
    saved,
    compact = false,
    className,
}: {
    kind: Kind;
    id: number;
    saved: boolean;
    compact?: boolean;
    className?: string;
}) {
    const [on, setOn] = useState(saved);

    const toggle = async () => {
        const previous = on;
        setOn(!previous);
        try {
            const response = await api<{ saved: boolean }>('POST', '/saved', {
                kind,
                id,
            });
            setOn(response.saved);
        } catch {
            setOn(previous);
        }
    };

    return (
        <button
            type="button"
            onClick={toggle}
            aria-pressed={on}
            aria-label={on ? tr('Збережено') : tr('Зберегти')}
            className={cn(
                compact
                    ? 'inline-flex h-9 items-center gap-1.5 rounded-full bg-white/[0.045] px-3.5 text-sm font-medium text-white/65 transition hover:bg-white/[0.08] hover:text-white'
                    : 'inline-flex h-11 items-center gap-2 rounded-xl border border-white/15 bg-white/[0.08] px-4 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/15',
                on && 'text-gc-lilac-200',
                className,
            )}
        >
            <Bookmark className={cn('size-4', on && 'fill-current')} />
            {!compact && (on ? tr('Збережено') : tr('Зберегти'))}
        </button>
    );
}
