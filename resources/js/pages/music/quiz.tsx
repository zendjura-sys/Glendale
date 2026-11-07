import { Head } from '@inertiajs/react';
import { Check, Music2, Play, X } from 'lucide-react';
import { m, useReducedMotion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Leaderboard } from '@/components/fun/leaderboard';
import type { TopRow } from '@/components/fun/leaderboard';
import { api } from '@/lib/api';
import { tr } from '@/lib/i18n';
import { getPlayerState, toggle } from '@/lib/player';
import { cn } from '@/lib/utils';

type Question = { audio: string; start: number; options: string[] };
type Answer = {
    correct: boolean;
    answer: number;
    score: number;
    total: number;
    finished: boolean;
    best: number;
};

/** «Вгадай пісню»: уривок звучить кілька секунд — оберіть виконавця й назву. */
export default function MusicQuiz({
    top,
    best,
    clip,
}: {
    top: TopRow[];
    best: number | null;
    clip: number;
}) {
    const reduce = useReducedMotion();
    const audio = useRef<HTMLAudioElement | null>(null);
    const stopTimer = useRef<number | undefined>(undefined);
    const [round, setRound] = useState<string | null>(null);
    const [questions, setQuestions] = useState<Question[]>([]);
    const [index, setIndex] = useState(0);
    const [picked, setPicked] = useState<number | null>(null);
    const [result, setResult] = useState<Answer | null>(null);
    const [busy, setBusy] = useState(false);
    const [done, setDone] = useState(false);

    const stop = () => {
        window.clearTimeout(stopTimer.current);
        audio.current?.pause();
    };

    useEffect(() => stop, []);

    const play = (q: Question) => {
        stop();
        const el = audio.current ?? new Audio();
        audio.current = el;
        el.src = q.audio;
        el.currentTime = q.start;
        void el.play().catch(() => {});
        stopTimer.current = window.setTimeout(() => el.pause(), clip * 1000);
    };

    const start = () => {
        // Основний плеєр замовкає, щоб не заважати.
        if (getPlayerState().playing) toggle();
        setBusy(true);
        api<{ round: string; questions: Question[] }>('POST', '/music/quiz')
            .then((data) => {
                setRound(data.round);
                setQuestions(data.questions);
                setIndex(0);
                setPicked(null);
                setResult(null);
                setDone(false);
                play(data.questions[0]);
            })
            .catch((e) => toast.error((e as Error).message))
            .finally(() => setBusy(false));
    };

    const choose = (option: number) => {
        if (!round || picked !== null) return;
        setPicked(option);
        api<Answer>('POST', `/music/quiz/${round}`, { question: index, option })
            .then(setResult)
            .catch((e) => toast.error((e as Error).message));
    };

    const next = () => {
        const n = index + 1;
        setIndex(n);
        setPicked(null);
        setResult(null);
        play(questions[n]);
    };

    const q = questions[index];
    const finished = done && result !== null;

    return (
        <>
            <Head title={tr('Вгадай пісню')} />
            <div className="mx-auto max-w-2xl space-y-4 px-1 pt-2 pb-8">
                <header>
                    <h1 className="font-display text-2xl font-bold text-white">
                        {tr('Вгадай пісню')}
                    </h1>
                    <p className="mt-1 text-sm text-white/50">
                        {tr(
                            'П’ять уривків по {clip} секунд — оберіть, що звучить.',
                            { clip },
                        )}
                        {best !== null &&
                            ` ${tr('Ваш найкращий сьогодні: {score}', { score: best })}`}
                    </p>
                </header>

                {!round || done ? (
                    <section className="gc-solid flex flex-col items-center gap-3 rounded-2xl p-8 text-center">
                        <Music2 className="size-10 text-primary" />
                        {finished && result && (
                            <p className="font-display text-3xl font-bold text-white">
                                {result.score}/{result.total}
                            </p>
                        )}
                        <button
                            type="button"
                            onClick={start}
                            disabled={busy}
                            className="h-11 rounded-xl bg-primary px-6 text-sm font-semibold text-white disabled:opacity-60"
                        >
                            {finished ? tr('Ще раунд') : tr('Почати')}
                        </button>
                    </section>
                ) : (
                    q && (
                        <m.section
                            key={index}
                            initial={reduce ? false : { opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="gc-solid space-y-3 rounded-2xl p-4"
                        >
                            <div className="flex items-center gap-3">
                                <span className="text-sm text-white/50 tabular-nums">
                                    {tr('Питання {n} з {total}', {
                                        n: index + 1,
                                        total: questions.length,
                                    })}
                                </span>
                                <button
                                    type="button"
                                    onClick={() => play(q)}
                                    className="ml-auto flex h-9 items-center gap-2 rounded-xl bg-white/[0.08] px-3 text-sm text-white hover:bg-white/[0.12]"
                                >
                                    <Play className="size-4" />
                                    {tr('Ще раз')}
                                </button>
                            </div>
                            <div className="grid gap-2">
                                {q.options.map((option, i) => {
                                    const right = result && result.answer === i;
                                    const wrong =
                                        result && picked === i && !right;

                                    return (
                                        <button
                                            key={option}
                                            type="button"
                                            onClick={() => choose(i)}
                                            disabled={picked !== null}
                                            className={cn(
                                                'flex min-h-12 items-center gap-3 rounded-xl px-4 py-2 text-left text-sm transition',
                                                right
                                                    ? 'bg-emerald-500/20 text-white'
                                                    : wrong
                                                      ? 'bg-red-500/20 text-white'
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
                            {result && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        if (result.finished) {
                                            stop();
                                            setDone(true);
                                        } else {
                                            next();
                                        }
                                    }}
                                    className="h-10 w-full rounded-xl bg-primary text-sm font-semibold text-white"
                                >
                                    {result.finished
                                        ? tr('Результат')
                                        : tr('Далі')}
                                </button>
                            )}
                        </m.section>
                    )
                )}

                <Leaderboard rows={top} />
            </div>
        </>
    );
}
