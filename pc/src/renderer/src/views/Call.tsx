import { Hand, Headphones, HeadphoneOff, Mic, MicOff, Minus, PhoneOff, Settings2 } from 'lucide-react';
import { type Participant, type RemoteTrack, Room, RoomEvent, Track } from 'livekit-client';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { CallRoom } from '../../../preload';
import { Avatar, Empty, IconButton } from '@/components/ui';
import { api, type User } from '@/lib/api';
import { useMe } from '@/lib/me';

type Person = User & { muted?: boolean; hand?: boolean; speaker?: boolean; manager?: boolean };
type RoomState = { id: number; name: string; stage: boolean; participants: Person[] };

const userId = (p: Participant): number => Number(p.identity.replace(/^u/, '')) || 0;

/**
 * Вікно голосової кімнати (LiveKit): хто в кімнаті й хто говорить, мікрофон (Ctrl+Shift+M — і з гри),
 * вимкнути звук, підняти руку на сцені, вибір мікрофона, вийти. Вікно завжди поверх і живе окремо
 * від режимів — дзвінок не рветься, коли людина перемикає єдине вікно й віджети.
 */
export function CallView() {
    const { me } = useMe();
    const [target, setTarget] = useState<CallRoom | null>(null);
    const [status, setStatus] = useState<'idle' | 'connecting' | 'live' | 'error'>('idle');
    const [error, setError] = useState<string | null>(null);
    const [muted, setMuted] = useState(false);
    const [deafened, setDeafened] = useState(false);
    const [speaking, setSpeaking] = useState<number[]>([]);
    const [state, setState] = useState<RoomState | null>(null);
    const [mics, setMics] = useState<MediaDeviceInfo[]>([]);
    const [showMics, setShowMics] = useState(false);
    const room = useRef<Room | null>(null);
    const audio = useRef<HTMLDivElement>(null);
    const deafRef = useRef(false);

    // Кімната: при відкритті вікна й коли модуль просить перейти в іншу.
    useEffect(() => {
        void window.gamecon.call.room().then((r) => r && setTarget(r));
        return window.gamecon.call.onRoom(setTarget);
    }, []);

    const loadState = useCallback(async (r: CallRoom) => {
        try {
            const s = await api<{ rooms: RoomState[] }>('GET', `/api/v1/voice/${r.owner.type}/${r.owner.id}`);
            setState(s.rooms.find((x) => x.id === r.id) ?? null);
        } catch {
            // Тимчасово без мережі — список оновиться наступного разу.
        }
    }, []);

    const leave = useCallback(async (close: boolean) => {
        await room.current?.disconnect();
        room.current = null;
        setStatus('idle');
        window.gamecon.call.publish(null);
        await window.gamecon.call.left();
        if (close) void window.gamecon.window.close();
    }, []);

    // Підключення до LiveKit.
    useEffect(() => {
        if (!target) return;
        let cancelled = false;
        const connect = async (): Promise<void> => {
            await room.current?.disconnect();
            setStatus('connecting');
            setError(null);
            try {
                const join = await api<{ url: string; token: string }>('POST', `/api/v1/voice/rooms/${target.id}/join`);
                const lk = new Room({ adaptiveStream: true, dynacast: true, audioCaptureDefaults: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
                lk.on(RoomEvent.TrackSubscribed, (track: RemoteTrack) => {
                    if (track.kind !== Track.Kind.Audio) return;
                    const el = track.attach();
                    el.muted = deafRef.current;
                    audio.current?.appendChild(el);
                });
                lk.on(RoomEvent.TrackUnsubscribed, (track: RemoteTrack) => track.detach().forEach((el) => el.remove()));
                lk.on(RoomEvent.ActiveSpeakersChanged, (who: Participant[]) => setSpeaking(who.map(userId)));
                lk.on(RoomEvent.ParticipantConnected, () => void loadState(target));
                lk.on(RoomEvent.ParticipantDisconnected, () => void loadState(target));
                lk.on(RoomEvent.Disconnected, () => !cancelled && setStatus('idle'));
                await lk.connect(join.url, join.token);
                if (cancelled) return void lk.disconnect();
                room.current = lk;
                // На сцені слухач не говорить, доки його не зроблять спікером.
                try {
                    await lk.localParticipant.setMicrophoneEnabled(true);
                    setMuted(false);
                } catch {
                    setMuted(true);
                }
                setStatus('live');
                setMics((await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'audioinput'));
                void loadState(target);
            } catch (e) {
                if (!cancelled) {
                    setStatus('error');
                    setError((e as Error).message || 'Не вдалося підключитися до кімнати.');
                }
            }
        };
        void connect();
        const timer = window.setInterval(() => void loadState(target), 8000);
        return () => {
            cancelled = true;
            window.clearInterval(timer);
        };
    }, [target, loadState]);

    useEffect(() => () => void room.current?.disconnect(), []);

    const toggleMute = useCallback(async () => {
        const lk = room.current;
        if (!lk) return;
        const next = !muted;
        try {
            await lk.localParticipant.setMicrophoneEnabled(!next);
            setMuted(next);
        } catch (e) {
            setError((e as Error).message);
        }
    }, [muted]);

    const toggleDeafen = (): void => {
        const next = !deafened;
        deafRef.current = next;
        audio.current?.querySelectorAll('audio').forEach((el) => (el.muted = next));
        setDeafened(next);
        if (next && !muted) void toggleMute();
    };

    useEffect(() => window.gamecon.call.onToggleMute(() => void toggleMute()), [toggleMute]);

    // Стан дзвінка — модулю й іншим вікнам.
    useEffect(() => {
        if (target && status === 'live') window.gamecon.call.publish({ room: target, muted, deafened, speaking, count: state?.participants.length ?? 1 });
    }, [target, status, muted, deafened, speaking, state]);

    // Модератор вимкнув мікрофон — вимикаємо й тут.
    const mine = state?.participants.find((p) => p.id === me?.id);
    useEffect(() => {
        if (mine?.muted && !muted) void toggleMute();
    }, [mine?.muted, muted, toggleMute]);

    const hand = async (): Promise<void> => {
        if (!target) return;
        await api('POST', `/api/v1/voice/rooms/${target.id}/hand`, { raised: !mine?.hand }).catch((e: Error) => setError(e.message));
        void loadState(target);
    };

    const people = state?.participants ?? [];
    return (
        <div className="flex h-full flex-col overflow-hidden rounded-[22px] bg-obsidian-solid/90 ring-1 ring-white/10 backdrop-blur-2xl">
            <header className="drag flex h-12 shrink-0 items-center gap-2 pr-1 pl-4">
                <span className={`h-2 w-2 rounded-full ${status === 'live' ? 'bg-emerald-400 shadow-[0_0_8px_#34d399]' : status === 'connecting' ? 'animate-pulse bg-amber-300' : 'bg-white/30'}`} />
                <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">{target?.name ?? 'Голосова кімната'}</div>
                    <div className="truncate text-[11px] text-white/45">{target ? `${target.owner.title}${state?.stage ? ' · сцена' : ''}` : 'Оберіть кімнату в модулі «Голосові кімнати»'}</div>
                </div>
                <IconButton label="Згорнути" onClick={() => void window.gamecon.window.minimize()}>
                    <Minus size={14} />
                </IconButton>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto px-3">
                {status === 'connecting' && <Empty>Підключаємося…</Empty>}
                {status === 'error' && <Empty>{error}</Empty>}
                {status === 'live' && people.length === 0 && <Empty>У кімнаті поки тільки ви.</Empty>}
                <ul className="grid grid-cols-3 gap-2 py-2">
                    {people.map((p) => {
                        const talking = speaking.includes(p.id);
                        return (
                            <li key={p.id} className="flex flex-col items-center gap-1.5 rounded-xl bg-white/[0.03] px-1 py-2.5">
                                <span className={`rounded-full p-0.5 transition ${talking ? 'shadow-[0_0_0_2px_#22d3ee,0_0_16px_rgba(34,211,238,0.6)]' : ''}`}>
                                    <Avatar user={p} size={44} />
                                </span>
                                <span className="flex max-w-full items-center gap-1 truncate text-xs">
                                    {p.muted && <MicOff size={11} className="shrink-0 text-rose-300" />}
                                    {p.hand && <Hand size={11} className="shrink-0 text-amber-300" />}
                                    <span className="truncate">{p.first_name ?? p.name}</span>
                                </span>
                            </li>
                        );
                    })}
                </ul>
            </div>

            {showMics && (
                <div className="mx-3 mb-2 rounded-xl bg-white/[0.04] p-2 ring-1 ring-white/10">
                    {mics.map((d) => (
                        <button
                            key={d.deviceId}
                            type="button"
                            onClick={() => {
                                void room.current?.switchActiveDevice('audioinput', d.deviceId);
                                setShowMics(false);
                            }}
                            className="block w-full truncate rounded-lg px-2 py-1.5 text-left text-xs text-white/75 hover:bg-white/5"
                        >
                            {d.label || 'Мікрофон'}
                        </button>
                    ))}
                </div>
            )}
            {error && status === 'live' && <p className="mx-3 mb-1 truncate text-[11px] text-rose-300">{error}</p>}

            <footer className="flex shrink-0 items-center justify-center gap-2 border-t border-white/5 px-3 py-3">
                <CallButton label={muted ? 'Увімкнути мікрофон (Ctrl+Shift+M)' : 'Вимкнути мікрофон (Ctrl+Shift+M)'} danger={muted} onClick={() => void toggleMute()}>
                    {muted ? <MicOff size={18} /> : <Mic size={18} />}
                </CallButton>
                <CallButton label={deafened ? 'Увімкнути звук' : 'Вимкнути звук'} danger={deafened} onClick={toggleDeafen}>
                    {deafened ? <HeadphoneOff size={18} /> : <Headphones size={18} />}
                </CallButton>
                {state?.stage && (
                    <CallButton label={mine?.hand ? 'Опустити руку' : 'Підняти руку'} active={!!mine?.hand} onClick={() => void hand()}>
                        <Hand size={18} />
                    </CallButton>
                )}
                <CallButton label="Мікрофон" onClick={() => setShowMics((v) => !v)}>
                    <Settings2 size={18} />
                </CallButton>
                <button type="button" onClick={() => void leave(true)} aria-label="Вийти" title="Вийти" className="grid h-11 w-14 place-items-center rounded-full bg-rose-500/85 hover:bg-rose-500">
                    <PhoneOff size={18} />
                </button>
            </footer>
            <div ref={audio} className="hidden" />
        </div>
    );
}

function CallButton({ label, onClick, children, danger, active }: { label: string; onClick: () => void; children: React.ReactNode; danger?: boolean; active?: boolean }) {
    return (
        <button
            type="button"
            aria-label={label}
            title={label}
            onClick={onClick}
            className={`grid h-11 w-11 place-items-center rounded-full ring-1 transition ${danger ? 'bg-rose-500/20 text-rose-200 ring-rose-400/50' : active ? 'bg-amber-400/20 text-amber-200 ring-amber-300/50' : 'bg-white/[0.06] text-white/80 ring-white/10 hover:bg-white/10'}`}
        >
            {children}
        </button>
    );
}
