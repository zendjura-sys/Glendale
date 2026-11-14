import { Head } from '@inertiajs/react';
import { Check, Trophy, X } from 'lucide-react';
import { m, useReducedMotion } from 'motion/react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Leaderboard } from '@/components/fun/leaderboard';
import type { TopRow } from '@/components/fun/leaderboard';
import { EmptyState } from '@/components/gc/widget';
import { api } from '@/lib/api';
import { tr } from '@/lib/i18n';
import { cn } from '@/lib/utils';

type Question = {
    type: string;
    question: string;
    image: string | null;
    options: string[];
};
type Played = { score: number; total: number; answers: number[] };

/** Вікторина дня: п’ять питань про ігри, одна спроба на день. */
export default function Trivia({
    questions,
    played: initialPlayed,
    top: initialTop,
}: {
    questions: Question[];
    played: Played | null;
    top: TopRow[];
}) {
    const reduce = useReducedMotion();
    const [answers, setAnswers] = useState<(number | null)[]>(() =>
        questions.map(() => null),
    );
    const [played, setPlayed] = useState(initialPlayed);
    const [top, setTop] = useState(initialTop);
    const [busy, setBusy] = useState(false);

    const submit = () => {
        setBusy(true);
        api<Played & { top: TopRow[] }>('POST', '/games/trivia', { answers })
            .then((data) => {
                setPlayed({
                    score: data.score,
                    total: data.total,
                    answers: data.answers,
                });
                setTop(data.top);
            })
            .catch((e) => toast.error((e as Error).message))
            .finally(() => setBusy(false));
    };

    const ready = answers.every((a) => a !== null);

    return (
        <>
            <Head title={tr('Вікторина дня')} />
            <div className="mx-auto max-w-2xl space-y-4">
                <header>
                    <h1 className="font-display text-2xl font-bold text-white">
                        {tr('Вікторина дня')}
                    </h1>
                    <p className="mt-1 text-sm text-white/50">
                        {tr(
                            'П’ять питань про ігри — однакові для всіх. Одна спроба, нові питання завтра.',
                        )}
                    </p>
                </header>

                {questions.length === 0 ? (
                    <EmptyState
                        icon={Trophy}
                        title={tr('Сьогодні вікторини немає')}
                        text={tr(
                            'У каталозі ігор поки замало даних для питань.',
                        )}
                    />
                ) : (
                    <>
                        {played && (
                            <m.section
                                initial={reduce ? false : { opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="gc-solid flex items-center gap-4 rounded-2xl p-5"
                            >
                                <Trophy className="size-8 text-amber-300" />
                                <div>
                                    <p className="font-display text-2xl font-bold text-white">
                                        {played.score}/{played.total}
                                    </p>
                                    <p className="text-sm text-white/50">
                                        {tr('Нові питання — завтра.')}
                                    </p>
                                </div>
                            </m.section>
                        )}
                        {questions.map((q, qi) => (
                            <section
                                key={qi}
                                className="gc-solid space-y-3 rounded-2xl p-4"
                            >
                                <p className="text-xs text-white/40">
                                    {tr('Питання {n} з {total}', {
                                        n: qi + 1,
                                        total: questions.length,
                                    })}
                                </p>
                                <h2 className="font-semibold text-white">
                                    {q.question}
                                </h2>
                                {q.image && (
                                    <img
                                        src={q.image}
                                        alt=""
                                        className="max-h-56 rounded-xl object-cover"
                                    />
                                )}
                                <div className="grid gap-2 sm:grid-cols-2">
                                    {q.options.map((option, oi) => {
                                        const chosen = answers[qi] === oi;
                                        const right =
                                            played && played.answers[qi] === oi;
                                        const wrong =
                                            played && chosen && !right;

                                        return (
                                            <button
                                                key={option}
                                                type="button"
                                                disabled={played !== null}
                                                onClick={() =>
                                                    setAnswers((list) =>
                                                        list.map((a, i) =>
                                                            i === qi ? oi : a,
                                                        ),
                                                    )
                                                }
                                                className={cn(
                                                    'flex min-h-11 items-center gap-2 rounded-xl px-3 py-2 text-left text-sm transition',
                                                    right
                                                        ? 'bg-emerald-500/20 text-white'
                                                        : wrong
                                                          ? 'bg-red-500/20 text-white'
                                                          : chosen
                                                            ? 'bg-primary text-white'
                                                            : 'gc-solid-2 text-white/85 hover:bg-white/[0.1]',
                                                )}
                                            >
                                                <span className="min-w-0 flex-1">
                                                    {option}
                                                </span>
                                                {right && (
                                                    <Check className="size-4 text-emerald-400" />
                                                )}
                                                {wrong && (
                                                    <X className="size-4 text-red-400" />
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                            </section>
                        ))}
                        {!played && (
                            <button
                                type="button"
                                onClick={submit}
                                disabled={!ready || busy}
                                className="h-11 w-full rounded-xl bg-primary text-sm font-semibold text-white disabled:opacity-50"
                            >
                                {tr('Перевірити')}
                            </button>
                        )}
                    </>
                )}
                <Leaderboard rows={top} />
            </div>
        </>
    );
}
