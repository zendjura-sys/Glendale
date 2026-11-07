import { Head, InfiniteScroll, Link } from '@inertiajs/react';
import { Clapperboard, Play, X } from 'lucide-react';
import { AnimatePresence, m, useReducedMotion } from 'motion/react';
import { useState } from 'react';
import { ListSkeleton } from '@/components/gc/skeletons';
import { EmptyState } from '@/components/gc/widget';
import { tr } from '@/lib/i18n';
import type { GameCard, ScrollData } from '@/types';

type TrailerGame = GameCard & { videos: { id: string; name: string }[] };

/** Трейлери ігор з каталогу: найновіші релізи першими; відео відкривається поверх сторінки. */
export default function Trailers({
    games,
}: {
    games: ScrollData<TrailerGame>;
}) {
    const reduce = useReducedMotion();
    const [video, setVideo] = useState<string | null>(null);

    return (
        <>
            <Head title={tr('Трейлери')} />
            <div className="space-y-4">
                <header>
                    <h1 className="font-display text-2xl font-bold text-white">
                        {tr('Трейлери')}
                    </h1>
                    <p className="mt-1 text-sm text-white/50">
                        {tr('Свіжі трейлери ігор з каталогу GameCon.')}
                    </p>
                </header>
                {games.data.length === 0 ? (
                    <EmptyState
                        icon={Clapperboard}
                        title={tr('Трейлерів поки немає')}
                    />
                ) : (
                    <InfiniteScroll
                        data="games"
                        loading={<ListSkeleton rows={2} />}
                        className="grid gap-4 min-[1920px]:grid-cols-4 min-[2400px]:grid-cols-5 sm:grid-cols-2 xl:grid-cols-3"
                    >
                        {games.data.map((game) => (
                            <article
                                key={game.id}
                                className="glass overflow-hidden rounded-2xl"
                            >
                                <button
                                    type="button"
                                    onClick={() => setVideo(game.videos[0].id)}
                                    className="group relative block aspect-video w-full bg-black"
                                    aria-label={tr('Дивитися трейлер {name}', {
                                        name: game.name,
                                    })}
                                >
                                    <img
                                        src={`https://i.ytimg.com/vi/${game.videos[0].id}/hqdefault.jpg`}
                                        alt=""
                                        loading="lazy"
                                        className="size-full object-cover opacity-85 transition group-hover:opacity-100"
                                    />
                                    <span className="absolute inset-0 flex items-center justify-center">
                                        <span className="flex size-14 items-center justify-center rounded-full bg-black/60">
                                            <Play className="size-6 fill-white text-white" />
                                        </span>
                                    </span>
                                </button>
                                <div className="flex items-center gap-3 p-3">
                                    <Link
                                        href={`/games/${game.slug}`}
                                        className="min-w-0 flex-1"
                                    >
                                        <p className="truncate font-semibold text-white">
                                            {game.name}
                                        </p>
                                        <p className="truncate text-xs text-white/45">
                                            {game.videos[0].name}
                                            {game.year ? ` · ${game.year}` : ''}
                                        </p>
                                    </Link>
                                    {game.videos.slice(1).map((v) => (
                                        <button
                                            key={v.id}
                                            type="button"
                                            onClick={() => setVideo(v.id)}
                                            title={v.name}
                                            className="h-10 w-16 shrink-0 overflow-hidden rounded-lg bg-black"
                                        >
                                            <img
                                                src={`https://i.ytimg.com/vi/${v.id}/default.jpg`}
                                                alt={v.name}
                                                loading="lazy"
                                                className="size-full object-cover"
                                            />
                                        </button>
                                    ))}
                                </div>
                            </article>
                        ))}
                    </InfiniteScroll>
                )}
            </div>
            <AnimatePresence>
                {video && (
                    <m.div
                        role="dialog"
                        aria-modal="true"
                        initial={reduce ? false : { opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={reduce ? undefined : { opacity: 0 }}
                        className="fixed inset-0 z-[80] flex items-center justify-center bg-black/85 p-4"
                        onClick={() => setVideo(null)}
                    >
                        <div className="aspect-video w-full max-w-4xl overflow-hidden rounded-2xl bg-black">
                            <iframe
                                src={`https://www.youtube-nocookie.com/embed/${video}?autoplay=1`}
                                title={tr('Трейлер')}
                                allow="autoplay; encrypted-media; picture-in-picture"
                                allowFullScreen
                                className="size-full"
                            />
                        </div>
                        <button
                            type="button"
                            aria-label={tr('Закрити')}
                            className="absolute top-4 right-4 rounded-full bg-white/10 p-2 text-white"
                        >
                            <X className="size-5" />
                        </button>
                    </m.div>
                )}
            </AnimatePresence>
        </>
    );
}
