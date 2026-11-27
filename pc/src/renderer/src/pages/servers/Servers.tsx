import { BadgeCheck, Copy, ExternalLink, Search, Server, ThumbsUp, Users } from 'lucide-react';
import { useState } from 'react';
import { Button, Card, Cover, Input, Loading, Masonry, PageHeader, StatTile, Tabs, TextArea, useAction, useSite, useToast, when } from '@/components/kit';
import { Avatar } from '@/components/ui';
import { type User, useLive } from '@/lib/api';
import { useNav } from '@/lib/nav';

type Srv = { id: number; slug: string; name: string; platform: string; platform_label: string; multiplayer_label: string; language: string | null; tagline: string | null; icon: string | null; website: string | null; discord: string | null; telegram: string | null; connect: string | null; players_online: number | null; players_max: number | null; players_peak: number | null; discord_members: number | null; discord_online: number | null; is_featured: boolean; is_verified: boolean; families_count: number; votes_month: number; tags?: { mode?: string; region?: string } | string[] | null; description?: string | null; stats_updated_at?: string | null };

/** Онлайн-смужка: скільки гравців зараз від максимуму. */
function Load({ s }: { s: Srv }) {
    const pct = s.players_online && s.players_max ? Math.min(100, (s.players_online / s.players_max) * 100) : 0;
    return (
        <div>
            <div className="flex items-baseline gap-1 text-sm">
                <span className="font-bold text-emerald-300">{s.players_online ?? '—'}</span>
                <span className="text-white/40">/ {s.players_max ?? '?'}</span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/10">
                <div className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-neon-cyan" style={{ width: `${pct}%` }} />
            </div>
        </div>
    );
}

/** «Сервери GTA»: рейтинг серверів з онлайном, голосами за місяць і пошуком; голосування за улюблений щодня. */
export function ServersList() {
    const nav = useNav();
    const [platform, setPlatform] = useState('');
    const [q, setQ] = useState('');
    const { data, error } = useLive<{ servers: Srv[]; platforms: Record<string, string>; votes: { voted_today: boolean } }>(`/api/v1/servers${platform ? `?platform=${platform}` : ''}`, 60_000);
    const list = (data?.servers ?? []).filter((s) => !q || `${s.name} ${s.tagline ?? ''}`.toLowerCase().includes(q.toLowerCase()));
    const total = list.reduce((n, s) => n + (s.players_online ?? 0), 0);
    return (
        <div className="flex h-full flex-col">
            <PageHeader
                title="Сервери GTA"
                subtitle={`${list.length} серверів · ${total.toLocaleString('uk-UA')} гравців онлайн`}
                actions={
                    <div className="relative">
                        <Search size={15} className="absolute top-3 left-3 text-white/40" />
                        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Назва сервера" className="!w-60 pl-9" />
                    </div>
                }
            />
            <Tabs tabs={[{ id: '', label: 'Усі' }, ...Object.entries(data?.platforms ?? {}).map(([k, v]) => ({ id: k, label: v }))]} value={platform} onChange={setPlatform} />
            <div className="min-h-0 flex-1 overflow-y-auto p-5">
                {!data && <Loading error={error} />}
                <div className="space-y-2">
                    {list.map((s, i) => (
                        <button key={s.id} type="button" onClick={() => nav.go(`/servers/${s.slug}`)} className={`grid w-full grid-cols-[40px_52px_minmax(0,1fr)_180px_110px_110px] items-center gap-4 rounded-2xl px-4 py-3 text-left ring-1 transition hover:ring-neon-cyan/40 ${s.is_featured ? 'bg-neon-violet/[0.07] ring-neon-violet/25' : 'bg-white/[0.035] ring-white/[0.07]'}`}>
                            <span className={`text-center text-lg font-bold ${i < 3 ? 'text-amber-300' : 'text-white/35'}`}>{i + 1}</span>
                            <Cover src={s.icon} className="h-[52px] w-[52px] rounded-xl" fallback={<Server size={20} />} />
                            <span className="min-w-0">
                                <span className="flex items-center gap-1.5 truncate font-semibold">
                                    {s.name} {s.is_verified && <BadgeCheck size={15} className="shrink-0 text-neon-cyan" />}
                                </span>
                                <span className="block truncate text-xs text-white/50">{[s.platform_label, s.multiplayer_label, s.tagline].filter(Boolean).join(' · ')}</span>
                            </span>
                            <Load s={s} />
                            <span className="text-sm">
                                <span className="block font-semibold">{s.votes_month}</span>
                                <span className="text-[11px] text-white/40">голосів за місяць</span>
                            </span>
                            <span className="text-sm">
                                <span className="block font-semibold">{s.families_count}</span>
                                <span className="text-[11px] text-white/40">сімей</span>
                            </span>
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}

const LANG: Record<string, string> = { uk: 'Українська', ru: 'Російська', en: 'Англійська', pl: 'Польська' };

type ServerPage = {
    server: Srv & { tags: { mode?: string; region?: string } };
    families: { id: number; slug: string; name: string; tag: string | null; logo_url: string | null; members_count: number; is_recruiting: boolean; score?: number }[];
    events: { id: number; title: string; type?: string; starts_at: string }[];
    playing_now: User[];
    playing_count: number;
    reviews: { average: number | null; count: number; can_review: boolean; items: { name: string; username: string; stars: number; body: string }[] };
    similar: Srv[];
    votes: { today: number; month: number; total: number; rank: number | null; voted_today: boolean; voted_here: boolean; daily: { date: string; votes: number }[] };
    ownership: { news: { id: number; title: string; body: string; created_at: string }[] } | null;
    tournaments: { list: { id: number; title: string; status: string; starts_at: string; prize?: string | null; entries_count?: number }[] } | null;
};
type TabId = 'overview' | 'families' | 'reviews' | 'events';

/** Сервер повністю: онлайн, підключення, голос дня, графік голосів, сім’ї сервера, хто грає, події й турніри, відгуки, схожі. */
export function ServerPage({ slug }: { slug: string }) {
    const nav = useNav();
    const toast = useToast();
    const page = useSite<ServerPage>(`/servers/${slug}`);
    const { run } = useAction();
    const [tab, setTab] = useState<TabId>('overview');
    const [review, setReview] = useState({ stars: 5, body: '' });
    if (!page.data) return <Loading error={page.error} />;
    const d = page.data;
    const s = d.server;
    const maxVotes = Math.max(1, ...d.votes.daily.map((x) => x.votes));
    return (
        <div className="flex h-full flex-col">
            <PageHeader
                title={
                    <span className="flex items-center gap-2">
                        {s.name} {s.is_verified && <BadgeCheck size={18} className="text-neon-cyan" />}
                    </span>
                }
                subtitle={[s.platform_label, s.multiplayer_label, LANG[s.language ?? ''] ?? s.language, s.tags?.region, s.tags?.mode].filter(Boolean).join(' · ')}
                image={<Cover src={s.icon} className="h-11 w-11 rounded-xl" fallback={<Server size={18} />} />}
                actions={
                    <div className="flex gap-2">
                        {s.connect && (
                            <Button onClick={() => void navigator.clipboard.writeText(s.connect!).then(() => toast('Адресу скопійовано.'))}>
                                <Copy size={14} /> {s.connect}
                            </Button>
                        )}
                        <Button tone={d.votes.voted_today ? 'ghost' : 'primary'} disabled={d.votes.voted_today} onClick={() => void run('POST', `/servers/${slug}/vote`, {}, 'Голос зараховано!', page.reload)}>
                            <ThumbsUp size={15} /> {d.votes.voted_here ? 'Ви проголосували' : d.votes.voted_today ? 'Голос на сьогодні віддано' : 'Голосувати'}
                        </Button>
                    </div>
                }
            />
            <Tabs
                tabs={[
                    { id: 'overview', label: 'Огляд' },
                    { id: 'families', label: 'Сім’ї', badge: d.families.length },
                    { id: 'events', label: 'Події й турніри' },
                    { id: 'reviews', label: 'Відгуки', badge: d.reviews.count },
                ]}
                value={tab}
                onChange={setTab}
            />
            <div className="min-h-0 flex-1 overflow-y-auto p-5">
                {tab === 'overview' && (
                    <div className="space-y-4">
                        <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-3">
                            <StatTile label="Онлайн зараз" value={`${s.players_online ?? '—'} / ${s.players_max ?? '?'}`} hint={s.stats_updated_at ? `оновлено ${when(s.stats_updated_at)}` : undefined} accent />
                            <StatTile label="Пік онлайну" value={s.players_peak ?? '—'} />
                            <StatTile label="Місце в рейтингу" value={d.votes.rank ? `#${d.votes.rank}` : '—'} />
                            <StatTile label="Голосів за місяць" value={d.votes.month} hint={`сьогодні ${d.votes.today}`} />
                            {s.discord_members ? <StatTile label="Discord" value={s.discord_members} hint={`${s.discord_online ?? 0} онлайн`} /> : null}
                            <StatTile label="Наших гравців тут" value={d.playing_count} />
                        </div>
                        <Masonry>
                            {(s.description || s.tagline) && (
                                <Card title="Про сервер">
                                    {s.tagline && <p className="mb-1 text-sm font-medium text-white/85">{s.tagline}</p>}
                                    {s.description && <p className="text-sm whitespace-pre-wrap text-white/60">{s.description}</p>}
                                </Card>
                            )}
                            <Card title="Голоси за 30 днів">
                                {d.votes.total === 0 ? (
                                    <div className="rounded-xl bg-white/[0.03] px-3 py-4 text-sm text-white/55">
                                        Цього місяця ще ніхто не голосував. Підтримайте сервер — ваш голос підніме його в рейтингу.
                                        {!d.votes.voted_today && (
                                            <div className="mt-3">
                                                <Button small tone="primary" onClick={() => void run('POST', `/servers/${slug}/vote`, {}, 'Голос зараховано!', page.reload)}>
                                                    <ThumbsUp size={13} /> Віддати голос
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                <div className="flex h-24 items-end gap-[3px]">
                                    {d.votes.daily.map((x) => (
                                        <div key={x.date} title={`${x.date}: ${x.votes}`} className="flex-1 rounded-t bg-gradient-to-t from-neon-violet/70 to-neon-cyan/70" style={{ height: `${Math.max(4, (x.votes / maxVotes) * 100)}%`, opacity: x.votes ? 1 : 0.25 }} />
                                    ))}
                                </div>
                                )}
                                <p className="mt-2 text-xs text-white/45">Усього голосів: {d.votes.total}. Голосувати можна раз на добу за один сервер.</p>
                            </Card>
                            <Card title="Як почати грати">
                                <ol className="space-y-2 text-sm text-white/75">
                                    <li><b className="text-neon-cyan">1.</b> Встановіть {s.multiplayer_label}{s.platform === 'mobile' ? ' на телефон' : ' на ПК'} і GTA V{s.platform === 'mobile' ? ' (мобільний лаунчер)' : ''}.</li>
                                    {s.connect && (
                                        <li>
                                            <b className="text-neon-cyan">2.</b> Підключіться за адресою{' '}
                                            <button type="button" onClick={() => void navigator.clipboard.writeText(s.connect!).then(() => toast('Адресу скопійовано.'))} className="rounded-md bg-white/10 px-1.5 font-mono text-xs hover:bg-white/15">
                                                {s.connect}
                                            </button>
                                        </li>
                                    )}
                                    <li><b className="text-neon-cyan">{s.connect ? 3 : 2}.</b> Знайдіть сім’ю на вкладці «Сім’ї» й подайте заявку — гратиме веселіше.</li>
                                </ol>
                            </Card>
                            <Card title="Посилання">
                                <div className="flex flex-wrap gap-2">
                                    {s.website && <Button small onClick={() => window.open(s.website!, '_blank')}>Сайт <ExternalLink size={12} /></Button>}
                                    {s.discord && <Button small onClick={() => window.open(s.discord!, '_blank')}>Discord <ExternalLink size={12} /></Button>}
                                    {s.telegram && <Button small onClick={() => window.open(s.telegram!, '_blank')}>Telegram <ExternalLink size={12} /></Button>}
                                    {!s.website && !s.discord && !s.telegram && <p className="text-sm text-white/45">Посилань не вказано.</p>}
                                </div>
                            </Card>
                            {d.playing_now.length > 0 && (
                                <Card title="Грають зараз">
                                    <div className="flex flex-wrap gap-2">
                                        {d.playing_now.map((u) => (
                                            <button key={u.id} type="button" title={u.name} onClick={() => u.username && nav.go(`/u/${u.username}`)}>
                                                <Avatar user={u} size={36} dot="online" />
                                            </button>
                                        ))}
                                    </div>
                                </Card>
                            )}
                            <Card title="Топ сімей сервера" actions={<Button small onClick={() => setTab('families')}>Усі</Button>}>
                                {d.families.length === 0 && <p className="text-sm text-white/45">Сімей ще немає.</p>}
                                {d.families.slice(0, 5).map((f, i) => (
                                    <button key={f.id} type="button" onClick={() => nav.go(`/families/${f.slug}`)} className="flex w-full items-center gap-2.5 rounded-xl px-1 py-1.5 text-left hover:bg-white/5">
                                        <span className="w-4 text-xs text-white/40">{i + 1}</span>
                                        <Avatar user={{ name: f.name, avatar_url: f.logo_url }} size={30} />
                                        <span className="flex-1 truncate text-sm">{f.tag ? `[${f.tag}] ` : ''}{f.name}</span>
                                        <span className="text-xs text-white/45">{f.members_count}</span>
                                    </button>
                                ))}
                            </Card>
                            {d.ownership?.news && d.ownership.news.length > 0 && (
                                <Card title="Новини сервера">
                                    {d.ownership.news.slice(0, 3).map((n) => (
                                        <div key={n.id} className="mb-2">
                                            <p className="text-sm font-semibold">{n.title}</p>
                                            <p className="line-clamp-2 text-sm text-white/60">{n.body}</p>
                                        </div>
                                    ))}
                                </Card>
                            )}
                        </Masonry>
                        {d.similar.length > 0 && (
                            <div>
                                <h3 className="mb-2 px-1 text-xs font-semibold tracking-wide text-white/45 uppercase">Схожі сервери</h3>
                                <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-3">
                                    {d.similar.slice(0, 6).map((x) => (
                                        <button key={x.id} type="button" onClick={() => nav.go(`/servers/${x.slug}`)} className="flex items-center gap-3 rounded-2xl bg-white/[0.035] p-3 text-left ring-1 ring-white/[0.07] hover:ring-neon-cyan/40">
                                            <Cover src={x.icon} className="h-10 w-10 rounded-lg" fallback={<Server size={16} />} />
                                            <span className="min-w-0 flex-1">
                                                <span className="block truncate text-sm font-semibold">{x.name}</span>
                                                <span className="flex items-center gap-1 text-xs text-emerald-300"><Users size={11} /> {x.players_online ?? '—'}</span>
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}
                {tab === 'families' && (
                    <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-3">
                        {d.families.map((f) => (
                            <button key={f.id} type="button" onClick={() => nav.go(`/families/${f.slug}`)} className="flex items-center gap-3 rounded-2xl bg-white/[0.035] p-3.5 text-left ring-1 ring-white/[0.07] hover:ring-neon-cyan/40">
                                <Avatar user={{ name: f.name, avatar_url: f.logo_url }} size={44} />
                                <span className="min-w-0 flex-1">
                                    <span className="block truncate font-semibold">{f.tag ? `[${f.tag}] ` : ''}{f.name}</span>
                                    <span className="text-xs text-white/50">{f.members_count} учасників{f.score ? ` · ${f.score} балів` : ''}</span>
                                </span>
                                {f.is_recruiting && <span className="rounded-full bg-emerald-400/15 px-2 py-0.5 text-[11px] text-emerald-200">набір</span>}
                            </button>
                        ))}
                    </div>
                )}
                {tab === 'events' && (
                    <Masonry>
                        <Card title="Події">
                            {d.events.length === 0 && <p className="text-sm text-white/45">Подій не заплановано.</p>}
                            {d.events.map((e) => (
                                <div key={e.id} className="flex py-1.5 text-sm">
                                    <span className="flex-1 truncate">{e.title}</span>
                                    <span className="text-white/45">{when(e.starts_at)}</span>
                                </div>
                            ))}
                        </Card>
                        <Card title="Турніри">
                            {(d.tournaments?.list ?? []).length === 0 && <p className="text-sm text-white/45">Турнірів немає.</p>}
                            {d.tournaments?.list.map((t) => (
                                <div key={t.id} className="flex items-center gap-2 py-1.5 text-sm">
                                    <span className="flex-1 truncate">{t.title}</span>
                                    {t.prize && <span className="text-amber-300">{t.prize}</span>}
                                    <span className="text-white/45">{when(t.starts_at, false)}</span>
                                </div>
                            ))}
                        </Card>
                    </Masonry>
                )}
                {tab === 'reviews' && (
                    <div className="grid grid-cols-[minmax(0,1fr)_340px] gap-5 max-[1000px]:grid-cols-1">
                        <div className="space-y-3">
                            {d.reviews.items.length === 0 && <p className="py-8 text-center text-sm text-white/45">Відгуків ще немає.</p>}
                            {d.reviews.items.map((r, i) => (
                                <Card key={i}>
                                    <div className="mb-1 flex items-center gap-2">
                                        <span className="flex-1 font-semibold">{r.name}</span>
                                        <span className="text-amber-300">{'★'.repeat(r.stars)}{'☆'.repeat(5 - r.stars)}</span>
                                    </div>
                                    <p className="text-sm text-white/75">{r.body}</p>
                                </Card>
                            ))}
                        </div>
                        <aside className="space-y-4">
                            <StatTile label={`Середня оцінка · ${d.reviews.count}`} value={d.reviews.average ? `★ ${d.reviews.average}` : '—'} accent />
                            {d.reviews.can_review ? (
                                <Card title="Мій відгук">
                                    <div className="mb-2 flex gap-1">
                                        {[1, 2, 3, 4, 5].map((n) => (
                                            <button key={n} type="button" onClick={() => setReview({ ...review, stars: n })} className={`text-2xl ${n <= review.stars ? 'text-amber-300' : 'text-white/20'}`}>★</button>
                                        ))}
                                    </div>
                                    <TextArea value={review.body} maxLength={500} placeholder="Як вам сервер?" onChange={(e) => setReview({ ...review, body: e.target.value })} />
                                    <div className="mt-2"><Button tone="primary" disabled={!review.body.trim()} onClick={() => void run('POST', `/servers/${slug}/reviews`, review, 'Відгук збережено.', page.reload)}>Зберегти</Button></div>
                                </Card>
                            ) : (
                                <p className="text-xs text-white/45">Відгук можуть залишити ті, хто грав на сервері (статус «Граю» чи персонаж на сервері).</p>
                            )}
                        </aside>
                    </div>
                )}
            </div>
        </div>
    );
}
