import { Head, Link, router, usePage } from '@inertiajs/react';
import {
    Check,
    Copy,
    Crown,
    Info,
    MessageCircle,
    Headphones,
    ListMusic,
    Music2,
    Pause,
    Play,
    Plus,
    Search,
    SkipForward,
    Send,
    Trash2,
    UserMinus,
    UserPlus,
    Users,
    X,
} from 'lucide-react';
import { AnimatePresence, m, useReducedMotion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { UserAvatar } from '@/components/gc/user-avatar';
import { useRealtime } from '@/hooks/use-realtime';
import { api } from '@/lib/api';
import {
    getPlayerState,
    playTrack,
    seek,
    toggle,
    usePlayer,
} from '@/lib/player';
import { cn } from '@/lib/utils';
import { usePlugin } from '@/lib/plugins';
import type { LocalTrack, RadioTrack, UserCard } from '@/types';
import { tr } from '@/lib/i18n';

type Playback = {
    track: LocalTrack | RadioTrack | null;
    playing: boolean;
    position: number;
    state_ms: number;
    server_ms: number;
    shared_control: boolean;
    repeat: boolean;
};

type QueueItem = {
    index: number;
    track: LocalTrack | RadioTrack;
    by: UserCard | null;
};

type RoomMessage = {
    id: number;
    emoji: string | null;
    body: string | null;
    user: UserCard | null;
    created_at: string;
};

/** Кімната групи чи друзів: діджей, пропозиції, чат, реакції. */
type Room = {
    title: string | null;
    group: { type: string; id: number; name: string; url: string } | null;
    moderated: boolean;
    can_manage: boolean;
    can_review: boolean;
    suggestions: QueueItem[];
    messages: RoomMessage[];
    reactions: RoomMessage[];
    emoji: string[];
};

type Party = {
    id: number;
    code: string;
    url: string;
    host: UserCard | null;
    is_host: boolean;
    can_control: boolean;
    ended: boolean;
    state: Playback;
    queue: QueueItem[];
    members: (UserCard & { is_host: boolean })[];
    room: Room | null;
};

type Props = { party: Party; friends: UserCard[] };

/** На скільки секунд можна розійтися з ведучим, перш ніж підтягнутися. */
const DRIFT = 1.5;

const clock = (s: number) => {
    const t = Math.max(0, Math.floor(s));

    return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
};

/**
 * Слухаємо разом: один трек синхронно в усіх, спільна черга. Звук іде через глобальний плеєр,
 * тож музика не обривається між сторінками; ця сторінка лише тримає його в такт із ведучим.
 */
export default function ListenTogether({ party: initial, friends }: Props) {
    const [party, setParty] = useState(initial);
    const repeatOn = usePlugin('listen_repeat');
    const [synced, setSynced] = useState(true);
    const [search, setSearch] = useState('');
    const [results, setResults] = useState<LocalTrack[]>([]);
    const [inviting, setInviting] = useState(false);
    const [stations, setStations] = useState<RadioTrack[]>([]);
    const [flying, setFlying] = useState<RoomMessage[]>([]);
    const seenReactions = useRef(new Set<number>());
    const player = usePlayer();
    const { auth } = usePage().props;
    const offset = useRef(initial.state.server_ms - Date.now());
    const lastSent = useRef(0);
    const { state } = party;
    const base = `/listen/${party.code}`;

    /** Де трек має бути зараз за годинником сервера. */
    const expected = (s: Playback = state) =>
        s.playing
            ? s.position + (Date.now() + offset.current - s.state_ms) / 1000
            : s.position;

    const apply = (fresh: Partial<Party>) => {
        if (fresh.state) offset.current = fresh.state.server_ms - Date.now();
        setParty((p) => ({ ...p, ...fresh }));
    };

    // Підлаштовуємо глобальний плеєр під стан кімнати: трек, пауза, позиція.
    useEffect(() => {
        if (!synced || party.ended) return;
        const tick = () => {
            const local = getPlayerState();
            const track = state.track;
            if (!track) {
                if (local.playing && local.current?.key.startsWith('local:'))
                    toggle();

                return;
            }
            if (local.current?.key !== track.key) {
                if (state.playing) {
                    playTrack(track);
                    window.setTimeout(() => seek(expected()), 600);
                }

                return;
            }
            if (local.playing !== state.playing && !local.loading) toggle();
            if (
                state.playing &&
                local.playing &&
                track.duration > 0 &&
                Math.abs(local.position - expected()) > DRIFT
            )
                seek(expected());
        };
        tick();
        const timer = window.setInterval(tick, 1000);

        return () => window.clearInterval(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [state, synced, party.ended]);

    // Трек дограв — беремо наступний із черги (сервер пускає гостей лише після кінця треку).
    useEffect(() => {
        const track = state.track;
        // Радіо (duration 0) не дограє — перемикає лише діджей.
        if (!track || party.ended || !state.playing || track.duration <= 0)
            return;
        const left = track.duration - expected();
        const timer = window.setTimeout(
            () => {
                if (Date.now() - lastSent.current < 3000) return;
                lastSent.current = Date.now();
                void api<Party>('POST', `${base}/next`)
                    .then(apply)
                    .catch(() => undefined);
            },
            Math.max(0, left * 1000 + (party.is_host ? 300 : 2500)),
        );

        return () => window.clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [state, party.ended]);

    useRealtime(`listen.${party.id}`, {
        'listen.updated': (
            event: Partial<Party> & {
                ended?: boolean;
                suggestions?: QueueItem[];
                message?: RoomMessage;
                reaction?: RoomMessage;
                kicked?: number;
                host?: UserCard;
            },
        ) => {
            if (event.state) apply({ state: event.state });
            if (event.queue) apply({ queue: event.queue });
            if (event.members) apply({ members: event.members });
            if (event.suggestions) {
                const suggestions = event.suggestions;
                setParty((p) =>
                    p.room ? { ...p, room: { ...p.room, suggestions } } : p,
                );
            }
            if (event.message) {
                const message = event.message;
                setParty((p) =>
                    p.room && !p.room.messages.some((x) => x.id === message.id)
                        ? {
                              ...p,
                              room: {
                                  ...p.room,
                                  messages: [...p.room.messages, message].slice(
                                      -60,
                                  ),
                              },
                          }
                        : p,
                );
            }
            if (event.reaction) fly([event.reaction]);
            if (event.kicked === auth.user.id) {
                toast(tr('Діджей прибрав вас із кімнати'));
                router.visit('/music/rooms');
            }
            // Змінився діджей — права в кожного свої, тож звіряємо стан.
            if (event.host) refresh();
            if (event.ended) {
                apply({ ended: true });
                toast(tr('Ведучий завершив спільне прослуховування'));
            }
        },
    });

    /** Реакції злітають над обкладинкою; кожну показуємо один раз (і з Reverb, і з опитування). */
    const fly = (items: RoomMessage[]) => {
        const fresh = items.filter((r) => !seenReactions.current.has(r.id));
        if (fresh.length === 0) return;
        fresh.forEach((r) => seenReactions.current.add(r.id));
        setFlying((f) => [...f, ...fresh].slice(-12));
        window.setTimeout(
            () =>
                setFlying((f) =>
                    f.filter((x) => !fresh.some((r) => r.id === x.id)),
                ),
            2600,
        );
    };

    const refresh = () =>
        void api<Party>('GET', `${base}/state`)
            .then((fresh) => {
                apply(fresh);
                if (fresh.room) fly(fresh.room.reactions);
            })
            .catch(() => undefined);

    // Сигнал «я ще тут» і звірка стану раз на 20 секунд.
    useEffect(() => {
        const timer = window.setInterval(refresh, 20000);

        return () => window.clearInterval(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [base]);

    // Пошук треків для черги.
    useEffect(() => {
        const timer = window.setTimeout(() => {
            void api<{ tracks: LocalTrack[] }>(
                'GET',
                `/music/search?scope=all&q=${encodeURIComponent(search)}`,
            )
                .then((d) =>
                    setResults(d.tracks.filter((t) => t.source === 'local')),
                )
                .catch(() => setResults([]));
        }, 300);

        return () => window.clearTimeout(timer);
    }, [search]);

    // Радіостанції GameCon — їх теж можна поставити всім (лише в кімнатах).
    const isRoom = party.room !== null;
    useEffect(() => {
        if (!isRoom) return;
        void api<{ stations: RadioTrack[] }>('GET', '/music/rooms')
            .then((d) => setStations(d.stations))
            .catch(() => undefined);
    }, [isRoom]);

    const control = (playing: boolean, position: number) =>
        void api<{ state: Playback }>('POST', `${base}/state`, {
            playing,
            position,
        })
            .then(apply)
            .catch((e: Error) => toast.error(e.message));

    // У кімнаті з погодженням слухач лише пропонує — вирішує діджей.
    const suggests = !!party.room?.moderated && !party.can_control;
    const enqueue = (track: LocalTrack | RadioTrack) =>
        void api<Party>(
            'POST',
            `${base}/${party.room ? 'suggest' : 'queue'}`,
            track.source === 'radio'
                ? { station_id: track.id }
                : { track_id: track.id },
        )
            .then((fresh) => {
                apply(fresh);
                toast.success(
                    suggests
                        ? tr('Запропоновано діджею: «{title}»', {
                              title: track.title,
                          })
                        : tr('«{title}» у черзі', { title: track.title }),
                );
            })
            .catch((e: Error) => toast.error(e.message));

    const roomAction = (path: string, body: Record<string, unknown>) =>
        void api<Party>('POST', `${base}/${path}`, body)
            .then(apply)
            .catch((e: Error) => toast.error(e.message));

    const host = party.room ? tr('Діджей:') : tr('Ведучий:');

    const position = state.track
        ? player.current?.key === state.track.key
            ? player.position
            : expected()
        : 0;

    return (
        <>
            <Head title={party.room?.title ?? tr('Слухаємо разом')} />
            <div className="mx-auto grid max-w-5xl grid-cols-1 gap-4 lg:grid-cols-[1fr_340px]">
                <div className="space-y-4">
                    <section className="glass relative overflow-hidden rounded-3xl">
                        <FlyingReactions items={flying} />
                        <div className="flex flex-col items-center gap-4 p-5 sm:flex-row sm:items-end">
                            <div className="size-40 shrink-0 overflow-hidden rounded-2xl bg-white/[0.06] sm:size-44">
                                {state.track?.cover_url ? (
                                    <img
                                        loading="lazy"
                                        decoding="async"
                                        src={state.track.cover_url}
                                        alt=""
                                        className="size-full object-cover"
                                    />
                                ) : (
                                    <span className="flex size-full items-center justify-center">
                                        <Headphones className="size-12 text-white/30" />
                                    </span>
                                )}
                            </div>
                            <div className="min-w-0 flex-1 text-center sm:text-left">
                                <p className="text-xs font-semibold text-gc-lilac-200">
                                    {party.room?.title ?? tr('Слухаємо разом')}
                                    {party.room?.group && (
                                        <>
                                            {' · '}
                                            <Link
                                                href={party.room.group.url}
                                                className="hover:text-white"
                                            >
                                                {party.room.group.name}
                                            </Link>
                                        </>
                                    )}
                                    {party.ended && tr(' · завершено')}
                                </p>
                                <h1 className="mt-1 truncate font-display text-2xl font-semibold text-white">
                                    {state.track?.title ?? tr('Нічого не грає')}
                                </h1>
                                <p className="truncate text-sm text-white/60">
                                    {state.track?.artist ??
                                        tr(
                                            'Додайте трек у чергу — він заграє одразу',
                                        )}
                                </p>
                                <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-white/45">
                                    <Crown className="size-3.5 text-amber-300" />
                                    {host} {party.host?.name}
                                    {state.shared_control &&
                                        tr(' · керують усі')}
                                </p>
                            </div>
                        </div>

                        {state.track && (
                            <div className="px-5 pb-5">
                                {state.track.duration > 0 ? (
                                    <input
                                        type="range"
                                        min={0}
                                        max={state.track.duration}
                                        step={1}
                                        value={Math.min(
                                            position,
                                            state.track.duration,
                                        )}
                                        disabled={
                                            !party.can_control || party.ended
                                        }
                                        onChange={(e) => {
                                            const to = Number(e.target.value);
                                            seek(to);
                                            control(state.playing, to);
                                        }}
                                        className="w-full accent-[var(--accent)]"
                                        aria-label={tr('Позиція')}
                                    />
                                ) : (
                                    <p className="text-center text-xs font-semibold text-rose-200">
                                        {tr('Радіо наживо')}
                                    </p>
                                )}
                                {state.track.duration > 0 && (
                                    <div className="flex justify-between text-xs text-white/45">
                                        <span>{clock(position)}</span>
                                        <span>
                                            {clock(state.track.duration)}
                                        </span>
                                    </div>
                                )}
                                <div className="mt-3 flex items-center justify-center gap-3">
                                    {party.can_control && !party.ended ? (
                                        <>
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    control(
                                                        !state.playing,
                                                        expected(),
                                                    )
                                                }
                                                className="btn-glow flex size-14 items-center justify-center rounded-full"
                                                aria-label={
                                                    state.playing
                                                        ? tr('Пауза')
                                                        : tr('Грати')
                                                }
                                            >
                                                {state.playing ? (
                                                    <Pause className="size-6" />
                                                ) : (
                                                    <Play className="ml-0.5 size-6" />
                                                )}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    void api<Party>(
                                                        'POST',
                                                        `${base}/next`,
                                                    )
                                                        .then(apply)
                                                        .catch((e: Error) =>
                                                            toast.error(
                                                                e.message,
                                                            ),
                                                        )
                                                }
                                                className="glass flex size-11 items-center justify-center rounded-full text-white/80 hover:text-white"
                                                aria-label={tr('Наступний')}
                                            >
                                                <SkipForward className="size-5" />
                                            </button>
                                        </>
                                    ) : (
                                        <button
                                            type="button"
                                            onClick={() => setSynced(!synced)}
                                            className={cn(
                                                'inline-flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-semibold',
                                                synced
                                                    ? 'bg-emerald-500/15 text-emerald-200'
                                                    : 'glass text-white/70',
                                            )}
                                        >
                                            <Headphones className="size-4" />
                                            {synced
                                                ? tr('Синхронно з ведучим')
                                                : tr('Увімкнути синхронізацію')}
                                        </button>
                                    )}
                                </div>
                            </div>
                        )}
                        {party.room && !party.ended && (
                            <div className="flex flex-wrap justify-center gap-1.5 border-t border-white/[0.06] px-5 py-3">
                                {party.room.emoji.map((emoji) => (
                                    <button
                                        key={emoji}
                                        type="button"
                                        onClick={() =>
                                            void api<{
                                                reaction: RoomMessage;
                                            }>('POST', `${base}/react`, {
                                                emoji,
                                            })
                                                .then((d) => fly([d.reaction]))
                                                .catch((e: Error) =>
                                                    toast.error(e.message),
                                                )
                                        }
                                        className="flex size-9 items-center justify-center rounded-full text-lg transition hover:bg-white/[0.08] active:scale-90"
                                        aria-label={tr('Реакція {emoji}', {
                                            emoji,
                                        })}
                                    >
                                        {emoji}
                                    </button>
                                ))}
                            </div>
                        )}
                    </section>

                    {party.room &&
                        !party.ended &&
                        party.room.suggestions.length > 0 && (
                            <Suggestions
                                items={party.room.suggestions}
                                canReview={party.room.can_review}
                                me={auth.user.id}
                                onReview={(index, approve) =>
                                    roomAction(`suggestions/${index}`, {
                                        approve,
                                    })
                                }
                            />
                        )}

                    <section className="glass rounded-3xl p-4 sm:p-5">
                        <div className="mb-3 flex items-center gap-2">
                            <ListMusic className="size-4 text-gc-lilac-200" />
                            <h2 className="flex-1 font-display text-base font-semibold text-white">
                                {tr('Черга')}
                            </h2>
                            <span className="text-xs text-white/40">
                                {party.queue.length}
                            </span>
                        </div>
                        {party.queue.length === 0 && (
                            <p className="text-sm text-white/45">
                                {tr(
                                    suggests
                                        ? 'Черга порожня. Запропонуйте трек — діджей вирішить.'
                                        : 'Черга порожня. Знайдіть трек нижче — додати може кожен.',
                                )}
                            </p>
                        )}
                        {party.queue.map((item, i) => (
                            <div
                                key={`${item.index}-${item.track.id}`}
                                className="flex items-center gap-3 border-b border-white/[0.05] py-2 last:border-0"
                            >
                                <span className="w-5 text-center text-xs text-white/35">
                                    {i + 1}
                                </span>
                                <span className="min-w-0 flex-1">
                                    <span className="block truncate text-sm text-white">
                                        {item.track.title}
                                    </span>
                                    <span className="block truncate text-xs text-white/45">
                                        {item.track.artist}
                                        {item.by &&
                                            tr(' · додав(-ла) {name}', {
                                                name: item.by.name,
                                            })}
                                    </span>
                                </span>
                                {!party.ended &&
                                    (party.can_control ||
                                        item.by?.id === auth.user.id) && (
                                        <button
                                            type="button"
                                            onClick={() =>
                                                void api<Party>(
                                                    'DELETE',
                                                    `${base}/queue/${item.index}`,
                                                )
                                                    .then(apply)
                                                    .catch((e: Error) =>
                                                        toast.error(e.message),
                                                    )
                                            }
                                            className="text-white/35 hover:text-rose-300"
                                            aria-label={tr('Прибрати')}
                                        >
                                            <Trash2 className="size-4" />
                                        </button>
                                    )}
                            </div>
                        ))}

                        {!party.ended && (
                            <div className="mt-4 border-t border-white/[0.06] pt-4">
                                <label className="input-glass flex h-10 items-center gap-2 rounded-xl px-3">
                                    <Search className="size-4 text-white/35" />
                                    <input
                                        value={search}
                                        onChange={(e) =>
                                            setSearch(e.target.value)
                                        }
                                        placeholder={tr(
                                            'Знайти трек на GameCon',
                                        )}
                                        className="min-w-0 flex-1 bg-transparent text-sm text-white placeholder:text-white/30 focus:outline-none"
                                    />
                                </label>
                                <div className="mt-2 max-h-72 overflow-y-auto">
                                    {results.map((t) => (
                                        <div
                                            key={t.key}
                                            className="flex items-center gap-3 rounded-xl px-2 py-1.5 hover:bg-white/[0.04]"
                                        >
                                            <span className="size-9 shrink-0 overflow-hidden rounded-lg bg-white/[0.06]">
                                                {t.cover_url ? (
                                                    <img
                                                        loading="lazy"
                                                        decoding="async"
                                                        src={t.cover_url}
                                                        alt=""
                                                        className="size-full object-cover"
                                                    />
                                                ) : (
                                                    <Music2 className="m-2 size-5 text-white/35" />
                                                )}
                                            </span>
                                            <span className="min-w-0 flex-1">
                                                <span className="block truncate text-sm text-white">
                                                    {t.title}
                                                </span>
                                                <span className="block truncate text-xs text-white/45">
                                                    {t.artist} ·{' '}
                                                    {clock(t.duration)}
                                                </span>
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() => enqueue(t)}
                                                className="glass flex size-8 items-center justify-center rounded-lg text-white/75 hover:text-white"
                                                aria-label={tr('У чергу')}
                                            >
                                                <Plus className="size-4" />
                                            </button>
                                        </div>
                                    ))}
                                    {stations.length > 0 && (
                                        <p className="mt-3 px-2 text-xs font-semibold text-white/40">
                                            {tr('Радіо GameCon')}
                                        </p>
                                    )}
                                    {stations
                                        .filter((st) =>
                                            st.title
                                                .toLowerCase()
                                                .includes(
                                                    search.trim().toLowerCase(),
                                                ),
                                        )
                                        .map((st) => (
                                            <div
                                                key={st.key}
                                                className="flex items-center gap-3 rounded-xl px-2 py-1.5 hover:bg-white/[0.04]"
                                            >
                                                <span className="size-9 shrink-0 overflow-hidden rounded-lg bg-white/[0.06]">
                                                    {st.cover_url ? (
                                                        <img
                                                            loading="lazy"
                                                            decoding="async"
                                                            src={st.cover_url}
                                                            alt=""
                                                            className="size-full object-contain"
                                                        />
                                                    ) : (
                                                        <Headphones className="m-2 size-5 text-white/35" />
                                                    )}
                                                </span>
                                                <span className="min-w-0 flex-1 truncate text-sm text-white">
                                                    {st.title}
                                                </span>
                                                <button
                                                    type="button"
                                                    onClick={() => enqueue(st)}
                                                    className="glass flex size-8 items-center justify-center rounded-lg text-white/75 hover:text-white"
                                                    aria-label={tr('У чергу')}
                                                >
                                                    <Plus className="size-4" />
                                                </button>
                                            </div>
                                        ))}
                                </div>
                                {party.room && (
                                    <p className="mt-3 flex gap-2 text-xs text-white/40">
                                        <Info className="mt-0.5 size-3.5 shrink-0" />
                                        {tr(
                                            'Синхронно грають лише треки GameCon і радіо. Spotify кожен слухає через власний акаунт, тому його не можна увімкнути всім одночасно.',
                                        )}
                                    </p>
                                )}
                            </div>
                        )}
                    </section>
                </div>

                <aside className="space-y-4">
                    <section className="glass rounded-3xl p-4">
                        <div className="mb-3 flex items-center gap-2">
                            <Users className="size-4 text-gc-lilac-200" />
                            <h2 className="flex-1 font-display text-base font-semibold text-white">
                                {tr('Слухають (')}
                                {party.members.length})
                            </h2>
                        </div>
                        <div className="space-y-2">
                            {party.members.map((m) => (
                                <Link
                                    key={m.id}
                                    href={`/${m.username}`}
                                    className="flex items-center gap-2.5"
                                >
                                    <UserAvatar user={m} size="sm" />
                                    <span className="min-w-0 flex-1 truncate text-sm text-white/85">
                                        {m.name}
                                    </span>
                                    {m.is_host && (
                                        <Crown className="size-4 text-amber-300" />
                                    )}
                                    {party.room?.can_manage &&
                                        !party.ended &&
                                        !m.is_host && (
                                            <span
                                                className="flex gap-1"
                                                onClick={(e) =>
                                                    e.preventDefault()
                                                }
                                            >
                                                <button
                                                    type="button"
                                                    title={tr(
                                                        'Передати роль діджея',
                                                    )}
                                                    aria-label={tr(
                                                        'Передати роль діджея',
                                                    )}
                                                    onClick={() =>
                                                        confirm(
                                                            tr(
                                                                'Передати роль діджея: {name}?',
                                                                {
                                                                    name: m.name,
                                                                },
                                                            ),
                                                        ) &&
                                                        roomAction('host', {
                                                            user_id: m.id,
                                                        })
                                                    }
                                                    className="rounded-lg p-1 text-white/35 hover:text-amber-300"
                                                >
                                                    <Crown className="size-4" />
                                                </button>
                                                <button
                                                    type="button"
                                                    title={tr(
                                                        'Прибрати з кімнати',
                                                    )}
                                                    aria-label={tr(
                                                        'Прибрати з кімнати',
                                                    )}
                                                    onClick={() =>
                                                        confirm(
                                                            tr(
                                                                'Прибрати з кімнати: {name}?',
                                                                {
                                                                    name: m.name,
                                                                },
                                                            ),
                                                        ) &&
                                                        roomAction('kick', {
                                                            user_id: m.id,
                                                        })
                                                    }
                                                    className="rounded-lg p-1 text-white/35 hover:text-rose-300"
                                                >
                                                    <UserMinus className="size-4" />
                                                </button>
                                            </span>
                                        )}
                                </Link>
                            ))}
                        </div>
                    </section>

                    {party.room && (
                        <RoomChat
                            messages={party.room.messages}
                            disabled={party.ended}
                            onSend={(body) =>
                                api<{ message: RoomMessage }>(
                                    'POST',
                                    `${base}/chat`,
                                    { body },
                                ).then(({ message }) =>
                                    setParty((p) =>
                                        p.room &&
                                        !p.room.messages.some(
                                            (x) => x.id === message.id,
                                        )
                                            ? {
                                                  ...p,
                                                  room: {
                                                      ...p.room,
                                                      messages: [
                                                          ...p.room.messages,
                                                          message,
                                                      ],
                                                  },
                                              }
                                            : p,
                                    ),
                                )
                            }
                        />
                    )}

                    {!party.ended && (
                        <section className="glass space-y-2 rounded-3xl p-4">
                            <button
                                type="button"
                                onClick={() => {
                                    void navigator.clipboard
                                        .writeText(party.url)
                                        .then(() =>
                                            toast.success(
                                                tr('Посилання скопійовано'),
                                            ),
                                        );
                                }}
                                className="glass flex h-10 w-full items-center justify-center gap-2 rounded-xl text-sm text-white/80 hover:text-white"
                            >
                                <Copy className="size-4" />{' '}
                                {tr('Скопіювати посилання')}
                            </button>
                            <button
                                type="button"
                                onClick={() => setInviting(!inviting)}
                                className="btn-glow flex h-10 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold"
                            >
                                <UserPlus className="size-4" />{' '}
                                {tr('Запросити друзів')}
                            </button>
                            {inviting && (
                                <div className="max-h-64 overflow-y-auto pt-1">
                                    {friends.length === 0 && (
                                        <p className="text-sm text-white/45">
                                            {tr('Друзів поки немає.')}
                                        </p>
                                    )}
                                    {friends.map((f) => (
                                        <button
                                            key={f.id}
                                            type="button"
                                            onClick={() =>
                                                void api(
                                                    'POST',
                                                    `${base}/invite`,
                                                    {
                                                        user_ids: [f.id],
                                                    },
                                                )
                                                    .then(() =>
                                                        toast.success(
                                                            tr(
                                                                'Запрошення надіслано: {name}',
                                                                {
                                                                    name: f.name,
                                                                },
                                                            ),
                                                        ),
                                                    )
                                                    .catch((e: Error) =>
                                                        toast.error(e.message),
                                                    )
                                            }
                                            className="flex w-full items-center gap-2.5 rounded-xl px-2 py-1.5 text-left hover:bg-white/[0.05]"
                                        >
                                            <UserAvatar user={f} size="sm" />
                                            <span className="min-w-0 flex-1 truncate text-sm text-white/85">
                                                {f.name}
                                            </span>
                                            <UserPlus className="size-4 text-white/40" />
                                        </button>
                                    ))}
                                </div>
                            )}
                            {(party.is_host || party.room?.can_manage) && (
                                <>
                                    {repeatOn && (
                                        <label className="flex cursor-pointer items-center justify-between gap-2 rounded-xl px-1 py-2 text-sm text-white/75">
                                            {tr('Повторювати цей трек')}
                                            <input
                                                type="checkbox"
                                                checked={state.repeat}
                                                onChange={(e) =>
                                                    void api<{
                                                        state: Playback;
                                                    }>(
                                                        'POST',
                                                        `${base}/repeat`,
                                                        {
                                                            repeat: e.target
                                                                .checked,
                                                        },
                                                    ).then(apply)
                                                }
                                            />
                                        </label>
                                    )}
                                    <label className="flex cursor-pointer items-center justify-between gap-2 rounded-xl px-1 py-2 text-sm text-white/75">
                                        {tr('Керувати можуть усі')}
                                        <input
                                            type="checkbox"
                                            checked={state.shared_control}
                                            onChange={(e) =>
                                                void api<{ state: Playback }>(
                                                    'POST',
                                                    `${base}/shared`,
                                                    {
                                                        shared: e.target
                                                            .checked,
                                                    },
                                                ).then(apply)
                                            }
                                        />
                                    </label>
                                    <button
                                        type="button"
                                        onClick={() =>
                                            confirm(
                                                tr('Завершити для всіх?'),
                                            ) &&
                                            void api('DELETE', base).then(() =>
                                                apply({ ended: true }),
                                            )
                                        }
                                        className="flex h-10 w-full items-center justify-center gap-2 rounded-xl text-sm text-rose-300 hover:bg-rose-500/10"
                                    >
                                        <X className="size-4" />{' '}
                                        {tr('Завершити')}
                                    </button>
                                </>
                            )}
                        </section>
                    )}
                </aside>
            </div>
        </>
    );
}

/** Реакції злітають над обкладинкою й тануть. */
function FlyingReactions({ items }: { items: RoomMessage[] }) {
    const reduce = useReducedMotion();

    return (
        <div
            className="pointer-events-none absolute inset-0 z-10 overflow-hidden"
            aria-hidden
        >
            <AnimatePresence>
                {items.map((r) => (
                    <m.span
                        key={r.id}
                        initial={reduce ? { opacity: 0 } : { opacity: 0, y: 0 }}
                        animate={
                            reduce
                                ? { opacity: 1 }
                                : { opacity: [0, 1, 1, 0], y: -140 }
                        }
                        exit={{ opacity: 0 }}
                        transition={{ duration: reduce ? 0.2 : 2.4 }}
                        className="absolute bottom-6 text-2xl"
                        style={{ left: `${15 + ((r.id * 37) % 70)}%` }}
                        title={r.user?.name}
                    >
                        {r.emoji}
                    </m.span>
                ))}
            </AnimatePresence>
        </div>
    );
}

/** Пропозиції слухачів: діджей погоджує або відхиляє, автор може відкликати свою. */
function Suggestions({
    items,
    canReview,
    me,
    onReview,
}: {
    items: QueueItem[];
    canReview: boolean;
    me: number;
    onReview: (index: number, approve: boolean) => void;
}) {
    return (
        <section className="glass rounded-3xl p-4 sm:p-5">
            <div className="mb-3 flex items-center gap-2">
                <Plus className="size-4 text-gc-lilac-200" />
                <h2 className="flex-1 font-display text-base font-semibold text-white">
                    {tr('Пропозиції')}
                </h2>
                <span className="text-xs text-white/40">{items.length}</span>
            </div>
            {items.map((item) => (
                <div
                    key={`${item.index}-${item.track.key}`}
                    className="flex items-center gap-3 border-b border-white/[0.05] py-2 last:border-0"
                >
                    <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm text-white">
                            {item.track.title}
                        </span>
                        <span className="block truncate text-xs text-white/45">
                            {item.track.artist}
                            {item.by &&
                                tr(' · пропонує {name}', {
                                    name: item.by.name,
                                })}
                        </span>
                    </span>
                    {canReview && (
                        <button
                            type="button"
                            onClick={() => onReview(item.index, true)}
                            className="glass flex size-8 items-center justify-center rounded-lg text-emerald-300 hover:text-emerald-200"
                            aria-label={tr('Додати в чергу')}
                        >
                            <Check className="size-4" />
                        </button>
                    )}
                    {(canReview || item.by?.id === me) && (
                        <button
                            type="button"
                            onClick={() => onReview(item.index, false)}
                            className="glass flex size-8 items-center justify-center rounded-lg text-white/45 hover:text-rose-300"
                            aria-label={
                                canReview ? tr('Відхилити') : tr('Відкликати')
                            }
                        >
                            <X className="size-4" />
                        </button>
                    )}
                </div>
            ))}
        </section>
    );
}

/** Легкий чат кімнати: останні репліки, нові приходять через Reverb. */
function RoomChat({
    messages,
    disabled,
    onSend,
}: {
    messages: RoomMessage[];
    disabled: boolean;
    onSend: (body: string) => Promise<unknown>;
}) {
    const [body, setBody] = useState('');
    const list = useRef<HTMLDivElement>(null);

    useEffect(() => {
        list.current?.scrollTo({ top: list.current.scrollHeight });
    }, [messages.length]);

    const send = () => {
        const text = body.trim();
        if (!text) return;
        setBody('');
        onSend(text).catch((e: Error) => {
            setBody(text);
            toast.error(e.message);
        });
    };

    return (
        <section className="glass rounded-3xl p-4">
            <div className="mb-3 flex items-center gap-2">
                <MessageCircle className="size-4 text-gc-lilac-200" />
                <h2 className="flex-1 font-display text-base font-semibold text-white">
                    {tr('Чат кімнати')}
                </h2>
            </div>
            <div ref={list} className="max-h-72 space-y-2 overflow-y-auto">
                {messages.length === 0 && (
                    <p className="text-sm text-white/45">
                        {tr('Поки тихо. Напишіть, як вам трек.')}
                    </p>
                )}
                {messages.map((msg) => (
                    <div key={msg.id} className="flex items-start gap-2">
                        {msg.user && <UserAvatar user={msg.user} size="xs" />}
                        <p className="min-w-0 flex-1 text-sm break-words text-white/80">
                            <span className="font-semibold text-white">
                                {msg.user?.name}
                            </span>{' '}
                            {msg.body}
                        </p>
                    </div>
                ))}
            </div>
            {!disabled && (
                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        send();
                    }}
                    className="mt-3 flex gap-2"
                >
                    <input
                        value={body}
                        onChange={(e) => setBody(e.target.value)}
                        maxLength={500}
                        placeholder={tr('Повідомлення')}
                        className="input-glass h-10 min-w-0 flex-1 rounded-xl px-3 text-sm text-white placeholder:text-white/30 focus:outline-none"
                    />
                    <button
                        type="submit"
                        className="btn-glow flex size-10 items-center justify-center rounded-xl"
                        aria-label={tr('Надіслати')}
                    >
                        <Send className="size-4" />
                    </button>
                </form>
            )}
        </section>
    );
}
