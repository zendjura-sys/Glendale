import { Link, router } from '@inertiajs/react';
import { Clock, Gamepad2, Heart, Home } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { useEffect, useState } from 'react';
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
            className="gc-solid mt-4 flex gap-1 rounded-2xl p-1"
        >
            {tabs.map((t) => (
                <button
                    key={t.key}
                    type="button"
                    role="tab"
                    aria-selected={value === t.key}
                    onClick={() => onChange(t.key)}
                    className={cn(
                        'relative flex h-10 flex-1 items-center justify-center gap-2 rounded-xl text-sm font-semibold transition',
                        value === t.key
                            ? 'text-white'
                            : 'text-white/55 hover:text-white',
                    )}
                >
                    {value === t.key && (
                        <motion.span
                            layoutId="profile-section"
                            transition={
                                reduce
                                    ? { duration: 0 }
                                    : {
                                          type: 'spring',
                                          stiffness: 420,
                                          damping: 34,
                                      }
                            }
                            className="absolute inset-0 rounded-xl bg-white/[0.08]"
                        />
                    )}
                    <t.icon className="relative size-4" />
                    <span className="relative">{tr(t.label)}</span>
                </button>
            ))}
        </div>
    );
}

type Activity = {
    playing: { name: string; href?: string | null } | null;
    recent: (GameCard & { status: string; at: string | null })[];
    steam: { name: string; hours: number; href: string | null }[];
};

const STATUS: Record<string, string> = { playing: 'Граю', done: 'Пройдено' };

function GameTile({ game, note }: { game: GameCard; note?: ReactNode }) {
    return (
        <Link
            href={`/games/${game.slug}`}
            className="group flex flex-col overflow-hidden rounded-2xl bg-white/[0.04] transition hover:bg-white/[0.07]"
        >
            <div className="aspect-[3/4] bg-white/[0.04]">
                {game.cover && (
                    <img
                        src={game.cover}
                        alt=""
                        loading="lazy"
                        onError={(e) => {
                            e.currentTarget.style.display = 'none';
                        }}
                        className="size-full object-cover"
                    />
                )}
            </div>
            <div className="p-2">
                <p className="truncate text-sm font-semibold text-white">
                    {game.name}
                </p>
                {note && <p className="text-xs text-white/50">{note}</p>}
            </div>
        </Link>
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
    const [data, setData] = useState<
        Activity | { games: (GameCard & { added_at: string | null })[] } | null
    >(null);
    const [failed, setFailed] = useState(false);

    useEffect(() => {
        let alive = true;
        setData(null);
        setFailed(false);
        api<Activity>('GET', `/${username}/tab/${section}`)
            .then((d) => alive && setData(d))
            .catch(() => alive && setFailed(true));

        return () => {
            alive = false;
        };
    }, [section, username]);

    if (failed)
        return (
            <EmptyState
                icon={Heart}
                title={tr('Розділ приховано')}
                text={tr('Власник сторінки не показує цей розділ.')}
            />
        );
    if (!data)
        return (
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
                {Array.from({ length: 6 }).map((_, i) => (
                    <div
                        key={i}
                        className="aspect-[3/4] animate-pulse rounded-2xl bg-white/[0.05]"
                    />
                ))}
            </div>
        );

    if (section === 'wishlist' && 'games' in data) {
        return (
            <div className="space-y-3">
                {isSelf && (
                    <div className="flex flex-wrap items-center gap-2 text-sm text-white/60">
                        {tr('Хто бачить вішлист:')}
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
                {data.games.length === 0 ? (
                    <EmptyState
                        icon={Heart}
                        title={tr('Вішлист порожній')}
                        text={tr(
                            'Тут з’являться ігри, які людина хоче купити.',
                        )}
                    />
                ) : (
                    <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
                        {data.games.map((g) => (
                            <GameTile key={g.id} game={g} />
                        ))}
                    </div>
                )}
            </div>
        );
    }

    const a = data as Activity;
    const empty = !a.playing && a.recent.length === 0 && a.steam.length === 0;

    return empty ? (
        <EmptyState
            icon={Gamepad2}
            title={tr('Поки тихо')}
            text={tr(
                'Тут з’являться ігри, у які людина грає, і години зі Steam.',
            )}
        />
    ) : (
        <div className="space-y-5">
            {a.playing && (
                <div className="gc-solid flex items-center gap-3 rounded-2xl p-4">
                    <span className="grid size-10 place-items-center rounded-xl bg-emerald-500/15 text-emerald-300">
                        <Gamepad2 className="size-5" />
                    </span>
                    <div>
                        <p className="text-xs text-white/50">
                            {tr('Зараз грає')}
                        </p>
                        <p className="font-semibold text-white">
                            {a.playing.name}
                        </p>
                    </div>
                </div>
            )}
            {a.recent.length > 0 && (
                <section>
                    <h3 className="mb-2 text-sm font-semibold text-white/60">
                        {tr('Останні ігри')}
                    </h3>
                    <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
                        {a.recent.map((g) => (
                            <GameTile
                                key={g.id}
                                game={g}
                                note={tr(STATUS[g.status] ?? g.status)}
                            />
                        ))}
                    </div>
                </section>
            )}
            {a.steam.length > 0 && (
                <section>
                    <h3 className="mb-2 text-sm font-semibold text-white/60">
                        {tr('Бібліотека Steam')}
                    </h3>
                    <ul className="gc-solid divide-y divide-white/[0.06] rounded-2xl">
                        {a.steam.map((g) => (
                            <li
                                key={g.name}
                                className="flex items-center gap-3 px-4 py-2.5"
                            >
                                <span className="min-w-0 flex-1 truncate text-sm text-white">
                                    {g.name}
                                </span>
                                <span className="inline-flex items-center gap-1 text-xs text-white/55 tabular-nums">
                                    <Clock className="size-3.5" />
                                    {tr('{n} год', { n: g.hours })}
                                </span>
                            </li>
                        ))}
                    </ul>
                </section>
            )}
        </div>
    );
}
