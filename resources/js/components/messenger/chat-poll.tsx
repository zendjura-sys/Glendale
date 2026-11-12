import { BarChart3, Check, Lock, Plus, X } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { toast } from 'sonner';
import { UserAvatar } from '@/components/gc/user-avatar';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogTitle,
} from '@/components/ui/dialog';
import { api } from '@/lib/api';
import { plural } from '@/lib/format';
import { tr } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import type { ChatMessage, ChatPoll } from '@/types/messenger';

/** Створення опитування в груповому чаті: питання, 2–10 варіантів, кілька відповідей, анонімно. */
export function CreatePollDialog({
    open,
    onOpenChange,
    conversationId,
    onCreated,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    conversationId: number;
    onCreated: (message: ChatMessage) => void;
}) {
    const [question, setQuestion] = useState('');
    const [options, setOptions] = useState(['', '']);
    const [multiple, setMultiple] = useState(false);
    const [anonymous, setAnonymous] = useState(false);
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        if (!open) return;
        setQuestion('');
        setOptions(['', '']);
        setMultiple(false);
        setAnonymous(false);
    }, [open]);

    const filled = options.map((o) => o.trim()).filter(Boolean);
    const submit = (e: FormEvent) => {
        e.preventDefault();
        if (!question.trim() || filled.length < 2 || busy) return;
        setBusy(true);
        api<{ message: ChatMessage }>(
            'POST',
            `/messages/${conversationId}/polls`,
            { question, options: filled, multiple, anonymous },
        )
            .then((d) => {
                onCreated(d.message);
                onOpenChange(false);
            })
            .catch((err: Error) => toast.error(err.message))
            .finally(() => setBusy(false));
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="gap-3 sm:max-w-md">
                <DialogTitle className="font-display text-lg font-semibold text-white">
                    {tr('Опитування')}
                </DialogTitle>
                <DialogDescription className="sr-only">
                    {tr('Питання й варіанти відповіді')}
                </DialogDescription>
                <form onSubmit={submit} className="space-y-3">
                    <input
                        value={question}
                        onChange={(e) => setQuestion(e.target.value)}
                        maxLength={200}
                        placeholder={tr('Питання')}
                        autoFocus
                        className="input-glass h-11 w-full rounded-xl px-3 text-sm text-white placeholder:text-white/35"
                    />
                    <div className="space-y-2">
                        {options.map((o, i) => (
                            <div key={i} className="flex gap-2">
                                <input
                                    value={o}
                                    onChange={(e) =>
                                        setOptions(
                                            options.map((x, k) =>
                                                k === i ? e.target.value : x,
                                            ),
                                        )
                                    }
                                    maxLength={80}
                                    placeholder={tr('Варіант {n}', {
                                        n: i + 1,
                                    })}
                                    className="input-glass h-10 min-w-0 flex-1 rounded-xl px-3 text-sm text-white placeholder:text-white/35"
                                />
                                {options.length > 2 && (
                                    <button
                                        type="button"
                                        onClick={() =>
                                            setOptions(
                                                options.filter(
                                                    (_, k) => k !== i,
                                                ),
                                            )
                                        }
                                        aria-label={tr('Прибрати варіант')}
                                        className="grid size-10 place-items-center rounded-xl text-white/45 hover:bg-white/[0.06] hover:text-white"
                                    >
                                        <X className="size-4" />
                                    </button>
                                )}
                            </div>
                        ))}
                        {options.length < 10 && (
                            <button
                                type="button"
                                onClick={() => setOptions([...options, ''])}
                                className="inline-flex h-9 items-center gap-1.5 rounded-xl px-2 text-sm font-medium text-primary hover:bg-white/[0.04]"
                            >
                                <Plus className="size-4" />
                                {tr('Додати варіант')}
                            </button>
                        )}
                    </div>
                    <label className="flex items-center gap-2 text-sm text-white/75">
                        <input
                            type="checkbox"
                            checked={multiple}
                            onChange={(e) => setMultiple(e.target.checked)}
                        />
                        {tr('Можна обрати кілька')}
                    </label>
                    <label className="flex items-center gap-2 text-sm text-white/75">
                        <input
                            type="checkbox"
                            checked={anonymous}
                            onChange={(e) => setAnonymous(e.target.checked)}
                        />
                        {tr('Анонімне — не показувати, хто як голосував')}
                    </label>
                    <button
                        type="submit"
                        disabled={busy || !question.trim() || filled.length < 2}
                        className="btn-glow h-11 w-full rounded-xl text-sm font-semibold disabled:opacity-50"
                    >
                        {tr('Надіслати опитування')}
                    </button>
                </form>
            </DialogContent>
        </Dialog>
    );
}

/** Опитування в повідомленні: голос одним дотиком, смужки результатів, хто проголосував. */
export function PollCard({
    message,
    own,
    canClose,
    onChange,
}: {
    message: ChatMessage;
    own: boolean;
    canClose: boolean;
    onChange: (message: ChatMessage) => void;
}) {
    const reduce = useReducedMotion();
    const poll = message.poll as ChatPoll;
    const [mine, setMine] = useState<number[]>(poll.mine ?? []);
    useEffect(() => setMine(poll.mine ?? []), [poll.mine]);
    const voted = mine.length > 0;
    const showResults = voted || poll.closed;

    const send = (choices: number[]) => {
        setMine(choices);
        api<{ message: ChatMessage }>(
            'POST',
            `/messages/${message.conversation_id}/messages/${message.id}/vote`,
            { options: choices },
        )
            .then((d) => onChange(d.message))
            .catch((e: Error) => toast.error(e.message));
    };
    const pick = (i: number) => {
        if (poll.closed) return;
        if (poll.multiple)
            send(mine.includes(i) ? mine.filter((x) => x !== i) : [...mine, i]);
        else send(mine[0] === i ? [] : [i]);
    };
    const close = () =>
        api<{ message: ChatMessage }>(
            'POST',
            `/messages/${message.conversation_id}/messages/${message.id}/close-poll`,
        )
            .then((d) => onChange(d.message))
            .catch((e: Error) => toast.error(e.message));

    return (
        <div className="w-72 max-w-full">
            <p className="flex items-center gap-1.5 text-[11px] font-semibold text-white/55">
                <BarChart3 className="size-3.5" />
                {poll.closed
                    ? tr('Опитування закрито')
                    : poll.anonymous
                      ? tr('Анонімне опитування')
                      : tr('Опитування')}
                {poll.multiple && ` · ${tr('кілька відповідей')}`}
            </p>
            <p
                className={cn(
                    'mt-1 font-semibold break-words',
                    own ? 'text-white' : 'text-white',
                )}
            >
                {message.body}
            </p>
            <ul className="mt-2 space-y-1.5">
                {poll.options.map((o, i) => {
                    const share =
                        poll.total > 0
                            ? Math.round((o.count / poll.total) * 100)
                            : 0;
                    const chosen = mine.includes(i);

                    return (
                        <li key={i}>
                            <button
                                type="button"
                                onClick={() => pick(i)}
                                disabled={poll.closed}
                                className="relative flex w-full items-center gap-2 overflow-hidden rounded-xl bg-white/[0.06] px-3 py-2 text-left text-sm text-white transition hover:bg-white/[0.1] disabled:cursor-default"
                            >
                                {showResults && (
                                    <motion.span
                                        aria-hidden
                                        className={cn(
                                            'absolute inset-y-0 left-0',
                                            chosen
                                                ? 'bg-primary/40'
                                                : 'bg-white/[0.08]',
                                        )}
                                        initial={reduce ? false : { width: 0 }}
                                        animate={{ width: `${share}%` }}
                                        transition={{
                                            duration: 0.5,
                                            ease: 'easeOut',
                                        }}
                                    />
                                )}
                                <span
                                    className={cn(
                                        'relative grid size-4 shrink-0 place-items-center border',
                                        poll.multiple
                                            ? 'rounded'
                                            : 'rounded-full',
                                        chosen
                                            ? 'border-primary bg-primary'
                                            : 'border-white/40',
                                    )}
                                >
                                    {chosen && (
                                        <Check className="size-3 text-white" />
                                    )}
                                </span>
                                <span className="relative min-w-0 flex-1 break-words">
                                    {o.text}
                                </span>
                                {showResults && (
                                    <span className="relative shrink-0 text-xs font-semibold tabular-nums">
                                        {share}%
                                    </span>
                                )}
                            </button>
                            {showResults &&
                                !poll.anonymous &&
                                o.voters.length > 0 && (
                                    <span className="mt-1 flex gap-1 pl-1">
                                        {o.voters.map((u) => (
                                            <UserAvatar
                                                key={u.id}
                                                user={u}
                                                size="xs"
                                            />
                                        ))}
                                    </span>
                                )}
                        </li>
                    );
                })}
            </ul>
            <div className="mt-2 flex items-center justify-between text-xs text-white/50">
                <span>
                    {poll.total}{' '}
                    {plural(poll.total, [
                        tr('голос'),
                        tr('голоси'),
                        tr('голосів'),
                    ])}
                </span>
                {canClose && !poll.closed && (
                    <button
                        type="button"
                        onClick={close}
                        className="inline-flex items-center gap-1 font-medium text-white/70 hover:text-white"
                    >
                        <Lock className="size-3.5" />
                        {tr('Закрити')}
                    </button>
                )}
            </div>
        </div>
    );
}
