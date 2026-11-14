import { Link } from '@inertiajs/react';
import { ChevronLeft, ChevronRight, LayoutGrid, List } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { MoviePoster } from '@/components/cinema/movie-tile';
import { PosterBadges, PosterHover } from '@/components/cinema/poster-badges';
import { UnderlineTabs } from '@/components/gc/underline-tabs';
import { tr } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import type { MovieCard } from '@/types';

/**
 * Вкладки за типом (Серіали / Фільми / Аніме…) і стрічка плиток: постер — тло плитки,
 * назва й тип поверх, бейджі по кутах; гортається стрілками.
 */
export function TypeCarousel({
    groups,
}: {
    groups: { key: string; label: string; movies: MovieCard[] }[];
}) {
    const [active, setActive] = useState(groups[0]?.key ?? '');
    const scroller = useRef<HTMLDivElement>(null);
    const group = groups.find((g) => g.key === active) ?? groups[0];
    if (!group) return null;

    const scroll = (dir: 1 | -1) =>
        scroller.current?.scrollBy({
            left: dir * scroller.current.clientWidth * 0.8,
            behavior: 'smooth',
        });

    return (
        <section className="glass overflow-hidden rounded-2xl">
            <div className="flex items-center gap-2 px-3 pt-2">
                <UnderlineTabs
                    className="min-w-0 flex-1"
                    active={group.key}
                    tabs={groups.map((g) => ({
                        key: g.key,
                        label: g.label,
                        onClick: () => setActive(g.key),
                    }))}
                />
                <div className="flex shrink-0 gap-1">
                    {([-1, 1] as const).map((dir) => (
                        <button
                            key={dir}
                            type="button"
                            onClick={() => scroll(dir)}
                            aria-label={dir < 0 ? tr('Назад') : tr('Далі')}
                            className="flex size-9 items-center justify-center rounded-full bg-white/[0.07] text-white/70 hover:text-white"
                        >
                            {dir < 0 ? (
                                <ChevronLeft className="size-4" />
                            ) : (
                                <ChevronRight className="size-4" />
                            )}
                        </button>
                    ))}
                </div>
            </div>
            <div
                ref={scroller}
                className="mt-2 scrollbar-none flex snap-x gap-1 overflow-x-auto"
            >
                {group.movies.map((movie) => (
                    <Link
                        key={movie.id}
                        href={movie.href}
                        className="group relative w-[46%] shrink-0 snap-start overflow-hidden sm:w-[31%] lg:w-[24.5%]"
                    >
                        <MoviePoster
                            movie={movie}
                            className="aspect-[3/4] w-full transition duration-700 group-hover:scale-105"
                        />
                        <span
                            data-on-dark
                            className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent px-3 pt-16 pb-3 text-center"
                        >
                            <span className="block text-[11px] font-medium text-primary">
                                {movie.type_label}
                            </span>
                            <span className="line-clamp-2 text-sm font-semibold text-white">
                                {movie.title}
                            </span>
                        </span>
                        <PosterBadges
                            movie={{
                                ...movie,
                                age_rating: null,
                                episodes_count: null,
                            }}
                        />
                    </Link>
                ))}
            </div>
        </section>
    );
}

export type CatalogView = 'grid' | 'list';

const VIEW_KEY = 'gc.cinema.view';

/** Вигляд каталогу (сітка / список) — запам'ятовується в браузері. */
export function useCatalogView(): [CatalogView, (v: CatalogView) => void] {
    const [view, setView] = useState<CatalogView>('grid');

    useEffect(() => {
        try {
            if (window.localStorage.getItem(VIEW_KEY) === 'list')
                setView('list');
        } catch {
            // приватний режим — лишаємо сітку
        }
    }, []);

    return [
        view,
        (v) => {
            setView(v);
            try {
                window.localStorage.setItem(VIEW_KEY, v);
            } catch {
                // не критично
            }
        },
    ];
}

export function ViewToggle({
    view,
    onChange,
}: {
    view: CatalogView;
    onChange: (v: CatalogView) => void;
}) {
    return (
        <div className="flex shrink-0 rounded-xl bg-white/[0.06] p-1">
            {(
                [
                    ['list', List, tr('Списком')],
                    ['grid', LayoutGrid, tr('Сіткою')],
                ] as const
            ).map(([key, Icon, label]) => (
                <button
                    key={key}
                    type="button"
                    onClick={() => onChange(key)}
                    aria-label={label}
                    aria-pressed={view === key}
                    className={cn(
                        'flex size-8 items-center justify-center rounded-lg transition',
                        view === key
                            ? 'bg-white/12 text-primary'
                            : 'text-white/45 hover:text-white',
                    )}
                >
                    <Icon className="size-4" />
                </button>
            ))}
        </div>
    );
}

/** Сегменти сортування над каталогом: «Нещодавно оновлені», «Популярні», «Нове на сайті». */
export function SortSegments<T extends string>({
    items,
    active,
    onChange,
}: {
    items: { key: T; label: string }[];
    active: T;
    onChange: (key: T) => void;
}) {
    return (
        <div
            ref={(el) => {
                // Телефон: активна кнопка завжди у полі зору, а не за краєм.
                el?.querySelector<HTMLElement>(
                    '[aria-pressed="true"]',
                )?.scrollIntoView({
                    block: 'nearest',
                    inline: 'center',
                });
            }}
            className="scrollbar-none flex min-w-0 gap-1 overflow-x-auto rounded-2xl bg-white/[0.05] p-1"
        >
            {items.map((item) => (
                <button
                    key={item.key}
                    type="button"
                    aria-pressed={active === item.key}
                    onClick={() => onChange(item.key)}
                    className={cn(
                        'shrink-0 rounded-xl px-4 py-2 text-sm font-semibold transition',
                        active === item.key
                            ? 'bg-white/10 text-primary'
                            : 'text-white/60 hover:text-white',
                    )}
                >
                    {item.label}
                </button>
            ))}
        </div>
    );
}

export type DetailMovie = MovieCard & {
    description?: string | null;
    countries?: string[];
    duration?: number | null;
};

/** Рядок каталогу «списком»: постер з бейджами ліворуч, праворуч — рік, країна, жанр, опис. */
export function MovieDetailRow({ movie }: { movie: DetailMovie }) {
    const facts = [
        [tr('Рік'), movie.year],
        [tr('Країна'), movie.countries?.join(', ')],
        [tr('Жанр'), movie.genres.join(', ')],
        [tr('Тип'), movie.type_label],
        [
            tr('Серій'),
            movie.type !== 'movie' && movie.episodes_count
                ? movie.episodes_count
                : null,
        ],
    ].filter(([, v]) => v !== null && v !== undefined && v !== '');

    return (
        <article className="flex gap-4 sm:gap-5">
            <Link
                href={movie.href}
                className="group relative w-[120px] shrink-0 overflow-hidden rounded-2xl sm:w-[170px]"
            >
                <MoviePoster
                    movie={movie}
                    className="aspect-[2/3] w-full transition duration-500 group-hover:scale-105"
                />
                <PosterBadges movie={movie} size="sm" />
                <PosterHover href={movie.href} />
            </Link>
            <div className="min-w-0 flex-1 py-1">
                <p className="text-xs text-white/45">{movie.type_label}</p>
                <Link href={movie.href}>
                    <h3 className="font-display text-lg leading-snug font-semibold text-white hover:text-primary">
                        {movie.title}
                    </h3>
                </Link>
                {movie.title_original &&
                    movie.title_original !== movie.title && (
                        <p className="truncate text-xs text-white/40">
                            {movie.title_original}
                        </p>
                    )}
                <dl className="mt-2 space-y-1 text-[13px]">
                    {facts.map(([label, value]) => (
                        <div key={String(label)} className="flex gap-1.5">
                            <dt className="font-semibold text-white/80">
                                {label}:
                            </dt>
                            <dd className="min-w-0 truncate text-white/60">
                                {value}
                            </dd>
                        </div>
                    ))}
                </dl>
                {movie.description && (
                    <p className="mt-2 line-clamp-3 text-[13px] leading-relaxed text-white/55 max-sm:hidden">
                        <span className="font-semibold text-white/80">
                            {tr('Опис')}:{' '}
                        </span>
                        {movie.description}
                    </p>
                )}
            </div>
        </article>
    );
}
