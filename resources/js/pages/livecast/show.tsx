import { Head, Link } from '@inertiajs/react';
import {
    ArrowLeft,
    Loader2,
    LogOut,
    MonitorUp,
    Radio,
    Send,
    Users,
    Video,
    VideoOff,
} from 'lucide-react';
import {
    useCallback,
    useEffect,
    useRef,
    useState,
    type FormEvent,
    type ReactNode,
} from 'react';
import { toast } from 'sonner';
import { UserAvatar } from '@/components/gc/user-avatar';
import { Input } from '@/components/ui/input';
import { api, ApiError } from '@/lib/api';
import { tr } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import {
    joinBroadcast,
    leaveVoice,
    toggleCamera,
    toggleMic,
    toggleScreenShare,
    useVoice,
} from '@/lib/voice';
import type { LiveCastCard } from '@/pages/livecast/index';
import type { UserCard } from '@/types';

type ChatMsg = {
    id: number;
    body: string;
    created_at: string | null;
    user: UserCard | null;
};

type State = {
    broadcast: LiveCastCard & { ended_at?: string | null };
    messages: ChatMsg[];
    me: { is_host: boolean; can_publish: boolean } | null;
    can_manage: boolean;
};

/** Сторінка стріму LiveCast: відео, чат, керування ефіром для ведучого. */
export default function LiveCastShow(initial: State) {
    const [state, setState] = useState<State>(initial);
    const [text, setText] = useState('');
    const voice = useVoice();
    const chatEnd = useRef<HTMLDivElement>(null);
    const { broadcast: stream } = state;
    const inStream =
        voice.kind === 'broadcast' &&
        voice.roomId === stream.id &&
        voice.status !== 'idle';
    const isHost = state.me?.is_host === true;

    const refresh = useCallback(async () => {
        try {
            setState(await api<State>('GET', `/livecast/${stream.id}/state`));
        } catch {
            // Мережа — наступне опитування.
        }
    }, [stream.id]);

    useEffect(() => {
        const ms = stream.status === 'live' ? 2500 : 15000;
        const id = window.setInterval(refresh, ms);

        return () => window.clearInterval(id);
    }, [refresh, stream.status]);

    useEffect(() => {
        if (stream.status === 'ended' && inStream) void leaveVoice();
    }, [stream.status, inStream]);

    useEffect(() => {
        chatEnd.current?.scrollIntoView({ behavior: 'smooth' });
    }, [state.messages.length]);

    const connect = async () => {
        try {
            await joinBroadcast({ id: stream.id, title: stream.title });
            if (isHost) {
                toggleCamera();
            }
        } catch (e) {
            toast.error(
                e instanceof ApiError
                    ? e.message
                    : tr('Не вдалося підключитись'),
            );
        }
    };

    const end = async () => {
        try {
            setState(await api<State>('POST', `/livecast/${stream.id}/end`));
            await leaveVoice();
        } catch (e) {
            toast.error(e instanceof ApiError ? e.message : tr('Не вдалося'));
        }
    };

    const send = async (e: FormEvent) => {
        e.preventDefault();
        const body = text.trim();
        if (!body) return;
        setText('');
        try {
            setState(
                await api<State>('POST', `/livecast/${stream.id}/messages`, {
                    body,
                }),
            );
        } catch (err) {
            toast.error(
                err instanceof ApiError ? err.message : tr('Не вдалося'),
            );
            setText(body);
        }
    };

    const primary = voice.videos.find((v) => v.screen) ?? voice.videos[0];

    return (
        <>
            <Head title={`${stream.title} · LiveCast`} />
            <div className="mx-auto grid w-full max-w-6xl gap-3 px-1 py-2 pb-28 lg:grid-cols-[1fr_320px]">
                <div className="min-w-0 space-y-3">
                    <div className="flex items-center gap-2">
                        <Link
                            href="/livecast"
                            aria-label={tr('До LiveCast')}
                            className="grid size-10 place-items-center rounded-xl text-white/70 hover:bg-white/[0.06]"
                        >
                            <ArrowLeft className="size-5" />
                        </Link>
                        {stream.status === 'live' && (
                            <span className="rounded-md bg-rose-500 px-1.5 py-0.5 text-xs font-bold text-white">
                                LIVE
                            </span>
                        )}
                        <span className="inline-flex items-center gap-1 text-sm text-white/55">
                            <Users className="size-4" />
                            {stream.viewers}
                        </span>
                        <span className="ml-auto text-xs font-semibold text-white/40">
                            LiveCast
                        </span>
                    </div>

                    <div className="gc-solid overflow-hidden rounded-3xl">
                        <div className="relative aspect-video bg-black/70">
                            {primary ? (
                                <VideoMount tile={primary} />
                            ) : (
                                <div className="absolute inset-0 grid place-items-center text-white/50">
                                    {inStream ? (
                                        <p className="text-sm">
                                            {isHost
                                                ? tr(
                                                      'Увімкніть камеру або поділіться екраном',
                                                  )
                                                : tr('Очікування відео…')}
                                        </p>
                                    ) : (
                                        <p className="text-sm">
                                            {tr('Підключіться, щоб дивитись')}
                                        </p>
                                    )}
                                </div>
                            )}
                            {voice.videos.length > 1 && (
                                <div className="absolute right-3 bottom-3 flex gap-2">
                                    {voice.videos
                                        .filter((v) => v.id !== primary?.id)
                                        .slice(0, 2)
                                        .map((tile) => (
                                            <div
                                                key={tile.id}
                                                className="h-24 w-36 overflow-hidden rounded-xl border border-white/15"
                                            >
                                                <VideoMount tile={tile} />
                                            </div>
                                        ))}
                                </div>
                            )}
                        </div>
                        <div className="space-y-3 p-4 sm:p-5">
                            <h1 className="font-display text-xl font-bold text-white sm:text-2xl">
                                {stream.title}
                            </h1>
                            <div className="flex flex-wrap items-center gap-3">
                                {stream.host && (
                                    <Link
                                        href={`/${stream.host.username}`}
                                        className="inline-flex items-center gap-2 text-sm font-semibold text-white hover:underline"
                                    >
                                        <UserAvatar
                                            user={stream.host}
                                            size="sm"
                                        />
                                        {stream.host.name}
                                    </Link>
                                )}
                                {stream.category && (
                                    <span className="rounded-full bg-white/[0.06] px-2.5 py-1 text-xs text-white/60">
                                        {stream.category}
                                    </span>
                                )}
                            </div>

                            <div className="flex flex-wrap gap-2">
                                {!inStream && stream.status === 'live' && (
                                    <button
                                        type="button"
                                        onClick={() => void connect()}
                                        className="inline-flex h-10 items-center gap-2 rounded-xl bg-rose-500 px-4 text-sm font-bold text-white"
                                    >
                                        {voice.status === 'connecting' ? (
                                            <Loader2 className="size-4 animate-spin" />
                                        ) : (
                                            <Radio className="size-4" />
                                        )}
                                        {isHost
                                            ? tr('Вийти в ефір')
                                            : tr('Дивитись')}
                                    </button>
                                )}
                                {inStream && isHost && (
                                    <>
                                        <Ctrl
                                            onClick={toggleMic}
                                            active={voice.micOn}
                                            label={
                                                voice.micOn
                                                    ? tr('Мікрофон')
                                                    : tr('Мікрофон вимк.')
                                            }
                                        />
                                        <Ctrl
                                            onClick={toggleCamera}
                                            active={voice.cameraOn}
                                            label={
                                                voice.cameraOn
                                                    ? tr('Камера')
                                                    : tr('Камера вимк.')
                                            }
                                            icon={
                                                voice.cameraOn ? (
                                                    <Video className="size-4" />
                                                ) : (
                                                    <VideoOff className="size-4" />
                                                )
                                            }
                                        />
                                        <Ctrl
                                            onClick={toggleScreenShare}
                                            active={voice.screenShareOn}
                                            label={tr('Екран')}
                                            icon={
                                                <MonitorUp className="size-4" />
                                            }
                                        />
                                        <button
                                            type="button"
                                            onClick={() => void end()}
                                            className="inline-flex h-10 items-center gap-2 rounded-xl bg-rose-600 px-4 text-sm font-bold text-white"
                                        >
                                            <LogOut className="size-4" />
                                            {tr('Завершити')}
                                        </button>
                                    </>
                                )}
                                {inStream && !isHost && (
                                    <button
                                        type="button"
                                        onClick={() => void leaveVoice()}
                                        className="inline-flex h-10 items-center gap-2 rounded-xl bg-white/[0.08] px-4 text-sm font-semibold text-white"
                                    >
                                        <LogOut className="size-4" />
                                        {tr('Вийти')}
                                    </button>
                                )}
                            </div>
                            {stream.status === 'ended' && (
                                <p className="text-sm text-white/55">
                                    {tr('Стрім завершено · пік глядачів: {n}', {
                                        n: stream.peak_viewers,
                                    })}
                                </p>
                            )}
                        </div>
                    </div>
                </div>

                <aside className="gc-solid flex h-[min(70vh,640px)] flex-col rounded-3xl p-3">
                    <p className="mb-2 px-1 text-xs font-semibold tracking-wide text-white/45 uppercase">
                        {tr('Чат стріму')}
                    </p>
                    <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-1">
                        {state.messages.length === 0 && (
                            <p className="py-6 text-center text-sm text-white/40">
                                {tr('Поки тихо — напишіть першим')}
                            </p>
                        )}
                        {state.messages.map((m) => (
                            <div key={m.id} className="flex gap-2 text-sm">
                                {m.user ? (
                                    <UserAvatar
                                        user={m.user}
                                        size="xs"
                                        className="mt-0.5 shrink-0"
                                    />
                                ) : (
                                    <div className="mt-0.5 size-7 shrink-0 rounded-full bg-white/10" />
                                )}
                                <div className="min-w-0">
                                    <span className="font-semibold text-white/80">
                                        {m.user?.name ?? '…'}
                                    </span>{' '}
                                    <span className="break-words text-white/70">
                                        {m.body}
                                    </span>
                                </div>
                            </div>
                        ))}
                        <div ref={chatEnd} />
                    </div>
                    {stream.status === 'live' && (
                        <form
                            onSubmit={send}
                            className="mt-2 flex gap-2 border-t border-white/10 pt-2"
                        >
                            <Input
                                value={text}
                                onChange={(e) => setText(e.target.value)}
                                maxLength={280}
                                placeholder={tr('Повідомлення…')}
                                className="flex-1"
                            />
                            <button
                                type="submit"
                                aria-label={tr('Надіслати')}
                                className="grid size-10 place-items-center rounded-xl bg-white/[0.08] text-white hover:bg-white/15"
                            >
                                <Send className="size-4" />
                            </button>
                        </form>
                    )}
                </aside>
            </div>
        </>
    );
}

function Ctrl({
    onClick,
    active,
    label,
    icon,
}: {
    onClick: () => void;
    active: boolean;
    label: string;
    icon?: ReactNode;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={cn(
                'inline-flex h-10 items-center gap-2 rounded-xl px-3 text-sm font-semibold',
                active
                    ? 'bg-white/[0.08] text-white'
                    : 'bg-rose-500/15 text-rose-200',
            )}
        >
            {icon}
            {label}
        </button>
    );
}

function VideoMount({
    tile,
}: {
    tile: {
        id: string;
        el: HTMLVideoElement;
        local: boolean;
        screen: boolean;
        name: string;
    };
}) {
    const host = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const node = host.current;
        if (!node) return;
        node.replaceChildren(tile.el);
        void tile.el.play().catch(() => undefined);

        return () => {
            if (tile.el.parentElement === node) node.removeChild(tile.el);
        };
    }, [tile.el, tile.id]);

    return (
        <div className="relative h-full w-full">
            <div
                ref={host}
                className="absolute inset-0 [&>video]:h-full [&>video]:w-full [&>video]:object-contain"
            />
        </div>
    );
}
