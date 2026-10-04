import { Link, router, usePage } from '@inertiajs/react';
import {
    ArrowDown,
    Bell,
    BellOff,
    ChevronLeft,
    Headphones,
    Info,
    Loader2,
    Phone,
    PhoneOff,
    Sparkles,
} from 'lucide-react';
import {
    useCallback,
    useEffect,
    useEffectEvent,
    useLayoutEffect,
    useRef,
    useState,
} from 'react';
import { toast } from 'sonner';
import { Lightbox } from '@/components/gc/media-grid';
import { VerifiedBadge } from '@/components/gc/verified-badge';
import { useRealtime } from '@/hooks/use-realtime';
import { api, ApiError } from '@/lib/api';
import { dayLabel, lastSeen, plural } from '@/lib/format';
import { inbox } from '@/lib/inbox';
import { getPlayerState } from '@/lib/player';
import { cn } from '@/lib/utils';
import { leaveVoice, startCall, useVoice } from '@/lib/voice';
import type { CallState } from '@/lib/voice';
import type {
    Attachment,
    ChatAttachment,
    ChatHistory,
    ChatMessage,
    ConversationDetails,
    OutgoingMessage,
} from '@/types';
import { Composer } from './composer';
import { ConversationAvatar } from './conversation-avatar';
import { MessageBubble, SystemMessage } from './message-bubble';
import { ReportDialog } from './report-dialog';
import type { BubbleActions } from './message-bubble';

const EDIT_WINDOW_MS = 24 * 3600 * 1000;
const GROUP_GAP_MS = 5 * 60 * 1000;
const TYPING_TTL_MS = 4000;

type Props = {
    active: ConversationDetails;
    history: ChatHistory;
    onRead: (conversationId: number) => void;
    onOpenInfo: () => void;
    onTypingChange: (name: string | null) => void;
};

type Pending = { message: OutgoingMessage; replyTo: number | null };

function TypingDots() {
    return (
        <span className="inline-flex items-center gap-[3px] align-middle">
            {[0, 1, 2].map((i) => (
                <span
                    key={i}
                    className="size-1 animate-bounce rounded-full bg-[#8fd8ff]"
                    style={{ animationDelay: `${i * 0.15}s` }}
                />
            ))}
        </span>
    );
}

export function ChatView({
    active,
    history,
    onRead,
    onOpenInfo,
    onTypingChange,
}: Props) {
    const { auth, modules } = usePage().props;
    const me = auth.user;
    const isGroup = active.type === 'group';
    const canManage = active.my_role === 'owner' || active.my_role === 'admin';

    const voice = useVoice();
    const [call, setCall] = useState<CallState | null>(active.call ?? null);
    useEffect(() => setCall(active.call ?? null), [active.id, active.call]);
    const inThisCall =
        voice.kind === 'call' &&
        voice.conversationId === active.id &&
        voice.status !== 'idle';
    const canCall = Boolean(active.can_call && active.calls_enabled);

    const [messages, setMessages] = useState<ChatMessage[]>(history.messages);
    const [hasMore, setHasMore] = useState(history.has_more);
    const [loadingOlder, setLoadingOlder] = useState(false);
    const [readUpTo, setReadUpTo] = useState(active.read_up_to);
    const [typing, setTyping] = useState<Record<number, string>>({});
    const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
    const [editing, setEditing] = useState<ChatMessage | null>(null);
    const [lightbox, setLightbox] = useState<{
        items: Attachment[];
        index: number;
    } | null>(null);
    const [highlight, setHighlight] = useState<number | null>(null);
    const [newBelow, setNewBelow] = useState(0);

    const scrollRef = useRef<HTMLDivElement>(null);
    const stickRef = useRef(true);
    const anchorRef = useRef<number | null>(null);
    const lastMarkedRef = useRef(0);
    const pendingRef = useRef(new Map<string, Pending>());
    const typingTimers = useRef(new Map<number, number>());
    const lastWhisper = useRef(0);

    const scrollToBottom = useCallback((smooth = false) => {
        const el = scrollRef.current;
        if (!el) return;
        el.scrollTo({
            top: el.scrollHeight,
            behavior: smooth ? 'smooth' : 'auto',
        });
    }, []);

    useLayoutEffect(() => {
        const el = scrollRef.current;
        if (!el) return;

        if (anchorRef.current !== null) {
            el.scrollTop += el.scrollHeight - anchorRef.current;
            anchorRef.current = null;
        } else if (stickRef.current) {
            el.scrollTop = el.scrollHeight;
        }
    }, [messages]);

    useEffect(() => {
        inbox.setActive(active.id);

        return () => inbox.setActive(null);
    }, [active.id]);

    useEffect(() => {
        setReadUpTo((value) => Math.max(value, active.read_up_to));
    }, [active.read_up_to]);

    const markRead = useEffectEvent(() => {
        if (document.visibilityState !== 'visible' || !stickRef.current) {
            return;
        }

        const last = [...messages]
            .reverse()
            .find((m) => !m.pending && m.user?.id !== me.id);

        if (!last || last.id <= lastMarkedRef.current) return;
        lastMarkedRef.current = last.id;
        onRead(active.id);

        void api<{ unread_total: number }>(
            'POST',
            `/messages/${active.id}/read`,
            { message_id: last.id },
        )
            .then((response) => inbox.setUnread(response.unread_total))
            .catch(() => {
                lastMarkedRef.current = 0;
            });
    });

    useEffect(() => {
        markRead();
    }, [messages]);

    useEffect(() => {
        const onVisible = () => markRead();
        document.addEventListener('visibilitychange', onVisible);
        window.addEventListener('focus', onVisible);

        return () => {
            document.removeEventListener('visibilitychange', onVisible);
            window.removeEventListener('focus', onVisible);
        };
    }, []);

    const typingNames = Object.values(typing);
    const typingLabel = typingNames.length
        ? isGroup
            ? typingNames.length === 1
                ? typingNames[0]
                : `${typingNames.length} учасники`
            : (active.peer?.first_name ?? '')
        : null;

    useEffect(() => {
        onTypingChange(typingLabel);
    }, [typingLabel, onTypingChange]);

    useEffect(() => {
        const timers = typingTimers.current;

        return () => timers.forEach((timer) => window.clearTimeout(timer));
    }, []);

    const stopTyping = (userId: number) => {
        window.clearTimeout(typingTimers.current.get(userId));
        typingTimers.current.delete(userId);
        setTyping((current) => {
            if (!(userId in current)) return current;
            const next = { ...current };
            delete next[userId];

            return next;
        });
    };

    const appendIncoming = (message: ChatMessage) => {
        if (!stickRef.current && message.user?.id !== me.id) {
            setNewBelow((count) => count + 1);
        }

        setMessages((current) =>
            current.some((m) => m.id === message.id)
                ? current.map((m) => (m.id === message.id ? message : m))
                : [...current, message],
        );
    };

    const whisper = useRealtime(`conversation.${active.id}`, {
        'message.sent': ({ message }: { message: ChatMessage }) => {
            if (message.user) stopTyping(message.user.id);

            if (
                message.user?.id === me.id &&
                [...pendingRef.current.keys()].length > 0
            ) {
                return;
            }

            appendIncoming(message);
        },
        'message.updated': ({ message }: { message: ChatMessage }) => {
            setMessages((current) =>
                current.map((m) => (m.id === message.id ? message : m)),
            );
        },
        'message.deleted': ({ id }: { id: number }) => {
            setMessages((current) =>
                current
                    .filter((m) => m.id !== id)
                    .map((m) =>
                        m.reply_to?.id === id
                            ? {
                                  ...m,
                                  reply_to: {
                                      ...m.reply_to,
                                      body: null,
                                      deleted: true,
                                  },
                              }
                            : m,
                    ),
            );
        },
        'conversation.read': (event: {
            user_id: number;
            message_id: number;
        }) => {
            if (event.user_id !== me.id) {
                setReadUpTo((value) => Math.max(value, event.message_id));
            }
        },
        'conversation.updated': () => {
            router.reload({ only: ['active', 'conversations'] });
        },
        'call.updated': (event: {
            conversation_id: number;
            call: CallState | null;
        }) => {
            if (event.conversation_id === active.id) setCall(event.call);
        },
        'client-typing': (event: { user_id: number; name: string }) => {
            if (event.user_id === me.id) return;
            window.clearTimeout(typingTimers.current.get(event.user_id));
            setTyping((current) =>
                current[event.user_id] === event.name
                    ? current
                    : { ...current, [event.user_id]: event.name },
            );
            typingTimers.current.set(
                event.user_id,
                window.setTimeout(
                    () => stopTyping(event.user_id),
                    TYPING_TTL_MS,
                ),
            );
        },
    });

    const onScroll = () => {
        const el = scrollRef.current;
        if (!el) return;

        const fromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
        const wasStuck = stickRef.current;
        stickRef.current = fromBottom < 80;

        if (stickRef.current && !wasStuck) {
            setNewBelow(0);
            markRead();
        }

        if (el.scrollTop < 160 && hasMore && !loadingOlder) {
            const first = messages.find((m) => !m.pending);
            if (!first) return;
            setLoadingOlder(true);

            void api<ChatHistory>(
                'GET',
                `/messages/${active.id}/history?before=${first.id}`,
            )
                .then((older) => {
                    anchorRef.current = el.scrollHeight;
                    setMessages((current) => {
                        const known = new Set(current.map((m) => m.id));

                        return [
                            ...older.messages.filter((m) => !known.has(m.id)),
                            ...current,
                        ];
                    });
                    setHasMore(older.has_more);
                })
                .finally(() => setLoadingOlder(false));
        }
    };

    const deliver = (localId: string) => {
        const payload = pendingRef.current.get(localId);
        if (!payload) return;

        const form = new FormData();
        const outgoing = payload.message;
        if (payload.replyTo)
            form.append('reply_to_id', String(payload.replyTo));
        switch (outgoing.kind) {
            case 'text':
                if (outgoing.body) form.append('body', outgoing.body);
                outgoing.images.forEach((file) =>
                    form.append('images[]', file),
                );
                outgoing.files.forEach((file) => form.append('files[]', file));
                break;
            case 'sticker':
                form.append('sticker_id', String(outgoing.sticker.id));
                break;
            case 'voice': {
                const ext = outgoing.blob.type.includes('mp4')
                    ? 'm4a'
                    : outgoing.blob.type.includes('ogg')
                      ? 'ogg'
                      : 'webm';
                form.append('voice', outgoing.blob, `voice.${ext}`);
                form.append('voice_duration', String(outgoing.duration));
                form.append(
                    'voice_waveform',
                    JSON.stringify(outgoing.waveform),
                );
                break;
            }
            case 'contact':
                form.append('contact_id', String(outgoing.contact.id));
                break;
        }

        setMessages((current) =>
            current.map((m) =>
                m.local_id === localId ? { ...m, pending: 'sending' } : m,
            ),
        );

        void api<{ message: ChatMessage }>(
            'POST',
            `/messages/${active.id}`,
            form,
        )
            .then(({ message }) => {
                pendingRef.current.delete(localId);
                setMessages((current) => {
                    const withoutLocal = current.filter(
                        (m) => m.local_id !== localId,
                    );

                    return withoutLocal.some((m) => m.id === message.id)
                        ? withoutLocal
                        : [...withoutLocal, message];
                });
            })
            .catch((error: unknown) => {
                setMessages((current) =>
                    current.map((m) =>
                        m.local_id === localId
                            ? { ...m, pending: 'failed' }
                            : m,
                    ),
                );
                toast.error(
                    error instanceof ApiError
                        ? (Object.values(error.errors)[0]?.[0] ?? error.message)
                        : 'Не вдалося надіслати повідомлення.',
                );
            });
    };

    const send = (outgoing: OutgoingMessage) => {
        const localId = `local-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        const reply = replyTo;
        pendingRef.current.set(localId, {
            message: outgoing,
            replyTo: reply?.id ?? null,
        });

        let attachmentIndex = 0;
        const localAttachment = (
            file: File | Blob,
            type: ChatAttachment['type'],
            extra: Partial<ChatAttachment> = {},
        ): ChatAttachment => ({
            id: -++attachmentIndex,
            type,
            url: URL.createObjectURL(file),
            width: null,
            height: null,
            name: file instanceof File ? file.name : null,
            mime: file.type,
            size: file.size,
            ...extra,
        });

        const optimistic: ChatMessage = {
            id: Number.MAX_SAFE_INTEGER - pendingRef.current.size,
            local_id: localId,
            pending: 'sending',
            conversation_id: active.id,
            type: outgoing.kind,
            body: outgoing.kind === 'text' ? outgoing.body || null : null,
            user: me,
            sticker: outgoing.kind === 'sticker' ? outgoing.sticker : null,
            contact: outgoing.kind === 'contact' ? outgoing.contact : null,
            reply_to: reply
                ? {
                      id: reply.id,
                      body: reply.body,
                      preview: reply.preview ?? null,
                      author: reply.user?.first_name ?? null,
                      has_attachments: reply.attachments.length > 0,
                      deleted: false,
                  }
                : null,
            attachments:
                outgoing.kind === 'text'
                    ? [
                          ...outgoing.images.map((file) =>
                              localAttachment(file, 'image'),
                          ),
                          ...outgoing.files.map((file) =>
                              localAttachment(file, 'file'),
                          ),
                      ]
                    : outgoing.kind === 'voice'
                      ? [
                            localAttachment(outgoing.blob, 'voice', {
                                duration: outgoing.duration,
                                waveform: outgoing.waveform,
                            }),
                        ]
                      : [],
            edited_at: null,
            created_at: new Date().toISOString(),
        };

        stickRef.current = true;
        setNewBelow(0);
        setReplyTo(null);
        setMessages((current) => [...current, optimistic]);
        deliver(localId);
    };

    const saveEdit = (message: ChatMessage, body: string) => {
        setEditing(null);
        setMessages((current) =>
            current.map((m) =>
                m.id === message.id
                    ? { ...m, body, edited_at: new Date().toISOString() }
                    : m,
            ),
        );

        void api<{ message: ChatMessage }>(
            'PATCH',
            `/messages/${active.id}/messages/${message.id}`,
            { body },
        )
            .then(({ message: saved }) =>
                setMessages((current) =>
                    current.map((m) => (m.id === saved.id ? saved : m)),
                ),
            )
            .catch((error: unknown) => {
                setMessages((current) =>
                    current.map((m) => (m.id === message.id ? message : m)),
                );
                toast.error(
                    error instanceof ApiError
                        ? error.message
                        : 'Не вдалося зберегти зміни.',
                );
            });
    };

    const isEditable = (message: ChatMessage) =>
        message.type === 'text' &&
        message.user?.id === me.id &&
        !message.pending &&
        !!message.body &&
        Date.now() - new Date(message.created_at).getTime() < EDIT_WINDOW_MS;

    const [reportUrl, setReportUrl] = useState<string | null>(null);
    const actions: BubbleActions = {
        onReply: (message) => {
            setEditing(null);
            setReplyTo(message);
        },
        onEdit: (message) => {
            setReplyTo(null);
            setEditing(message);
        },
        onDelete: (message) => {
            const snapshot = messages;
            setMessages((current) =>
                current.filter((m) => m.id !== message.id),
            );

            void api('DELETE', `/messages/${active.id}/messages/${message.id}`)
                .then(() => toast.success('Повідомлення видалено.'))
                .catch(() => {
                    setMessages(snapshot);
                    toast.error('Не вдалося видалити повідомлення.');
                });
        },
        onReport: (message) =>
            setReportUrl(
                `/messages/${active.id}/messages/${message.id}/report`,
            ),
        onRetry: (message) => message.local_id && deliver(message.local_id),
        onCopy: (message) => {
            void navigator.clipboard
                ?.writeText(message.body ?? '')
                .then(() => toast.success('Скопійовано.'));
        },
        onJump: (id) => {
            const node = document.getElementById(`message-${id}`);
            if (!node) {
                toast('Повідомлення далеко в історії.');

                return;
            }
            node.scrollIntoView({ behavior: 'smooth', block: 'center' });
            setHighlight(id);
            window.setTimeout(() => setHighlight(null), 1600);
        },
        onOpenImage: (items: ChatAttachment[], index) =>
            setLightbox({
                items: items.map((item) => ({ ...item, type: 'image' })),
                index,
            }),
        onMediaLoad: () => {
            if (stickRef.current) scrollToBottom();
        },
    };

    const onTyping = () => {
        const now = Date.now();
        if (now - lastWhisper.current < 2500) return;
        lastWhisper.current = now;
        whisper('typing', { user_id: me.id, name: me.first_name });
    };

    const onEditLast = () => {
        const last = [...messages].reverse().find(isEditable);
        if (last) actions.onEdit(last);
    };

    const subtitle = typingLabel ? (
        <span className="flex items-center gap-1.5 text-[#8fd8ff]">
            {isGroup ? `${typingLabel} друкує` : 'друкує'} <TypingDots />
        </span>
    ) : isGroup ? (
        `${active.members_count} ${plural(active.members_count, ['учасник', 'учасники', 'учасників'])}`
    ) : active.peer?.is_online ? (
        <span className="text-emerald-300">в мережі</span>
    ) : (
        lastSeen(active.peer?.last_seen_at ?? null, active.peer?.gender)
    );

    return (
        <section className="flex min-h-0 min-w-0 flex-1 flex-col">
            <header className="flex items-center gap-3 border-b border-white/[0.06] px-3 py-2.5 sm:px-4">
                <Link
                    href="/messages"
                    className="flex size-9 items-center justify-center rounded-xl text-white/70 hover:bg-white/[0.07] md:hidden"
                    aria-label="Назад"
                >
                    <ChevronLeft className="size-5" />
                </Link>
                <button
                    type="button"
                    onClick={() =>
                        isGroup
                            ? onOpenInfo()
                            : active.peer &&
                              router.visit(`/${active.peer.username}`)
                    }
                    className="flex min-w-0 flex-1 items-center gap-3 text-left"
                >
                    <ConversationAvatar conversation={active} size="sm" />
                    <span className="min-w-0">
                        <span className="flex items-center gap-1.5 truncate text-[15px] font-semibold text-white">
                            <span className="truncate">{active.title}</span>
                            {active.peer?.is_verified && (
                                <VerifiedBadge className="size-3.5 shrink-0" />
                            )}
                        </span>
                        <span className="block truncate text-xs text-white/45">
                            {subtitle}
                        </span>
                    </span>
                </button>
                <button
                    type="button"
                    onClick={() =>
                        router.post(
                            `/messages/${active.id}/mute`,
                            {},
                            {
                                preserveScroll: true,
                                preserveState: true,
                                only: ['active', 'conversations', 'counters'],
                                onSuccess: () =>
                                    toast.success(
                                        active.is_muted
                                            ? 'Сповіщення увімкнено.'
                                            : 'Сповіщення вимкнено.',
                                    ),
                            },
                        )
                    }
                    className="flex size-9 items-center justify-center rounded-xl text-white/60 transition hover:bg-white/[0.07] hover:text-white"
                    aria-label={
                        active.is_muted
                            ? 'Увімкнути сповіщення'
                            : 'Вимкнути сповіщення'
                    }
                    title={
                        active.is_muted
                            ? 'Увімкнути сповіщення'
                            : 'Вимкнути сповіщення'
                    }
                >
                    {active.is_muted ? (
                        <BellOff className="size-[18px]" />
                    ) : (
                        <Bell className="size-[18px]" />
                    )}
                </button>
                {(canCall || inThisCall) && (
                    <button
                        type="button"
                        onClick={() =>
                            inThisCall
                                ? void leaveVoice()
                                : void startCall({
                                      id: active.id,
                                      title: active.title,
                                  })
                        }
                        className={cn(
                            'flex size-9 items-center justify-center rounded-xl transition',
                            inThisCall
                                ? 'bg-rose-500 text-white hover:bg-rose-500/85'
                                : 'text-white/60 hover:bg-white/[0.07] hover:text-white',
                        )}
                        aria-label={
                            inThisCall
                                ? 'Покласти слухавку'
                                : call
                                  ? 'Приєднатися до дзвінка'
                                  : 'Зателефонувати'
                        }
                        title={
                            inThisCall
                                ? 'Покласти слухавку'
                                : call
                                  ? 'Приєднатися до дзвінка'
                                  : 'Зателефонувати'
                        }
                    >
                        {inThisCall ? (
                            <PhoneOff className="size-[18px]" />
                        ) : (
                            <Phone className="size-[18px]" />
                        )}
                    </button>
                )}
                {modules.includes('music') && (
                    <button
                        type="button"
                        onClick={() =>
                            router.post('/music/together', {
                                conversation_id: active.id,
                                track_id:
                                    getPlayerState().current?.source === 'local'
                                        ? getPlayerState().current?.id
                                        : null,
                            })
                        }
                        className="flex size-9 items-center justify-center rounded-xl text-white/60 transition hover:bg-white/[0.07] hover:text-white"
                        aria-label="Слухати музику разом"
                        title="Слухати музику разом"
                    >
                        <Headphones className="size-[18px]" />
                    </button>
                )}
                {isGroup && (
                    <button
                        type="button"
                        onClick={onOpenInfo}
                        className="flex size-9 items-center justify-center rounded-xl text-white/60 transition hover:bg-white/[0.07] hover:text-white"
                        aria-label="Інформація про бесіду"
                        title="Інформація про бесіду"
                    >
                        <Info className="size-[18px]" />
                    </button>
                )}
            </header>

            {call && !inThisCall && call.joined.length > 0 && (
                <div className="flex items-center gap-3 border-b border-white/[0.06] bg-emerald-400/[0.07] px-3 py-2 sm:px-4">
                    <Phone className="size-4 shrink-0 text-emerald-300" />
                    <span className="min-w-0 flex-1 truncate text-sm text-white/80">
                        {isGroup ? 'Іде груповий дзвінок' : 'Іде дзвінок'} ·{' '}
                        {call.joined.map((p) => p.name).join(', ')}
                    </span>
                    {canCall && (
                        <button
                            type="button"
                            onClick={() =>
                                void startCall({
                                    id: active.id,
                                    title: active.title,
                                })
                            }
                            className="inline-flex h-8 shrink-0 items-center rounded-lg bg-emerald-500 px-3 text-xs font-semibold text-white transition hover:bg-emerald-500/85"
                        >
                            Приєднатися
                        </button>
                    )}
                </div>
            )}

            <div className="relative min-h-0 flex-1">
                <div
                    ref={scrollRef}
                    onScroll={onScroll}
                    className="absolute inset-0 overflow-x-hidden overflow-y-auto overscroll-contain py-3"
                >
                    {loadingOlder && (
                        <div className="flex justify-center py-2">
                            <Loader2 className="size-5 animate-spin text-white/40" />
                        </div>
                    )}

                    {!hasMore && messages.length > 0 && (
                        <div className="flex flex-col items-center px-6 pt-6 pb-4 text-center">
                            <ConversationAvatar
                                conversation={active}
                                size="lg"
                                className="mb-3 shadow-[0_0_50px_-10px_rgb(124_92_255/0.9)]"
                            />
                            <p className="font-display text-base font-semibold text-white">
                                {active.title}
                            </p>
                            <p className="text-xs text-white/40">
                                Початок історії повідомлень
                            </p>
                        </div>
                    )}

                    {messages.length === 0 && (
                        <div className="flex h-full flex-col items-center justify-center px-6 text-center">
                            <div className="relative mb-5">
                                <div className="absolute inset-0 rounded-full bg-[#6d5dfc]/40 blur-2xl" />
                                <ConversationAvatar
                                    conversation={active}
                                    size="lg"
                                    className="relative"
                                />
                            </div>
                            <p className="font-display text-lg font-semibold text-white">
                                {active.title}
                            </p>
                            <p className="mt-1 max-w-xs text-sm text-white/45">
                                Тут ще порожньо. Надішліть перше повідомлення —
                                привітайтесь!
                            </p>
                            {active.can_write && (
                                <button
                                    type="button"
                                    onClick={() =>
                                        send({
                                            kind: 'text',
                                            body: '👋',
                                            images: [],
                                            files: [],
                                        })
                                    }
                                    className="glass mt-5 inline-flex items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-medium text-white transition hover:border-white/20"
                                >
                                    <Sparkles className="size-4 text-[#ffd36b]" />
                                    Надіслати 👋
                                </button>
                            )}
                        </div>
                    )}

                    {messages.map((message, index) => {
                        const prev = messages[index - 1];
                        const next = messages[index + 1];
                        const newDay =
                            !prev ||
                            new Date(prev.created_at).toDateString() !==
                                new Date(message.created_at).toDateString();

                        if (message.type === 'system') {
                            return (
                                <div key={message.local_id ?? message.id}>
                                    {newDay && (
                                        <DaySeparator
                                            iso={message.created_at}
                                        />
                                    )}
                                    <SystemMessage message={message} />
                                </div>
                            );
                        }

                        const sameAsPrev =
                            !newDay &&
                            prev?.type !== 'system' &&
                            prev?.user?.id === message.user?.id &&
                            new Date(message.created_at).getTime() -
                                new Date(prev.created_at).getTime() <
                                GROUP_GAP_MS;
                        const nextNewDay =
                            !next ||
                            new Date(next.created_at).toDateString() !==
                                new Date(message.created_at).toDateString();
                        const sameAsNext =
                            !nextNewDay &&
                            next?.type !== 'system' &&
                            next?.user?.id === message.user?.id &&
                            new Date(next.created_at).getTime() -
                                new Date(message.created_at).getTime() <
                                GROUP_GAP_MS;
                        const own = message.user?.id === me.id;

                        return (
                            <div key={message.local_id ?? message.id}>
                                {newDay && (
                                    <DaySeparator iso={message.created_at} />
                                )}
                                <MessageBubble
                                    message={message}
                                    own={own}
                                    read={
                                        !message.pending &&
                                        message.id <= readUpTo
                                    }
                                    showAuthor={isGroup && !own && !sameAsPrev}
                                    showAvatar={isGroup && !sameAsNext}
                                    groupStart={!sameAsPrev}
                                    groupEnd={!sameAsNext}
                                    canEdit={isEditable(message)}
                                    canDelete={
                                        !message.pending &&
                                        (own || (isGroup && canManage))
                                    }
                                    highlighted={highlight === message.id}
                                    actions={actions}
                                />
                            </div>
                        );
                    })}
                </div>

                {newBelow > 0 && (
                    <button
                        type="button"
                        onClick={() => {
                            stickRef.current = true;
                            setNewBelow(0);
                            scrollToBottom(true);
                        }}
                        className="absolute bottom-4 left-1/2 flex -translate-x-1/2 animate-rise items-center gap-1.5 rounded-full bg-gradient-brand px-4 py-2 text-xs font-semibold text-white shadow-[0_10px_30px_-8px_rgb(109_93_252/0.9)]"
                    >
                        <ArrowDown className="size-3.5" />
                        {newBelow}{' '}
                        {plural(newBelow, [
                            'нове повідомлення',
                            'нові повідомлення',
                            'нових повідомлень',
                        ])}
                    </button>
                )}
            </div>

            <Composer
                canWrite={active.can_write}
                replyTo={replyTo}
                editing={editing}
                onCancel={() => {
                    setReplyTo(null);
                    setEditing(null);
                }}
                onSend={send}
                onEdit={saveEdit}
                onTyping={onTyping}
                onEditLast={onEditLast}
            />

            {lightbox && (
                <Lightbox
                    items={lightbox.items}
                    index={lightbox.index}
                    onClose={() => setLightbox(null)}
                />
            )}
            <ReportDialog url={reportUrl} onClose={() => setReportUrl(null)} />
        </section>
    );
}

function DaySeparator({ iso }: { iso: string }) {
    return (
        <div className="sticky top-1 z-10 flex justify-center py-2">
            <span className="rounded-full border border-white/[0.06] bg-[#0b1020]/80 px-3 py-1 text-[11px] font-medium text-white/60 backdrop-blur-xl">
                {dayLabel(iso)}
            </span>
        </div>
    );
}
