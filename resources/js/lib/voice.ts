import type { Room, RoomOptions } from 'livekit-client';
import { useSyncExternalStore } from 'react';
import { toast } from 'sonner';
import { api, ApiError } from '@/lib/api';

/**
 * Голос GameCon: кімнати сімей і спільнот та дзвінки в бесідах. Одне з’єднання LiveKit на весь сайт,
 * поза React-деревом — розмова не обривається під час переходів між сторінками (як музичний плеєр).
 */

export type VoiceOwner = { type: 'family' | 'community' | 'clan'; id: number };

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

export type VoiceState = {
    status: 'idle' | 'connecting' | 'connected';
    kind: 'room' | 'call' | null;
    /** Голосова кімната (kind = room). */
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
    deafened: boolean;
    speaking: string[];
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
    deafened: false,
    speaking: [],
    connectedAt: null,
};

let state = initial;
const listeners = new Set<() => void>();
let room: Room | null = null;
const audio = new Set<HTMLMediaElement>();

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

function cleanup() {
    audio.forEach((el) => el.remove());
    audio.clear();
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

        next.on(RoomEvent.TrackSubscribed, (track) => {
            if (track.kind !== Track.Kind.Audio) return;
            const el = track.attach();
            el.muted = state.deafened;
            el.style.display = 'none';
            document.body.appendChild(el);
            audio.add(el);
        });
        next.on(RoomEvent.TrackUnsubscribed, (track) => {
            track.detach().forEach((el) => {
                audio.delete(el);
                el.remove();
            });
        });
        next.on(RoomEvent.ActiveSpeakersChanged, (speakers) =>
            set({ speaking: speakers.map((p) => p.identity) }),
        );
        next.on(RoomEvent.ParticipantPermissionsChanged, (_prev, p) => {
            if (p !== next.localParticipant) return;
            const blocked = p.permissions?.canPublish === false;
            set({ micBlocked: blocked, micOn: blocked ? false : state.micOn });
            if (blocked) toast('Модератор вимкнув вам мікрофон');
        });
        next.on(RoomEvent.Disconnected, (reason) => {
            if (room !== next) return;
            if (reason === DisconnectReason.PARTICIPANT_REMOVED)
                toast('Вас виключили з голосової кімнати');
            cleanup();
        });

        await next.connect(access.url, access.token);
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
        toast.error(e instanceof ApiError ? e.message : failure);
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
        'Не вдалося підключитися до голосової кімнати',
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
            label: 'Спільний перегляд',
            href: `/watch/${code}`,
        },
        'Не вдалося підключити голос',
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
            label: 'Дзвінок',
            href: `/messages/${conversation.id}`,
        },
        'Не вдалося зателефонувати',
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
            label: 'Дзвінок',
            href: `/messages/${call.conversation_id}`,
        },
        'Не вдалося відповісти на дзвінок',
    );
}

export function declineCall(call: CallState) {
    void api('POST', `/calls/${call.id}/decline`).catch(() => undefined);
}

export async function leaveVoice() {
    const current = room;
    const callId = state.kind === 'call' ? state.callId : null;
    room = null;
    await current?.disconnect().catch(() => undefined);
    cleanup();
    // Сервер дізнається й з вебхука, але так співрозмовник побачить кінець дзвінка одразу.
    if (callId)
        void api('POST', `/calls/${callId}/leave`).catch(() => undefined);
}

async function setMic(on: boolean) {
    if (!room) return;
    try {
        await room.localParticipant.setMicrophoneEnabled(on);
        set({ micOn: on });
    } catch {
        set({ micOn: false });
        toast.error('Немає доступу до мікрофона — дозвольте його в браузері');
    }
}

export function toggleMic() {
    if (state.micBlocked) {
        toast('Модератор вимкнув вам мікрофон');

        return;
    }
    void setMic(!state.micOn);
}

export function toggleDeafen() {
    const deafened = !state.deafened;
    audio.forEach((el) => (el.muted = deafened));
    set({ deafened });
}
