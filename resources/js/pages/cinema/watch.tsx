import { Head, Link, router, usePage } from '@inertiajs/react';
import {
    ArrowLeft,
    Copy,
    Crown,
    Headphones,
    MessageCircle,
    Pause,
    Play,
    Popcorn,
    Send,
    UserPlus,
    Users,
    X,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { UserAvatar } from '@/components/gc/user-avatar';
import { useRealtime } from '@/hooks/use-realtime';
import { api, ApiError } from '@/lib/api';
import { cn } from '@/lib/utils';
import { joinWatchVoice, leaveVoice, useVoice } from '@/lib/voice';
import type { MovieCard, MoviePlayer, UserCard } from '@/types';

type Playback = {
    playing: boolean;
    position: number;
    state_ms: number;
    server_ms: number;
    player_key: string | null;
    shared_control: boolean;
};

type ChatLine = {
    id: number;
    body: string;
    user: UserCard | null;
    created_at: string;
};

type Party = {
    id: number;
    code: string;
    url: string;
    host: UserCard | null;
    is_host: boolean;
    can_control: boolean;
    ended: boolean;
    voice_enabled: boolean;
    state: Playback;
    members: (UserCard & { is_host: boolean })[];
    messages: ChatLine[];
};

type Props = {
    movie: MovieCard;
    players: MoviePlayer[];
    party: Party;
    friends: UserCard[];
};

/** Розходження з ведучим, після якого гість перемотує (секунди). */
const DRIFT = 2.5;

function clock(seconds: number) {
    const s = Math.max(0, Math.floor(seconds));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const rest = String(s % 60).padStart(2, '0');

    return h > 0
        ? `${h}:${String(m).padStart(2, '0')}:${rest}`
        : `${m}:${rest}`;
}

/**
 * Керування плеєром в iframe через postMessage. Kodik має офіційне API (точна синхронізація);
 * для інших плеєрів пробуємо формат Playerjs — якщо плеєр його не підтримує, лишається «старт разом».
 */
function usePlayerBridge(
    frame: React.RefObject<HTMLIFrameElement | null>,
    kodik: boolean,
    onEvent: (
        event: 'play' | 'pause' | 'seek' | 'time',
        time: number | null,
    ) => void,
) {
    const handler = useRef(onEvent);
    handler.current = onEvent;

    useEffect(() => {
        const listen = (message: MessageEvent) => {
            if (message.source !== frame.current?.contentWindow) return;
            const data = message.data as {
                key?: string;
                value?: unknown;
                event?: string;
                data?: unknown;
            } | null;
            if (!data || typeof data !== 'object') return;
            const name = String(data.key ?? data.event ?? '');
            const raw = data.value ?? data.data;
            const time =
                typeof raw === 'number'
                    ? raw
                    : raw && typeof raw === 'object' && 'time' in raw
                      ? Number((raw as { time: unknown }).time)
                      : null;

            if (/time_update|^time$|timeupdate/i.test(name))
                handler.current('time', time);
            else if (/play$|_play\b|^play/i.test(name))
                handler.current('play', time);
            else if (/pause/i.test(name)) handler.current('pause', time);
            else if (/seek/i.test(name)) handler.current('seek', time);
        };
        window.addEventListener('message', listen);

        return () => window.removeEventListener('message', listen);
    }, [frame]);

    const send = (method: 'play' | 'pause' | 'seek', seconds?: number) => {
        const target = frame.current?.contentWindow;
        if (!target) return;
        if (kodik) {
            target.postMessage(
                {
                    key: 'kodik_player_api',
                    value: method === 'seek' ? { method, seconds } : { method },
                },
                '*',
            );
        } else {
            target.postMessage(
                method === 'seek'
                    ? { api: 'seek', set: seconds }
                    : { api: method },
                '*',
            );
        }
    };

    return send;
}

export default function WatchParty({
    movie,
    players,
    party: initial,
    friends,
}: Props) {
    const [party, setParty] = useState(initial);
    const [messages, setMessages] = useState(initial.messages);
    const [draft, setDraft] = useState('');
    const [inviteOpen, setInviteOpen] = useState(false);
    const [picked, setPicked] = useState<number[]>([]);
    const [localTime, setLocalTime] = useState(0);
    const [synced, setSynced] = useState(false);
    const voice = useVoice();
    const myId = usePage().props.auth.user.id;
    const frame = useRef<HTMLIFrameElement>(null);
    const chatEnd = useRef<HTMLDivElement>(null);

    // Різниця годинників сервера й браузера: позицію ведучого рахуємо за часом сервера.
    const offset = useRef(initial.state.server_ms - Date.now());
    const applyingUntil = useRef(0);
    const lastSeek = useRef(0);

    const state = party.state;
    const player =
        players.find((p) => p.key === state.player_key) ?? players[0] ?? null;
    const kodik = player?.provider === 'kodik';
    const control = party.can_control && !party.ended;

    const expected = (s: Playback = state) =>
        s.playing
            ? s.position + (Date.now() + offset.current - s.state_ms) / 1000
            : s.position;

    const send = usePlayerBridge(frame, kodik, (event, time) => {
        if (event === 'time') {
            if (time !== null && Number.isFinite(time)) {
                setLocalTime(time);
                setSynced(true);
                // Гість відстав чи забіг — тихо підтягуємо до ведучого.
                if (
                    !control &&
                    Math.abs(time - expected()) > DRIFT &&
                    Date.now() - lastSeek.current > 4000
                ) {
                    lastSeek.current = Date.now();
                    applyingUntil.current = Date.now() + 1500;
                    send('seek', expected());
                }
            }

            return;
        }
        if (Date.now() < applyingUntil.current) return;

        if (control) {
            const position = time ?? localTime;
            const playing =
                event === 'play'
                    ? true
                    : event === 'pause'
                      ? false
                      : state.playing;
            void api<{ state: Playback }>(
                'POST',
                `/watch/${party.code}/state`,
                {
                    playing,
                    position,
                    player_key: player?.key ?? null,
                },
            )
                .then(({ state: next }) => {
                    offset.current = next.server_ms - Date.now();
                    setParty((p) => ({ ...p, state: next }));
                })
                .catch(() => undefined);
        } else {
            // Плеєром керує ведучий: повертаємо гостя до спільного стану.
            window.setTimeout(() => apply(state), 300);
        }
    });

    const apply = (next: Playback) => {
        applyingUntil.current = Date.now() + 1500;
        const target = expected(next);
        if (Math.abs(localTime - target) > DRIFT) send('seek', target);
        send(next.playing ? 'play' : 'pause');
    };

    useRealtime(`watch.${party.id}`, {
        'watch.updated': (event: {
            state?: Playback;
            by?: number;
            message?: ChatLine;
            members?: Party['members'];
            ended?: boolean;
        }) => {
            if (event.state) {
                const next = event.state;
                offset.current = next.server_ms - Date.now();
                setParty((p) => ({
                    ...p,
                    state: next,
                    can_control: p.is_host || next.shared_control,
                }));
                // Свої дії вже в плеєрі; підлаштовуємося лише під чужі.
                if (event.by !== myId) apply(next);
            }
            if (event.message) {
                const line = event.message;
                setMessages((list) =>
                    list.some((m) => m.id === line.id) ? list : [...list, line],
                );
            }
            if (event.members) {
                const members = event.members;
                setParty((p) => ({ ...p, members }));
            }
            if (event.ended) {
                setParty((p) => ({ ...p, ended: true }));
                toast('Ведучий завершив спільний перегляд');
            }
        },
    });

    // Сигнал «я ще тут» і звірка стану раз на 20 секунд.
    useEffect(() => {
        const timer = window.setInterval(() => {
            void api<Party>('GET', `/watch/${party.code}/state`)
                .then((fresh) => {
                    offset.current = fresh.state.server_ms - Date.now();
                    setParty((p) => ({ ...p, ...fresh, messages: p.messages }));
                })
                .catch(() => undefined);
        }, 20000);

        return () => window.clearInterval(timer);
    }, [party.code]);

    useEffect(() => {
        chatEnd.current?.scrollIntoView({ block: 'end' });
    }, [messages.length]);

    const say = async () => {
        const body = draft.trim();
        if (!body) return;
        setDraft('');
        try {
            await api('POST', `/watch/${party.code}/messages`, { body });
        } catch (e) {
            setDraft(body);
            toast.error(e instanceof ApiError ? e.message : 'Не надіслано');
        }
    };

    const startTogether = () => {
        void api<{ state: Playback }>('POST', `/watch/${party.code}/state`, {
            playing: true,
            position: kodik ? localTime : 0,
            player_key: player?.key ?? null,
        }).catch((e) =>
            toast.error(e instanceof ApiError ? e.message : 'Не вдалося'),
        );
    };

    const pauseAll = () => {
        void api('POST', `/watch/${party.code}/state`, {
            playing: false,
            position: kodik ? localTime : expected(),
            player_key: player?.key ?? null,
        }).catch(() => undefined);
    };

    const switchPlayer = (key: string) => {
        void api('POST', `/watch/${party.code}/state`, {
            playing: false,
            position: 0,
            player_key: key,
        }).catch(() => undefined);
    };

    const invite = async () => {
        try {
            const { sent } = await api<{ sent: number }>(
                'POST',
                `/watch/${party.code}/invite`,
                { user_ids: picked },
            );
            toast.success(`Запрошення надіслано: ${sent}`);
            setInviteOpen(false);
            setPicked([]);
        } catch (e) {
            toast.error(
                e instanceof ApiError ? e.message : 'Не вдалося надіслати',
            );
        }
    };

    const inVoice =
        voice.kind === 'room' &&
        voice.href === `/watch/${party.code}` &&
        voice.status !== 'idle';

    return (
        <>
            <Head title={`Разом: ${movie.title}`} />
            <div className="mb-4 flex flex-wrap items-center gap-3">
                <Link
                    href={movie.href}
                    className="inline-flex size-10 items-center justify-center rounded-xl text-white/70 transition hover:bg-white/[0.07] hover:text-white"
                    aria-label="До фільму"
                >
                    <ArrowLeft className="size-5" />
                </Link>
                <div className="min-w-0 flex-1">
                    <h1 className="flex items-center gap-2 truncate font-display text-lg font-semibold text-white">
                        <Popcorn className="size-5 shrink-0 text-[#a5b4fc]" />
                        <span className="truncate">{movie.title}</span>
                    </h1>
                    <p className="truncate text-xs text-white/50">
                        Спільний перегляд · ведучий {party.host?.name ?? '—'}
                    </p>
                </div>
                <button
                    type="button"
                    onClick={() => {
                        void navigator.clipboard?.writeText(party.url);
                        toast.success('Посилання скопійовано');
                    }}
                    className="glass inline-flex h-10 items-center gap-2 rounded-xl px-3.5 text-sm text-white/80 hover:text-white"
                >
                    <Copy className="size-4" /> Посилання
                </button>
                {!party.ended && (
                    <button
                        type="button"
                        onClick={() => setInviteOpen(true)}
                        className="btn-glow inline-flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-semibold"
                    >
                        <UserPlus className="size-4" /> Запросити
                    </button>
                )}
            </div>

            {party.ended && (
                <div className="glass mb-4 rounded-2xl px-4 py-3 text-sm text-white/70">
                    Спільний перегляд завершено. Фільм можна додивитися{' '}
                    <Link
                        href={movie.href}
                        className="text-[#a5b4fc] hover:underline"
                    >
                        на його сторінці
                    </Link>
                    .
                </div>
            )}

            <div className="flex flex-col gap-4 xl:flex-row">
                <div className="min-w-0 flex-1 space-y-3">
                    <div className="glass overflow-hidden rounded-3xl">
                        <div className="relative aspect-video bg-black">
                            {player ? (
                                <iframe
                                    ref={frame}
                                    key={player.key}
                                    src={player.link}
                                    title={movie.title}
                                    className="absolute inset-0 size-full"
                                    allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
                                    allowFullScreen
                                />
                            ) : (
                                <div className="absolute inset-0 flex items-center justify-center text-sm text-white/50">
                                    Для фільму немає плеєра
                                </div>
                            )}
                        </div>
                        <div className="flex flex-wrap items-center gap-2 p-3">
                            <span
                                className={cn(
                                    'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium',
                                    state.playing
                                        ? 'bg-emerald-400/15 text-emerald-200'
                                        : 'bg-white/[0.06] text-white/60',
                                )}
                            >
                                {state.playing ? (
                                    <Play className="size-3.5 fill-current" />
                                ) : (
                                    <Pause className="size-3.5" />
                                )}
                                Ведучий: {clock(expected())}
                            </span>
                            {kodik ? (
                                <span className="text-xs text-white/45">
                                    {synced
                                        ? 'Синхронізовано з ведучим'
                                        : 'Натисніть Play у плеєрі, щоб підключитися'}
                                </span>
                            ) : (
                                <span className="text-xs text-amber-200/80">
                                    Цей плеєр не дає керувати собою — тисніть
                                    Play разом за сигналом «Старт».
                                </span>
                            )}
                            {control && (
                                <span className="ml-auto flex flex-wrap gap-2">
                                    <button
                                        type="button"
                                        onClick={startTogether}
                                        className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-emerald-500 px-3 text-sm font-semibold text-white hover:bg-emerald-500/85"
                                    >
                                        <Play className="size-4 fill-current" />{' '}
                                        Старт разом
                                    </button>
                                    <button
                                        type="button"
                                        onClick={pauseAll}
                                        className="glass inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-sm text-white/80"
                                    >
                                        <Pause className="size-4" /> Пауза для
                                        всіх
                                    </button>
                                </span>
                            )}
                        </div>
                        {control && players.length > 1 && (
                            <div className="flex flex-wrap gap-1.5 border-t border-white/[0.06] p-3">
                                {players.map((p) => (
                                    <button
                                        key={p.key}
                                        type="button"
                                        onClick={() => switchPlayer(p.key)}
                                        className={cn(
                                            'rounded-lg px-2.5 py-1 text-xs transition',
                                            p.key === player?.key
                                                ? 'bg-gradient-brand text-white'
                                                : 'bg-white/[0.05] text-white/60 hover:text-white',
                                        )}
                                    >
                                        {p.provider_label}
                                        {p.translation
                                            ? ` · ${p.translation}`
                                            : ''}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                    {party.is_host && !party.ended && (
                        <div className="flex flex-wrap items-center gap-3 px-1">
                            <label className="inline-flex items-center gap-2 text-sm text-white/70">
                                <input
                                    type="checkbox"
                                    checked={state.shared_control}
                                    onChange={(e) =>
                                        void api(
                                            'POST',
                                            `/watch/${party.code}/shared`,
                                            { shared: e.target.checked },
                                        )
                                    }
                                />
                                Керувати плеєром можуть усі
                            </label>
                            <button
                                type="button"
                                onClick={() => {
                                    if (
                                        !confirm(
                                            'Завершити спільний перегляд для всіх?',
                                        )
                                    )
                                        return;
                                    void api(
                                        'DELETE',
                                        `/watch/${party.code}`,
                                    ).then(() => router.visit(movie.href));
                                }}
                                className="ml-auto inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-sm text-rose-300 hover:bg-rose-500/10"
                            >
                                <X className="size-4" /> Завершити
                            </button>
                        </div>
                    )}
                </div>

                <aside className="flex w-full shrink-0 flex-col gap-3 xl:w-[340px]">
                    <section className="glass rounded-3xl p-4">
                        <div className="mb-3 flex items-center gap-2">
                            <Users className="size-4 text-[#a5b4fc]" />
                            <h2 className="flex-1 text-sm font-semibold text-white">
                                Дивляться ({party.members.length})
                            </h2>
                            {party.voice_enabled && !party.ended && (
                                <button
                                    type="button"
                                    onClick={() =>
                                        inVoice
                                            ? void leaveVoice()
                                            : void joinWatchVoice(
                                                  party.code,
                                                  movie.title,
                                              )
                                    }
                                    className={cn(
                                        'inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold transition',
                                        inVoice
                                            ? 'bg-rose-500 text-white'
                                            : 'bg-emerald-500 text-white hover:bg-emerald-500/85',
                                    )}
                                >
                                    <Headphones className="size-3.5" />
                                    {inVoice ? 'Вийти з голосу' : 'Голос'}
                                </button>
                            )}
                        </div>
                        <ul className="space-y-1.5">
                            {party.members.map((m) => (
                                <li
                                    key={m.id}
                                    className="flex items-center gap-2"
                                >
                                    <span
                                        className={cn(
                                            'rounded-full ring-2 transition',
                                            voice.speaking.includes(`u${m.id}`)
                                                ? 'ring-emerald-400'
                                                : 'ring-transparent',
                                        )}
                                    >
                                        <UserAvatar user={m} size="xs" />
                                    </span>
                                    <span className="min-w-0 flex-1 truncate text-sm text-white/80">
                                        {m.name}
                                    </span>
                                    {m.is_host && (
                                        <Crown
                                            className="size-3.5 text-amber-300"
                                            aria-label="Ведучий"
                                        />
                                    )}
                                </li>
                            ))}
                        </ul>
                    </section>

                    <section className="glass flex min-h-[320px] flex-1 flex-col rounded-3xl p-4 xl:max-h-[calc(100dvh-260px)]">
                        <div className="mb-2 flex items-center gap-2">
                            <MessageCircle className="size-4 text-[#a5b4fc]" />
                            <h2 className="text-sm font-semibold text-white">
                                Чат перегляду
                            </h2>
                        </div>
                        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
                            {messages.length === 0 && (
                                <p className="py-6 text-center text-xs text-white/40">
                                    Обговорюйте фільм тут
                                </p>
                            )}
                            {messages.map((m) => (
                                <div key={m.id} className="flex gap-2">
                                    {m.user && (
                                        <UserAvatar user={m.user} size="xs" />
                                    )}
                                    <div className="min-w-0">
                                        <span className="text-xs font-semibold text-white/80">
                                            {m.user?.first_name ?? '—'}{' '}
                                        </span>
                                        <span className="text-sm break-words text-white/75">
                                            {m.body}
                                        </span>
                                    </div>
                                </div>
                            ))}
                            <div ref={chatEnd} />
                        </div>
                        {!party.ended && (
                            <form
                                onSubmit={(e) => {
                                    e.preventDefault();
                                    void say();
                                }}
                                className="mt-3 flex gap-2"
                            >
                                <input
                                    value={draft}
                                    maxLength={500}
                                    onChange={(e) => setDraft(e.target.value)}
                                    placeholder="Повідомлення"
                                    className="input-glass h-10 min-w-0 flex-1 rounded-xl px-3 text-sm text-white placeholder:text-white/30 focus:outline-none"
                                />
                                <button
                                    type="submit"
                                    aria-label="Надіслати"
                                    className="btn-glow inline-flex size-10 items-center justify-center rounded-xl"
                                >
                                    <Send className="size-4" />
                                </button>
                            </form>
                        )}
                    </section>
                </aside>
            </div>

            {inviteOpen && (
                <div
                    className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center"
                    onClick={() => setInviteOpen(false)}
                >
                    <div
                        className="glass-strong w-full max-w-md rounded-3xl p-5"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h2 className="mb-3 font-display text-base font-semibold text-white">
                            Запросити друзів
                        </h2>
                        <div className="max-h-[50vh] space-y-1 overflow-y-auto">
                            {friends.length === 0 && (
                                <p className="py-4 text-center text-sm text-white/45">
                                    Друзів поки немає — надішліть посилання.
                                </p>
                            )}
                            {friends.map((f) => {
                                const on = picked.includes(f.id);

                                return (
                                    <button
                                        key={f.id}
                                        type="button"
                                        onClick={() =>
                                            setPicked((list) =>
                                                on
                                                    ? list.filter(
                                                          (id) => id !== f.id,
                                                      )
                                                    : [...list, f.id].slice(
                                                          0,
                                                          20,
                                                      ),
                                            )
                                        }
                                        className={cn(
                                            'flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition',
                                            on
                                                ? 'bg-[var(--accent)]/15'
                                                : 'hover:bg-white/[0.05]',
                                        )}
                                    >
                                        <UserAvatar user={f} size="sm" />
                                        <span className="min-w-0 flex-1 truncate text-sm text-white">
                                            {f.name}
                                        </span>
                                        <span
                                            className={cn(
                                                'size-5 rounded-md border',
                                                on
                                                    ? 'border-transparent bg-gradient-brand'
                                                    : 'border-white/20',
                                            )}
                                        />
                                    </button>
                                );
                            })}
                        </div>
                        <div className="mt-4 flex justify-end gap-2">
                            <button
                                type="button"
                                onClick={() => setInviteOpen(false)}
                                className="glass inline-flex h-10 items-center rounded-xl px-4 text-sm text-white/75"
                            >
                                Скасувати
                            </button>
                            <button
                                type="button"
                                disabled={picked.length === 0}
                                onClick={() => void invite()}
                                className="btn-glow inline-flex h-10 items-center rounded-xl px-4 text-sm font-semibold disabled:opacity-50"
                            >
                                Надіслати ({picked.length})
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
