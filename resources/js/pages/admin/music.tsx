import { Head, Link, router } from '@inertiajs/react';
import {
    Download,
    HardDrive,
    Headphones,
    ListMusic,
    Music2,
    Pause,
    Play,
    RotateCcw,
    Search,
    Trash2,
} from 'lucide-react';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { PageHeader, Pagination, StatCard } from '@/components/gc/admin';
import { TrackCover } from '@/components/music/track-cover';
import { Input } from '@/components/ui/input';
import {
    compactNumber,
    formatBytes,
    formatDuration,
    timeAgo,
} from '@/lib/format';
import { playTrack, toggle, usePlayer } from '@/lib/player';
import { cn } from '@/lib/utils';
import type { LocalTrack, Paginated, UserCard } from '@/types';
import { tr } from '@/lib/i18n';

type AdminTrack = LocalTrack & {
    size: number | null;
    adds_count: number;
    user: UserCard | null;
    created_at: string;
    deleted_at: string | null;
};

type Props = {
    tracks: Paginated<AdminTrack>;
    filters: { q: string; trashed: boolean };
    stats: {
        tracks: number;
        plays: number;
        size: number;
        playlists: number;
        spotify: number;
        trashed: number;
    };
};

export default function AdminMusic({ tracks, filters, stats }: Props) {
    const [q, setQ] = useState(filters.q);
    const player = usePlayer();

    const apply = (patch: Partial<Props['filters']>) => {
        const next = { ...filters, q, ...patch };
        router.get(
            '/admin/music',
            { q: next.q || undefined, trashed: next.trashed ? 1 : undefined },
            { preserveState: true, preserveScroll: true, replace: true },
        );
    };

    const submit = (e: FormEvent) => {
        e.preventDefault();
        apply({ q });
    };

    const remove = (track: AdminTrack) => {
        if (
            track.deleted_at &&
            !confirm(
                tr('Видалити трек і файл назавжди? Дію не можна скасувати.'),
            )
        ) {
            return;
        }
        router.delete(`/admin/music/${track.id}`, { preserveScroll: true });
    };

    return (
        <>
            <Head title={tr('Музика — Адмін-панель')} />
            <PageHeader
                title={tr('Музика')}
                description={
                    filters.trashed
                        ? tr('У кошику: {total}', { total: tracks.total })
                        : tr(
                              'Усі завантажені треки, модерація та статистика прослуховувань',
                          )
                }
                actions={
                    <div className="glass flex rounded-xl p-1 text-sm">
                        {[
                            { label: tr('Активні'), value: false },
                            {
                                label: tr('Кошик ({trashed})', {
                                    trashed: stats.trashed,
                                }),
                                value: true,
                            },
                        ].map((tab) => (
                            <button
                                key={String(tab.value)}
                                type="button"
                                onClick={() => apply({ trashed: tab.value })}
                                className={cn(
                                    'rounded-lg px-3.5 py-1.5 font-medium transition',
                                    filters.trashed === tab.value
                                        ? 'bg-gradient-brand text-white'
                                        : 'text-white/55 hover:text-white',
                                )}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>
                }
            />

            <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-2 xl:grid-cols-5">
                <StatCard
                    label={tr('Треків')}
                    value={compactNumber(stats.tracks)}
                    icon={Music2}
                />
                <StatCard
                    label={tr('Прослуховувань')}
                    value={compactNumber(stats.plays)}
                    icon={Headphones}
                    tone="from-gc-mint to-gc-cyan"
                    delay={60}
                />
                <StatCard
                    label={tr('Плейлистів')}
                    value={compactNumber(stats.playlists)}
                    icon={ListMusic}
                    tone="from-gc-amber to-gc-pink"
                    delay={120}
                />
                <StatCard
                    label={tr('Spotify-акаунтів')}
                    value={compactNumber(stats.spotify)}
                    icon={Headphones}
                    tone="from-spotify to-gc-mint"
                    delay={180}
                    hint={
                        <Link
                            href="/admin/integrations"
                            className="hover:text-white"
                        >
                            {tr('Налаштувати інтеграцію →')}
                        </Link>
                    }
                />
                <StatCard
                    label={tr('Займають на диску')}
                    value={formatBytes(stats.size)}
                    icon={HardDrive}
                    tone="from-gc-pink to-gc-purple"
                    delay={240}
                />
            </div>

            <form
                onSubmit={submit}
                className="glass relative mb-4 rounded-2xl p-2.5"
            >
                <Search className="pointer-events-none absolute top-1/2 left-6 size-4 -translate-y-1/2 text-white/30" />
                <Input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder={tr('Назва, виконавець, альбом або жанр')}
                    className="h-10 pl-10"
                />
            </form>

            <div className="glass overflow-hidden rounded-3xl">
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[820px] text-sm">
                        <thead>
                            <tr className="border-b border-white/[0.06] text-left text-xs tracking-wider text-white/40 uppercase">
                                <th className="px-4 py-3 font-medium">
                                    {tr('Трек')}
                                </th>
                                <th className="px-3 py-3 font-medium">
                                    {tr('Завантажив')}
                                </th>
                                <th className="px-3 py-3 text-right font-medium">
                                    {tr('Слухали')}
                                </th>
                                <th className="px-3 py-3 text-right font-medium">
                                    {tr('Додали')}
                                </th>
                                <th className="px-3 py-3 text-right font-medium">
                                    {tr('Розмір')}
                                </th>
                                <th className="px-3 py-3 font-medium">
                                    {tr('Дата')}
                                </th>
                                <th className="px-4 py-3" />
                            </tr>
                        </thead>
                        <tbody>
                            {tracks.data.map((track) => {
                                const isCurrent =
                                    player.current?.key === track.key;
                                const playing = isCurrent && player.playing;

                                return (
                                    <tr
                                        key={track.id}
                                        className={cn(
                                            'border-b border-white/[0.04] transition last:border-0 hover:bg-white/[0.03]',
                                            track.deleted_at && 'opacity-60',
                                        )}
                                    >
                                        <td className="px-4 py-2.5">
                                            <div className="flex items-center gap-3">
                                                <button
                                                    type="button"
                                                    disabled={
                                                        !!track.deleted_at
                                                    }
                                                    onClick={() =>
                                                        isCurrent
                                                            ? toggle()
                                                            : playTrack(track)
                                                    }
                                                    className="group relative shrink-0"
                                                    aria-label={tr('Слухати')}
                                                >
                                                    <TrackCover
                                                        url={track.cover_url}
                                                        seed={track.key}
                                                        className="size-10 rounded-lg"
                                                    />
                                                    <span
                                                        className={cn(
                                                            'absolute inset-0 flex items-center justify-center rounded-lg bg-black/50 transition',
                                                            isCurrent
                                                                ? 'opacity-100'
                                                                : 'opacity-0 group-hover:opacity-100 [@media(hover:none)]:opacity-100',
                                                        )}
                                                    >
                                                        {playing ? (
                                                            <Pause className="size-4 fill-white text-white" />
                                                        ) : (
                                                            <Play className="size-4 fill-white text-white" />
                                                        )}
                                                    </span>
                                                </button>
                                                <div className="min-w-0">
                                                    <p className="truncate font-medium text-white">
                                                        {track.title}
                                                    </p>
                                                    <p className="truncate text-xs text-white/45">
                                                        {track.artist} ·{' '}
                                                        {formatDuration(
                                                            track.duration,
                                                        )}
                                                        {track.genre &&
                                                            ` · ${track.genre}`}
                                                    </p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-3 py-2.5 text-white/65">
                                            {track.user ? (
                                                <Link
                                                    href={`/${track.user.username}`}
                                                    className="hover:text-white"
                                                >
                                                    {track.user.name}
                                                </Link>
                                            ) : (
                                                '—'
                                            )}
                                        </td>
                                        <td className="px-3 py-2.5 text-right text-white/65 tabular-nums">
                                            {compactNumber(track.plays_count)}
                                        </td>
                                        <td className="px-3 py-2.5 text-right text-white/65 tabular-nums">
                                            {compactNumber(track.adds_count)}
                                        </td>
                                        <td className="px-3 py-2.5 text-right text-white/50 tabular-nums">
                                            {formatBytes(track.size)}
                                        </td>
                                        <td className="px-3 py-2.5 text-xs whitespace-nowrap text-white/45">
                                            {timeAgo(track.created_at)}
                                        </td>
                                        <td className="px-4 py-2.5">
                                            <div className="flex justify-end gap-1.5">
                                                {!track.deleted_at && (
                                                    <a
                                                        href={`/music/tracks/${track.id}/download`}
                                                        className="flex size-8 items-center justify-center rounded-lg text-white/50 hover:bg-white/10 hover:text-white"
                                                        title={tr(
                                                            'Завантажити',
                                                        )}
                                                    >
                                                        <Download className="size-4" />
                                                    </a>
                                                )}
                                                {track.deleted_at && (
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            router.post(
                                                                `/admin/music/${track.id}/restore`,
                                                                {},
                                                                {
                                                                    preserveScroll: true,
                                                                },
                                                            )
                                                        }
                                                        className="flex size-8 items-center justify-center rounded-lg text-emerald-300 hover:bg-emerald-400/10"
                                                        title={tr('Відновити')}
                                                    >
                                                        <RotateCcw className="size-4" />
                                                    </button>
                                                )}
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        remove(track)
                                                    }
                                                    className="flex size-8 items-center justify-center rounded-lg text-rose-300 hover:bg-rose-400/10"
                                                    title={
                                                        track.deleted_at
                                                            ? tr(
                                                                  'Видалити назавжди',
                                                              )
                                                            : tr('У кошик')
                                                    }
                                                >
                                                    <Trash2 className="size-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
                {tracks.data.length === 0 && (
                    <div className="px-6 py-14 text-center text-sm text-white/40">
                        {tr('Треків не знайдено')}
                    </div>
                )}
            </div>

            <Pagination data={tracks} />
        </>
    );
}
