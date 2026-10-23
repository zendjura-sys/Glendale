import { router, usePage } from '@inertiajs/react';
import {
    Disc3,
    Download,
    ExternalLink,
    Info,
    FileText,
    Headphones,
    ListEnd,
    ListPlus,
    ListStart,
    MicVocal,
    MoreHorizontal,
    PenLine,
    Plus,
    Radio,
    Share2,
    Star,
    Trash2,
    UserRound,
} from 'lucide-react';
import {
    createContext,
    useCallback,
    useContext,
    useMemo,
    useState,
    useSyncExternalStore,
} from 'react';
import type { ReactNode } from 'react';
import { toast } from 'sonner';
import { EditTrackDialog } from '@/components/music/edit-track-dialog';
import { LyricsDialog } from '@/components/music/lyrics-dialog';
import { PlaylistDialog } from '@/components/music/playlist-dialog';
import { ShareTrackDialog } from '@/components/music/share-track-dialog';
import { SongInfoDialog } from './song-info';
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
import { tr } from '@/lib/i18n';
import { patchTrack, playLater, playNext, playStation } from '@/lib/player';
import { cn } from '@/lib/utils';
import type { LocalTrack, TrackCard } from '@/types';

/**
 * Дії з треком, як у меню «⋯» Apple Music: улюблене, медіатека, плейлист, грати наступним чи
 * останнім, станція, альбом і виконавець, текст, поділитися, слухати разом, завантажити,
 * редагувати й видалити. Діалоги живуть один раз на розділ (TrackActionsProvider).
 */

// ───────────── Спільні зміни треків (зірочка, медіатека) — видно в усіх списках одразу ─────────────

let patches: Record<string, Partial<LocalTrack>> = {};
const listeners = new Set<() => void>();

function applyPatch(key: string, patch: Partial<LocalTrack>) {
    patches = { ...patches, [key]: { ...patches[key], ...patch } };
    listeners.forEach((l) => l());
    patchTrack(key, patch);
}

/** Трек з урахуванням змін, зроблених у цьому розділі (зірочка, медіатека, редагування). */
export function useTrack<T extends TrackCard>(track: T): T {
    const all = useSyncExternalStore(
        (l) => {
            listeners.add(l);

            return () => listeners.delete(l);
        },
        () => patches,
    );

    return all[track.key] ? ({ ...track, ...all[track.key] } as T) : track;
}

export async function toggleFavorite(track: LocalTrack) {
    const favorite = !track.favorite;
    applyPatch(track.key, {
        favorite,
        in_library: favorite || track.in_library,
    });
    try {
        await api(
            favorite ? 'POST' : 'DELETE',
            `/music/tracks/${track.id}/favorite`,
        );
        toast.success(
            favorite
                ? tr('Додано в «Улюблене».')
                : tr('Прибрано з «Улюбленого».'),
        );
    } catch {
        applyPatch(track.key, {
            favorite: track.favorite,
            in_library: track.in_library,
        });
    }
}

export async function toggleLibrary(track: LocalTrack) {
    const next = !track.in_library;
    applyPatch(track.key, {
        in_library: next,
        favorite: next ? track.favorite : false,
    });
    try {
        await api(
            next ? 'POST' : 'DELETE',
            `/music/tracks/${track.id}/library`,
        );
        toast.success(
            next ? tr('Додано в медіатеку.') : tr('Видалено з медіатеки.'),
        );
    } catch {
        applyPatch(track.key, {
            in_library: track.in_library,
            favorite: track.favorite,
        });
    }
}

// ───────────── Діалоги ─────────────

type Actions = {
    share: (track: TrackCard) => void;
    lyrics: (track: LocalTrack) => void;
    edit: (track: LocalTrack) => void;
    newPlaylist: (trackId?: number) => void;
    info: (track: TrackCard) => void;
};

const ActionsContext = createContext<Actions | null>(null);

export function TrackActionsProvider({ children }: { children: ReactNode }) {
    const [sharing, setSharing] = useState<TrackCard | null>(null);
    const [lyricsFor, setLyricsFor] = useState<LocalTrack | null>(null);
    const [editing, setEditing] = useState<LocalTrack | null>(null);
    const [newPlaylist, setNewPlaylist] = useState<{ trackId?: number } | null>(
        null,
    );
    const [info, setInfo] = useState<TrackCard | null>(null);

    const value = useMemo<Actions>(
        () => ({
            share: setSharing,
            lyrics: setLyricsFor,
            edit: setEditing,
            newPlaylist: (trackId) => setNewPlaylist({ trackId }),
            info: setInfo,
        }),
        [],
    );

    return (
        <ActionsContext.Provider value={value}>
            {children}
            <ShareTrackDialog
                track={sharing}
                onOpenChange={(open) => !open && setSharing(null)}
            />
            <LyricsDialog
                track={lyricsFor}
                onOpenChange={(open) => !open && setLyricsFor(null)}
            />
            <EditTrackDialog
                track={editing}
                onOpenChange={(open) => !open && setEditing(null)}
                onSaved={(track) => applyPatch(track.key, track)}
            />
            <SongInfoDialog
                track={info}
                onOpenChange={(open) => !open && setInfo(null)}
            />
            {newPlaylist && (
                <PlaylistDialog
                    open
                    onOpenChange={(open) => !open && setNewPlaylist(null)}
                    trackId={newPlaylist.trackId}
                />
            )}
        </ActionsContext.Provider>
    );
}

export function useTrackActions(): Actions {
    const actions = useContext(ActionsContext);
    if (!actions) throw new Error('TrackActionsProvider is missing');

    return actions;
}

// ───────────── Меню «⋯» ─────────────

const item =
    'gap-3 rounded-lg px-2.5 py-2 text-[15px] focus:bg-[var(--am-fill)] [&_svg]:size-[18px]';

function albumHref(track: TrackCard) {
    return `/music/album?artist=${encodeURIComponent(track.artist)}&title=${encodeURIComponent(track.album ?? '')}`;
}

export function artistHref(name: string) {
    return `/music/artist?name=${encodeURIComponent(name)}`;
}

function PlaylistSub({ track }: { track: LocalTrack }) {
    const actions = useTrackActions();
    const [playlists, setPlaylists] = useState<
        { id: number; title: string }[] | null
    >(null);
    const load = useCallback(() => {
        if (playlists !== null) return;
        void api<{ playlists: { id: number; title: string }[] }>(
            'GET',
            '/music/playlists/mine',
        )
            .then((data) => setPlaylists(data.playlists))
            .catch(() => setPlaylists([]));
    }, [playlists]);

    const add = async (playlist: { id: number; title: string }) => {
        try {
            const res = await api<{ added: boolean }>(
                'POST',
                `/music/playlists/${playlist.id}/tracks/${track.id}`,
            );
            toast.success(
                res.added
                    ? tr('Додано в «{title}».', { title: playlist.title })
                    : tr('Трек уже є в «{title}».', { title: playlist.title }),
            );
        } catch (error) {
            toast.error(
                error instanceof ApiError ? error.message : tr('Не вдалося.'),
            );
        }
    };

    return (
        <DropdownMenuSub onOpenChange={(open) => open && load()}>
            <DropdownMenuSubTrigger
                className={cn(item, 'data-[state=open]:bg-[var(--am-fill)]')}
                onPointerEnter={load}
                onFocus={load}
            >
                <ListPlus /> {tr('Додати в плейлист…')}
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="am z-[90] max-h-80 w-60 overflow-y-auto rounded-2xl border-[var(--am-sep)] bg-[var(--am-elevated)] p-1.5 text-[var(--am-label)]">
                <DropdownMenuItem
                    className={item}
                    onSelect={() => actions.newPlaylist(track.id)}
                >
                    <Plus /> {tr('Новий плейлист…')}
                </DropdownMenuItem>
                {playlists && playlists.length > 0 && (
                    <DropdownMenuSeparator className="bg-[var(--am-sep)]" />
                )}
                {playlists === null && (
                    <p className="am-footnote px-2.5 py-2 text-[var(--am-label2)]">
                        {tr('Завантаження…')}
                    </p>
                )}
                {playlists?.map((p) => (
                    <DropdownMenuItem
                        key={p.id}
                        className={item}
                        onSelect={() => void add(p)}
                    >
                        <span className="truncate">{p.title}</span>
                    </DropdownMenuItem>
                ))}
            </DropdownMenuSubContent>
        </DropdownMenuSub>
    );
}

export function TrackMenu({
    track: raw,
    onRemove,
    removeLabel,
    triggerClassName,
    side,
    children,
}: {
    track: TrackCard;
    /** Куди відкривати меню; «top» — над нижньою панеллю плеєра. */
    side?: 'top' | 'bottom';
    /** Додаткова дія «Прибрати» (з плейлиста тощо). */
    onRemove?: () => void;
    removeLabel?: string;
    triggerClassName?: string;
    children?: ReactNode;
}) {
    const track = useTrack(raw);
    const actions = useTrackActions();
    const { auth } = usePage().props;
    const me = auth.user;
    const local = track.source === 'local' ? track : null;
    const canManage =
        local !== null &&
        (local.user_id === me.id ||
            me.role === 'admin' ||
            me.role === 'moderator');

    const destroy = async (t: LocalTrack) => {
        if (
            !window.confirm(
                tr('Видалити «{title}» з GameCon?', { title: t.title }),
            )
        )
            return;
        await api('DELETE', `/music/tracks/${t.id}`);
        toast.success(tr('Трек видалено.'));
        router.reload();
    };

    return (
        <DropdownMenu>
            <DropdownMenuTrigger
                aria-label={tr('Ще')}
                className={cn(
                    'flex size-9 shrink-0 items-center justify-center rounded-full text-[var(--am-label)] outline-none hover:bg-[var(--am-fill)] data-[state=open]:bg-[var(--am-fill)]',
                    triggerClassName,
                )}
                onClick={(e) => e.stopPropagation()}
            >
                {children ?? <MoreHorizontal className="size-5" />}
            </DropdownMenuTrigger>
            <DropdownMenuContent
                align="end"
                side={side}
                sideOffset={side === 'top' ? 12 : undefined}
                className="am z-[90] w-64 rounded-2xl border-[var(--am-sep)] bg-[var(--am-elevated)] p-1.5 text-[var(--am-label)] shadow-2xl"
            >
                {local && (
                    <>
                        <DropdownMenuItem
                            className={item}
                            onSelect={() => void toggleLibrary(local)}
                        >
                            {local.in_library ? <Trash2 /> : <Plus />}
                            {local.in_library
                                ? tr('Видалити з медіатеки')
                                : tr('Додати в медіатеку')}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                            className={item}
                            onSelect={() => void toggleFavorite(local)}
                        >
                            <Star
                                className={cn(
                                    local.favorite &&
                                        'fill-current text-[var(--am-accent)]',
                                )}
                            />
                            {local.favorite
                                ? tr('Прибрати з улюбленого')
                                : tr('Улюблене')}
                        </DropdownMenuItem>
                        <PlaylistSub track={local} />
                        <DropdownMenuSeparator className="bg-[var(--am-sep)]" />
                    </>
                )}
                {track.source !== 'radio' && (
                    <>
                        <DropdownMenuItem
                            className={item}
                            onSelect={() => playNext(track)}
                        >
                            <ListStart /> {tr('Грати наступним')}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                            className={item}
                            onSelect={() => playLater(track)}
                        >
                            <ListEnd /> {tr('Грати останнім')}
                        </DropdownMenuItem>
                    </>
                )}
                {local && (
                    <DropdownMenuItem
                        className={item}
                        onSelect={() =>
                            void playStation(
                                `track:${local.id}`,
                                tr('Станція «{name}»', { name: local.title }),
                            )
                        }
                    >
                        <Radio /> {tr('Створити станцію')}
                    </DropdownMenuItem>
                )}
                <DropdownMenuItem
                    className={item}
                    onSelect={() => actions.info(track)}
                >
                    <Info /> {tr('Відомості про пісню')}
                </DropdownMenuItem>
                {local && (
                    <>
                        <DropdownMenuSeparator className="bg-[var(--am-sep)]" />
                        {local.album && (
                            <DropdownMenuItem
                                className={item}
                                onSelect={() => router.visit(albumHref(local))}
                            >
                                <Disc3 /> {tr('Перейти до альбому')}
                            </DropdownMenuItem>
                        )}
                        {local.artist && (
                            <DropdownMenuItem
                                className={item}
                                onSelect={() =>
                                    router.visit(artistHref(local.artist))
                                }
                            >
                                <UserRound /> {tr('Перейти до виконавця')}
                            </DropdownMenuItem>
                        )}
                        {local.has_lyrics && (
                            <DropdownMenuItem
                                className={item}
                                onSelect={() => actions.lyrics(local)}
                            >
                                <FileText /> {tr('Переглянути текст')}
                            </DropdownMenuItem>
                        )}
                    </>
                )}
                {track.source !== 'radio' && (
                    <>
                        <DropdownMenuSeparator className="bg-[var(--am-sep)]" />
                        <DropdownMenuItem
                            className={item}
                            onSelect={() => actions.share(track)}
                        >
                            <Share2 /> {tr('Поділитися на стіні')}
                        </DropdownMenuItem>
                    </>
                )}
                {local && (
                    <>
                        <DropdownMenuItem
                            className={item}
                            onSelect={() =>
                                router.post('/music/together', {
                                    track_id: local.id,
                                })
                            }
                        >
                            <Headphones /> {tr('Слухати разом')}
                        </DropdownMenuItem>
                        <DropdownMenuItem className={item} asChild>
                            <a href={`/music/tracks/${local.id}/download`}>
                                <Download /> {tr('Завантажити')}
                            </a>
                        </DropdownMenuItem>
                    </>
                )}
                {track.source === 'spotify' && (
                    <DropdownMenuItem className={item} asChild>
                        <a href={track.url} target="_blank" rel="noreferrer">
                            <ExternalLink /> {tr('Відкрити у Spotify')}
                        </a>
                    </DropdownMenuItem>
                )}
                {track.source === 'radio' && track.homepage && (
                    <DropdownMenuItem className={item} asChild>
                        <a
                            href={track.homepage}
                            target="_blank"
                            rel="noreferrer"
                        >
                            <ExternalLink /> {tr('Сайт станції')}
                        </a>
                    </DropdownMenuItem>
                )}
                {(canManage || onRemove) && (
                    <DropdownMenuSeparator className="bg-[var(--am-sep)]" />
                )}
                {canManage && local && (
                    <DropdownMenuItem
                        className={item}
                        onSelect={() => actions.edit(local)}
                    >
                        <PenLine /> {tr('Редагувати')}
                    </DropdownMenuItem>
                )}
                {canManage && local && local.has_lyrics === false && (
                    <DropdownMenuItem
                        className={item}
                        onSelect={() => actions.edit(local)}
                    >
                        <MicVocal /> {tr('Додати текст пісні')}
                    </DropdownMenuItem>
                )}
                {onRemove && (
                    <DropdownMenuItem
                        className={cn(item, 'text-[var(--am-accent)]')}
                        onSelect={onRemove}
                    >
                        <Trash2 /> {removeLabel ?? tr('Прибрати')}
                    </DropdownMenuItem>
                )}
                {canManage && local && (
                    <DropdownMenuItem
                        className={cn(item, 'text-[var(--am-accent)]')}
                        onSelect={() => void destroy(local)}
                    >
                        <Trash2 /> {tr('Видалити з сайту')}
                    </DropdownMenuItem>
                )}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
