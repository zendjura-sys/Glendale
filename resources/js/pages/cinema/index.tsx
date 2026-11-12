import { Head, InfiniteScroll, Link, router } from '@inertiajs/react';
import { GridSkeleton } from '@/components/gc/skeletons';
import {
    Dices,
    ListVideo,
    MessageSquareQuote,
    Bookmark,
    Film,
    SlidersHorizontal,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { MovieTile, movieGridClass } from '@/components/cinema/movie-tile';
import { CinemaNav } from '@/components/cinema/cinema-nav';
import { CinemaShell } from '@/components/cinema/cinema-side';
import { MovieOfWeek } from '@/components/cinema/movie-of-week';
import type { CinemaSideData } from '@/components/cinema/cinema-side';
import { ContinueRow, Hero } from '@/components/cinema/hero';
import {
    MovieDetailRow,
    SortSegments,
    TypeCarousel,
    ViewToggle,
    useCatalogView,
} from '@/components/cinema/home-blocks';
import type { DetailMovie } from '@/components/cinema/home-blocks';
import { releaseLabel } from '@/components/cinema/poster-badges';
import { MovieList } from '@/components/cinema/movie-row';
import type { MovieRowItem } from '@/components/cinema/movie-row';
import { UnderlineTabs } from '@/components/gc/underline-tabs';
import { EmptyState } from '@/components/gc/widget';
import { formText } from '@/lib/utils';
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
    country: string | null;
    release: MovieCard['release'] | null;
    sort: 'new' | 'updated' | 'popular' | 'rating' | 'year';
    q: string;
};

type Props = {
    filters: Filters;
    filtered: boolean;
    movies: ScrollData<MovieCard>;
    total: number;
    featured: MovieFeatured[];
    rows: { key: string; title: string; movies: MovieCard[] }[];
    byType: { key: string; label: string; movies: MovieCard[] }[];
    side?: CinemaSideData;
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
            <section className="space-y-3">
                <p className="text-sm text-white/65">
                    {tr(
                        'У каталозі немає — шукаємо в TMDB і додаємо знайдене…',
                    )}
                </p>
                <GridSkeleton count={5} />
            </section>
        );
    }
    if (found.length === 0) return null;

    return (
        <section className="glass rounded-2xl p-4 sm:p-5">
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
    { key: 'updated', label: tr('Нещодавно оновлені') },
    { key: 'new', label: tr('Нові на сайті') },
    { key: 'popular', label: tr('Популярні') },
    { key: 'rating', label: tr('За рейтингом') },
    { key: 'year', label: tr('За роком') },
];

export default function CinemaIndex({
    filters,
    filtered,
    movies,
    total,
    featured,
    rows,
    byType,
    side,
    types,
    typeCounts,
    genres,
    years,
    myCounts,
    requests,
    lookup = false,
}: Props) {
    const [showFilters, setShowFilters] = useState(false);
    const requestOn = usePlugin('movie_request');
    const rouletteOn = usePlugin('movie_roulette');
    const listsOn = usePlugin('movie_lists');
    const reviewsOn = usePlugin('movie_reviews');
    const [view, setView] = useCatalogView();

    const apply = (patch: Partial<Filters>) => {
        const next = { ...filters, ...patch };
        router.get(
            '/cinema',
            {
                type: next.type ?? undefined,
                genre: next.genre ?? undefined,
                year: next.year ?? undefined,
                country: next.country ?? undefined,
                release: next.release ?? undefined,
                sort: next.sort === 'new' ? undefined : next.sort,
                q: next.q || undefined,
            },
            {
                preserveState: true,
                preserveScroll: true,
                replace: true,
            },
        );
    };

    const totalAll = Object.values(typeCounts).reduce(
        (sum, n) => sum + (n ?? 0),
        0,
    );

    const typeTabs = [
        { key: 'all', label: tr('Усе'), count: totalAll },
        ...types
            .map((t) => ({
                key: t.key,
                label: t.label,
                count: typeCounts[t.key] ?? 0,
            }))
            .filter((t) => t.count > 0),
    ];
    const continueRow = rows.find((row) => row.key === 'continue');
    const pill =
        'gc-search-pill h-10 rounded-full border-0 px-4 text-sm text-white';

    return (
        <>
            <Head title={tr('Кіно')} />
            <CinemaShell side={side}>
                <CinemaNav active="home" />
                {!filtered && <Hero items={featured} />}
                {!filtered && byType.length > 0 && (
                    <TypeCarousel groups={byType} />
                )}
                {!filtered && <MovieOfWeek />}

                <UnderlineTabs
                    active={filters.type ?? 'all'}
                    before={
                        <button
                            type="button"
                            onClick={() => setShowFilters((v) => !v)}
                            aria-expanded={showFilters}
                            aria-label={tr('Фільтри')}
                            className="flex size-10 shrink-0 items-center justify-center text-white/55 hover:text-white"
                        >
                            <SlidersHorizontal className="size-5" />
                        </button>
                    }
                    tabs={typeTabs.map((t) => ({
                        ...t,
                        onClick: () =>
                            apply({
                                type:
                                    t.key === 'all'
                                        ? null
                                        : (t.key as MovieType),
                            }),
                    }))}
                />

                {(showFilters || filtered) && (
                    <div className="flex flex-wrap items-center gap-2">
                        <select
                            value={filters.genre ?? ''}
                            onChange={(e) =>
                                apply({ genre: e.target.value || null })
                            }
                            className={pill}
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
                            className={pill}
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
                            className={pill}
                            aria-label={tr('Сортування')}
                        >
                            {sorts.map((s) => (
                                <option key={s.key} value={s.key}>
                                    {s.label}
                                </option>
                            ))}
                        </select>
                        <span className="text-sm text-white/45 tabular-nums">
                            {tr('{n} всього', { n: total })}
                        </span>
                    </div>
                )}

                {(filters.q ||
                    filters.country ||
                    filters.release ||
                    filters.genre ||
                    filters.year) && (
                    <div className="flex flex-wrap gap-2">
                        {(
                            [
                                ['q', filters.q ? `«${filters.q}»` : null],
                                ['genre', filters.genre],
                                ['year', filters.year],
                                ['country', filters.country],
                                ['release', releaseLabel(filters.release)],
                            ] as const
                        )
                            .filter(([, v]) => v)
                            .map(([key, value]) => (
                                <button
                                    key={key}
                                    type="button"
                                    onClick={() => apply({ [key]: null })}
                                    className="gc-chip"
                                >
                                    {value}
                                    <span aria-hidden className="text-white/45">
                                        ×
                                    </span>
                                </button>
                            ))}
                    </div>
                )}

                {!filtered && (
                    <div className="scrollbar-none flex gap-2 overflow-x-auto">
                        {listsOn && (
                            <Link href="/cinema/lists" className="gc-chip">
                                <ListVideo className="size-4" />
                                {tr('Добірки')}
                            </Link>
                        )}
                        {reviewsOn && (
                            <Link href="/cinema/reviews" className="gc-chip">
                                <MessageSquareQuote className="size-4" />
                                {tr('Рецензії')}
                            </Link>
                        )}
                        {rouletteOn && (
                            <Link href="/cinema/roulette" className="gc-chip">
                                <Dices className="size-4" />
                                {tr('Що подивитися?')}
                            </Link>
                        )}
                        <Link href="/cinema/my" className="gc-chip">
                            <Bookmark className="size-4" />
                            {tr('Закладки')}
                            {myCounts.all > 0 && (
                                <span className="text-white/45 tabular-nums">
                                    {myCounts.all}
                                </span>
                            )}
                        </Link>
                    </div>
                )}

                {!filtered && continueRow && continueRow.movies.length > 0 && (
                    <ContinueRow
                        title={continueRow.title}
                        action={
                            <Link
                                href="/cinema/my?status=history"
                                className="text-xs font-medium text-primary"
                            >
                                {tr('Усі')}
                            </Link>
                        }
                        movies={continueRow.movies}
                    />
                )}

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
                    <section className="glass rounded-2xl p-4 sm:p-5">
                        <div className="mb-4 flex items-center gap-3">
                            <h2 className="font-display text-lg font-semibold text-white max-sm:hidden">
                                {filtered ? tr('Знайдено') : tr('Каталог')}
                                <span className="ml-2 text-sm font-normal text-white/40 tabular-nums">
                                    {total}
                                </span>
                            </h2>
                            <div className="min-w-0 flex-1 sm:flex sm:justify-end">
                                <SortSegments
                                    items={sorts.slice(0, 4)}
                                    active={filters.sort}
                                    onChange={(sort) => apply({ sort })}
                                />
                            </div>
                            <span className="max-sm:hidden">
                                <ViewToggle view={view} onChange={setView} />
                            </span>
                        </div>
                        <InfiniteScroll
                            data="movies"
                            loading={<GridSkeleton count={4} />}
                            preserveUrl
                        >
                            {view === 'list' ? (
                                <div className="hidden space-y-6 sm:block">
                                    {(movies.data as DetailMovie[]).map(
                                        (movie) => (
                                            <MovieDetailRow
                                                key={movie.id}
                                                movie={movie}
                                            />
                                        ),
                                    )}
                                </div>
                            ) : null}
                            <div className={view === 'list' ? 'sm:hidden' : ''}>
                                <MovieList
                                    movies={movies.data as MovieRowItem[]}
                                />
                            </div>
                        </InfiniteScroll>
                    </section>
                )}
                {requestOn && (
                    <form
                        className="glass flex flex-wrap items-end gap-2 rounded-2xl p-4"
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
            </CinemaShell>
        </>
    );
}
