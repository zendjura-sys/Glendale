import { Head, Link } from '@inertiajs/react';
import { ArtistTile } from '@/components/am/cards';
import { SongList } from '@/components/am/song-list';
import {
    LargeTitle,
    PlayShuffle,
    SectionHeader,
    Shelf,
} from '@/components/am/ui';
import { tr } from '@/lib/i18n';
import { playQueue, shuffled } from '@/lib/player';
import { cn } from '@/lib/utils';
import type { ArtistCard, LocalTrack } from '@/types';

type Replay = {
    year: number;
    years: number[];
    minutes: number;
    plays: number;
    tracks: LocalTrack[];
    artists: ArtistCard[];
    months: { month: number; tracks: LocalTrack[] }[];
};

const MONTHS = () => [
    tr('Січень'),
    tr('Лютий'),
    tr('Березень'),
    tr('Квітень'),
    tr('Травень'),
    tr('Червень'),
    tr('Липень'),
    tr('Серпень'),
    tr('Вересень'),
    tr('Жовтень'),
    tr('Листопад'),
    tr('Грудень'),
];

/** Replay: найчастіше слухане за рік і за кожен місяць, хвилини прослуховування. */
export default function MusicReplay({ replay }: { replay: Replay }) {
    const months = MONTHS();

    return (
        <>
            <Head title={`Replay ${replay.year}`} />
            <LargeTitle
                title={`Replay ${replay.year}`}
                back={{ href: '/music', label: tr('Головна') }}
            />
            {replay.years.length > 1 && (
                <div className="flex gap-2 overflow-x-auto px-[var(--am-gutter)] pb-3">
                    {replay.years.map((y) => (
                        <Link
                            key={y}
                            href={`/music/replay/${y}`}
                            className={cn(
                                'am-subhead h-8 rounded-full px-3.5 leading-8 font-semibold',
                                y === replay.year
                                    ? 'bg-[var(--am-accent)] text-white'
                                    : 'bg-[var(--am-fill)]',
                            )}
                        >
                            {y}
                        </Link>
                    ))}
                </div>
            )}
            <div
                className="mx-[var(--am-gutter)] rounded-2xl p-5 text-white"
                style={{
                    background: 'linear-gradient(145deg, #2f7bff, #22c4f0)',
                }}
            >
                <p className="am-footnote font-semibold text-white/80">
                    {tr('Твій рік у музиці')}
                </p>
                <p className="mt-1 text-[40px] leading-none font-bold tabular-nums">
                    {replay.minutes.toLocaleString('uk-UA')}
                </p>
                <p className="am-subhead text-white/85">
                    {tr('хвилин прослуховування · {n} прослуховувань', {
                        n: replay.plays.toLocaleString('uk-UA'),
                    })}
                </p>
            </div>

            {replay.tracks.length > 0 ? (
                <>
                    <SectionHeader
                        title={tr('Топ-пісні {year}', { year: replay.year })}
                    />
                    <div className="px-[var(--am-gutter)] pb-3">
                        <PlayShuffle
                            onPlay={() => playQueue(replay.tracks, 0)}
                            onShuffle={() =>
                                playQueue(shuffled(replay.tracks), 0)
                            }
                        />
                    </div>
                    <SongList tracks={replay.tracks} variant="chart" />
                </>
            ) : (
                <p className="am-subhead px-[var(--am-gutter)] pt-6 text-[var(--am-label2)]">
                    {tr('Слухай музику в GameCon — і тут з’явиться твій топ.')}
                </p>
            )}

            {replay.artists.length > 0 && (
                <>
                    <SectionHeader title={tr('Топ-виконавці')} />
                    <Shelf className="[--am-tile:min(30vw,150px)]">
                        {replay.artists.map((a) => (
                            <ArtistTile key={a.name} artist={a} />
                        ))}
                    </Shelf>
                </>
            )}

            {replay.months.map((m) => (
                <div key={m.month}>
                    <SectionHeader title={months[m.month - 1]} />
                    <SongList tracks={m.tracks} variant="chart" />
                </div>
            ))}
        </>
    );
}
