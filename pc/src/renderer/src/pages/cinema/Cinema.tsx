import { ChevronLeft, ChevronRight, Clapperboard, Play, Search, Star, Users } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Button, Card, Cover, Input, Loading, PageHeader, Select, StatTile, Tabs, TextArea, useAction, useSite, useToast, when } from '@/components/kit';
import { Discussions } from '@/components/Discussions';
import { Avatar } from '@/components/ui';
import { api, type User } from '@/lib/api';
import { useNav } from '@/lib/nav';

type MovieCard = {
    id: number;
    slug: string;
    type: string;
    type_label: string;
    title: string;
    title_original: string | null;
    year: number | null;
    poster: string | null;
    backdrop: string | null;
    genres: string[];
    rating: number | null;
    age_rating: string | null;
    episodes_count: number | null;
    progress_pct?: number;
};
type Catalog = {
    movies: {
        data: MovieCard[];
        current_page: number;
        last_page: number;
        total: number;
    };
    types: { key: string; label: string }[];
    continue: MovieCard[];
    popular: MovieCard[];
};

/** Постер-картка фільму для сіток і каруселей. */
export function Poster({ m, onOpen, width }: { m: MovieCard; onOpen: () => void; width?: number }) {
    return (
        <button type="button" onClick={onOpen} className="group text-left" style={width ? { width } : undefined}>
            <div className="relative overflow-hidden rounded-xl ring-1 ring-white/10 transition group-hover:-translate-y-0.5 group-hover:ring-neon-cyan/40">
                <Cover src={m.poster} className="aspect-[2/3] w-full" fallback={<Clapperboard size={26} />} />
                {m.rating ? (
                    <span className="absolute top-1.5 left-1.5 flex items-center gap-0.5 rounded-md bg-black/60 px-1.5 py-0.5 text-[11px] font-semibold text-amber-300 backdrop-blur">
                        <Star size={10} fill="currentColor" /> {m.rating}
                    </span>
                ) : null}
                {m.age_rating && <span className="absolute top-1.5 right-1.5 rounded-md bg-black/60 px-1.5 py-0.5 text-[10px] text-white/80 backdrop-blur">{m.age_rating}</span>}
                {m.progress_pct ? (
                    <span className="absolute inset-x-0 bottom-0 h-1 bg-white/15">
                        <span className="block h-full bg-neon-cyan" style={{ width: `${m.progress_pct}%` }} />
                    </span>
                ) : null}
            </div>
            <p className="mt-1.5 truncate text-[13px] font-medium">{m.title}</p>
            <p className="truncate text-[11px] text-white/45">
                {m.type_label}
                {m.year ? ` · ${m.year}` : ''}
            </p>
        </button>
    );
}

/** «Кіно»: продовжити перегляд, популярне й каталог за типом, пошуком і сторінками. */
export function CinemaList() {
    const nav = useNav();
    const [type, setType] = useState('');
    const [q, setQ] = useState('');
    const [query, setQuery] = useState('');
    const [page, setPage] = useState(1);
    const [data, setData] = useState<Catalog | null>(null);
    useEffect(() => {
        void api<Catalog>('GET', `/api/v1/cinema?page=${page}${type ? `&type=${type}` : ''}${query ? `&q=${encodeURIComponent(query)}` : ''}`).then(setData, () => undefined);
    }, [type, query, page]);
    const open = (m: MovieCard): void => nav.go(`/cinema/${m.slug}`);
    return (
        <div className="flex h-full flex-col">
            <PageHeader
                title="Кіно"
                subtitle={data ? `${data.movies.total} у каталозі` : 'Фільми, серіали, аніме'}
                actions={
                    <form onSubmit={(e) => (e.preventDefault(), setQuery(q.trim()), setPage(1))} className="relative">
                        <Search size={15} className="absolute top-3 left-3 text-white/40" />
                        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Назва фільму" className="!w-64 pl-9" />
                    </form>
                }
            />
            <Tabs
                tabs={[
                    { id: '', label: 'Усе' },
                    ...(data?.types ?? []).map((t) => ({
                        id: t.key,
                        label: t.label,
                    })),
                ]}
                value={type}
                onChange={(t) => (setType(t), setPage(1))}
            />
            <div className="min-h-0 flex-1 overflow-y-auto p-5">
                {!data && <Loading />}
                {data && !type && !query && page === 1 && data.continue.length > 0 && (
                    <section className="mb-6">
                        <h2 className="mb-3 text-lg font-bold">Продовжити перегляд</h2>
                        <div className="flex gap-3 overflow-x-auto pb-2">
                            {data.continue.map((m) => (
                                <Poster key={m.id} m={m} width={140} onOpen={() => open(m)} />
                            ))}
                        </div>
                    </section>
                )}
                {data && (
                    <section>
                        <h2 className="mb-3 text-lg font-bold">{query ? `Знайдено за «${query}»` : 'Каталог'}</h2>
                        <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-4">
                            {data.movies.data.map((m) => (
                                <Poster key={m.id} m={m} onOpen={() => open(m)} />
                            ))}
                        </div>
                        {data.movies.last_page > 1 && (
                            <div className="mt-5 flex items-center justify-center gap-2 text-sm">
                                <Button small disabled={page <= 1} onClick={() => setPage(page - 1)}>
                                    ←
                                </Button>
                                {page} / {data.movies.last_page}
                                <Button small disabled={page >= data.movies.last_page} onClick={() => setPage(page + 1)}>
                                    →
                                </Button>
                            </div>
                        )}
                    </section>
                )}
            </div>
        </div>
    );
}

type PlayerSrc = {
    key: string;
    id: number;
    provider: string;
    provider_label: string;
    translation: string | null;
    quality: string | null;
    link: string;
    is_hidden: boolean;
};
type Season = { number: number; episodes: number[] };
type MoviePage = {
    movie: MovieCard & {
        description: string | null;
        countries: string[];
        duration: number | null;
        tagline: string | null;
        trailer_url: string | null;
        user_rating: number | null;
        ratings_count: number;
        watchers_count: number;
        comments_count: number;
        comments_enabled: boolean;
        ratings?: { imdb?: number | null };
    };
    players: PlayerSrc[];
    episodes: Season[] | null;
    state: {
        status: string | null;
        rating: number | null;
        season: number | null;
        episode: number | null;
        player_key: string | null;
    };
    statuses: { key: string; label: string }[];
    friends: {
        users: (User & {
            movie_status?: string | null;
            movie_rating?: number | null;
        })[];
        total: number;
    };
    similar: MovieCard[];
};

/** Адреса плеєра з конкретною серією (як на сайті: Kodik і Videoseed уміють відкрити серію). */
function episodeLink(provider: string, link: string, pick: { season: number; episode: number } | null): string {
    try {
        const url = new URL(link);
        if (provider === 'kodik' && pick) {
            url.searchParams.set('hide_selectors', 'true');
            url.searchParams.set('translations', 'false');
            url.searchParams.set('season', String(pick.season));
            url.searchParams.set('episode', String(pick.episode));
            url.searchParams.set('only_season', 'true');
            url.searchParams.set('only_episode', 'true');
        } else if (provider === 'videoseed' && pick) {
            url.searchParams.set('video', `s${pick.season}v${pick.episode}`);
            url.searchParams.set('only', 'true');
        }
        return url.toString();
    } catch {
        return link;
    }
}

type TabId = 'about' | 'comments' | 'reviews' | 'talk';

/** Фільм, серіал чи аніме: плеєр з озвучками й серіями, статус, оцінка, друзі, коментарі, рецензії, обговорення. */
export function MovieView({ slug }: { slug: string }) {
    const nav = useNav();
    const page = useSite<MoviePage>(`/cinema/${slug}`);
    const { run } = useAction();
    const [player, setPlayer] = useState<string | null>(null);
    const [pick, setPick] = useState<{
        season: number;
        episode: number;
    } | null>(null);
    const [tab, setTab] = useState<TabId>('about');
    const d = page.data;
    const players = useMemo(() => (d?.players ?? []).filter((p) => !p.is_hidden), [d]);
    useEffect(() => {
        if (!d) return;
        setPlayer((cur) => cur ?? d.state.player_key ?? players[0]?.key ?? null);
        if (d.episodes?.length && !pick)
            setPick({
                season: d.state.season ?? d.episodes[0].number,
                episode: d.state.episode ?? d.episodes[0].episodes[0],
            });
    }, [d, players, pick]);
    if (!d) return <Loading error={page.error} />;
    const m = d.movie;
    const current = players.find((p) => p.key === player) ?? players[0];
    const flat = (d.episodes ?? []).flatMap((s) => s.episodes.map((e) => ({ season: s.number, episode: e })));
    const at = pick ? flat.findIndex((x) => x.season === pick.season && x.episode === pick.episode) : -1;
    const choose = (p: { season: number; episode: number }): void => {
        setPick(p);
        void api('PUT', `/api/v1/site/cinema/${slug}/progress`, {
            season: p.season,
            episode: p.episode,
        }).catch(() => undefined);
    };
    const season = d.episodes?.find((s) => s.number === pick?.season);
    return (
        <div className="h-full overflow-y-auto">
            <div className="relative">
                <div className="absolute inset-0 overflow-hidden">
                    <Cover src={m.backdrop ?? m.poster} className="h-full w-full scale-110 opacity-40 blur-2xl" />
                    <div className="absolute inset-0 bg-gradient-to-b from-[#0c0f17]/40 via-[#0c0f17]/70 to-[#0c0f17]" />
                </div>
                <div className="relative px-5 pt-4">
                    <PageHeader title="" />
                    <div className="-mt-4 flex gap-6 pb-5">
                        <Cover src={m.poster} className="aspect-[2/3] w-44 shrink-0 rounded-2xl shadow-2xl ring-1 ring-white/15" fallback={<Clapperboard size={40} />} />
                        <div className="min-w-0 flex-1 pt-2">
                            <h1 className="text-3xl font-black">{m.title}</h1>
                            {m.title_original && <p className="text-sm text-white/50">{m.title_original}</p>}
                            <p className="mt-2 text-sm text-white/65">
                                {[m.type_label, m.year, m.countries.join(', '), m.duration ? `${m.duration} хв` : null, m.age_rating, m.genres.join(', ')].filter(Boolean).join(' · ')}
                            </p>
                            {m.tagline && <p className="mt-2 text-sm text-white/55 italic">«{m.tagline}»</p>}
                            <div className="mt-4 flex flex-wrap items-center gap-2">
                                <Select
                                    value={d.state.status ?? ''}
                                    onChange={(e) => void run('PATCH', `/cinema/${slug}/status`, { status: e.target.value || null }, 'Збережено.', page.reload)}
                                    className="!w-48"
                                >
                                    <option value="">+ У мій список</option>
                                    {d.statuses.map((s) => (
                                        <option key={s.key} value={s.key}>
                                            {s.label}
                                        </option>
                                    ))}
                                </Select>
                                <div className="flex items-center gap-0.5 rounded-xl bg-white/[0.05] px-2 py-1 ring-1 ring-white/10">
                                    {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                                        <button
                                            key={n}
                                            type="button"
                                            title={`${n}`}
                                            onClick={() =>
                                                void run(
                                                    'PUT',
                                                    `/cinema/${slug}/rating`,
                                                    {
                                                        rating: d.state.rating === n ? null : n,
                                                    },
                                                    `Ваша оцінка: ${n}`,
                                                    page.reload,
                                                )
                                            }
                                            className={`grid h-7 w-6 place-items-center text-sm ${d.state.rating && n <= d.state.rating ? 'text-amber-300' : 'text-white/25 hover:text-amber-200'}`}
                                        >
                                            ★
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                        <div className="hidden w-60 shrink-0 grid-cols-2 content-start gap-2 pt-2 xl:grid">
                            <StatTile label="Рейтинг" value={m.rating ? `★ ${m.rating}` : '—'} accent />
                            <StatTile label={`Оцінки · ${m.ratings_count}`} value={m.user_rating ?? '—'} />
                            <StatTile label="Дивляться" value={m.watchers_count} />
                            <StatTile label="Коментарі" value={m.comments_count} />
                        </div>
                    </div>
                </div>
            </div>
            <div className="space-y-5 px-5 pb-6">
                {/* Плеєр. */}
                {current ? (
                    <Card>
                        <div className="mb-3 flex flex-wrap items-center gap-2">
                            <Play size={16} className="text-neon-cyan" />
                            <span className="text-sm font-semibold">Дивитися</span>
                            <Select value={current.key} onChange={(e) => setPlayer(e.target.value)} className="!w-80">
                                {players.map((p) => (
                                    <option key={p.key} value={p.key}>
                                        {p.translation ?? 'Без назви'} · {p.provider_label}
                                        {p.quality ? ` · ${p.quality}` : ''}
                                    </option>
                                ))}
                            </Select>
                            {d.episodes?.length ? (
                                <>
                                    <Select
                                        value={pick?.season ?? ''}
                                        onChange={(e) => {
                                            const s = d.episodes!.find((x) => x.number === Number(e.target.value));
                                            if (s)
                                                choose({
                                                    season: s.number,
                                                    episode: s.episodes[0],
                                                });
                                        }}
                                        className="!w-36"
                                    >
                                        {d.episodes.map((s) => (
                                            <option key={s.number} value={s.number}>
                                                Сезон {s.number}
                                            </option>
                                        ))}
                                    </Select>
                                    <Button small disabled={at <= 0} onClick={() => choose(flat[at - 1])}>
                                        <ChevronLeft size={14} /> Попередня
                                    </Button>
                                    <Button small disabled={at < 0 || at >= flat.length - 1} onClick={() => choose(flat[at + 1])}>
                                        Наступна <ChevronRight size={14} />
                                    </Button>
                                </>
                            ) : null}
                        </div>
                        {season && (
                            <div className="mb-3 flex flex-wrap gap-1.5">
                                {season.episodes.map((e) => (
                                    <button
                                        key={e}
                                        type="button"
                                        onClick={() =>
                                            choose({
                                                season: season.number,
                                                episode: e,
                                            })
                                        }
                                        className={`h-8 min-w-10 rounded-lg px-2 text-sm ring-1 ${pick?.episode === e ? 'bg-neon-cyan/20 ring-neon-cyan/60' : 'ring-white/10 hover:bg-white/5'}`}
                                    >
                                        {e}
                                    </button>
                                ))}
                            </div>
                        )}
                        <div className="aspect-video overflow-hidden rounded-xl bg-black ring-1 ring-white/10">
                            <iframe
                                key={`${current.key}-${pick?.season}-${pick?.episode}`}
                                src={episodeLink(current.provider, current.link, d.episodes?.length ? pick : null)}
                                title={m.title}
                                allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
                                allowFullScreen
                                className="h-full w-full"
                            />
                        </div>
                    </Card>
                ) : (
                    <Card>
                        <p className="py-6 text-center text-sm text-white/50">Плеєр для цього тайтлу ще не додали.</p>
                    </Card>
                )}
                <Tabs
                    tabs={[
                        { id: 'about', label: 'Про фільм' },
                        {
                            id: 'comments',
                            label: 'Коментарі',
                            badge: m.comments_count,
                        },
                        { id: 'reviews', label: 'Рецензії' },
                        { id: 'talk', label: 'Обговорення' },
                    ]}
                    value={tab}
                    onChange={setTab}
                />
                {tab === 'about' && (
                    <div className="space-y-5">
                        <div className="grid grid-cols-[minmax(0,1fr)_320px] gap-5 max-[1100px]:grid-cols-1">
                            <Card title="Опис">
                                {m.description ? (
                                    <p className="text-sm leading-relaxed whitespace-pre-wrap text-white/75">{m.description}</p>
                                ) : (
                                    <p className="text-sm text-white/45">Опису поки немає.</p>
                                )}
                            </Card>
                            <Card
                                title={
                                    <span className="flex items-center gap-2">
                                        <Users size={15} /> Друзі · {d.friends.total}
                                    </span>
                                }
                            >
                                {d.friends.users.length === 0 && <p className="text-sm text-white/45">Друзі ще не дивилися.</p>}
                                {d.friends.users.slice(0, 8).map((u) => (
                                    <button
                                        key={u.id}
                                        type="button"
                                        onClick={() => u.username && nav.go(`/u/${u.username}`)}
                                        className="flex w-full items-center gap-2.5 rounded-lg px-1 py-1.5 text-left hover:bg-white/5"
                                    >
                                        <Avatar user={u} size={28} />
                                        <span className="flex-1 truncate text-sm">{u.name}</span>
                                        {u.movie_rating ? <span className="text-xs text-amber-300">★ {u.movie_rating}</span> : null}
                                    </button>
                                ))}
                            </Card>
                        </div>
                        {d.similar.length > 0 && (
                            <section>
                                <h2 className="mb-3 text-lg font-bold">Схоже</h2>
                                <div className="grid grid-cols-[repeat(auto-fill,minmax(130px,1fr))] gap-4">
                                    {d.similar.slice(0, 12).map((s) => (
                                        <Poster key={s.id} m={s} onOpen={() => nav.go(`/cinema/${s.slug}`)} />
                                    ))}
                                </div>
                            </section>
                        )}
                    </div>
                )}
                {tab === 'comments' && <Comments slug={slug} enabled={m.comments_enabled} />}
                {tab === 'reviews' && <Reviews slug={slug} />}
                {tab === 'talk' && <Discussions subject={{ type: 'movie', id: m.id }} />}
            </div>
        </div>
    );
}

type Comment = {
    id: number;
    body: string;
    spoiler: boolean;
    user: User;
    created_at: string;
    likes_count: number;
    can_delete: boolean;
};
function Comments({ slug, enabled }: { slug: string; enabled: boolean }) {
    const page = useSite<{ comments: Comment[] }>(`/cinema/${slug}/comments`);
    const { run, busy } = useAction();
    const [body, setBody] = useState('');
    const [shown, setShown] = useState<Record<number, boolean>>({});
    if (!page.data) return <Loading error={page.error} />;
    return (
        <Card>
            {enabled && (
                <div className="mb-4 flex gap-2">
                    <TextArea rows={2} value={body} maxLength={2000} placeholder="Ваш коментар…" onChange={(e) => setBody(e.target.value)} />
                    <Button
                        tone="primary"
                        disabled={busy || !body.trim()}
                        onClick={() => void run('POST', `/cinema/${slug}/comments`, { body }, 'Коментар додано.', async () => (setBody(''), await page.reload()))}
                    >
                        Надіслати
                    </Button>
                </div>
            )}
            {page.data.comments.length === 0 && <p className="text-sm text-white/45">Коментарів ще немає.</p>}
            <div className="space-y-3">
                {page.data.comments.map((c) => (
                    <div key={c.id} className="flex gap-3">
                        <Avatar user={c.user} size={34} />
                        <div className="min-w-0 flex-1 rounded-xl bg-white/[0.04] px-3 py-2 text-sm">
                            <b>{c.user.name}</b> <span className="text-xs text-white/40">{when(c.created_at)}</span>
                            <p onClick={() => setShown({ ...shown, [c.id]: true })} className={`whitespace-pre-wrap text-white/80 ${c.spoiler && !shown[c.id] ? 'cursor-pointer blur-sm' : ''}`}>
                                {c.body}
                            </p>
                        </div>
                    </div>
                ))}
            </div>
        </Card>
    );
}

type Review = {
    id: number;
    body: string;
    score: number;
    spoiler: boolean;
    likes_count: number;
    user: User;
    created_at: string;
};
function Reviews({ slug }: { slug: string }) {
    const page = useSite<{
        reviews: { data: Review[] };
        summary: { count: number; average: number };
        mine: Review | null;
    }>(`/api/v1/cinema/${slug}/reviews`);
    const toast = useToast();
    const [f, setF] = useState({ body: '', score: '8', spoiler: false });
    if (!page.data) return <Loading error={page.error} />;
    const list = page.data.reviews.data;
    const submit = async (): Promise<void> => {
        try {
            await api('POST', `/api/v1/cinema/${slug}/reviews`, {
                body: f.body,
                score: Number(f.score),
                spoiler: f.spoiler,
            });
            toast('Рецензію опубліковано.');
            setF({ body: '', score: '8', spoiler: false });
            await page.reload();
        } catch (e) {
            toast((e as Error).message, 'error');
        }
    };
    return (
        <div className="grid grid-cols-[minmax(0,1fr)_340px] gap-5 max-[1000px]:grid-cols-1">
            <div className="space-y-3">
                {page.data.summary.count > 0 && (
                    <p className="text-sm text-white/55">
                        Середня оцінка <b className="text-amber-300">{page.data.summary.average}</b> · {page.data.summary.count} рецензій
                    </p>
                )}
                {list.length === 0 && <p className="py-8 text-center text-sm text-white/45">Рецензій ще немає.</p>}
                {list.map((r) => (
                    <Card key={r.id}>
                        <div className="mb-2 flex items-center gap-3">
                            <Avatar user={r.user} size={32} />
                            <span className="flex-1 text-sm font-semibold">{r.user.name}</span>
                            <span className="text-lg font-bold text-amber-300">{r.score}</span>
                        </div>
                        <p className="text-sm whitespace-pre-wrap text-white/75">{r.body}</p>
                    </Card>
                ))}
            </div>
            {!page.data.mine && (
                <Card title="Моя рецензія">
                    <div className="space-y-2">
                        <TextArea rows={6} placeholder="Що думаєте?" value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} />
                        <Select value={f.score} onChange={(e) => setF({ ...f, score: e.target.value })}>
                            {Array.from({ length: 10 }, (_, i) => 10 - i).map((n) => (
                                <option key={n} value={n}>
                                    {n} з 10
                                </option>
                            ))}
                        </Select>
                        <label className="flex items-center gap-2 text-sm text-white/70">
                            <input type="checkbox" checked={f.spoiler} onChange={(e) => setF({ ...f, spoiler: e.target.checked })} /> Є спойлери
                        </label>
                        <Button tone="primary" disabled={f.body.trim().length < 20} onClick={() => void submit()}>
                            Опублікувати
                        </Button>
                    </div>
                </Card>
            )}
        </div>
    );
}
