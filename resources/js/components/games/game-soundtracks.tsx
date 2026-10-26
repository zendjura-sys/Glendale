import { Link } from '@inertiajs/react';
import { ListMusic, Plus, X } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { PlaylistCover } from '@/components/music/playlist-card';
import { api } from '@/lib/api';
import { tr } from '@/lib/i18n';
import type { PlaylistCard } from '@/types';

export type Soundtrack = PlaylistCard & { author: string; can_remove: boolean };

/** «Музика гри»: відкриті плейлисти гравців, прив’язані до сторінки гри, і «Додати свій». */
export function GameSoundtracks({
    slug,
    initial,
}: {
    slug: string;
    initial: Soundtrack[];
}) {
    const [items, setItems] = useState(initial);
    const [mine, setMine] = useState<
        { id: number; title: string; tracks_count: number }[] | null
    >(null);
    const [busy, setBusy] = useState(false);

    const run = async (fn: () => Promise<{ playlists: Soundtrack[] }>) => {
        setBusy(true);
        try {
            setItems((await fn()).playlists);
            setMine(null);
        } catch (e) {
            toast.error(
                e instanceof Error ? e.message : tr('Не вдалося зберегти.'),
            );
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="space-y-3">
            {items.length === 0 ? (
                <p className="text-sm text-white/45">
                    {tr(
                        'Плейлистів ще немає. Додайте свій — «музика з гри» чи «під рейд».',
                    )}
                </p>
            ) : (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {items.map((playlist) => (
                        <div
                            key={playlist.id}
                            className="group relative min-w-0"
                        >
                            <Link
                                href={`/music/playlists/${playlist.id}`}
                                className="block"
                            >
                                <PlaylistCover
                                    playlist={playlist}
                                    className="rounded-xl"
                                />
                                <p className="mt-1.5 text-sm font-semibold break-words text-white">
                                    {playlist.title}
                                </p>
                                <p className="text-xs break-words text-white/45">
                                    {playlist.author} ·{' '}
                                    {tr('{n} треків', {
                                        n: playlist.tracks_count,
                                    })}
                                </p>
                            </Link>
                            {playlist.can_remove && (
                                <button
                                    type="button"
                                    disabled={busy}
                                    onClick={() =>
                                        void run(() =>
                                            api(
                                                'DELETE',
                                                `/games/${slug}/playlists/${playlist.id}`,
                                            ),
                                        )
                                    }
                                    aria-label={tr('Прибрати зі сторінки гри')}
                                    title={tr('Прибрати зі сторінки гри')}
                                    className="absolute top-1.5 right-1.5 grid size-7 place-items-center rounded-full bg-black/60 text-white opacity-0 transition group-hover:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100"
                                >
                                    <X className="size-3.5" />
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {mine === null ? (
                <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                        void api<{
                            playlists: {
                                id: number;
                                title: string;
                                tracks_count: number;
                            }[];
                        }>('GET', `/games/${slug}/playlists/mine`)
                            .then((r) => setMine(r.playlists))
                            .catch(() =>
                                toast.error(
                                    tr('Не вдалося завантажити плейлисти.'),
                                ),
                            )
                    }
                    className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-white/[0.06] px-3 text-sm text-white/80 transition hover:bg-white/10"
                >
                    <Plus className="size-4" />
                    {tr('Додати свій плейлист')}
                </button>
            ) : mine.length === 0 ? (
                <p className="text-sm text-white/50">
                    {tr(
                        'Немає відкритих плейлистів із треками. Створіть плейлист у Музиці й зробіть його відкритим.',
                    )}{' '}
                    <Link
                        href="/music/library"
                        className="text-gc-lilac-200 hover:text-white"
                    >
                        {tr('До бібліотеки')}
                    </Link>
                </p>
            ) : (
                <div className="grid gap-1 rounded-2xl bg-white/[0.03] p-2">
                    {mine.map((playlist) => (
                        <button
                            key={playlist.id}
                            type="button"
                            disabled={busy}
                            onClick={() =>
                                void run(() =>
                                    api('POST', `/games/${slug}/playlists`, {
                                        playlist_id: playlist.id,
                                    }),
                                )
                            }
                            className="flex items-center gap-2 rounded-xl px-2.5 py-2 text-left text-sm text-white/80 transition hover:bg-white/[0.06]"
                        >
                            <ListMusic className="size-4 shrink-0 text-white/50" />
                            <span className="min-w-0 flex-1 break-words">
                                {playlist.title}
                            </span>
                            <span className="text-xs text-white/40">
                                {playlist.tracks_count}
                            </span>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
