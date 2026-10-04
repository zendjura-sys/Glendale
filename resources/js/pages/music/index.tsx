import { Head, InfiniteScroll, Link, router, usePage } from '@inertiajs/react';
import {
    Compass,
    Disc3,
    Headphones,
    ListMusic,
    ListPlus,
    Music2,
    Play,
    Search,
    Shuffle,
    Upload,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { EmptyState } from '@/components/gc/widget';
import {
    PlaylistTile,
    playlistGridClass,
} from '@/components/music/playlist-card';
import { PlaylistDialog } from '@/components/music/playlist-dialog';
import { SpotifyPanel } from '@/components/music/spotify-panel';
import { SpotifyLogo } from '@/components/music/track-cover';
import { TrackList } from '@/components/music/track-list';
import { UploadTracksDialog } from '@/components/music/upload-dialog';
import { formatLength, plural } from '@/lib/format';
import { playQueue, shuffled } from '@/lib/player';
import { cn } from '@/lib/utils';
import type {
    PlaylistCard,
    ScrollData,
    SpotifyAccountCard,
    TrackCard,
} from '@/types';
import { tr } from '@/lib/i18n';

type Tab = 'mine' | 'discover' | 'playlists' | 'spotify';

type Props = {
    tab: Tab;
    q: string;
    tracks: ScrollData<TrackCard>;
    playlists: PlaylistCard[];
    stats: { tracks: number; duration: number; playlists: number };
    spotify: { configured: boolean; account: SpotifyAccountCard | null };
    limits: { max_mb: number; formats: string[] };
};

const tabs: { key: Tab; label: string; icon: typeof Music2 }[] = [
    { key: 'mine', label: tr('Мої аудіозаписи'), icon: Headphones },
    { key: 'discover', label: tr('Огляд'), icon: Compass },
    { key: 'playlists', label: tr('Плейлисти'), icon: ListMusic },
    { key: 'spotify', label: 'Spotify', icon: Disc3 },
];

export default function MusicIndex({
    tab,
    q,
    tracks,
    playlists,
    stats,
    spotify,
    limits,
}: Props) {
    const { auth } = usePage().props;
    const [search, setSearch] = useState(q);
    const [uploading, setUploading] = useState(false);
    const [creating, setCreating] = useState(false);
    const showTracks = tab === 'mine' || tab === 'discover';

    useEffect(() => {
        if (search === q) return;
        const timer = setTimeout(() => {
            router.get(
                '/music',
                {
                    tab: tab === 'mine' ? undefined : tab,
                    q: search || undefined,
                },
                { preserveState: true, replace: true, reset: ['tracks'] },
            );
        }, 300);

        return () => clearTimeout(timer);
    }, [search, q, tab]);

    return (
        <>
            <Head title={tr('Музика')} />
            <div className="space-y-5">
                <section className="glass relative overflow-hidden rounded-3xl p-5 sm:p-7">
                    <div className="pointer-events-none absolute -top-24 -right-16 size-80 rounded-full bg-[#a855f7]/25 blur-3xl" />
                    <div className="pointer-events-none absolute -bottom-36 left-10 size-80 rounded-full bg-[#38e1ff]/15 blur-3xl" />
                    <div className="pointer-events-none absolute top-6 right-8 hidden opacity-[0.07] sm:block">
                        <Disc3 className="size-48 animate-[spin_18s_linear_infinite] text-white" />
                    </div>
                    <div className="relative flex flex-col gap-5 sm:flex-row sm:flex-wrap sm:items-end">
                        <div className="min-w-0 flex-1">
                            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-1 text-[11px] font-semibold tracking-wider text-white/60 uppercase">
                                <Music2 className="size-3.5 text-[#8fa0ff]" />
                                {tr('Музика GameCon')}
                            </span>
                            <h1 className="mt-3 font-display text-3xl font-bold text-white sm:text-4xl">
                                {tr('Ваш')}{' '}
                                <span className="text-gradient">
                                    {tr('звук')}
                                </span>
                                {tr(', ваші правила')}
                            </h1>
                            <p className="mt-2 max-w-lg text-sm text-white/55">
                                {tr(
                                    'Завантажуйте треки, збирайте плейлисти, діліться музикою на стіні та слухайте Spotify прямо тут.',
                                )}
                            </p>
                            <div className="mt-4 flex flex-wrap gap-2 text-xs text-white/60">
                                <span className="glass rounded-full px-3 py-1.5">
                                    <b className="text-white">{stats.tracks}</b>{' '}
                                    {plural(stats.tracks, [
                                        'трек',
                                        'треки',
                                        'треків',
                                    ])}
                                </span>
                                <span className="glass rounded-full px-3 py-1.5">
                                    <b className="text-white">
                                        {formatLength(stats.duration)}
                                    </b>{' '}
                                    {tr('музики')}
                                </span>
                                <span className="glass rounded-full px-3 py-1.5">
                                    <b className="text-white">
                                        {stats.playlists}
                                    </b>{' '}
                                    {plural(stats.playlists, [
                                        'плейлист',
                                        'плейлисти',
                                        'плейлистів',
                                    ])}
                                </span>
                                {spotify.account && (
                                    <span className="glass inline-flex items-center gap-1.5 rounded-full px-3 py-1.5">
                                        <SpotifyLogo className="size-3.5" />
                                        {spotify.account.display_name ??
                                            'Spotify'}
                                    </span>
                                )}
                            </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <button
                                type="button"
                                onClick={() => setCreating(true)}
                                className="glass inline-flex h-11 items-center gap-2 rounded-xl px-4 text-sm font-semibold text-white/85 transition hover:text-white"
                            >
                                <ListPlus className="size-4" /> {tr('Плейлист')}
                            </button>
                            <button
                                type="button"
                                onClick={() => setUploading(true)}
                                className="btn-glow inline-flex h-11 items-center gap-2 rounded-xl px-5 text-sm font-semibold"
                            >
                                <Upload className="size-4" />{' '}
                                {tr('Завантажити')}
                            </button>
                        </div>
                    </div>
                </section>

                <div className="glass flex flex-col gap-3 rounded-3xl p-3 md:flex-row md:items-center">
                    <div className="scrollbar-none flex gap-1 overflow-x-auto">
                        {tabs.map((item) => (
                            <Link
                                key={item.key}
                                href={
                                    item.key === 'mine'
                                        ? '/music'
                                        : `/music?tab=${item.key}`
                                }
                                preserveScroll
                                className={cn(
                                    'flex shrink-0 items-center gap-2 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition',
                                    tab === item.key
                                        ? 'nav-active text-white'
                                        : 'text-white/55 hover:bg-white/[0.05] hover:text-white',
                                )}
                            >
                                {item.key === 'spotify' ? (
                                    <SpotifyLogo className="size-4" />
                                ) : (
                                    <item.icon className="size-4" />
                                )}
                                {item.label}
                                {item.key === 'playlists' &&
                                    playlists.length > 0 && (
                                        <span className="rounded-full bg-white/10 px-1.5 text-[11px] text-white/70">
                                            {playlists.length}
                                        </span>
                                    )}
                            </Link>
                        ))}
                    </div>
                    {showTracks && (
                        <label className="input-glass flex h-11 flex-1 items-center gap-2 rounded-xl px-3.5">
                            <Search className="size-4 text-white/40" />
                            <input
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder={
                                    tab === 'mine'
                                        ? tr('Пошук у моїх аудіозаписах')
                                        : tr('Пошук треків на GameCon')
                                }
                                className="h-full flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/35"
                            />
                        </label>
                    )}
                </div>

                {showTracks &&
                    (tracks.data.length === 0 ? (
                        <EmptyState
                            icon={tab === 'mine' ? Headphones : Compass}
                            title={
                                q
                                    ? tr('Нічого не знайдено')
                                    : tab === 'mine'
                                      ? tr('Тут поки тихо')
                                      : tr('На сайті ще немає треків')
                            }
                            text={
                                q
                                    ? tr('Спробуйте інший запит.')
                                    : tr(
                                          'Завантажте свої улюблені треки або додайте їх з огляду.',
                                      )
                            }
                            action={
                                !q && (
                                    <button
                                        type="button"
                                        onClick={() => setUploading(true)}
                                        className="btn-glow rounded-xl px-5 py-2.5 text-sm font-semibold"
                                    >
                                        {tr('Завантажити музику')}
                                    </button>
                                )
                            }
                        />
                    ) : (
                        <section className="glass rounded-3xl p-2 sm:p-3">
                            <div className="mb-1 flex flex-wrap items-center gap-2 p-2">
                                <h2 className="flex-1 font-display text-[13px] font-semibold tracking-wide text-white/70 uppercase">
                                    {tab === 'mine'
                                        ? tr('Мої аудіозаписи')
                                        : q
                                          ? tr('Результати пошуку')
                                          : tr('Популярне на GameCon')}
                                </h2>
                                <button
                                    type="button"
                                    onClick={() => playQueue(tracks.data, 0)}
                                    className="btn-glow inline-flex h-9 items-center gap-1.5 rounded-xl px-4 text-xs font-semibold"
                                >
                                    <Play className="size-3.5 fill-current" />
                                    {tr('Слухати все')}
                                </button>
                                <button
                                    type="button"
                                    onClick={() =>
                                        playQueue(shuffled(tracks.data), 0)
                                    }
                                    className="glass inline-flex h-9 items-center gap-1.5 rounded-xl px-3.5 text-xs font-semibold text-white/80 hover:text-white"
                                >
                                    <Shuffle className="size-3.5" />{' '}
                                    {tr('Перемішати')}
                                </button>
                            </div>
                            <InfiniteScroll data="tracks" preserveUrl>
                                <TrackList
                                    tracks={tracks.data}
                                    playlists={playlists}
                                    userId={auth.user.id}
                                    isAdmin={auth.user.is_admin}
                                    showPlays={tab === 'discover'}
                                />
                            </InfiniteScroll>
                        </section>
                    ))}

                {tab === 'playlists' &&
                    (playlists.length === 0 ? (
                        <EmptyState
                            icon={ListMusic}
                            title={tr('Плейлистів ще немає')}
                            text={tr(
                                'Зберіть треки під настрій: для катки, для дороги чи для сну.',
                            )}
                            action={
                                <button
                                    type="button"
                                    onClick={() => setCreating(true)}
                                    className="btn-glow rounded-xl px-5 py-2.5 text-sm font-semibold"
                                >
                                    {tr('Створити плейлист')}
                                </button>
                            }
                        />
                    ) : (
                        <section className="glass rounded-3xl p-4 sm:p-5">
                            <div className={playlistGridClass}>
                                {playlists.map((playlist) => (
                                    <PlaylistTile
                                        key={playlist.id}
                                        playlist={playlist}
                                    />
                                ))}
                                <button
                                    type="button"
                                    onClick={() => setCreating(true)}
                                    className="flex aspect-square flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-white/15 text-sm font-medium text-white/50 transition hover:border-[#8fa0ff]/50 hover:text-white"
                                >
                                    <ListPlus className="size-7" />
                                    {tr('Новий плейлист')}
                                </button>
                            </div>
                        </section>
                    ))}

                {tab === 'spotify' && (
                    <SpotifyPanel
                        configured={spotify.configured}
                        account={spotify.account}
                    />
                )}
            </div>

            <UploadTracksDialog
                open={uploading}
                onOpenChange={setUploading}
                maxMb={limits.max_mb}
                formats={limits.formats}
            />
            <PlaylistDialog open={creating} onOpenChange={setCreating} />
        </>
    );
}
