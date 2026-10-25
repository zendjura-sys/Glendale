import { Head, Link, router } from '@inertiajs/react';
import {
    Gift,
    Gamepad2,
    Monitor,
    Search,
    SearchX,
    Smartphone,
    Tv,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Pagination } from '@/components/gc/admin';
import { EmptyState } from '@/components/gc/widget';
import { cn } from '@/lib/utils';
import type { GameCard, Paginated } from '@/types';
import { tr } from '@/lib/i18n';
import { usePlugin } from '@/lib/plugins';

type Category = GameCard['category'];

type Props = {
    games: Paginated<GameCard>;
    filters: {
        q: string;
        category: Category | null;
        platform: string | null;
        letter: string | null;
        genre: string | null;
        mode: string | null;
        collection: string | null;
        sort: string;
    };
    categories: Record<Category, string>;
    modes: Record<string, string>;
    sorts: Record<string, string>;
    genres: string[];
    platforms: Record<string, string>;
    letters: string[];
    total: number;
};

const ALPHABET = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split(''), '#'];
const CATEGORY_ICONS = {
    pc: Monitor,
    mobile: Smartphone,
    console: Tv,
} as const;

export function GameCover({
    game,
    className,
}: {
    game: GameCard;
    className?: string;
}) {
    return game.cover ? (
        <img
            src={game.cover}
            alt=""
            loading="lazy"
            className={cn('size-full object-cover', className)}
        />
    ) : (
        <span
            className={cn(
                'flex size-full items-center justify-center bg-gradient-to-br from-gc-blue/30 via-gc-violet-400/25 to-gc-pink/25 font-display text-2xl font-bold text-white/80',
                className,
            )}
        >
            {game.name.slice(0, 2).toUpperCase()}
        </span>
    );
}

function Chip({
    active,
    small,
    onClick,
    children,
}: {
    active: boolean;
    small?: boolean;
    onClick: () => void;
    children: ReactNode;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={cn(
                'inline-flex shrink-0 items-center gap-1.5 rounded-lg font-medium whitespace-nowrap transition',
                small ? 'h-8 px-3 text-xs' : 'h-9 px-3 text-sm',
                active
                    ? 'bg-gradient-brand text-white'
                    : 'bg-white/[0.04] text-white/60 hover:bg-white/[0.08] hover:text-white',
            )}
        >
            {children}
        </button>
    );
}

/** Каталог мультиплеєрних ігор: пошук, розділи від ПК до мобільних, покажчик A–Z. */
export default function GamesIndex({
    games,
    filters,
    categories,
    modes,
    sorts,
    genres,
    letters,
    total,
}: Props) {
    const [q, setQ] = useState(filters.q);
    const collectionsOn = usePlugin('game_collections');
    const giveawaysOn = usePlugin('game_giveaways');
    const dealsOn = usePlugin('game_deals');

    const visit = (patch: Partial<Props['filters']>) =>
        router.get(
            '/games',
            Object.fromEntries(
                Object.entries({ ...filters, q, ...patch }).filter(
                    ([, v]) => v !== null && v !== '',
                ),
            ),
            { preserveState: true, preserveScroll: true, replace: true },
        );

    useEffect(() => {
        if (q === filters.q) return;
        const timer = setTimeout(() => visit({ q, letter: null }), 300);

        return () => clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [q]);

    return (
        <>
            <Head title={tr('Каталог ігор')} />
            <div className="mb-4 flex flex-wrap items-end gap-3">
                <div className="min-w-0 flex-1">
                    <h1 className="flex items-center gap-2 font-display text-2xl font-semibold text-white">
                        <Gamepad2 className="size-6 text-gc-lilac-200" />{' '}
                        {tr('Каталог ігор')}
                    </h1>
                    <p className="text-sm text-white/50">
                        {total}{' '}
                        {tr(
                            'мультиплеєрних ігор — від ПК до телефонів. Оновлюється щодня.',
                        )}
                    </p>
                </div>
                {(giveawaysOn || dealsOn) && (
                    <Link
                        href="/games/deals"
                        className="inline-flex h-10 items-center gap-2 rounded-xl bg-white/[0.06] px-3.5 text-sm font-semibold text-white/80 transition hover:bg-white/10 hover:text-white"
                    >
                        <Gift className="size-4 text-emerald-300" />
                        {tr('Роздачі й знижки')}
                    </Link>
                )}
            </div>

            <div className="glass mb-4 space-y-3 rounded-2xl p-3">
                <label className="input-glass flex h-11 w-full items-center gap-2 rounded-xl px-3">
                    <Search className="size-4 shrink-0 text-white/35" />
                    <input
                        value={q}
                        onChange={(e) => setQ(e.target.value)}
                        placeholder={tr('Назва гри')}
                        className="min-w-0 flex-1 bg-transparent text-sm text-white placeholder:text-white/30 focus:outline-none"
                    />
                </label>

                <div className="-mx-1 flex [scrollbar-width:none] gap-1 overflow-x-auto px-1">
                    <Chip
                        active={!filters.category}
                        onClick={() => visit({ category: null })}
                    >
                        {tr('Усі')}
                    </Chip>
                    {(Object.keys(categories) as Category[]).map((c) => {
                        const Icon = CATEGORY_ICONS[c];

                        return (
                            <Chip
                                key={c}
                                active={filters.category === c}
                                onClick={() =>
                                    visit({ category: c, letter: null })
                                }
                            >
                                <Icon className="size-4" /> {categories[c]}
                            </Chip>
                        );
                    })}
                </div>

                {collectionsOn && (
                    <div className="-mx-1 flex [scrollbar-width:none] gap-1 overflow-x-auto px-1">
                        <Chip
                            small
                            active={filters.collection === 'duo'}
                            onClick={() =>
                                visit({
                                    collection:
                                        filters.collection === 'duo'
                                            ? null
                                            : 'duo',
                                })
                            }
                        >
                            {tr('На двох')}
                        </Chip>
                        <Chip
                            small
                            active={filters.collection === 'evening'}
                            onClick={() =>
                                visit({
                                    collection:
                                        filters.collection === 'evening'
                                            ? null
                                            : 'evening',
                                })
                            }
                        >
                            {tr('На вечір')}
                        </Chip>
                    </div>
                )}

                {Object.keys(modes).length > 0 && (
                    <div className="-mx-1 flex [scrollbar-width:none] gap-1 overflow-x-auto px-1">
                        {Object.entries(modes)
                            .filter(([key]) => key !== 'single')
                            .map(([key, label]) => (
                                <Chip
                                    key={key}
                                    small
                                    active={filters.mode === key}
                                    onClick={() =>
                                        visit({
                                            mode:
                                                filters.mode === key
                                                    ? null
                                                    : key,
                                        })
                                    }
                                >
                                    {label}
                                </Chip>
                            ))}
                    </div>
                )}

                {(genres.length > 0 || Object.keys(sorts).length > 0) && (
                    <div className="grid grid-cols-2 gap-2">
                        {genres.length > 0 && (
                            <select
                                value={filters.genre ?? ''}
                                onChange={(e) =>
                                    visit({ genre: e.target.value || null })
                                }
                                className="input-glass h-10 w-full min-w-0 rounded-xl px-3 text-sm text-white"
                                aria-label={tr('Жанр')}
                            >
                                <option value="">{tr('Усі жанри')}</option>
                                {genres.map((g) => (
                                    <option key={g} value={g}>
                                        {g}
                                    </option>
                                ))}
                            </select>
                        )}
                        {Object.keys(sorts).length > 0 && (
                            <select
                                value={filters.sort}
                                onChange={(e) =>
                                    visit({ sort: e.target.value })
                                }
                                className={cn(
                                    'input-glass h-10 w-full min-w-0 rounded-xl px-3 text-sm text-white',
                                    genres.length === 0 && 'col-span-2',
                                )}
                                aria-label={tr('Сортування')}
                            >
                                {Object.entries(sorts).map(([key, label]) => (
                                    <option key={key} value={key}>
                                        {label}
                                    </option>
                                ))}
                            </select>
                        )}
                    </div>
                )}

                {/* A–Z: на телефоні — один рядок з прокруткою, на ширших екранах — переноситься. Літери без ігор неактивні. */}
                <div className="-mx-1 flex [scrollbar-width:none] gap-1 overflow-x-auto border-t border-white/[0.06] px-1 pt-3 sm:flex-wrap">
                    <button
                        type="button"
                        onClick={() => visit({ letter: null })}
                        className={cn(
                            'h-8 shrink-0 rounded-lg px-2.5 text-xs font-semibold transition',
                            !filters.letter
                                ? 'bg-gradient-brand text-white'
                                : 'text-white/60 hover:bg-white/10',
                        )}
                    >
                        A–Z
                    </button>
                    {ALPHABET.map((l) => {
                        const has = letters.includes(l);

                        return (
                            <button
                                key={l}
                                type="button"
                                disabled={!has}
                                onClick={() => {
                                    setQ('');
                                    visit({ letter: l, q: '' });
                                }}
                                className={cn(
                                    'size-8 shrink-0 rounded-lg text-xs font-semibold transition disabled:cursor-default disabled:opacity-25',
                                    filters.letter === l
                                        ? 'bg-gradient-brand text-white'
                                        : 'text-white/70 hover:bg-white/10',
                                )}
                            >
                                {l}
                            </button>
                        );
                    })}
                </div>
            </div>

            {games.data.length === 0 ? (
                <EmptyState
                    icon={SearchX}
                    title={tr('Нічого не знайшли')}
                    text={tr('Спробуйте іншу назву або розділ.')}
                />
            ) : (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                    {games.data.map((g) => {
                        const Icon = CATEGORY_ICONS[g.category];

                        return (
                            <Link
                                key={g.id}
                                href={`/games/${g.slug}`}
                                className="group relative block aspect-[4/5] overflow-hidden rounded-2xl border border-white/[0.08] bg-black/30 transition hover:border-white/20 sm:aspect-[4/3]"
                            >
                                <GameCover
                                    game={g}
                                    className="absolute inset-0 transition duration-300 group-hover:opacity-90"
                                />
                                <div className="absolute inset-x-1.5 bottom-1.5 rounded-xl border border-white/15 bg-black/35 px-2.5 py-2 backdrop-blur-xl backdrop-saturate-150">
                                    <p className="line-clamp-2 text-[13px] leading-tight font-semibold text-white sm:text-sm">
                                        {g.name}
                                    </p>
                                    <p className="mt-1 flex items-start gap-1.5 text-[11px] text-white/70">
                                        <Icon className="size-3.5 shrink-0" />
                                        <span className="break-words">
                                            {g.platforms
                                                .map((p) => p.label)
                                                .slice(0, 3)
                                                .join(' · ') ||
                                                g.category_label}
                                        </span>
                                    </p>
                                </div>
                            </Link>
                        );
                    })}
                </div>
            )}
            <Pagination data={games} />
            <p className="mt-6 text-center text-xs text-white/30">
                {tr('Дані каталогу —')}{' '}
                <a
                    href="https://www.igdb.com"
                    target="_blank"
                    rel="noreferrer"
                    className="hover:text-white/60"
                >
                    IGDB
                </a>{' '}
                {tr('і')}{' '}
                <a
                    href="https://rawg.io"
                    target="_blank"
                    rel="noreferrer"
                    className="hover:text-white/60"
                >
                    RAWG
                </a>
            </p>
        </>
    );
}
