import { Head, InfiniteScroll, Link, router } from '@inertiajs/react';
import { ListSkeleton } from '@/components/gc/skeletons';
import { ArrowDownUp, Plus, Search, Upload } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { AlbumTile, PlaylistTile } from '@/components/am/cards';
import { SongList } from '@/components/am/song-list';
import { useTrackActions } from '@/components/am/track-actions';
import {
    Artwork,
    CircleButton,
    EmptyNote,
    LargeTitle,
    PlayShuffle,
} from '@/components/am/ui';
import { SpotifyPanel } from '@/components/music/spotify-panel';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuRadioGroup,
    DropdownMenuRadioItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useUploadMusic } from '@/layouts/music-layout';
import { tr } from '@/lib/i18n';
import { playQueue, shuffled } from '@/lib/player';
import type {
    AlbumCard,
    ArtistCard,
    GenreCard,
    LibraryPlaylist,
    ScrollData,
    SpotifyAccountCard,
    TrackCard,
} from '@/types';

type Section =
    | 'playlists'
    | 'artists'
    | 'albums'
    | 'songs'
    | 'favorites'
    | 'genres'
    | 'spotify';

function title(section: Section) {
    return {
        playlists: tr('Плейлисти'),
        artists: tr('Виконавці'),
        albums: tr('Альбоми'),
        songs: tr('Пісні'),
        favorites: tr('Улюблені пісні'),
        genres: tr('Жанри'),
        spotify: 'Spotify',
    }[section];
}

/** Пісні медіатеки: пошук, сортування, «Слухати / Перемішати» й підвантаження під час прокрутки. */
function Songs({
    section,
    songs,
    sort,
    q,
}: {
    section: Section;
    songs: ScrollData<TrackCard>;
    sort: string;
    q: string;
}) {
    const [query, setQuery] = useState(q);
    const first = useRef(true);
    const upload = useUploadMusic();

    useEffect(() => {
        if (first.current) {
            first.current = false;

            return;
        }
        const id = setTimeout(
            () =>
                router.get(
                    `/music/library/${section}`,
                    { q: query || undefined, sort },
                    { preserveState: true, replace: true },
                ),
            300,
        );

        return () => clearTimeout(id);
    }, [query, section, sort]);

    const sorts = [
        { value: 'added', label: tr('Нещодавно додані') },
        { value: 'title', label: tr('Назва') },
        { value: 'artist', label: tr('Виконавець') },
        { value: 'plays', label: tr('Найпопулярніші') },
    ];

    return (
        <>
            <div className="flex items-center gap-2 px-[var(--am-gutter)] pb-3">
                <label className="flex h-9 flex-1 items-center gap-2 rounded-[10px] bg-[var(--am-fill)] px-2.5">
                    <Search className="size-4 text-[var(--am-label2)]" />
                    <input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder={
                            section === 'favorites'
                                ? tr('Шукати в улюблених')
                                : tr('Шукати в піснях')
                        }
                        className="am-body min-w-0 flex-1 bg-transparent outline-none placeholder:text-[var(--am-label2)]"
                    />
                </label>
                <DropdownMenu>
                    <DropdownMenuTrigger
                        aria-label={tr('Сортування')}
                        className="flex size-9 items-center justify-center rounded-full bg-[var(--am-fill)] text-[var(--am-accent)] outline-none"
                    >
                        <ArrowDownUp className="size-[18px]" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                        align="end"
                        className="am w-56 rounded-2xl border-[var(--am-sep)] bg-[var(--am-elevated)] p-1.5 text-[var(--am-label)]"
                    >
                        <p className="am-footnote px-2.5 py-1.5 font-semibold text-[var(--am-label2)]">
                            {tr('Сортувати')}
                        </p>
                        <DropdownMenuRadioGroup
                            value={sort}
                            onValueChange={(value) =>
                                router.get(
                                    `/music/library/${section}`,
                                    { q: query || undefined, sort: value },
                                    { preserveState: true, replace: true },
                                )
                            }
                        >
                            {sorts.map((s) => (
                                <DropdownMenuRadioItem
                                    key={s.value}
                                    value={s.value}
                                    className="rounded-lg text-[15px] focus:bg-[var(--am-fill)]"
                                >
                                    {s.label}
                                </DropdownMenuRadioItem>
                            ))}
                        </DropdownMenuRadioGroup>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
            {songs.data.length === 0 ? (
                <EmptyNote
                    title={
                        section === 'favorites'
                            ? tr('Немає улюблених пісень')
                            : q
                              ? tr('Нічого не знайдено')
                              : tr('Тут поки тихо')
                    }
                    text={
                        section === 'favorites'
                            ? tr(
                                  'Торкніться зірочки в плеєрі чи в меню «⋯», щоб додати пісню в улюблене.',
                              )
                            : tr(
                                  'Завантажте свою музику або додайте пісні з «Нового».',
                              )
                    }
                    action={
                        section === 'songs' && !q ? (
                            <button
                                type="button"
                                onClick={upload}
                                className="am-headline text-[var(--am-accent)]"
                            >
                                <Upload className="mr-1 inline size-4" />{' '}
                                {tr('Завантажити музику')}
                            </button>
                        ) : undefined
                    }
                />
            ) : (
                <>
                    <div className="px-[var(--am-gutter)] pb-3">
                        <PlayShuffle
                            onPlay={() => playQueue(songs.data, 0)}
                            onShuffle={() => playQueue(shuffled(songs.data), 0)}
                        />
                    </div>
                    <InfiniteScroll
                        data="songs"
                        loading={
                            <ListSkeleton
                                rows={4}
                                avatar="square"
                                card={false}
                            />
                        }
                        preserveUrl
                    >
                        <SongList
                            tracks={songs.data}
                            extra={(t) => t.album ?? undefined}
                        />
                    </InfiniteScroll>
                </>
            )}
        </>
    );
}

export default function MusicLibrarySection({
    section,
    items,
    songs,
    sort,
    q,
    spotify,
}: {
    section: Section;
    items: (LibraryPlaylist | ArtistCard | AlbumCard | GenreCard)[];
    songs: ScrollData<TrackCard> | null;
    sort: string;
    q: string;
    spotify: { configured: boolean; account: SpotifyAccountCard | null } | null;
}) {
    const actions = useTrackActions();

    return (
        <>
            <Head title={title(section)} />
            <LargeTitle
                title={title(section)}
                back={{ href: '/music/library', label: tr('Медіатека') }}
                actions={
                    section === 'playlists' ? (
                        <CircleButton
                            label={tr('Новий плейлист')}
                            onClick={() => actions.newPlaylist()}
                        >
                            <Plus className="size-5" />
                        </CircleButton>
                    ) : undefined
                }
            />

            {section === 'playlists' && (
                <div className="grid grid-cols-2 gap-x-4 gap-y-5 px-[var(--am-gutter)] sm:grid-cols-3 lg:grid-cols-5">
                    <button
                        type="button"
                        onClick={() => actions.newPlaylist()}
                        className="group block text-left"
                    >
                        <span className="am-art flex aspect-square w-full items-center justify-center text-[var(--am-accent)]">
                            <Plus className="size-10" />
                        </span>
                        <span className="am-footnote mt-1.5 block font-medium text-[var(--am-accent)]">
                            {tr('Новий плейлист…')}
                        </span>
                    </button>
                    {(items as LibraryPlaylist[]).map((p) => (
                        <PlaylistTile key={p.id} playlist={p} />
                    ))}
                </div>
            )}

            {section === 'artists' &&
                (items.length === 0 ? (
                    <EmptyNote
                        title={tr('Немає виконавців')}
                        text={tr(
                            'Виконавці з’являться, коли ви додасте їхні пісні в медіатеку.',
                        )}
                    />
                ) : (
                    <ul className="px-[var(--am-gutter)] lg:max-w-3xl">
                        {(items as ArtistCard[]).map((a) => (
                            <li key={a.name}>
                                <Link
                                    href={a.href}
                                    className="flex items-center gap-3 py-1.5"
                                >
                                    <span className="w-12 shrink-0">
                                        <Artwork
                                            src={a.cover_url}
                                            seed={a.name}
                                            round
                                        />
                                    </span>
                                    <span className="am-body flex min-h-12 flex-1 items-center border-b border-[var(--am-sep)]">
                                        {a.name}
                                    </span>
                                </Link>
                            </li>
                        ))}
                    </ul>
                ))}

            {section === 'albums' &&
                (items.length === 0 ? (
                    <EmptyNote
                        title={tr('Немає альбомів')}
                        text={tr(
                            'Альбоми складаються з пісень, у яких указано альбом.',
                        )}
                    />
                ) : (
                    <div className="grid grid-cols-2 gap-x-4 gap-y-5 px-[var(--am-gutter)] sm:grid-cols-3 lg:grid-cols-5">
                        {(items as AlbumCard[]).map((a) => (
                            <AlbumTile key={a.href} album={a} />
                        ))}
                    </div>
                ))}

            {section === 'genres' &&
                (items.length === 0 ? (
                    <EmptyNote title={tr('Немає жанрів')} />
                ) : (
                    <ul className="px-[var(--am-gutter)] lg:max-w-3xl">
                        {(items as GenreCard[]).map((g) => (
                            <li key={g.name}>
                                <Link
                                    href={g.href}
                                    className="flex items-center gap-3 py-1.5"
                                >
                                    <span className="w-12 shrink-0">
                                        <Artwork
                                            src={g.cover_url}
                                            seed={g.name}
                                        />
                                    </span>
                                    <span className="am-body flex min-h-12 flex-1 items-center justify-between border-b border-[var(--am-sep)]">
                                        {g.name}
                                        <span className="am-subhead text-[var(--am-label2)]">
                                            {g.tracks_count}
                                        </span>
                                    </span>
                                </Link>
                            </li>
                        ))}
                    </ul>
                ))}

            {(section === 'songs' || section === 'favorites') && songs && (
                <Songs section={section} songs={songs} sort={sort} q={q} />
            )}

            {section === 'spotify' && spotify && (
                <div className="px-[var(--am-gutter)]">
                    <SpotifyPanel
                        configured={spotify.configured}
                        account={spotify.account}
                    />
                </div>
            )}
        </>
    );
}
