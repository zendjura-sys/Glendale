import { Head, Link } from '@inertiajs/react';
import {
    ArrowLeft,
    Hand,
    Headphones,
    LogOut,
    Mic,
    MicOff,
    Play,
    Radio,
    Share2,
    UserMinus,
    UserPlus,
} from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { toast } from 'sonner';
import { ShowPerson } from '@/components/shows/show-person';
import { Input } from '@/components/ui/input';
import { api, ApiError } from '@/lib/api';
import { tr } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { joinShow, leaveVoice, toggleMic, useVoice } from '@/lib/voice';
import type { ShowCard } from '@/pages/shows/index';
import type { UserCard } from '@/types';

type Person = UserCard & { role: string };
type Guest = Person & { seconds_left: number };

type State = {
    show: ShowCard & {
        stage_seats: number;
        guest_seats: number;
        question_seconds: number;
        peak_listeners: number;
    };
    stage: Person[];
    guests: Guest[];
    hands: Person[];
    listeners: Person[];
    listeners_count: number;
    me: { role: string; hand: boolean; can_speak: boolean } | null;
    can_manage: boolean;
};

/** Сторінка шоу: сцена з персонажами, гості з таймером, черга рук, слухачі й керування ефіром. */
export default function ShowPage(initial: State) {
    const [state, setState] = useState<State>(initial);
    const voice = useVoice();
    const reduce = useReducedMotion();
    const { show } = state;
    const inShow =
        voice.kind === 'show' &&
        voice.roomId === show.id &&
        voice.status !== 'idle';
    const isStage = state.me?.role === 'host' || state.me?.role === 'speaker';
    const isHost = state.me?.role === 'host';

    const refresh = useCallback(async () => {
        try {
            setState(await api<State>('GET', `/shows/${show.id}/state`));
        } catch {
            // Тимчасова помилка мережі — наступне опитування підхопить.
        }
    }, [show.id]);

    useEffect(() => {
        const ms = show.status === 'live' ? 3000 : 20000;
        const id = window.setInterval(refresh, ms);

        return () => window.clearInterval(id);
    }, [refresh, show.status]);

    // Шоу завершилося, поки ми слухали, — від’єднуємося.
    useEffect(() => {
        if (show.status === 'ended' && inShow) void leaveVoice();
    }, [show.status, inShow]);

    const act = async (
        method: 'POST' | 'DELETE',
        path: string,
        body?: Record<string, unknown>,
    ) => {
        try {
            setState(
                await api<State>(method, `/shows/${show.id}${path}`, body),
            );
        } catch (e) {
            toast.error(e instanceof ApiError ? e.message : tr('Не вдалося'));
        }
    };

    const share = async () => {
        const url = `${window.location.origin}/shows/${show.id}`;
        try {
            if (navigator.share)
                await navigator.share({ title: show.title, url });
            else {
                await navigator.clipboard.writeText(url);
                toast.success(tr('Посилання скопійовано'));
            }
        } catch {
            // Людина закрила вікно «Поділитися».
        }
    };

    return (
        <>
            <Head title={show.title} />
            <div className="mx-auto w-full max-w-4xl px-1 py-2 pb-28">
                <div className="mb-3 flex items-center gap-2">
                    <Link
                        href="/shows"
                        aria-label={tr('До всіх шоу')}
                        className="grid size-10 place-items-center rounded-xl text-white/70 hover:bg-white/[0.06] hover:text-white"
                    >
                        <ArrowLeft className="size-5" />
                    </Link>
                    {show.status === 'live' && (
                        <span className="rounded-md bg-rose-500 px-1.5 py-0.5 text-xs font-bold text-white">
                            LIVE
                        </span>
                    )}
                    <span className="inline-flex items-center gap-1 text-sm text-white/55">
                        <Headphones className="size-4" />
                        {state.listeners_count}
                    </span>
                    <button
                        type="button"
                        onClick={share}
                        aria-label={tr('Поділитися')}
                        className="ml-auto grid size-10 place-items-center rounded-xl text-white/70 hover:bg-white/[0.06] hover:text-white"
                    >
                        <Share2 className="size-5" />
                    </button>
                </div>

                <section className="gc-solid rounded-3xl p-5 sm:p-7">
                    <h1 className="font-display text-2xl font-bold text-white sm:text-3xl">
                        {show.title}
                        {show.topic && (
                            <span className="text-primary"> #{show.topic}</span>
                        )}
                    </h1>
                    {show.status === 'scheduled' && (
                        <p className="mt-1 text-sm text-white/55">
                            {tr('Почнеться {date}', {
                                date: show.scheduled_at
                                    ? new Date(
                                          show.scheduled_at,
                                      ).toLocaleString([], {
                                          day: 'numeric',
                                          month: 'long',
                                          hour: '2-digit',
                                          minute: '2-digit',
                                      })
                                    : '',
                            })}
                        </p>
                    )}
                    {show.status === 'ended' && (
                        <p className="mt-1 text-sm text-white/55">
                            {tr('Шоу завершилося · слухачів у піку: {n}', {
                                n: show.peak_listeners,
                            })}
                        </p>
                    )}

                    <div className="mt-6 flex flex-wrap justify-center gap-6 sm:gap-10">
                        {state.stage.map((person) => (
                            <motion.div
                                key={person.id}
                                layout={!reduce}
                                className="flex w-32 flex-col items-center sm:w-36"
                            >
                                <ShowPerson person={person} size="lg" />
                                <Link
                                    href={`/${person.username}`}
                                    className="mt-2 w-full truncate text-center text-sm font-semibold text-white hover:underline"
                                >
                                    {person.name}
                                </Link>
                                <span className="text-xs text-white/45">
                                    {person.role === 'host'
                                        ? tr('Ведучий')
                                        : tr('Співведучий')}
                                </span>
                                {isHost && person.role === 'speaker' && (
                                    <button
                                        type="button"
                                        onClick={() =>
                                            act(
                                                'DELETE',
                                                `/speakers/${person.id}`,
                                            )
                                        }
                                        className="mt-1 inline-flex items-center gap-1 text-xs text-white/50 hover:text-rose-400"
                                    >
                                        <UserMinus className="size-3.5" />{' '}
                                        {tr('Зі сцени')}
                                    </button>
                                )}
                            </motion.div>
                        ))}
                    </div>

                    <AnimatePresence>
                        {state.guests.length > 0 && (
                            <motion.div
                                initial={reduce ? false : { opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0 }}
                                className="mt-7 flex flex-wrap justify-center gap-5 rounded-2xl bg-white/[0.03] p-4"
                            >
                                {state.guests.map((g) => (
                                    <GuestSeat
                                        key={g.id}
                                        guest={g}
                                        total={show.question_seconds}
                                        canStop={
                                            isStage ||
                                            state.me?.role === 'guest'
                                        }
                                        onStop={() =>
                                            act('DELETE', `/floor/${g.id}`)
                                        }
                                    />
                                ))}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </section>

                {isStage &&
                    state.hands.length > 0 &&
                    show.status === 'live' && (
                        <section className="gc-solid mt-4 rounded-2xl p-4">
                            <h2 className="flex items-center gap-2 font-display text-base font-bold text-white">
                                <Hand className="size-4 text-amber-300" />
                                {tr('Підняті руки')}
                            </h2>
                            <ul className="mt-3 space-y-2">
                                {state.hands.map((p) => (
                                    <li
                                        key={p.id}
                                        className="flex items-center gap-3"
                                    >
                                        <ShowPerson person={p} size="sm" />
                                        <span className="min-w-0 flex-1 truncate text-sm text-white">
                                            {p.name}
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() =>
                                                act('POST', `/floor/${p.id}`)
                                            }
                                            className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-primary px-3 text-sm font-semibold text-white"
                                        >
                                            <Mic className="size-4" />
                                            {show.question_seconds % 60 === 0
                                                ? tr('Дати слово · {n} хв', {
                                                      n:
                                                          show.question_seconds /
                                                          60,
                                                  })
                                                : tr('Дати слово · {n} с', {
                                                      n: show.question_seconds,
                                                  })}
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        </section>
                    )}

                {isHost && show.status !== 'ended' && (
                    <AddSpeaker
                        onAdd={(username) =>
                            act('POST', '/speakers', { username })
                        }
                    />
                )}

                {state.listeners.length > 0 && (
                    <section className="mt-4">
                        <h2 className="mb-2 text-sm font-semibold text-white/60">
                            {tr('Слухають · {n}', { n: state.listeners_count })}
                        </h2>
                        <div className="flex flex-wrap gap-3">
                            {state.listeners.map((p) => (
                                <div
                                    key={p.id}
                                    className="flex w-16 flex-col items-center"
                                    title={p.name}
                                >
                                    <ShowPerson person={p} size="sm" />
                                    <span className="mt-1 w-full truncate text-center text-[11px] text-white/60">
                                        {p.name}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </section>
                )}
            </div>

            <ControlBar
                state={state}
                inShow={inShow}
                isHost={isHost}
                connecting={
                    voice.status === 'connecting' && voice.kind === 'show'
                }
                micOn={voice.micOn}
                onJoin={async () => {
                    await joinShow({ id: show.id, title: show.title });
                    void refresh();
                }}
                onLeave={() => void leaveVoice().then(refresh)}
                onHand={(raised) => act('POST', '/hand', { raised })}
                onStart={() => act('POST', '/start')}
                onEnd={() => {
                    if (confirm(tr('Завершити шоу для всіх?')))
                        void act('POST', '/end');
                }}
            />
        </>
    );
}

/** Гість з питанням: персонаж і кільце, що спадає до нуля. */
function GuestSeat({
    guest,
    total,
    canStop,
    onStop,
}: {
    guest: Guest;
    total: number;
    canStop: boolean;
    onStop: () => void;
}) {
    const [left, setLeft] = useState(guest.seconds_left);
    useEffect(() => setLeft(guest.seconds_left), [guest.seconds_left]);
    useEffect(() => {
        const id = window.setInterval(
            () => setLeft((s) => Math.max(0, s - 1)),
            1000,
        );

        return () => window.clearInterval(id);
    }, []);
    const r = 52;
    const c = 2 * Math.PI * r;
    const part = total > 0 ? left / total : 0;

    return (
        <div className="flex flex-col items-center">
            <div className="relative grid place-items-center">
                <svg
                    viewBox="0 0 120 120"
                    className="absolute size-[7.5rem] -rotate-90"
                    aria-hidden
                >
                    <circle
                        cx="60"
                        cy="60"
                        r={r}
                        fill="none"
                        stroke="rgb(255 255 255 / 0.08)"
                        strokeWidth="5"
                    />
                    <circle
                        cx="60"
                        cy="60"
                        r={r}
                        fill="none"
                        stroke={left <= 10 ? '#f43f5e' : 'var(--color-primary)'}
                        strokeWidth="5"
                        strokeLinecap="round"
                        strokeDasharray={c}
                        strokeDashoffset={c * (1 - part)}
                        className="transition-[stroke-dashoffset] duration-1000 ease-linear"
                    />
                </svg>
                <ShowPerson person={guest} size="md" className="m-3" />
            </div>
            <span className="mt-1 text-sm font-semibold text-white">
                {guest.name}
            </span>
            <span
                className={cn(
                    'text-xs tabular-nums',
                    left <= 10 ? 'text-rose-400' : 'text-white/55',
                )}
            >
                {tr('Питання · {s}', {
                    s: `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`,
                })}
            </span>
            {canStop && (
                <button
                    type="button"
                    onClick={onStop}
                    className="mt-1 text-xs text-white/50 hover:text-white"
                >
                    {tr('Завершити питання')}
                </button>
            )}
        </div>
    );
}

function AddSpeaker({ onAdd }: { onAdd: (username: string) => void }) {
    const [name, setName] = useState('');
    const submit = (e: FormEvent) => {
        e.preventDefault();
        if (!name.trim()) return;
        onAdd(name.trim());
        setName('');
    };

    return (
        <form
            onSubmit={submit}
            className="gc-solid mt-4 flex flex-wrap gap-2 rounded-2xl p-3"
        >
            <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={tr('@нік співведучого')}
                aria-label={tr('Нік співведучого')}
                className="h-10 min-w-[180px] flex-1"
            />
            <button
                type="submit"
                disabled={!name.trim()}
                className="inline-flex h-10 items-center gap-2 rounded-xl bg-white/[0.07] px-4 text-sm font-semibold text-white disabled:opacity-40"
            >
                <UserPlus className="size-4" />
                {tr('Запросити на сцену')}
            </button>
        </form>
    );
}

function ControlBar({
    state,
    inShow,
    isHost,
    connecting,
    micOn,
    onJoin,
    onLeave,
    onHand,
    onStart,
    onEnd,
}: {
    state: State;
    inShow: boolean;
    isHost: boolean;
    connecting: boolean;
    micOn: boolean;
    onJoin: () => void;
    onLeave: () => void;
    onHand: (raised: boolean) => void;
    onStart: () => void;
    onEnd: () => void;
}) {
    const { show, me } = state;
    const listener = !me || me.role === 'listener';
    const round = 'grid size-12 place-items-center rounded-full transition';

    return (
        <div className="fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+5.5rem)] z-30 flex justify-center px-4 md:bottom-6">
            <div className="flex items-center gap-2 rounded-full bg-[var(--gc-island,var(--card))] p-2 shadow-[var(--gc-float)]">
                {show.status === 'scheduled' && isHost && (
                    <button
                        type="button"
                        onClick={onStart}
                        className="inline-flex h-12 items-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-white"
                    >
                        <Play className="size-4" /> {tr('Почати зараз')}
                    </button>
                )}
                {show.status === 'live' && !inShow && (
                    <button
                        type="button"
                        onClick={onJoin}
                        disabled={connecting}
                        className="inline-flex h-12 items-center gap-2 rounded-full bg-primary px-6 text-sm font-semibold text-white disabled:opacity-60"
                    >
                        <Headphones className="size-4" />
                        {connecting
                            ? tr('Підключення…')
                            : me?.role === 'host'
                              ? tr('Повернутися в ефір')
                              : tr('Слухати')}
                    </button>
                )}
                {show.status === 'live' && inShow && (
                    <>
                        {listener && (
                            <button
                                type="button"
                                onClick={() => onHand(!me?.hand)}
                                aria-pressed={Boolean(me?.hand)}
                                aria-label={
                                    me?.hand
                                        ? tr('Опустити руку')
                                        : tr('Підняти руку')
                                }
                                title={
                                    me?.hand
                                        ? tr('Опустити руку')
                                        : tr('Підняти руку')
                                }
                                className={cn(
                                    round,
                                    me?.hand
                                        ? 'bg-amber-400 text-black'
                                        : 'bg-white/[0.08] text-white hover:bg-white/[0.14]',
                                )}
                            >
                                <Hand className="size-5" />
                            </button>
                        )}
                        {me?.can_speak && (
                            <button
                                type="button"
                                onClick={toggleMic}
                                aria-pressed={micOn}
                                aria-label={
                                    micOn
                                        ? tr('Вимкнути мікрофон')
                                        : tr('Увімкнути мікрофон')
                                }
                                className={cn(
                                    round,
                                    micOn
                                        ? 'bg-primary text-white'
                                        : 'bg-rose-500/90 text-white',
                                )}
                            >
                                {micOn ? (
                                    <Mic className="size-5" />
                                ) : (
                                    <MicOff className="size-5" />
                                )}
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={onLeave}
                            aria-label={tr('Вийти зі шоу')}
                            title={tr('Вийти зі шоу')}
                            className={cn(
                                round,
                                'bg-white/[0.08] text-white hover:bg-white/[0.14]',
                            )}
                        >
                            <LogOut className="size-5" />
                        </button>
                    </>
                )}
                {state.can_manage && show.status !== 'ended' && (
                    <button
                        type="button"
                        onClick={onEnd}
                        className="inline-flex h-12 items-center gap-2 rounded-full bg-rose-500/90 px-4 text-sm font-semibold text-white"
                    >
                        <Radio className="size-4" /> {tr('Завершити')}
                    </button>
                )}
                {show.status === 'ended' && (
                    <Link
                        href="/shows"
                        className="inline-flex h-12 items-center gap-2 rounded-full bg-white/[0.08] px-5 text-sm font-semibold text-white"
                    >
                        {tr('Інші шоу')}
                    </Link>
                )}
            </div>
        </div>
    );
}
