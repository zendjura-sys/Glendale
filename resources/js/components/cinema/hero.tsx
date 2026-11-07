import { Link } from '@inertiajs/react';
import { Clock, Info, Play, Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';
import { MoviePoster, RatingBadge } from '@/components/cinema/movie-tile';
import { tr } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import type { MovieFeatured } from '@/types';

/** Банер-карусель рекомендованих тайтлів: банер — тло, текст і кнопки поверх. */
export function durationLabel(minutes: number | null) {
    if (!minutes) return null;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;

    return h
        ? tr('{h} год {v}', { h, v: m ? tr('{m} хв', { m }) : '' }).trim()
        : tr('{m} хв', { m });
}

export function Hero({ items }: { items: MovieFeatured[] }) {
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
            className="relative isolate overflow-hidden rounded-2xl border border-white/[0.08] bg-gc-ink"
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
                        <div className="size-full bg-[radial-gradient(80%_80%_at_70%_20%,#2f7bff55,transparent),radial-gradient(60%_60%_at_10%_90%,#0ea5e933,transparent)]" />
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
                    <span className="inline-flex items-center gap-1.5 rounded-chip border border-white/15 bg-white/[0.07] px-2.5 py-1 text-xs font-semibold text-white/70 backdrop-blur">
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
