import { Star } from 'lucide-react';
import {
    Equalizer,
    SpotifyLogo,
    TrackCover,
} from '@/components/music/track-cover';
import { formatDuration } from '@/lib/format';
import { tr } from '@/lib/i18n';
import { playQueue, usePlayer } from '@/lib/player';
import { cn } from '@/lib/utils';
import type { TrackCard } from '@/types';
import { TrackMenu, useTrack } from './track-actions';

/**
 * Список пісень як в Apple Music: обкладинка (або номер у альбомі), назва, виконавець,
 * еквалайзер у треку, що грає, меню «⋯». Дотик — грати список із цієї пісні.
 */

type Variant = 'art' | 'numbered' | 'chart';

function SongRow({
    track: raw,
    index,
    list,
    variant,
    subtitle,
    onRemove,
    removeLabel,
    extra,
}: {
    track: TrackCard;
    index: number;
    list: TrackCard[];
    variant: Variant;
    subtitle?: string;
    onRemove?: (track: TrackCard) => void;
    removeLabel?: string;
    extra?: string;
}) {
    const track = useTrack(raw);
    const player = usePlayer();
    const current = player.current?.key === track.key;
    const favorite = track.source === 'local' && track.favorite;

    return (
        <li className="group relative">
            <button
                type="button"
                onClick={() => playQueue(list, index)}
                className="flex w-full items-center gap-3 py-1.5 pr-11 text-left transition active:bg-[var(--am-fill)] sm:hover:bg-[var(--am-fill)]/60"
            >
                {variant === 'numbered' ? (
                    <span className="am-body flex w-6 shrink-0 justify-center text-[var(--am-label2)] tabular-nums">
                        {current ? (
                            <Equalizer
                                paused={!player.playing}
                                className="text-[var(--am-accent)]"
                            />
                        ) : (
                            index + 1
                        )}
                    </span>
                ) : (
                    <>
                        {variant === 'chart' && (
                            <span className="am-headline w-6 shrink-0 text-center text-[var(--am-label)] tabular-nums">
                                {index + 1}
                            </span>
                        )}
                        <span className="relative shrink-0">
                            <TrackCover
                                url={track.cover_url}
                                seed={track.key}
                                className="am-art size-12 rounded-[5px]"
                            />
                            {current && (
                                <span className="absolute inset-0 flex items-center justify-center rounded-[5px] bg-black/45">
                                    <Equalizer
                                        paused={!player.playing}
                                        className="text-white"
                                    />
                                </span>
                            )}
                        </span>
                    </>
                )}
                <span className="flex min-h-12 min-w-0 flex-1 items-center gap-2 border-b border-[var(--am-sep)] py-1 group-last:border-transparent">
                    <span className="min-w-0 flex-1">
                        <span
                            className={cn(
                                'am-body flex items-center gap-1.5',
                                current && 'text-[var(--am-accent)]',
                            )}
                        >
                            <span className="truncate">{track.title}</span>
                            {track.source === 'spotify' && track.explicit && (
                                <span className="shrink-0 rounded-[3px] bg-[var(--am-label3)] px-1 text-[10px] leading-[14px] font-bold text-[var(--am-bg)]">
                                    E
                                </span>
                            )}
                        </span>
                        <span className="am-subhead block truncate text-[var(--am-label2)]">
                            {subtitle ??
                                [track.artist, extra]
                                    .filter(Boolean)
                                    .join(' · ')}
                        </span>
                    </span>
                    {favorite && (
                        <Star
                            className="size-3.5 shrink-0 fill-current text-[var(--am-label3)]"
                            aria-label={tr('Улюблене')}
                        />
                    )}
                    {track.source === 'spotify' && (
                        <SpotifyLogo className="size-3.5 shrink-0 opacity-70" />
                    )}
                    {variant === 'numbered' && track.duration > 0 && (
                        <span className="am-subhead shrink-0 text-[var(--am-label2)] tabular-nums">
                            {formatDuration(track.duration)}
                        </span>
                    )}
                </span>
            </button>
            <div className="absolute top-1/2 right-0 -translate-y-1/2">
                <TrackMenu
                    track={track}
                    onRemove={onRemove ? () => onRemove(track) : undefined}
                    removeLabel={removeLabel}
                />
            </div>
        </li>
    );
}

export function SongList({
    tracks,
    variant = 'art',
    className,
    onRemove,
    removeLabel,
    extra,
}: {
    tracks: TrackCard[];
    variant?: Variant;
    className?: string;
    onRemove?: (track: TrackCard) => void;
    removeLabel?: string;
    /** Другий рядок після виконавця (альбом, прослуховування). */
    extra?: (track: TrackCard) => string | undefined;
}) {
    return (
        <ol className={cn('px-[var(--am-gutter)]', className)}>
            {tracks.map((track, index) => (
                <SongRow
                    key={`${track.key}-${index}`}
                    track={track}
                    index={index}
                    list={tracks}
                    variant={variant}
                    onRemove={onRemove}
                    removeLabel={removeLabel}
                    extra={extra?.(track)}
                />
            ))}
        </ol>
    );
}

/**
 * «Останні пісні» на сторінках Нове/Головна: колонки по 4 рядки з прокруткою вбік (як в Apple Music).
 */
export function SongColumns({ tracks }: { tracks: TrackCard[] }) {
    const columns: TrackCard[][] = [];
    for (let i = 0; i < tracks.length; i += 4)
        columns.push(tracks.slice(i, i + 4));

    return (
        <div className="am-shelf grid auto-cols-[min(86vw,380px)] grid-flow-col gap-x-5 overflow-x-auto px-[var(--am-gutter)]">
            {columns.map((column, c) => (
                <ol key={c}>
                    {column.map((track, i) => (
                        <SongRow
                            key={track.key}
                            track={track}
                            index={c * 4 + i}
                            list={tracks}
                            variant="art"
                        />
                    ))}
                </ol>
            ))}
        </div>
    );
}
