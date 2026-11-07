import { initials } from '@/lib/format';
import { cn } from '@/lib/utils';

const sizes = {
    xs: 'size-7 rounded-lg text-xs',
    sm: 'size-9 rounded-xl text-xs',
    md: 'size-11 rounded-[14px] text-sm',
    lg: 'size-16 rounded-xl text-lg',
    xl: 'size-24 rounded-2xl text-2xl',
    hero: 'size-36 rounded-[20px] text-4xl sm:size-40',
} as const;

const palettes = [
    'from-gc-blue via-gc-indigo to-gc-purple',
    'from-[#0e7490] via-gc-cyan to-gc-blue',
    'from-gc-pink via-gc-purple to-gc-indigo',
    'from-[#1e40af] via-gc-blue to-gc-cyan',
    'from-gc-cyan via-gc-blue to-[#1e40af]',
];

export function CommunityAvatar({
    community,
    size = 'md',
    ring = false,
    className,
}: {
    community: { id?: number; name: string; avatar_url: string | null };
    size?: keyof typeof sizes;
    ring?: boolean;
    className?: string;
}) {
    const palette =
        palettes[(community.id ?? community.name.length) % palettes.length];

    const inner = community.avatar_url ? (
        <img
            src={community.avatar_url}
            alt={community.name}
            loading="lazy"
            className="size-full rounded-[inherit] object-cover"
        />
    ) : (
        <span
            className={cn(
                'flex size-full items-center justify-center rounded-[inherit] bg-gradient-to-br font-display font-bold text-white',
                palette,
            )}
        >
            {initials(community.name)}
        </span>
    );

    return (
        <span
            className={cn(
                'relative inline-flex shrink-0',
                sizes[size],
                ring &&
                    'ring-gradient p-[3px] shadow-[0_0_40px_-6px_rgb(124_92_255/0.8)]',
                className,
            )}
        >
            {inner}
        </span>
    );
}
