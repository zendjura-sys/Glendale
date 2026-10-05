import { router, usePage } from '@inertiajs/react';
import {
    ArrowLeft,
    Clock3,
    Flame,
    Heart,
    Library,
    Link2Off,
    ListMusic,
    Play,
    Radio,
    Search,
    Settings2,
    Sparkles,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { Toggle } from '@/components/gc/admin';
import { api, ApiError } from '@/lib/api';
import { playQueue } from '@/lib/player';
import { cn } from '@/lib/utils';
import type {
    SpotifyAccountCard,
    SpotifyPlaylist,
    SpotifyTrack,
} from '@/types';
import { SpotifyLogo } from './track-cover';
import { TrackList } from './track-list';
import { tr } from '@/lib/i18n';

type Section = 'search' | 'top' | 'recent' | 'saved' | 'playlists';

const sections: { value: Section; label: string; icon: typeof Flame }[] = [
    { value: 'top', label: tr('Мій топ'), icon: Flame },
    { value: 'recent', label: tr('Нещодавні'), icon: Clock3 },
    { value: 'saved', label: tr('Улюблені'), icon: Heart },
    { value: 'playlists', label: tr('Плейлисти'), icon: Library },
    { value: 'search', label: tr('Пошук'), icon: Search },
];

function useSpotify<T>(url: string | null) {
    const [state, setState] = useState<{
        url: string | null;
        data: T | null;
        error: string | null;
    }>({ url: null, data: null, error: null });

    useEffect(() => {
        if (!url) return;
        let cancelled = false;
        api<T>('GET', url)
            .then((data) => !cancelled && setState({ url, data, error: null }))
            .catch(
                (error) =>
                    !cancelled &&
                    setState({
                        url,
                        data: null,
                        error:
                            error instanceof ApiError
                                ? error.message
                                : tr('Spotify недоступний.'),
                    }),
            );

        return () => {
            cancelled = true;
        };
    }, [url]);

    return {
        loading: url !== null && state.url !== url,
        data: state.url === url ? state.data : null,
        error: state.url === url ? state.error : null,
    };
}

function Skeleton() {
    return (
        <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 p-2">
                    <span className="skeleton size-11 rounded-xl" />
                    <span className="flex-1 space-y-1.5">
                        <span className="skeleton block h-3.5 w-1/3 rounded" />
                        <span className="skeleton block h-3 w-1/5 rounded" />
                    </span>
                </div>
            ))}
        </div>
    );
}

function Tracks({ url, empty }: { url: string | null; empty: string }) {
    const { loading, data, error } = useSpotify<{ tracks: SpotifyTrack[] }>(
        url,
    );

    if (!url) return null;
    if (loading) return <Skeleton />;
    if (error)
        return (
            <p className="py-10 text-center text-sm text-rose-300">{error}</p>
        );
    if (!data?.tracks.length)
        return (
            <p className="py-10 text-center text-sm text-white/45">{empty}</p>
        );

    return (
        <>
            <button
                type="button"
                onClick={() => playQueue(data.tracks, 0)}
                className="mb-3 inline-flex items-center gap-2 rounded-full bg-[#1ed760] px-4 py-2 text-sm font-semibold text-[#06140b] transition hover:scale-[1.03]"
            >
                <Play className="size-4 fill-current" /> {tr('Слухати все')}
            </button>
            <TrackList tracks={data.tracks} />
        </>
    );
}

function Playlists() {
    const [open, setOpen] = useState<SpotifyPlaylist | null>(null);
    const { loading, data, error } = useSpotify<{
        playlists: SpotifyPlaylist[];
    }>('/music/spotify/library/playlists');

    if (open) {
        return (
            <div>
                <button
                    type="button"
                    onClick={() => setOpen(null)}
                    className="mb-3 inline-flex items-center gap-1.5 text-sm text-white/55 hover:text-white"
                >
                    <ArrowLeft className="size-4" /> {tr('Усі плейлисти')}
                </button>
                <div className="mb-4 flex items-center gap-4">
                    {open.cover_url && (
                        <img
                            src={open.cover_url}
                            alt=""
                            className="size-20 rounded-2xl object-cover"
                        />
                    )}
                    <div>
                        <h3 className="font-display text-xl font-semibold text-white">
                            {open.name}
                        </h3>
                        <p className="text-xs text-white/45">
                            {open.owner} · {open.tracks_count} {tr('треків')}
                        </p>
                    </div>
                </div>
                <Tracks
                    url={`/music/spotify/playlists/${open.id}`}
                    empty={tr('Плейлист порожній.')}
                />
            </div>
        );
    }

    if (loading) return <Skeleton />;
    if (error)
        return (
            <p className="py-10 text-center text-sm text-rose-300">{error}</p>
        );
    if (!data?.playlists.length)
        return (
            <p className="py-10 text-center text-sm text-white/45">
                {tr('У вашому Spotify поки немає плейлистів.')}
            </p>
        );

    return (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {data.playlists.map((playlist) => (
                <button
                    key={playlist.id}
                    type="button"
                    onClick={() => setOpen(playlist)}
                    className="group rounded-2xl bg-white/[0.035] p-3 text-left transition hover:bg-white/[0.07]"
                >
                    <span className="relative block aspect-square overflow-hidden rounded-xl bg-white/5">
                        {playlist.cover_url ? (
                            <img
                                src={playlist.cover_url}
                                alt=""
                                className="size-full object-cover transition duration-500 group-hover:scale-105"
                            />
                        ) : (
                            <ListMusic className="absolute inset-0 m-auto size-8 text-white/30" />
                        )}
                        <span className="absolute right-2 bottom-2 flex size-10 translate-y-2 items-center justify-center rounded-full bg-[#1ed760] text-[#06140b] opacity-0 shadow-lg transition group-hover:translate-y-0 group-hover:opacity-100 [@media(hover:none)]:opacity-100">
                            <Play className="ml-0.5 size-4 fill-current" />
                        </span>
                    </span>
                    <span className="mt-2 block truncate text-sm font-semibold text-white">
                        {playlist.name}
                    </span>
                    <span className="block truncate text-xs text-white/45">
                        {playlist.tracks_count} {tr('треків')}
                    </span>
                </button>
            ))}
        </div>
    );
}

function SearchSection() {
    const [q, setQ] = useState('');
    const [query, setQuery] = useState('');

    useEffect(() => {
        const timer = setTimeout(() => setQuery(q.trim()), 350);

        return () => clearTimeout(timer);
    }, [q]);

    return (
        <div>
            <label className="input-glass mb-4 flex h-12 items-center gap-3 rounded-2xl px-4">
                <Search className="size-4 text-white/40" />
                <input
                    value={q}
                    onChange={(event) => setQ(event.target.value)}
                    autoFocus
                    placeholder={tr('Трек, виконавець або альбом у Spotify')}
                    className="min-w-0 flex-1 bg-transparent text-sm text-white placeholder:text-white/35 focus:outline-none"
                />
            </label>
            {query ? (
                <Tracks
                    url={`/music/spotify/search?q=${encodeURIComponent(query)}`}
                    empty={tr('Нічого не знайдено.')}
                />
            ) : (
                <p className="py-10 text-center text-sm text-white/40">
                    {tr('Понад 100 мільйонів треків — почніть вводити запит.')}
                </p>
            )}
        </div>
    );
}

export function SpotifyPanel({
    configured,
    account,
}: {
    configured: boolean;
    account: SpotifyAccountCard | null;
}) {
    const { auth } = usePage().props;
    const [section, setSection] = useState<Section>(account ? 'top' : 'search');

    if (!configured) {
        return (
            <div className="glass flex flex-col items-center rounded-3xl px-6 py-14 text-center">
                <SpotifyLogo className="size-14 opacity-60" />
                <h3 className="mt-4 font-display text-lg font-semibold text-white">
                    {tr('Spotify ще не підключено до GameCon')}
                </h3>
                <p className="mt-2 max-w-md text-sm text-white/50">
                    {tr(
                        'Щойно адміністратор додасть ключі застосунку Spotify, тут з’являться пошук, ваш топ, плейлисти й відтворення.',
                    )}
                </p>
                {auth.user.is_admin && (
                    <a
                        href="/admin/integrations"
                        className="btn-glow mt-5 inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold"
                    >
                        <Settings2 className="size-4" />{' '}
                        {tr('Налаштувати інтеграцію')}
                    </a>
                )}
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {account ? (
                <section className="glass relative overflow-hidden rounded-3xl p-5">
                    <div className="pointer-events-none absolute -top-24 -right-16 size-72 rounded-full bg-[#1ed760]/15 blur-3xl" />
                    <div className="relative flex flex-wrap items-center gap-4">
                        {account.avatar_url ? (
                            <img
                                src={account.avatar_url}
                                alt=""
                                className="size-14 rounded-full object-cover ring-2 ring-[#1ed760]/60"
                            />
                        ) : (
                            <span className="flex size-14 items-center justify-center rounded-full bg-[#1ed760]/15">
                                <SpotifyLogo className="size-7" />
                            </span>
                        )}
                        <div className="min-w-0 flex-1">
                            <p className="flex items-center gap-2 text-xs font-medium text-[#1ed760]">
                                <SpotifyLogo className="size-3.5" />{' '}
                                {tr('Spotify під’єднано')}
                            </p>
                            <a
                                href={account.profile_url}
                                target="_blank"
                                rel="noreferrer"
                                className="block truncate font-display text-lg font-semibold text-white hover:underline"
                            >
                                {account.display_name ?? account.spotify_id}
                            </a>
                            <p className="text-xs text-white/50">
                                {account.premium ? (
                                    <span className="mr-2 rounded-full bg-gradient-to-r from-[#1ed760] to-[#38e1ff] px-2 py-0.5 font-semibold text-[#04140a]">
                                        Premium
                                    </span>
                                ) : (
                                    <span className="mr-2 rounded-full bg-white/10 px-2 py-0.5 font-medium text-white/70">
                                        Free
                                    </span>
                                )}
                                {account.premium
                                    ? tr('Повні треки прямо в плеєрі GameCon')
                                    : tr(
                                          'Треки грають через вбудований плеєр Spotify',
                                      )}
                            </p>
                        </div>
                        <label className="flex items-center gap-2.5 rounded-xl bg-white/[0.04] px-3 py-2 text-xs text-white/70">
                            <Radio className="size-4 text-[#1ed760]" />
                            {tr('Показувати «Зараз грає»')}
                            <Toggle
                                checked={account.show_now_playing}
                                onChange={(value) =>
                                    router.patch(
                                        '/music/spotify',
                                        { show_now_playing: value },
                                        { preserveScroll: true },
                                    )
                                }
                                label={tr('Показувати «Зараз грає»')}
                            />
                        </label>
                        <button
                            type="button"
                            onClick={() =>
                                window.confirm(tr('Від’єднати Spotify?')) &&
                                router.delete('/music/spotify', {
                                    preserveScroll: true,
                                })
                            }
                            className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs text-white/50 transition hover:bg-rose-500/10 hover:text-rose-300"
                        >
                            <Link2Off className="size-4" /> {tr('Від’єднати')}
                        </button>
                    </div>
                </section>
            ) : (
                <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#0f3d24] via-[#0b1d1a] to-[#120c2c] p-6 ring-1 ring-[#1ed760]/25 sm:p-8">
                    <div className="pointer-events-none absolute -top-20 -right-20 size-80 rounded-full bg-[#1ed760]/25 blur-3xl" />
                    <div className="relative flex flex-wrap items-center gap-6">
                        <SpotifyLogo className="size-16 drop-shadow-[0_0_24px_rgb(30_215_96/0.6)]" />
                        <div className="min-w-0 flex-1">
                            <h3 className="font-display text-2xl font-bold text-white">
                                {tr('Під’єднайте свій Spotify')}
                            </h3>
                            <ul className="mt-2 grid grid-cols-1 gap-1 text-sm text-white/70 sm:grid-cols-2">
                                <li className="flex items-center gap-2">
                                    <Sparkles className="size-4 text-[#1ed760]" />
                                    {tr('Ваш топ, улюблені й плейлисти')}
                                </li>
                                <li className="flex items-center gap-2">
                                    <Sparkles className="size-4 text-[#1ed760]" />
                                    {tr('Повні треки з Premium у GameCon')}
                                </li>
                                <li className="flex items-center gap-2">
                                    <Sparkles className="size-4 text-[#1ed760]" />
                                    {tr('«Зараз грає» у вашому профілі')}
                                </li>
                                <li className="flex items-center gap-2">
                                    <Sparkles className="size-4 text-[#1ed760]" />
                                    {tr('Діліться треками на стіні')}
                                </li>
                            </ul>
                        </div>
                        <a
                            href="/music/spotify/connect"
                            className="inline-flex h-12 items-center gap-2 rounded-full bg-[#1ed760] px-6 text-sm font-bold text-[#04140a] shadow-[0_0_30px_-6px_rgb(30_215_96/0.9)] transition hover:scale-[1.03]"
                        >
                            <SpotifyLogo className="size-5 fill-[#04140a]" />
                            {tr('Увійти через Spotify')}
                        </a>
                    </div>
                </section>
            )}

            <section className="glass rounded-3xl p-3 sm:p-4">
                <div className="mb-4 flex gap-1 overflow-x-auto rounded-xl bg-white/[0.04] p-1">
                    {sections
                        .filter((s) => account || s.value === 'search')
                        .map((item) => (
                            <button
                                key={item.value}
                                type="button"
                                onClick={() => setSection(item.value)}
                                className={cn(
                                    'inline-flex h-9 shrink-0 items-center gap-2 rounded-lg px-3 text-sm font-medium transition',
                                    section === item.value
                                        ? 'bg-white/10 text-white'
                                        : 'text-white/50 hover:text-white',
                                )}
                            >
                                <item.icon className="size-4" />
                                {item.label}
                            </button>
                        ))}
                </div>
                {section === 'search' && <SearchSection />}
                {section === 'playlists' && <Playlists />}
                {section === 'top' && (
                    <Tracks
                        url="/music/spotify/library/top"
                        empty={tr(
                            'Spotify ще не зібрав ваш топ — послухайте більше музики.',
                        )}
                    />
                )}
                {section === 'recent' && (
                    <Tracks
                        url="/music/spotify/library/recent"
                        empty={tr('Історія прослуховувань порожня.')}
                    />
                )}
                {section === 'saved' && (
                    <Tracks
                        url="/music/spotify/library/saved"
                        empty={tr('Немає вподобаних треків.')}
                    />
                )}
            </section>
        </div>
    );
}
