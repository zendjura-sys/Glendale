import { initials } from '@/lib/format';
import { cn } from '@/lib/utils';
import { tr } from '@/lib/i18n';

const sizes = {
    xs: 'size-7 text-[10px]',
    sm: 'size-9 text-xs',
    md: 'size-11 text-sm',
    lg: 'size-14 text-base',
    xl: 'size-20 text-xl',
    hero: 'size-36 text-4xl sm:size-40',
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
    'from-[#4f8bff] to-[#6d5dfc]',
    'from-[#6d5dfc] to-[#a855f7]',
    'from-[#a855f7] to-[#f04fd8]',
    'from-[#38e1ff] to-[#4f8bff]',
    'from-[#f04fd8] to-[#ff7a59]',
    'from-[#22d3a6] to-[#38e1ff]',
];

type Props = {
    user: {
        name: string;
        avatar_url: string | null;
        is_online?: boolean;
        id?: number;
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
            {ring ? (
                <span className="ring-gradient flex size-full rounded-full p-[3px] shadow-[0_0_40px_-6px_rgb(124_92_255/0.8)]">
                    <span className="flex size-full rounded-full bg-void p-[3px]">
                        {inner}
                    </span>
                </span>
            ) : (
                <span className="flex size-full overflow-hidden rounded-full bg-white/5 ring-1 ring-white/10">
                    {inner}
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
