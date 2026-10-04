import { Heart } from 'lucide-react';
import { useState } from 'react';
import { compactNumber } from '@/lib/format';
import { cn } from '@/lib/utils';
import { tr } from '@/lib/i18n';

type Props = {
    liked: boolean;
    count: number;
    onToggle: () => void;
    size?: 'sm' | 'md';
};

export function LikeButton({ liked, count, onToggle, size = 'md' }: Props) {
    const [burst, setBurst] = useState(0);

    return (
        <button
            type="button"
            onClick={() => {
                if (!liked) setBurst((value) => value + 1);
                onToggle();
            }}
            className={cn(
                'group relative inline-flex items-center gap-1.5 rounded-full font-medium transition',
                size === 'md' ? 'h-9 px-3.5 text-sm' : 'h-7 px-2 text-xs',
                liked
                    ? 'bg-rose-500/[0.14] text-rose-300 shadow-[inset_0_0_0_1px_rgb(244_63_94/0.3)]'
                    : 'bg-white/[0.045] text-white/65 hover:bg-white/[0.08] hover:text-white',
            )}
            aria-pressed={liked}
            aria-label={tr('Подобається')}
        >
            <span className="relative">
                <Heart
                    key={burst}
                    className={cn(
                        size === 'md' ? 'size-[18px]' : 'size-3.5',
                        liked &&
                            'animate-pop fill-rose-500 text-rose-500 drop-shadow-[0_0_8px_rgb(244_63_94/0.8)]',
                    )}
                />
                {burst > 0 && liked && (
                    <span
                        key={`b${burst}`}
                        className="pointer-events-none absolute inset-0"
                    >
                        {Array.from({ length: 6 }).map((_, i) => (
                            <span
                                key={i}
                                className="gc-spark absolute top-1/2 left-1/2 -mt-0.5 -ml-0.5 size-1 rounded-full bg-rose-400"
                                style={
                                    {
                                        '--r': `${i * 60}deg`,
                                    } as React.CSSProperties
                                }
                            />
                        ))}
                    </span>
                )}
            </span>
            {count > 0 && (
                <span className="tabular-nums">{compactNumber(count)}</span>
            )}
        </button>
    );
}
