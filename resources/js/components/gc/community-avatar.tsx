import { initials } from '@/lib/format';
import { cn } from '@/lib/utils';

const sizes = {
    xs: 'size-7 rounded-lg text-xs',
    sm: 'size-9 rounded-xl text-xs',
    md: 'size-11 rounded-[14px] text-sm',
    lg: 'size-16 rounded-[20px] text-lg',
    xl: 'size-24 rounded-[26px] text-2xl',
    hero: 'size-36 rounded-[38px] text-4xl sm:size-40',
} as const;

const palettes = [
    'from-[#4f8bff] via-[#6d5dfc] to-[#a855f7]',
    'from-[#22d3a6] via-[#38e1ff] to-[#4f8bff]',
    'from-[#f04fd8] via-[#a855f7] to-[#6d5dfc]',
    'from-[#ff7a59] via-[#f04fd8] to-[#a855f7]',
    'from-[#38e1ff] via-[#4f8bff] to-[#22d3a6]',
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
