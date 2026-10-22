import { Head, InfiniteScroll, Link } from '@inertiajs/react';
import { ArrowLeft, Bookmark, Star } from 'lucide-react';
import { MovieTile, movieGridClass } from '@/components/cinema/movie-tile';
import { EmptyState } from '@/components/gc/widget';
import { cn } from '@/lib/utils';
import type { MovieCard, MovieOption, MovieStatus, ScrollData } from '@/types';
import { tr } from '@/lib/i18n';

type MyMovie = MovieCard & {
    my_status: MovieStatus | null;
    my_rating: number | null;
};

type Props = {
    status: string;
    movies: ScrollData<MyMovie>;
    statuses: MovieOption<MovieStatus>[];
    counts: Record<string, number>;
};

export default function CinemaMy({ status, movies, statuses, counts }: Props) {
    const tabs = [
        { key: 'all', label: tr('Усі') },
        ...statuses,
        { key: 'rated', label: tr('Оцінені') },
    ];
    const labels = Object.fromEntries(statuses.map((s) => [s.key, s.label]));

    return (
        <>
            <Head title={tr('Мої фільми')} />
            <div className="space-y-5">
                <section className="glass relative overflow-hidden rounded-2xl p-5 sm:p-7">
                    <div className="pointer-events-none absolute -top-24 -right-16 size-80 rounded-full bg-gc-indigo/25 blur-3xl" />
                    <Link
                        href="/cinema"
                        className="relative inline-flex items-center gap-1.5 text-xs font-medium text-white/55 hover:text-white"
                    >
                        <ArrowLeft className="size-3.5" /> {tr('Кіно')}
                    </Link>
                    <h1 className="relative mt-3 font-display text-3xl font-bold text-white">
                        {tr('Мої')}{' '}
                        <span className="text-gradient">{tr('списки')}</span>
                    </h1>
                    <p className="relative mt-1 text-sm text-white/50">
                        {tr(
                            'Що ви дивитеся, що вже подивилися і що чекає свого вечора.',
                        )}
                    </p>
                </section>

                <div className="glass scrollbar-none flex gap-1 overflow-x-auto rounded-2xl p-2">
                    {tabs.map((tab) => (
                        <Link
                            key={tab.key}
                            href={
                                tab.key === 'all'
                                    ? '/cinema/my'
                                    : `/cinema/my?status=${tab.key}`
                            }
                            preserveScroll
                            className={cn(
                                'flex shrink-0 items-center gap-2 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition',
                                status === tab.key
                                    ? 'nav-active text-white'
                                    : 'text-white/55 hover:bg-white/[0.05] hover:text-white',
                            )}
                        >
                            {tab.label}
                            <span className="rounded-full bg-white/10 px-1.5 text-[11px] text-white/70">
                                {counts[tab.key] ?? 0}
                            </span>
                        </Link>
                    ))}
                </div>

                {movies.data.length === 0 ? (
                    <EmptyState
                        icon={Bookmark}
                        title={tr('Тут поки порожньо')}
                        text={tr(
                            'Відкрийте фільм і натисніть «Додати до списку».',
                        )}
                        action={
                            <Link
                                href="/cinema"
                                className="btn-glow rounded-xl px-5 py-2.5 text-sm font-semibold"
                            >
                                {tr('До каталогу')}
                            </Link>
                        }
                    />
                ) : (
                    <section className="glass rounded-2xl p-4 sm:p-5">
                        <InfiniteScroll data="movies" preserveUrl>
                            <div className={movieGridClass}>
                                {movies.data.map((movie) => (
                                    <MovieTile
                                        key={movie.id}
                                        movie={movie}
                                        badge={
                                            <div className="flex items-center justify-between gap-1">
                                                {movie.my_status && (
                                                    <span className="truncate rounded-md bg-black/70 px-1.5 py-0.5 text-xs font-semibold text-white backdrop-blur">
                                                        {
                                                            labels[
                                                                movie.my_status
                                                            ]
                                                        }
                                                    </span>
                                                )}
                                                {movie.my_rating && (
                                                    <span className="ml-auto inline-flex items-center gap-0.5 rounded-md bg-gc-amber px-1.5 py-0.5 text-xs font-bold text-black">
                                                        <Star className="size-2.5 fill-current" />
                                                        {movie.my_rating}
                                                    </span>
                                                )}
                                            </div>
                                        }
                                    />
                                ))}
                            </div>
                        </InfiniteScroll>
                    </section>
                )}
            </div>
        </>
    );
}
