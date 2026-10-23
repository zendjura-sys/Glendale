import { Head, Link } from '@inertiajs/react';
import { Headphones, Play, Radio as RadioIcon } from 'lucide-react';
import { StationTile, stationTitle } from '@/components/am/cards';
import { TrackMenu } from '@/components/am/track-actions';
import { MixArt, SectionHeader, Shelf } from '@/components/am/ui';
import { TrackCover } from '@/components/music/track-cover';
import { BackToGameCon } from '@/layouts/music-layout';
import { tr } from '@/lib/i18n';
import { playQueue, playStation, usePlayer } from '@/lib/player';
import { cn } from '@/lib/utils';
import type { RadioTrack, StationCard } from '@/types';

type Data = {
    my_station: StationCard;
    live: RadioTrack[];
    by_genre: { genre: string; stations: RadioTrack[] }[];
    genre_stations: StationCard[];
};

/** Велика картка ефірної станції: логотип, «НАЖИВО», назва, опис і кнопка відтворення. */
function LiveCard({
    station,
    list,
    index,
}: {
    station: RadioTrack;
    list: RadioTrack[];
    index: number;
}) {
    const player = usePlayer();
    const on = player.current?.key === station.key && player.playing;

    return (
        <div className="min-w-0">
            <p className="am-caption text-[var(--am-label2)]">{tr('Наживо')}</p>
            <p className="am-title2 truncate font-normal">{station.title}</p>
            <p className="am-subhead mb-2 truncate text-[var(--am-label2)]">
                {station.artist || station.genre || ' '}
            </p>
            <div className="relative">
                <button
                    type="button"
                    onClick={() => playQueue(list, index)}
                    className="block w-full overflow-hidden rounded-[12px] text-left transition active:scale-[0.99]"
                >
                    <TrackCover
                        url={station.cover_url}
                        seed={station.key}
                        className="am-art aspect-[16/10] w-full rounded-[12px] object-contain p-8"
                    />
                </button>
                <span
                    className={cn(
                        'pointer-events-none absolute right-3 bottom-3 flex size-11 items-center justify-center rounded-full bg-[var(--am-accent)] text-white shadow-lg',
                        on && 'animate-pulse',
                    )}
                >
                    <Play className="ml-0.5 size-5 fill-current" />
                </span>
                <div className="absolute top-2 right-2">
                    <TrackMenu
                        track={station}
                        triggerClassName="bg-black/30 text-white hover:bg-black/40"
                    />
                </div>
            </div>
        </div>
    );
}

export default function MusicRadio({ data }: { data: Data }) {
    const mine = stationTitle(data.my_station);

    return (
        <>
            <Head title={tr('Радіо')} />
            <BackToGameCon />
            <h1 className="am-large-title px-[var(--am-gutter)] pt-1 pb-2 lg:pt-4">
                {tr('Радіо')}
            </h1>
            <Link
                href="/music/rooms"
                className="am-subhead mx-[var(--am-gutter)] inline-flex items-center gap-1.5 text-[var(--am-accent)]"
            >
                <Headphones className="size-4" /> {tr('Слухати радіо разом')}
            </Link>

            <div className="px-[var(--am-gutter)] pt-2">
                <button
                    type="button"
                    onClick={() => void playStation(data.my_station.key)}
                    className="group block w-full text-left sm:max-w-md"
                >
                    <p className="am-caption text-[var(--am-label2)]">
                        {tr('Твоя станція')}
                    </p>
                    <p className="am-title2 font-normal">{mine.title}</p>
                    <p className="am-subhead mb-2 text-[var(--am-label2)]">
                        {mine.subtitle}
                    </p>
                    <div className="relative">
                        <MixArt
                            colors={data.my_station.colors}
                            label={mine.title}
                            className="aspect-[16/10] rounded-[12px]"
                            icon={<RadioIcon className="size-7" />}
                        />
                        <span className="absolute right-3 bottom-3 flex size-11 items-center justify-center rounded-full bg-white text-black shadow-lg">
                            <Play className="ml-0.5 size-5 fill-current" />
                        </span>
                    </div>
                </button>
            </div>

            {data.live.length > 0 && (
                <>
                    <SectionHeader title={tr('Ефірні станції')} />
                    <Shelf className="[--am-tile:min(80vw,400px)]">
                        {data.live.map((s, i) => (
                            <LiveCard
                                key={s.key}
                                station={s}
                                list={data.live}
                                index={i}
                            />
                        ))}
                    </Shelf>
                </>
            )}

            {data.by_genre.map((group) => (
                <div key={group.genre}>
                    <SectionHeader title={group.genre} />
                    <Shelf>
                        {group.stations.map((s, i) => (
                            <button
                                key={s.key}
                                type="button"
                                onClick={() => playQueue(group.stations, i)}
                                className="group block min-w-0 text-left"
                            >
                                <TrackCover
                                    url={s.cover_url}
                                    seed={s.key}
                                    className="am-art aspect-square w-full object-contain p-5"
                                />
                                <p className="am-footnote mt-1.5 truncate font-medium">
                                    {s.title}
                                </p>
                                <p className="am-footnote truncate text-[var(--am-label2)]">
                                    {s.artist || tr('Наживо')}
                                </p>
                            </button>
                        ))}
                    </Shelf>
                </div>
            ))}

            {data.genre_stations.length > 0 && (
                <>
                    <SectionHeader
                        title={tr('Станції за жанрами')}
                        subtitle={tr('Нескінченна музика з каталогу GameCon')}
                    />
                    <Shelf rows={2}>
                        {data.genre_stations.map((s) => (
                            <StationTile key={s.key} station={s} />
                        ))}
                    </Shelf>
                </>
            )}

            {data.live.length === 0 && data.genre_stations.length === 0 && (
                <p className="am-subhead px-[var(--am-gutter)] pt-8 text-[var(--am-label2)]">
                    {tr('Станції з’являться, щойно адміністратор їх додасть.')}
                </p>
            )}
        </>
    );
}
