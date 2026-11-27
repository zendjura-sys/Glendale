import { Bookmark, Heart, ImagePlus, MessageCircle, Send, Trash2, X } from 'lucide-react';
import { useState } from 'react';
import { Button, Select, SmartImage, TextArea, useToast, when } from '@/components/kit';
import { Avatar } from '@/components/ui';
import { api, type User } from '@/lib/api';
import { useMe } from '@/lib/me';
import { useNav } from '@/lib/nav';

export type Post = {
    id: number;
    body: string | null;
    spoiler?: boolean;
    likes_count: number;
    comments_count: number;
    views_count?: number;
    liked?: boolean;
    saved?: boolean;
    is_pinned?: boolean;
    comments_enabled?: boolean;
    created_at: string;
    edited_at?: string | null;
    author: User;
    family?: { tag: string; name: string } | null;
    attachments: { id: number; type: string; url: string; width: number | null; height: number | null }[];
    poll?: { id: number; question: string; total: number; voted: number | null; options: { id: number; label: string; votes: number }[] } | null;
    link?: { url: string; title?: string | null; description?: string | null; image?: string | null } | null;
};
type Comment = { id: number; body: string; created_at: string; user: User; likes_count: number; liked: boolean; can_delete: boolean };

/** Пост: автор (відкриває профіль), текст, фото/відео з переглядом, опитування, вподобайки й коментарі просто тут. */
export function PostCard({ post, onDeleted }: { post: Post; onDeleted?: () => void }) {
    const { me } = useMe();
    const nav = useNav();
    const toast = useToast();
    const [p, setP] = useState(post);
    const [comments, setComments] = useState<Comment[] | null>(null);
    const [reply, setReply] = useState('');
    const [zoom, setZoom] = useState<string | null>(null);
    const [spoiler, setSpoiler] = useState(!!post.spoiler);
    const like = async (): Promise<void> => {
        setP((x) => ({ ...x, liked: !x.liked, likes_count: x.likes_count + (x.liked ? -1 : 1) }));
        await api('POST', `/api/v1/posts/${p.id}/like`).catch(() => undefined);
    };
    const loadComments = async (): Promise<void> => {
        if (comments) return setComments(null);
        setComments((await api<{ comments: Comment[] }>('GET', `/api/v1/posts/${p.id}/comments`).catch(() => ({ comments: [] }))).comments);
    };
    const comment = async (): Promise<void> => {
        if (!reply.trim()) return;
        try {
            await api('POST', `/api/v1/posts/${p.id}/comments`, { body: reply.trim() });
            setReply('');
            setP((x) => ({ ...x, comments_count: x.comments_count + 1 }));
            setComments((await api<{ comments: Comment[] }>('GET', `/api/v1/posts/${p.id}/comments`)).comments);
        } catch (e) {
            toast((e as Error).message, 'error');
        }
    };
    const vote = async (option: number): Promise<void> => {
        try {
            await api('POST', `/api/v1/site/posts/${p.id}/poll`, { option_id: option });
            const fresh = await api<{ post: Post }>('GET', `/api/v1/posts/${p.id}`);
            setP(fresh.post);
        } catch (e) {
            toast((e as Error).message, 'error');
        }
    };
    const remove = async (): Promise<void> => {
        if (!window.confirm('Видалити запис?')) return;
        await api('DELETE', `/api/v1/posts/${p.id}`).then(() => onDeleted?.(), (e: Error) => toast(e.message, 'error'));
    };
    const images = p.attachments.filter((a) => a.type !== 'video');
    const videos = p.attachments.filter((a) => a.type === 'video');
    return (
        <article className="break-inside-avoid rounded-2xl bg-white/[0.035] p-4 ring-1 ring-white/[0.07]">
            <header className="mb-2.5 flex items-center gap-3">
                <button type="button" onClick={() => p.author.username && nav.go(`/u/${p.author.username}`)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                    <Avatar user={p.author} size={40} dot={p.author.is_online ? 'online' : null} />
                    <span className="min-w-0">
                        <span className="block truncate font-semibold hover:underline">{p.author.name}</span>
                        <span className="block truncate text-xs text-white/45">
                            {when(p.created_at)}
                            {p.family ? ` · [${p.family.tag}] ${p.family.name}` : ''}
                            {p.is_pinned ? ' · закріплено' : ''}
                        </span>
                    </span>
                </button>
                {p.author.id === me?.id && (
                    <button type="button" onClick={() => void remove()} aria-label="Видалити" title="Видалити" className="grid h-9 w-9 place-items-center rounded-xl text-white/45 hover:bg-white/10 hover:text-rose-300">
                        <Trash2 size={16} />
                    </button>
                )}
            </header>
            <div className={spoiler ? 'cursor-pointer blur-md select-none' : ''} onClick={() => setSpoiler(false)}>
                {p.body && <p className="text-[14.5px] leading-relaxed break-words whitespace-pre-wrap text-white/90">{p.body}</p>}
                {images.length > 0 && (
                    <div className={`mt-3 grid gap-1.5 overflow-hidden rounded-xl ${images.length === 1 ? '' : 'grid-cols-2'}`}>
                        {images.slice(0, 4).map((a) => (
                            <SmartImage key={a.id} src={a.url} onClick={setZoom} className={`w-full object-cover ${images.length === 1 ? 'max-h-[460px]' : 'aspect-square'}`} />
                        ))}
                    </div>
                )}
                {videos.map((v) => (
                    <video key={v.id} src={v.url} controls className="mt-3 max-h-[460px] w-full rounded-xl bg-black" />
                ))}
                {p.poll && (
                    <div className="mt-3 space-y-1.5 rounded-xl bg-white/[0.04] p-3">
                        <p className="text-sm font-semibold">{p.poll.question}</p>
                        {p.poll.options.map((o) => {
                            const pct = p.poll!.total ? Math.round((o.votes / p.poll!.total) * 100) : 0;
                            const show = p.poll!.voted !== null;
                            return (
                                <button key={o.id} type="button" disabled={show} onClick={() => void vote(o.id)} className={`relative block w-full overflow-hidden rounded-lg bg-white/[0.04] px-3 py-2 text-left text-sm ring-1 ${p.poll!.voted === o.id ? 'ring-neon-cyan/50' : 'ring-transparent hover:ring-white/15'}`}>
                                    {show && <span className="absolute inset-y-0 left-0 bg-neon-cyan/15" style={{ width: `${pct}%` }} />}
                                    <span className="relative flex">
                                        <span className="flex-1">{o.label}</span>
                                        {show && `${pct}%`}
                                    </span>
                                </button>
                            );
                        })}
                        <p className="text-[11px] text-white/40">{p.poll.total} голосів</p>
                    </div>
                )}
                {p.link && (
                    <div className="mt-3 flex gap-3 rounded-xl bg-white/[0.04] p-3 ring-1 ring-white/5">
                        {p.link.image && <img src={p.link.image} alt="" className="h-16 w-24 rounded-lg object-cover" />}
                        <span className="min-w-0">
                            <span className="block truncate text-sm font-semibold">{p.link.title ?? p.link.url}</span>
                            {p.link.description && <span className="line-clamp-2 text-xs text-white/50">{p.link.description}</span>}
                        </span>
                    </div>
                )}
            </div>
            <footer className="mt-3 flex items-center gap-1 text-sm">
                <button type="button" onClick={() => void like()} className={`flex h-9 items-center gap-1.5 rounded-xl px-3 transition hover:bg-white/[0.07] ${p.liked ? 'text-rose-300' : 'text-white/60'}`}>
                    <Heart size={17} fill={p.liked ? 'currentColor' : 'none'} /> {p.likes_count}
                </button>
                {p.comments_enabled !== false && (
                    <button type="button" onClick={() => void loadComments()} className="flex h-9 items-center gap-1.5 rounded-xl px-3 text-white/60 transition hover:bg-white/[0.07]">
                        <MessageCircle size={17} /> {p.comments_count}
                    </button>
                )}
                <div className="flex-1" />
                {p.views_count ? <span className="text-xs text-white/35">{p.views_count} переглядів</span> : null}
                {p.saved && <Bookmark size={15} className="text-neon-cyan" />}
            </footer>
            {comments && (
                <div className="mt-2 space-y-2.5 border-t border-white/5 pt-3">
                    {comments.map((c) => (
                        <div key={c.id} className="flex gap-2.5 text-sm">
                            <Avatar user={c.user} size={30} />
                            <div className="min-w-0 flex-1 rounded-xl bg-white/[0.04] px-3 py-2">
                                <span className="font-semibold">{c.user.name}</span> <span className="text-xs text-white/35">{when(c.created_at)}</span>
                                <p className="break-words whitespace-pre-wrap text-white/80">{c.body}</p>
                            </div>
                        </div>
                    ))}
                    <div className="flex items-center gap-2">
                        <input
                            value={reply}
                            onChange={(e) => setReply(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && void comment()}
                            placeholder="Коментар…"
                            className="h-10 min-w-0 flex-1 rounded-xl bg-white/[0.05] px-3 text-sm outline-none ring-1 ring-white/10 focus:ring-neon-cyan/50"
                        />
                        <button type="button" onClick={() => void comment()} aria-label="Надіслати" className="grid h-10 w-10 place-items-center rounded-xl bg-neon-violet/70 hover:bg-neon-violet">
                            <Send size={16} />
                        </button>
                    </div>
                </div>
            )}
            {zoom && (
                <div className="fixed inset-0 z-[90] grid place-items-center bg-black/85 p-8" onClick={() => setZoom(null)}>
                    <img src={zoom} alt="" className="max-h-full max-w-full rounded-lg" />
                </div>
            )}
        </article>
    );
}

/** Новий запис: текст, фото й відео (перетягнути чи Ctrl+V), хто бачить, спойлер; на чужій стіні — wall. */
export function Composer({ wall, community, asCommunity, onPosted, placeholder = 'Що нового?' }: { wall?: string; community?: string; asCommunity?: boolean; onPosted: () => void; placeholder?: string }) {
    const { me } = useMe();
    const toast = useToast();
    const [text, setText] = useState('');
    const [files, setFiles] = useState<File[]>([]);
    const [visibility, setVisibility] = useState('public');
    const [spoiler, setSpoiler] = useState(false);
    const [busy, setBusy] = useState(false);
    const pick = (): void => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*,video/*';
        input.multiple = true;
        input.onchange = () => setFiles((f) => [...f, ...Array.from(input.files ?? [])].slice(0, 10));
        input.click();
    };
    const post = async (): Promise<void> => {
        if (!text.trim() && !files.length) return;
        setBusy(true);
        try {
            const upload = await Promise.all(files.map(async (f) => ({ field: 'images[]', name: f.name, type: f.type, data: await f.arrayBuffer() })));
            await api('POST', '/api/v1/posts', { __form: true, fields: { body: text.trim() || null, visibility, spoiler, wall: wall ?? null, community: community ?? null, as_community: asCommunity ?? null }, files: upload });
            setText('');
            setFiles([]);
            setSpoiler(false);
            toast('Опубліковано.');
            onPosted();
        } catch (e) {
            toast((e as Error).message, 'error');
        }
        setBusy(false);
    };
    return (
        <div
            className="rounded-2xl bg-white/[0.035] p-4 ring-1 ring-white/[0.07]"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
                e.preventDefault();
                setFiles((f) => [...f, ...Array.from(e.dataTransfer.files)].slice(0, 10));
            }}
        >
            <div className="flex gap-3">
                <Avatar user={me} size={40} />
                <TextArea value={text} onChange={(e) => setText(e.target.value)} onPaste={(e) => e.clipboardData.files.length && setFiles((f) => [...f, ...Array.from(e.clipboardData.files)].slice(0, 10))} placeholder={placeholder} rows={2} />
            </div>
            {files.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2 pl-[52px]">
                    {files.map((f, i) => (
                        <span key={i} className="relative">
                            {f.type.startsWith('video/') ? <video src={URL.createObjectURL(f)} className="h-20 w-28 rounded-lg object-cover" /> : <img src={URL.createObjectURL(f)} alt="" className="h-20 w-28 rounded-lg object-cover" />}
                            <button type="button" aria-label="Прибрати" onClick={() => setFiles((x) => x.filter((_, j) => j !== i))} className="absolute -top-1.5 -right-1.5 grid h-5 w-5 place-items-center rounded-full bg-rose-500">
                                <X size={11} />
                            </button>
                        </span>
                    ))}
                </div>
            )}
            <div className="mt-3 flex items-center gap-2 pl-[52px]">
                <Button small onClick={pick}>
                    <ImagePlus size={15} /> Фото / відео
                </Button>
                {!wall && !community && (
                    <Select value={visibility} onChange={(e) => setVisibility(e.target.value)} className="!h-8 !w-40 !py-0 text-[13px]">
                        <option value="public">Бачать усі</option>
                        <option value="friends">Лише друзі</option>
                        <option value="private">Лише я</option>
                    </Select>
                )}
                <label className="flex items-center gap-1.5 text-[13px] text-white/60">
                    <input type="checkbox" className="accent-[#22d3ee]" checked={spoiler} onChange={(e) => setSpoiler(e.target.checked)} /> Спойлер
                </label>
                <div className="flex-1" />
                <Button tone="primary" disabled={busy || (!text.trim() && !files.length)} onClick={() => void post()}>
                    Опублікувати
                </Button>
            </div>
        </div>
    );
}
