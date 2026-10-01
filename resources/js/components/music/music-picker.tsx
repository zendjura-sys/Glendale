import { usePage } from '@inertiajs/react';
import { Headphones, Loader2, Music2, Search } from 'lucide-react';
import { useEffect, useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogTitle,
} from '@/components/ui/dialog';
import { api, ApiError } from '@/lib/api';
import { formatDuration } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { TrackCard } from '@/types';
import { SpotifyLogo, TrackCover } from './track-cover';

type Source = 'mine' | 'all' | 'spotify';

export function MusicPicker({
    open,
    onOpenChange,
    onPick,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onPick: (track: TrackCard) => void;
}) {
    const { music } = usePage().props;
    const [source, setSource] = useState<Source>('mine');
    const [q, setQ] = useState('');
    const [tracks, setTracks] = useState<TrackCard[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const spotifyEnabled = !!music?.spotify.configured;

    useEffect(() => {
        if (!open) return;
        if (source === 'spotify' && q.trim() === '') {
            setTracks([]);
            setError(null);

            return;
        }

        let cancelled = false;
        const timer = setTimeout(
            async () => {
                setLoading(true);
                setError(null);
                try {
                    const params = new URLSearchParams({ q: q.trim() });
                    const url =
                        source === 'spotify'
                            ? `/music/spotify/search?${params}`
                            : `/music/search?${params}&scope=${source}`;
                    const response = await api<{ tracks: TrackCard[] }>(
                        'GET',
                        url,
                    );
                    if (!cancelled) setTracks(response.tracks);
                } catch (e) {
                    if (!cancelled) {
                        setTracks([]);
                        setError(
                            e instanceof ApiError
                                ? e.message
                                : 'Не вдалося виконати пошук.',
                        );
                    }
                } finally {
                    if (!cancelled) setLoading(false);
                }
            },
            q ? 300 : 0,
        );

        return () => {
            cancelled = true;
            clearTimeout(timer);
        };
    }, [open, source, q]);

    const sources: { key: Source; label: string }[] = [
        { key: 'mine', label: 'Мої' },
        { key: 'all', label: 'Усі на GameCon' },
        ...(spotifyEnabled
            ? [{ key: 'spotify' as const, label: 'Spotify' }]
            : []),
    ];

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="glass-strong flex max-h-[85dvh] flex-col gap-0 rounded-3xl border-white/10 p-0 text-white sm:max-w-lg">
                <div className="p-5 pb-3">
                    <DialogTitle className="font-display text-xl">
                        Прикріпити музику
                    </DialogTitle>
                    <DialogDescription className="mt-1 text-sm text-white/50">
                        Оберіть трек — він з’явиться у записі з плеєром.
                    </DialogDescription>
                    <div className="mt-4 flex gap-1 rounded-xl bg-white/[0.04] p-1">
                        {sources.map((item) => (
                            <button
                                key={item.key}
                                type="button"
                                onClick={() => setSource(item.key)}
                                className={cn(
                                    'inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition',
                                    source === item.key
                                        ? 'bg-white/10 text-white'
                                        : 'text-white/50 hover:text-white',
                                )}
                            >
                                {item.key === 'spotify' && (
                                    <SpotifyLogo className="size-3.5" />
                                )}
                                {item.label}
                            </button>
                        ))}
                    </div>
                    <label className="input-glass mt-3 flex h-11 items-center gap-2 rounded-xl px-3.5">
                        <Search className="size-4 text-white/40" />
                        <input
                            value={q}
                            onChange={(e) => setQ(e.target.value)}
                            autoFocus
                            placeholder={
                                source === 'spotify'
                                    ? 'Пошук у Spotify'
                                    : 'Назва або виконавець'
                            }
                            className="h-full flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/35"
                        />
                        {loading && (
                            <Loader2 className="size-4 animate-spin text-white/40" />
                        )}
                    </label>
                </div>

                <div className="min-h-[240px] flex-1 overflow-y-auto px-3 pb-3">
                    {error ? (
                        <p className="px-3 py-10 text-center text-sm text-rose-300">
                            {error}
                        </p>
                    ) : tracks.length === 0 && !loading ? (
                        <div className="flex flex-col items-center px-3 py-12 text-center text-sm text-white/45">
                            {source === 'spotify' && !q ? (
                                <>
                                    <SpotifyLogo className="mb-3 size-8" />
                                    Почніть вводити назву треку
                                </>
                            ) : (
                                <>
                                    {source === 'mine' && !q ? (
                                        <Headphones className="mb-3 size-8 text-white/30" />
                                    ) : (
                                        <Music2 className="mb-3 size-8 text-white/30" />
                                    )}
                                    {q
                                        ? 'Нічого не знайдено'
                                        : 'Тут поки немає треків'}
                                </>
                            )}
                        </div>
                    ) : (
                        <ul className="space-y-0.5">
                            {tracks.map((track) => (
                                <li key={track.key}>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            onPick(track);
                                            onOpenChange(false);
                                        }}
                                        className="flex w-full items-center gap-3 rounded-2xl p-2 text-left transition hover:bg-white/[0.06]"
                                    >
                                        <TrackCover
                                            url={track.cover_url}
                                            seed={track.key}
                                            className="size-11 rounded-xl"
                                        />
                                        <span className="min-w-0 flex-1">
                                            <span className="block truncate text-sm font-medium text-white">
                                                {track.title}
                                            </span>
                                            <span className="block truncate text-xs text-white/50">
                                                {track.artist}
                                            </span>
                                        </span>
                                        {track.source === 'spotify' && (
                                            <SpotifyLogo className="size-4 opacity-70" />
                                        )}
                                        <span className="text-xs text-white/40 tabular-nums">
                                            {formatDuration(track.duration)}
                                        </span>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
