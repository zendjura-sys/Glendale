import { Check, Crown, Plus, Sparkles, Trash2, X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { UserAvatar } from '@/components/gc/user-avatar';
import { Widget } from '@/components/gc/widget';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogTitle,
} from '@/components/ui/dialog';
import { useRealtime } from '@/hooks/use-realtime';
import { api } from '@/lib/api';
import { tr } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import type { UserCard } from '@/types';

type QuizState = {
    id: number;
    title: string;
    phase: 'draft' | 'question' | 'reveal' | 'done';
    index: number;
    total: number;
    seconds: number;
    phase_at: string | null;
    question: { q: string; options: string[]; answer: number | null } | null;
    my_choice: number | null;
    my_points: number;
    answered: number;
    leaders: { user: UserCard; points: number }[];
};

type Payload = {
    quiz: QuizState | null;
    can_host: boolean;
    community_id: number;
};

const LETTERS = ['A', 'B', 'C', 'D'];

/** Скільки секунд лишилось на питання (за годинником сервера — phase_at). */
function useCountdown(quiz: QuizState | null): number {
    const [left, setLeft] = useState(0);
    useEffect(() => {
        if (!quiz || quiz.phase !== 'question' || !quiz.phase_at) {
            setLeft(0);
            return;
        }
        const end = new Date(quiz.phase_at).getTime() + quiz.seconds * 1000;
        const tick = () =>
            setLeft(Math.max(0, Math.ceil((end - Date.now()) / 1000)));
        tick();
        const timer = window.setInterval(tick, 250);
        return () => window.clearInterval(timer);
    }, [quiz?.id, quiz?.phase, quiz?.phase_at, quiz?.seconds]);
    return left;
}

/**
 * Жива вікторина спільноти (№225): ведучий складає питання й гортає «Далі», учасники
 * відповідають на час; після питання — правильна відповідь і лідери.
 */
export function LiveQuiz({ slug }: { slug: string }) {
    const [data, setData] = useState<Payload | null>(null);
    const [editing, setEditing] = useState(false);
    const [busy, setBusy] = useState(false);
    const base = `/c/${slug}/quiz`;

    const load = useCallback(
        () =>
            void api<Payload>('GET', base)
                .then(setData)
                .catch(() => setData(null)),
        [base],
    );

    useEffect(() => {
        load();
    }, [load]);

    const quiz = data?.quiz ?? null;
    const live = quiz?.phase === 'question' || quiz?.phase === 'reveal';
    // Запасний варіант, якщо веб-сокет не підключився: перечитуємо стан кожні 3 с, поки гра йде.
    useEffect(() => {
        if (!live) return;
        const timer = window.setInterval(load, 3000);
        return () => window.clearInterval(timer);
    }, [live, load]);

    const left = useCountdown(quiz);

    if (!data || (!quiz && !data.can_host)) return null;
    if (quiz?.phase === 'draft' && !data.can_host) return null;

    const advance = () => {
        if (!quiz) return;
        setBusy(true);
        api<Payload>('POST', `${base}/${quiz.id}/advance`)
            .then((r) => setData((d) => (d ? { ...d, quiz: r.quiz } : d)))
            .catch(() => toast.error(tr('Не вдалося перейти далі.')))
            .finally(() => setBusy(false));
    };
    const answer = (choice: number) => {
        if (!quiz || quiz.my_choice !== null) return;
        setData((d) =>
            d && d.quiz ? { ...d, quiz: { ...d.quiz, my_choice: choice } } : d,
        );
        api('POST', `${base}/${quiz.id}/answer`, {
            question: quiz.index,
            choice,
        }).catch(() => {
            toast.error(tr('Відповідь не прийнято — час вийшов.'));
            load();
        });
    };

    const hostLabel =
        quiz?.phase === 'draft'
            ? tr('Почати вікторину')
            : quiz?.phase === 'question'
              ? tr('Показати відповідь')
              : quiz && quiz.index + 1 >= quiz.total
                ? tr('Підсумки')
                : tr('Наступне питання');

    return (
        <Widget title={tr('Вікторина')} icon={Sparkles}>
            {data.community_id > 0 && (
                <QuizRealtime id={data.community_id} onUpdate={load} />
            )}
            <div className="space-y-3 px-1">
                {!quiz || quiz.phase === 'done' ? (
                    <>
                        {quiz && <Results quiz={quiz} />}
                        {data.can_host && (
                            <button
                                type="button"
                                onClick={() => setEditing(true)}
                                className="gc-ghost-btn"
                            >
                                <Plus className="size-4" />
                                {quiz
                                    ? tr('Нова вікторина')
                                    : tr('Створити вікторину')}
                            </button>
                        )}
                    </>
                ) : (
                    <>
                        <div className="flex items-baseline justify-between gap-2">
                            <p className="truncate text-sm font-semibold text-[var(--gc-text)]">
                                {quiz.title}
                            </p>
                            <span className="shrink-0 text-xs text-[var(--gc-text-2)] tabular-nums">
                                {quiz.phase === 'draft'
                                    ? tr('{n} питань', { n: quiz.total })
                                    : `${quiz.index + 1}/${quiz.total}`}
                            </span>
                        </div>
                        {quiz.phase === 'question' && (
                            <div
                                className="gc-quiz-timer"
                                role="timer"
                                aria-label={tr('{n} с', { n: left })}
                            >
                                <span
                                    style={{
                                        width: `${(left / quiz.seconds) * 100}%`,
                                    }}
                                />
                            </div>
                        )}
                        {quiz.question && quiz.phase !== 'draft' && (
                            <>
                                <p className="text-[15px] font-semibold text-pretty text-[var(--gc-text)]">
                                    {quiz.question.q}
                                </p>
                                <div className="grid gap-1.5">
                                    {quiz.question.options.map((option, i) => {
                                        const revealed =
                                            quiz.phase === 'reveal' &&
                                            quiz.question!.answer !== null;
                                        const right =
                                            revealed &&
                                            quiz.question!.answer === i;
                                        const mine = quiz.my_choice === i;
                                        return (
                                            <button
                                                key={i}
                                                type="button"
                                                disabled={
                                                    quiz.phase !== 'question' ||
                                                    quiz.my_choice !== null ||
                                                    left === 0
                                                }
                                                aria-pressed={mine}
                                                onClick={() => answer(i)}
                                                className={cn(
                                                    'gc-quiz-option',
                                                    mine && 'is-mine',
                                                    right && 'is-right',
                                                    revealed &&
                                                        mine &&
                                                        !right &&
                                                        'is-wrong',
                                                )}
                                            >
                                                <span className="gc-quiz-option__letter">
                                                    {right ? (
                                                        <Check className="size-3.5" />
                                                    ) : revealed && mine ? (
                                                        <X className="size-3.5" />
                                                    ) : (
                                                        LETTERS[i]
                                                    )}
                                                </span>
                                                <span className="min-w-0 flex-1 text-left">
                                                    {option}
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>
                                <p className="text-xs text-[var(--gc-text-2)]">
                                    {quiz.phase === 'question'
                                        ? quiz.my_choice !== null
                                            ? tr(
                                                  'Відповідь прийнято. Чекаємо на інших…',
                                              )
                                            : left === 0
                                              ? tr('Час вийшов')
                                              : tr('Залишилось {n} с', {
                                                    n: left,
                                                })
                                        : tr('Ваші бали: {n}', {
                                              n: quiz.my_points,
                                          })}
                                    {data.can_host &&
                                        ` · ${tr('Відповіли: {n}', { n: quiz.answered })}`}
                                </p>
                            </>
                        )}
                        {quiz.phase === 'reveal' && quiz.leaders.length > 0 && (
                            <Leaders leaders={quiz.leaders.slice(0, 3)} />
                        )}
                        {data.can_host && (
                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    onClick={advance}
                                    disabled={busy}
                                    className="gc-pill-primary"
                                >
                                    {hostLabel}
                                </button>
                                {quiz.phase === 'draft' && (
                                    <button
                                        type="button"
                                        onClick={() => setEditing(true)}
                                        className="gc-ghost-btn"
                                    >
                                        {tr('Змінити')}
                                    </button>
                                )}
                            </div>
                        )}
                    </>
                )}
            </div>
            {data.can_host && (
                <QuizEditor
                    open={editing}
                    onOpenChange={setEditing}
                    onSaved={(q) => {
                        setData((d) => (d ? { ...d, quiz: q } : d));
                        setEditing(false);
                    }}
                    base={base}
                />
            )}
        </Widget>
    );
}

/** Окремо: підписка на канал спільноти лише тоді, коли знаємо її id. */
function QuizRealtime({ id, onUpdate }: { id: number; onUpdate: () => void }) {
    useRealtime(`community.${id}`, { 'quiz.updated': onUpdate });
    return null;
}

function Leaders({ leaders }: { leaders: QuizState['leaders'] }) {
    return (
        <ol className="space-y-1">
            {leaders.map((row, i) => (
                <li
                    key={row.user.id}
                    className="flex items-center gap-2.5 rounded-xl px-1.5 py-1 text-sm"
                >
                    <span className="w-5 text-center text-xs font-bold text-[var(--gc-text-2)] tabular-nums">
                        {i === 0 ? (
                            <Crown className="mx-auto size-4 text-amber-300" />
                        ) : (
                            i + 1
                        )}
                    </span>
                    <UserAvatar user={row.user} size="xs" showOnline={false} />
                    <span className="min-w-0 flex-1 truncate text-[var(--gc-text)]">
                        {row.user.name}
                    </span>
                    <span className="font-semibold text-[var(--gc-text)] tabular-nums">
                        {row.points}
                    </span>
                </li>
            ))}
        </ol>
    );
}

function Results({ quiz }: { quiz: QuizState }) {
    return (
        <div>
            <p className="text-sm font-semibold text-[var(--gc-text)]">
                {tr('Підсумки: {title}', { title: quiz.title })}
            </p>
            <p className="mt-0.5 text-xs text-[var(--gc-text-2)]">
                {tr('Ваші бали: {n}', { n: quiz.my_points })}
            </p>
            {quiz.leaders.length > 0 && (
                <div className="mt-2">
                    <Leaders leaders={quiz.leaders} />
                </div>
            )}
        </div>
    );
}

type Draft = { q: string; options: string[]; answer: number };

const emptyQuestion = (): Draft => ({ q: '', options: ['', ''], answer: 0 });

function QuizEditor({
    open,
    onOpenChange,
    onSaved,
    base,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSaved: (quiz: QuizState) => void;
    base: string;
}) {
    const [title, setTitle] = useState('');
    const [seconds, setSeconds] = useState(20);
    const [questions, setQuestions] = useState<Draft[]>([emptyQuestion()]);
    const [busy, setBusy] = useState(false);
    const patch = (i: number, next: Partial<Draft>) =>
        setQuestions((list) =>
            list.map((q, j) => (j === i ? { ...q, ...next } : q)),
        );
    const field =
        'input-glass h-10 w-full rounded-xl px-3 text-sm text-white placeholder:text-white/30';

    const save = () => {
        setBusy(true);
        api<{ quiz: QuizState }>('POST', base, { title, seconds, questions })
            .then((r) => onSaved(r.quiz))
            .catch((e: { message?: string }) =>
                toast.error(e.message ?? tr('Перевірте питання й варіанти.')),
            )
            .finally(() => setBusy(false));
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[calc(100dvh-2rem)] gap-4 overflow-y-auto sm:max-w-lg">
                <div>
                    <DialogTitle className="font-display text-lg font-semibold text-white">
                        {tr('Нова вікторина')}
                    </DialogTitle>
                    <DialogDescription className="mt-1 text-sm text-white/50">
                        {tr(
                            'До 20 питань, у кожному 2–4 варіанти. Позначте правильний — учасники побачать його після таймера.',
                        )}
                    </DialogDescription>
                </div>
                <div className="grid gap-2 sm:grid-cols-[1fr_7rem]">
                    <input
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder={tr('Назва, наприклад «Ігри 2000-х»')}
                        maxLength={120}
                        className={field}
                    />
                    <label className="flex items-center gap-2 text-sm text-white/60">
                        <input
                            type="number"
                            min={10}
                            max={60}
                            value={seconds}
                            onChange={(e) => setSeconds(Number(e.target.value))}
                            className={field}
                            aria-label={tr('Секунд на питання')}
                        />
                        {tr('с')}
                    </label>
                </div>
                {questions.map((question, i) => (
                    <fieldset
                        key={i}
                        className="gc-solid-2 space-y-2 rounded-2xl p-3"
                    >
                        <div className="flex items-center gap-2">
                            <legend className="text-xs font-semibold text-white/50">
                                {tr('Питання {n}', { n: i + 1 })}
                            </legend>
                            {questions.length > 1 && (
                                <button
                                    type="button"
                                    onClick={() =>
                                        setQuestions((list) =>
                                            list.filter((_, j) => j !== i),
                                        )
                                    }
                                    className="ml-auto text-white/40 hover:text-white"
                                    aria-label={tr('Прибрати питання')}
                                >
                                    <Trash2 className="size-4" />
                                </button>
                            )}
                        </div>
                        <input
                            value={question.q}
                            onChange={(e) => patch(i, { q: e.target.value })}
                            placeholder={tr('Питання')}
                            maxLength={200}
                            className={field}
                        />
                        {question.options.map((option, k) => (
                            <div key={k} className="flex items-center gap-2">
                                <input
                                    type="radio"
                                    name={`answer-${i}`}
                                    checked={question.answer === k}
                                    onChange={() => patch(i, { answer: k })}
                                    aria-label={tr('Правильна відповідь')}
                                    className="size-4 accent-[var(--gc-accent)]"
                                />
                                <input
                                    value={option}
                                    onChange={(e) =>
                                        patch(i, {
                                            options: question.options.map(
                                                (o, m) =>
                                                    m === k
                                                        ? e.target.value
                                                        : o,
                                            ),
                                        })
                                    }
                                    placeholder={tr('Варіант {letter}', {
                                        letter: LETTERS[k],
                                    })}
                                    maxLength={80}
                                    className={field}
                                />
                            </div>
                        ))}
                        {question.options.length < 4 && (
                            <button
                                type="button"
                                onClick={() =>
                                    patch(i, {
                                        options: [...question.options, ''],
                                    })
                                }
                                className="text-xs font-medium text-sky-400 hover:text-white"
                            >
                                {tr('+ варіант')}
                            </button>
                        )}
                    </fieldset>
                ))}
                <div className="flex flex-wrap gap-2">
                    {questions.length < 20 && (
                        <button
                            type="button"
                            onClick={() =>
                                setQuestions((list) => [
                                    ...list,
                                    emptyQuestion(),
                                ])
                            }
                            className="gc-ghost-btn"
                        >
                            <Plus className="size-4" />
                            {tr('Питання')}
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={save}
                        disabled={busy || title.trim().length < 2}
                        className="gc-pill-primary ml-auto"
                    >
                        {tr('Зберегти')}
                    </button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
