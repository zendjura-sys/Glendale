import { LogOut, Plus, Search, UsersRound } from 'lucide-react';
import { useState } from 'react';
import { Button, Card, Field, Input, Loading, Masonry, PageHeader, Select, StatTile, Tabs, TextArea, useAction, useSite, when } from '@/components/kit';
import { Composer, type Post, PostCard } from '@/components/Post';
import { Avatar } from '@/components/ui';
import { type User, useLive } from '@/lib/api';
import { useNav } from '@/lib/nav';
import { Markdown } from '@/pages/family/Info';

const ROLE: Record<string, string> = { owner: 'власник', admin: 'адмін', editor: 'редактор', member: 'учасник' };

type CommunityCard = { id: number; slug: string; name: string; type: string; privacy: string; category_label: string; avatar_url: string | null; cover_url: string | null; members_count: number; is_verified: boolean; membership?: { status: string; role: string } | null; managed?: boolean };
type ListPage = { tab: string; counts: { mine: number; managed: number }; communities: { data: CommunityCard[] } };

/** «Спільноти»: мої, якими керую, і пошук нових за назвою й категорією. */
export function CommunitiesList() {
    const nav = useNav();
    const [tab, setTab] = useState<'mine' | 'managed' | 'discover'>('mine');
    const [q, setQ] = useState('');
    const [query, setQuery] = useState('');
    const { data, error } = useLive<ListPage>(`/api/v1/communities?tab=${tab}&q=${encodeURIComponent(query)}`, 120_000);
    return (
        <div className="flex h-full flex-col">
            <PageHeader
                title="Спільноти"
                subtitle="Групи й паблики за інтересами"
                actions={
                    <form onSubmit={(e) => (e.preventDefault(), setQuery(q.trim()), setTab('discover'))} className="relative">
                        <Search size={15} className="absolute top-3 left-3 text-white/40" />
                        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Знайти спільноту" className="!w-64 pl-9" />
                    </form>
                }
            />
            <Tabs
                tabs={[
                    { id: 'mine', label: 'Мої', badge: data?.counts.mine },
                    { id: 'managed', label: 'Керую', badge: data?.counts.managed },
                    { id: 'discover', label: 'Знайти' },
                ]}
                value={tab}
                onChange={setTab}
            />
            <div className="min-h-0 flex-1 overflow-y-auto p-5">
                {!data && <Loading error={error} />}
                {data?.communities.data.length === 0 && <p className="py-12 text-center text-sm text-white/45">Тут поки порожньо.</p>}
                <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-3">
                    {data?.communities.data.map((c) => (
                        <button key={c.id} type="button" onClick={() => nav.go(`/c/${c.slug}`)} className="overflow-hidden rounded-2xl bg-white/[0.035] text-left ring-1 ring-white/[0.07] transition hover:bg-white/[0.06]">
                            <div className="h-20 bg-gradient-to-br from-neon-blue/25 to-neon-violet/25">{c.cover_url && <img src={c.cover_url} alt="" className="h-full w-full object-cover" />}</div>
                            <div className="-mt-7 flex items-end gap-3 px-3.5 pb-3.5">
                                <span className="rounded-full ring-4 ring-[#12151f]">
                                    <Avatar user={{ name: c.name, avatar_url: c.avatar_url }} size={52} />
                                </span>
                                <span className="min-w-0 flex-1 pt-8">
                                    <span className="block truncate font-semibold">
                                        {c.name} {c.is_verified && <span className="text-neon-cyan">✓</span>}
                                    </span>
                                    <span className="block truncate text-xs text-white/50">
                                        {c.category_label} · {c.members_count} учасників
                                    </span>
                                </span>
                            </div>
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}

type Community = {
    community: CommunityCard & { description: string | null; website: string | null; city: string | null; wall: string; status: string | null; join_questions: string[]; rules_accept: boolean; rules_text: string | null; created_at: string };
    rules: { rules: string | null; handbook: string | null; premoderation: boolean; slow_mode: number | null };
    membership: { status: string; role: string } | null;
    can: { view: boolean; post: boolean; post_as_community: boolean; manage: boolean; moderate: boolean };
    stats: { members: number; posts: number; friends: number; requests: number };
    members: User[];
    managers: (User & { role: string })[];
    posts: { data: Post[] };
    queue: Post[];
};
type TabId = 'posts' | 'members' | 'events' | 'wiki' | 'rules' | 'settings';

/** Спільнота повністю: записи (і від імені спільноти), учасники й заявки, події, вікі, правила, налаштування; вступ і вихід. */
export function CommunityPage({ slug }: { slug: string }) {
    const nav = useNav();
    const page = useSite<Community>(`/c/${slug}`);
    const { run } = useAction();
    const [tab, setTab] = useState<TabId>('posts');
    const [asCommunity, setAs] = useState(false);
    if (!page.data) return <Loading error={page.error} />;
    const d = page.data;
    const c = d.community;
    const member = d.membership?.status === 'active';
    const join = async (): Promise<void> => {
        if (c.rules_accept && c.rules_text && !window.confirm(`Правила спільноти:\n\n${c.rules_text}\n\nПриймаєте?`)) return;
        let answers: string[] | undefined;
        if (c.join_questions?.length) answers = c.join_questions.map((q) => window.prompt(q) ?? '');
        await run('POST', `/api/v1/communities/${c.slug}/join`, answers ? { answers } : {}, c.privacy === 'closed' ? 'Заявку надіслано.' : 'Ви в спільноті!', page.reload);
    };
    const tabs: { id: TabId; label: string; badge?: number; show: boolean }[] = [
        { id: 'posts', label: 'Записи', show: true },
        { id: 'members', label: 'Учасники', badge: d.stats.requests, show: d.can.view },
        { id: 'events', label: 'Події', show: d.can.view },
        { id: 'wiki', label: 'Вікі', show: d.can.view },
        { id: 'rules', label: 'Правила', show: !!(d.rules.rules || d.rules.handbook) },
        { id: 'settings', label: 'Налаштування', show: d.can.manage },
    ];
    return (
        <div className="flex h-full flex-col">
            <PageHeader
                title={
                    <span>
                        {c.name} {c.is_verified && <span className="text-neon-cyan">✓</span>}
                    </span>
                }
                subtitle={[c.category_label, `${d.stats.members} учасників`, c.privacy === 'closed' ? 'закрита' : null, d.membership?.role && d.membership.role !== 'member' ? (ROLE[d.membership.role] ?? d.membership.role) : null].filter(Boolean).join(' · ')}
                image={c.avatar_url ? <Avatar user={{ name: c.name, avatar_url: c.avatar_url }} size={42} /> : <span className="grid h-10 w-10 place-items-center rounded-xl bg-neon-violet/20"><UsersRound size={18} /></span>}
                actions={
                    member ? (
                        d.membership?.role !== 'owner' && (
                            <Button onClick={() => window.confirm('Вийти зі спільноти?') && void run('DELETE', `/api/v1/communities/${c.slug}/join`, undefined, 'Ви вийшли.', page.reload)}>
                                <LogOut size={15} /> Вийти
                            </Button>
                        )
                    ) : d.membership?.status === 'pending' ? (
                        <span className="text-sm text-amber-300">Заявка на розгляді</span>
                    ) : (
                        <Button tone="primary" onClick={() => void join()}>
                            <Plus size={15} /> Вступити
                        </Button>
                    )
                }
            />
            <Tabs tabs={tabs.filter((t) => t.show)} value={tab} onChange={setTab} />
            <div className="min-h-0 flex-1 overflow-y-auto p-5">
                {tab === 'posts' && (
                    <div className="mx-auto grid max-w-[1180px] grid-cols-[minmax(0,1fr)_300px] gap-5 max-[1100px]:grid-cols-1">
                        <div className="space-y-4">
                            {d.can.post && (
                                <div>
                                    {d.can.post_as_community && (
                                        <label className="mb-2 flex items-center gap-2 text-sm text-white/70">
                                            <input type="checkbox" className="accent-[#22d3ee]" checked={asCommunity} onChange={(e) => setAs(e.target.checked)} /> Від імені спільноти
                                        </label>
                                    )}
                                    <Composer community={c.slug} asCommunity={asCommunity} onPosted={() => void page.reload()} placeholder={d.rules.premoderation ? 'Запропонувати запис (після перевірки)' : 'Написати у спільноту'} />
                                </div>
                            )}
                            {d.can.moderate && d.queue.length > 0 && (
                                <Card title={`На перевірці (${d.queue.length})`}>
                                    <div className="space-y-3">
                                        {d.queue.map((p) => (
                                            <div key={p.id}>
                                                <PostCard post={p} />
                                                <div className="mt-2 flex gap-2">
                                                    <Button small tone="ok" onClick={() => void run('POST', `/c/${c.slug}/queue/${p.id}`, {}, 'Опубліковано.', page.reload)}>
                                                        Опублікувати
                                                    </Button>
                                                    <Button small tone="danger" onClick={() => void run('DELETE', `/c/${c.slug}/queue/${p.id}`, undefined, 'Відхилено.', page.reload)}>
                                                        Відхилити
                                                    </Button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </Card>
                            )}
                            {!d.can.view && <p className="py-10 text-center text-sm text-white/45">Закрита спільнота — записи бачать лише учасники.</p>}
                            {d.posts.data.map((p) => (
                                <PostCard key={p.id} post={p} onDeleted={() => void page.reload()} />
                            ))}
                        </div>
                        <aside className="space-y-4 max-[1100px]:hidden">
                            <Card title="Про спільноту">
                                {c.status && <p className="mb-2 text-sm text-white/80">{c.status}</p>}
                                {c.description && <p className="text-sm whitespace-pre-wrap text-white/60">{c.description}</p>}
                                <div className="mt-3 grid grid-cols-2 gap-2">
                                    <StatTile label="Учасників" value={d.stats.members} />
                                    <StatTile label="Записів" value={d.stats.posts} />
                                    {d.stats.friends > 0 && <StatTile label="Друзів тут" value={d.stats.friends} />}
                                </div>
                                {c.city && <p className="mt-2 text-xs text-white/45">📍 {c.city}</p>}
                            </Card>
                            {d.managers.length > 0 && (
                                <Card title="Керують">
                                    {d.managers.map((m) => (
                                        <button key={m.id} type="button" onClick={() => m.username && nav.go(`/u/${m.username}`)} className="flex w-full items-center gap-2.5 rounded-xl px-1 py-1.5 text-left hover:bg-white/5">
                                            <Avatar user={m} size={30} />
                                            <span className="flex-1 truncate text-sm">{m.name}</span>
                                            <span className="text-[11px] text-white/40">{ROLE[m.role] ?? m.role}</span>
                                        </button>
                                    ))}
                                </Card>
                            )}
                            {d.members.length > 0 && (
                                <Card title="Учасники">
                                    <div className="flex flex-wrap gap-1.5">
                                        {d.members.slice(0, 18).map((m) => (
                                            <button key={m.id} type="button" title={m.name} onClick={() => m.username && nav.go(`/u/${m.username}`)}>
                                                <Avatar user={m} size={34} />
                                            </button>
                                        ))}
                                    </div>
                                </Card>
                            )}
                        </aside>
                    </div>
                )}
                {tab === 'members' && <CommunityMembers slug={slug} manage={d.can.manage} />}
                {tab === 'events' && <CommunityEvents slug={slug} />}
                {tab === 'wiki' && <CommunityWiki slug={slug} />}
                {tab === 'rules' && (
                    <Masonry min={420}>
                        {d.rules.rules && (
                            <Card title="Правила">
                                <Markdown text={d.rules.rules} />
                            </Card>
                        )}
                        {d.rules.handbook && (
                            <Card title="Довідник">
                                <Markdown text={d.rules.handbook} />
                            </Card>
                        )}
                    </Masonry>
                )}
                {tab === 'settings' && <CommunitySettings d={d} reload={page.reload} />}
            </div>
        </div>
    );
}

type MembersPage = { tab: string; counts: { all: number; managers: number; friends: number; requests: number }; members: { data: (User & { role: string; joined_at: string; answers?: string[] | null; is_friend?: boolean })[] } };

function CommunityMembers({ slug, manage }: { slug: string; manage: boolean }) {
    const nav = useNav();
    const { run } = useAction();
    const [tab, setTab] = useState('all');
    const page = useSite<MembersPage>(`/c/${slug}/members?tab=${tab}`);
    if (!page.data) return <Loading error={page.error} />;
    const d = page.data;
    return (
        <div className="space-y-3">
            <div className="flex gap-1.5">
                {[
                    ['all', `Усі · ${d.counts.all}`],
                    ['managers', `Керівники · ${d.counts.managers}`],
                    ['friends', `Друзі · ${d.counts.friends}`],
                    ...(manage ? [['requests', `Заявки · ${d.counts.requests}`]] : []),
                ].map(([k, v]) => (
                    <Button key={k} small tone={tab === k ? 'primary' : 'ghost'} onClick={() => setTab(k)}>
                        {v}
                    </Button>
                ))}
            </div>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-3">
                {d.members.data.map((m) => (
                    <div key={m.id} className="flex items-center gap-3 rounded-2xl bg-white/[0.035] p-3 ring-1 ring-white/[0.07]">
                        <button type="button" onClick={() => m.username && nav.go(`/u/${m.username}`)}>
                            <Avatar user={m} size={42} dot={m.is_online ? 'online' : null} />
                        </button>
                        <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-semibold">{m.name}</span>
                            <span className="block truncate text-xs text-white/45">
                                {ROLE[m.role] ?? m.role} · з {when(m.joined_at, false)}
                            </span>
                            {m.answers?.map((a, i) => (
                                <span key={i} className="block truncate text-[11px] text-white/50">
                                    {a}
                                </span>
                            ))}
                        </span>
                        {manage && tab === 'requests' ? (
                            <>
                                <Button small tone="ok" onClick={() => void run('POST', `/c/${slug}/members/${m.username}/approve`, {}, 'Прийнято.', page.reload)}>
                                    ✓
                                </Button>
                                <Button small tone="danger" onClick={() => void run('DELETE', `/c/${slug}/members/${m.username}/request`, undefined, 'Відхилено.', page.reload)}>
                                    ✕
                                </Button>
                            </>
                        ) : (
                            manage &&
                            m.role !== 'owner' && (
                                <>
                                    <Select value={m.role} onChange={(e) => void run('PATCH', `/c/${slug}/members/${m.username}`, { role: e.target.value }, 'Роль змінено.', page.reload)} className="!h-8 !w-28 !py-0 text-[13px]">
                                        <option value="member">учасник</option>
                                        <option value="editor">редактор</option>
                                        <option value="admin">адмін</option>
                                    </Select>
                                    <Button small tone="danger" onClick={() => window.confirm(`Виключити ${m.name}?`) && void run('DELETE', `/c/${slug}/members/${m.username}`, undefined, 'Виключено.', page.reload)}>
                                        ✕
                                    </Button>
                                </>
                            )
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}

type CalendarPage = { upcoming: { id: number; title: string; description: string | null; place: string | null; starts_at: string; ends_at: string | null; going: number; my: string | null }[]; can: { manage: boolean; member: boolean } };

function CommunityEvents({ slug }: { slug: string }) {
    const page = useSite<CalendarPage>(`/c/${slug}/calendar`);
    const { run, busy } = useAction();
    const [f, setF] = useState({ title: '', place: '', starts_at: '', description: '' });
    if (!page.data) return <Loading error={page.error} />;
    const d = page.data;
    return (
        <div className="space-y-4">
            {d.can.manage && (
                <Card title="Нова подія">
                    <div className="grid grid-cols-[1fr_200px_220px_auto] gap-2">
                        <Input value={f.title} placeholder="Назва" maxLength={120} onChange={(e) => setF({ ...f, title: e.target.value })} />
                        <Input value={f.place} placeholder="Місце / посилання" maxLength={120} onChange={(e) => setF({ ...f, place: e.target.value })} />
                        <Input type="datetime-local" value={f.starts_at} onChange={(e) => setF({ ...f, starts_at: e.target.value })} />
                        <Button tone="primary" disabled={busy || f.title.length < 3 || !f.starts_at} onClick={() => void run('POST', `/c/${slug}/events`, { ...f, starts_at: new Date(f.starts_at).toISOString(), place: f.place || null, description: f.description || null }, 'Подію створено.', page.reload)}>
                            Створити
                        </Button>
                    </div>
                    <TextArea className="mt-2" value={f.description} placeholder="Опис" maxLength={2000} onChange={(e) => setF({ ...f, description: e.target.value })} />
                </Card>
            )}
            {d.upcoming.length === 0 && <p className="py-8 text-center text-sm text-white/45">Найближчих подій немає.</p>}
            <div className="grid grid-cols-[repeat(auto-fill,minmax(320px,1fr))] gap-3">
                {d.upcoming.map((e) => (
                    <Card key={e.id}>
                        <p className="font-semibold">{e.title}</p>
                        <p className="text-sm text-white/55">
                            {when(e.starts_at)}
                            {e.place ? ` · ${e.place}` : ''} · йдуть {e.going}
                        </p>
                        {e.description && <p className="mt-1 text-sm text-white/65">{e.description}</p>}
                        {d.can.member && (
                            <div className="mt-3 flex gap-1.5">
                                {(['going', 'maybe', 'none'] as const).map((st) => (
                                    <Button key={st} small tone={e.my === st ? 'primary' : 'ghost'} onClick={() => void run('POST', `/c/${slug}/events/${e.id}/rsvp`, { status: st }, undefined, page.reload)}>
                                        {st === 'going' ? 'Іду' : st === 'maybe' ? 'Можливо' : 'Не піду'}
                                    </Button>
                                ))}
                            </div>
                        )}
                    </Card>
                ))}
            </div>
        </div>
    );
}

type WikiPage = { pages: { slug: string; title: string }[]; page: { slug: string; title: string; body: string | null } | null; can_edit: boolean };

function CommunityWiki({ slug }: { slug: string }) {
    const [current, setCurrent] = useState<string | null>(null);
    const page = useSite<WikiPage>(`/c/${slug}/wiki${current ? `/${current}` : ''}`);
    const { run, busy } = useAction();
    const [edit, setEdit] = useState<{ slug: string | null; title: string; body: string } | null>(null);
    if (!page.data) return <Loading error={page.error} />;
    const d = page.data;
    return (
        <div className="grid grid-cols-[240px_1fr] gap-4">
            <Card title="Сторінки" actions={d.can_edit && <Button small onClick={() => setEdit({ slug: null, title: '', body: '' })}>+ Нова</Button>}>
                {d.pages.length === 0 && <p className="text-sm text-white/45">Порожньо.</p>}
                {d.pages.map((p) => (
                    <button key={p.slug} type="button" onClick={() => setCurrent(p.slug)} className={`block w-full truncate rounded-lg px-2 py-1.5 text-left text-sm ${p.slug === d.page?.slug ? 'bg-white/10' : 'hover:bg-white/5'}`}>
                        {p.title}
                    </button>
                ))}
            </Card>
            <Card title={d.page?.title ?? 'Вікі'} actions={d.page && d.can_edit && <Button small onClick={() => setEdit({ slug: d.page!.slug, title: d.page!.title, body: d.page!.body ?? '' })}>Редагувати</Button>}>
                {edit ? (
                    <div className="space-y-2">
                        <Input value={edit.title} placeholder="Назва" onChange={(e) => setEdit({ ...edit, title: e.target.value })} />
                        <TextArea rows={14} value={edit.body} onChange={(e) => setEdit({ ...edit, body: e.target.value })} />
                        <div className="flex justify-end gap-2">
                            <Button onClick={() => setEdit(null)}>Скасувати</Button>
                            <Button tone="primary" disabled={busy || !edit.title} onClick={() => void run('POST', `/c/${slug}/wiki`, edit, 'Збережено.', async () => (setEdit(null), await page.reload()))}>
                                Зберегти
                            </Button>
                        </div>
                    </div>
                ) : d.page ? (
                    <Markdown text={d.page.body ?? ''} />
                ) : (
                    <p className="text-sm text-white/45">Оберіть сторінку ліворуч.</p>
                )}
            </Card>
        </div>
    );
}

function CommunitySettings({ d, reload }: { d: Community; reload: () => Promise<void> }) {
    const { run, busy } = useAction();
    const c = d.community;
    const [f, setF] = useState({ name: c.name, type: c.type, privacy: c.privacy, wall: c.wall, category: (c as unknown as { category: string }).category, status: c.status ?? '', description: c.description ?? '', website: c.website ?? '', city: c.city ?? '' });
    const [rules, setRules] = useState({ rules: d.rules.rules ?? '', handbook: d.rules.handbook ?? '' });
    const upload = (field: 'avatar' | 'cover'): void => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = async () => {
            const file = input.files?.[0];
            if (!file) return;
            await run('POST', `/c/${c.slug}/images/${field}`, { __form: true, fields: {}, files: [{ field, name: file.name, type: file.type, data: await file.arrayBuffer() }] }, 'Зображення оновлено.', reload);
        };
        input.click();
    };
    return (
        <Masonry min={380}>
            <Card title="Основне">
                <div className="space-y-2">
                    <Field label="Назва">
                        <Input value={f.name} maxLength={100} onChange={(e) => setF({ ...f, name: e.target.value })} />
                    </Field>
                    <Field label="Статус">
                        <Input value={f.status} maxLength={140} onChange={(e) => setF({ ...f, status: e.target.value })} />
                    </Field>
                    <Field label="Опис">
                        <TextArea rows={4} value={f.description} maxLength={4000} onChange={(e) => setF({ ...f, description: e.target.value })} />
                    </Field>
                    <div className="grid grid-cols-2 gap-2">
                        <Field label="Тип">
                            <Select value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}>
                                <option value="group">Група</option>
                                <option value="public">Паблік</option>
                            </Select>
                        </Field>
                        <Field label="Доступ">
                            <Select value={f.privacy} onChange={(e) => setF({ ...f, privacy: e.target.value })}>
                                <option value="open">Відкрита</option>
                                <option value="closed">Закрита</option>
                            </Select>
                        </Field>
                        <Field label="Стіна">
                            <Select value={f.wall} onChange={(e) => setF({ ...f, wall: e.target.value })}>
                                <option value="open">Пишуть усі учасники</option>
                                <option value="closed">Лише керівники</option>
                            </Select>
                        </Field>
                        <Field label="Місто">
                            <Input value={f.city} maxLength={80} onChange={(e) => setF({ ...f, city: e.target.value })} />
                        </Field>
                    </div>
                    <Field label="Сайт">
                        <Input value={f.website} onChange={(e) => setF({ ...f, website: e.target.value })} placeholder="https://" />
                    </Field>
                    <div className="flex gap-2 pt-1">
                        <Button small onClick={() => upload('avatar')}>Аватар</Button>
                        <Button small onClick={() => upload('cover')}>Обкладинка</Button>
                        <div className="flex-1" />
                        <Button tone="primary" disabled={busy} onClick={() => void run('PATCH', `/c/${c.slug}/settings`, { ...f, slug: c.slug, website: f.website || null, city: f.city || null, status: f.status || null }, 'Збережено.', reload)}>
                            Зберегти
                        </Button>
                    </div>
                </div>
            </Card>
            <Card title="Правила й довідник">
                <div className="space-y-2">
                    <Field label="Правила (Markdown)">
                        <TextArea rows={8} value={rules.rules} onChange={(e) => setRules({ ...rules, rules: e.target.value })} />
                    </Field>
                    <Field label="Довідник (Markdown)">
                        <TextArea rows={8} value={rules.handbook} onChange={(e) => setRules({ ...rules, handbook: e.target.value })} />
                    </Field>
                    <div className="flex justify-end">
                        <Button tone="primary" disabled={busy} onClick={() => void run('PATCH', `/c/${c.slug}/settings/rules`, { rules: rules.rules || null, handbook: rules.handbook || null }, 'Збережено.', reload)}>
                            Зберегти
                        </Button>
                    </div>
                </div>
            </Card>
        </Masonry>
    );
}

