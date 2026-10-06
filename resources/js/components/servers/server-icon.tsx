import { useState } from 'react';
import { cn } from '@/lib/utils';
import { LOCALE, tr } from '@/lib/i18n';

const tones = [
    'from-gc-blue to-gc-indigo',
    'from-gc-purple to-gc-pink',
    'from-gc-amber to-gc-coral',
    'from-gc-mint to-gc-cyan',
    'from-gc-gold to-gc-blue',
];

export function ServerIcon({
    name,
    icon,
    className,
}: {
    name: string;
    icon: string | null;
    className?: string;
}) {
    const [broken, setBroken] = useState(false);
    const tone = tones[name.length % tones.length];

    if (icon && !broken) {
        return (
            <img
                src={icon}
                alt=""
                loading="lazy"
                onError={() => setBroken(true)}
                className={cn(
                    'size-12 shrink-0 rounded-2xl bg-white/[0.04] object-cover ring-1 ring-white/10',
                    className,
                )}
            />
        );
    }

    return (
        <span
            className={cn(
                'flex size-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br font-display text-lg font-bold text-white ring-1 ring-white/10',
                tone,
                className,
            )}
        >
            {name
                .replace(/[^\p{L}\p{N}]/gu, '')
                .slice(0, 2)
                .toUpperCase()}
        </span>
    );
}

export function OnlineMeter({
    online,
    max,
    className,
}: {
    online: number | null;
    max: number | null;
    className?: string;
}) {
    if (online === null) {
        return null;
    }

    const percent = max ? Math.min(100, Math.round((online / max) * 100)) : 0;

    return (
        <div className={cn('space-y-1.5', className)}>
            <div className="flex items-baseline justify-between text-xs">
                <span className="flex items-center gap-1.5 font-semibold text-emerald-300">
                    <span className="relative flex size-2">
                        {online > 0 && (
                            <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                        )}
                        <span className="relative inline-flex size-2 rounded-full bg-emerald-400" />
                    </span>
                    {online.toLocaleString(LOCALE)} {tr('онлайн')}
                </span>
                {max && (
                    <span className="text-white/35">
                        {tr('з')} {max.toLocaleString(LOCALE)}
                    </span>
                )}
            </div>
            {max ? (
                <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                    <div
                        className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-gc-blue to-gc-purple shadow-[0_0_12px_rgb(79_139_255/0.7)]"
                        style={{ width: `${Math.max(percent, 2)}%` }}
                    />
                </div>
            ) : null}
        </div>
    );
}
