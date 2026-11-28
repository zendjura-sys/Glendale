import { ArrowLeft, Eye, Film, Heart, Lock, MessageSquare, Paperclip, Pin, Plus, Trash2, X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Button, Card, Cover, Input, Loading, Select, TextArea, useToast, when } from '@/components/kit';
import { Avatar } from '@/components/ui';
import { api, type User } from '@/lib/api';
import { useNav } from '@/lib/nav';

type Topic = { id: number; title: string; excerpt: string | null; category: string; category_label: string; subject_type: string | null; spoiler: boolean; is_pinned: boolean; is_locked: boolean; replies_count: number; likes_count: number; views_count: number; liked: boolean; user: User | null; created_at: string; last_reply_at: string | null; can_edit: boolean; can_moderate: boolean };
export type Embed = { type: string; id: number; label: string; title: string; href: string; cover: string | null; subtitle: string | null };
type Reply = { id: number; body: string; embeds?: Embed[]; spoiler: boolean; likes_count: number; liked: boolean; user: User | null; parent: { id: number; author: string | null; body: string | null } | null; created_at: string; can_delete: boolean };
type List = { subject: { title: string } | null; categories: Record<string, string>; discussions: { data: Topic[]; last_page: number; total: number } };
type Thread = { discussion: Topic & { body: string | null; embeds?: Embed[] }; subject: { title: string; label: string; href: string } | null; replies: { data: Reply[] } };

const call = <T,>(method: string, path: string, body?: unknown): Promise<T> => api<T>(method, `/api/v1/discussions${path}`, body);

/**
 * «Обговорення» в програмі: з subject — теми про гру, фільм, сервер, сім’ю, клан, спільноту чи статтю
 * (блок на їхніх сторінках); без subject — загальний розділ з категоріями. Розділ теми обирається.
 */
export function Discussions({ subject, compact = false, initialOpen }: { subject?: { type: string; id: number }; compact?: boolean; initialOpen?: number }) {
    const [list, setList] = useState<List | null>(null);
    const [category, setCategory] = useState('');
    const [sort, setSort] = useState<'active' | 'new' | 'top'>('active');
    const [page, setPage] = useState(1);
    const [open, setOpen] = useState<number | null>(initialOpen ?? null);
    const [creating, setCreating] = useState(false);
    const q = subject ? `type=${subject.type}&id=${subject.id}` : `category=${category}`;
    const load = useCallback(async () => {
        setList(await call<List>('GET', `/list?${q}&sort=${sort}&page=${page}`).catch(() => null));
    }, [q, sort, page]);
    useEffect(() => {
        void load();
    }, [load]);
    if (open) return <ThreadView id={open} onBack={() => (setOpen(null), void load())} />;
    return (
        <Card
            title={
                <span className="flex items-center gap-2">
                    <MessageSquare size={16} className="text-neon-cyan" /> Обговорення {list && <span className="text-white/40">{list.discussions.total}</span>}
                </span>
            }
            actions={
                <div className="flex gap-1">
                    {(['active', 'new', 'top'] as const).map((s) => (
                        <Button key={s} small tone={sort === s ? 'primary' : 'ghost'} onClick={() => (setSort(s), setPage(1))}>
                            {s === 'active' ? 'Активні' : s === 'new' ? 'Нові' : 'Найкращі'}
                        </Button>
                    ))}
                    <Button small tone="primary" onClick={() => setCreating((v) => !v)}>
                        <Plus size={14} /> Нова тема
                    </Button>
                </div>
            }
        >
            {!subject && list && (
                <div className="mb-3 flex flex-wrap gap-1.5">
                    {[['', 'Усе'], ...Object.entries(list.categories)].map(([k, v]) => (
                        <button key={k} type="button" onClick={() => (setCategory(k), setPage(1))} className={`h-8 rounded-full px-3.5 text-[13px] ring-1 transition ${category === k ? 'bg-neon-cyan/15 text-white ring-neon-cyan/50' : 'text-white/60 ring-white/10 hover:bg-white/5'}`}>
                            {v}
                        </button>
                    ))}
                </div>
            )}
            {creating && <NewTopic subject={subject} categories={list?.categories ?? {}} category={category} onDone={(id) => (setCreating(false), setOpen(id))} />}
            {!list && <Loading />}
            {list?.discussions.data.length === 0 && <p className="py-6 text-center text-sm text-white/45">Тем ще немає — почніть першу.</p>}
            <div className="divide-y divide-white/[0.06]">
                {list?.discussions.data.slice(0, compact ? 5 : undefined).map((d) => (
                    <button key={d.id} type="button" onClick={() => setOpen(d.id)} className="flex w-full items-start gap-3 rounded-lg px-1 py-3 text-left hover:bg-white/[0.03]">
                        <Avatar user={d.user} size={36} />
                        <span className="min-w-0 flex-1">
                            <span className="flex items-center gap-1.5 font-medium">
                                {d.is_pinned && <Pin size={13} className="text-amber-300" />}
                                {d.is_locked && <Lock size={13} className="text-white/45" />}
                                <span className="truncate">{d.title}</span>
                                {d.spoiler && <span className="rounded bg-rose-500/20 px-1.5 text-[11px] text-rose-200">спойлер</span>}
                            </span>
                            {d.excerpt && !d.spoiler && <span className="line-clamp-1 text-sm text-white/55">{d.excerpt}</span>}
                            <span className="text-xs text-white/40">
                                {d.user?.name} · {!subject && `${d.category_label} · `}
                                {when(d.last_reply_at ?? d.created_at)}
                            </span>
                        </span>
                        <span className="flex shrink-0 items-center gap-3 text-xs text-white/50">
                            <span className="flex items-center gap-1"><MessageSquare size={13} />{d.replies_count}</span>
                            <span className="flex items-center gap-1"><Heart size={13} />{d.likes_count}</span>
                        </span>
                    </button>
                ))}
            </div>
            {list && list.discussions.last_page > 1 && !compact && (
                <div className="mt-3 flex items-center justify-center gap-2 text-sm">
                    <Button small disabled={page <= 1} onClick={() => setPage(page - 1)}>←</Button>
                    {page} / {list.discussions.last_page}
                    <Button small disabled={page >= list.discussions.last_page} onClick={() => setPage(page + 1)}>→</Button>
                </div>
            )}
        </Card>
    );
}

function NewTopic({ subject, categories, category, onDone }: { subject?: { type: string; id: number }; categories: Record<string, string>; category: string; onDone: (id: number) => void }) {
    const toast = useToast();
    const [title, setTitle] = useState('');
    const [body, setBody] = useState('');
    const [cat, setCat] = useState(category || (subject ? '' : 'general'));
    const [spoiler, setSpoiler] = useState(false);
    const [embeds, setEmbeds] = useState<Embed[]>([]);
    const [busy, setBusy] = useState(false);
    const submit = async (): Promise<void> => {
        setBusy(true);
        try {
            const r = await call<{ discussion: { id: number } }>('POST', '', { ...(subject ?? {}), category: cat || null, title, body: body || null, spoiler, embeds: embeds.map((x) => ({ type: x.type, id: x.id })) });
            onDone(r.discussion.id);
        } catch (e) {
            toast((e as Error).message, 'error');
        }
        setBusy(false);
    };
    return (
        <div className="mb-4 space-y-2 rounded-xl bg-white/[0.04] p-3">
            <Input value={title} maxLength={160} placeholder="Тема (від 4 символів)" onChange={(e) => setTitle(e.target.value)} />
            <TextArea value={body} maxLength={10000} placeholder="Що хочете обговорити?" onChange={(e) => setBody(e.target.value)} />
            <EmbedPicker category={cat} value={embeds} onChange={setEmbeds} />
            <div className="flex flex-wrap items-center gap-3">
                <span className="text-sm text-white/60">Розділ</span>
                <Select value={cat} onChange={(e) => setCat(e.target.value)} className="!w-48">
                    {subject && <option value="">Автоматично</option>}
                    {Object.entries(categories).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </Select>
                <label className="flex items-center gap-1.5 text-sm text-white/65"><input type="checkbox" className="accent-[#22d3ee]" checked={spoiler} onChange={(e) => setSpoiler(e.target.checked)} /> Спойлер</label>
                <div className="flex-1" />
                <Button tone="primary" disabled={busy || title.trim().length < 4} onClick={() => void submit()}>Створити</Button>
            </div>
        </div>
    );
}

function ThreadView({ id, onBack }: { id: number; onBack: () => void }) {
    const nav = useNav();
    const toast = useToast();
    const [t, setT] = useState<Thread | null>(null);
    const [body, setBody] = useState('');
    const [reply, setReply] = useState<Reply | null>(null);
    const [embeds, setEmbeds] = useState<Embed[]>([]);
    const [attach, setAttach] = useState(false);
    const [shown, setShown] = useState<Record<number, boolean>>({});
    const load = useCallback(async () => {
        try {
            setT(await call<Thread>('GET', `/${id}`));
        } catch {
            onBack();
        }
    }, [id, onBack]);
    useEffect(() => {
        void load();
    }, [load]);
    if (!t) return <Loading />;
    const d = t.discussion;
    const act = async (method: string, path: string, data?: unknown, after?: () => void): Promise<void> => {
        try {
            const r = await call<{ message?: string }>(method, path, data);
            if (r?.message) toast(r.message);
            after?.();
            await load();
        } catch (e) {
            toast((e as Error).message, 'error');
        }
    };
    return (
        <Card>
            <button type="button" onClick={onBack} className="mb-3 inline-flex h-9 items-center gap-1.5 rounded-lg px-2 text-sm text-white/60 hover:bg-white/5 hover:text-white">
                <ArrowLeft size={16} /> До тем
            </button>
            <div className="flex items-start gap-3">
                <Avatar user={d.user} size={44} />
                <div className="min-w-0 flex-1">
                    <h3 className="text-xl font-semibold">{d.title}</h3>
                    <p className="text-xs text-white/45">
                        {d.user?.name} · {when(d.created_at)} ·{' '}
                        {t.subject ? (
                            <button type="button" onClick={() => nav.go(t.subject!.href)} className="text-neon-cyan hover:underline">
                                {t.subject.label}: {t.subject.title}
                            </button>
                        ) : (
                            d.category_label
                        )}
                        <span className="ml-2 inline-flex items-center gap-1"><Eye size={12} />{d.views_count}</span>
                    </p>
                </div>
                <Button small tone={d.liked ? 'primary' : 'ghost'} onClick={() => void act('POST', `/${id}/like`)}>
                    <Heart size={14} fill={d.liked ? 'currentColor' : 'none'} /> {d.likes_count}
                </Button>
                {d.can_moderate && (
                    <>
                        <Button small onClick={() => void act('POST', `/${id}/moderate`, { pinned: !d.is_pinned })}><Pin size={14} /></Button>
                        <Button small onClick={() => void act('POST', `/${id}/moderate`, { locked: !d.is_locked })}><Lock size={14} /></Button>
                    </>
                )}
                {d.can_edit && <Button small tone="danger" onClick={() => window.confirm('Видалити тему?') && void act('DELETE', `/${id}`, undefined, onBack)}><Trash2 size={14} /></Button>}
            </div>
            {d.body && <p onClick={() => setShown({ ...shown, 0: true })} className={`mt-3 text-[14.5px] whitespace-pre-wrap text-white/85 ${d.spoiler && !shown[0] ? 'cursor-pointer blur-sm' : ''}`}>{d.body}</p>}
            <EmbedCards embeds={d.embeds} />
            <div className="mt-4 space-y-3 border-t border-white/[0.06] pt-4">
                {t.replies.data.length === 0 && <p className="text-sm text-white/45">Відповідей ще немає — будьте першим.</p>}
                {t.replies.data.map((r) => (
                    <div key={r.id} className="flex gap-3">
                        <Avatar user={r.user} size={32} />
                        <div className="min-w-0 flex-1 rounded-xl bg-white/[0.04] px-3 py-2">
                            <p className="text-sm"><b>{r.user?.name}</b> <span className="text-xs text-white/40">{when(r.created_at)}</span></p>
                            {r.parent && <p className="my-1 border-l-2 border-white/20 pl-2 text-xs text-white/50"><b>{r.parent.author}</b> {r.parent.body ?? 'видалена відповідь'}</p>}
                            <p onClick={() => setShown({ ...shown, [r.id]: true })} className={`text-sm whitespace-pre-wrap text-white/80 ${r.spoiler && !shown[r.id] ? 'cursor-pointer blur-sm' : ''}`}>{r.body}</p>
                            <EmbedCards embeds={r.embeds} />
                            <div className="mt-1 flex gap-3 text-xs text-white/45">
                                <button type="button" onClick={() => void act('POST', `/${id}/replies/${r.id}/like`)} className={`inline-flex items-center gap-1 ${r.liked ? 'text-rose-300' : ''}`}><Heart size={12} fill={r.liked ? 'currentColor' : 'none'} />{r.likes_count}</button>
                                {!d.is_locked && <button type="button" onClick={() => setReply(r)}>Відповісти</button>}
                                {r.can_delete && <button type="button" onClick={() => void act('DELETE', `/${id}/replies/${r.id}`)}>Видалити</button>}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
            {d.is_locked ? (
                <p className="mt-4 text-center text-sm text-white/45">Тему закрито.</p>
            ) : (
                <div className="mt-4">
                    {reply && <p className="mb-1 text-xs text-white/50">Відповідь для {reply.user?.name} <button type="button" onClick={() => setReply(null)}>✕</button></p>}
                    {attach && <div className="mb-2"><EmbedPicker category={d.category} value={embeds} onChange={setEmbeds} /></div>}
                    <div className="flex gap-2">
                        <Button tone={attach ? 'primary' : 'ghost'} onClick={() => setAttach((v) => !v)}><Paperclip size={15} /></Button>
                        <TextArea value={body} maxLength={5000} placeholder="Ваша відповідь…" onChange={(e) => setBody(e.target.value)} rows={2} />
                        <Button tone="primary" disabled={!body.trim()} onClick={() => void act('POST', `/${id}/replies`, { body, parent_id: reply?.id ?? null, embeds: embeds.map((x) => ({ type: x.type, id: x.id })) }, () => (setBody(''), setReply(null), setEmbeds([]), setAttach(false)))}>Надіслати</Button>
                    </div>
                </div>
            )}
        </Card>
    );
}

const TYPE_FOR: Record<string, string> = { cinema: 'movie', series: 'movie', anime: 'movie', games: 'game', music: 'track' };
const TYPES: Record<string, string> = { movie: 'Фільм / серіал / аніме', game: 'Гра', server: 'Сервер', track: 'Трек', family: 'Сім’я', clan: 'Клан', community: 'Спільнота', article: 'Стаття' };

/** Вбудовані картки (фільм, гра, сервер, трек…) — відкривають сторінку в програмі. */
export function EmbedCards({ embeds }: { embeds?: Embed[] }) {
    const nav = useNav();
    if (!embeds?.length) return null;
    return (
        <div className="mt-2 grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-2">
            {embeds.map((e) => (
                <button key={`${e.type}-${e.id}`} type="button" onClick={() => nav.go(e.href)} className="flex items-center gap-3 rounded-xl bg-white/[0.05] p-2 text-left ring-1 ring-white/10 transition hover:ring-neon-cyan/40">
                    <Cover src={e.cover} className={`shrink-0 rounded-lg ${e.type === 'movie' ? 'h-16 w-11' : 'h-12 w-12'}`} fallback={<Film size={18} />} />
                    <span className="min-w-0">
                        <span className="block text-[10.5px] tracking-wide text-white/45 uppercase">{e.label}</span>
                        <span className="block truncate text-sm font-semibold">{e.title}</span>
                        {e.subtitle && <span className="block truncate text-xs text-white/50">{e.subtitle}</span>}
                    </span>
                </button>
            ))}
        </div>
    );
}

/** Вибір картки: тип (за розділом — підказаний) і пошук за назвою. */
function EmbedPicker({ category, value, onChange }: { category: string; value: Embed[]; onChange: (v: Embed[]) => void }) {
    const [type, setType] = useState(TYPE_FOR[category] ?? 'movie');
    const [q, setQ] = useState('');
    const [items, setItems] = useState<Embed[]>([]);
    useEffect(() => {
        if (TYPE_FOR[category]) setType(TYPE_FOR[category]);
    }, [category]);
    useEffect(() => {
        if (q.trim().length < 2) return setItems([]);
        const t = window.setTimeout(() => void call<{ items: Embed[] }>('GET', `/embeds?type=${type}&q=${encodeURIComponent(q)}`).then((r) => setItems(r.items), () => setItems([])), 250);
        return () => window.clearTimeout(t);
    }, [q, type]);
    return (
        <div className="space-y-2">
            {value.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                    {value.map((e) => (
                        <span key={`${e.type}-${e.id}`} className="inline-flex items-center gap-1 rounded-full bg-neon-cyan/15 px-2.5 py-1 text-xs ring-1 ring-neon-cyan/30">
                            {e.title}
                            <button type="button" aria-label="Прибрати" onClick={() => onChange(value.filter((x) => x !== e))}><X size={12} /></button>
                        </span>
                    ))}
                </div>
            )}
            {value.length < 6 && (
                <div className="flex gap-2">
                    <Select value={type} onChange={(e) => setType(e.target.value)} className="!w-56">
                        {Object.entries(TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </Select>
                    <div className="relative min-w-0 flex-1">
                        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Додати картку: почніть вводити назву" />
                        {items.length > 0 && (
                            <div className="absolute inset-x-0 top-full z-30 mt-1 max-h-64 overflow-y-auto rounded-xl bg-[#141826] p-1 shadow-2xl ring-1 ring-white/10">
                                {items.map((it) => (
                                    <button key={it.id} type="button" onClick={() => (onChange([...value, it]), setQ(''), setItems([]))} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-white/10">
                                        <Cover src={it.cover} className="h-8 w-8 rounded" fallback={<Film size={12} />} />
                                        <span className="min-w-0 flex-1 truncate">{it.title}</span>
                                        {it.subtitle && <span className="text-xs text-white/45">{it.subtitle}</span>}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
