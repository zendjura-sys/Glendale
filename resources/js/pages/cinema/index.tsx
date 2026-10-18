import { Head, InfiniteScroll, Link, router } from '@inertiajs/react';
import {
    Bookmark,
    Clapperboard,
    Clock,
    Film,
    Info,
    Loader2,
    Play,
    Search,
    SlidersHorizontal,
    Sparkles,
    X,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import {
    MoviePoster,
    MovieTile,
    PosterRow,
    RatingBadge,
    movieGridClass,
} from '@/components/cinema/movie-tile';
import { selectClass } from '@/components/gc/admin';
import { EmptyState } from '@/components/gc/widget';
import { plural } from '@/lib/format';
import { cn, formText } from '@/lib/utils';
import type {
    MovieCard,
    MovieFeatured,
    MovieOption,
    MovieType,
    ScrollData,
} from '@/types';
import { api } from '@/lib/api';
import { tr } from '@/lib/i18n';
import { usePlugin } from '@/lib/plugins';

type Filters = {
    type: MovieType | null;
    genre: string | null;
    year: number | null;
    sort: 'new' | 'popular' | 'rating' | 'year';
    q: string;
};

type Props = {
    filters: Filters;
    filtered: boolean;
    movies: ScrollData<MovieCard>;
    total: number;
    featured: MovieFeatured[];
    rows: { key: string; title: string; movies: MovieCard[] }[];
    types: MovieOption<MovieType>[];
    typeCounts: Partial<Record<MovieType, number>>;
    genres: { name: string; count: number }[];
    years: number[];
    myCounts: Record<string, number>;
    requests: string[];
    /** Пошук порожній — спитати TMDB і показати додане до каталогу. */
    lookup?: boolean;
};

/** Порожній пошук: TMDB → тайтли з плеєром одразу додаються до каталогу. */
function TmdbLookup({ query }: { query: string }) {
    const [found, setFound] = useState<MovieCard[] | null>(null);

    useEffect(() => {
        let alive = true;
        setFound(null);
        api<{ movies: MovieCard[] }>(
            'GET',
            `/cinema/lookup?q=${encodeURIComponent(query)}`,
        )
            .then((r) => alive && setFound(r.movies))
            .catch(() => alive && setFound([]));

        return () => {
            alive = false;
        };
    }, [query]);

    if (found === null) {
        return (
            <section className="glass flex items-center gap-3 rounded-3xl p-4 text-sm text-white/65">
                <Loader2 className="size-4 animate-spin" />
                {tr('У каталозі немає — шукаємо в TMDB і додаємо знайдене…')}
            </section>
        );
    }
    if (found.length === 0) return null;

    return (
        <section className="glass rounded-3xl p-4 sm:p-5">
            <h2 className="font-display text-lg font-semibold text-white">
                {tr('Знайдено в TMDB')}
                <span className="ml-2 text-sm font-normal text-white/40">
                    {found.length}
                </span>
            </h2>
            <p className="mb-4 text-xs text-white/45">
                {tr('Ці тайтли щойно додано до каталогу — можна дивитися.')}
            </p>
            <div className={movieGridClass}>
                {found.map((movie) => (
                    <MovieTile key={movie.id} movie={movie} />
                ))}
            </div>
        </section>
    );
}

const sorts: { key: Filters['sort']; label: string }[] = [
    { key: 'new', label: tr('Нові на сайті') },
    { key: 'popular', label: tr('Популярні') },
    { key: 'rating', label: tr('За рейтингом') },
    { key: 'year', label: tr('За роком') },
];

function durationLabel(minutes: number | null) {
    if (!minutes) return null;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;

    return h
        ? tr('{h} год {v}', { h, v: m ? tr('{m} хв', { m }) : '' }).trim()
        : tr('{m} хв', { m });
}

function Hero({ items }: { items: MovieFeatured[] }) {
    const [index, setIndex] = useState(0);
    const [paused, setPaused] = useState(false);

    useEffect(() => {
        if (items.length < 2 || paused) return;
        const timer = setInterval(
            () => setIndex((i) => (i + 1) % items.length),
            7000,
        );

        return () => clearInterval(timer);
    }, [items.length, paused]);

    if (items.length === 0) return null;
    const movie = items[index];

    return (
        <section
            className="relative isolate overflow-hidden rounded-3xl border border-white/[0.08] bg-gc-ink"
            onMouseEnter={() => setPaused(true)}
            onMouseLeave={() => setPaused(false)}
        >
            {items.map((item, i) => (
                <div
                    key={item.id}
                    className={cn(
                        'absolute inset-0 -z-10 transition-opacity duration-1000',
                        i === index ? 'opacity-100' : 'opacity-0',
                    )}
                >
                    {item.backdrop || item.poster ? (
                        <img
                            decoding="async"
                            src={item.backdrop ?? item.poster ?? ''}
                            alt=""
                            className={cn(
                                'size-full object-cover transition-transform duration-[8000ms] ease-out',
                                i === index ? 'scale-105' : 'scale-100',
                                !item.backdrop && 'blur-2xl',
                            )}
                        />
                    ) : (
                        <div className="size-full bg-[radial-gradient(80%_80%_at_70%_20%,#6d5dfc55,transparent),radial-gradient(60%_60%_at_10%_90%,#f04fd833,transparent)]" />
                    )}
                </div>
            ))}
            <div className="scrim scrim-side absolute inset-0 -z-10" />
            <div className="scrim absolute inset-0 -z-10" />

            <div className="flex min-h-[340px] items-end gap-6 p-5 sm:min-h-[420px] sm:p-8">
                <div
                    key={movie.id}
                    className="max-w-xl min-w-0 flex-1 animate-rise"
                >
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.07] px-2.5 py-1 text-xs font-semibold text-white/70 backdrop-blur">
                        <Sparkles className="size-3.5 text-gc-amber" />
                        {tr('Рекомендуємо')}
                    </span>
                    <h1 className="mt-3 font-display text-3xl leading-[1.05] font-bold text-white drop-shadow-lg sm:text-5xl">
                        {movie.title}
                    </h1>
                    {movie.title_original &&
                        movie.title_original !== movie.title && (
                            <p className="mt-1 text-sm text-white/45">
                                {movie.title_original}
                            </p>
                        )}
                    <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-white/70">
                        <RatingBadge value={movie.rating} className="text-xs" />
                        {movie.year && <span>{movie.year}</span>}
                        <span className="text-white/30">•</span>
                        <span>{movie.type_label}</span>
                        {durationLabel(movie.duration) && (
                            <>
                                <span className="text-white/30">•</span>
                                <span className="inline-flex items-center gap-1">
                                    <Clock className="size-3.5" />
                                    {durationLabel(movie.duration)}
                                </span>
                            </>
                        )}
                        {movie.age_rating && (
                            <span className="rounded border border-white/25 px-1.5 text-xs font-semibold">
                                {movie.age_rating}
                            </span>
                        )}
                    </div>
                    {movie.genres.length > 0 && (
                        <p className="mt-2 text-xs text-[#b9c3ff]/80">
                            {movie.genres.join(' · ')}
                        </p>
                    )}
                    {movie.description && (
                        <p className="mt-3 line-clamp-3 max-w-lg text-sm leading-relaxed text-white/65">
                            {movie.description}
                        </p>
                    )}
                    <div className="mt-5 flex flex-wrap gap-2">
                        <Link
                            href={`${movie.href}#player`}
                            className="btn-glow inline-flex h-11 items-center gap-2 rounded-xl px-6 text-sm font-semibold"
                        >
                            <Play className="size-4 fill-current" />{' '}
                            {tr('Дивитися')}
                        </Link>
                        <Link
                            href={movie.href}
                            className="inline-flex h-11 items-center gap-2 rounded-xl border border-white/15 bg-white/[0.08] px-5 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/15"
                        >
                            <Info className="size-4" /> {tr('Детальніше')}
                        </Link>
                    </div>
                </div>
                <Link
                    href={movie.href}
                    key={`poster-${movie.id}`}
                    className="hidden w-[190px] shrink-0 animate-rise overflow-hidden rounded-2xl shadow-[0_30px_60px_-20px_rgb(0_0_0/0.9)] ring-1 ring-white/15 transition hover:-translate-y-1 md:block"
                >
                    <MoviePoster
                        movie={movie}
                        className="aspect-[2/3] w-full"
                    />
                </Link>
            </div>

            {items.length > 1 && (
                <div className="absolute right-5 bottom-4 flex gap-1.5 sm:right-8">
                    {items.map((item, i) => (
                        <button
                            key={item.id}
                            type="button"
                            onClick={() => setIndex(i)}
                            aria-label={item.title}
                            className={cn(
                                'h-1.5 rounded-full transition-all',
                                i === index
                                    ? 'w-7 bg-white'
                                    : 'w-1.5 bg-white/35 hover:bg-white/60',
                            )}
                        />
                    ))}
                </div>
            )}
        </section>
    );
}

export default function CinemaIndex({
    filters,
    filtered,
    movies,
    total,
    featured,
    rows,
    types,
    typeCounts,
    genres,
    years,
    myCounts,
    requests,
    lookup = false,
}: Props) {
    const [search, setSearch] = useState(filters.q);
    const requestOn = usePlugin('movie_request');

    const apply = (patch: Partial<Filters>) => {
        const next = { ...filters, q: search, ...patch };
        router.get(
            '/cinema',
            {
                type: next.type ?? undefined,
                genre: next.genre ?? undefined,
                year: next.year ?? undefined,
                sort: next.sort === 'new' ? undefined : next.sort,
                q: next.q || undefined,
            },
            {
                preserveState: true,
                preserveScroll: true,
                replace: true,
                reset: ['movies'],
            },
        );
    };

    useEffect(() => {
        if (search === filters.q) return;
        const timer = setTimeout(() => apply({ q: search }), 350);

        return () => clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [search]);

    const totalAll = Object.values(typeCounts).reduce(
        (sum, n) => sum + (n ?? 0),
        0,
    );
    const visibleRows = rows.filter((row) => row.movies.length > 0);

    return (
        <>
            <Head title={tr('Кіно')} />
            <div className="space-y-5">
                {!filtered && featured.length > 0 ? (
                    <Hero items={featured} />
                ) : (
                    <section className="glass relative overflow-hidden rounded-3xl p-5 sm:p-7">
                        <div className="pointer-events-none absolute -top-24 -right-16 size-80 rounded-full bg-gc-indigo/25 blur-3xl" />
                        <div className="pointer-events-none absolute -bottom-36 left-10 size-80 rounded-full bg-gc-pink/15 blur-3xl" />
                        <div className="relative">
                            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-1 text-xs font-semibold text-white/60">
                                <Clapperboard className="size-3.5 text-gc-lilac-400" />
                                {tr('Кіно GameCon')}
                            </span>
                            <h1 className="mt-3 font-display text-3xl font-bold text-white sm:text-4xl">
                                {filtered ? (
                                    <>
                                        {tr('Знайдено')}{' '}
                                        <span className="text-gradient">
                                            {total}
                                        </span>{' '}
                                        {plural(total, [
                                            'тайтл',
                                            'тайтли',
                                            'тайтлів',
                                        ])}
                                    </>
                                ) : (
                                    <>
                                        {tr('Фільми, серіали,')}{' '}
                                        <span className="text-gradient">
                                            {tr('аніме')}
                                        </span>
                                    </>
                                )}
                            </h1>
                        </div>
                    </section>
                )}

                <div className="glass space-y-3 rounded-3xl p-3">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center">
                        <label className="input-glass flex h-11 min-h-11 flex-1 items-center gap-2 rounded-xl px-3.5">
                            <Search className="size-4 text-white/40" />
                            <input
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder={tr(
                                    'Назва фільму, серіалу чи аніме',
                                )}
                                className="h-full flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/35"
                            />
                            {search && (
                                <button
                                    type="button"
                                    onClick={() => setSearch('')}
                                    className="text-white/40 hover:text-white"
                                    aria-label={tr('Очистити')}
                                >
                                    <X className="size-4" />
                                </button>
                            )}
                        </label>
                        <Link
                            href="/cinema/my"
                            className="glass inline-flex h-11 items-center gap-2 rounded-xl px-4 text-sm font-semibold text-white/85 transition hover:text-white"
                        >
                            <Bookmark className="size-4 text-gc-lilac-400" />
                            {tr('Мої списки')}
                            {myCounts.all > 0 && (
                                <span className="rounded-full bg-white/10 px-1.5 text-[11px]">
                                    {myCounts.all}
                                </span>
                            )}
                        </Link>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <div className="scrollbar-none flex flex-1 gap-1 overflow-x-auto">
                            {[
                                {
                                    key: null,
                                    label: tr('Усе'),
                                    count: totalAll,
                                },
                                ...types.map((t) => ({
                                    ...t,
                                    count: typeCounts[t.key] ?? 0,
                                })),
                            ]
                                .filter((t) => t.key === null || t.count > 0)
                                .map((t) => (
                                    <button
                                        key={t.key ?? 'all'}
                                        type="button"
                                        onClick={() =>
                                            apply({
                                                type: t.key as MovieType | null,
                                            })
                                        }
                                        className={cn(
                                            'flex shrink-0 items-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-semibold transition',
                                            filters.type === t.key
                                                ? 'nav-active text-white'
                                                : 'text-white/55 hover:bg-white/[0.05] hover:text-white',
                                        )}
                                    >
                                        {t.label}
                                        <span className="text-xs text-white/40">
                                            {t.count}
                                        </span>
                                    </button>
                                ))}
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            <SlidersHorizontal className="size-4 text-white/35" />
                            <select
                                value={filters.genre ?? ''}
                                onChange={(e) =>
                                    apply({ genre: e.target.value || null })
                                }
                                className={selectClass}
                                aria-label={tr('Жанр')}
                            >
                                <option value="">{tr('Усі жанри')}</option>
                                {genres.map((g) => (
                                    <option key={g.name} value={g.name}>
                                        {g.name}
                                    </option>
                                ))}
                            </select>
                            <select
                                value={filters.year ?? ''}
                                onChange={(e) =>
                                    apply({
                                        year: e.target.value
                                            ? Number(e.target.value)
                                            : null,
                                    })
                                }
                                className={selectClass}
                                aria-label={tr('Рік')}
                            >
                                <option value="">{tr('Будь-який рік')}</option>
                                {years.map((y) => (
                                    <option key={y} value={y}>
                                        {y}
                                    </option>
                                ))}
                            </select>
                            <select
                                value={filters.sort}
                                onChange={(e) =>
                                    apply({
                                        sort: e.target.value as Filters['sort'],
                                    })
                                }
                                className={selectClass}
                                aria-label={tr('Сортування')}
                            >
                                {sorts.map((s) => (
                                    <option key={s.key} value={s.key}>
                                        {s.label}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>

                {!filtered &&
                    visibleRows.map((row) => (
                        <PosterRow
                            key={row.key}
                            title={
                                row.key === 'continue' ? (
                                    <span className="inline-flex items-center gap-2">
                                        <Play className="size-4 fill-gc-lilac-400 text-gc-lilac-400" />
                                        {row.title}
                                    </span>
                                ) : (
                                    row.title
                                )
                            }
                            action={
                                row.key === 'continue' ||
                                row.key === 'later' ? (
                                    <Link
                                        href={
                                            row.key === 'later'
                                                ? '/cinema/my?status=planned'
                                                : '/cinema/my?status=watching'
                                        }
                                        className="text-xs font-medium text-gc-lilac-300 hover:text-white"
                                    >
                                        {tr('Усі')}
                                    </Link>
                                ) : undefined
                            }
                            movies={row.movies}
                        />
                    ))}

                {lookup && <TmdbLookup query={filters.q} />}
                {movies.data.length === 0 ? (
                    <EmptyState
                        icon={Film}
                        title={
                            filtered
                                ? tr('Нічого не знайдено')
                                : tr('Каталог порожній')
                        }
                        text={
                            filtered
                                ? tr('Спробуйте змінити фільтри або запит.')
                                : tr(
                                      'Адміністратор ще не додав фільми. Загляньте трохи згодом!',
                                  )
                        }
                    />
                ) : (
                    <section className="glass rounded-3xl p-4 sm:p-5">
                        <h2 className="mb-4 font-display text-lg font-semibold text-white">
                            {filtered ? tr('Результати') : tr('Каталог')}
                            <span className="ml-2 text-sm font-normal text-white/40">
                                {total}
                            </span>
                        </h2>
                        <InfiniteScroll data="movies" preserveUrl>
                            <div className={movieGridClass}>
                                {movies.data.map((movie) => (
                                    <MovieTile key={movie.id} movie={movie} />
                                ))}
                            </div>
                        </InfiniteScroll>
                    </section>
                )}
                {requestOn && (
                    <form
                        className="glass flex flex-wrap items-end gap-2 rounded-3xl p-4"
                        onSubmit={(event) => {
                            event.preventDefault();
                            const data = new FormData(event.currentTarget);
                            router.post('/cinema/requests', {
                                title: formText(data, 'title'),
                                year: data.get('year') || undefined,
                            });
                        }}
                    >
                        <label className="min-w-[12rem] flex-1 text-xs text-white/45">
                            {tr('Немає в каталозі')}
                            <input
                                name="title"
                                required
                                maxLength={160}
                                placeholder={tr('Назва фільму')}
                                className="input-glass mt-1 h-11 w-full rounded-xl px-3 text-sm text-white"
                            />
                        </label>
                        <input
                            name="year"
                            type="number"
                            min={1900}
                            max={2100}
                            placeholder={tr('Рік')}
                            className="input-glass h-11 w-24 rounded-xl px-3 text-sm text-white"
                        />
                        <button
                            type="submit"
                            className="h-11 rounded-xl bg-white/10 px-4 text-sm font-medium text-white"
                        >
                            {tr('Запитати')}
                        </button>
                        {requests.length > 0 && (
                            <p className="w-full text-xs text-white/40">
                                {requests.join(' · ')}
                            </p>
                        )}
                    </form>
                )}
            </div>
        </>
    );
}
