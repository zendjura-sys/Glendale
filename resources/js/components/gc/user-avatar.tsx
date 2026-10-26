import { initials } from '@/lib/format';
import { cn } from '@/lib/utils';
import { tr } from '@/lib/i18n';
import type { Cosmetics, PlusMark } from '@/types';
import { plusFrameStyle } from './plus';

const sizes = {
    xs: 'size-7 text-xs',
    sm: 'size-9 text-xs',
    md: 'size-11 text-sm',
    lg: 'size-14 text-base',
    xl: 'size-20 text-xl',
    hero: 'size-36 text-4xl sm:size-40',
} as const;

/** Емодзі статусу — кружечок у лівому нижньому куті аватара. */
const emojiSizes = {
    xs: null,
    sm: 'size-4 text-[10px] -bottom-0.5 -left-0.5',
    md: 'size-5 text-[11px] -bottom-0.5 -left-0.5',
    lg: 'size-6 text-[13px] -bottom-0.5 -left-0.5',
    xl: 'size-7 text-[15px] bottom-0 left-0',
    hero: 'size-11 text-2xl bottom-2 left-2',
} as const;

const dotSizes = {
    xs: 'size-2 ring-[1.5px]',
    sm: 'size-2.5 ring-2',
    md: 'size-3 ring-2',
    lg: 'size-3.5 ring-[2.5px]',
    xl: 'size-4 ring-[3px]',
    hero: 'size-6 ring-4 right-3 bottom-3',
} as const;

const palettes = [
    'from-gc-blue to-gc-indigo',
    'from-gc-indigo to-gc-purple',
    'from-gc-purple to-gc-pink',
    'from-gc-cyan to-gc-blue',
    'from-[#1e40af] to-gc-blue',
    'from-[#0e7490] to-gc-cyan',
];

type Props = {
    user: {
        name: string;
        avatar_url: string | null;
        is_online?: boolean;
        id?: number;
        plus?: PlusMark | null;
        cosmetics?: Cosmetics | null;
        status?: string | null;
        status_emoji?: string | null;
    };
    size?: keyof typeof sizes;
    ring?: boolean;
    showOnline?: boolean;
    className?: string;
};

export function UserAvatar({
    user,
    size = 'md',
    ring = false,
    showOnline = true,
    className,
}: Props) {
    const palette = palettes[(user.id ?? user.name.length) % palettes.length];
    // Рамка GameCon+, інакше — вдягнута з сезонного пропуску.
    const frame = user.plus?.frame?.length
        ? user.plus
        : user.cosmetics?.frame?.length
          ? { name: null, frame: user.cosmetics.frame }
          : null;

    const inner = user.avatar_url ? (
        <img
            src={user.avatar_url}
            alt={user.name}
            loading="lazy"
            className="size-full rounded-full object-cover"
        />
    ) : (
        <span
            className={cn(
                'flex size-full items-center justify-center rounded-full bg-gradient-to-br font-display font-semibold text-white',
                palette,
            )}
        >
            {initials(user.name)}
        </span>
    );

    return (
        <span
            className={cn(
                'relative inline-flex shrink-0',
                sizes[size],
                className,
            )}
        >
            {!ring && frame ? (
                <span
                    className="flex size-full rounded-full p-[2px]"
                    style={plusFrameStyle(frame)}
                >
                    <span className="flex size-full overflow-hidden rounded-full bg-void p-[1.5px]">
                        <span className="flex size-full overflow-hidden rounded-full">
                            {inner}
                        </span>
                    </span>
                </span>
            ) : ring ? (
                <span className="ring-gradient flex size-full rounded-full p-[3px]">
                    <span className="flex size-full rounded-full bg-void p-[3px]">
                        {inner}
                    </span>
                </span>
            ) : (
                <span className="flex size-full overflow-hidden rounded-full bg-white/5 ring-1 ring-white/10">
                    {inner}
                </span>
            )}
            {user.status_emoji && emojiSizes[size] && (
                <span
                    className={cn(
                        'absolute flex items-center justify-center rounded-full bg-background leading-none ring-2 ring-background',
                        emojiSizes[size],
                    )}
                    title={user.status ?? undefined}
                    aria-label={user.status ?? undefined}
                >
                    {user.status_emoji}
                </span>
            )}
            {showOnline && user.is_online && (
                <span
                    className={cn(
                        'absolute right-0 bottom-0 rounded-full bg-emerald-400 ring-void',
                        dotSizes[size],
                        size !== 'xs' && 'animate-pulse-ring',
                    )}
                    title={tr('Онлайн')}
                />
            )}
        </span>
    );
}
