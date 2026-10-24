import { Check } from 'lucide-react';
import { m, useReducedMotion } from 'motion/react';
import { tr } from '@/lib/i18n';
import { CORE_MODULES, FEATURE_LABELS, MODE_ICONS } from '@/lib/modes';
import type { NetworkMode } from '@/lib/modes';
import { motionOr, POP, SNAP } from '@/lib/motion';
import { cn } from '@/lib/utils';

/**
 * Картка режиму соцмережі: що в ньому є і чого немає. Спільна для вибору після реєстрації
 * й налаштувань (compact — менша, без переліку «без…»).
 */
export function ModeCard({
    mode,
    active,
    onSelect,
    moduleNames,
    allModules,
    layoutId,
    compact = false,
}: {
    mode: NetworkMode;
    active: boolean;
    onSelect: () => void;
    moduleNames: Record<string, string>;
    allModules: string[];
    layoutId: string;
    compact?: boolean;
}) {
    const reduce = useReducedMotion();
    const Icon = MODE_ICONS[mode.icon] ?? MODE_ICONS.layers;
    const shown = mode.modules.filter((key) => !CORE_MODULES.includes(key));
    const hidden = allModules.filter(
        (key) => !mode.modules.includes(key) && !CORE_MODULES.includes(key),
    );
    const features = FEATURE_LABELS();
    const offFeatures = Object.entries(mode.features)
        .filter(([, on]) => !on)
        .map(([key]) => features[key])
        .filter(Boolean);

    return (
        <button
            type="button"
            role="radio"
            aria-checked={active}
            onClick={onSelect}
            className={cn(
                'group relative flex h-full flex-col rounded-2xl text-left transition-colors',
                compact ? 'p-4' : 'p-5 sm:p-6',
                active
                    ? 'text-white'
                    : 'glass text-white/90 hover:border-white/25',
            )}
        >
            {active && (
                <m.span
                    layoutId={layoutId}
                    transition={motionOr(reduce, SNAP)}
                    className="liquid-glass absolute inset-0 rounded-2xl shadow-[0_0_40px_-12px_var(--primary)] ring-2 ring-primary"
                />
            )}
            <span className="relative flex items-start gap-3">
                <span
                    className={cn(
                        'flex shrink-0 items-center justify-center rounded-2xl transition-colors',
                        compact ? 'size-10' : 'size-12',
                        active
                            ? 'bg-primary text-primary-foreground shadow-[0_0_24px_-4px_var(--primary)]'
                            : 'bg-black/25 text-white/80 ring-1 ring-white/10',
                    )}
                >
                    <Icon className={compact ? 'size-5' : 'size-6'} />
                </span>
                <span className="min-w-0 flex-1">
                    <span
                        className={cn(
                            'block font-display font-semibold',
                            compact ? 'text-base' : 'text-lg',
                        )}
                    >
                        {tr(mode.name)}
                    </span>
                    <span className="mt-1 block text-sm leading-relaxed text-white/60">
                        {tr(mode.description)}
                    </span>
                </span>
                {active && (
                    <m.span
                        initial={reduce ? false : { scale: 0.4, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={motionOr(reduce, POP)}
                        className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground"
                    >
                        <Check className="size-4" />
                    </m.span>
                )}
            </span>

            {!compact && (
                <span className="relative mt-4 flex flex-wrap gap-1.5">
                    {shown.map((key) => (
                        <span
                            key={key}
                            className="rounded-chip bg-white/[0.08] px-2.5 py-1 text-xs text-white/80"
                        >
                            {tr(moduleNames[key] ?? key)}
                        </span>
                    ))}
                </span>
            )}
            {!compact && (hidden.length > 0 || offFeatures.length > 0) && (
                <span className="relative mt-3 block text-xs leading-relaxed text-white/40">
                    {tr('Без')}:{' '}
                    {[
                        ...hidden.map((key) => tr(moduleNames[key] ?? key)),
                        ...offFeatures,
                    ].join(', ')}
                </span>
            )}
        </button>
    );
}
