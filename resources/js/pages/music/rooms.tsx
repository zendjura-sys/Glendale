import { Head, Link } from '@inertiajs/react';
import { Headphones, Info, Plus, Users } from 'lucide-react';
import { m, useReducedMotion } from 'motion/react';
import { startListenRoom } from '@/components/music/listen-room-button';
import type {
    ListenGroupType,
    ListenRoomSummary,
} from '@/components/music/listen-room-button';
import { TrackCover } from '@/components/music/track-cover';
import { BackToGameCon } from '@/layouts/music-layout';
import { tr } from '@/lib/i18n';
import type { RadioTrack } from '@/types';

type Group = {
    type: ListenGroupType;
    id: number;
    name: string;
    url: string;
    avatar_url: string | null;
    can_start: boolean;
};

type Props = {
    rooms: ListenRoomSummary[];
    groups: Group[];
    stations: RadioTrack[];
};

const KIND: Record<ListenGroupType, () => string> = {
    family: () => tr('Сім’я'),
    clan: () => tr('Клан'),
    community: () => tr('Спільнота'),
};

/** «Кімнати»: живі кімнати «Слухати разом» моїх груп і друзів, відкрити нову. */
export default function MusicRooms({ rooms, groups }: Props) {
    const reduce = useReducedMotion();
    const startable = groups.filter((g) => g.can_start);

    return (
        <>
            <Head title={tr('Кімнати')} />
            <BackToGameCon />
            <h1 className="am-large-title px-[var(--am-gutter)] pt-1 pb-2 lg:pt-4">
                {tr('Кімнати')}
            </h1>
            <p className="am-subhead max-w-2xl px-[var(--am-gutter)] text-[var(--am-label2)]">
                {tr(
                    'Слухайте разом із сім’єю, кланом, спільнотою чи друзями: діджей керує музикою, решта пропонує треки, реагує й пише в чат.',
                )}
            </p>

            <div className="px-[var(--am-gutter)] pt-5">
                <h2 className="am-title2 mb-3">{tr('Зараз грають')}</h2>
                {rooms.length === 0 && (
                    <p className="am-subhead text-[var(--am-label2)]">
                        {tr('Живих кімнат поки немає — відкрийте свою.')}
                    </p>
                )}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {rooms.map((room, i) => (
                        <m.div
                            key={room.code}
                            initial={reduce ? false : { opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: reduce ? 0 : i * 0.04 }}
                        >
                            <Link
                                href={`/listen/${room.code}`}
                                className="flex items-center gap-3 rounded-[12px] bg-[var(--am-fill)] p-3 transition hover:bg-[var(--am-fill2)]"
                            >
                                <TrackCover
                                    url={room.now_playing?.cover_url ?? null}
                                    seed={room.code}
                                    className="am-art size-16 shrink-0 rounded-[8px] object-cover"
                                />
                                <span className="min-w-0 flex-1">
                                    <span className="am-headline block truncate">
                                        {room.title ??
                                            room.group?.name ??
                                            tr('Кімната з друзями')}
                                    </span>
                                    <span className="am-subhead block truncate text-[var(--am-label2)]">
                                        {room.now_playing
                                            ? `${room.now_playing.title} · ${room.now_playing.artist}`
                                            : tr('Діджей ще обирає музику')}
                                    </span>
                                    <span className="am-footnote mt-0.5 inline-flex items-center gap-1 text-[var(--am-label2)]">
                                        <Users className="size-3.5" />
                                        {tr('Зараз у кімнаті: {n}', {
                                            n: room.listeners,
                                        })}
                                        {room.group &&
                                            ` · ${KIND[room.group.type]()}`}
                                    </span>
                                </span>
                            </Link>
                        </m.div>
                    ))}
                </div>
            </div>

            <div className="px-[var(--am-gutter)] pt-7">
                <h2 className="am-title2 mb-3">{tr('Відкрити кімнату')}</h2>
                <div className="flex flex-wrap gap-2">
                    <button
                        type="button"
                        onClick={() => startListenRoom(null)}
                        className="inline-flex h-10 items-center gap-2 rounded-full bg-[var(--am-accent)] px-4 text-sm font-semibold text-white"
                    >
                        <Plus className="size-4" /> {tr('З друзями')}
                    </button>
                    {startable.map((g) => (
                        <button
                            key={`${g.type}:${g.id}`}
                            type="button"
                            onClick={() => startListenRoom(g.type, g.id)}
                            className="inline-flex h-10 items-center gap-2 rounded-full bg-[var(--am-fill)] px-4 text-sm hover:bg-[var(--am-fill2)]"
                        >
                            <Headphones className="size-4" /> {g.name}
                            <span className="text-[var(--am-label2)]">
                                {KIND[g.type]()}
                            </span>
                        </button>
                    ))}
                </div>
                <p className="am-footnote mt-5 flex max-w-2xl gap-2 text-[var(--am-label2)]">
                    <Info className="mt-0.5 size-4 shrink-0" />
                    {tr(
                        'Синхронно грають лише треки GameCon і радіо. Spotify кожен слухає через власний акаунт, тому його не можна увімкнути всім одночасно.',
                    )}
                </p>
            </div>
        </>
    );
}
