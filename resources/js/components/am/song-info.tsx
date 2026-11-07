import { Link } from '@inertiajs/react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogTitle,
} from '@/components/ui/dialog';
import { TrackCover } from '@/components/music/track-cover';
import { formatDuration } from '@/lib/format';
import { tr } from '@/lib/i18n';
import type { LocalTrack, TrackCard } from '@/types';
import { QualityBadge } from './ui';

/** Назви кодеків для людей: «flac» → «FLAC», «alac» → «Apple Lossless» тощо. */
const CODECS: Record<string, string> = {
    flac: 'FLAC',
    alac: 'Apple Lossless (ALAC)',
    aac: 'AAC',
    mp3: 'MP3',
    opus: 'Opus',
    vorbis: 'Ogg Vorbis',
    ape: 'Monkey’s Audio',
    wavpack: 'WavPack',
    wmav2: 'WMA',
    ac3: 'Dolby Digital (AC-3)',
    eac3: 'Dolby Digital Plus',
};

export function codecName(codec: string): string {
    if (codec.startsWith('pcm_')) return tr('PCM (без стиснення)');

    return CODECS[codec] ?? codec.toUpperCase();
}

/** Рядок формату: «FLAC · 96 кГц · 24 біт · 2 канали». */
export function formatLine(audio: NonNullable<LocalTrack['audio']>): string {
    return [
        codecName(audio.codec),
        audio.sample_rate &&
            tr('{n} кГц', {
                n: (audio.sample_rate / 1000).toLocaleString(undefined, {
                    maximumFractionDigits: 1,
                }),
            }),
        audio.bit_depth && tr('{n} біт', { n: audio.bit_depth }),
        audio.bitrate && tr('{n} кбіт/с', { n: audio.bitrate }),
        audio.channels &&
            (audio.channels === 1
                ? tr('моно')
                : audio.channels === 2
                  ? tr('стерео')
                  : tr('{n} каналів', { n: audio.channels })),
    ]
        .filter(Boolean)
        .join(' · ');
}

function Row({
    label,
    children,
}: {
    label: string;
    children: React.ReactNode;
}) {
    return (
        <div className="flex items-baseline justify-between gap-4 border-b border-[var(--am-sep)] py-2.5 last:border-0">
            <dt className="am-subhead shrink-0 text-[var(--am-label2)]">
                {label}
            </dt>
            <dd className="am-body min-w-0 text-right break-words">
                {children}
            </dd>
        </div>
    );
}

/** «Відомості про пісню», як в Apple Music: альбом, рік, жанр, тривалість і формат звуку. */
export function SongInfoDialog({
    track,
    onOpenChange,
}: {
    track: TrackCard | null;
    onOpenChange: (open: boolean) => void;
}) {
    const local = track?.source === 'local' ? track : null;
    const radio = track?.source === 'radio' ? track : null;

    return (
        <Dialog open={track !== null} onOpenChange={onOpenChange}>
            <DialogContent className="am max-w-md gap-0 rounded-3xl border-[var(--am-sep)] bg-[var(--am-elevated)] p-5 text-[var(--am-label)]">
                {track && (
                    <>
                        <div className="flex items-center gap-4 pb-4">
                            <TrackCover
                                url={track.cover_url}
                                seed={track.key}
                                className="am-art size-20 shrink-0"
                            />
                            <div className="min-w-0">
                                <DialogTitle className="am-headline truncate">
                                    {track.title}
                                </DialogTitle>
                                <DialogDescription className="am-subhead truncate text-[var(--am-label2)]">
                                    {track.artist}
                                </DialogDescription>
                                {local && (
                                    <QualityBadge
                                        quality={local.quality}
                                        className="mt-1.5"
                                    />
                                )}
                            </div>
                        </div>
                        <dl>
                            {track.album && (
                                <Row label={tr('Альбом')}>
                                    <Link
                                        href={`/music/album?artist=${encodeURIComponent(track.artist)}&title=${encodeURIComponent(track.album)}`}
                                        className="text-[var(--am-accent)] hover:underline"
                                        onClick={() => onOpenChange(false)}
                                    >
                                        {track.album}
                                    </Link>
                                </Row>
                            )}
                            {local?.year && (
                                <Row label={tr('Рік')}>{local.year}</Row>
                            )}
                            {(local?.genre || radio?.genre) && (
                                <Row label={tr('Жанр')}>
                                    {local?.genre ?? radio?.genre}
                                </Row>
                            )}
                            {track.duration > 0 && (
                                <Row label={tr('Тривалість')}>
                                    {formatDuration(track.duration)}
                                </Row>
                            )}
                            {local?.audio && (
                                <Row label={tr('Формат')}>
                                    {formatLine(local.audio)}
                                </Row>
                            )}
                            {local && local.plays_count > 0 && (
                                <Row label={tr('Прослуховувань')}>
                                    {local.plays_count.toLocaleString()}
                                </Row>
                            )}
                            {track.source === 'spotify' && (
                                <Row label={tr('Джерело')}>
                                    <a
                                        href={track.url}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="text-[var(--am-accent)] hover:underline"
                                    >
                                        Spotify
                                    </a>
                                </Row>
                            )}
                            {radio?.homepage && (
                                <Row label={tr('Сайт станції')}>
                                    <a
                                        href={radio.homepage}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="text-[var(--am-accent)] hover:underline"
                                    >
                                        {new URL(radio.homepage).host}
                                    </a>
                                </Row>
                            )}
                        </dl>
                    </>
                )}
            </DialogContent>
        </Dialog>
    );
}
