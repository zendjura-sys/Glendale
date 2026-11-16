import { Link, router } from '@inertiajs/react';
import { Clock, Gamepad2, Heart, Home, Sparkles } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { EmptyState } from '@/components/gc/widget';
import { api } from '@/lib/api';
import { tr } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import type { GameCard } from '@/types';

export type ProfileSection = 'main' | 'activity' | 'wishlist';

/** Перемикач розділів профілю: «Головне» — стіна й блоки, «Активність» — ігри, «Вішлист» — бажані ігри. */
export function ProfileSectionTabs({
    value,
    onChange,
    wishlist,
}: {
    value: ProfileSection;
    onChange: (v: ProfileSection) => void;
    wishlist: boolean;
}) {
    const reduce = useReducedMotion();
    const tabs: { key: ProfileSection; label: string; icon: typeof Home }[] = [
        { key: 'main', label: 'Головне', icon: Home },
        { key: 'activity', label: 'Активність', icon: Gamepad2 },
        ...(wishlist
            ? [{ key: 'wishlist' as const, label: 'Вішлист', icon: Heart }]
            : []),
    ];

    return (
        <div
            role="tablist"
            aria-label={tr('Розділи профілю')}
            className={cn(
                'mt-4 grid gap-1 rounded-2xl border border-white/[0.07] bg-[#0D1017] p-1',
                wishlist ? 'grid-cols-3' : 'grid-cols-2',
            )}
        >
            {tabs.map((t) => (
                <button
                    key={t.key}
                    type="button"
                    role="tab"
                    aria-selected={value === t.key}
                    onClick={() => onChange(t.key)}
                    className={cn(
                        'relative flex h-10 items-center justify-center gap-2 rounded-xl text-sm font-semibold transition',
                        value === t.key
                            ? 'text-white'
                            : 'text-white/55 hover:text-white',
                    )}
                >
                    {value === t.key && (
                        <motion.span
                            layoutId="profileTabPill"
                            transition={
                                reduce
                                    ? { duration: 0 }
                                    : {
                                          type: 'spring',
                                          stiffness: 420,
                                          damping: 34,
                                      }
                            }
                            className="absolute inset-0 rounded-xl bg-white/[0.08] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
                        />
                    )}
                    <t.icon className="relative size-4" />
                    <span className="relative">{tr(t.label)}</span>
                </button>
            ))}
        </div>
    );
}

type PlayingNow = {
    name?: string | null;
    label?: string | null;
    href?: string | null;
    url?: string | null;
    icon?: string | null;
};

type Activity = {
    playing: PlayingNow | null;
    recent: (GameCard & { status: string; at: string | null })[];
    steam: { name: string; hours: number; href: string | null }[];
};

type Wishlist = { games: (GameCard & { added_at: string | null })[] };

const STATUS: Record<string, string> = {
    playing: 'Граю',
    done: 'Пройдено',
};

function isActivity(data: unknown): data is Activity {
    if (!data || typeof data !== 'object') return false;
    const d = data as Record<string, unknown>;

    return Array.isArray(d.recent) && Array.isArray(d.steam);
}

function isWishlist(data: unknown): data is Wishlist {
    if (!data || typeof data !== 'object') return false;

    return Array.isArray((data as { games?: unknown }).games);
}

function GameTile({
    game,
    note,
    featured = false,
}: {
    game: GameCard;
    note?: ReactNode;
    featured?: boolean;
}) {
    return (
        <Link
            href={`/games/${game.slug}`}
            className={cn(
                'group relative flex flex-col overflow-hidden rounded-2xl bg-white/[0.035] ring-1 ring-white/[0.06] transition duration-300',
                'hover:-translate-y-0.5 hover:bg-white/[0.06] hover:ring-white/[0.12]',
                featured && 'sm:col-span-2 sm:flex-row sm:items-stretch',
            )}
        >
            <div
                className={cn(
                    'relative aspect-[3/4] overflow-hidden bg-gradient-to-br from-white/[0.06] to-white/[0.02]',
                    featured && 'sm:aspect-auto sm:w-[42%] sm:shrink-0',
                )}
            >
                {game.cover ? (
                    <img
                        src={game.cover}
                        alt=""
                        loading="lazy"
                        onError={(e) => {
                            e.currentTarget.style.display = 'none';
                        }}
                        className="size-full object-cover transition duration-500 group-hover:scale-[1.04]"
                    />
                ) : (
                    <span className="grid size-full place-items-center text-white/25">
                        <Gamepad2 className="size-8" />
                    </span>
                )}
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent opacity-80" />
            </div>
            <div
                className={cn(
                    'relative flex flex-1 flex-col justify-end gap-1 p-2.5',
                    featured && 'sm:justify-center sm:p-4',
                )}
            >
                <p
                    className={cn(
                        'truncate font-semibold text-white',
                        featured ? 'text-base sm:text-lg' : 'text-sm',
                    )}
                >
                    {game.name}
                </p>
                {note && (
                    <div className="text-[11px] text-white/55 sm:text-xs">
                        {note}
                    </div>
                )}
            </div>
        </Link>
    );
}

function SectionHeading({
    icon: Icon,
    title,
    hint,
}: {
    icon: typeof Gamepad2;
    title: string;
    hint?: string;
}) {
    return (
        <div className="mb-3 flex items-end justify-between gap-3">
            <div className="flex items-center gap-2">
                <span className="grid size-8 place-items-center rounded-xl bg-white/[0.06] text-white/70 ring-1 ring-white/[0.06]">
                    <Icon className="size-4" />
                </span>
                <div>
                    <h3 className="text-sm font-semibold tracking-wide text-white">
                        {title}
                    </h3>
                    {hint && (
                        <p className="text-[11px] text-white/40">{hint}</p>
                    )}
                </div>
            </div>
        </div>
    );
}

function ActivitySkeleton() {
    return (
        <div className="space-y-5" aria-busy="true" aria-live="polite">
            <div className="h-20 animate-pulse rounded-2xl bg-white/[0.05]" />
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
                {Array.from({ length: 6 }).map((_, i) => (
                    <div
                        key={i}
                        className="aspect-[3/4] animate-pulse rounded-2xl bg-white/[0.05]"
                    />
                ))}
            </div>
            <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, i) => (
                    <div
                        key={i}
                        className="h-12 animate-pulse rounded-xl bg-white/[0.04]"
                    />
                ))}
            </div>
        </div>
    );
}

function StatusPill({ status }: { status: string }) {
    const playing = status === 'playing';

    return (
        <span
            className={cn(
                'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase',
                playing
                    ? 'bg-emerald-400/15 text-emerald-300 ring-1 ring-emerald-400/25'
                    : 'bg-white/[0.08] text-white/65 ring-1 ring-white/[0.08]',
            )}
        >
            {tr(STATUS[status] ?? status)}
        </span>
    );
}

function ActivityView({ data }: { data: Activity }) {
    const reduce = useReducedMotion();
    const recent = Array.isArray(data.recent) ? data.recent : [];
    const steam = Array.isArray(data.steam) ? data.steam : [];
    const playing = data.playing ?? null;
    const playingTitle = (playing?.label || playing?.name || '').trim();
    const playingHref = playing?.url || playing?.href || null;
    const maxHours = useMemo(
        () => Math.max(1, ...steam.map((g) => Number(g.hours) || 0)),
        [steam],
    );
    const empty = !playingTitle && recent.length === 0 && steam.length === 0;

    if (empty) {
        return (
            <EmptyState
                icon={Gamepad2}
                title={tr('Поки тихо')}
                text={tr(
                    'Тут з’являться ігри, у які людина грає, і години зі Steam.',
                )}
            />
        );
    }

    return (
        <motion.div
            initial={reduce ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="space-y-6"
        >
            {playingTitle && (
                <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-500/15 via-white/[0.04] to-sky-500/10 p-4 ring-1 ring-emerald-400/20">
                    <div className="pointer-events-none absolute -top-10 -right-8 size-36 rounded-full bg-emerald-400/10 blur-2xl" />
                    <div className="relative flex items-center gap-3">
                        <span className="relative grid size-12 place-items-center rounded-2xl bg-emerald-400/15 text-emerald-300 ring-1 ring-emerald-400/25">
                            {playing?.icon ? (
                                <img
                                    src={playing.icon}
                                    alt=""
                                    className="size-7 rounded-lg object-cover"
                                />
                            ) : (
                                <Gamepad2 className="size-5" />
                            )}
                            <span className="absolute -top-0.5 -right-0.5 size-2.5 rounded-full bg-emerald-400 shadow-[0_0_0_3px_rgba(16,185,129,0.25)]" />
                        </span>
                        <div className="min-w-0 flex-1">
                            <p className="text-[11px] font-semibold tracking-[0.14em] text-emerald-300/90 uppercase">
                                {tr('Зараз грає')}
                            </p>
                            {playingHref ? (
                                <Link
                                    href={playingHref}
                                    className="block truncate text-base font-semibold text-white hover:underline"
                                >
                                    {playingTitle}
                                </Link>
                            ) : (
                                <p className="truncate text-base font-semibold text-white">
                                    {playingTitle}
                                </p>
                            )}
                        </div>
                        <Sparkles className="size-4 shrink-0 text-emerald-300/50" />
                    </div>
                </div>
            )}

            {recent.length > 0 && (
                <section>
                    <SectionHeading
                        icon={Gamepad2}
                        title={tr('Останні ігри')}
                        hint={tr('З беклогу та сесій')}
                    />
                    <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 sm:gap-3 lg:grid-cols-6">
                        {recent.map((g, i) => (
                            <GameTile
                                key={`${g.id}-${g.status}-${i}`}
                                game={g}
                                featured={i === 0 && recent.length > 2}
                                note={<StatusPill status={g.status} />}
                            />
                        ))}
                    </div>
                </section>
            )}

            {steam.length > 0 && (
                <section>
                    <SectionHeading
                        icon={Clock}
                        title={tr('Бібліотека Steam')}
                        hint={tr('За годинами в грі')}
                    />
                    <ul className="gc-solid divide-y divide-white/[0.05] overflow-hidden rounded-2xl ring-1 ring-white/[0.05]">
                        {steam.map((g, i) => {
                            const hours = Number(g.hours) || 0;
                            const width = Math.max(
                                4,
                                Math.round((hours / maxHours) * 100),
                            );
                            const row = (
                                <>
                                    <span className="w-6 shrink-0 text-center text-xs font-semibold text-white/35 tabular-nums">
                                        {i + 1}
                                    </span>
                                    <span className="min-w-0 flex-1">
                                        <span className="block truncate text-sm font-medium text-white">
                                            {g.name}
                                        </span>
                                        <span className="mt-1.5 block h-1 overflow-hidden rounded-full bg-white/[0.06]">
                                            <span
                                                className="block h-full rounded-full bg-gradient-to-r from-sky-400/80 to-cyan-300/70"
                                                style={{ width: `${width}%` }}
                                            />
                                        </span>
                                    </span>
                                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-white/[0.05] px-2 py-1 text-[11px] font-semibold text-white/70 tabular-nums ring-1 ring-white/[0.06]">
                                        <Clock className="size-3 opacity-70" />
                                        {tr('{n} год', { n: hours })}
                                    </span>
                                </>
                            );

                            return (
                                <li key={`${g.name}-${i}`}>
                                    {g.href ? (
                                        <a
                                            href={g.href}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="flex items-center gap-3 px-3.5 py-3 transition hover:bg-white/[0.03]"
                                        >
                                            {row}
                                        </a>
                                    ) : (
                                        <div className="flex items-center gap-3 px-3.5 py-3">
                                            {row}
                                        </div>
                                    )}
                                </li>
                            );
                        })}
                    </ul>
                </section>
            )}
        </motion.div>
    );
}

function WishlistView({
    data,
    isSelf,
    visibility,
}: {
    data: Wishlist;
    isSelf: boolean;
    visibility: 'all' | 'friends' | 'none';
}) {
    const games = Array.isArray(data.games) ? data.games : [];

    return (
        <div className="space-y-4">
            {isSelf && (
                <div className="gc-solid flex flex-wrap items-center gap-2 rounded-2xl p-3 text-sm text-white/60 ring-1 ring-white/[0.05]">
                    <span className="mr-1 text-xs font-semibold tracking-wide text-white/45 uppercase">
                        {tr('Хто бачить')}
                    </span>
                    {(
                        [
                            ['all', 'Усі'],
                            ['friends', 'Друзі'],
                            ['none', 'Лише я'],
                        ] as const
                    ).map(([key, label]) => (
                        <button
                            key={key}
                            type="button"
                            onClick={() =>
                                router.put(
                                    '/me/wishlist-visibility',
                                    { visibility: key },
                                    { preserveScroll: true },
                                )
                            }
                            aria-pressed={visibility === key}
                            className={cn(
                                'h-8 rounded-full px-3 text-xs font-semibold transition',
                                visibility === key
                                    ? 'bg-white text-[#0b1020]'
                                    : 'bg-white/[0.08] text-white/75 hover:text-white',
                            )}
                        >
                            {tr(label)}
                        </button>
                    ))}
                </div>
            )}
            {games.length === 0 ? (
                <EmptyState
                    icon={Heart}
                    title={tr('Вішлист порожній')}
                    text={tr('Тут з’являться ігри, які людина хоче купити.')}
                />
            ) : (
                <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 sm:gap-3 lg:grid-cols-6">
                    {games.map((g) => (
                        <GameTile key={g.id} game={g} />
                    ))}
                </div>
            )}
        </div>
    );
}

/** «Активність» і «Вішлист»: підвантажуються при відкритті вкладки. */
export function ProfileSectionBody({
    section,
    username,
    isSelf,
    visibility,
}: {
    section: Exclude<ProfileSection, 'main'>;
    username: string;
    isSelf: boolean;
    visibility: 'all' | 'friends' | 'none';
}) {
    const [data, setData] = useState<Activity | Wishlist | null>(null);
    const [failed, setFailed] = useState(false);

    useEffect(() => {
        let alive = true;
        // Скидаємо одразу, щоб не рендерити дані попередньої вкладки (wishlist→activity валив ErrorBoundary).
        setData(null);
        setFailed(false);
        api<Activity | Wishlist>('GET', `/${username}/tab/${section}`)
            .then((d) => {
                if (!alive) return;
                if (
                    (section === 'activity' && isActivity(d)) ||
                    (section === 'wishlist' && isWishlist(d))
                ) {
                    setData(d);
                } else {
                    setFailed(true);
                }
            })
            .catch(() => alive && setFailed(true));

        return () => {
            alive = false;
        };
    }, [section, username]);

    if (failed) {
        return (
            <EmptyState
                icon={section === 'wishlist' ? Heart : Gamepad2}
                title={tr('Розділ недоступний')}
                text={tr(
                    section === 'wishlist'
                        ? 'Власник сторінки не показує вішлист.'
                        : 'Не вдалося завантажити активність. Спробуйте ще раз.',
                )}
            />
        );
    }

    if (!data) return <ActivitySkeleton />;

    // Захист від гонки: поки state ще від іншої вкладки — скелетон, не TypeError.
    if (section === 'wishlist') {
        if (!isWishlist(data)) return <ActivitySkeleton />;

        return (
            <WishlistView data={data} isSelf={isSelf} visibility={visibility} />
        );
    }

    if (!isActivity(data)) return <ActivitySkeleton />;

    return <ActivityView data={data} />;
}
