import { Check, ExternalLink, Pause, Play, Plus } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { formatDuration } from '@/lib/format';
import { playTrack, toggle, usePlayer } from '@/lib/player';
import { cn } from '@/lib/utils';
import type { TrackCard } from '@/types';
import { Equalizer, SpotifyLogo, TrackCover } from './track-cover';
import { tr } from '@/lib/i18n';

/**
 * Картка треку у записі на стіні, у «Зараз грає» та в діалогах.
 */
export function MusicCard({
    track: initial,
    compact,
    className,
}: {
    track: TrackCard;
    compact?: boolean;
    className?: string;
}) {
    const player = usePlayer();
    const [track, setTrack] = useState(initial);
    const isCurrent = player.current?.key === track.key;
    const playing = isCurrent && player.playing;

    const toggleLibrary = async () => {
        if (track.source !== 'local') return;
        const next = !track.in_library;
        setTrack({ ...track, in_library: next });
        await api(
            next ? 'POST' : 'DELETE',
            `/music/tracks/${track.id}/library`,
        );
        if (next) toast.success(tr('Додано до ваших аудіозаписів.'));
    };

    return (
        <div
            className={cn(
                'group relative flex items-center gap-3 overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.035] p-2.5 pr-3 transition hover:border-white/15',
                isCurrent &&
                    'border-gc-lilac-500/40 shadow-[0_0_30px_-14px_rgb(124_92_255/0.9)]',
                className,
            )}
        >
            {track.cover_url && (
                <img
                    src={track.cover_url}
                    alt=""
                    className="pointer-events-none absolute inset-0 size-full scale-150 object-cover opacity-[0.1] blur-2xl"
                />
            )}
            <button
                type="button"
                onClick={() => (isCurrent ? toggle() : playTrack(track))}
                className="relative shrink-0"
                aria-label={playing ? tr('Пауза') : tr('Слухати')}
            >
                <TrackCover
                    url={track.cover_url}
                    seed={track.key}
                    className={cn(
                        'rounded-xl',
                        compact ? 'size-12' : 'size-14',
                    )}
                />
                <span
                    className={cn(
                        'absolute inset-0 flex items-center justify-center rounded-xl bg-black/45 transition',
                        isCurrent
                            ? 'opacity-100'
                            : 'opacity-0 group-hover:opacity-100 [@media(hover:none)]:opacity-100',
                    )}
                >
                    {playing ? (
                        <Pause className="size-5 fill-white text-white" />
                    ) : (
                        <Play className="ml-0.5 size-5 fill-white text-white" />
                    )}
                </span>
            </button>
            <div className="relative min-w-0 flex-1">
                <p className="flex items-center gap-2 truncate text-sm font-semibold text-white">
                    {isCurrent && <Equalizer paused={!playing} />}
                    <span className="truncate">{track.title}</span>
                </p>
                <p className="truncate text-xs text-white/55">
                    {track.artist}
                    {track.album && !compact && (
                        <span className="text-white/35"> · {track.album}</span>
                    )}
                </p>
            </div>
            <span className="relative text-xs text-white/40 tabular-nums">
                {formatDuration(track.duration)}
            </span>
            {track.source === 'local' ? (
                <button
                    type="button"
                    onClick={toggleLibrary}
                    className={cn(
                        'relative flex size-8 items-center justify-center rounded-full transition',
                        track.in_library
                            ? 'text-gc-lilac-400'
                            : 'text-white/45 hover:bg-white/10 hover:text-white',
                    )}
                    aria-label={
                        track.in_library
                            ? tr('Прибрати з моїх аудіозаписів')
                            : tr('Додати до моїх аудіозаписів')
                    }
                >
                    {track.in_library ? (
                        <Check className="size-4" />
                    ) : (
                        <Plus className="size-4" />
                    )}
                </button>
            ) : (
                <a
                    href={track.url}
                    target="_blank"
                    rel="noreferrer"
                    className="relative flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-medium text-spotify transition hover:bg-spotify/10"
                    title={tr('Відкрити у Spotify')}
                >
                    <SpotifyLogo className="size-4" />
                    <ExternalLink className="size-3" />
                </a>
            )}
        </div>
    );
}
