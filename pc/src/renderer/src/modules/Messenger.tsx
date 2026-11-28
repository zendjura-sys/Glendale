import { ArrowLeft, Send } from 'lucide-react';
import { Maximize } from 'lucide-react';
import { type FormEvent, type ReactNode, useEffect, useRef, useState } from 'react';
import { NotchBadge, NotchedCard } from '@/components/NotchedCard';
import { Avatar, Empty, IconButton } from '@/components/ui';
import { useNav } from '@/lib/nav';
import { api, type User, useLive } from '@/lib/api';

type Conversation = { id: number; title: string; avatar_url: string | null; unread: number; type: string; peer?: User | null; last_message?: { body?: string | null; preview?: string | null } | null };
type Message = { id: number; body: string | null; preview?: string | null; user: User | null; created_at: string };

/**
 * Messenger: список діалогів і активний чат. Надіслане повідомлення одразу з’являється в усіх
 * вікнах (єдине вікно ↔ віджет) через подію синхронізації; нові — опитуванням кожні 5 с.
 */
export function MessengerModule({ header }: { header?: ReactNode }) {
    const list = useLive<{ conversations: Conversation[]; unread: number }>('/api/v1/messages', 15_000, ['messages']);
    const [open, setOpen] = useState<number | null>(null);
    const conversations = list.data?.conversations ?? [];
    const unread = list.data?.unread ?? 0;
    const current = conversations.find((c) => c.id === open) ?? null;
    const nav = useNav();
    return (
        <NotchedCard
            title="Повідомлення"
            subtitle={current ? current.title : 'Особисті й групові чати'}
            glow="violet"
            header={
                <>
                    <IconButton label="Відкрити повністю" onClick={() => nav.go(current ? `/messages/${current.id}` : '/messages')}>
                        <Maximize size={15} strokeWidth={1.6} />
                    </IconButton>
                    {header}
                </>
            }
            badge={<NotchBadge tone={unread ? 'violet' : 'muted'}>{unread}</NotchBadge>}
            badgeWidth={44}
        >
            {current ? (
                <Chat conversation={current} onBack={() => setOpen(null)} onRead={() => void list.reload()} />
            ) : conversations.length === 0 ? (
                <Empty>{list.error ?? (list.data ? 'Ще немає бесід.' : 'Завантажуємо…')}</Empty>
            ) : (
                <ul className="space-y-1">
                    {conversations.map((c) => (
                        <li key={c.id}>
                            <button type="button" onClick={() => setOpen(c.id)} className="no-drag flex w-full items-center gap-2.5 rounded-xl px-2 py-2 text-left hover:bg-white/5">
                                <Avatar user={{ name: c.title, avatar_url: c.avatar_url ?? c.peer?.avatar_url }} size={34} dot={c.peer ? (c.peer.is_online ? 'online' : null) : null} />
                                <span className="min-w-0 flex-1">
                                    <span className="block truncate text-sm font-semibold">{c.title}</span>
                                    <span className="block truncate text-xs text-white/45">{c.last_message?.body ?? c.last_message?.preview ?? ''}</span>
                                </span>
                                {c.unread > 0 && <span className="rounded-full bg-neon-violet px-1.5 text-[11px] font-bold">{c.unread}</span>}
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </NotchedCard>
    );
}

function Chat({ conversation, onBack, onRead }: { conversation: Conversation; onBack: () => void; onRead: () => void }) {
    const { data, reload } = useLive<{ history: { messages: Message[] } }>(`/api/v1/messages/${conversation.id}`, 5_000, [`chat:${conversation.id}`]);
    const [text, setText] = useState('');
    const [sending, setSending] = useState(false);
    const bottom = useRef<HTMLDivElement>(null);
    const messages = data?.history?.messages ?? [];
    const last = messages[messages.length - 1]?.id;
    useEffect(() => {
        bottom.current?.scrollIntoView({ block: 'end' });
        if (last) {
            void api('POST', `/api/v1/messages/${conversation.id}/read`, { message_id: last }).then(onRead, () => undefined);
        }
    }, [last, conversation.id]); // eslint-disable-line react-hooks/exhaustive-deps

    const send = async (e: FormEvent): Promise<void> => {
        e.preventDefault();
        const body = text.trim();
        if (!body || sending) return;
        setSending(true);
        try {
            await api('POST', `/api/v1/messages/${conversation.id}`, { body });
            setText('');
            await reload();
            window.gamecon.sync.emit(`chat:${conversation.id}`);
            window.gamecon.sync.emit('messages');
        } finally {
            setSending(false);
        }
    };

    return (
        <div className="flex h-full min-h-60 flex-col">
            <div className="mb-2 flex items-center gap-2">
                <IconButton label="До бесід" onClick={onBack}>
                    <ArrowLeft size={16} strokeWidth={1.6} />
                </IconButton>
                <span className="truncate text-sm font-semibold">{conversation.title}</span>
            </div>
            <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto pr-1">
                {messages.map((m) => {
                    const mine = m.user?.id === undefined ? false : m.user?.id === (window as unknown as { gcMe?: number }).gcMe;
                    return (
                        <div key={m.id} className={`flex items-end gap-2 ${mine ? 'justify-end' : ''}`}>
                            {!mine && <Avatar user={m.user} size={24} />}
                            <div data-selectable className={`max-w-[78%] rounded-2xl px-3 py-1.5 text-[13px] leading-snug ${mine ? 'bg-neon-violet/80 text-white' : 'bg-white/[0.07] text-white/90'}`}>
                                {m.body ?? m.preview}
                            </div>
                        </div>
                    );
                })}
                {messages.length === 0 && <Empty>{data ? 'Напишіть перше повідомлення.' : 'Завантажуємо…'}</Empty>}
                <div ref={bottom} />
            </div>
            <form onSubmit={(e) => void send(e)} className="mt-2 flex items-center gap-2 rounded-full bg-white/[0.06] py-1 pr-1 pl-3 ring-1 ring-white/10 focus-within:ring-neon-violet/50">
                <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Повідомлення…" maxLength={4000} className="no-drag min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-white/35" />
                <button type="submit" disabled={sending || !text.trim()} aria-label="Надіслати" className="no-drag grid h-8 w-8 place-items-center rounded-full bg-neon-violet/80 disabled:opacity-40">
                    <Send size={14} strokeWidth={1.8} />
                </button>
            </form>
        </div>
    );
}
