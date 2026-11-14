import { EyeOff, Sparkles } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useState } from 'react';
import { MovieTile } from '@/components/cinema/movie-tile';
import { api } from '@/lib/api';
import { tr } from '@/lib/i18n';
import type { MovieCard } from '@/types';

/**
 * «Вам сподобається»: рекомендації з поясненням «Бо вам сподобалося …»
 * і кнопкою «Не цікаво», яка прибирає тайтл назавжди.
 */
export function ForYouRow({ movies: initial }: { movies: MovieCard[] }) {
    const [movies, setMovies] = useState(initial);
    const reduce = useReducedMotion();

    const dismiss = (movie: MovieCard) => {
        setMovies((list) => list.filter((m) => m.id !== movie.id));
        void api('POST', `/cinema/${movie.slug}/dismiss`).catch(
            () => undefined,
        );
    };

    return (
        <div className="-mx-1 scrollbar-none flex snap-x gap-3 overflow-x-auto px-1 pt-1 pb-1">
            <AnimatePresence initial={false}>
                {movies.map((movie) => (
                    <motion.div
                        key={movie.id}
                        layout={!reduce}
                        exit={
                            reduce
                                ? { opacity: 0 }
                                : { opacity: 0, scale: 0.9, width: 0 }
                        }
                        transition={{ duration: 0.22 }}
                        className="w-[132px] shrink-0 snap-start sm:w-[150px]"
                    >
                        <MovieTile movie={movie} />
                        <div className="mt-1.5 flex items-start gap-1">
                            <p className="line-clamp-2 min-h-[2lh] flex-1 text-[11px] leading-snug text-white/55">
                                {movie.reason ? (
                                    tr(movie.reason)
                                ) : (
                                    <span className="inline-flex items-center gap-1">
                                        <Sparkles className="size-3" />
                                        {tr('Під ваш смак')}
                                    </span>
                                )}
                            </p>
                            <button
                                type="button"
                                onClick={() => dismiss(movie)}
                                className="flex size-6 shrink-0 items-center justify-center rounded-md text-white/40 transition hover:bg-white/10 hover:text-white"
                                aria-label={tr('Не цікаво')}
                                title={tr('Не цікаво')}
                            >
                                <EyeOff className="size-3.5" />
                            </button>
                        </div>
                    </motion.div>
                ))}
            </AnimatePresence>
        </div>
    );
}
