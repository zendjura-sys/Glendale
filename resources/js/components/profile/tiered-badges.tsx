import {
    ArrowLeft,
    Cake,
    ChevronRight,
    Gamepad2,
    Gift,
    Lock,
    Rocket,
    Sparkles,
    Target,
    Timer,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useState } from 'react';
import { Link } from '@inertiajs/react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogTitle,
} from '@/components/ui/dialog';
import { tr } from '@/lib/i18n';
import { cn } from '@/lib/utils';

export type TieredBadge = {
    key: string;
    title: string;
    category: string;
    icon: string;
    unit: string;
    hint: string;
    href: string | null;
    value: number;
    level: number;
    levels: number;
    tiers: number[];
    next: number | null;
    color: string;
    colors: string[];
};

const ICONS: Record<string, LucideIcon> = {
    'gamepad-2': Gamepad2,
    timer: Timer,
    gift: Gift,
    cake: Cake,
    sparkles: Sparkles,
    rocket: Rocket,
    target: Target,
};

/** Значок: іконка Lucide на плашці кольору рівня; не отриманий — приглушений із замком. */
function BadgeIcon({
    badge,
    size = 'md',
    level,
}: {
    badge: TieredBadge;
    size?: 'sm' | 'md' | 'lg';
    level?: number;
}) {
    const Icon = ICONS[badge.icon] ?? Sparkles;
    const lvl = level ?? badge.level;
    const color = lvl > 0 ? badge.colors[lvl - 1] : '#475569';
    const box = {
        sm: 'size-7 rounded-lg',
        md: 'size-12 rounded-2xl',
        lg: 'size-20 rounded-3xl',
    }[size];
    const icon = { sm: 'size-4', md: 'size-6', lg: 'size-10' }[size];

    return (
        <span
            className={cn('relative grid shrink-0 place-items-center', box)}
            style={{
                backgroundColor: `${color}26`,
                color,
                opacity: lvl > 0 ? 1 : 0.55,
            }}
        >
            <Icon className={icon} />
            {lvl === 0 && (
                <Lock className="absolute -right-1 -bottom-1 size-3.5 rounded-full bg-[#0b1020] p-0.5 text-white/60" />
            )}
        </span>
    );
}

/** Рядок значків у профілі: перші шість отриманих і «+N», дотик — екран «Значки». */
export function BadgeStrip({
    badges,
    isSelf,
}: {
    badges: TieredBadge[];
    isSelf: boolean;
}) {
    const [open, setOpen] = useState(false);
    const earned = badges.filter((b) => b.level > 0);
    if (badges.length === 0 || (earned.length === 0 && !isSelf)) return null;
    const shown = earned.slice(0, 6);
    const more = earned.length - shown.length;

    return (
        <>
            <button
                type="button"
                onClick={() => setOpen(true)}
                aria-label={tr('Значки')}
                className="inline-flex items-center gap-1 rounded-xl bg-white/[0.06] p-1 pr-2 transition hover:bg-white/[0.1]"
            >
                {shown.map((b) => (
                    <span
                        key={b.key}
                        title={`${tr(b.title)} · ${tr('рівень {n}', { n: b.level })}`}
                    >
                        <BadgeIcon badge={b} size="sm" />
                    </span>
                ))}
                {shown.length === 0 && (
                    <span className="px-1.5 text-xs text-white/60">
                        {tr('Значки')}
                    </span>
                )}
                {more > 0 && (
                    <span className="px-1 text-xs font-semibold text-white/70">
                        +{more}
                    </span>
                )}
                <ChevronRight className="size-3.5 text-white/40" />
            </button>
            <BadgesDialog
                badges={badges}
                open={open}
                onOpenChange={setOpen}
                isSelf={isSelf}
            />
        </>
    );
}

/** Екран «Значки»: сітка всіх значків; дотик — рівні, прогрес і як підвищити. */
function BadgesDialog({
    badges,
    open,
    onOpenChange,
    isSelf,
}: {
    badges: TieredBadge[];
    open: boolean;
    onOpenChange: (open: boolean) => void;
    isSelf: boolean;
}) {
    const [active, setActive] = useState<TieredBadge | null>(null);
    const reduce = useReducedMotion();

    return (
        <Dialog
            open={open}
            onOpenChange={(v) => {
                onOpenChange(v);
                if (!v) setActive(null);
            }}
        >
            <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-lg">
                <AnimatePresence mode="wait" initial={false}>
                    {active ? (
                        <motion.div
                            key={active.key}
                            initial={reduce ? false : { opacity: 0, x: 16 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={reduce ? undefined : { opacity: 0, x: 16 }}
                        >
                            <BadgeDetail
                                badge={active}
                                onBack={() => setActive(null)}
                                isSelf={isSelf}
                            />
                        </motion.div>
                    ) : (
                        <motion.div
                            key="grid"
                            initial={reduce ? false : { opacity: 0, x: -16 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={reduce ? undefined : { opacity: 0, x: -16 }}
                        >
                            <DialogTitle className="font-display text-xl">
                                {isSelf ? tr('Ваші значки') : tr('Значки')}
                            </DialogTitle>
                            <DialogDescription className="mt-1">
                                {tr('Отримано {n} з {total}', {
                                    n: badges.filter((b) => b.level > 0).length,
                                    total: badges.length,
                                })}
                            </DialogDescription>
                            <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4">
                                {badges.map((b) => (
                                    <button
                                        key={b.key}
                                        type="button"
                                        onClick={() => setActive(b)}
                                        className="flex flex-col items-center gap-1.5 rounded-2xl bg-white/[0.04] p-3 text-center transition hover:bg-white/[0.08]"
                                    >
                                        <BadgeIcon badge={b} />
                                        <span className="text-xs font-semibold text-white">
                                            {tr(b.title)}
                                        </span>
                                        <span className="text-[11px] text-white/50">
                                            {b.level > 0
                                                ? tr('Рівень {n} з {total}', {
                                                      n: b.level,
                                                      total: b.levels,
                                                  })
                                                : tr('Ще не отримано')}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </DialogContent>
        </Dialog>
    );
}

function BadgeDetail({
    badge,
    onBack,
    isSelf,
}: {
    badge: TieredBadge;
    onBack: () => void;
    isSelf: boolean;
}) {
    const from = badge.level > 0 ? badge.tiers[badge.level - 1] : 0;
    const percent = badge.next
        ? Math.min(
              100,
              ((badge.value - from) / Math.max(1, badge.next - from)) * 100,
          )
        : 100;

    return (
        <div>
            <button
                type="button"
                onClick={onBack}
                className="mb-3 inline-flex items-center gap-1.5 text-sm text-white/60 hover:text-white"
            >
                <ArrowLeft className="size-4" />
                {tr('Усі значки')}
            </button>
            <div className="flex flex-col items-center text-center">
                <BadgeIcon badge={badge} size="lg" />
                <p className="mt-3 text-xs font-semibold tracking-wide text-white/45">
                    {tr(badge.category)}
                </p>
                <DialogTitle className="mt-1 font-display text-2xl">
                    {tr(badge.title)}
                </DialogTitle>
                <DialogDescription className="mt-1">
                    {badge.level > 0
                        ? tr('Рівень {n} з {total} · {value} {unit}', {
                              n: badge.level,
                              total: badge.levels,
                              value: badge.value,
                              unit: tr(badge.unit),
                          })
                        : tr('Ще не отримано')}
                </DialogDescription>
            </div>

            <div className="mt-5">
                <div className="h-2 overflow-hidden rounded-full bg-white/[0.08]">
                    <div
                        className="h-full rounded-full transition-[width]"
                        style={{
                            width: `${percent}%`,
                            backgroundColor:
                                badge.colors[Math.max(0, badge.level)] ??
                                badge.color,
                        }}
                    />
                </div>
                <p className="mt-2 text-sm text-white/65">
                    {badge.next
                        ? tr('Ще {n} {unit} до наступного рівня', {
                              n: badge.next - badge.value,
                              unit: tr(badge.unit),
                          })
                        : tr('Найвищий рівень — неймовірно!')}
                </p>
            </div>

            <div className="mt-5 grid grid-cols-5 gap-2">
                {badge.tiers.map((t, i) => (
                    <div
                        key={t}
                        className={cn(
                            'flex flex-col items-center gap-1 rounded-xl p-2',
                            i < badge.level
                                ? 'bg-white/[0.06]'
                                : 'bg-white/[0.02]',
                        )}
                    >
                        <BadgeIcon
                            badge={badge}
                            size="sm"
                            level={i < badge.level ? i + 1 : 0}
                        />
                        <span className="text-[11px] text-white/60 tabular-nums">
                            {t}
                        </span>
                    </div>
                ))}
            </div>

            <p className="mt-5 rounded-xl bg-white/[0.04] p-3 text-sm text-white/70">
                {tr(badge.hint)}
            </p>
            {isSelf && badge.href && (
                <Link
                    href={badge.href}
                    className="mt-3 inline-flex h-10 w-full items-center justify-center rounded-xl bg-primary text-sm font-semibold text-white"
                >
                    {tr('Підвищити рівень')}
                </Link>
            )}
        </div>
    );
}
