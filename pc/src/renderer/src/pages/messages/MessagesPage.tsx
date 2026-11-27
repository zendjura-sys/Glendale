import { BellOff, Check, CornerUpLeft, Download, FileText, ImagePlus, MessageSquarePlus, Pencil, Pin, Search, SendHorizontal, Smile, Sticker, Trash2, X } from 'lucide-react';
import { type DragEvent, type KeyboardEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button, Input, Loading, Modal, PageHeader, SmartImage, downloadFile, useToast, when } from '@/components/kit';
import { Avatar } from '@/components/ui';
import { api, type User } from '@/lib/api';
import { useMe } from '@/lib/me';

type Conversation = { id: number; type: string; title: string; avatar_url: string | null; peer?: User | null; members_count?: number; unread: number; is_muted: boolean; pinned?: boolean; last_message?: { body?: string | null; preview?: string | null; is_own?: boolean; created_at?: string } | null };
type Attachment = { id: number; type: string; url: string | null; width: number | null; height: number | null; name: string | null; mime: string | null; size: number | null; duration: number | null };
type Message = {
    id: number;
    type: string;
    body: string | null;
    preview?: string | null;
    user: User | null;
    reply_to: { id: number; body: string | null; preview: string | null; author: string | null; deleted: boolean } | null;
    attachments: Attachment[];
    sticker: { id: number; url: string; emoji: string | null } | null;
    reactions: { emoji: string; count: number; user_ids: number[] }[];
    edited_at: string | null;
    created_at: string;
};
type Detail = { conversation: { id: number; type: string; title: string; avatar_url: string | null; peer?: User | null; can_write: boolean; is_muted: boolean; members_count: number; can_pin: boolean; pins: { id: number; body: string | null; preview?: string | null }[]; members: User[] }; history: { messages: Message[]; has_more: boolean } };
type Packs = { packs: { id: number; name: string; stickers: { id: number; url: string; emoji: string }[]; locked: boolean }[] };

const EMOJI = ['👍', '❤️', '🔥', '😂', '😮', '😢', '🎉', '👎'];
const size = (n: number | null): string => (!n ? '' : n > 1048576 ? `${(n / 1048576).toFixed(1)} МБ` : `${Math.ceil(n / 1024)} КБ`);

/** «Повідомлення» в програмі: бесіди з пошуком, чат з фото, файлами, стікерами, голосовими, відповідями, реакціями, правками й закріпленими. */
export function MessagesPage({ initial }: { initial?: number }) {
    const [list, setList] = useState<Conversation[] | null>(null);
    const [open, setOpen] = useState<number | null>(initial ?? null);
    const [q, setQ] = useState('');
    const [creating, setCreating] = useState(false);
    const load = useCallback(async () => {
        try {
            const r = await api<{ conversations: Conversation[] }>('GET', '/api/v1/messages');
            setList(r.conversations);
        } catch {
            // мережа — спробуємо за кілька секунд
        }
    }, []);
    useEffect(() => {
        void load();
        const t = window.setInterval(() => void load(), 8000);
        const off = window.gamecon.sync.on((e) => e.topic === 'messages' && void load());
        return () => {
            window.clearInterval(t);
            off();
        };
    }, [load]);
    const shown = (list ?? []).filter((c) => !q || c.title.toLowerCase().includes(q.toLowerCase()));
    return (
        <div className="flex h-full flex-col">
            <PageHeader title="Повідомлення" subtitle="Особисті й групові чати" />
            <div className="grid min-h-0 flex-1 grid-cols-[320px_1fr] gap-4 px-5 pb-5">
                <aside className="flex min-h-0 flex-col rounded-2xl bg-white/[0.03] ring-1 ring-white/[0.07]">
                    <div className="flex gap-2 p-3">
                        <div className="relative flex-1">
                            <Search size={15} className="absolute top-3 left-3 text-white/40" />
                            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Пошук бесід" className="pl-9" />
                        </div>
                        <button type="button" onClick={() => setCreating(true)} aria-label="Новий чат" title="Новий чат" className="grid h-10 w-10 shrink-0 place-items-center rounded-xl ring-1 ring-white/10 hover:bg-white/10">
                            <MessageSquarePlus size={18} />
                        </button>
                    </div>
                    <ul className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
                        {list === null && <Loading />}
                        {shown.map((c) => (
                            <li key={c.id}>
                                <button type="button" onClick={() => setOpen(c.id)} className={`flex w-full items-center gap-3 rounded-xl px-2.5 py-2.5 text-left transition ${open === c.id ? 'bg-white/10 ring-1 ring-neon-cyan/30' : 'hover:bg-white/[0.05]'}`}>
                                    <Avatar user={{ name: c.title, avatar_url: c.avatar_url ?? c.peer?.avatar_url }} size={42} dot={c.peer?.is_online ? 'online' : null} />
                                    <span className="min-w-0 flex-1">
                                        <span className="flex items-center gap-1.5">
                                            <span className="min-w-0 flex-1 truncate text-[14px] font-semibold">{c.title}</span>
                                            {c.is_muted && <BellOff size={12} className="text-white/35" />}
                                            <span className="text-[11px] text-white/35">{c.last_message?.created_at ? when(c.last_message.created_at) : ''}</span>
                                        </span>
                                        <span className="flex items-center gap-2">
                                            <span className="min-w-0 flex-1 truncate text-[13px] text-white/50">
                                                {c.last_message?.is_own ? 'Ви: ' : ''}
                                                {c.last_message?.preview ?? c.last_message?.body ?? ''}
                                            </span>
                                            {c.unread > 0 && <span className="rounded-full bg-neon-violet px-1.5 text-[11px] font-bold">{c.unread}</span>}
                                        </span>
                                    </span>
                                </button>
                            </li>
                        ))}
                    </ul>
                </aside>
                <section className="relative min-h-0 rounded-2xl bg-white/[0.03] ring-1 ring-white/[0.07]">
                    {open ? <Chat key={open} id={open} onChanged={load} /> : <div className="grid h-full place-items-center text-sm text-white/45">Оберіть бесіду ліворуч</div>}
                </section>
            </div>
            {creating && (
                <NewChat
                    onClose={() => setCreating(false)}
                    onOpen={async (id) => {
                        setCreating(false);
                        await load();
                        setOpen(id);
                    }}
                />
            )}
        </div>
    );
}

function Chat({ id, onChanged }: { id: number; onChanged: () => Promise<void> }) {
    const { me } = useMe();
    const toast = useToast();
    const [detail, setDetail] = useState<Detail | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [hasMore, setHasMore] = useState(false);
    const [text, setText] = useState('');
    const [files, setFiles] = useState<File[]>([]);
    const [reply, setReply] = useState<Message | null>(null);
    const [editing, setEditing] = useState<Message | null>(null);
    const [stickers, setStickers] = useState<Packs | null>(null);
    const [showStickers, setShowStickers] = useState(false);
    const [zoom, setZoom] = useState<string | null>(null);
    const [sending, setSending] = useState(false);
    const scroller = useRef<HTMLDivElement>(null);
    const stick = useRef(true);

    const load = useCallback(async () => {
        try {
            const d = await api<Detail>('GET', `/api/v1/messages/${id}`);
            setDetail(d);
            setMessages((prev) => {
                // Свіжі повідомлення поверх уже підвантажених старих.
                const fresh = d.history.messages;
                const older = prev.filter((m) => m.id < (fresh[0]?.id ?? 0));
                return [...older, ...fresh];
            });
            setHasMore((h) => h || d.history.has_more);
            const last = d.history.messages[d.history.messages.length - 1]?.id;
            if (last) void api('POST', `/api/v1/messages/${id}/read`, { message_id: last }).then(() => onChanged(), () => undefined);
        } catch (e) {
            toast((e as Error).message, 'error');
        }
    }, [id, onChanged, toast]);
    useEffect(() => {
        void load();
        const t = window.setInterval(() => void load(), 4000);
        return () => window.clearInterval(t);
    }, [load]);
    useEffect(() => {
        if (stick.current) scroller.current?.scrollTo({ top: scroller.current.scrollHeight });
    }, [messages.length]);

    const older = async (): Promise<void> => {
        const first = messages[0]?.id;
        if (!first) return;
        const h = await api<{ messages: Message[]; has_more: boolean }>('GET', `/api/v1/messages/${id}/history?before=${first}`);
        stick.current = false;
        setMessages((m) => [...h.messages, ...m]);
        setHasMore(h.has_more);
    };

    const send = async (extra: Record<string, unknown> = {}): Promise<void> => {
        if (sending) return;
        const body = text.trim();
        if (editing) {
            if (!body) return;
            setSending(true);
            try {
                await api('PATCH', `/api/v1/site/messages/${id}/messages/${editing.id}`, { body });
                setEditing(null);
                setText('');
                await load();
            } catch (e) {
                toast((e as Error).message, 'error');
            }
            setSending(false);
            return;
        }
        if (!body && files.length === 0 && !extra.sticker_id) return;
        setSending(true);
        try {
            const images = files.filter((f) => f.type.startsWith('image/'));
            const other = files.filter((f) => !f.type.startsWith('image/'));
            const upload = await Promise.all([...images.map((f) => ['images[]', f] as const), ...other.map((f) => ['files[]', f] as const)].map(async ([field, f]) => ({ field, name: f.name, type: f.type || 'application/octet-stream', data: await f.arrayBuffer() })));
            await api('POST', `/api/v1/messages/${id}`, { __form: true, fields: { body: body || null, reply_to_id: reply?.id ?? null, ...extra }, files: upload });
            setText('');
            setFiles([]);
            setReply(null);
            stick.current = true;
            window.gamecon.sync.emit('messages');
            await load();
        } catch (e) {
            toast((e as Error).message, 'error');
        }
        setSending(false);
    };

    const react = async (m: Message, emoji: string): Promise<void> => {
        const mine = m.reactions.find((r) => r.emoji === emoji)?.user_ids.includes(me?.id ?? -1);
        await api('POST', `/api/v1/site/messages/${id}/messages/${m.id}/react`, { emoji: mine ? null : emoji }).catch((e: Error) => toast(e.message, 'error'));
        await load();
    };
    const remove = async (m: Message): Promise<void> => {
        if (!window.confirm('Видалити повідомлення?')) return;
        await api('DELETE', `/api/v1/site/messages/${id}/messages/${m.id}`).catch((e: Error) => toast(e.message, 'error'));
        setMessages((x) => x.filter((y) => y.id !== m.id));
    };
    const pin = async (m: Message): Promise<void> => {
        await api('POST', `/api/v1/site/messages/${id}/messages/${m.id}/pin`).then(() => toast('Закріплено.'), (e: Error) => toast(e.message, 'error'));
        await load();
    };
    const mute = async (): Promise<void> => {
        await api('POST', `/api/v1/messages/${id}/mute`, { muted: !detail?.conversation.is_muted }).catch(() => undefined);
        await load();
        await onChanged();
    };

    const onKey = (e: KeyboardEvent<HTMLTextAreaElement>): void => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            void send();
        }
        if (e.key === 'Escape') {
            setReply(null);
            setEditing(null);
        }
        if (e.key === 'ArrowUp' && !text) {
            const mine = [...messages].reverse().find((m) => m.user?.id === me?.id && m.type === 'text');
            if (mine) {
                setEditing(mine);
                setText(mine.body ?? '');
            }
        }
    };
    const drop = (e: DragEvent): void => {
        e.preventDefault();
        setFiles((f) => [...f, ...Array.from(e.dataTransfer.files)].slice(0, 10));
    };
    const pick = (): void => {
        const input = document.createElement('input');
        input.type = 'file';
        input.multiple = true;
        input.onchange = () => setFiles((f) => [...f, ...Array.from(input.files ?? [])].slice(0, 10));
        input.click();
    };
    const openStickers = async (): Promise<void> => {
        setShowStickers((v) => !v);
        if (!stickers) setStickers(await api<Packs>('GET', '/api/v1/messages/stickers').catch(() => ({ packs: [] })));
    };

    const grouped = useMemo(() => messages, [messages]);
    if (!detail) return <Loading />;
    const c = detail.conversation;
    return (
        <div className="flex h-full flex-col" onDragOver={(e) => e.preventDefault()} onDrop={drop}>
            <header className="flex items-center gap-3 border-b border-white/5 px-4 py-3">
                <Avatar user={{ name: c.title, avatar_url: c.avatar_url ?? c.peer?.avatar_url }} size={40} dot={c.peer?.is_online ? 'online' : null} />
                <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold">{c.title}</div>
                    <div className="truncate text-xs text-white/45">{c.peer ? (c.peer.is_online ? 'у мережі' : 'не в мережі') : `${c.members_count} учасників`}</div>
                </div>
                <Button small onClick={() => void mute()}>
                    <BellOff size={14} /> {c.is_muted ? 'Увімкнути сповіщення' : 'Без звуку'}
                </Button>
            </header>
            {c.pins.length > 0 && (
                <div className="flex items-center gap-2 border-b border-white/5 bg-neon-violet/[0.06] px-4 py-2 text-sm">
                    <Pin size={14} className="text-neon-violet" />
                    <span className="truncate">{c.pins[c.pins.length - 1].body ?? c.pins[c.pins.length - 1].preview}</span>
                </div>
            )}
            <div
                ref={scroller}
                onScroll={(e) => {
                    const el = e.currentTarget;
                    stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
                }}
                className="min-h-0 flex-1 space-y-1 overflow-y-auto px-4 py-3"
            >
                {hasMore && (
                    <div className="pb-2 text-center">
                        <Button small onClick={() => void older()}>
                            Попередні повідомлення
                        </Button>
                    </div>
                )}
                {grouped.map((m, i) => {
                    if (m.type === 'system') return <p key={m.id} className="py-2 text-center text-xs text-white/40">{m.body ?? m.preview}</p>;
                    const mine = m.user?.id === me?.id;
                    const head = grouped[i - 1]?.user?.id !== m.user?.id;
                    return (
                        <div key={m.id} className={`group flex items-end gap-2 ${mine ? 'flex-row-reverse' : ''} ${head ? 'pt-2' : ''}`}>
                            <span className="w-8 shrink-0">{!mine && head && <Avatar user={m.user} size={32} />}</span>
                            <div className={`flex max-w-[68%] flex-col ${mine ? 'items-end' : 'items-start'}`}>
                                {!mine && head && c.type !== 'direct' && <span className="mb-0.5 px-1 text-xs text-neon-cyan">{m.user?.name}</span>}
                                <div className={`rounded-2xl px-3.5 py-2 text-[14px] leading-relaxed ${m.sticker ? 'bg-transparent p-0' : mine ? 'bg-gradient-to-br from-neon-blue/80 to-neon-violet/70' : 'bg-white/[0.08]'}`}>
                                    {m.reply_to && (
                                        <div className="mb-1.5 border-l-2 border-white/40 pl-2 text-xs text-white/70">
                                            <b>{m.reply_to.author}</b> {m.reply_to.deleted ? 'видалене повідомлення' : (m.reply_to.body ?? m.reply_to.preview)}
                                        </div>
                                    )}
                                    {m.sticker && <img src={m.sticker.url} alt={m.sticker.emoji ?? ''} className="h-32 w-32 object-contain" />}
                                    {m.attachments.map((a) =>
                                        a.type === 'image' && a.url ? (
                                            <SmartImage key={a.id} src={a.url} onClick={setZoom} className="mb-1 max-h-72 max-w-full rounded-xl object-cover" />
                                        ) : a.type === 'voice' && a.url ? (
                                            <SmartAudio key={a.id} src={a.url} />
                                        ) : a.url ? (
                                            <button key={a.id} type="button" onClick={() => void downloadFile(a.url!, a.name ?? 'файл')} className="my-1 flex items-center gap-2 rounded-xl bg-black/20 px-3 py-2 text-left">
                                                <FileText size={18} />
                                                <span className="min-w-0">
                                                    <span className="block truncate text-sm">{a.name}</span>
                                                    <span className="text-[11px] text-white/50">{size(a.size)}</span>
                                                </span>
                                                <Download size={15} className="text-white/60" />
                                            </button>
                                        ) : null,
                                    )}
                                    {m.body && <p className="break-words whitespace-pre-wrap">{m.body}</p>}
                                    {!m.body && !m.sticker && m.attachments.length === 0 && <p className="text-white/60">{m.preview}</p>}
                                    <span className="mt-0.5 block text-right text-[10px] text-white/45">
                                        {m.edited_at ? 'змінено · ' : ''}
                                        {new Date(m.created_at).toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                </div>
                                {m.reactions.length > 0 && (
                                    <div className="mt-1 flex gap-1">
                                        {m.reactions.map((r) => (
                                            <button key={r.emoji} type="button" onClick={() => void react(m, r.emoji)} className={`rounded-full px-2 py-0.5 text-xs ring-1 ${r.user_ids.includes(me?.id ?? -1) ? 'bg-neon-cyan/15 ring-neon-cyan/50' : 'bg-white/[0.05] ring-white/10'}`}>
                                                {r.emoji} {r.count}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                            {/* Дії при наведенні. */}
                            <div className="flex items-center gap-0.5 self-center opacity-0 transition group-hover:opacity-100">
                                <Reacts onPick={(e) => void react(m, e)} />
                                <MsgAction label="Відповісти" onClick={() => (setReply(m), setEditing(null))}>
                                    <CornerUpLeft size={15} />
                                </MsgAction>
                                {mine && m.type === 'text' && (
                                    <MsgAction label="Редагувати" onClick={() => (setEditing(m), setText(m.body ?? ''), setReply(null))}>
                                        <Pencil size={14} />
                                    </MsgAction>
                                )}
                                {c.can_pin && (
                                    <MsgAction label="Закріпити" onClick={() => void pin(m)}>
                                        <Pin size={14} />
                                    </MsgAction>
                                )}
                                {mine && (
                                    <MsgAction label="Видалити" onClick={() => void remove(m)}>
                                        <Trash2 size={14} />
                                    </MsgAction>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
            {/* Поле вводу. */}
            {c.can_write ? (
                <div className="border-t border-white/5 p-3">
                    {(reply || editing) && (
                        <div className="mb-2 flex items-center gap-2 rounded-xl bg-white/[0.05] px-3 py-2 text-sm">
                            {editing ? <Pencil size={14} className="text-neon-cyan" /> : <CornerUpLeft size={14} className="text-neon-cyan" />}
                            <span className="min-w-0 flex-1 truncate text-white/70">{editing ? 'Редагування' : `Відповідь ${reply?.user?.name ?? ''}: ${reply?.body ?? reply?.preview ?? ''}`}</span>
                            <button type="button" aria-label="Скасувати" onClick={() => (setReply(null), setEditing(null), editing && setText(''))} className="text-white/50 hover:text-white">
                                <X size={15} />
                            </button>
                        </div>
                    )}
                    {files.length > 0 && (
                        <div className="mb-2 flex flex-wrap gap-2">
                            {files.map((f, i) => (
                                <span key={i} className="relative flex items-center gap-2 rounded-xl bg-white/[0.05] p-1.5 pr-7 text-xs">
                                    {f.type.startsWith('image/') ? <img src={URL.createObjectURL(f)} alt="" className="h-12 w-12 rounded-lg object-cover" /> : <FileText size={18} />}
                                    <span className="max-w-32 truncate">{f.name}</span>
                                    <button type="button" aria-label="Прибрати" onClick={() => setFiles((x) => x.filter((_, j) => j !== i))} className="absolute top-1 right-1 text-white/50 hover:text-white">
                                        <X size={13} />
                                    </button>
                                </span>
                            ))}
                        </div>
                    )}
                    {showStickers && stickers && (
                        <div className="mb-2 max-h-56 overflow-y-auto rounded-xl bg-white/[0.04] p-2">
                            {stickers.packs
                                .filter((p) => !p.locked)
                                .map((p) => (
                                    <div key={p.id} className="mb-2">
                                        <p className="mb-1 text-xs text-white/45">{p.name}</p>
                                        <div className="flex flex-wrap gap-1">
                                            {p.stickers.map((s) => (
                                                <button key={s.id} type="button" onClick={() => (setShowStickers(false), void send({ sticker_id: s.id }))} className="rounded-lg p-1 hover:bg-white/10">
                                                    <img src={s.url} alt={s.emoji} className="h-12 w-12 object-contain" />
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                        </div>
                    )}
                    <div className="flex items-end gap-2">
                        <ComposerButton label="Фото чи файл" onClick={pick}>
                            <ImagePlus size={19} />
                        </ComposerButton>
                        <ComposerButton label="Стікери" onClick={() => void openStickers()}>
                            <Sticker size={19} />
                        </ComposerButton>
                        <textarea
                            value={text}
                            onChange={(e) => setText(e.target.value)}
                            onKeyDown={onKey}
                            onPaste={(e) => {
                                const pasted = Array.from(e.clipboardData.files);
                                if (pasted.length) setFiles((f) => [...f, ...pasted].slice(0, 10));
                            }}
                            rows={Math.min(6, Math.max(1, text.split('\n').length))}
                            placeholder="Повідомлення… (Enter — надіслати, Shift+Enter — новий рядок)"
                            className="max-h-40 min-h-11 flex-1 resize-none rounded-2xl bg-white/[0.06] px-4 py-2.5 text-[14px] outline-none ring-1 ring-white/10 placeholder:text-white/30 focus:ring-neon-cyan/50"
                        />
                        <button type="button" disabled={sending} onClick={() => void send()} aria-label="Надіслати" title="Надіслати" className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-gradient-to-br from-neon-cyan to-neon-violet text-obsidian-solid disabled:opacity-40">
                            {editing ? <Check size={19} /> : <SendHorizontal size={19} />}
                        </button>
                    </div>
                </div>
            ) : (
                <p className="border-t border-white/5 p-4 text-center text-sm text-white/45">У цій бесіді писати не можна.</p>
            )}
            {zoom && (
                <div className="absolute inset-0 z-50 grid place-items-center rounded-2xl bg-black/85 p-6" onClick={() => setZoom(null)}>
                    <img src={zoom} alt="" className="max-h-full max-w-full rounded-lg" />
                </div>
            )}
        </div>
    );
}

function MsgAction({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
    return (
        <button type="button" aria-label={label} title={label} onClick={onClick} className="grid h-8 w-8 place-items-center rounded-lg text-white/55 hover:bg-white/10 hover:text-white">
            {children}
        </button>
    );
}

function ComposerButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
    return (
        <button type="button" aria-label={label} title={label} onClick={onClick} className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-white/65 ring-1 ring-white/10 hover:bg-white/10 hover:text-white">
            {children}
        </button>
    );
}

function Reacts({ onPick }: { onPick: (emoji: string) => void }) {
    const [open, setOpen] = useState(false);
    return (
        <span className="relative">
            <MsgAction label="Реакція" onClick={() => setOpen((v) => !v)}>
                <Smile size={15} />
            </MsgAction>
            {open && (
                <span className="absolute bottom-9 left-1/2 z-20 flex -translate-x-1/2 gap-0.5 rounded-full bg-[#141826] px-1.5 py-1 shadow-xl ring-1 ring-white/10">
                    {EMOJI.map((e) => (
                        <button key={e} type="button" onClick={() => (setOpen(false), onPick(e))} className="rounded-full px-1 text-lg hover:scale-125">
                            {e}
                        </button>
                    ))}
                </span>
            )}
        </span>
    );
}

/** Новий чат: друзі й контакти, пошук за іменем. */
function NewChat({ onClose, onOpen }: { onClose: () => void; onOpen: (id: number) => Promise<void> }) {
    const [users, setUsers] = useState<User[] | null>(null);
    const [q, setQ] = useState('');
    useEffect(() => {
        void api<{ users: User[] }>('GET', '/api/v1/messages/contacts').then((r) => setUsers(r.users), () => setUsers([]));
    }, []);
    const start = async (u: User): Promise<void> => {
        const r = await api<{ conversation?: { id: number }; id?: number }>('POST', `/api/v1/messages/with/${u.id}`);
        await onOpen(r.conversation?.id ?? r.id ?? 0);
    };
    return (
        <Modal title="Новий чат" onClose={onClose}>
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ім’я" autoFocus />
            <ul className="mt-3 max-h-96 overflow-y-auto">
                {users === null && <Loading />}
                {users
                    ?.filter((u) => !q || u.name.toLowerCase().includes(q.toLowerCase()))
                    .map((u) => (
                        <li key={u.id}>
                            <button type="button" onClick={() => void start(u)} className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-white/5">
                                <Avatar user={u} size={36} dot={u.is_online ? 'online' : null} />
                                <span className="text-sm">{u.name}</span>
                            </button>
                        </li>
                    ))}
            </ul>
        </Modal>
    );
}

/** Голосове: публічне — напряму, приватне — через Main з токеном. */
function SmartAudio({ src }: { src: string }) {
    const [url, setUrl] = useState<string | null>(src.startsWith('http') ? src : null);
    useEffect(() => {
        if (!src.startsWith('http')) void window.gamecon.blob(src.startsWith('/api/') ? src : `/api/v1${src}`).then(setUrl);
    }, [src]);
    return url ? <audio controls src={url} className="my-1 h-9" /> : <span className="text-xs text-white/50">Голосове…</span>;
}
