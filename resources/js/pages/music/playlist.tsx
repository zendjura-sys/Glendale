import { Head, Link, router } from '@inertiajs/react';
import {
    Globe2,
    Lock,
    MoreHorizontal,
    PenLine,
    Trash2,
    UserPlus,
} from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { SongList } from '@/components/am/song-list';
import { EmptyNote, LargeTitle, PlayShuffle } from '@/components/am/ui';
import { UserAvatar } from '@/components/gc/user-avatar';
import { PlaylistCover } from '@/components/music/playlist-card';
import { PlaylistDialog } from '@/components/music/playlist-dialog';
import { SpotifyLogo } from '@/components/music/track-cover';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { api } from '@/lib/api';
import { formatLength } from '@/lib/format';
import { tr } from '@/lib/i18n';
import { playQueue, shuffled } from '@/lib/player';
import { usePlugin } from '@/lib/plugins';
import type { PlaylistDetails, TrackCard } from '@/types';

type Props = {
    playlist: PlaylistDetails;
    tracks: TrackCard[];
    can: { manage: boolean; own: boolean };
    collaborators: { username: string; name: string }[];
};

const item =
    'gap-3 rounded-lg px-2.5 py-2 text-[15px] focus:bg-[var(--am-fill)] [&_svg]:size-[18px]';

/**
 * Плейлист як в Apple Music: обкладинка по центру, назва, автор, опис, «Слухати / Перемішати»,
 * меню «⋯» (редагувати, спільний доступ, імпорт зі Spotify, видалити) і список пісень.
 */
export default function PlaylistShow({
    playlist,
    tracks: initial,
    can,
    collaborators,
}: Props) {
    const shareOn = usePlugin('shared_playlist');
    const spotifyOn = usePlugin('spotify_import');
    const [editing, setEditing] = useState(false);
    const [tracks, setTracks] = useState(initial);
    const duration = tracks.reduce((sum, t) => sum + (t.duration || 0), 0);

    const detach = async (track: TrackCard) => {
        if (track.source !== 'local') return;
        await api(
            'DELETE',
            `/music/playlists/${playlist.id}/tracks/${track.id}`,
        );
        setTracks((all) => all.filter((t) => t.key !== track.key));
        toast.success(tr('Трек прибрано з плейлиста.'));
    };

    const share = () => {
        const username = window.prompt(
            tr('Нік друга, з яким ведете плейлист разом:'),
        );
        if (username)
            router.post(`/music/playlists/${playlist.id}/share`, {
                username: username.trim().replace(/^@/, ''),
            });
    };

    const importSpotify = () => {
        const id = window.prompt(tr('Посилання чи ID плейлиста Spotify:'));
        if (id)
            router.post(`/music/playlists/${playlist.id}/spotify`, {
                playlist: id.trim(),
            });
    };

    const destroy = () => {
        if (
            window.confirm(
                tr('Видалити плейлист «{title}»?', { title: playlist.title }),
            )
        )
            router.delete(`/music/playlists/${playlist.id}`);
    };

    return (
        <>
            <Head title={playlist.title} />
            <LargeTitle
                title=""
                className="pb-0"
                back={{
                    href: '/music/library/playlists',
                    label: tr('Плейлисти'),
                }}
                actions={
                    can.own ? (
                        <DropdownMenu>
                            <DropdownMenuTrigger
                                aria-label={tr('Ще')}
                                className="flex size-9 items-center justify-center rounded-full bg-[var(--am-fill)] text-[var(--am-accent)] outline-none"
                            >
                                <MoreHorizontal className="size-5" />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent
                                align="end"
                                className="am w-60 rounded-2xl border-[var(--am-sep)] bg-[var(--am-elevated)] p-1.5 text-[var(--am-label)]"
                            >
                                <DropdownMenuItem
                                    className={item}
                                    onSelect={() => setEditing(true)}
                                >
                                    <PenLine /> {tr('Редагувати')}
                                </DropdownMenuItem>
                                {shareOn && (
                                    <DropdownMenuItem
                                        className={item}
                                        onSelect={share}
                                    >
                                        <UserPlus /> {tr('Спільний плейлист…')}
                                    </DropdownMenuItem>
                                )}
                                {spotifyOn && (
                                    <DropdownMenuItem
                                        className={item}
                                        onSelect={importSpotify}
                                    >
                                        <SpotifyLogo className="size-[18px]" />{' '}
                                        {tr('Імпорт зі Spotify…')}
                                    </DropdownMenuItem>
                                )}
                                <DropdownMenuSeparator className="bg-[var(--am-sep)]" />
                                <DropdownMenuItem
                                    className={`${item} text-[var(--am-accent)]`}
                                    onSelect={destroy}
                                >
                                    <Trash2 /> {tr('Видалити плейлист')}
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    ) : undefined
                }
            />

            <div className="px-[var(--am-gutter)] text-center lg:flex lg:items-end lg:gap-8 lg:text-left">
                <PlaylistCover
                    playlist={playlist}
                    className="am-art mx-auto w-[min(70vw,300px)] rounded-[10px] shadow-[0_18px_40px_-16px_rgb(0_0_0/0.45)] lg:mx-0 lg:w-[270px]"
                />
                <div className="mt-4 min-w-0 lg:mt-0">
                    <h1 className="am-title2 break-words lg:text-[30px] lg:leading-9">
                        {playlist.title}
                    </h1>
                    <Link
                        href={`/${playlist.owner.username}`}
                        className="am-title2 mt-0.5 inline-flex items-center gap-1.5 font-normal text-[var(--am-accent)] hover:underline"
                    >
                        <UserAvatar
                            user={playlist.owner}
                            size="xs"
                            showOnline={false}
                        />
                        {playlist.owner.name}
                    </Link>
                    <p className="am-footnote mt-1 flex items-center justify-center gap-1.5 font-semibold text-[var(--am-label2)] lg:justify-start">
                        {playlist.is_public ? (
                            <Globe2 className="size-3.5" />
                        ) : (
                            <Lock className="size-3.5" />
                        )}
                        {playlist.is_public
                            ? tr('Відкритий плейлист')
                            : tr('Приватний плейлист')}
                        {shareOn &&
                            collaborators.length > 0 &&
                            ` · ${tr('разом із {names}', { names: collaborators.map((c) => c.name).join(', ') })}`}
                    </p>
                    {playlist.description && (
                        <p className="am-subhead mx-auto mt-2 max-w-xl whitespace-pre-line text-[var(--am-label2)] lg:mx-0">
                            {playlist.description}
                        </p>
                    )}
                    <div className="mt-4 lg:w-[420px]">
                        <PlayShuffle
                            onPlay={() => playQueue(tracks, 0)}
                            onShuffle={() => playQueue(shuffled(tracks), 0)}
                            disabled={tracks.length === 0}
                        />
                    </div>
                </div>
            </div>

            {tracks.length === 0 ? (
                <EmptyNote
                    title={tr('Плейлист порожній')}
                    text={
                        can.manage
                            ? tr(
                                  'Додавайте пісні через меню «⋯ → Додати в плейлист».',
                              )
                            : tr('Автор ще не додав сюди пісень.')
                    }
                    action={
                        can.manage ? (
                            <Link
                                href="/music/library/songs"
                                className="am-headline text-[var(--am-accent)]"
                            >
                                {tr('До пісень')}
                            </Link>
                        ) : undefined
                    }
                />
            ) : (
                <>
                    <SongList
                        tracks={tracks}
                        className="mt-5"
                        extra={(t) => t.album ?? undefined}
                        onRemove={
                            can.manage ? (t) => void detach(t) : undefined
                        }
                        removeLabel={tr('Прибрати з плейлиста')}
                    />
                    <p className="am-footnote px-[var(--am-gutter)] pt-3 text-[var(--am-label2)]">
                        {tr('{n} пісень, {length}', {
                            n: tracks.length,
                            length: formatLength(duration),
                        })}
                    </p>
                </>
            )}

            <PlaylistDialog
                open={editing}
                onOpenChange={setEditing}
                playlist={playlist}
            />
        </>
    );
}
