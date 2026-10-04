import { Head, Link, router } from '@inertiajs/react';
import {
    Gamepad2,
    Monitor,
    Search,
    SearchX,
    Smartphone,
    Tv,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { Pagination } from '@/components/gc/admin';
import { EmptyState } from '@/components/gc/widget';
import { cn } from '@/lib/utils';
import type { GameCard, Paginated } from '@/types';

type Category = GameCard['category'];

type Props = {
    games: Paginated<GameCard>;
    filters: {
        q: string;
        category: Category | null;
        platform: string | null;
        letter: string | null;
    };
    categories: Record<Category, string>;
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
                'flex size-full items-center justify-center bg-gradient-to-br from-[#4F8BFF]/30 via-[#8B6BFF]/25 to-[#F04FD8]/25 font-display text-2xl font-bold text-white/80',
                className,
            )}
        >
            {game.name.slice(0, 2).toUpperCase()}
        </span>
    );
}

/** Каталог мультиплеєрних ігор: пошук, розділи від ПК до мобільних, покажчик A–Z. */
export default function GamesIndex({
    games,
    filters,
    categories,
    letters,
    total,
}: Props) {
    const [q, setQ] = useState(filters.q);

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
            <Head title="Каталог ігор" />
            <div className="mb-4 flex flex-wrap items-end gap-3">
                <div className="min-w-0 flex-1">
                    <h1 className="flex items-center gap-2 font-display text-2xl font-semibold text-white">
                        <Gamepad2 className="size-6 text-[#a5b4fc]" /> Каталог
                        ігор
                    </h1>
                    <p className="text-sm text-white/50">
                        {total} мультиплеєрних ігор — від ПК до телефонів.
                        Оновлюється щодня.
                    </p>
                </div>
            </div>

            <div className="glass mb-3 flex flex-wrap items-center gap-2 rounded-2xl p-2.5">
                <label className="input-glass flex h-10 min-w-[220px] flex-1 items-center gap-2 rounded-xl px-3">
                    <Search className="size-4 text-white/35" />
                    <input
                        value={q}
                        onChange={(e) => setQ(e.target.value)}
                        placeholder="Назва гри"
                        className="min-w-0 flex-1 bg-transparent text-sm text-white placeholder:text-white/30 focus:outline-none"
                    />
                </label>
                <div className="flex rounded-xl bg-white/[0.04] p-1 text-sm">
                    <button
                        type="button"
                        onClick={() => visit({ category: null })}
                        className={cn(
                            'rounded-lg px-3 py-1.5 transition',
                            !filters.category
                                ? 'bg-gradient-brand text-white'
                                : 'text-white/55 hover:text-white',
                        )}
                    >
                        Усі
                    </button>
                    {(Object.keys(categories) as Category[]).map((c) => {
                        const Icon = CATEGORY_ICONS[c];

                        return (
                            <button
                                key={c}
                                type="button"
                                onClick={() =>
                                    visit({ category: c, letter: null })
                                }
                                className={cn(
                                    'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition',
                                    filters.category === c
                                        ? 'bg-gradient-brand text-white'
                                        : 'text-white/55 hover:text-white',
                                )}
                            >
                                <Icon className="size-4" /> {categories[c]}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* A–Z: літери без ігор неактивні */}
            <div className="glass mb-4 flex flex-wrap gap-1 rounded-2xl p-2">
                <button
                    type="button"
                    onClick={() => visit({ letter: null })}
                    className={cn(
                        'h-8 rounded-lg px-2.5 text-xs font-semibold transition',
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
                                'size-8 rounded-lg text-xs font-semibold transition disabled:cursor-default disabled:opacity-25',
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

            {games.data.length === 0 ? (
                <EmptyState
                    icon={SearchX}
                    title="Нічого не знайшли"
                    text="Спробуйте іншу назву або розділ."
                />
            ) : (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                    {games.data.map((g) => {
                        const Icon = CATEGORY_ICONS[g.category];

                        return (
                            <Link
                                key={g.id}
                                href={`/games/${g.slug}`}
                                className="glass group overflow-hidden rounded-2xl transition hover:border-white/15"
                            >
                                <div className="aspect-[16/9] overflow-hidden bg-black/30">
                                    <GameCover
                                        game={g}
                                        className="transition duration-300 group-hover:opacity-90"
                                    />
                                </div>
                                <div className="p-3">
                                    <p className="truncate text-sm font-semibold text-white">
                                        {g.name}
                                    </p>
                                    <p className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-white/45">
                                        <Icon className="size-3.5 shrink-0" />
                                        {g.platforms
                                            .map((p) => p.label)
                                            .slice(0, 3)
                                            .join(' · ') || g.category_label}
                                    </p>
                                </div>
                            </Link>
                        );
                    })}
                </div>
            )}
            <Pagination data={games} />
            <p className="mt-6 text-center text-[11px] text-white/30">
                Дані каталогу —{' '}
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
