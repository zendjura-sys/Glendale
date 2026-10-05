import { cn } from '@/lib/utils';

const sizes = {
    sm: 'size-9 rounded-xl text-xs',
    md: 'size-12 rounded-2xl text-sm',
    lg: 'size-16 rounded-[20px] text-base',
    xl: 'size-24 rounded-[26px] text-2xl',
} as const;

const tones = [
    'from-[#facc15] via-[#f59e0b] to-[#ef4444]',
    'from-gc-blue via-gc-indigo to-gc-purple',
    'from-gc-mint via-gc-cyan to-gc-blue',
    'from-gc-pink via-gc-purple to-gc-indigo',
];

export function FamilyLogo({
    family,
    size = 'md',
    className,
}: {
    family: { id?: number; tag: string; logo_url: string | null };
    size?: keyof typeof sizes;
    className?: string;
}) {
    const tone = tones[(family.id ?? family.tag.length) % tones.length];

    return (
        <span
            className={cn(
                'relative inline-flex shrink-0 overflow-hidden ring-1 ring-white/10',
                sizes[size],
                className,
            )}
        >
            {family.logo_url ? (
                <img
                    src={family.logo_url}
                    alt={family.tag}
                    loading="lazy"
                    className="size-full object-cover"
                />
            ) : (
                <span
                    className={cn(
                        'flex size-full items-center justify-center bg-gradient-to-br font-display font-black tracking-wider text-white',
                        tone,
                    )}
                >
                    {family.tag.slice(0, 4)}
                </span>
            )}
        </span>
    );
}
