import { Discussions } from '@/components/Discussions';
import { LogOut, MessageSquare, Plus, Search, Shield } from 'lucide-react';
import { useState } from 'react';
import { Button, Card, Field, Input, Loading, Masonry, Modal, PageHeader, Select, StatTile, Tabs, TextArea, money, useAction, useSite, when } from '@/components/kit';
import { Markdown } from '@/pages/family/Info';
import { Avatar } from '@/components/ui';
import type { User } from '@/lib/api';
import { useNav } from '@/lib/nav';

type ClanCard = { id: number; slug: string; type: string; type_label: string; name: string; display_name: string; tag: string | null; logo_url: string | null; members_count: number; is_recruiting: boolean; join_mode: string; game: { name: string } | null; pending?: boolean };

/** «Клани»: мої клани й гільдії та пошук нових з фільтром за типом. */
export function ClansList() {
    const nav = useNav();
    const [q, setQ] = useState('');
    const [query, setQuery] = useState('');
    const [type, setType] = useState('');
    const page = useSite<{ mine: ClanCard[]; clans: { data: ClanCard[] }; types: Record<string, string> }>(`/clans?q=${encodeURIComponent(query)}${type ? `&type=${type}` : ''}`);
    const card = (c: ClanCard) => (
        <button key={c.id} type="button" onClick={() => nav.go(`/clans/${c.slug}`)} className="flex items-center gap-3 rounded-2xl bg-white/[0.035] p-3.5 text-left ring-1 ring-white/[0.07] transition hover:bg-white/[0.06]">
            <Avatar user={{ name: c.display_name, avatar_url: c.logo_url }} size={48} />
            <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">
                    {c.tag ? <span className="text-neon-cyan">[{c.tag}] </span> : null}
                    {c.name}
                </span>
                <span className="block truncate text-xs text-white/50">
                    {c.type_label}
                    {c.game ? ` · ${c.game.name}` : ''} · {c.members_count} учасників
                </span>
                {c.pending && <span className="text-[11px] text-amber-300">Заявка на розгляді</span>}
            </span>
            {c.is_recruiting && !c.pending && <span className="rounded-full bg-emerald-400/15 px-2 py-0.5 text-[11px] text-emerald-200">набір</span>}
        </button>
    );
    return (
        <div className="flex h-full flex-col">
            <PageHeader title="Клани" subtitle="Клани й гільдії гравців" />
            <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_300px] gap-5 overflow-y-auto p-5 max-[1100px]:grid-cols-1">
<div className="min-w-0 space-y-5">
                {!page.data && <Loading error={page.error} />}
                {page.data && page.data.mine.length > 0 && (
                    <Card title="Мої">
                        <div className="grid grid-cols-[repeat(auto-fill,minmax(340px,1fr))] gap-3">{page.data.mine.map(card)}</div>
                    </Card>
                )}
                {page.data && (
                    <Card
                        title="Знайти"
                        actions={
                            <form onSubmit={(e) => (e.preventDefault(), setQuery(q.trim()))} className="flex gap-2">
                                <Select value={type} onChange={(e) => setType(e.target.value)} className="!w-36">
                                    <option value="">Усі типи</option>
                                    {Object.entries(page.data.types).map(([k, v]) => (
                                        <option key={k} value={k}>
                                            {v}
                                        </option>
                                    ))}
                                </Select>
                                <div className="relative">
                                    <Search size={15} className="absolute top-3 left-3 text-white/40" />
                                    <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Назва, тег чи гра" className="!w-60 pl-9" />
                                </div>
                            </form>
                        }
                    >
                        <div className="grid grid-cols-[repeat(auto-fill,minmax(340px,1fr))] gap-3">{page.data.clans.data.map(card)}</div>
                    </Card>
                )}
                </div>
                <aside className="space-y-4">
                    <div className="grid grid-cols-2 gap-2">
                        <StatTile label="Мої" value={page.data?.mine.length ?? '—'} accent />
                        <StatTile label="Набирають" value={page.data ? page.data.clans.data.filter((c) => c.is_recruiting).length : '—'} />
                    </div>
                    {page.data && (
                        <Card title="Типи">
                            <div className="flex flex-wrap gap-1.5">
                                {Object.entries(page.data.types).map(([k, v]) => (
                                    <button key={k} type="button" onClick={() => setType(type === k ? '' : k)} className={`h-8 rounded-lg px-2.5 text-xs ring-1 ${type === k ? 'bg-white/10 ring-white/25' : 'text-white/60 ring-white/10 hover:bg-white/5'}`}>
                                        {v}
                                    </button>
                                ))}
                            </div>
                        </Card>
                    )}
                    <Card title="Навіщо клан">
                        <ul className="space-y-2 text-sm text-white/60">
                            <li>• Спільний чат і голосова кімната для команди.</li>
                            <li>• Події з реєстрацією та турнірні сітки.</li>
                            <li>• Скарбниця, ранги й «Гравець місяця».</li>
                        </ul>
                    </Card>
                </aside>
            </div>
        </div>
    );
}

type Member = { id: number; user: User | null; nickname: string | null; rank: number; rank_title: string; is_owner: boolean; contributed: number; note: string | null; answers: string[] | null; joined_at: string | null; applied_at: string | null; away?: boolean; events?: number };
type Clan = {
    clan: ClanCard & { description: string | null; rules: string | null; features: string[]; currency: string; treasury: number; owner: User | null; rank_titles: Record<string, string>; conversation_id: number | null; created_at: string; questions: string[] };
    me: (Member & { can: Record<string, boolean> }) | null;
    mvp: { month: string; winner: { user: User } | null; leaders: { user: User; votes: number }[]; my_vote: number | null } | null;
    application: { applied_at: string } | null;
    features: Record<string, { label: string; text: string }>;
    join_modes: Record<string, string>;
    members: Member[];
    applications: Member[];
    news: { id: number; title: string; body: string; is_pinned: boolean; user: User | null; created_at: string; mine: boolean }[];
    events: { id: number; title: string; description: string | null; starts_at: string; going_count: number; going: boolean; repeat: boolean; cover_url: string | null }[];
    shifts: { id: number; title: string; starts_at: string; ends_at: string; user: User | null; mine: boolean }[];
    contributions: { id: number; amount: number; comment: string | null; status: string; user: User | null; created_at: string }[];
    rating: Member[];
    permissions: { labels: Record<string, string>; matrix: Record<string, number[]> } | null;
    settings: { name: string; tag: string; description: string | null; rules: string | null; join_mode: string; is_recruiting: boolean; currency: string; questions: string[] } | null;
    allies: { name: string; slug: string }[];
};
type TabId = 'overview' | 'talk' | 'news' | 'events' | 'members' | 'shifts' | 'treasury' | 'rating' | 'rules' | 'settings';

/** Клан чи гільдія повністю: огляд і MVP, новини, заходи, склад і заявки, зміни, скарбниця, рейтинг, правила, налаштування; вступ і чат. */
export function ClanPage({ slug }: { slug: string }) {
    const nav = useNav();
    const page = useSite<Clan>(`/clans/${slug}`);
    const { run, busy } = useAction();
    const [tab, setTab] = useState<TabId>('overview');
    const [joining, setJoining] = useState(false);
    if (!page.data) return <Loading error={page.error} />;
    const d = page.data;
    const c = d.clan;
    const can = d.me?.can ?? {};
    const has = (f: string): boolean => c.features.includes(f);
    const reload = page.reload;
    const base = `/clans/${slug}`;
    const tabs: { id: TabId; label: string; badge?: number; show: boolean }[] = [
        { id: 'overview', label: 'Огляд', show: true },
        { id: 'news', label: 'Новини', show: !!d.me && has('news') },
        { id: 'events', label: 'Заходи', show: !!d.me && has('events') },
        { id: 'members', label: 'Склад', badge: d.applications.length, show: !!d.me },
        { id: 'shifts', label: 'Зміни', show: !!d.me && has('shifts') },
        { id: 'treasury', label: 'Скарбниця', show: !!d.me && has('treasury') },
        { id: 'rating', label: 'Рейтинг', show: !!d.me && has('rating') },
        { id: 'talk', label: 'Обговорення', show: true },
        { id: 'rules', label: 'Правила', show: !!c.rules },
        { id: 'settings', label: 'Налаштування', show: !!d.settings },
    ];
    return (
        <div className="flex h-full flex-col">
            <PageHeader
                title={
                    <span>
                        {c.tag && <span className="text-neon-cyan">[{c.tag}] </span>}
                        {c.name}
                    </span>
                }
                subtitle={[c.type_label, c.game?.name, `${c.members_count} учасників`, d.me ? `${d.me.rank_title}` : null].filter(Boolean).join(' · ')}
                image={c.logo_url ? <Avatar user={{ name: c.name, avatar_url: c.logo_url }} size={42} /> : <span className="grid h-10 w-10 place-items-center rounded-xl bg-neon-cyan/15"><Shield size={18} /></span>}
                actions={
                    <div className="flex gap-2">
                        {d.me && c.conversation_id && has('chat') && (
                            <Button tone="primary" onClick={() => nav.go(`/messages/${c.conversation_id}`)}>
                                <MessageSquare size={15} /> Чат
                            </Button>
                        )}
                        {!d.me && !d.application && c.join_mode !== 'closed' && (
                            <Button tone="primary" onClick={() => (c.join_mode === 'open' && !c.questions.length ? void run('POST', `${base}/join`, {}, 'Ви в клані!', reload) : setJoining(true))}>
                                <Plus size={15} /> {c.join_mode === 'open' ? 'Вступити' : 'Подати заявку'}
                            </Button>
                        )}
                        {d.application && <span className="self-center text-sm text-amber-300">Заявка на розгляді</span>}
                        {d.me && !d.me.is_owner && (
                            <Button onClick={() => window.confirm('Вийти з клану?') && void run('POST', `${base}/leave`, {}, 'Ви вийшли з клану.', reload)}>
                                <LogOut size={15} />
                            </Button>
                        )}
                    </div>
                }
            />
            <Tabs tabs={tabs.filter((t) => t.show)} value={tab} onChange={setTab} />
            <div className="min-h-0 flex-1 overflow-y-auto p-5">
                {tab === 'overview' && (
                    <div className="space-y-4">
                        <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-3">
                            <StatTile label="Учасників" value={c.members_count} accent />
                            {has('treasury') && <StatTile label="Скарбниця" value={money(c.treasury, c.currency)} />}
                            {d.me && <StatTile label="Мій внесок" value={money(d.me.contributed, c.currency)} />}
                            <StatTile label="Створено" value={when(c.created_at, false)} />
                            <StatTile label="Вступ" value={d.join_modes[c.join_mode] ?? c.join_mode} />
                        </div>
                        <Masonry>
                            {c.description && (
                                <Card title="Про клан">
                                    <p className="text-sm whitespace-pre-wrap text-white/75">{c.description}</p>
                                </Card>
                            )}
                            {c.owner && (
                                <Card title="Лідер">
                                    <button type="button" onClick={() => c.owner?.username && nav.go(`/u/${c.owner.username}`)} className="flex items-center gap-3">
                                        <Avatar user={c.owner} size={40} />
                                        <span className="font-semibold">{c.owner.name}</span>
                                    </button>
                                </Card>
                            )}
                            {d.mvp && (
                                <Card title={`MVP місяця`}>
                                    {d.mvp.winner && <p className="mb-2 text-sm">🏆 {d.mvp.winner.user.name}</p>}
                                    {!d.mvp.winner && d.mvp.leaders.length === 0 && <p className="text-sm text-white/45">Цього місяця ще ніхто не голосував. Голосуйте за найкращого гравця в складі.</p>}
                                    {d.mvp.leaders.map((l) => (
                                        <div key={l.user.id} className="flex items-center gap-2 py-1 text-sm">
                                            <Avatar user={l.user} size={26} />
                                            <span className="flex-1">{l.user.name}</span>
                                            <span className="text-white/50">{l.votes}</span>
                                            <Button small tone={d.mvp?.my_vote === l.user.id ? 'primary' : 'ghost'} onClick={() => void run('POST', `${base}/mvp`, { user_id: l.user.id }, 'Голос зараховано.', reload)}>
                                                Голос
                                            </Button>
                                        </div>
                                    ))}
                                </Card>
                            )}
                            {d.allies.length > 0 && (
                                <Card title="Союзники">
                                    {d.allies.map((a) => (
                                        <button key={a.slug} type="button" onClick={() => nav.go(`/clans/${a.slug}`)} className="block py-1 text-sm text-neon-cyan hover:underline">
                                            {a.name}
                                        </button>
                                    ))}
                                </Card>
                            )}
                            {d.members.length > 0 && (
                                <Card title={`Склад · ${d.members.length}`} actions={<Button small onClick={() => setTab('members')}>Усі</Button>}>
                                    <div className="grid grid-cols-6 gap-2">
                                        {d.members.slice(0, 12).map((m) => (
                                            <button key={m.id} type="button" title={m.nickname ?? m.user?.name} onClick={() => m.user?.username && nav.go(`/u/${m.user.username}`)} className="flex flex-col items-center gap-1">
                                                <Avatar user={m.user} size={40} dot={m.user?.is_online ? 'online' : null} />
                                                <span className="w-full truncate text-center text-[11px] text-white/55">{m.nickname ?? m.user?.first_name}</span>
                                            </button>
                                        ))}
                                    </div>
                                </Card>
                            )}
                            {has('events') && d.me && (
                                <Card title="Найближчі заходи" actions={<Button small onClick={() => setTab('events')}>Усі</Button>}>
                                    {d.events.length === 0 ? (
                                        <Hint text="Запланованих заходів немає." action={can['events.manage'] ? 'Створити захід' : undefined} onAction={() => setTab('events')} />
                                    ) : (
                                        d.events.slice(0, 3).map((e) => (
                                            <div key={e.id} className="flex items-center gap-3 py-1.5 text-sm">
                                                <span className="w-24 shrink-0 text-white/50">{when(e.starts_at)}</span>
                                                <span className="min-w-0 flex-1 truncate">{e.title}</span>
                                                <span className="text-xs text-neon-cyan">{e.going_count} іде</span>
                                            </div>
                                        ))
                                    )}
                                </Card>
                            )}
                            {has('news') && d.me && (
                                <Card title="Новини" actions={<Button small onClick={() => setTab('news')}>Усі</Button>}>
                                    {d.news.length === 0 ? (
                                        <Hint text="Новин ще не було." action={can['news.post'] ? 'Написати новину' : undefined} onAction={() => setTab('news')} />
                                    ) : (
                                        d.news.slice(0, 2).map((n) => (
                                            <div key={n.id} className="mb-2 last:mb-0">
                                                <p className="text-sm font-semibold">{n.title}</p>
                                                <p className="line-clamp-2 text-sm text-white/60">{n.body}</p>
                                            </div>
                                        ))
                                    )}
                                </Card>
                            )}
                        </Masonry>
                        {/* Можливості клану — плитки з переходом у вкладки (замість порожнечі знизу). */}
                        <div>
                            <h3 className="mb-2 px-1 text-xs font-semibold tracking-wide text-white/45 uppercase">Можливості клану</h3>
                            <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3">
                                {Object.entries(d.features).map(([k, f]) => {
                                    const on = has(k);
                                    const target = ({ news: 'news', events: 'events', treasury: 'treasury', rating: 'rating', rules: 'rules', shifts: 'shifts' } as Record<string, TabId>)[k];
                                    return (
                                        <button
                                            key={k}
                                            type="button"
                                            disabled={!on || (!target && k !== 'chat')}
                                            onClick={() => (k === 'chat' && c.conversation_id ? nav.go(`/messages/${c.conversation_id}`) : target && setTab(target))}
                                            className={`group rounded-2xl p-4 text-left ring-1 transition ${on ? 'bg-gradient-to-br from-white/[0.05] to-white/[0.02] ring-white/[0.08] hover:ring-neon-cyan/40' : 'bg-white/[0.015] opacity-50 ring-white/[0.04]'}`}
                                        >
                                            <span className="flex items-center gap-2 text-sm font-semibold">
                                                <span className={`h-2 w-2 rounded-full ${on ? 'bg-emerald-400 shadow-[0_0_8px_#34d399]' : 'bg-white/25'}`} />
                                                {f.label}
                                            </span>
                                            <span className="mt-1 block text-xs text-white/50">{f.text}</span>
                                            {!on && can['settings.manage'] && <span className="mt-2 block text-[11px] text-white/40">Вимкнено — увімкніть у налаштуваннях</span>}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                )}
                {tab === 'talk' && <Discussions subject={{ type: 'clan', id: c.id }} />}
                {tab === 'news' && <ClanNews d={d} base={base} reload={reload} can={can} />}
                {tab === 'events' && <ClanEvents d={d} base={base} reload={reload} can={can} />}
                {tab === 'members' && <ClanMembers d={d} base={base} reload={reload} can={can} />}
                {tab === 'shifts' && <ClanShifts d={d} base={base} reload={reload} can={can} />}
                {tab === 'treasury' && <ClanTreasury d={d} base={base} reload={reload} can={can} />}
                {tab === 'rating' && (
                    <Card title="Рейтинг учасників">
                        {d.rating.map((m, i) => (
                            <div key={m.id} className="flex items-center gap-3 border-b border-white/5 py-2 text-sm last:border-0">
                                <span className={`w-6 ${i < 3 ? 'text-amber-300' : 'text-white/40'}`}>{i + 1}</span>
                                <Avatar user={m.user} size={28} />
                                <span className="flex-1">{m.nickname ?? m.user?.name}</span>
                                <span className="text-white/55">{m.events ?? 0} заходів</span>
                                <span className="w-32 text-right">{money(m.contributed, c.currency)}</span>
                            </div>
                        ))}
                    </Card>
                )}
                {tab === 'rules' && c.rules && (
                    <Card>
                        <Markdown text={c.rules} />
                    </Card>
                )}
                {tab === 'settings' && d.settings && <ClanSettings d={d} base={base} reload={reload} />}
            </div>
            {joining && (
                <JoinModal
                    questions={c.questions}
                    busy={busy}
                    onClose={() => setJoining(false)}
                    onSubmit={(body) => void run('POST', `${base}/join`, body, c.join_mode === 'open' ? 'Ви в клані!' : 'Заявку надіслано.', async () => (setJoining(false), await reload()))}
                />
            )}
        </div>
    );
}

type Sub = { d: Clan; base: string; reload: () => Promise<void>; can: Record<string, boolean> };

function JoinModal({ questions, busy, onClose, onSubmit }: { questions: string[]; busy: boolean; onClose: () => void; onSubmit: (b: Record<string, unknown>) => void }) {
    const [nickname, setNick] = useState('');
    const [note, setNote] = useState('');
    const [answers, setAnswers] = useState<string[]>(questions.map(() => ''));
    return (
        <Modal title="Заявка до клану" onClose={onClose}>
            <div className="space-y-3">
                <Field label="Нік у грі">
                    <Input value={nickname} maxLength={40} onChange={(e) => setNick(e.target.value)} />
                </Field>
                {questions.map((q, i) => (
                    <Field key={i} label={q}>
                        <Input value={answers[i]} maxLength={300} onChange={(e) => setAnswers((a) => a.map((x, j) => (j === i ? e.target.value : x)))} />
                    </Field>
                ))}
                <Field label="Про себе">
                    <TextArea value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} />
                </Field>
                <div className="flex justify-end gap-2">
                    <Button onClick={onClose}>Скасувати</Button>
                    <Button tone="primary" disabled={busy} onClick={() => onSubmit({ nickname: nickname || null, note: note || null, answers })}>
                        Надіслати
                    </Button>
                </div>
            </div>
        </Modal>
    );
}

function ClanNews({ d, base, reload, can }: Sub) {
    const { run, busy } = useAction();
    const [f, setF] = useState({ title: '', body: '', is_pinned: false });
    return (
        <div className="mx-auto max-w-3xl space-y-4">
            {can['news.post'] && (
                <Card title="Нова новина">
                    <div className="space-y-2">
                        <Input value={f.title} maxLength={120} placeholder="Заголовок" onChange={(e) => setF({ ...f, title: e.target.value })} />
                        <TextArea value={f.body} rows={4} maxLength={5000} placeholder="Текст" onChange={(e) => setF({ ...f, body: e.target.value })} />
                        <div className="flex items-center gap-3">
                            <label className="flex items-center gap-2 text-sm">
                                <input type="checkbox" className="accent-[#22d3ee]" checked={f.is_pinned} onChange={(e) => setF({ ...f, is_pinned: e.target.checked })} /> Закріпити
                            </label>
                            <div className="flex-1" />
                            <Button tone="primary" disabled={busy || !f.title || !f.body} onClick={() => void run('POST', `${base}/news`, f, 'Опубліковано.', async () => (setF({ title: '', body: '', is_pinned: false }), await reload()))}>
                                Опублікувати
                            </Button>
                        </div>
                    </div>
                </Card>
            )}
            {d.news.length === 0 && <p className="py-8 text-center text-sm text-white/45">Новин поки немає.</p>}
            {d.news.map((n) => (
                <Card
                    key={n.id}
                    title={`${n.is_pinned ? '📌 ' : ''}${n.title}`}
                    actions={
                        (n.mine || can['news.post']) && (
                            <Button small tone="danger" onClick={() => window.confirm('Видалити новину?') && void run('DELETE', `${base}/news/${n.id}`, undefined, 'Видалено.', reload)}>
                                Видалити
                            </Button>
                        )
                    }
                >
                    <p className="text-sm whitespace-pre-wrap text-white/80">{n.body}</p>
                    <p className="mt-2 text-xs text-white/40">
                        {n.user?.name} · {when(n.created_at)}
                    </p>
                </Card>
            ))}
        </div>
    );
}

function ClanEvents({ d, base, reload, can }: Sub) {
    const { run, busy } = useAction();
    const [f, setF] = useState({ title: '', description: '', starts_at: '', weekly: false });
    return (
        <div className="space-y-4">
            {can['events.manage'] && (
                <Card title="Новий захід">
                    <div className="grid grid-cols-[1fr_220px_auto_auto] items-center gap-2">
                        <Input value={f.title} maxLength={120} placeholder="Назва (рейд, турнір…)" onChange={(e) => setF({ ...f, title: e.target.value })} />
                        <Input type="datetime-local" value={f.starts_at} onChange={(e) => setF({ ...f, starts_at: e.target.value })} />
                        <label className="flex items-center gap-1.5 text-sm">
                            <input type="checkbox" className="accent-[#22d3ee]" checked={f.weekly} onChange={(e) => setF({ ...f, weekly: e.target.checked })} /> Щотижня
                        </label>
                        <Button tone="primary" disabled={busy || !f.title || !f.starts_at} onClick={() => void run('POST', `${base}/events`, { ...f, starts_at: new Date(f.starts_at).toISOString(), description: f.description || null }, 'Захід створено.', reload)}>
                            Створити
                        </Button>
                    </div>
                    <TextArea className="mt-2" value={f.description} maxLength={1000} placeholder="Опис (необовʼязково)" onChange={(e) => setF({ ...f, description: e.target.value })} />
                </Card>
            )}
            {d.events.length === 0 && <p className="py-8 text-center text-sm text-white/45">Заходів не заплановано.</p>}
            <div className="grid grid-cols-[repeat(auto-fill,minmax(320px,1fr))] gap-3">
                {d.events.map((e) => (
                    <Card key={e.id}>
                        {e.cover_url && <img src={e.cover_url} alt="" className="mb-3 h-32 w-full rounded-xl object-cover" />}
                        <p className="font-semibold">{e.title}</p>
                        <p className="text-sm text-white/55">
                            {when(e.starts_at)}
                            {e.repeat ? ' · щотижня' : ''} · іде {e.going_count}
                        </p>
                        {e.description && <p className="mt-1 text-sm text-white/65">{e.description}</p>}
                        <div className="mt-3 flex gap-2">
                            <Button small tone={e.going ? 'ok' : 'primary'} onClick={() => void run('POST', `${base}/events/${e.id}/rsvp`, {}, undefined, reload)}>
                                {e.going ? '✓ Іду' : 'Іду'}
                            </Button>
                            {can['events.manage'] && (
                                <Button small tone="danger" onClick={() => window.confirm('Видалити захід?') && void run('DELETE', `${base}/events/${e.id}`, undefined, 'Видалено.', reload)}>
                                    Видалити
                                </Button>
                            )}
                        </div>
                    </Card>
                ))}
            </div>
        </div>
    );
}

function ClanMembers({ d, base, reload, can }: Sub) {
    const { run, busy } = useAction();
    const nav = useNav();
    const titles = d.clan.rank_titles;
    const act = (m: Member, action: string, extra: Record<string, unknown> = {}, ok = 'Готово.'): void => void run('POST', `${base}/members/${m.id}`, { action, ...extra }, ok, reload);
    return (
        <div className="space-y-4">
            {can['members.manage'] && d.applications.length > 0 && (
                <Card title={`Заявки (${d.applications.length})`}>
                    {d.applications.map((a) => (
                        <div key={a.id} className="flex items-start gap-3 border-b border-white/5 py-2.5 last:border-0">
                            <Avatar user={a.user} size={34} />
                            <div className="min-w-0 flex-1 text-sm">
                                <b>{a.nickname ?? a.user?.name}</b>
                                {a.note && <p className="text-white/60">{a.note}</p>}
                                {a.answers?.map((x, i) => (
                                    <p key={i} className="text-xs text-white/50">
                                        <b className="text-white/70">{d.clan.questions[i]}</b> {x}
                                    </p>
                                ))}
                            </div>
                            <Button small tone="ok" disabled={busy} onClick={() => act(a, 'accept', {}, 'Прийнято.')}>
                                Прийняти
                            </Button>
                            <Button small tone="danger" disabled={busy} onClick={() => act(a, 'decline', {}, 'Відхилено.')}>
                                Відхилити
                            </Button>
                        </div>
                    ))}
                </Card>
            )}
            <Card title={`Учасники (${d.members.length})`}>
                {d.members.map((m) => (
                    <div key={m.id} className="flex items-center gap-3 border-b border-white/5 py-2 text-sm last:border-0">
                        <button type="button" onClick={() => m.user?.username && nav.go(`/u/${m.user.username}`)}>
                            <Avatar user={m.user} size={34} dot={m.user?.is_online ? 'online' : null} />
                        </button>
                        <span className="min-w-0 flex-1">
                            <span className="block truncate font-medium">
                                {m.nickname ?? m.user?.name} {m.is_owner && <span className="text-amber-300">★</span>}
                                {m.away && <span className="ml-1 text-xs text-white/35">давно не заходив</span>}
                            </span>
                            <span className="text-xs text-white/45">
                                {m.rank} · {m.rank_title}
                            </span>
                        </span>
                        <span className="w-32 text-right text-white/55">{money(m.contributed, d.clan.currency)}</span>
                        {can['members.manage'] && !m.is_owner && m.id !== d.me?.id && (
                            <>
                                <Select value={m.rank} onChange={(e) => act(m, 'rank', { rank: Number(e.target.value) }, 'Ранг змінено.')} className="!h-8 !w-40 !py-0 text-[13px]">
                                    {[4, 3, 2, 1].map((r) => (
                                        <option key={r} value={r}>
                                            {r} · {titles[r]}
                                        </option>
                                    ))}
                                </Select>
                                <Button small tone="danger" onClick={() => window.confirm(`Виключити ${m.nickname ?? m.user?.name}?`) && act(m, 'kick', {}, 'Виключено.')}>
                                    Виключити
                                </Button>
                                {can.owner && (
                                    <Button small onClick={() => window.confirm('Передати клан цьому учаснику?') && act(m, 'transfer', {}, 'Клан передано.')}>
                                        Передати
                                    </Button>
                                )}
                            </>
                        )}
                    </div>
                ))}
            </Card>
        </div>
    );
}

function ClanShifts({ d, base, reload, can }: Sub) {
    const { run, busy } = useAction();
    const [f, setF] = useState({ title: '', starts_at: '', hours: '2', user_id: '', repeat_weeks: '' });
    return (
        <div className="space-y-4">
            {can['shifts.manage'] && (
                <Card title="Нова зміна">
                    <div className="grid grid-cols-[1fr_210px_90px_200px_auto] items-center gap-2">
                        <Input value={f.title} placeholder="Назва" onChange={(e) => setF({ ...f, title: e.target.value })} />
                        <Input type="datetime-local" value={f.starts_at} onChange={(e) => setF({ ...f, starts_at: e.target.value })} />
                        <Input type="number" min={0.5} max={24} step={0.5} value={f.hours} onChange={(e) => setF({ ...f, hours: e.target.value })} title="Годин" />
                        <Select value={f.user_id} onChange={(e) => setF({ ...f, user_id: e.target.value })}>
                            <option value="">Вільна</option>
                            {d.members.map((m) => (
                                <option key={m.id} value={m.user?.id}>
                                    {m.nickname ?? m.user?.name}
                                </option>
                            ))}
                        </Select>
                        <Button tone="primary" disabled={busy || !f.title || !f.starts_at} onClick={() => void run('POST', `${base}/shifts`, { title: f.title, starts_at: new Date(f.starts_at).toISOString(), hours: Number(f.hours), user_id: f.user_id ? Number(f.user_id) : null }, 'Зміну створено.', reload)}>
                            Створити
                        </Button>
                    </div>
                </Card>
            )}
            {d.shifts.length === 0 && <p className="py-8 text-center text-sm text-white/45">Змін на найближчі два тижні немає.</p>}
            {d.shifts.map((s) => (
                <div key={s.id} className="flex items-center gap-3 rounded-2xl bg-white/[0.035] px-4 py-3 text-sm ring-1 ring-white/[0.07]">
                    <span className="w-40 text-white/60">
                        {when(s.starts_at)} — {new Date(s.ends_at).toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <span className="flex-1 font-medium">{s.title}</span>
                    <span className="text-white/60">{s.user?.name ?? 'вільна'}</span>
                    {!s.user && (
                        <Button small tone="ok" onClick={() => void run('POST', `${base}/shifts/${s.id}`, { action: 'claim' }, 'Зміна ваша.', reload)}>
                            Взяти
                        </Button>
                    )}
                    {s.mine && (
                        <Button small onClick={() => void run('POST', `${base}/shifts/${s.id}`, { action: 'release' }, 'Звільнено.', reload)}>
                            Звільнити
                        </Button>
                    )}
                    {can['shifts.manage'] && (
                        <Button small tone="danger" onClick={() => void run('POST', `${base}/shifts/${s.id}`, { action: 'delete' }, 'Видалено.', reload)}>
                            Видалити
                        </Button>
                    )}
                </div>
            ))}
        </div>
    );
}

function ClanTreasury({ d, base, reload, can }: Sub) {
    const { run, busy } = useAction();
    const cur = d.clan.currency;
    const [give, setGive] = useState({ amount: '', comment: '' });
    const [spend, setSpend] = useState({ amount: '', comment: '' });
    return (
        <div className="space-y-4">
            <div className="grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))] gap-3">
                <StatTile label="У скарбниці" value={money(d.clan.treasury, cur)} accent />
                <StatTile label="Мій внесок" value={money(d.me?.contributed, cur)} />
            </div>
            <Masonry>
                <Card title="Зробити внесок">
                    <div className="space-y-2">
                        <Input type="number" min={1} placeholder={`Сума, ${cur}`} value={give.amount} onChange={(e) => setGive({ ...give, amount: e.target.value })} />
                        <Input placeholder="Коментар" maxLength={200} value={give.comment} onChange={(e) => setGive({ ...give, comment: e.target.value })} />
                        <Button tone="primary" disabled={busy || !give.amount} onClick={() => void run('POST', `${base}/contributions`, { amount: Number(give.amount), comment: give.comment || null }, 'Внесок надіслано на підтвердження.', async () => (setGive({ amount: '', comment: '' }), await reload()))}>
                            Внести
                        </Button>
                    </div>
                </Card>
                {can['treasury.manage'] && (
                    <Card title="Витрата зі скарбниці">
                        <div className="space-y-2">
                            <Input type="number" min={1} placeholder={`Сума, ${cur}`} value={spend.amount} onChange={(e) => setSpend({ ...spend, amount: e.target.value })} />
                            <Input placeholder="На що (обовʼязково)" maxLength={200} value={spend.comment} onChange={(e) => setSpend({ ...spend, comment: e.target.value })} />
                            <Button tone="danger" disabled={busy || !spend.amount || !spend.comment} onClick={() => void run('POST', `${base}/spend`, { amount: Number(spend.amount), comment: spend.comment }, 'Витрату записано.', async () => (setSpend({ amount: '', comment: '' }), await reload()))}>
                                Списати
                            </Button>
                        </div>
                    </Card>
                )}
            </Masonry>
            <Card title="Рух скарбниці">
                {d.contributions.length === 0 && <p className="text-sm text-white/45">Поки порожньо.</p>}
                {d.contributions.map((x) => (
                    <div key={x.id} className="flex items-center gap-3 border-b border-white/5 py-2 text-sm last:border-0">
                        <span className="w-28 text-white/40">{when(x.created_at)}</span>
                        <span className="flex-1">
                            {x.user?.name}
                            {x.comment ? ` · ${x.comment}` : ''}
                        </span>
                        <span className={x.amount >= 0 ? 'text-emerald-300' : 'text-rose-300'}>{money(x.amount, cur)}</span>
                        <span className="w-24 text-right text-xs text-white/45">{x.status === 'pending' ? 'чекає' : x.status === 'approved' ? 'зараховано' : x.status}</span>
                        {can['treasury.manage'] && x.status === 'pending' && (
                            <>
                                <Button small tone="ok" onClick={() => void run('POST', `${base}/contributions/${x.id}`, { approve: true }, 'Зараховано.', reload)}>
                                    ✓
                                </Button>
                                <Button small tone="danger" onClick={() => void run('POST', `${base}/contributions/${x.id}`, { approve: false }, 'Відхилено.', reload)}>
                                    ✕
                                </Button>
                            </>
                        )}
                    </div>
                ))}
            </Card>
        </div>
    );
}

function ClanSettings({ d, base, reload }: { d: Clan; base: string; reload: () => Promise<void> }) {
    const { run, busy } = useAction();
    const s0 = d.settings!;
    const [s, setS] = useState({ ...s0, questions: [...s0.questions, '', '', ''].slice(0, 3) });
    const [features, setFeatures] = useState<string[]>(d.clan.features);
    const [titles, setTitles] = useState<Record<string, string>>(d.clan.rank_titles);
    const [matrix, setMatrix] = useState<Record<string, number[]>>(d.permissions?.matrix ?? {});
    return (
        <div className="space-y-4">
            <Masonry min={360}>
                <Card title="Профіль">
                    <div className="space-y-2">
                        <div className="grid grid-cols-[1fr_120px] gap-2">
                            <Input value={s.name} maxLength={60} onChange={(e) => setS({ ...s, name: e.target.value })} />
                            <Input value={s.tag} maxLength={6} onChange={(e) => setS({ ...s, tag: e.target.value })} />
                        </div>
                        <TextArea value={s.description ?? ''} maxLength={1000} placeholder="Опис" onChange={(e) => setS({ ...s, description: e.target.value })} />
                        <Field label="Вступ">
                            <Select value={s.join_mode} onChange={(e) => setS({ ...s, join_mode: e.target.value })}>
                                {Object.entries(d.join_modes).map(([k, v]) => (
                                    <option key={k} value={k}>
                                        {v}
                                    </option>
                                ))}
                            </Select>
                        </Field>
                        <label className="flex items-center gap-2 text-sm">
                            <input type="checkbox" className="accent-[#22d3ee]" checked={s.is_recruiting} onChange={(e) => setS({ ...s, is_recruiting: e.target.checked })} /> Відкритий набір
                        </label>
                        <Field label="Валюта скарбниці">
                            <Input value={s.currency} maxLength={24} onChange={(e) => setS({ ...s, currency: e.target.value })} />
                        </Field>
                        <Field label="Питання до заявки (до 3)">
                            {s.questions.map((q, i) => (
                                <Input key={i} className="mb-1.5" value={q} maxLength={80} onChange={(e) => setS({ ...s, questions: s.questions.map((x, j) => (j === i ? e.target.value : x)) })} />
                            ))}
                        </Field>
                    </div>
                </Card>
                <Card title="Функції">
                    {Object.entries(d.features).map(([k, v]) => (
                        <label key={k} className="flex items-start gap-2 py-1 text-sm">
                            <input type="checkbox" className="mt-1 accent-[#22d3ee]" checked={features.includes(k)} onChange={(e) => setFeatures((f) => (e.target.checked ? [...f, k] : f.filter((x) => x !== k)))} />
                            <span>
                                {v.label}
                                <span className="block text-xs text-white/45">{v.text}</span>
                            </span>
                        </label>
                    ))}
                </Card>
                <Card title="Ранги">
                    {[1, 2, 3, 4, 5].map((r) => (
                        <div key={r} className="mb-1.5 flex items-center gap-2 text-sm">
                            <span className="w-5 text-white/45">{r}</span>
                            <Input value={titles[r] ?? ''} maxLength={24} onChange={(e) => setTitles({ ...titles, [r]: e.target.value })} />
                        </div>
                    ))}
                </Card>
                {d.permissions && (
                    <Card title="Права рангів">
                        {Object.entries(d.permissions.labels).map(([k, label]) => (
                            <div key={k} className="flex items-center gap-2 py-1 text-sm">
                                <span className="flex-1 text-white/75">{label}</span>
                                {[1, 2, 3, 4].map((r) => (
                                    <label key={r} className="flex items-center gap-0.5 text-xs text-white/45">
                                        <input type="checkbox" className="accent-[#22d3ee]" checked={(matrix[k] ?? []).includes(r)} onChange={(e) => setMatrix((m) => ({ ...m, [k]: e.target.checked ? [...(m[k] ?? []), r] : (m[k] ?? []).filter((x) => x !== r) }))} />
                                        {r}
                                    </label>
                                ))}
                            </div>
                        ))}
                    </Card>
                )}
                <Card title="Правила (Markdown)">
                    <TextArea rows={10} value={s.rules ?? ''} maxLength={10000} onChange={(e) => setS({ ...s, rules: e.target.value })} />
                </Card>
            </Masonry>
            <div className="flex justify-end gap-2">
                <Button tone="danger" onClick={() => window.confirm('Видалити клан назавжди?') && void run('DELETE', base, undefined, 'Клан видалено.')}>
                    Видалити клан
                </Button>
                <Button
                    tone="primary"
                    disabled={busy}
                    onClick={() => void run('POST', `${base}/settings`, { ...s, questions: s.questions.filter((q) => q.trim()), features, rank_titles: titles, permissions: matrix }, 'Налаштування збережено.', reload)}
                >
                    Зберегти
                </Button>
            </div>
        </div>
    );
}

/** Порожній стан з підказкою й дією (замість порожнього місця). */
function Hint({ text, action, onAction }: { text: string; action?: string; onAction?: () => void }) {
    return (
        <div className="flex items-center gap-3 rounded-xl bg-white/[0.03] px-3 py-3 text-sm text-white/50">
            <span className="flex-1">{text}</span>
            {action && (
                <Button small tone="primary" onClick={onAction}>
                    {action}
                </Button>
            )}
        </div>
    );
}
