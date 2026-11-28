import { Heart, Music as MusicIcon, Pause, Play, Plus, Radio, Search } from 'lucide-react';
import { useState } from 'react';
import { Button, Card, Cover, Input, Loading, PageHeader, StatTile, Tabs, useSite, useToast } from '@/components/kit';
import { api } from '@/lib/api';
import { useNav } from '@/lib/nav';
import { mmss, player, type Track, usePlayer } from '@/lib/player';
import { NowPlaying } from './NowPlaying';

type Tile = { kind: string; key?: string; name?: string; title?: string; artist?: string; colors?: string[]; covers?: string[]; cover_url?: string | null; href?: string; tracks_count?: number };
type TabId = 'home' | 'new' | 'radio' | 'charts' | 'library' | 'search';

/** Назви й підписи міксів і станцій (сервер віддає лише ключі) — як на сайті. */
const MIX: Record<string, [string, string]> = {
    favorites: ['Мікс улюбленого', 'Те, що ти слухаєш найчастіше'],
    discovery: ['Мікс відкриттів', 'Нове для тебе у твоїх жанрах'],
    new: ['Мікс новинок', 'Свіжі треки, що можуть сподобатись'],
    friends: ['Мікс друзів', 'Що слухають твої друзі'],
    chill: ['Мікс для відпочинку', 'Спокійна музика без поспіху'],
    'mood-raid': ['Рейд', 'Важкий і швидкий звук для бою'],
    'mood-match': ['Катка', 'Ритм, що тримає в грі'],
    'mood-chill': ['Чіл', 'Після катки — видихнути'],
    'mood-focus': ['Фокус', 'Без слів — для тренувань'],
    'mood-night': ['Нічний стрім', 'Синтвейв і нічні вайби'],
};
const tileTitle = (t: Tile): string => {
    if (t.kind === 'station') return t.key === 'me' ? `Станція ${t.name ?? ''}` : t.key?.startsWith('group:') ? `Станція «${t.name}»` : `Станція ${t.name ?? ''}`;
    return MIX[t.key ?? '']?.[0] ?? t.name ?? t.title ?? t.key ?? '';
};
const tileSub = (t: Tile): string | undefined => (t.kind === 'station' ? (t.key === 'me' ? 'На основі того, що ти слухаєш' : 'Нескінченна станція') : (MIX[t.key ?? '']?.[1] ?? t.artist));

/** Список треків: номер / грати, назва й виконавець, альбом, тривалість, вподобати, у медіатеку. */
export function TrackList({ tracks, numbered = true }: { tracks: Track[]; numbered?: boolean }) {
    const p = usePlayer();
    const toast = useToast();
    const [fav, setFav] = useState<Record<number, boolean>>({});
    const like = async (t: Track): Promise<void> => {
        const on = !(fav[t.id] ?? t.favorite);
        setFav((f) => ({ ...f, [t.id]: on }));
        await api(on ? 'POST' : 'DELETE', `/api/v1/site/music/tracks/${t.id}/favorite`).catch(() => undefined);
    };
    const add = async (t: Track): Promise<void> => {
        await api('POST', `/api/v1/site/music/tracks/${t.id}/library`).then(() => toast('Додано в медіатеку.'), (e: Error) => toast(e.message, 'error'));
    };
    if (!tracks.length) return <p className="py-6 text-center text-sm text-white/45">Треків немає.</p>;
    return (
        <div>
            {tracks.map((t, i) => {
                const now = p.current?.key === t.key;
                const liked = fav[t.id] ?? t.favorite;
                return (
                    <div key={`${t.key}-${i}`} className={`group grid grid-cols-[36px_44px_minmax(0,1fr)_minmax(0,0.7fr)_60px_76px] items-center gap-3 rounded-xl px-2 py-1.5 ${now ? 'bg-neon-cyan/[0.08]' : 'hover:bg-white/[0.05]'}`}>
                        <button type="button" onClick={() => (now ? player.toggle() : player.play(tracks, i))} className="grid h-8 w-8 place-items-center text-sm text-white/45" aria-label="Грати">
                            {now && p.playing ? <Pause size={15} className="text-neon-cyan" /> : <span className="group-hover:hidden">{numbered ? i + 1 : <Play size={14} />}</span>}
                            {!(now && p.playing) && <Play size={15} className="hidden text-white group-hover:block" />}
                        </button>
                        <Cover src={t.cover_url} className="h-11 w-11 rounded-md" fallback={<MusicIcon size={15} />} />
                        <span className="min-w-0">
                            <span className={`block truncate text-sm font-medium ${now ? 'text-neon-cyan' : ''}`}>{t.title}</span>
                            <span className="block truncate text-xs text-white/50">{t.artist}</span>
                        </span>
                        <span className="truncate text-xs text-white/40">{t.album}</span>
                        <span className="text-right text-xs text-white/40">{t.duration ? mmss(t.duration) : ''}</span>
                        <span className="flex justify-end gap-0.5 opacity-60 group-hover:opacity-100">
                            <button type="button" onClick={() => void like(t)} aria-label="Улюблене" className={`grid h-8 w-8 place-items-center rounded-lg hover:bg-white/10 ${liked ? 'text-rose-400' : 'text-white/50'}`}>
                                <Heart size={15} fill={liked ? 'currentColor' : 'none'} />
                            </button>
                            {!t.in_library && (
                                <button type="button" onClick={() => void add(t)} aria-label="У медіатеку" className="grid h-8 w-8 place-items-center rounded-lg text-white/50 hover:bg-white/10">
                                    <Plus size={16} />
                                </button>
                            )}
                        </span>
                    </div>
                );
            })}
        </div>
    );
}

/** Плитка міксу / станції / альбому з кольоровим градієнтом. */
function TileCard({ t, onOpen }: { t: Tile; onOpen: () => void }) {
    const [a, b] = t.colors ?? ['#2f7bff', '#a855f7'];
    const cover = t.cover_url ?? t.covers?.[0] ?? null;
    return (
        <button type="button" onClick={onOpen} className="group text-left">
            <div className="relative aspect-square overflow-hidden rounded-2xl ring-1 ring-white/10 transition group-hover:-translate-y-0.5" style={{ background: `linear-gradient(135deg, ${a}, ${b})` }}>
                {cover && <Cover src={cover} className="absolute inset-0 h-full w-full opacity-70 mix-blend-luminosity" />}
                <span className="absolute right-3 bottom-3 grid h-11 w-11 translate-y-2 place-items-center rounded-full bg-white text-black opacity-0 shadow-xl transition group-hover:translate-y-0 group-hover:opacity-100">
                    <Play size={18} fill="currentColor" className="ml-0.5" />
                </span>
                {t.kind === 'station' && <Radio size={18} className="absolute top-3 left-3 text-white/80" />}
            </div>
            <p className="mt-2 truncate text-sm font-semibold">{tileTitle(t)}</p>
            {tileSub(t) && <p className="truncate text-xs text-white/50">{tileSub(t)}</p>}
        </button>
    );
}

function Shelf({ title, tiles, onOpen }: { title: string; tiles: Tile[]; onOpen: (t: Tile) => void }) {
    if (!tiles?.length) return null;
    return (
        <section>
            <h2 className="mb-3 text-lg font-bold">{title}</h2>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,180px))] gap-4">
                {tiles.slice(0, 12).map((t, i) => (
                    <TileCard key={`${t.key ?? t.title}-${i}`} t={t} onOpen={() => onOpen(t)} />
                ))}
            </div>
        </section>
    );
}

/** «Музика»: головна з міксами, нове, радіо-станції, чарти, медіатека, пошук; плеєр унизу вікна. */
export function MusicPage() {
    const nav = useNav();
    const toast = useToast();
    const [tab, setTab] = useState<TabId>('home');
    const [q, setQ] = useState('');
    const [query, setQuery] = useState('');
    // Відкрити плитку: станція — одразу грати, мікс/альбом/жанр/артист — сторінка.
    const open = async (t: Tile): Promise<void> => {
        if (t.kind === 'station' && t.key) {
            const r = await api<{ tracks: Track[] }>('GET', `/api/v1/site/music/station?key=${encodeURIComponent(t.key)}`).catch(() => null);
            if (r?.tracks.length) player.play(r.tracks);
            else toast('Станція поки порожня.', 'error');
            return;
        }
        if (t.href) nav.go(t.href);
    };
    return (
        <div className="flex h-full flex-col">
            <PageHeader
                title="Музика"
                subtitle="Слухайте, збирайте й діліться"
                actions={
                    <form onSubmit={(e) => (e.preventDefault(), setQuery(q.trim()), setTab('search'))} className="relative">
                        <Search size={15} className="absolute top-3 left-3 text-white/40" />
                        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Трек, виконавець, альбом" className="!w-72 pl-9" />
                    </form>
                }
            />
            <Tabs
                tabs={[
                    { id: 'home', label: 'Головна' },
                    { id: 'new', label: 'Нове' },
                    { id: 'radio', label: 'Радіо' },
                    { id: 'charts', label: 'Чарти' },
                    { id: 'library', label: 'Медіатека' },
                    { id: 'search', label: 'Пошук' },
                ]}
                value={tab}
                onChange={setTab}
            />
            <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_340px] gap-5 px-5 pt-5 max-[1100px]:grid-cols-1">
                <div className="min-h-0 overflow-y-auto pb-5">
                {tab === 'home' && <Home open={open} />}
                {tab === 'new' && <New open={open} />}
                {tab === 'radio' && <RadioTab open={open} />}
                {tab === 'charts' && <Charts />}
                {tab === 'library' && <Library />}
                {tab === 'search' && <SearchTab q={query} />}
                </div>
                {/* Праворуч — великий плеєр, швидкі дії й черга. */}
                <div className="min-h-0 overflow-y-auto pb-5 max-[1100px]:hidden">
                    <NowPlaying onTab={setTab} />
                </div>
            </div>
        </div>
    );
}

function Home({ open }: { open: (t: Tile) => void }) {
    const page = useSite<{ home: { top_picks: Tile[]; made_for_you: Tile[]; moods: Tile[]; stations: Tile[]; recently_played: Tile[]; replay?: { year: number; tracks: Track[] } } }>('/music/home');
    if (!page.data) return <Loading error={page.error} />;
    const h = page.data.home;
    return (
        <div className="space-y-8">
            <Shelf title="Для вас" tiles={h.top_picks} onOpen={open} />
            <Shelf title="Зроблено для вас" tiles={h.made_for_you} onOpen={open} />
            <Shelf title="Нещодавно слухали" tiles={h.recently_played} onOpen={open} />
            <Shelf title="Настрій" tiles={h.moods} onOpen={open} />
            <Shelf title="Станції" tiles={h.stations} onOpen={open} />
            {h.replay?.tracks?.length ? (
                <Card title={`Ваш ${h.replay.year} у треках`}>
                    <TrackList tracks={h.replay.tracks.slice(0, 10)} />
                </Card>
            ) : null}
        </div>
    );
}

function New({ open }: { open: (t: Tile) => void }) {
    const page = useSite<{ data: { latest_songs: Track[]; new_albums: Tile[]; genres: { name: string; tracks_count: number; cover_url: string | null; href: string }[] } }>('/music/new');
    if (!page.data) return <Loading error={page.error} />;
    const d = page.data.data;
    return (
        <div className="space-y-8">
            <Shelf title="Нові альбоми" tiles={d.new_albums} onOpen={open} />
            <Card title="Нові треки">
                <TrackList tracks={d.latest_songs} />
            </Card>
            <Shelf title="Жанри" tiles={d.genres.map((g) => ({ kind: 'genre', name: g.name, cover_url: g.cover_url, href: g.href }))} onOpen={open} />
        </div>
    );
}

function RadioTab({ open }: { open: (t: Tile) => void }) {
    const page = useSite<{ data: { my_station: Tile; genre_stations: Tile[]; group_stations: Tile[]; live: Tile[] } }>('/music/radio');
    if (!page.data) return <Loading error={page.error} />;
    const d = page.data.data;
    return (
        <div className="space-y-8">
            <button type="button" onClick={() => open(d.my_station)} className="flex w-full items-center gap-5 rounded-3xl p-6 text-left ring-1 ring-white/10 transition hover:brightness-110" style={{ background: `linear-gradient(120deg, ${(d.my_station.colors ?? ['#2f7bff', '#22d3ee']).join(', ')})` }}>
                <span className="grid h-16 w-16 place-items-center rounded-full bg-white text-black">
                    <Play size={26} fill="currentColor" className="ml-1" />
                </span>
                <span>
                    <span className="block text-2xl font-bold">Моя хвиля</span>
                    <span className="text-sm text-white/80">Нескінченна станція за вашим смаком</span>
                </span>
            </button>
            <Shelf title="Наживо" tiles={d.live} onOpen={open} />
            <Shelf title="Станції за жанрами" tiles={d.genre_stations} onOpen={open} />
            <Shelf title="Станції спільнот" tiles={d.group_stations} onOpen={open} />
        </div>
    );
}

function Charts() {
    const page = useSite<{ charts: { week: Track[]; country: Track[]; country_name: string | null } }>('/music/charts');
    if (!page.data) return <Loading error={page.error} />;
    const c = page.data.charts;
    return (
        <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-5 max-[1100px]:grid-cols-1">
            <Card title="Топ тижня" actions={<Button small tone="primary" onClick={() => player.play(c.week)}><Play size={13} /> Слухати все</Button>}>
                <TrackList tracks={c.week} />
            </Card>
            <Card title={`Топ: ${c.country_name ?? 'Україна'}`} actions={c.country.length > 0 && <Button small tone="primary" onClick={() => player.play(c.country)}><Play size={13} /> Слухати все</Button>}>
                <TrackList tracks={c.country} />
            </Card>
        </div>
    );
}

const SECTIONS: [string, string][] = [
    ['songs', 'Пісні'],
    ['favorites', 'Улюблене'],
    ['playlists', 'Плейлисти'],
    ['albums', 'Альбоми'],
    ['artists', 'Виконавці'],
];

function Library() {
    const nav = useNav();
    const counts = useSite<{ data: { counts: Record<string, number> } }>('/music/library');
    const [section, setSection] = useState('songs');
    const page = useSite<{ items: (Tile & { id?: number })[]; songs: { data: Track[] } | null }>(`/music/library/${section}`);
    const c = counts.data?.data.counts ?? {};
    return (
        <div className="space-y-4">
            <div className="grid grid-cols-[repeat(auto-fit,minmax(140px,1fr))] gap-3">
                {SECTIONS.map(([k, v]) => (
                    <button key={k} type="button" onClick={() => setSection(k)} className={`rounded-xl text-left ring-1 transition ${section === k ? 'ring-neon-cyan/50' : 'ring-transparent'}`}>
                        <StatTile label={v} value={c[k] ?? 0} accent={section === k} />
                    </button>
                ))}
            </div>
            {!page.data && <Loading error={page.error} />}
            {page.data?.songs?.data && (
                <Card title={SECTIONS.find(([k]) => k === section)?.[1]} actions={page.data.songs.data.length > 0 && <Button small tone="primary" onClick={() => player.play(page.data!.songs!.data)}><Play size={13} /> Слухати</Button>}>
                    <TrackList tracks={page.data.songs.data} />
                </Card>
            )}
            {page.data && page.data.items.length > 0 && (
                <div className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-4">
                    {page.data.items.map((t, i) => (
                        <TileCard key={i} t={t} onOpen={() => t.href && nav.go(t.href)} />
                    ))}
                </div>
            )}
        </div>
    );
}

function SearchTab({ q }: { q: string }) {
    const page = useSite<{ tracks: Track[] }>(q ? `/music/search?q=${encodeURIComponent(q)}&scope=all` : null);
    if (!q) return <p className="py-12 text-center text-sm text-white/45">Введіть назву треку чи виконавця вгорі.</p>;
    if (!page.data) return <Loading error={page.error} />;
    return (
        <Card title={`Знайдено: ${page.data.tracks.length}`}>
            <TrackList tracks={page.data.tracks} />
        </Card>
    );
}

/** Сторінки колекцій: альбом, виконавець, жанр, мікс, настрій, плейлист — заголовок з градієнтом і треки. */
export function MusicCollection({ path }: { path: string }) {
    const nav = useNav();
    const page = useSite<Record<string, unknown>>(path);
    if (!page.data) return <Loading error={page.error} />;
    const d = page.data as {
        album?: { title: string; artist: string; artist_href?: string; cover_url: string | null; year?: number | null; tracks: Track[] };
        artist?: { name: string; cover_url: string | null; genre?: string | null; tracks_count: number; listeners?: number; top_songs: Track[]; albums: Tile[] };
        genre?: { name: string; popular: Track[]; latest: Track[] };
        mix?: Tile;
        playlist?: { title: string; description: string | null; cover_url: string | null; tracks_count: number; owner?: { name: string } };
        tracks?: Track[];
    };
    const title = d.album?.title ?? d.artist?.name ?? d.genre?.name ?? d.playlist?.title ?? (d.mix ? tileTitle(d.mix) : 'Музика');
    const sub = d.album ? `${d.album.artist}${d.album.year ? ` · ${d.album.year}` : ''}` : d.artist ? `${d.artist.genre ?? ''} · ${d.artist.tracks_count} треків` : d.playlist ? `${d.playlist.owner?.name ?? ''} · ${d.playlist.tracks_count} треків` : d.genre ? 'Жанр' : 'Мікс';
    const cover = d.album?.cover_url ?? d.artist?.cover_url ?? d.playlist?.cover_url ?? null;
    const tracks = d.album?.tracks ?? d.artist?.top_songs ?? d.tracks ?? d.genre?.popular ?? [];
    const colors = d.mix?.colors ?? ['#2f7bff', '#a855f7'];
    return (
        <div className="h-full overflow-y-auto">
            <div className="relative pb-6" style={{ background: `linear-gradient(180deg, ${colors[0]}55, transparent)` }}>
                <PageHeader title="" />
                <div className="flex items-end gap-6 px-6 pt-1">
                    <Cover src={cover} className="h-44 w-44 shrink-0 rounded-2xl shadow-2xl ring-1 ring-white/15" fallback={<MusicIcon size={44} />} />
                    <div className="min-w-0">
                        <h1 className="truncate text-4xl font-black">{title}</h1>
                        <p className="mt-1 text-sm text-white/65">{sub}</p>
                        {d.playlist?.description && <p className="mt-1 text-sm text-white/55">{d.playlist.description}</p>}
                        <div className="mt-4 flex gap-2">
                            <Button tone="primary" disabled={!tracks.length} onClick={() => player.play(tracks)}>
                                <Play size={15} fill="currentColor" /> Слухати
                            </Button>
                            <Button disabled={!tracks.length} onClick={() => player.play([...tracks].sort(() => Math.random() - 0.5))}>Перемішати</Button>
                            {d.album?.artist_href && <Button onClick={() => nav.go(d.album!.artist_href!)}>До виконавця</Button>}
                        </div>
                    </div>
                </div>
            </div>
            <div className="space-y-6 px-5 pb-6">
                <Card>
                    <TrackList tracks={tracks} />
                </Card>
                {d.genre?.latest?.length ? (
                    <Card title="Нове в жанрі">
                        <TrackList tracks={d.genre.latest} />
                    </Card>
                ) : null}
                {d.artist?.albums?.length ? <Shelf title="Альбоми" tiles={d.artist.albums} onOpen={(t) => t.href && nav.go(t.href)} /> : null}
            </div>
        </div>
    );
}
