import { Link } from '@inertiajs/react';
import { Check, Crown, Trophy } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { MoviePoster } from '@/components/cinema/movie-tile';
import { api, ApiError } from '@/lib/api';
import { tr } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import type { MovieCard } from '@/types';

type Candidate = MovieCard & { votes: number; percent: number };
type Board = {
    week: string;
    ends_at: string;
    total: number;
    mine: number | null;
    candidates: Candidate[];
    winner: (MovieCard & { votes: number; week: string }) | null;
};

/**
 * «Тайтл тижня»: шість кандидатів, один голос за тиждень (можна перенести). Після голосу — відсотки;
 * переможець минулого тижня — з короною.
 */
export function MovieOfWeek() {
    const [board, setBoard] = useState<Board | null>(null);
    const [busy, setBusy] = useState(false);
    const reduce = useReducedMotion();

    useEffect(() => {
        api<Board>('GET', '/cinema/week')
            .then(setBoard)
            .catch(() => undefined);
    }, []);

    if (!board || board.candidates.length === 0) return null;
    const voted = board.mine !== null;

    const vote = (id: number) => {
        if (busy) return;
        setBusy(true);
        api<Board>('POST', `/cinema/week/${id}`)
            .then(setBoard)
            .catch((e) =>
                toast.error(
                    e instanceof ApiError
                        ? e.message
                        : tr('Не вдалося проголосувати'),
                ),
            )
            .finally(() => setBusy(false));
    };

    return (
        <section className="gc-solid rounded-2xl p-4">
            <div className="mb-3 flex flex-wrap items-center gap-2">
                <Trophy className="size-5 text-amber-400" />
                <h2 className="font-display text-lg font-bold text-white">
                    {tr('Тайтл тижня')}
                </h2>
                <span className="text-sm text-white/50">
                    {voted
                        ? tr('Голосів: {n} · можна змінити до неділі', {
                              n: board.total,
                          })
                        : tr('Оберіть, що дивитися всім цього тижня')}
                </span>
                {board.winner && (
                    <Link
                        href={board.winner.href}
                        className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-amber-400/12 px-3 py-1 text-xs font-semibold text-amber-200"
                    >
                        <Crown className="size-3.5" />
                        {tr('Минулого тижня: {title}', {
                            title: board.winner.title,
                        })}
                    </Link>
                )}
            </div>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                {board.candidates.map((m) => {
                    const mine = board.mine === m.id;

                    return (
                        <button
                            key={m.id}
                            type="button"
                            onClick={() => vote(m.id)}
                            disabled={busy}
                            aria-pressed={mine}
                            className={cn(
                                'group relative flex flex-col overflow-hidden rounded-xl text-left transition',
                                mine
                                    ? 'ring-2 ring-primary'
                                    : 'hover:ring-1 hover:ring-white/20',
                            )}
                        >
                            <span className="relative block aspect-[2/3] overflow-hidden bg-white/[0.04]">
                                <MoviePoster movie={m} className="size-full" />
                                {voted && (
                                    <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent p-2 pt-6">
                                        <span className="block h-1.5 overflow-hidden rounded-full bg-white/20">
                                            <motion.span
                                                className="block h-full rounded-full bg-primary"
                                                initial={
                                                    reduce
                                                        ? false
                                                        : { width: 0 }
                                                }
                                                animate={{
                                                    width: `${m.percent}%`,
                                                }}
                                                transition={{ duration: 0.5 }}
                                            />
                                        </span>
                                        <span className="mt-1 block text-xs font-bold text-white tabular-nums">
                                            {m.percent}%
                                        </span>
                                    </span>
                                )}
                                {mine && (
                                    <span className="absolute top-1.5 right-1.5 grid size-6 place-items-center rounded-full bg-primary text-white">
                                        <Check className="size-3.5" />
                                    </span>
                                )}
                            </span>
                            <span className="truncate px-1 pt-1.5 text-xs font-semibold text-white">
                                {m.title}
                            </span>
                        </button>
                    );
                })}
            </div>
        </section>
    );
}
