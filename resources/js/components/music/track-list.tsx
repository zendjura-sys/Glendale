import {
    Check,
    Download,
    ExternalLink,
    Headphones,
    ListEnd,
    ListPlus,
    MoreHorizontal,
    Pause,
    PenLine,
    Play,
    Plus,
    Share2,
    Trash2,
} from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuSub,
    DropdownMenuSubContent,
    DropdownMenuSubTrigger,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { api, ApiError } from '@/lib/api';
import { compactNumber, formatDuration } from '@/lib/format';
import {
    patchTrack,
    playNext,
    playQueue,
    toggle,
    usePlayer,
} from '@/lib/player';
import { cn } from '@/lib/utils';
import type { LocalTrack, PlaylistCard, TrackCard } from '@/types';
import { EditTrackDialog } from './edit-track-dialog';
import { PlaylistDialog } from './playlist-dialog';
import { ShareTrackDialog } from './share-track-dialog';
import { Equalizer, SpotifyLogo, TrackCover } from './track-cover';
import { tr } from '@/lib/i18n';

const itemClass = 'rounded-lg focus:bg-white/[0.06]';

type Props = {
    tracks: TrackCard[];
    playlists?: PlaylistCard[];
    userId?: number;
    isAdmin?: boolean;
    showPlays?: boolean;
    onRemove?: (track: TrackCard) => void;
    removeLabel?: string;
};

export function TrackList({
    tracks,
    playlists,
    userId,
    isAdmin,
    showPlays,
    onRemove,
    removeLabel,
}: Props) {
    const player = usePlayer();
    const [overrides, setOverrides] = useState<
        Record<string, Partial<LocalTrack>>
    >({});
    const [hidden, setHidden] = useState<string[]>([]);
    const [sharing, setSharing] = useState<TrackCard | null>(null);
    const [editing, setEditing] = useState<LocalTrack | null>(null);
    const [newPlaylistFor, setNewPlaylistFor] = useState<number | null>(null);

    const list = tracks
        .filter((t) => !hidden.includes(t.key))
        .map((t) =>
            overrides[t.key] ? ({ ...t, ...overrides[t.key] } as TrackCard) : t,
        );

    const patch = (track: TrackCard, value: Partial<LocalTrack>) => {
        setOverrides((all) => ({
            ...all,
            [track.key]: { ...all[track.key], ...value },
        }));
        patchTrack(track.key, value);
    };

    const toggleLibrary = async (track: LocalTrack) => {
        const next = !track.in_library;
        patch(track, { in_library: next });
        try {
            await api(
                next ? 'POST' : 'DELETE',
                `/music/tracks/${track.id}/library`,
            );
            toast.success(
                next
                    ? tr('Додано до ваших аудіозаписів.')
                    : tr('Прибрано з ваших аудіозаписів.'),
            );
        } catch {
            patch(track, { in_library: !next });
        }
    };

    const addToPlaylist = async (playlist: PlaylistCard, track: LocalTrack) => {
        try {
            const response = await api<{ added: boolean }>(
                'POST',
                `/music/playlists/${playlist.id}/tracks/${track.id}`,
            );
            toast.success(
                response.added
                    ? tr('Додано в «{title}».', { title: playlist.title })
                    : tr('Трек уже є в «{title}».', { title: playlist.title }),
            );
        } catch (error) {
            toast.error(
                error instanceof ApiError ? error.message : tr('Не вдалося.'),
            );
        }
    };

    const similar = async (track: LocalTrack) => {
        try {
            const data = await api<{ tracks: TrackCard[] }>(
                'GET',
                `/music/tracks/${track.id}/similar`,
            );
            if (data.tracks.length === 0) {
                toast(tr('Схожих треків у каталозі немає.'));
                return;
            }
            playQueue([track, ...data.tracks], 0);
        } catch (error) {
            toast.error(
                error instanceof ApiError
                    ? error.message
                    : tr('Не вдалося знайти схожі треки.'),
            );
        }
    };

    const destroy = async (track: LocalTrack) => {
        if (
            !window.confirm(
                tr('Видалити «{title}» з GameCon?', { title: track.title }),
            )
        )
            return;
        await api('DELETE', `/music/tracks/${track.id}`);
        setHidden((all) => [...all, track.key]);
        toast.success(tr('Трек видалено.'));
    };

    return (
        <>
            <ol className="space-y-0.5">
                {list.map((track, index) => {
                    const isCurrent = player.current?.key === track.key;
                    const playing = isCurrent && player.playing;
                    const canManage =
                        track.source === 'local' &&
                        (track.user_id === userId || isAdmin);

                    return (
                        <li
                            key={track.key}
                            className={cn(
                                'group flex items-center gap-3 rounded-2xl p-2 pr-2.5 transition hover:bg-white/[0.045]',
                                isCurrent &&
                                    'bg-gradient-to-r from-gc-indigo/15 to-transparent',
                            )}
                            onDoubleClick={() => playQueue(list, index)}
                        >
                            <button
                                type="button"
                                onClick={() =>
                                    isCurrent
                                        ? toggle()
                                        : playQueue(list, index)
                                }
                                className="relative shrink-0"
                                aria-label={
                                    playing ? tr('Пауза') : tr('Слухати')
                                }
                            >
                                <TrackCover
                                    url={track.cover_url}
                                    seed={track.key}
                                    className="size-11 rounded-xl"
                                />
                                <span
                                    className={cn(
                                        'absolute inset-0 flex items-center justify-center rounded-xl bg-black/50 transition',
                                        isCurrent
                                            ? 'opacity-100'
                                            : 'opacity-0 group-hover:opacity-100 [@media(hover:none)]:opacity-100',
                                    )}
                                >
                                    {playing ? (
                                        <Pause className="size-4 fill-white text-white" />
                                    ) : (
                                        <Play className="ml-0.5 size-4 fill-white text-white" />
                                    )}
                                </span>
                            </button>

                            <div className="min-w-0 flex-1">
                                <p
                                    className={cn(
                                        'flex items-center gap-2 text-sm font-medium',
                                        isCurrent
                                            ? 'text-[#c3caff]'
                                            : 'text-white',
                                    )}
                                >
                                    {isCurrent && (
                                        <Equalizer paused={!playing} />
                                    )}
                                    <span className="truncate">
                                        {track.title}
                                    </span>
                                    {track.source === 'spotify' &&
                                        track.explicit && (
                                            <span className="rounded bg-white/15 px-1 text-xs leading-4 font-bold text-white/70">
                                                E
                                            </span>
                                        )}
                                </p>
                                <p className="truncate text-xs text-white/50">
                                    {track.artist}
                                </p>
                            </div>

                            {track.album && (
                                <span className="hidden w-[24%] truncate text-xs text-white/40 md:block">
                                    {track.album}
                                </span>
                            )}
                            {showPlays && track.source === 'local' && (
                                <span className="hidden w-16 text-right text-xs text-white/35 tabular-nums sm:block">
                                    <Headphones className="mr-1 inline size-3 align-[-1px]" />
                                    {compactNumber(track.plays_count)}
                                </span>
                            )}

                            {track.source === 'local' ? (
                                <button
                                    type="button"
                                    onClick={() => toggleLibrary(track)}
                                    className={cn(
                                        'flex size-8 items-center justify-center rounded-full transition',
                                        track.in_library
                                            ? 'text-gc-lilac-400'
                                            : 'text-white/40 opacity-100 hover:bg-white/10 hover:text-white sm:opacity-0 sm:group-hover:opacity-100 [@media(hover:none)]:opacity-100',
                                    )}
                                    aria-label={
                                        track.in_library
                                            ? tr('Прибрати з моїх аудіозаписів')
                                            : tr('Додати до моїх аудіозаписів')
                                    }
                                    title={
                                        track.in_library
                                            ? tr('У моїх аудіозаписах')
                                            : tr('Додати собі')
                                    }
                                >
                                    {track.in_library ? (
                                        <Check className="size-4" />
                                    ) : (
                                        <Plus className="size-4" />
                                    )}
                                </button>
                            ) : (
                                <SpotifyLogo className="size-4 opacity-70" />
                            )}

                            <span className="w-10 text-right text-xs text-white/40 tabular-nums">
                                {formatDuration(track.duration)}
                            </span>

                            <DropdownMenu>
                                <DropdownMenuTrigger className="flex size-8 items-center justify-center rounded-full text-white/40 transition outline-none hover:bg-white/10 hover:text-white data-[state=open]:bg-white/10">
                                    <MoreHorizontal className="size-4" />
                                </DropdownMenuTrigger>
                                <DropdownMenuContent
                                    align="end"
                                    className="glass-strong w-56 rounded-2xl border-white/10 p-1.5 text-white"
                                >
                                    <DropdownMenuItem
                                        className={itemClass}
                                        onSelect={() => playNext(track)}
                                    >
                                        <ListEnd /> {tr('Слухати наступним')}
                                    </DropdownMenuItem>
                                    {track.source === 'local' && playlists && (
                                        <DropdownMenuSub>
                                            <DropdownMenuSubTrigger className="rounded-lg focus:bg-white/[0.06] data-[state=open]:bg-white/[0.06]">
                                                <ListPlus className="size-4 text-white/60" />
                                                {tr('До плейлиста')}
                                            </DropdownMenuSubTrigger>
                                            <DropdownMenuSubContent className="glass-strong max-h-72 w-56 overflow-y-auto rounded-2xl border-white/10 p-1.5 text-white">
                                                {playlists.map((playlist) => (
                                                    <DropdownMenuItem
                                                        key={playlist.id}
                                                        className={itemClass}
                                                        onSelect={() =>
                                                            addToPlaylist(
                                                                playlist,
                                                                track,
                                                            )
                                                        }
                                                    >
                                                        <span className="truncate">
                                                            {playlist.title}
                                                        </span>
                                                    </DropdownMenuItem>
                                                ))}
                                                {playlists.length > 0 && (
                                                    <DropdownMenuSeparator className="bg-white/5" />
                                                )}
                                                <DropdownMenuItem
                                                    className={itemClass}
                                                    onSelect={() =>
                                                        setNewPlaylistFor(
                                                            track.id,
                                                        )
                                                    }
                                                >
                                                    <Plus />{' '}
                                                    {tr('Новий плейлист')}
                                                </DropdownMenuItem>
                                            </DropdownMenuSubContent>
                                        </DropdownMenuSub>
                                    )}
                                    <DropdownMenuItem
                                        className={itemClass}
                                        onSelect={() => setSharing(track)}
                                    >
                                        <Share2 /> {tr('Поділитися на стіні')}
                                    </DropdownMenuItem>
                                    {track.source === 'local' && (
                                        <DropdownMenuItem
                                            className={itemClass}
                                            onSelect={() => void similar(track)}
                                        >
                                            <Headphones /> {tr('Схожі треки')}
                                        </DropdownMenuItem>
                                    )}
                                    {track.source === 'local' ? (
                                        <DropdownMenuItem
                                            className={itemClass}
                                            asChild
                                        >
                                            <a
                                                href={`/music/tracks/${track.id}/download`}
                                            >
                                                <Download /> {tr('Завантажити')}
                                            </a>
                                        </DropdownMenuItem>
                                    ) : (
                                        <DropdownMenuItem
                                            className={itemClass}
                                            asChild
                                        >
                                            <a
                                                href={track.url}
                                                target="_blank"
                                                rel="noreferrer"
                                            >
                                                <ExternalLink />{' '}
                                                {tr('Відкрити у Spotify')}
                                            </a>
                                        </DropdownMenuItem>
                                    )}
                                    {canManage && (
                                        <DropdownMenuItem
                                            className={itemClass}
                                            onSelect={() => setEditing(track)}
                                        >
                                            <PenLine /> {tr('Редагувати')}
                                        </DropdownMenuItem>
                                    )}
                                    {(onRemove || canManage) && (
                                        <DropdownMenuSeparator className="bg-white/5" />
                                    )}
                                    {onRemove && (
                                        <DropdownMenuItem
                                            className="rounded-lg text-rose-300 focus:bg-rose-500/10 focus:text-rose-200"
                                            onSelect={() => {
                                                setHidden((all) => [
                                                    ...all,
                                                    track.key,
                                                ]);
                                                onRemove(track);
                                            }}
                                        >
                                            <Trash2 className="text-rose-300" />{' '}
                                            {removeLabel ?? tr('Прибрати')}
                                        </DropdownMenuItem>
                                    )}
                                    {canManage && (
                                        <DropdownMenuItem
                                            className="rounded-lg text-rose-300 focus:bg-rose-500/10 focus:text-rose-200"
                                            onSelect={() => destroy(track)}
                                        >
                                            <Trash2 className="text-rose-300" />{' '}
                                            {tr('Видалити з сайту')}
                                        </DropdownMenuItem>
                                    )}
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </li>
                    );
                })}
            </ol>

            <ShareTrackDialog
                track={sharing}
                onOpenChange={(open) => !open && setSharing(null)}
            />
            <EditTrackDialog
                track={editing}
                onOpenChange={(open) => !open && setEditing(null)}
                onSaved={(track) => patch(track, track)}
            />
            {newPlaylistFor !== null && (
                <PlaylistDialog
                    open
                    onOpenChange={(open) => !open && setNewPlaylistFor(null)}
                    trackId={newPlaylistFor}
                />
            )}
        </>
    );
}
