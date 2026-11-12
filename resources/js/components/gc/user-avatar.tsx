import { usePage } from '@inertiajs/react';
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
    hero: 'size-24 text-3xl sm:size-36 sm:text-4xl lg:size-40',
} as const;

/** Емодзі статусу — кружечок у лівому нижньому куті аватара. */
const emojiSizes = {
    xs: null,
    sm: 'size-4 text-[10px] -bottom-0.5 -left-0.5',
    md: 'size-5 text-[11px] -bottom-0.5 -left-0.5',
    lg: 'size-6 text-[13px] -bottom-0.5 -left-0.5',
    xl: 'size-7 text-[15px] bottom-0 left-0',
    hero: 'size-8 text-lg bottom-1 left-1 sm:size-11 sm:text-2xl sm:bottom-2 sm:left-2',
} as const;

const dotSizes = {
    xs: 'size-2 ring-[1.5px]',
    sm: 'size-2.5 ring-2',
    md: 'size-3 ring-2',
    lg: 'size-3.5 ring-[2.5px]',
    xl: 'size-4 ring-[3px]',
    hero: 'size-4 ring-[3px] right-1.5 bottom-1.5 sm:size-6 sm:ring-4 sm:right-3 sm:bottom-3',
} as const;

const palettes = [
    'from-gc-blue to-gc-indigo',
    'from-gc-indigo to-gc-purple',
    'from-gc-purple to-gc-pink',
    'from-gc-cyan to-gc-blue',
    'from-[#1e40af] to-gc-blue',
    'from-[#0e7490] to-gc-cyan',
];

/** Кольори рамок свят — ті самі, що в застосунку (eventFrameColors). */
export const EVENT_FRAMES: Record<string, string[]> = {
    newyear: ['#ef4444', '#22c55e', '#facc15'],
    valentine: ['#ef4444', '#f87171'],
    easter: ['#facc15', '#34d399', '#38bdf8'],
    independence: ['#0057b7', '#ffd700'],
    halloween: ['#f97316', '#facc15', '#f97316'],
};

type Props = {
    user: {
        name: string;
        avatar_url: string | null;
        is_online?: boolean;
        presence?: string | null;
        id?: number;
        plus?: PlusMark | null;
        cosmetics?: Cosmetics | null;
        /** Рамка свята, яку людина ввімкнула (newyear, halloween…). */
        event_frame?: string | null;
        /** Зараз у стрімі — червоне кільце й позначка LIVE. */
        live?: boolean;
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
    // Новий рік: шапка Санти на аватарах (крім найменших — там її не розгледіти).
    const santa = usePage().props.season === 'newyear' && size !== 'xs';
    // Рамка свята (ввімкнула сама людина), інакше GameCon+, інакше — вдягнута з сезонного пропуску.
    const frame =
        user.event_frame && EVENT_FRAMES[user.event_frame]
            ? { name: null, frame: EVENT_FRAMES[user.event_frame] }
            : user.plus?.frame?.length
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
                    className={cn(
                        'flex size-full rounded-full p-[2px]',
                        'motion' in frame &&
                            frame.motion &&
                            `gc-frame-${frame.motion}`,
                    )}
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
                <span className="flex size-full overflow-hidden rounded-full bg-white/5">
                    {inner}
                </span>
            )}
            {user.live && size !== 'xs' && (
                <>
                    <span className="pointer-events-none absolute -inset-[2px] rounded-full ring-2 ring-red-500" />
                    <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 rounded bg-red-500 px-1 text-[8px] leading-[12px] font-bold text-white uppercase">
                        Live
                    </span>
                </>
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
            {showOnline &&
                (user.presence
                    ? user.presence !== 'offline'
                    : user.is_online) && (
                    <span
                        className={cn(
                            'absolute right-0 bottom-0 rounded-full ring-void',
                            PRESENCE_DOT[user.presence ?? 'online'] ??
                                'bg-emerald-400',
                            dotSizes[size],
                            size !== 'xs' &&
                                (user.presence ?? 'online') === 'online' &&
                                'animate-pulse-ring',
                        )}
                        title={presenceLabel(user.presence ?? 'online')}
                    />
                )}
            {santa && (
                <img
                    src="/images/seasons/newyear/santa-hat.webp"
                    alt=""
                    aria-hidden
                    loading="lazy"
                    className="santa-hat"
                />
            )}
        </span>
    );
}

/** Колір точки мережевого статусу на аватарі. */
const PRESENCE_DOT: Record<string, string> = {
    online: 'bg-emerald-400',
    idle: 'bg-amber-400',
    dnd: 'bg-rose-500',
};

function presenceLabel(presence: string): string {
    return presence === 'idle'
        ? tr('Неактивний')
        : presence === 'dnd'
          ? tr('Не турбувати')
          : tr('Онлайн');
}
