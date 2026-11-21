import type { Room, RoomOptions } from 'livekit-client';
import { useSyncExternalStore } from 'react';
import { toast } from 'sonner';
import { api, ApiError } from '@/lib/api';
import { createVoiceMeter, newAudioContext } from '@/lib/character';
import type { VoiceReading } from '@/lib/character';
import { tr } from '@/lib/i18n';

/**
 * Голос GameCon: кімнати сімей і спільнот та дзвінки в бесідах. Одне з’єднання LiveKit на весь сайт,
 * поза React-деревом — розмова не обривається під час переходів між сторінками (як музичний плеєр).
 */

export type VoiceOwner = {
    type: 'family' | 'community' | 'clan' | 'server' | 'party';
    id: number;
};

export type CallState = {
    id: number;
    conversation_id: number;
    status: 'ringing' | 'active' | 'ended';
    started_by: number | null;
    caller: { id: number; name: string; avatar_url: string | null } | null;
    started_at: string;
    answered_at: string | null;
    joined: { id: number; name: string; avatar_url: string | null }[];
    invited: number[];
};

export type VoiceVideoTile = {
    id: string;
    identity: string;
    name: string;
    screen: boolean;
    local: boolean;
    /** HTMLVideoElement, уже прив’язаний до трека LiveKit. */
    el: HTMLVideoElement;
};

export type VoiceState = {
    status: 'idle' | 'connecting' | 'connected';
    kind: 'room' | 'call' | 'show' | 'broadcast' | null;
    /** Голосова кімната / шоу / LiveCast. */
    roomId: number | null;
    /** Дзвінок і його бесіда (kind = call). */
    callId: number | null;
    conversationId: number | null;
    roomName: string;
    /** Назва сім’ї, спільноти чи бесіди й посилання на неї — для панелі розмови. */
    label: string;
    href: string;
    owner: VoiceOwner | null;
    identity: string | null;
    micOn: boolean;
    /** Модератор забрав мікрофон. */
    micBlocked: boolean;
    cameraOn: boolean;
    screenShareOn: boolean;
    deafened: boolean;
    speaking: string[];
    videos: VoiceVideoTile[];
    connectedAt: number | null;
};

const initial: VoiceState = {
    status: 'idle',
    kind: null,
    roomId: null,
    callId: null,
    conversationId: null,
    roomName: '',
    label: '',
    href: '',
    owner: null,
    identity: null,
    micOn: false,
    micBlocked: false,
    cameraOn: false,
    screenShareOn: false,
    deafened: false,
    speaking: [],
    videos: [],
    connectedAt: null,
};

let state = initial;
const listeners = new Set<() => void>();
let room: Room | null = null;
const audio = new Set<HTMLMediaElement>();
const videoEls = new Map<string, HTMLVideoElement>();
/** Гучність і тембр кожного, хто говорить (identity → вимірювач), — для персонажів у шоу. */
const meters = new Map<string, ReturnType<typeof createVoiceMeter>>();
let meterCtx: AudioContext | null = null;

function meterFor(identity: string, track: MediaStreamTrack) {
    try {
        meterCtx ??= newAudioContext();
        meters.get(identity)?.stop();
        meters.set(
            identity,
            createVoiceMeter(new MediaStream([track]), meterCtx),
        );
    } catch {
        // Без Web Audio персонажі просто не рухають ротом.
    }
}

function dropMeter(identity: string) {
    meters.get(identity)?.stop();
    meters.delete(identity);
}

/** Гучність і тембр людини в розмові (null — мовчить або не в розмові). */
export function voiceLevel(identity: string): VoiceReading | null {
    return meters.get(identity)?.read() ?? null;
}

function set(patch: Partial<VoiceState>) {
    state = { ...state, ...patch };
    listeners.forEach((l) => l());
}

export function useVoice(): VoiceState {
    return useSyncExternalStore(
        (l) => {
            listeners.add(l);

            return () => listeners.delete(l);
        },
        () => state,
        () => initial,
    );
}

export function voiceState(): VoiceState {
    return state;
}

function publishVideos() {
    set({
        videos: [...videoEls.entries()].map(([id, el]) => {
            const meta = (
                el.dataset.meta ? JSON.parse(el.dataset.meta) : {}
            ) as {
                identity?: string;
                name?: string;
                screen?: boolean;
                local?: boolean;
            };

            return {
                id,
                identity: meta.identity ?? id,
                name: meta.name ?? id,
                screen: Boolean(meta.screen),
                local: Boolean(meta.local),
                el,
            };
        }),
    });
}

function attachVideo(
    id: string,
    track: { attach: (el?: HTMLMediaElement) => HTMLMediaElement },
    meta: { identity: string; name: string; screen: boolean; local: boolean },
) {
    const prev = videoEls.get(id);
    if (prev) {
        track.attach(prev);
        prev.dataset.meta = JSON.stringify(meta);
        publishVideos();

        return;
    }
    const el = track.attach() as HTMLVideoElement;
    el.playsInline = true;
    el.muted = meta.local;
    el.autoplay = true;
    el.className = 'h-full w-full object-cover';
    el.dataset.meta = JSON.stringify(meta);
    videoEls.set(id, el);
    publishVideos();
}

function detachVideo(
    id: string,
    track?: { detach: (el?: HTMLMediaElement) => HTMLMediaElement[] },
) {
    const el = videoEls.get(id);
    if (!el) return;
    if (track) track.detach(el);
    else el.remove();
    videoEls.delete(id);
    publishVideos();
}

function cleanup() {
    audio.forEach((el) => el.remove());
    audio.clear();
    videoEls.forEach((el) => el.remove());
    videoEls.clear();
    meters.forEach((m) => m.stop());
    meters.clear();
    room = null;
    set({ ...initial, deafened: state.deafened });
}

type Access = {
    url: string;
    token: string;
    identity: string;
    call?: CallState;
};

/**
 * Якість звуку: Opus 96 кбіт/с, RED (надлишкові пакети — без «булькання» при втратах),
 * DTX (тиша не передається), шумо- й ехоподавлення, ізоляція голосу там, де браузер уміє.
 */
async function roomOptions(): Promise<RoomOptions> {
    const { AudioPresets } = await import('livekit-client');

    return {
        adaptiveStream: true,
        dynacast: true,
        audioCaptureDefaults: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            voiceIsolation: true,
        },
        publishDefaults: {
            audioPreset: AudioPresets.musicHighQuality,
            dtx: true,
            red: true,
        },
    };
}

/** Сервер LiveKit не відповів і з другої спроби (доступ сайт видав — справа в сервері голосу). */
class VoiceServerDown extends Error {}

async function connect(
    fetchAccess: () => Promise<Access>,
    meta: Partial<VoiceState>,
    failure: string,
) {
    if (room) await leaveVoice();
    set({ ...meta, status: 'connecting' });

    try {
        const [lk, access, options] = await Promise.all([
            import('livekit-client'),
            fetchAccess(),
            roomOptions(),
        ]);
        const { DisconnectReason, Room, RoomEvent, Track } = lk;
        const next = new Room(options);
        room = next;
        if (access.call) set({ callId: access.call.id });

        next.on(RoomEvent.TrackSubscribed, (track, pub, participant) => {
            if (track.kind === Track.Kind.Audio) {
                meterFor(participant.identity, track.mediaStreamTrack);
                const el = track.attach();
                el.muted = state.deafened;
                el.style.display = 'none';
                document.body.appendChild(el);
                audio.add(el);

                return;
            }
            if (track.kind !== Track.Kind.Video) return;
            attachVideo(pub.trackSid, track, {
                identity: participant.identity,
                name: participant.name || participant.identity,
                screen: pub.source === Track.Source.ScreenShare,
                local: false,
            });
        });
        next.on(RoomEvent.TrackUnsubscribed, (track, pub, participant) => {
            if (track.kind === Track.Kind.Audio) {
                dropMeter(participant.identity);
                track.detach().forEach((el) => {
                    audio.delete(el);
                    el.remove();
                });

                return;
            }
            if (track.kind === Track.Kind.Video)
                detachVideo(pub.trackSid, track);
        });
        next.on(RoomEvent.LocalTrackPublished, (pub, participant) => {
            const track = pub.track;
            if (!track || track.kind !== Track.Kind.Video) return;
            attachVideo(pub.trackSid, track, {
                identity: participant.identity,
                name: participant.name || tr('Ви'),
                screen: pub.source === Track.Source.ScreenShare,
                local: true,
            });
        });
        next.on(RoomEvent.LocalTrackUnpublished, (pub) => {
            if (pub.track?.kind === Track.Kind.Video)
                detachVideo(pub.trackSid, pub.track);
        });
        next.on(RoomEvent.ActiveSpeakersChanged, (speakers) =>
            set({ speaking: speakers.map((p) => p.identity) }),
        );
        next.on(RoomEvent.ParticipantPermissionsChanged, (_prev, p) => {
            if (p !== next.localParticipant) return;
            const blocked = p.permissions?.canPublish === false;
            const wasBlocked = state.micBlocked;
            set({ micBlocked: blocked, micOn: blocked ? false : state.micOn });
            if (state.kind === 'show') {
                // Шоу: ведучий дав слово — мікрофон вмикається сам; час вийшов — вимикається.
                if (blocked && !wasBlocked) {
                    dropMeter(p.identity);
                    toast(tr('Мікрофон вимкнено — ви знову слухаєте'));
                }
                if (!blocked && wasBlocked) {
                    toast.success(tr('Вам дали слово — говоріть'));
                    void setMic(true);
                }

                return;
            }
            if (blocked) toast(tr('Модератор вимкнув вам мікрофон'));
        });
        next.on(RoomEvent.Disconnected, (reason) => {
            if (room !== next) return;
            if (reason === DisconnectReason.PARTICIPANT_REMOVED)
                toast(tr('Вас виключили з голосової кімнати'));
            cleanup();
        });

        // Мобільна мережа чи перезапуск сервера голосу: одна повторна спроба, перш ніж здатися.
        try {
            await next.connect(access.url, access.token);
        } catch (first) {
            if (room !== next) throw first;
            await new Promise((resolve) => setTimeout(resolve, 1500));
            if (room !== next) throw first;
            try {
                await next.connect(access.url, access.token);
            } catch (second) {
                console.error('voice: connect failed', access.url, second);
                throw new VoiceServerDown();
            }
        }
        if (room !== next) {
            await next.disconnect();

            return;
        }

        const blocked = next.localParticipant.permissions?.canPublish === false;
        set({
            status: 'connected',
            identity: access.identity,
            micBlocked: blocked,
            connectedAt: Date.now(),
        });
        if (!blocked) await setMic(true);
    } catch (e) {
        await room?.disconnect().catch(() => undefined);
        cleanup();
        toast.error(
            e instanceof ApiError
                ? e.message
                : e instanceof VoiceServerDown
                  ? `${failure}: ${tr('сервер голосу не відповідає. Спробуйте за хвилину')}`
                  : failure,
        );
    }
}

export async function joinVoice(
    target: { id: number; name: string },
    owner: VoiceOwner,
    label: string,
    href: string,
) {
    if (
        state.kind === 'room' &&
        state.roomId === target.id &&
        state.status !== 'idle'
    )
        return;

    await connect(
        () => api<Access>('POST', `/voice/rooms/${target.id}/join`),
        {
            kind: 'room',
            roomId: target.id,
            roomName: target.name,
            label,
            href,
            owner,
        },
        tr('Не вдалося підключитися до голосової кімнати'),
    );
}

/** Голос під час спільного перегляду фільму. */
export async function joinWatchVoice(code: string, title: string) {
    await connect(
        () => api<Access>('POST', `/watch/${code}/voice`),
        {
            kind: 'room',
            roomId: null,
            roomName: title,
            label: tr('Спільний перегляд'),
            href: `/watch/${code}`,
        },
        tr('Не вдалося підключити голос'),
    );
}

/** Подзвонити в бесіду або приєднатися до дзвінка, що вже триває. */
export async function startCall(conversation: { id: number; title: string }) {
    if (
        state.kind === 'call' &&
        state.conversationId === conversation.id &&
        state.status !== 'idle'
    )
        return;

    await connect(
        () => api<Access>('POST', `/messages/${conversation.id}/call`),
        {
            kind: 'call',
            conversationId: conversation.id,
            roomName: conversation.title,
            label: tr('Дзвінок'),
            href: `/messages/${conversation.id}`,
        },
        tr('Не вдалося зателефонувати'),
    );
}

/** Відповісти на вхідний дзвінок. */
export async function answerCall(call: CallState, title: string) {
    await connect(
        () => api<Access>('POST', `/calls/${call.id}/join`),
        {
            kind: 'call',
            callId: call.id,
            conversationId: call.conversation_id,
            roomName: title,
            label: tr('Дзвінок'),
            href: `/messages/${call.conversation_id}`,
        },
        tr('Не вдалося відповісти на дзвінок'),
    );
}

export function declineCall(call: CallState) {
    void api('POST', `/calls/${call.id}/decline`).catch(() => undefined);
}

/** Шоу наживо: ведучі й гість говорять, решта слухає. */
export async function joinShow(show: { id: number; title: string }) {
    if (
        state.kind === 'show' &&
        state.roomId === show.id &&
        state.status !== 'idle'
    )
        return;

    await connect(
        () => api<Access>('POST', `/shows/${show.id}/join`),
        {
            kind: 'show',
            roomId: show.id,
            roomName: show.title,
            label: tr('Шоу'),
            href: `/shows/${show.id}`,
            owner: null,
        },
        tr('Не вдалося підключитися до шоу'),
    );
}

/** LiveCast: нативний відеострім (ведучий публікує, глядачі дивляться). */
export async function joinBroadcast(stream: { id: number; title: string }) {
    if (
        state.kind === 'broadcast' &&
        state.roomId === stream.id &&
        state.status !== 'idle'
    )
        return;

    await connect(
        () => api<Access>('POST', `/livecast/${stream.id}/join`),
        {
            kind: 'broadcast',
            roomId: stream.id,
            roomName: stream.title,
            label: 'LiveCast',
            href: `/livecast/${stream.id}`,
            owner: null,
        },
        tr('Не вдалося підключитися до LiveCast'),
    );
}

export async function leaveVoice() {
    const current = room;
    const callId = state.kind === 'call' ? state.callId : null;
    const showId = state.kind === 'show' ? state.roomId : null;
    const broadcastId = state.kind === 'broadcast' ? state.roomId : null;
    room = null;
    await current?.disconnect().catch(() => undefined);
    cleanup();
    // Сервер дізнається й з вебхука, але так співрозмовник побачить кінець дзвінка одразу.
    if (callId)
        void api('POST', `/calls/${callId}/leave`).catch(() => undefined);
    if (showId)
        void api('POST', `/shows/${showId}/leave`).catch(() => undefined);
    if (broadcastId)
        void api('POST', `/livecast/${broadcastId}/leave`).catch(
            () => undefined,
        );
}

/** Камера й демонстрація екрана: дзвінки, LiveCast і голосові кімнати (№235). */
function canPublishVideo(): boolean {
    return (
        state.kind === 'call' ||
        state.kind === 'broadcast' ||
        state.kind === 'room'
    );
}

function canShareScreen(): boolean {
    return canPublishVideo();
}

async function setMic(on: boolean) {
    if (!room) return;
    try {
        const pub = await room.localParticipant.setMicrophoneEnabled(on);
        set({ micOn: on });
        const identity = room.localParticipant.identity;
        const track = pub?.track?.mediaStreamTrack;
        if (on && track) meterFor(identity, track);
        else dropMeter(identity);
    } catch {
        set({ micOn: false });
        toast.error(
            tr('Немає доступу до мікрофона — дозвольте його в браузері'),
        );
    }
}

export function toggleMic() {
    if (state.micBlocked) {
        toast(tr('Модератор вимкнув вам мікрофон'));

        return;
    }
    void setMic(!state.micOn);
}

export function toggleDeafen() {
    const deafened = !state.deafened;
    audio.forEach((el) => (el.muted = deafened));
    set({ deafened });
}

async function setCamera(on: boolean) {
    if (!room || !canPublishVideo()) return;
    try {
        await room.localParticipant.setCameraEnabled(on);
        set({ cameraOn: on });
    } catch {
        set({ cameraOn: false });
        toast.error(tr('Немає доступу до камери — дозвольте її в браузері'));
    }
}

export function toggleCamera() {
    if (state.micBlocked) {
        toast(tr('Модератор вимкнув вам мікрофон'));

        return;
    }
    if (!canPublishVideo()) {
        toast(tr('Відео доступне в дзвінках, кімнатах і LiveCast'));

        return;
    }
    void setCamera(!state.cameraOn);
}

async function setScreenShare(on: boolean) {
    if (!room || !canShareScreen()) return;
    try {
        await room.localParticipant.setScreenShareEnabled(on, {
            audio: true,
        });
        set({ screenShareOn: on });
    } catch {
        set({ screenShareOn: false });
        if (on) toast.error(tr('Не вдалося поділитися екраном'));
    }
}

export function toggleScreenShare() {
    if (state.micBlocked) {
        toast(tr('Немає права публікувати відео'));

        return;
    }
    if (!canShareScreen()) {
        toast(
            tr('Демонстрація екрана доступна в дзвінках, кімнатах і LiveCast'),
        );

        return;
    }
    void setScreenShare(!state.screenShareOn);
}
