import { Discussions } from '@/components/Discussions';
import { ExternalLink, Gamepad2, Search, Star } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button, Card, Cover, Field, Input, Loading, Masonry, PageHeader, Select, StatTile, Tabs, TextArea, money, useAction, useSite, when } from '@/components/kit';
import { Avatar } from '@/components/ui';
import { type User, api } from '@/lib/api';
import { useNav } from '@/lib/nav';

type GameCard = { id: number; slug: string; name: string; category_label: string; cover: string | null; year: number | null; rating: number | null; genres: string[]; platforms: (string | { key: string; label: string })[] };
type Catalog = { games: { data: GameCard[]; current_page: number; last_page: number; total: number }; categories: Record<string, string>; modes: Record<string, string>; sorts: Record<string, string>; platforms: Record<string, string> };

const SORTS: Record<string, string> = { popular: 'Популярні', rating: 'За рейтингом', new: 'Нові', name: 'За назвою' };

/** «Ігри»: каталог з пошуком, категорією, платформою, режимом і сортуванням; обкладинки сіткою. */
export function GamesList() {
    const nav = useNav();
    const [q, setQ] = useState('');
    const [f, setF] = useState({ q: '', category: '', platform: '', mode: '', sort: 'popular', page: 1 });
    const params = new URLSearchParams(Object.entries(f).filter(([, v]) => v !== '' && v !== null).map(([k, v]) => [k, String(v)]));
    const [data, setData] = useState<Catalog | null>(null);
    useEffect(() => {
        void api<Catalog>('GET', `/api/v1/games?${params.toString()}`).then(setData, () => undefined);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [params.toString()]);
    return (
        <div className="flex h-full flex-col">
            <PageHeader title="Ігри" subtitle={data ? `${data.games.total} ігор у каталозі` : 'Каталог ігор'} />
            <form onSubmit={(e) => (e.preventDefault(), setF({ ...f, q: q.trim(), page: 1 }))} className="flex flex-wrap gap-2 px-5 pb-3">
                <div className="relative min-w-60 flex-1">
                    <Search size={15} className="absolute top-3 left-3 text-white/40" />
                    <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Назва гри" className="pl-9" />
                </div>
                {data && (
                    <>
                        <Select value={f.category} onChange={(e) => setF({ ...f, category: e.target.value, page: 1 })} className="!w-40">
                            <option value="">Усі категорії</option>
                            {Object.entries(data.categories).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                        </Select>
                        <Select value={f.platform} onChange={(e) => setF({ ...f, platform: e.target.value, page: 1 })} className="!w-40">
                            <option value="">Усі платформи</option>
                            {Object.entries(data.platforms).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                        </Select>
                        <Select value={f.mode} onChange={(e) => setF({ ...f, mode: e.target.value, page: 1 })} className="!w-44">
                            <option value="">Будь-який режим</option>
                            {Object.entries(data.modes).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                        </Select>
                        <Select value={f.sort} onChange={(e) => setF({ ...f, sort: e.target.value, page: 1 })} className="!w-40">
                            {Object.keys(data.sorts).map((k) => <option key={k} value={k}>{SORTS[k] ?? k}</option>)}
                        </Select>
                    </>
                )}
            </form>
            <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5">
                {!data && <Loading />}
                {data?.games.data.length === 0 && <p className="py-12 text-center text-sm text-white/45">Нічого не знайшли.</p>}
                <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-4">
                    {data?.games.data.map((g) => (
                        <button key={g.id} type="button" onClick={() => nav.go(`/games/${g.slug}`)} className="group overflow-hidden rounded-2xl bg-white/[0.035] text-left ring-1 ring-white/[0.07] transition hover:-translate-y-0.5 hover:ring-neon-cyan/40">
                            <Cover src={g.cover} className="aspect-[460/215] w-full" fallback={<Gamepad2 size={30} />} />
                            <div className="p-3">
                                <p className="truncate font-semibold">{g.name}</p>
                                <p className="flex items-center gap-2 truncate text-xs text-white/50">
                                    {g.category_label}
                                    {g.year ? ` · ${g.year}` : ''}
                                    {g.rating ? (
                                        <span className="ml-auto flex items-center gap-0.5 text-amber-300">
                                            <Star size={11} fill="currentColor" /> {g.rating}
                                        </span>
                                    ) : null}
                                </p>
                            </div>
                        </button>
                    ))}
                </div>
                {data && data.games.last_page > 1 && (
                    <div className="mt-5 flex items-center justify-center gap-2 text-sm">
                        <Button small disabled={f.page <= 1} onClick={() => setF({ ...f, page: f.page - 1 })}>←</Button>
                        {data.games.current_page} / {data.games.last_page}
                        <Button small disabled={f.page >= data.games.last_page} onClick={() => setF({ ...f, page: f.page + 1 })}>→</Button>
                    </div>
                )}
            </div>
        </div>
    );
}

type Game = {
    game: GameCard & { modes: string[]; released: string | null; links: { store: string; label: string; url: string }[]; details: { label: string; value: string }[] };
    similar: GameCard[];
    clans: { slug: string; name: string; tag: string | null; logo_url: string | null; members_count: number }[];
    playing_now: User[];
    playing_count: number;
    events: { id: number; title: string; type: string; starts_at: string }[];
    backlog: string | null;
    backlog_on: boolean;
    community_rating: { average: number | null; count: number; distribution: number[]; mine: number | null; played: boolean };
    guides: { id: number; title: string; excerpt?: string | null; votes?: number; author?: User | null }[];
    screenshots: string[] | null;
};
type TabId = 'overview' | 'talk' | 'reviews' | 'prices' | 'pc' | 'news' | 'qa' | 'guides';
const BACKLOG: Record<string, string> = { want: 'Хочу пограти', playing: 'Граю', done: 'Пройдено', dropped: 'Закинув' };

/** Гра повністю: обкладинка, оцінка спільноти й моя, «Хочу / Граю / Пройдено», хто грає, відгуки, ціни, чи потягне ПК, новини, питання й гайди. */
export function GamePage({ slug }: { slug: string }) {
    const nav = useNav();
    const page = useSite<Game>(`/games/${slug}`);
    const { run } = useAction();
    const [tab, setTab] = useState<TabId>('overview');
    if (!page.data) return <Loading error={page.error} />;
    const d = page.data;
    const g = d.game;
    const r = d.community_rating;
    const maxDist = Math.max(1, ...r.distribution);
    return (
        <div className="h-full overflow-y-auto">
            <div className="relative h-56 overflow-hidden">
                <Cover src={g.cover} className="absolute inset-0 h-full w-full scale-110 opacity-50 blur-2xl" />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0c0f17] via-[#0c0f17]/60 to-transparent" />
                <div className="absolute top-4 right-5 left-5 flex justify-between">
                    <button type="button" onClick={nav.back} aria-label="Назад" className="grid h-11 w-11 place-items-center rounded-xl bg-black/40 ring-1 ring-white/15 backdrop-blur hover:bg-black/60">←</button>
                    <button type="button" onClick={nav.close} aria-label="Закрити" className="grid h-11 w-11 place-items-center rounded-xl bg-black/40 ring-1 ring-white/15 backdrop-blur hover:bg-black/60">✕</button>
                </div>
                <div className="absolute right-5 bottom-5 left-5 flex items-end gap-5">
                    <Cover src={g.cover} className="h-28 w-60 shrink-0 rounded-xl shadow-2xl ring-1 ring-white/20" fallback={<Gamepad2 size={34} />} />
                    <div className="min-w-0 flex-1">
                        <h1 className="truncate text-3xl font-bold">{g.name}</h1>
                        <p className="mt-1 text-sm text-white/60">
                            {[...new Set([g.category_label, g.year ? String(g.year) : null, ...g.genres.slice(0, 3), ...g.platforms.map((p) => (typeof p === 'string' ? p : p.label))].filter(Boolean))].join(' · ')}
                        </p>
                    </div>
                    <div className="flex shrink-0 gap-2">
                        {g.links.map((l) => (
                            <Button key={l.url} onClick={() => window.open(l.url, '_blank')}>
                                {l.label} <ExternalLink size={13} />
                            </Button>
                        ))}
                    </div>
                </div>
            </div>
            <Tabs
                tabs={[
                    { id: 'overview', label: 'Огляд' },
                    { id: 'talk', label: 'Обговорення' },
                    { id: 'reviews', label: 'Відгуки' },
                    { id: 'prices', label: 'Ціни' },
                    { id: 'pc', label: 'Чи потягне ПК' },
                    { id: 'news', label: 'Новини' },
                    { id: 'qa', label: 'Питання' },
                    { id: 'guides', label: 'Гайди' },
                ]}
                value={tab}
                onChange={setTab}
            />
            <div className="p-5">
                {tab === 'overview' && (
                    <div className="space-y-4">
                        <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-3">
                            <StatTile label={`Оцінка спільноти · ${r.count}`} value={r.average ? `★ ${r.average}` : '—'} accent />
                            <StatTile label="Грають зараз" value={d.playing_count} />
                            <StatTile label="Моя оцінка" value={r.mine ?? '—'} />
                            {g.released && <StatTile label="Вихід" value={when(g.released, false)} />}
                            <StatTile label="Кланів" value={d.clans.length} />
                        </div>
                        <Masonry>
                            <Card title="Оцінити">
                                <div className="grid grid-cols-10 gap-1">
                                    {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                                        <button key={n} type="button" onClick={() => void run('POST', `/games/${slug}/rating`, { score: n }, `Ваша оцінка: ${n}`, page.reload)} className={`grid h-9 place-items-center rounded-lg text-sm font-semibold ring-1 transition ${r.mine === n ? 'bg-amber-300/25 text-amber-200 ring-amber-300/60' : 'ring-white/10 hover:bg-white/10'}`}>
                                            {n}
                                        </button>
                                    ))}
                                </div>
                                <label className="mt-3 flex items-center gap-2 text-sm">
                                    <input type="checkbox" className="accent-[#22d3ee]" checked={r.played} onChange={() => void run('POST', `/games/${slug}/played`, {}, undefined, page.reload)} /> Я грав у цю гру
                                </label>
                                {r.count > 0 && <div className="mt-3 flex h-16 items-end gap-1">
                                    {r.distribution.map((v, i) => (
                                        <div key={i} title={`${i + 1}: ${v}`} className="flex-1 rounded-t bg-gradient-to-t from-neon-violet/60 to-neon-cyan/60" style={{ height: `${Math.max(4, (v / maxDist) * 100)}%`, opacity: v ? 1 : 0.25 }} />
                                    ))}
                                </div>}
                            </Card>
                            {d.backlog_on && (
                                <Card title="Мій список">
                                    <div className="grid grid-cols-2 gap-2">
                                        {Object.entries(BACKLOG).map(([k, v]) => (
                                            <Button key={k} tone={d.backlog === k ? 'primary' : 'ghost'} onClick={() => void run('PUT', `/games/${slug}/backlog`, { status: d.backlog === k ? null : k }, 'Збережено.', page.reload)}>
                                                {v}
                                            </Button>
                                        ))}
                                    </div>
                                </Card>
                            )}
                            <Card title="Жанри й режими">
                                <div className="flex flex-wrap gap-1.5">
                                    {[...g.genres, ...g.modes, ...g.platforms.map((p) => (typeof p === 'string' ? p : p.label))].map((t, i) => (
                                        <span key={i} className="rounded-full bg-white/[0.06] px-2.5 py-1 text-xs text-white/70 ring-1 ring-white/[0.06]">
                                            {t}
                                        </span>
                                    ))}
                                </div>
                            </Card>
                            <Card title="Що ще тут є">
                                <div className="grid grid-cols-2 gap-2">
                                    {(
                                        [
                                            ['reviews', 'Відгуки гравців'],
                                            ['prices', 'Ціни й знижки'],
                                            ['pc', 'Чи потягне мій ПК'],
                                            ['qa', 'Питання й ментори'],
                                            ['news', 'Новини гри'],
                                            ['guides', 'Гайди'],
                                        ] as [TabId, string][]
                                    ).map(([k, v]) => (
                                        <button key={k} type="button" onClick={() => setTab(k)} className="rounded-xl bg-white/[0.04] px-3 py-2.5 text-left text-sm ring-1 ring-white/[0.06] transition hover:ring-neon-cyan/40">
                                            {v} →
                                        </button>
                                    ))}
                                </div>
                            </Card>
                            {d.playing_now.length > 0 && (
                                <Card title="Друзі грають зараз">
                                    <div className="flex flex-wrap gap-2">
                                        {d.playing_now.map((u) => (
                                            <button key={u.id} type="button" title={u.name} onClick={() => u.username && nav.go(`/u/${u.username}`)}>
                                                <Avatar user={u} size={38} dot="online" />
                                            </button>
                                        ))}
                                    </div>
                                </Card>
                            )}
                            {g.details.length > 0 && (
                                <Card title="Про гру">
                                    {g.details.map((x) => (
                                        <div key={x.label} className="flex gap-3 py-1 text-sm">
                                            <span className="w-32 shrink-0 text-white/45">{x.label}</span>
                                            <span className="text-white/80">{x.value}</span>
                                        </div>
                                    ))}
                                </Card>
                            )}
                            {d.clans.length > 0 && (
                                <Card title="Клани в цій грі">
                                    {d.clans.map((c) => (
                                        <button key={c.slug} type="button" onClick={() => nav.go(`/clans/${c.slug}`)} className="flex w-full items-center gap-2.5 rounded-xl px-1 py-1.5 text-left hover:bg-white/5">
                                            <Avatar user={{ name: c.name, avatar_url: c.logo_url }} size={30} />
                                            <span className="flex-1 truncate text-sm">{c.tag ? `[${c.tag}] ` : ''}{c.name}</span>
                                            <span className="text-xs text-white/40">{c.members_count}</span>
                                        </button>
                                    ))}
                                </Card>
                            )}
                            {d.events.length > 0 && (
                                <Card title="Події гри">
                                    {d.events.map((e) => (
                                        <div key={e.id} className="flex py-1 text-sm">
                                            <span className="flex-1 truncate">{e.title}</span>
                                            <span className="text-white/45">{when(e.starts_at, false)}</span>
                                        </div>
                                    ))}
                                </Card>
                            )}
                        </Masonry>
                        {d.similar.length > 0 && (
                            <div>
                                <h3 className="mb-2 px-1 text-xs font-semibold tracking-wide text-white/45 uppercase">Схожі ігри</h3>
                                <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-3">
                                    {d.similar.slice(0, 8).map((s) => (
                                        <button key={s.id} type="button" onClick={() => nav.go(`/games/${s.slug}`)} className="overflow-hidden rounded-xl bg-white/[0.035] text-left ring-1 ring-white/[0.07] hover:ring-neon-cyan/40">
                                            <Cover src={s.cover} className="aspect-[460/215] w-full" fallback={<Gamepad2 size={24} />} />
                                            <p className="truncate p-2.5 text-sm font-semibold">{s.name}</p>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}
                {tab === 'talk' && <Discussions subject={{ type: 'game', id: g.id }} />}
                {tab === 'reviews' && <Reviews slug={slug} />}
                {tab === 'prices' && <Prices slug={slug} />}
                {tab === 'pc' && <PcCheck slug={slug} />}
                {tab === 'news' && <News slug={slug} />}
                {tab === 'qa' && <Questions slug={slug} />}
                {tab === 'guides' && (
                    <div className="space-y-3">
                        {d.guides.length === 0 && <p className="py-8 text-center text-sm text-white/45">Гайдів ще немає.</p>}
                        {d.guides.map((gd) => (
                            <Card key={gd.id} title={gd.title}>
                                {gd.excerpt && <p className="text-sm text-white/65">{gd.excerpt}</p>}
                                <p className="mt-1 text-xs text-white/40">{gd.author?.name}{gd.votes ? ` · ${gd.votes} корисно` : ''}</p>
                            </Card>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

type ReviewsPage = { reviews: { data: { id: number; body: string; score: number; recommended: boolean; hours: number | null; user: User; created_at: string }[] }; summary: { count: number; recommended: number; average: number | null }; mine: { id: number } | null };
function Reviews({ slug }: { slug: string }) {
    const page = useSite<ReviewsPage>(`/games/${slug}/reviews`);
    const { run, busy } = useAction();
    const [f, setF] = useState({ body: '', score: '8', recommended: true, hours: '' });
    if (!page.data) return <Loading error={page.error} />;
    const d = page.data;
    return (
        <div className="grid grid-cols-[minmax(0,1fr)_340px] gap-5 max-[1000px]:grid-cols-1">
            <div className="space-y-3">
                {d.reviews.data.length === 0 && <p className="py-8 text-center text-sm text-white/45">Відгуків ще немає — будьте першим.</p>}
                {d.reviews.data.map((rv) => (
                    <Card key={rv.id}>
                        <div className="mb-2 flex items-center gap-3">
                            <Avatar user={rv.user} size={34} />
                            <span className="flex-1">
                                <span className="block text-sm font-semibold">{rv.user.name}</span>
                                <span className="text-xs text-white/45">{when(rv.created_at)}{rv.hours ? ` · ${rv.hours} год у грі` : ''}</span>
                            </span>
                            <span className={`rounded-full px-2.5 py-1 text-xs ${rv.recommended ? 'bg-emerald-400/15 text-emerald-200' : 'bg-rose-400/15 text-rose-200'}`}>{rv.recommended ? '👍 Раджу' : '👎 Не раджу'}</span>
                            <span className="text-lg font-bold text-amber-300">{rv.score}</span>
                        </div>
                        <p className="text-sm whitespace-pre-wrap text-white/80">{rv.body}</p>
                    </Card>
                ))}
            </div>
            <aside className="space-y-4">
                <Card title="Підсумок">
                    <div className="grid grid-cols-2 gap-2">
                        <StatTile label="Відгуків" value={d.summary.count} />
                        <StatTile label="Радять" value={d.summary.count ? `${Math.round((d.summary.recommended / d.summary.count) * 100)}%` : '—'} />
                    </div>
                </Card>
                {!d.mine ? (
                    <Card title="Мій відгук">
                        <div className="space-y-2">
                            <TextArea rows={5} value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} placeholder="Що сподобалось, що ні (від 20 символів)" />
                            <div className="grid grid-cols-2 gap-2">
                                <Field label="Оцінка"><Input type="number" min={1} max={10} value={f.score} onChange={(e) => setF({ ...f, score: e.target.value })} /></Field>
                                <Field label="Годин у грі"><Input type="number" min={0} value={f.hours} onChange={(e) => setF({ ...f, hours: e.target.value })} /></Field>
                            </div>
                            <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="accent-[#22d3ee]" checked={f.recommended} onChange={(e) => setF({ ...f, recommended: e.target.checked })} /> Раджу</label>
                            <Button tone="primary" disabled={busy || f.body.trim().length < 20} onClick={() => void run('POST', `/games/${slug}/reviews`, { body: f.body, score: Number(f.score), recommended: f.recommended, hours: f.hours ? Number(f.hours) : null }, 'Відгук опубліковано.', page.reload)}>Опублікувати</Button>
                        </div>
                    </Card>
                ) : (
                    <Button tone="danger" onClick={() => window.confirm('Видалити ваш відгук?') && void run('DELETE', `/games/${slug}/reviews`, undefined, 'Відгук видалено.', page.reload)}>Видалити мій відгук</Button>
                )}
            </aside>
        </div>
    );
}

type PricesPage = { free: boolean; steam: { price: number | null; discount: number | null; currency?: string } | null; deals: { store: string; price: number; old_price?: number | null; url: string; cut?: number | null }[]; lowest_ever: { price: number; store?: string } | null; wished: boolean; target_price: number | null };
function Prices({ slug }: { slug: string }) {
    const page = useSite<PricesPage>(`/games/${slug}/prices`);
    const { run } = useAction();
    const [target, setTarget] = useState('');
    if (!page.data) return <Loading error={page.error} />;
    const d = page.data;
    return (
        <div className="space-y-4">
            <div className="grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-3">
                <StatTile label="Steam" value={d.free ? 'Безкоштовно' : d.steam?.price != null ? money(d.steam.price, d.steam.currency ?? '₴') : '—'} hint={d.steam?.discount ? `−${d.steam.discount}%` : undefined} accent />
                {d.lowest_ever && <StatTile label="Найнижча ціна" value={money(d.lowest_ever.price, '$')} hint={d.lowest_ever.store} />}
                <StatTile label="Список бажань" value={d.wished ? 'У списку' : 'Ні'} />
            </div>
            <Card title="Стежити за знижкою">
                <div className="flex gap-2">
                    <Input type="number" min={0} placeholder="Сповістити, коли ціна нижча за…" value={target} onChange={(e) => setTarget(e.target.value)} className="!w-72" />
                    <Button tone="primary" onClick={() => void run('POST', `/games/${slug}/wish`, { on: true, target_price: target ? Number(target) : null }, d.wished ? 'Оновлено.' : 'Додано в список бажань.', page.reload)}>{d.wished ? 'Оновити' : 'У список бажань'}</Button>
                    {d.wished && <Button onClick={() => void run('POST', `/games/${slug}/wish`, { on: false }, 'Прибрано.', page.reload)}>Прибрати</Button>}
                </div>
            </Card>
            <Card title="Де купити">
                {d.deals.length === 0 && <p className="text-sm text-white/45">Пропозицій не знайшли.</p>}
                {d.deals.map((x, i) => (
                    <div key={i} className="flex items-center gap-3 border-b border-white/5 py-2 text-sm last:border-0">
                        <span className="flex-1">{x.store}</span>
                        {x.cut ? <span className="rounded bg-emerald-400/15 px-1.5 text-xs text-emerald-200">−{x.cut}%</span> : null}
                        {x.old_price ? <span className="text-white/35 line-through">{money(x.old_price, '$')}</span> : null}
                        <span className="font-semibold">{money(x.price, '$')}</span>
                        <Button small onClick={() => window.open(x.url, '_blank')}>Купити <ExternalLink size={12} /></Button>
                    </div>
                ))}
            </Card>
        </div>
    );
}

type PcPage = { requirements: { minimum: { label: string; value: string }[]; recommended: { label: string; value: string }[] }; pc: { cpu: string | null; gpu: string | null; ram: number | null }; configured: boolean; minimum: boolean | null; recommended: boolean | null; summary: string | null };
function PcCheck({ slug }: { slug: string }) {
    const page = useSite<PcPage>(`/games/${slug}/pc-check`);
    if (!page.data) return <Loading error={page.error} />;
    const d = page.data;
    const verdict = (ok: boolean | null): string => (ok === null ? '—' : ok ? '✅ Так' : '❌ Ні');
    return (
        <div className="space-y-4">
            <div className="grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))] gap-3">
                <StatTile label="Мінімальні" value={verdict(d.minimum)} accent />
                <StatTile label="Рекомендовані" value={verdict(d.recommended)} />
                <StatTile label="Мій ПК" value={d.configured ? `${d.pc.gpu ?? ''}` : 'Не вказано'} hint={d.configured ? `${d.pc.cpu ?? ''} · ${d.pc.ram ?? '?'} ГБ` : 'Вкажіть сетап у профілі'} />
            </div>
            {d.summary && <Card><p className="text-sm text-white/75">{d.summary}</p></Card>}
            <Masonry min={360}>
                {(['minimum', 'recommended'] as const).map((k) => (
                    <Card key={k} title={k === 'minimum' ? 'Мінімальні вимоги' : 'Рекомендовані вимоги'}>
                        {d.requirements[k].length === 0 && <p className="text-sm text-white/45">Невідомо.</p>}
                        {d.requirements[k].map((x) => (
                            <div key={x.label} className="flex gap-3 py-1 text-sm">
                                <span className="w-28 shrink-0 text-white/45">{x.label}</span>
                                <span className="text-white/80">{x.value}</span>
                            </div>
                        ))}
                    </Card>
                ))}
            </Masonry>
        </div>
    );
}

function News({ slug }: { slug: string }) {
    const page = useSite<{ items: { title: string; url: string; date?: string; excerpt?: string | null; image?: string | null }[] }>(`/games/${slug}/news`);
    if (!page.data) return <Loading error={page.error} />;
    return (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(320px,1fr))] gap-3">
            {page.data.items.length === 0 && <p className="col-span-full py-8 text-center text-sm text-white/45">Новин немає.</p>}
            {page.data.items.map((n, i) => (
                <Card key={i}>
                    {n.image && <img src={n.image} alt="" className="mb-2 h-32 w-full rounded-xl object-cover" />}
                    <p className="font-semibold">{n.title}</p>
                    {n.excerpt && <p className="mt-1 line-clamp-3 text-sm text-white/60">{n.excerpt}</p>}
                    <div className="mt-2 flex items-center text-xs text-white/40">
                        <span className="flex-1">{n.date ? when(n.date, false) : ''}</span>
                        <Button small onClick={() => window.open(n.url, '_blank')}>Читати <ExternalLink size={12} /></Button>
                    </div>
                </Card>
            ))}
        </div>
    );
}

type Q = { id: number; title: string; body: string | null; author: User; own: boolean; solved_answer_id: number | null; created_at: string; answers: { id: number; body: string; author: User; own: boolean; votes: number; voted: boolean }[] };
function Questions({ slug }: { slug: string }) {
    const page = useSite<{ questions: Q[] }>(`/games/${slug}/questions`);
    const { run, busy } = useAction();
    const [ask, setAsk] = useState({ title: '', body: '' });
    const [reply, setReply] = useState<Record<number, string>>({});
    if (!page.data) return <Loading error={page.error} />;
    return (
        <div className="mx-auto max-w-4xl space-y-4">
            <Card title="Поставити питання">
                <div className="space-y-2">
                    <Input value={ask.title} placeholder="Коротко: що потрібно (від 8 символів)" maxLength={160} onChange={(e) => setAsk({ ...ask, title: e.target.value })} />
                    <TextArea value={ask.body} placeholder="Подробиці (необовʼязково)" maxLength={3000} onChange={(e) => setAsk({ ...ask, body: e.target.value })} />
                    <Button tone="primary" disabled={busy || ask.title.trim().length < 8} onClick={() => void run('POST', `/games/${slug}/questions`, { title: ask.title, body: ask.body || null }, 'Питання опубліковано.', async () => (setAsk({ title: '', body: '' }), await page.reload()))}>Запитати</Button>
                </div>
            </Card>
            {page.data.questions.map((q) => (
                <Card key={q.id} title={`${q.solved_answer_id ? '✅ ' : ''}${q.title}`}>
                    {q.body && <p className="mb-2 text-sm text-white/70">{q.body}</p>}
                    <p className="mb-3 text-xs text-white/40">{q.author.name} · {when(q.created_at)}</p>
                    {q.answers.map((a) => (
                        <div key={a.id} className={`mb-2 flex gap-2.5 rounded-xl px-3 py-2 text-sm ${q.solved_answer_id === a.id ? 'bg-emerald-400/10 ring-1 ring-emerald-400/30' : 'bg-white/[0.04]'}`}>
                            <Avatar user={a.author} size={28} />
                            <span className="flex-1"><b>{a.author.name}</b> {a.body}</span>
                            {q.own && !q.solved_answer_id && <Button small tone="ok" onClick={() => void run('POST', `/games/${slug}/questions/${q.id}/solve`, { answer_id: a.id }, 'Позначено рішенням.', page.reload)}>Рішення</Button>}
                            <Button small tone={a.voted ? 'primary' : 'ghost'} onClick={() => void run('POST', `/games/${slug}/answers/${a.id}/vote`, {}, undefined, page.reload)}>▲ {a.votes}</Button>
                        </div>
                    ))}
                    <div className="flex gap-2">
                        <Input value={reply[q.id] ?? ''} placeholder="Ваша відповідь" onChange={(e) => setReply({ ...reply, [q.id]: e.target.value })} />
                        <Button tone="primary" disabled={(reply[q.id] ?? '').trim().length < 2} onClick={() => void run('POST', `/games/${slug}/questions/${q.id}/answers`, { body: reply[q.id] }, 'Відповідь додано.', async () => (setReply({ ...reply, [q.id]: '' }), await page.reload()))}>Відповісти</Button>
                    </div>
                </Card>
            ))}
        </div>
    );
}
