import { Mic, MicOff, MonitorUp, Phone, PhoneOff, Video, VideoOff } from 'lucide-react';
import { type Participant, Room, RoomEvent, Track, type RemoteTrack } from 'livekit-client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useToast } from '@/components/kit';
import { Avatar } from '@/components/ui';
import { api, type User } from '@/lib/api';

export type CallState = { id: number; status: string; started_by: number; caller: User | null; joined?: User[]; invited?: number[] } | null;

const uid = (p: Participant): number => Number(p.identity.replace(/^u/, '')) || 0;

/** Стан дзвінка в бесіді: опитує сервер, щоб показати вхідний дзвінок у відкритому чаті. */
export function useConversationCall(conversationId: number): { call: CallState; refresh: () => Promise<void> } {
    const [call, setCall] = useState<CallState>(null);
    const refresh = useCallback(async () => {
        const r = await api<{ call: CallState }>('GET', `/api/v1/messages/${conversationId}/call`).catch(() => null);
        if (r) setCall(r.call);
    }, [conversationId]);
    useEffect(() => {
        void refresh();
        const t = window.setInterval(() => void refresh(), 4000);
        return () => window.clearInterval(t);
    }, [refresh]);
    return { call, refresh };
}

/**
 * Дзвінок 1:1 чи груповий у бесіді (LiveKit): голос, камера, демонстрація екрана, хто говорить.
 * mode «start» — почати (або приєднатися до вже живого), «join» — прийняти вхідний.
 */
export function DirectCall({
    conversationId,
    callId,
    title,
    peer,
    mode,
    video = false,
    onEnd,
}: {
    conversationId: number;
    callId?: number;
    title: string;
    peer?: User | null;
    mode: 'start' | 'join';
    video?: boolean;
    onEnd: () => void;
}) {
    const toast = useToast();
    const room = useRef<Room | null>(null);
    const media = useRef<HTMLDivElement>(null);
    const [status, setStatus] = useState<'connecting' | 'live'>('connecting');
    const [joinedCall, setJoinedCall] = useState<number | null>(callId ?? null);
    const [mic, setMic] = useState(true);
    const [cam, setCam] = useState(false);
    const [screen, setScreen] = useState(false);
    const [speaking, setSpeaking] = useState<number[]>([]);
    const [others, setOthers] = useState(0);
    const [videos, setVideos] = useState(0);
    const [started, setStarted] = useState<number | null>(null);
    const [, tick] = useState(0);

    useEffect(() => {
        let alive = true;
        const r = new Room({ adaptiveStream: true, dynacast: true });
        room.current = r;
        const count = (): void => setOthers(r.remoteParticipants.size);
        r.on(RoomEvent.ParticipantConnected, () => {
            count();
            setStarted((s) => s ?? Date.now());
        });
        r.on(RoomEvent.ParticipantDisconnected, count);
        r.on(RoomEvent.ActiveSpeakersChanged, (ps: Participant[]) => setSpeaking(ps.map(uid)));
        r.on(RoomEvent.TrackSubscribed, (track: RemoteTrack) => {
            const el = track.attach();
            if (track.kind === Track.Kind.Video) {
                el.className = 'h-full w-full rounded-2xl bg-black object-contain';
                setVideos((v) => v + 1);
            } else el.className = 'hidden';
            media.current?.appendChild(el);
        });
        r.on(RoomEvent.TrackUnsubscribed, (track: RemoteTrack) => {
            track.detach().forEach((el) => el.remove());
            if (track.kind === Track.Kind.Video) setVideos((v) => Math.max(0, v - 1));
        });
        void (async () => {
            try {
                const access =
                    mode === 'join' && callId
                        ? await api<{ url: string; token: string; call: { id: number } }>('POST', `/api/v1/calls/${callId}/join`)
                        : await api<{ url: string; token: string; call: { id: number } }>('POST', `/api/v1/messages/${conversationId}/call`);
                if (!alive) return;
                setJoinedCall(access.call.id);
                await r.connect(access.url, access.token, { autoSubscribe: true });
                await r.localParticipant.setMicrophoneEnabled(true).catch(() => setMic(false));
                if (video)
                    await r.localParticipant.setCameraEnabled(true).then(
                        () => setCam(true),
                        () => undefined,
                    );
                setStatus('live');
                count();
                if (r.remoteParticipants.size > 0) setStarted(Date.now());
            } catch (e) {
                if (alive) {
                    toast((e as Error).message, 'error');
                    onEnd();
                }
            }
        })();
        const t = window.setInterval(() => tick((x) => x + 1), 1000);
        return () => {
            alive = false;
            window.clearInterval(t);
            void r.disconnect();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const hangup = async (): Promise<void> => {
        await room.current?.disconnect();
        if (joinedCall) await api('POST', `/api/v1/calls/${joinedCall}/leave`).catch(() => undefined);
        onEnd();
    };
    const toggle = async (kind: 'mic' | 'cam' | 'screen'): Promise<void> => {
        const lp = room.current?.localParticipant;
        if (!lp) return;
        try {
            if (kind === 'mic') {
                await lp.setMicrophoneEnabled(!mic);
                setMic(!mic);
            } else if (kind === 'cam') {
                await lp.setCameraEnabled(!cam);
                setCam(!cam);
            } else {
                await lp.setScreenShareEnabled(!screen, { audio: true });
                setScreen(!screen);
            }
        } catch (e) {
            toast((e as Error).message, 'error');
        }
    };
    const secs = started ? Math.floor((Date.now() - started) / 1000) : 0;
    const clock = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
    const btn = (on: boolean, danger = false): string =>
        `grid size-12 place-items-center rounded-full transition ${danger ? 'bg-rose-500 hover:bg-rose-400' : on ? 'bg-white/15 hover:bg-white/25' : 'bg-white/5 text-white/50 ring-1 ring-white/15 hover:bg-white/10'}`;
    return (
        <div className="absolute inset-0 z-30 flex flex-col bg-[#0b0e16]/95 backdrop-blur-xl">
            <div className="relative min-h-0 flex-1 p-4">
                <div ref={media} className={`grid h-full gap-3 ${videos > 1 ? 'grid-cols-2' : 'grid-cols-1'} ${videos ? '' : 'hidden'}`} />
                {!videos && (
                    <div className="grid h-full place-items-center text-center">
                        <div>
                            <div className={`mx-auto w-fit rounded-full p-1.5 transition ${peer && speaking.includes(peer.id) ? 'ring-4 ring-emerald-400/70' : 'ring-2 ring-white/10'}`}>
                                <Avatar user={peer ?? { name: title }} size={112} />
                            </div>
                            <p className="mt-4 text-2xl font-bold">{title}</p>
                            <p className="mt-1 text-sm text-white/55">{status === 'connecting' ? 'Підключаємося…' : others === 0 ? 'Дзвонимо…' : clock}</p>
                        </div>
                    </div>
                )}
            </div>
            <div className="flex items-center justify-center gap-3 pb-6">
                <button type="button" title={mic ? 'Вимкнути мікрофон' : 'Увімкнути мікрофон'} onClick={() => void toggle('mic')} className={btn(mic)}>
                    {mic ? <Mic size={20} /> : <MicOff size={20} />}
                </button>
                <button type="button" title={cam ? 'Вимкнути камеру' : 'Увімкнути камеру'} onClick={() => void toggle('cam')} className={btn(cam)}>
                    {cam ? <Video size={20} /> : <VideoOff size={20} />}
                </button>
                <button type="button" title="Показати екран" onClick={() => void toggle('screen')} className={btn(screen)}>
                    <MonitorUp size={20} />
                </button>
                <button type="button" title="Завершити" onClick={() => void hangup()} className={btn(true, true)}>
                    <PhoneOff size={20} />
                </button>
            </div>
        </div>
    );
}

/** Смуга вхідного дзвінка над чатом: «Прийняти» / «Відхилити». */
export function IncomingCall({ call, onAccept, onDecline }: { call: NonNullable<CallState>; onAccept: () => void; onDecline: () => void }) {
    return (
        <div className="flex items-center gap-3 border-b border-emerald-400/20 bg-emerald-400/10 px-4 py-2.5">
            {call.caller && <Avatar user={call.caller} size={32} />}
            <span className="flex-1 text-sm">
                <b>{call.caller?.name ?? 'Хтось'}</b> дзвонить…
            </span>
            <button type="button" onClick={onAccept} className="flex h-9 items-center gap-1.5 rounded-xl bg-emerald-500 px-3 text-sm font-semibold hover:bg-emerald-400">
                <Phone size={15} /> Прийняти
            </button>
            <button type="button" onClick={onDecline} className="flex h-9 items-center gap-1.5 rounded-xl bg-rose-500/80 px-3 text-sm font-semibold hover:bg-rose-500">
                <PhoneOff size={15} /> Відхилити
            </button>
        </div>
    );
}
