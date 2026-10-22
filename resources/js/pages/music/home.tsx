import { Head, Link, usePage } from '@inertiajs/react';
import { Play } from 'lucide-react';
import {
    mixTitle,
    MixTile,
    StationTile,
    stationTitle,
} from '@/components/am/cards';
import { SongColumns } from '@/components/am/song-list';
import {
    Artwork,
    MixArt,
    SectionHeader,
    Shelf,
    Tile,
} from '@/components/am/ui';
import { UserAvatar } from '@/components/gc/user-avatar';
import { BackToGameCon } from '@/layouts/music-layout';
import { tr } from '@/lib/i18n';
import { playQueue, playStation } from '@/lib/player';
import type {
    LocalTrack,
    MixCard,
    StationCard,
    TrackCard,
    UserCard,
} from '@/types';

type Home = {
    top_picks: (StationCard | MixCard)[];
    recently_played: LocalTrack[];
    made_for_you: MixCard[];
    replay: { year: number; tracks: LocalTrack[] };
    friends: { user: UserCard; track: LocalTrack }[];
    stations: StationCard[];
};

/** Велика картка «Найкраще для тебе»: підпис над нею й обкладинка 3:4. */
function TopPick({ item }: { item: StationCard | MixCard }) {
    const station = item.kind === 'station';
    const { title, subtitle } = station
        ? stationTitle(item)
        : mixTitle(item.key);
    const art = (
        <div className="relative overflow-hidden rounded-[12px]">
            <MixArt
                colors={item.colors}
                covers={item.covers}
                label={title}
                className="aspect-[4/5] rounded-[12px]"
            />
            <span className="am-footnote absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/50 to-transparent px-3 pt-10 pb-3 text-white/90">
                {subtitle}
            </span>
        </div>
    );

    return (
        <div className="min-w-0">
            <p className="am-footnote mb-1.5 text-[var(--am-label2)]">
                {station ? tr('Твоя станція') : tr('Створено для тебе')}
            </p>
            {station ? (
                <button
                    type="button"
                    onClick={() => void playStation(item.key)}
                    className="block w-full text-left transition active:scale-[0.98]"
                >
                    {art}
                </button>
            ) : (
                <Link
                    href={item.href}
                    className="block transition active:scale-[0.98]"
                >
                    {art}
                </Link>
            )}
        </div>
    );
}

export default function MusicHome({ home }: { home: Home }) {
    const { auth } = usePage().props;
    const recent = home.recently_played as TrackCard[];

    return (
        <>
            <Head title={tr('Музика')} />
            <BackToGameCon />
            <header className="flex items-end justify-between px-[var(--am-gutter)] pt-1 pb-2 lg:pt-4">
                <h1 className="am-large-title">{tr('Головна')}</h1>
                <Link
                    href={`/u/${auth.user.username}`}
                    aria-label={tr('Профіль')}
                    className="mb-1"
                >
                    <UserAvatar user={auth.user} size="sm" showOnline={false} />
                </Link>
            </header>

            <SectionHeader title={tr('Найкраще для тебе')} />
            <Shelf className="[--am-tile:min(70vw,280px)]">
                {home.top_picks.map((item) => (
                    <TopPick key={item.key} item={item} />
                ))}
            </Shelf>

            {recent.length > 0 ? (
                <>
                    <SectionHeader title={tr('Нещодавно прослухане')} />
                    <Shelf>
                        {recent.map((track, i) => (
                            <Tile
                                key={track.key}
                                onClick={() => playQueue(recent, i)}
                                art={
                                    <div className="relative">
                                        <Artwork
                                            src={track.cover_url}
                                            seed={track.key}
                                        />
                                        <span className="absolute right-2 bottom-2 flex size-8 items-center justify-center rounded-full bg-black/35 text-white opacity-0 backdrop-blur transition group-hover:opacity-100">
                                            <Play className="ml-0.5 size-4 fill-current" />
                                        </span>
                                    </div>
                                }
                                title={track.title}
                                subtitle={track.artist}
                            />
                        ))}
                    </Shelf>
                </>
            ) : (
                <div className="mx-[var(--am-gutter)] mt-6 rounded-2xl bg-[var(--am-bg2)] p-5">
                    <p className="am-headline">{tr('Почни слухати')}</p>
                    <p className="am-subhead mt-1 text-[var(--am-label2)]">
                        {tr(
                            'Тут з’являться нещодавно прослухані треки, а мікси й станції підлаштуються під твій смак.',
                        )}
                    </p>
                    <Link
                        href="/music/new"
                        className="am-headline mt-3 inline-block text-[var(--am-accent)]"
                    >
                        {tr('Відкрити «Нове»')}
                    </Link>
                </div>
            )}

            {home.made_for_you.length > 0 && (
                <>
                    <SectionHeader
                        title={tr('Створено для тебе')}
                        subtitle={tr('Оновлюється щопонеділка')}
                    />
                    <Shelf>
                        {home.made_for_you.map((mix) => (
                            <MixTile key={mix.key} mix={mix} />
                        ))}
                    </Shelf>
                </>
            )}

            {home.replay.tracks.length > 0 && (
                <>
                    <SectionHeader
                        title={tr('Replay {year}', { year: home.replay.year })}
                        href="/music/replay"
                        subtitle={tr('Твої найчастіші пісні року')}
                    />
                    <SongColumns tracks={home.replay.tracks} />
                </>
            )}

            {home.friends.length > 0 && (
                <>
                    <SectionHeader title={tr('Друзі слухають')} />
                    <Shelf>
                        {home.friends.map(({ user, track }) => (
                            <Tile
                                key={user.id}
                                onClick={() => playQueue([track], 0)}
                                art={
                                    <div className="relative">
                                        <Artwork
                                            src={track.cover_url}
                                            seed={track.key}
                                        />
                                        <span className="absolute -bottom-1.5 -left-1.5 rounded-full ring-2 ring-[var(--am-bg)]">
                                            <UserAvatar
                                                user={user}
                                                size="sm"
                                                showOnline={false}
                                            />
                                        </span>
                                    </div>
                                }
                                title={track.title}
                                subtitle={`${user.first_name || user.name} · ${track.artist}`}
                            />
                        ))}
                    </Shelf>
                </>
            )}

            {home.stations.length > 0 && (
                <>
                    <SectionHeader
                        title={tr('Станції для тебе')}
                        href="/music/radio"
                    />
                    <Shelf>
                        {home.stations.map((station) => (
                            <StationTile key={station.key} station={station} />
                        ))}
                    </Shelf>
                </>
            )}
        </>
    );
}
