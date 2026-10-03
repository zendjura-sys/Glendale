import type { Room } from 'livekit-client';
import { useSyncExternalStore } from 'react';
import { toast } from 'sonner';
import { api, ApiError } from '@/lib/api';

/**
 * Голосова кімната GameCon. Одне з’єднання LiveKit на весь сайт, поза React-деревом —
 * розмова не обривається під час переходів між сторінками (як музичний плеєр).
 */

export type VoiceOwner = { type: 'family' | 'community'; id: number };

export type VoiceState = {
    status: 'idle' | 'connecting' | 'connected';
    roomId: number | null;
    roomName: string;
    /** Назва сім’ї чи спільноти й посилання на неї — для панелі внизу. */
    label: string;
    href: string;
    owner: VoiceOwner | null;
    identity: string | null;
    micOn: boolean;
    /** Модератор забрав мікрофон. */
    micBlocked: boolean;
    deafened: boolean;
    speaking: string[];
};

const initial: VoiceState = {
    status: 'idle',
    roomId: null,
    roomName: '',
    label: '',
    href: '',
    owner: null,
    identity: null,
    micOn: false,
    micBlocked: false,
    deafened: false,
    speaking: [],
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

function cleanup() {
    audio.forEach((el) => el.remove());
    audio.clear();
    room = null;
    set({ ...initial, deafened: state.deafened });
}

type JoinResponse = { url: string; token: string; identity: string };

export async function joinVoice(
    target: { id: number; name: string },
    owner: VoiceOwner,
    label: string,
    href: string,
) {
    if (state.roomId === target.id && state.status !== 'idle') return;
    if (room) await leaveVoice();

    set({
        status: 'connecting',
        roomId: target.id,
        roomName: target.name,
        label,
        href,
        owner,
    });

    try {
        const [lk, access] = await Promise.all([
            import('livekit-client'),
            api<JoinResponse>('POST', `/voice/rooms/${target.id}/join`),
        ]);
        const { DisconnectReason, Room, RoomEvent, Track } = lk;
        const next = new Room({ adaptiveStream: true, dynacast: true });
        room = next;

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
        });
        if (!blocked) await setMic(true);
    } catch (e) {
        await room?.disconnect().catch(() => undefined);
        cleanup();
        toast.error(
            e instanceof ApiError
                ? e.message
                : 'Не вдалося підключитися до голосової кімнати',
        );
    }
}

export async function leaveVoice() {
    const current = room;
    room = null;
    await current?.disconnect().catch(() => undefined);
    cleanup();
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
