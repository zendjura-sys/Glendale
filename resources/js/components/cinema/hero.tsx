import { Link } from '@inertiajs/react';
import {
    Bookmark,
    ChevronLeft,
    ChevronRight,
    Clapperboard,
    Clock,
    Play,
    Star,
} from 'lucide-react';
import { useReducedMotion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { MoviePoster } from '@/components/cinema/movie-tile';
import { api, ApiError } from '@/lib/api';
import { tr } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import type { MovieCard, MovieFeatured } from '@/types';

/** Банер-карусель рекомендованих тайтлів: банер — тло, текст і кнопки поверх. */
export function durationLabel(minutes: number | null) {
    if (!minutes) return null;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;

    return h
        ? tr('{h} год {v}', { h, v: m ? tr('{m} хв', { m }) : '' }).trim()
        : tr('{m} хв', { m });
}

/** Кільце рейтингу на мініатюрі: частка кола = оцінка з 10. */
function RatingRing({ value }: { value: number | null }) {
    if (!value) return null;
    const r = 15;
    const c = 2 * Math.PI * r;

    return (
        <span className="relative flex size-9 items-center justify-center rounded-full bg-black/55 text-[11px] font-bold text-white tabular-nums backdrop-blur">
            <svg viewBox="0 0 36 36" className="absolute inset-0 -rotate-90">
                <circle
                    cx="18"
                    cy="18"
                    r={r}
                    fill="none"
                    stroke="rgb(255 255 255 / .15)"
                    strokeWidth="2.5"
                />
                <circle
                    cx="18"
                    cy="18"
                    r={r}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeDasharray={c}
                    strokeDashoffset={c * (1 - Math.min(value, 10) / 10)}
                    className="text-primary"
                />
            </svg>
            {value.toFixed(1)}
        </span>
    );
}

/** Зірки з 10 (половинки округлюються вниз) — як шкала оцінки над назвою. */
function Stars({ value }: { value: number | null }) {
    const full = Math.round(value ?? 0);

    return (
        <span
            className="flex items-center gap-0.5"
            aria-label={value ? `${value.toFixed(1)}/10` : undefined}
        >
            {Array.from({ length: 10 }, (_, i) => (
                <Star
                    key={i}
                    className={cn(
                        'size-3.5',
                        i < full
                            ? 'fill-amber-400 text-amber-400'
                            : 'text-white/30',
                    )}
                />
            ))}
            {value ? (
                <span className="ml-1.5 text-xs text-white/60 tabular-nums">
                    {value.toFixed(1)}
                </span>
            ) : null}
        </span>
    );
}

/**
 * Головний слайдер кіно: банер на всю ширину, ліворуч — зірки, рік і жанри, назва, опис і кнопки
 * «Дивитися» / «Трейлер» / «У списки»; під ним риски слайдів, праворуч унизу — мініатюри наступних.
 */
export function Hero({ items }: { items: MovieFeatured[] }) {
    const [index, setIndex] = useState(0);
    const [paused, setPaused] = useState(false);
    const reduce = useReducedMotion();

    useEffect(() => {
        if (items.length < 2 || paused) return;
        const timer = setInterval(
            () => setIndex((i) => (i + 1) % items.length),
            8000,
        );

        return () => clearInterval(timer);
    }, [items.length, paused]);

    if (items.length === 0) return null;
    const movie = items[index];
    const next = [...items.slice(index), ...items.slice(0, index)].slice(0, 4);
    const addToList = () =>
        void api('PATCH', `/cinema/${movie.slug}/status`, { status: 'planned' })
            .then(() => toast.success(tr('Додано до списку «В планах».')))
            .catch((e) =>
                toast.error(
                    e instanceof ApiError
                        ? e.message
                        : tr('Не вдалося зберегти.'),
                ),
            );

    return (
        <section
            data-on-dark
            className="group/hero relative isolate overflow-hidden rounded-2xl bg-[#0d0e12]"
            onMouseEnter={() => setPaused(true)}
            onMouseLeave={() => setPaused(false)}
        >
            {items.map((item, i) => (
                <div
                    key={item.id}
                    aria-hidden
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
                                'size-full object-cover object-[70%_20%]',
                                !reduce &&
                                    'transition-transform duration-[9000ms] ease-out',
                                !reduce && i === index
                                    ? 'scale-105'
                                    : 'scale-100',
                                !item.backdrop && 'blur-2xl',
                            )}
                        />
                    ) : (
                        <div className="size-full bg-[radial-gradient(80%_80%_at_75%_20%,#2f7bff55,transparent),radial-gradient(60%_60%_at_10%_90%,#0ea5e933,transparent)]" />
                    )}
                </div>
            ))}
            {/* Затемнення ліворуч під текст і знизу під мініатюри. */}
            <div className="absolute inset-0 -z-10 bg-gradient-to-r from-[#0d0e12] via-[#0d0e12]/75 to-transparent" />
            <div className="absolute inset-0 -z-10 bg-gradient-to-t from-[#0d0e12] via-transparent to-transparent" />

            <div className="flex min-h-[380px] flex-col justify-end gap-6 p-5 sm:min-h-[460px] sm:p-8 @4xl:flex-row @4xl:items-end">
                <div
                    key={movie.id}
                    className="max-w-lg min-w-0 flex-1 animate-rise"
                >
                    <Stars value={movie.rating} />
                    <p className="mt-2 truncate text-xs text-white/60">
                        {[
                            movie.year,
                            ...(movie.countries ?? []),
                            movie.type_label,
                            ...movie.genres,
                        ]
                            .filter(Boolean)
                            .join(' · ')}
                    </p>
                    <h1 className="mt-2 line-clamp-2 font-display text-3xl leading-tight font-bold text-white sm:text-4xl">
                        {movie.title}
                    </h1>
                    {movie.title_original &&
                        movie.title_original !== movie.title && (
                            <p className="mt-0.5 truncate text-[15px] text-white/55">
                                {movie.title_original}
                            </p>
                        )}
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-white/60">
                        {durationLabel(movie.duration) && (
                            <span className="inline-flex items-center gap-1">
                                <Clock className="size-3.5" />
                                {durationLabel(movie.duration)}
                            </span>
                        )}
                        {movie.age_rating && (
                            <span className="rounded-md bg-white/15 px-1.5 font-semibold">
                                {movie.age_rating}
                            </span>
                        )}
                    </div>
                    {movie.description && (
                        <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-white/70">
                            {movie.description}
                        </p>
                    )}
                    <div className="mt-5 flex flex-wrap gap-2">
                        <Link
                            href={`${movie.href}#player`}
                            className="inline-flex h-11 items-center gap-2 rounded-full bg-gradient-brand px-7 text-sm font-semibold text-white"
                        >
                            <Play className="size-4 fill-current" />
                            {tr('Дивитися')}
                        </Link>
                        {movie.trailer_url && (
                            <Link
                                href={`${movie.href}#trailer`}
                                className="inline-flex h-11 items-center gap-2 rounded-full bg-white/10 px-5 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/20"
                            >
                                <Clapperboard className="size-4" />
                                {tr('Трейлер')}
                            </Link>
                        )}
                        <button
                            type="button"
                            onClick={addToList}
                            className="inline-flex h-11 items-center gap-2 rounded-full bg-white/10 px-5 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/20"
                        >
                            <Bookmark className="size-4" />
                            {tr('У списки')}
                        </button>
                    </div>
                    {items.length > 1 && (
                        <div className="mt-6 flex gap-1.5">
                            {items.map((item, i) => (
                                <button
                                    key={item.id}
                                    type="button"
                                    onClick={() => setIndex(i)}
                                    aria-label={item.title}
                                    className={cn(
                                        'h-1 w-8 rounded-full transition-colors',
                                        i === index
                                            ? 'bg-primary'
                                            : 'bg-white/20 hover:bg-white/40',
                                    )}
                                />
                            ))}
                        </div>
                    )}
                </div>

                {items.length > 1 && (
                    <div className="-mr-5 scrollbar-none flex gap-2 overflow-x-auto pr-5 sm:-mr-8 sm:pr-8 @4xl:w-[52%] @4xl:shrink-0">
                        {next.map((item, i) => (
                            <button
                                key={item.id}
                                type="button"
                                onClick={() => setIndex(items.indexOf(item))}
                                className={cn(
                                    'relative aspect-video w-[46%] shrink-0 overflow-hidden rounded-xl text-left transition sm:w-[34%]',
                                    i === 0
                                        ? 'opacity-100'
                                        : 'opacity-45 hover:opacity-80',
                                )}
                            >
                                {item.backdrop ? (
                                    <img
                                        src={item.backdrop}
                                        alt=""
                                        loading="lazy"
                                        className="size-full object-cover"
                                    />
                                ) : item.poster ? (
                                    <img
                                        src={item.poster}
                                        alt=""
                                        loading="lazy"
                                        className="size-full object-cover object-top"
                                    />
                                ) : (
                                    <span className="block size-full bg-gradient-to-br from-primary/45 via-[#141726] to-black" />
                                )}
                                <span className="absolute inset-x-0 bottom-0 flex items-end justify-between bg-gradient-to-t from-black/80 to-transparent p-2 pt-6">
                                    <span className="min-w-0">
                                        <span className="block truncate text-xs font-semibold text-white">
                                            {item.title}
                                        </span>
                                        <span className="text-[11px] text-white/60 tabular-nums">
                                            {item.year}
                                        </span>
                                    </span>
                                    <RatingRing value={item.rating} />
                                </span>
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </section>
    );
}

/**
 * «Продовжити перегляд»: горизонтальні картки — мініатюра, назва, «Сезон N · Серія M»
 * і смужка прогресу (відсоток переглянутих серій).
 */
export function ContinueRow({
    title,
    action,
    movies,
}: {
    title: React.ReactNode;
    action?: React.ReactNode;
    movies: (MovieCard & {
        progress?: { season: number | null; episode: number } | null;
    })[];
}) {
    const ref = useRef<HTMLDivElement>(null);
    const scroll = (dir: number) =>
        ref.current?.scrollBy({
            left: dir * ref.current.clientWidth * 0.85,
            behavior: 'smooth',
        });

    return (
        <section className="space-y-3">
            <div className="flex items-center gap-2">
                <h2 className="flex-1 font-display text-xl font-semibold text-white">
                    {title}
                </h2>
                {action}
                {([-1, 1] as const).map((dir) => (
                    <button
                        key={dir}
                        type="button"
                        onClick={() => scroll(dir)}
                        aria-label={dir < 0 ? tr('Назад') : tr('Далі')}
                        className="hidden size-8 items-center justify-center rounded-full text-white/50 hover:text-white sm:flex"
                    >
                        {dir < 0 ? (
                            <ChevronLeft className="size-4" />
                        ) : (
                            <ChevronRight className="size-4" />
                        )}
                    </button>
                ))}
            </div>
            <div
                ref={ref}
                className="scrollbar-none flex snap-x gap-3 overflow-x-auto"
            >
                {movies.map((movie) => {
                    const pct = movie.progress_pct ?? 0;

                    return (
                        <Link
                            key={movie.id}
                            href={`${movie.href}#player`}
                            className="glass group flex w-[280px] shrink-0 snap-start items-center gap-3 overflow-hidden rounded-2xl p-2 pr-3"
                        >
                            <MoviePoster
                                movie={movie}
                                className="h-20 w-[72px] shrink-0 rounded-xl"
                            />
                            <span className="min-w-0 flex-1">
                                <span className="block truncate text-sm font-semibold text-white group-hover:text-primary">
                                    {movie.title}
                                </span>
                                <span className="mt-0.5 block truncate text-xs text-white/55">
                                    {movie.progress
                                        ? [
                                              movie.progress.season
                                                  ? tr('Сезон {n}', {
                                                        n: movie.progress
                                                            .season,
                                                    })
                                                  : null,
                                              tr('Серія {n}', {
                                                  n: movie.progress.episode,
                                              }),
                                          ]
                                              .filter(Boolean)
                                              .join(' · ')
                                        : movie.type_label}
                                </span>
                                <span className="mt-2.5 block h-1 overflow-hidden rounded-full bg-white/10">
                                    <span
                                        className="block h-full rounded-full bg-primary"
                                        style={{
                                            width: `${Math.max(pct, 4)}%`,
                                        }}
                                    />
                                </span>
                            </span>
                        </Link>
                    );
                })}
            </div>
        </section>
    );
}
