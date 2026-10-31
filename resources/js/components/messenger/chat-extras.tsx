import { MessagesSquare, Pin, StickyNote, X } from 'lucide-react';
import { AnimatePresence, m, useReducedMotion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { toast } from 'sonner';
import { UserAvatar } from '@/components/gc/user-avatar';
import { api } from '@/lib/api';
import { clockTime } from '@/lib/format';
import { tr } from '@/lib/i18n';
import type { ChatMessage, ChatPin } from '@/types';

/** Закріплені повідомлення: показує по одному, клік — перейти й показати наступне. */
export function PinnedBar({
    pins,
    onJump,
}: {
    pins: ChatPin[];
    onJump: (id: number) => void;
}) {
    const [index, setIndex] = useState(0);
    const reduce = useReducedMotion();

    if (pins.length === 0) return null;
    const pin = pins[Math.min(index, pins.length - 1)];

    return (
        <button
            type="button"
            onClick={() => {
                onJump(pin.id);
                setIndex((i) => (i + 1) % pins.length);
            }}
            className="flex w-full items-center gap-3 border-b border-white/[0.06] bg-white/[0.03] px-3 py-2 text-left sm:px-4"
        >
            <Pin className="size-4 shrink-0 text-sky-300" />
            <span className="min-w-0 flex-1">
                <span className="block text-xs text-sky-300">
                    {pins.length > 1
                        ? tr('Закріплене {n} з {total}', {
                              n: (index % pins.length) + 1,
                              total: pins.length,
                          })
                        : tr('Закріплене')}
                </span>
                <AnimatePresence mode="wait" initial={false}>
                    <m.span
                        key={pin.id}
                        initial={reduce ? false : { opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={reduce ? undefined : { opacity: 0, y: -6 }}
                        transition={{ duration: 0.15 }}
                        className="block truncate text-sm text-white/80"
                    >
                        {pin.author ? `${pin.author}: ` : ''}
                        {pin.preview}
                    </m.span>
                </AnimatePresence>
            </span>
        </button>
    );
}

/** Гілка під повідомленням групи: корінь, відповіді й поле відповіді. Нові відповіді приходять подією gc:thread. */
export function ThreadPanel({
    conversationId,
    root,
    onClose,
}: {
    conversationId: number;
    root: ChatMessage;
    onClose: () => void;
}) {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [body, setBody] = useState('');
    const [busy, setBusy] = useState(false);
    const listRef = useRef<HTMLDivElement>(null);
    const reduce = useReducedMotion();

    useEffect(() => {
        void api<{ messages: ChatMessage[] }>(
            'GET',
            `/messages/${conversationId}/messages/${root.id}/thread`,
        )
            .then((data) => setMessages(data.messages))
            .catch((e) => toast.error((e as Error).message));
    }, [conversationId, root.id]);

    useEffect(() => {
        const onReply = (event: Event) => {
            const message = (event as CustomEvent<ChatMessage>).detail;
            if (message.thread_root_id !== root.id) return;
            setMessages((list) =>
                list.some((x) => x.id === message.id)
                    ? list
                    : [...list, message],
            );
        };
        window.addEventListener('gc:thread', onReply);

        return () => window.removeEventListener('gc:thread', onReply);
    }, [root.id]);

    useEffect(() => {
        listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
    }, [messages.length]);

    const send = (e: FormEvent) => {
        e.preventDefault();
        const text = body.trim();
        if (!text) return;
        setBusy(true);
        api<{ message: ChatMessage }>(
            'POST',
            `/messages/${conversationId}/messages/${root.id}/thread`,
            { body: text },
        )
            .then(({ message }) => {
                setBody('');
                setMessages((list) =>
                    list.some((x) => x.id === message.id)
                        ? list
                        : [...list, message],
                );
            })
            .catch((e) => toast.error((e as Error).message))
            .finally(() => setBusy(false));
    };

    return (
        <m.aside
            initial={reduce ? false : { opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            className="glass-strong absolute inset-y-0 right-0 z-30 flex w-full max-w-md flex-col"
            aria-label={tr('Гілка')}
        >
            <header className="flex items-center gap-2 border-b border-white/[0.06] px-4 py-3">
                <MessagesSquare className="size-4 text-sky-300" />
                <h2 className="flex-1 text-sm font-semibold text-white">
                    {tr('Гілка')}
                </h2>
                <button
                    type="button"
                    onClick={onClose}
                    aria-label={tr('Закрити')}
                    className="rounded-lg p-1.5 text-white/60 hover:bg-white/[0.07] hover:text-white"
                >
                    <X className="size-4" />
                </button>
            </header>
            <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto p-4">
                {[root, ...messages].map((message, i) => (
                    <div key={message.id} className="flex gap-2.5">
                        {message.user && (
                            <UserAvatar
                                user={message.user}
                                size="sm"
                                showOnline={false}
                            />
                        )}
                        <div className="min-w-0 flex-1">
                            <p className="text-xs text-white/50">
                                <span className="font-semibold text-white/80">
                                    {message.user?.name ?? message.guest?.name}
                                </span>{' '}
                                {clockTime(message.created_at)}
                            </p>
                            <p className="text-sm whitespace-pre-line text-white/85">
                                {message.body ?? message.preview}
                            </p>
                            {i === 0 && (
                                <p className="mt-2 border-b border-white/[0.06] pb-2 text-xs text-white/40">
                                    {tr('{count} відповідей', {
                                        count: messages.length,
                                    })}
                                </p>
                            )}
                        </div>
                    </div>
                ))}
            </div>
            <form
                onSubmit={send}
                className="flex gap-2 border-t border-white/[0.06] p-3"
            >
                <input
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    placeholder={tr('Відповісти в гілці')}
                    maxLength={4096}
                    className="input-glass h-10 min-w-0 flex-1 rounded-xl px-3 text-sm text-white"
                />
                <button
                    type="submit"
                    disabled={busy || !body.trim()}
                    className="h-10 rounded-xl bg-primary px-4 text-sm font-semibold text-white disabled:opacity-50"
                >
                    {tr('Надіслати')}
                </button>
            </form>
        </m.aside>
    );
}

/** Особиста нотатка до бесіди — бачить лише автор. */
export function NoteDialog({
    conversationId,
    note,
    onClose,
    onSaved,
}: {
    conversationId: number;
    note: string | null;
    onClose: () => void;
    onSaved: (note: string | null) => void;
}) {
    const [text, setText] = useState(note ?? '');
    const [busy, setBusy] = useState(false);

    const save = () => {
        setBusy(true);
        api<{ note: string | null }>(
            'PUT',
            `/messages/${conversationId}/note`,
            {
                note: text,
            },
        )
            .then((data) => {
                onSaved(data.note);
                toast.success(tr('Нотатку збережено.'));
                onClose();
            })
            .catch((e) => toast.error((e as Error).message))
            .finally(() => setBusy(false));
    };

    return (
        <div
            role="dialog"
            aria-modal="true"
            aria-label={tr('Нотатка до чату')}
            className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4"
            onClick={onClose}
        >
            <div
                className="glass-strong w-full max-w-md space-y-3 rounded-2xl p-5"
                onClick={(e) => e.stopPropagation()}
            >
                <h2 className="flex items-center gap-2 font-semibold text-white">
                    <StickyNote className="size-4 text-sky-300" />
                    {tr('Нотатка до чату')}
                </h2>
                <p className="text-xs text-white/50">
                    {tr(
                        'Бачите лише ви. Наприклад: «днюха 5 березня», «грає на сервері EU».',
                    )}
                </p>
                <textarea
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    maxLength={2000}
                    autoFocus
                    className="input-glass min-h-32 w-full rounded-xl px-3 py-2 text-sm text-white"
                />
                <div className="flex justify-end gap-2">
                    <button
                        type="button"
                        onClick={onClose}
                        className="h-10 rounded-xl px-4 text-sm text-white/70 hover:text-white"
                    >
                        {tr('Скасувати')}
                    </button>
                    <button
                        type="button"
                        onClick={save}
                        disabled={busy}
                        className="h-10 rounded-xl bg-primary px-4 text-sm font-semibold text-white disabled:opacity-50"
                    >
                        {tr('Зберегти')}
                    </button>
                </div>
            </div>
        </div>
    );
}
