import { Link } from '@inertiajs/react';
import { Bookmark, CircleOff, Gamepad2, Trophy } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { m, useReducedMotion } from 'motion/react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Widget } from '@/components/gc/widget';
import { api } from '@/lib/api';
import { tr } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import type { GameCard } from '@/types';

export type BacklogStatus = 'want' | 'playing' | 'done' | 'dropped';

/** Стани беклогу в порядку колонок дошки. */
export const BACKLOG_STATUSES: BacklogStatus[] = [
    'want',
    'playing',
    'done',
    'dropped',
];

export const BACKLOG_META: Record<
    BacklogStatus,
    { label: () => string; icon: LucideIcon; tone: string }
> = {
    want: { label: () => tr('Хочу'), icon: Bookmark, tone: 'text-sky-300' },
    playing: {
        label: () => tr('Граю'),
        icon: Gamepad2,
        tone: 'text-emerald-300',
    },
    done: { label: () => tr('Пройшов'), icon: Trophy, tone: 'text-amber-300' },
    dropped: {
        label: () => tr('Кинув'),
        icon: CircleOff,
        tone: 'text-rose-300',
    },
};

/** Зберегти стан гри (null — прибрати з беклогу). */
export function saveBacklog(slug: string, status: BacklogStatus | null) {
    return api<{ status: BacklogStatus | null }>(
        'PUT',
        `/games/${slug}/backlog`,
        { status },
    );
}

/** Перемикач стану на сторінці гри: чотири кнопки, повторне натискання — прибрати. */
export function BacklogPicker({
    slug,
    initial,
    className,
}: {
    slug: string;
    initial: BacklogStatus | null;
    className?: string;
}) {
    const [status, setStatus] = useState(initial);
    const [busy, setBusy] = useState(false);
    const reduce = useReducedMotion();

    const pick = (next: BacklogStatus) => {
        const value = status === next ? null : next;
        const before = status;
        setStatus(value);
        setBusy(true);
        saveBacklog(slug, value)
            .then(() => {
                if (value) {
                    toast.success(
                        tr('У беклозі: {status}', {
                            status: BACKLOG_META[value].label(),
                        }),
                    );
                }
            })
            .catch(() => {
                setStatus(before);
                toast.error(tr('Не вдалося оновити беклог.'));
            })
            .finally(() => setBusy(false));
    };

    return (
        <div
            role="group"
            aria-label={tr('Беклог')}
            className={cn(
                'inline-flex flex-wrap gap-1 rounded-xl bg-black/25 p-1 backdrop-blur-md',
                className,
            )}
        >
            {BACKLOG_STATUSES.map((key) => {
                const meta = BACKLOG_META[key];
                const active = status === key;

                return (
                    <button
                        key={key}
                        type="button"
                        disabled={busy}
                        aria-pressed={active}
                        onClick={() => pick(key)}
                        className={cn(
                            'relative inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold transition disabled:opacity-70',
                            active
                                ? 'text-white'
                                : 'text-white/70 hover:text-white',
                        )}
                    >
                        {active && (
                            <m.span
                                layoutId={`backlog-${slug}`}
                                transition={
                                    reduce
                                        ? { duration: 0 }
                                        : {
                                              type: 'spring',
                                              stiffness: 500,
                                              damping: 38,
                                          }
                                }
                                className="absolute inset-0 rounded-lg bg-white/15"
                            />
                        )}
                        <meta.icon
                            className={cn(
                                'relative size-3.5',
                                active && meta.tone,
                            )}
                        />
                        <span className="relative">{meta.label()}</span>
                    </button>
                );
            })}
        </div>
    );
}

export type BacklogSummary = {
    counts: Record<BacklogStatus, number>;
    playing: GameCard[];
    href: string;
};

/** Блок профілю «Ігри»: у що грає зараз і лічильники станів. */
export function BacklogWidget({
    data,
    isSelf,
}: {
    data: BacklogSummary;
    isSelf: boolean;
}) {
    const total = BACKLOG_STATUSES.reduce((sum, s) => sum + data.counts[s], 0);
    if (total === 0 && !isSelf) {
        return null;
    }

    return (
        <Widget title={tr('Ігри')} icon={Gamepad2} href={data.href}>
            {data.playing.length > 0 ? (
                <div className="mb-3 grid grid-cols-2 gap-2">
                    {data.playing.map((game) => (
                        <Link
                            key={game.id}
                            href={`/games/${game.slug}`}
                            className="group relative aspect-[3/4] overflow-hidden rounded-xl bg-white/[0.04]"
                        >
                            {game.cover && (
                                <img
                                    src={game.cover}
                                    alt=""
                                    loading="lazy"
                                    className="size-full object-cover transition duration-500 group-hover:scale-105"
                                />
                            )}
                            <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent p-2 pt-6 text-xs font-semibold text-white">
                                <span className="line-clamp-2">
                                    {game.name}
                                </span>
                            </span>
                        </Link>
                    ))}
                </div>
            ) : (
                <p className="mb-3 px-1 text-sm text-white/50">
                    {isSelf
                        ? tr(
                              'Позначайте ігри на їхніх сторінках: «Хочу», «Граю», «Пройшов» чи «Кинув».',
                          )
                        : tr('Зараз ні в що не грає.')}
                </p>
            )}
            <div className="grid grid-cols-4 gap-1">
                {BACKLOG_STATUSES.map((s) => {
                    const meta = BACKLOG_META[s];

                    return (
                        <Link
                            key={s}
                            href={`${data.href}#${s}`}
                            className="flex flex-col items-center gap-0.5 rounded-xl px-1 py-2 text-center transition hover:bg-white/[0.05]"
                        >
                            <meta.icon className={cn('size-4', meta.tone)} />
                            <span className="text-sm font-semibold text-white tabular-nums">
                                {data.counts[s]}
                            </span>
                            <span className="text-[11px] text-white/50">
                                {meta.label()}
                            </span>
                        </Link>
                    );
                })}
            </div>
        </Widget>
    );
}
