import { Link, usePage } from '@inertiajs/react';
import { Check, ChevronUp, MessageCircleQuestion, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { RowSkeleton } from '@/components/gc/skeletons';
import { UserAvatar } from '@/components/gc/user-avatar';
import { api, ApiError } from '@/lib/api';
import { timeAgo } from '@/lib/format';
import { tr } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import type { UserCard } from '@/types';

type Answer = {
    id: number;
    body: string;
    author: UserCard | null;
    own: boolean;
    votes: number;
    voted: boolean;
    created_at: string;
};

type Question = {
    id: number;
    title: string;
    body: string | null;
    author: UserCard | null;
    own: boolean;
    solved_answer_id: number | null;
    created_at: string;
    answers: Answer[];
};

const field =
    'input-glass w-full rounded-xl px-3.5 text-sm text-white placeholder:text-white/30 focus:outline-none';

/** «Питання гравців»: питання про гру, відповіді з голосами, «допомогло» від автора. */
export function GameQa({ slug }: { slug: string }) {
    const signedIn = Boolean(usePage().props.auth.user);
    const [questions, setQuestions] = useState<Question[] | null>(null);
    const [open, setOpen] = useState<number | null>(() => {
        if (typeof window === 'undefined') return null;
        const id = new URLSearchParams(window.location.search).get('question');
        return id ? Number(id) : null;
    });
    const [asking, setAsking] = useState(false);
    const [title, setTitle] = useState('');
    const [body, setBody] = useState('');
    const [busy, setBusy] = useState(false);
    const base = `/games/${slug}`;

    useEffect(() => {
        void api<{ questions: Question[] }>('GET', `${base}/questions`)
            .then((d) => setQuestions(d.questions))
            .catch(() => setQuestions([]));
    }, [base]);

    const run = (
        method: 'POST' | 'DELETE',
        url: string,
        data?: Record<string, unknown>,
        after?: () => void,
    ) => {
        setBusy(true);
        void api<{ questions: Question[] }>(method, url, data)
            .then((d) => {
                setQuestions(d.questions);
                after?.();
            })
            .catch((e: unknown) =>
                toast.error(
                    e instanceof ApiError ? e.message : tr('Не вдалося.'),
                ),
            )
            .finally(() => setBusy(false));
    };

    if (questions === null) {
        return (
            <div className="space-y-4">
                <RowSkeleton />
                <RowSkeleton />
            </div>
        );
    }

    return (
        <div className="space-y-3">
            {signedIn &&
                (asking ? (
                    <div className="space-y-2 rounded-xl bg-white/[0.04] p-3">
                        <input
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder={tr('Ваше питання — коротко')}
                            maxLength={160}
                            autoFocus
                            className={cn(field, 'h-11')}
                        />
                        <textarea
                            value={body}
                            onChange={(e) => setBody(e.target.value)}
                            placeholder={tr(
                                'Подробиці: що пробували, на якій платформі (необовʼязково)',
                            )}
                            rows={3}
                            maxLength={3000}
                            className={cn(field, 'resize-y py-2.5')}
                        />
                        <div className="flex justify-end gap-2">
                            <button
                                type="button"
                                onClick={() => setAsking(false)}
                                className="h-9 rounded-xl px-3 text-sm text-white/60 hover:text-white"
                            >
                                {tr('Скасувати')}
                            </button>
                            <button
                                type="button"
                                disabled={busy || title.trim().length < 8}
                                onClick={() =>
                                    run(
                                        'POST',
                                        `${base}/questions`,
                                        { title, body },
                                        () => {
                                            setTitle('');
                                            setBody('');
                                            setAsking(false);
                                        },
                                    )
                                }
                                className="btn-glow h-9 rounded-xl px-4 text-sm font-semibold disabled:opacity-50"
                            >
                                {tr('Запитати')}
                            </button>
                        </div>
                    </div>
                ) : (
                    <button
                        type="button"
                        onClick={() => setAsking(true)}
                        className="inline-flex h-9 items-center gap-2 rounded-xl bg-white/[0.07] px-3.5 text-sm font-medium text-white transition hover:bg-white/[0.11]"
                    >
                        <MessageCircleQuestion className="size-4" />
                        {tr('Поставити питання')}
                    </button>
                ))}
            {questions.length === 0 && (
                <p className="text-sm text-white/50">
                    {tr('Питань ще немає. Спитайте першим — гравці підкажуть.')}
                </p>
            )}
            <ul className="divide-y divide-white/[0.06]">
                {questions.map((q) => (
                    <QuestionRow
                        key={q.id}
                        q={q}
                        open={open === q.id}
                        onToggle={() => setOpen(open === q.id ? null : q.id)}
                        signedIn={signedIn}
                        busy={busy}
                        run={run}
                        base={base}
                    />
                ))}
            </ul>
        </div>
    );
}

function QuestionRow({
    q,
    open,
    onToggle,
    signedIn,
    busy,
    run,
    base,
}: {
    q: Question;
    open: boolean;
    onToggle: () => void;
    signedIn: boolean;
    busy: boolean;
    run: (
        method: 'POST' | 'DELETE',
        url: string,
        data?: Record<string, unknown>,
        after?: () => void,
    ) => void;
    base: string;
}) {
    const [reply, setReply] = useState('');

    return (
        <li className="py-3 first:pt-0 last:pb-0">
            <button
                type="button"
                onClick={onToggle}
                className="flex w-full items-start gap-3 text-left"
            >
                <span
                    className={cn(
                        'mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg text-xs font-semibold tabular-nums',
                        q.solved_answer_id
                            ? 'bg-emerald-500/15 text-emerald-200'
                            : 'bg-white/[0.06] text-white/60',
                    )}
                >
                    {q.solved_answer_id ? (
                        <Check className="size-4" />
                    ) : (
                        q.answers.length
                    )}
                </span>
                <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-white">
                        {q.title}
                    </span>
                    <span className="text-xs text-white/40">
                        {q.author?.name} · {timeAgo(q.created_at)}
                    </span>
                </span>
            </button>
            {open && (
                <div className="mt-3 space-y-2 pl-10">
                    {q.body && (
                        <p className="text-sm whitespace-pre-line text-white/70">
                            {q.body}
                        </p>
                    )}
                    {q.answers.map((a) => (
                        <div
                            key={a.id}
                            className={cn(
                                'flex gap-2.5 rounded-xl p-2.5',
                                q.solved_answer_id === a.id
                                    ? 'bg-emerald-500/10'
                                    : 'bg-white/[0.03]',
                            )}
                        >
                            <button
                                type="button"
                                disabled={!signedIn || a.own || busy}
                                onClick={() =>
                                    run('POST', `${base}/answers/${a.id}/vote`)
                                }
                                aria-pressed={a.voted}
                                aria-label={tr('Корисна відповідь')}
                                className={cn(
                                    'flex h-12 w-9 shrink-0 flex-col items-center justify-center rounded-lg text-xs font-semibold tabular-nums transition disabled:cursor-default',
                                    a.voted
                                        ? 'bg-gc-indigo text-white'
                                        : 'bg-white/[0.06] text-white/65 enabled:hover:bg-white/[0.1]',
                                )}
                            >
                                <ChevronUp className="size-3.5" />
                                {a.votes}
                            </button>
                            <div className="min-w-0 flex-1">
                                <p className="text-sm whitespace-pre-line text-white/85">
                                    {a.body}
                                </p>
                                <p className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-white/40">
                                    {a.author && (
                                        <Link
                                            href={`/${a.author.username}`}
                                            className="inline-flex items-center gap-1.5 hover:text-white"
                                        >
                                            <UserAvatar
                                                user={a.author}
                                                size="xs"
                                            />
                                            {a.author.name}
                                        </Link>
                                    )}
                                    · {timeAgo(a.created_at)}
                                    {q.solved_answer_id === a.id && (
                                        <span className="text-emerald-300">
                                            · {tr('Допомогло автору')}
                                        </span>
                                    )}
                                    {q.own && (
                                        <button
                                            type="button"
                                            disabled={busy}
                                            onClick={() =>
                                                run(
                                                    'POST',
                                                    `${base}/questions/${q.id}/solve`,
                                                    {
                                                        answer_id:
                                                            q.solved_answer_id ===
                                                            a.id
                                                                ? null
                                                                : a.id,
                                                    },
                                                )
                                            }
                                            className="text-gc-lilac-300 hover:text-white"
                                        >
                                            {q.solved_answer_id === a.id
                                                ? tr('Зняти позначку')
                                                : tr('Це допомогло')}
                                        </button>
                                    )}
                                </p>
                            </div>
                        </div>
                    ))}
                    {signedIn && (
                        <div className="flex gap-2">
                            <input
                                value={reply}
                                onChange={(e) => setReply(e.target.value)}
                                placeholder={tr('Ваша відповідь…')}
                                maxLength={3000}
                                className={cn(field, 'h-10')}
                            />
                            <button
                                type="button"
                                disabled={busy || reply.trim().length < 2}
                                onClick={() =>
                                    run(
                                        'POST',
                                        `${base}/questions/${q.id}/answers`,
                                        { body: reply },
                                        () => setReply(''),
                                    )
                                }
                                className="btn-glow h-10 shrink-0 rounded-xl px-4 text-sm font-semibold disabled:opacity-50"
                            >
                                {tr('Відповісти')}
                            </button>
                        </div>
                    )}
                    {q.own && (
                        <button
                            type="button"
                            disabled={busy}
                            onClick={() =>
                                window.confirm(
                                    tr(
                                        'Видалити питання разом із відповідями?',
                                    ),
                                ) && run('DELETE', `${base}/questions/${q.id}`)
                            }
                            className="inline-flex items-center gap-1.5 text-xs text-white/40 hover:text-rose-300"
                        >
                            <Trash2 className="size-3.5" />
                            {tr('Видалити питання')}
                        </button>
                    )}
                </div>
            )}
        </li>
    );
}
