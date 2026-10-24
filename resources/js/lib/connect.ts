import { useEffect, useState, useSyncExternalStore } from 'react';
import { toast } from 'sonner';
import { api, ApiError } from '@/lib/api';
import { tr } from '@/lib/i18n';
import {
    cycleRepeat,
    getPlayerState,
    next,
    playFrom,
    prev,
    seek,
    setVolume,
    subscribePlayer,
    toggle,
    toggleMute,
    toggleShuffle,
    usePlayer,
} from '@/lib/player';
import type { PlayerState, RepeatMode } from '@/lib/player';
import type { TrackCard } from '@/types';

/**
 * GameCon Connect (як Spotify Connect): вкладки сайту й застосунок бачать, що грає на іншому
 * пристрої, керують ним і перекидають відтворення («Грати тут / там»).
 *
 * Один браузер — один пристрій (id у localStorage `gc.device`). Звітує й виконує команди лише
 * «головна» вкладка: та, що грає, або перша відкрита. Сервер тримає стан у кеші й розсилає зміни
 * через Reverb (`connect.updated`, `connect.command`); застосунок отримує те саме з heartbeat.
 */

export type ConnectState = {
    track: TrackCard | null;
    playing: boolean;
    position: number;
    duration: number;
    volume: number;
    shuffle: boolean;
    repeat: RepeatMode;
    updated_at: string;
};

export type ConnectDevice = {
    id: string;
    name: string;
    kind: 'web' | 'app';
    last_seen: string;
    is_active: boolean;
    state: ConnectState | null;
};

export type ConnectAction =
    | 'toggle'
    | 'play'
    | 'pause'
    | 'next'
    | 'prev'
    | 'seek'
    | 'volume'
    | 'transfer';

export type ConnectCommand = {
    id: string;
    action: ConnectAction;
    value: unknown;
    from_device_id: string | null;
    created_at: string;
};

export type ConnectSnapshot = {
    devices: ConnectDevice[];
    active_device_id: string | null;
};

type Transfer = {
    track: TrackCard | null;
    queue?: TrackCard[];
    index?: number | null;
    position?: number;
    playing?: boolean;
};

const DEVICE_KEY = 'gc.device';
const LEADER_KEY = 'gc.connect.leader';
const SNAPSHOT_KEY = 'gc.connect.snapshot';
const BEAT_MS = 10_000;
const LEADER_STALE_MS = 25_000;
const STALE_MS = 30_000;

function randomId(): string {
    try {
        return crypto.randomUUID();
    } catch {
        // Без захищеного контексту (http) randomUUID немає.
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
            const r = Math.floor(Math.random() * 16);

            return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
        });
    }
}

const TAB = randomId();

/** Цей браузер як пристрій GameCon Connect (спільний для всіх вкладок). */
export const deviceId: string = (() => {
    try {
        const saved = localStorage.getItem(DEVICE_KEY);
        if (saved && /^[A-Za-z0-9_-]{8,64}$/.test(saved)) return saved;
        const id = randomId();
        localStorage.setItem(DEVICE_KEY, id);

        return id;
    } catch {
        return TAB;
    }
})();

/** «Chrome · Windows» — з userAgent. */
export function deviceName(): string {
    const ua = typeof navigator === 'undefined' ? '' : navigator.userAgent;
    const browser = /Edg\//.test(ua)
        ? 'Edge'
        : /OPR\/|Opera/.test(ua)
          ? 'Opera'
          : /SamsungBrowser/.test(ua)
            ? 'Samsung Internet'
            : /Firefox\/|FxiOS/.test(ua)
              ? 'Firefox'
              : /Chrome\/|CriOS/.test(ua)
                ? 'Chrome'
                : /Safari\//.test(ua)
                  ? 'Safari'
                  : tr('Браузер');
    const os = /Windows/.test(ua)
        ? 'Windows'
        : /iPhone|iPad|iPod/.test(ua)
          ? 'iOS'
          : /Android/.test(ua)
            ? 'Android'
            : /CrOS/.test(ua)
              ? 'ChromeOS'
              : /Mac OS X|Macintosh/.test(ua)
                ? 'macOS'
                : /Linux/.test(ua)
                  ? 'Linux'
                  : '';

    return os ? `${browser} · ${os}` : browser;
}

/* ------------------------------------------------------------------ */
/* Сховище: пристрої й активний                                        */
/* ------------------------------------------------------------------ */

type Store = { devices: ConnectDevice[]; activeId: string | null };

let store: Store = (() => {
    try {
        const saved = JSON.parse(
            localStorage.getItem(SNAPSHOT_KEY) ?? 'null',
        ) as (ConnectSnapshot & { at: number }) | null;
        if (saved && Date.now() - saved.at < STALE_MS)
            return {
                devices: saved.devices,
                activeId: saved.active_device_id,
            };
    } catch {
        // Без сховища — порожньо до першого heartbeat.
    }

    return { devices: [], activeId: null };
})();

const listeners = new Set<() => void>();

function setStore(next: Store) {
    store = next;
    listeners.forEach((listener) => listener());
}

/** Новий знімок від сервера (heartbeat чи подія): для всіх вкладок цього браузера. */
export function applySnapshot(snapshot: ConnectSnapshot) {
    setStore({
        devices: snapshot.devices,
        activeId: snapshot.active_device_id,
    });
    try {
        localStorage.setItem(
            SNAPSHOT_KEY,
            JSON.stringify({ ...snapshot, at: Date.now() }),
        );
    } catch {
        // Не біда: інші вкладки дочекаються події.
    }
}

function subscribe(listener: () => void) {
    listeners.add(listener);

    return () => {
        listeners.delete(listener);
    };
}

export function useConnect(): Store {
    return useSyncExternalStore(subscribe, () => store);
}

/* ------------------------------------------------------------------ */
/* Головна вкладка                                                     */
/* ------------------------------------------------------------------ */

function readLeader(): { tab: string; at: number } | null {
    try {
        return JSON.parse(localStorage.getItem(LEADER_KEY) ?? 'null');
    } catch {
        return null;
    }
}

function claim() {
    try {
        localStorage.setItem(
            LEADER_KEY,
            JSON.stringify({ tab: TAB, at: Date.now() }),
        );
    } catch {
        // Без сховища кожна вкладка сама за себе.
    }
}

/** Чи ця вкладка звітує за браузер. Порожнє чи застаріле місце займає першою. */
function isLeader(): boolean {
    const leader = readLeader();
    if (
        !leader ||
        leader.tab === TAB ||
        Date.now() - leader.at > LEADER_STALE_MS
    ) {
        claim();

        return true;
    }

    return false;
}

/* ------------------------------------------------------------------ */
/* Heartbeat                                                           */
/* ------------------------------------------------------------------ */

let started = 0;
let beatTimer: ReturnType<typeof setInterval> | undefined;
let debounce: ReturnType<typeof setTimeout> | undefined;
let unsubscribePlayer: (() => void) | undefined;
/** Ця вкладка вже повідомляла стан — коли плеєр закриють, треба стерти його на сервері. */
let reported = false;
let queueSig = '';
const done: string[] = [];

function localState(p: PlayerState, withQueue: boolean) {
    const state: Record<string, unknown> = {
        track: p.current,
        playing: p.playing,
        position: Math.round(p.position * 100) / 100,
        duration: Math.round(p.duration * 100) / 100,
        volume: p.muted ? 0 : p.volume,
        shuffle: p.shuffle,
        repeat: p.repeat,
        updated_at: new Date().toISOString(),
    };
    // Чергу — лише коли змінилась або перед «Грати там»: інакше heartbeat важкий.
    const sig = `${p.index}:${p.queue.map((t) => t.key).join(',')}`;
    if (withQueue || sig !== queueSig) {
        const from = Math.max(0, p.index - 50);
        state.queue = p.queue.slice(from, from + 200);
        state.index = Math.max(0, p.index - from);
        queueSig = sig;
    }

    return state;
}

async function heartbeat(withQueue = false): Promise<void> {
    if (!started || !isLeader()) return;
    const p = getPlayerState();
    const body: Record<string, unknown> = {
        device_id: deviceId,
        name: deviceName(),
        kind: 'web',
    };
    if (p.current) {
        body.state = localState(p, withQueue);
        reported = true;
    } else if (reported) {
        body.state = null;
        reported = false;
        queueSig = '';
    }

    try {
        const res = await api<ConnectSnapshot & { commands: ConnectCommand[] }>(
            'POST',
            '/music/connect/heartbeat',
            body,
        );
        applySnapshot(res);
        res.commands.forEach(run);
    } catch {
        // Мережа чи ліміт — наступна спроба за розкладом.
        queueSig = '';
    }
}

function schedule() {
    clearTimeout(debounce);
    debounce = setTimeout(() => void heartbeat(), 400);
}

let lastSig = '';
let lastPosition = 0;
let lastPlaying = false;
let lastAt = 0;

/** Зміни плеєра, про які варто сказати іншим одразу: трек, пауза, гучність, режими, перемотка. */
function onPlayer() {
    const p = getPlayerState();
    const sig = [
        p.current?.key ?? '',
        p.playing,
        Math.round(p.volume * 100),
        p.muted,
        p.shuffle,
        p.repeat,
    ].join('|');
    const expected =
        lastPosition + (lastPlaying ? (Date.now() - lastAt) / 1000 : 0);
    const jumped = Math.abs(p.position - expected) > 3;
    lastPosition = p.position;
    lastPlaying = p.playing;
    lastAt = Date.now();
    if (sig === lastSig && !jumped) return;
    lastSig = sig;
    // Почали грати в цій вкладці — вона звітує за браузер (і забирає відтворення в інших пристроїв).
    if (p.playing) claim();
    schedule();
}

function onVisible() {
    if (document.visibilityState === 'visible') void heartbeat();
}

/** Знімок, який записала головна вкладка, — для решти вкладок цього браузера. */
function onStorage(e: StorageEvent) {
    if (e.key !== SNAPSHOT_KEY || !e.newValue) return;
    try {
        const snapshot = JSON.parse(e.newValue) as ConnectSnapshot;
        setStore({
            devices: snapshot.devices,
            activeId: snapshot.active_device_id,
        });
    } catch {
        // Пошкоджений запис — дочекаємося наступного.
    }
}

function onLeave() {
    if (readLeader()?.tab === TAB) {
        try {
            localStorage.removeItem(LEADER_KEY);
        } catch {
            // Місце звільниться саме за 25 с.
        }
    }
}

/** Увімкнути Connect у цій вкладці (лічильник: кілька макетів можуть монтувати слухача). */
export function startConnect(): () => void {
    started++;
    if (started === 1) {
        unsubscribePlayer = subscribePlayer(onPlayer);
        beatTimer = setInterval(() => void heartbeat(), BEAT_MS);
        document.addEventListener('visibilitychange', onVisible);
        window.addEventListener('pagehide', onLeave);
        window.addEventListener('storage', onStorage);
        void heartbeat();
    }

    return () => {
        started--;
        if (started > 0) return;
        unsubscribePlayer?.();
        clearInterval(beatTimer);
        clearTimeout(debounce);
        document.removeEventListener('visibilitychange', onVisible);
        window.removeEventListener('pagehide', onLeave);
        window.removeEventListener('storage', onStorage);
    };
}

/* ------------------------------------------------------------------ */
/* Вхідні команди                                                      */
/* ------------------------------------------------------------------ */

/** Подія `connect.command`: виконує лише головна вкладка цього браузера. */
export function receiveCommand(event: {
    target_device_id: string;
    command: ConnectCommand;
}) {
    if (event.target_device_id !== deviceId || !isLeader()) return;
    run(event.command);
}

function run(command: ConnectCommand) {
    // Та сама команда приходить і подією, і з heartbeat.
    if (done.includes(command.id)) return;
    done.push(command.id);
    if (done.length > 100) done.shift();

    const p = getPlayerState();
    const value = typeof command.value === 'number' ? command.value : null;
    switch (command.action) {
        case 'toggle':
            toggle();
            break;
        case 'play':
            if (!p.playing) toggle();
            break;
        case 'pause':
            if (p.playing) toggle();
            break;
        case 'next':
            next();
            break;
        case 'prev':
            prev();
            break;
        case 'seek':
            if (value !== null) seek(value);
            break;
        case 'volume':
            if (value !== null) setVolume(value);
            break;
        case 'transfer':
            if (command.value && typeof command.value === 'object')
                void receiveTransfer(command.value as Transfer);
            break;
    }
    schedule();
}

async function receiveTransfer(value: Transfer) {
    const queue = value.queue?.length ? value.queue : null;
    const tracks = queue ?? (value.track ? [value.track] : []);
    if (tracks.length === 0) return;
    let index = queue ? (value.index ?? 0) : 0;
    if (value.track && tracks[index]?.key !== value.track.key) {
        const found = tracks.findIndex((t) => t.key === value.track!.key);
        index = found >= 0 ? found : 0;
    }
    const playing = value.playing !== false;

    claim();
    await playFrom(tracks, index, value.position ?? 0, playing, {
        label: tr('З іншого пристрою'),
    });
    void heartbeat(true);
    if (!playing) return;
    // Браузер не дає звуку без дотику людини до сторінки — тоді просимо натиснути «Грати».
    setTimeout(() => {
        const p = getPlayerState();
        if (p.playing || p.loading) return;
        toast.message(tr('Музику перенесено сюди.'), {
            description: tr('Натисніть «Грати», щоб увімкнути звук.'),
            action: { label: tr('Грати'), onClick: () => toggle() },
        });
    }, 1500);
}

/* ------------------------------------------------------------------ */
/* Керування іншим пристроєм                                           */
/* ------------------------------------------------------------------ */

const pending = new Map<string, ReturnType<typeof setTimeout>>();

function post(target: string, action: ConnectAction, value: number | null) {
    return api('POST', '/music/connect/command', {
        target_device_id: target,
        action,
        value,
        device_id: deviceId,
    }).catch((error: unknown) => {
        toast.error(
            error instanceof ApiError
                ? error.message
                : tr('Пристрій не відповідає.'),
        );
    });
}

/** Поки пристрій не відзвітував — показуємо очікуваний результат. */
function optimistic(
    target: string,
    action: ConnectAction,
    value: number | null,
) {
    const devices = store.devices.map((d) => {
        if (d.id !== target || !d.state) return d;
        const s = {
            ...d.state,
            position: remotePosition(d.state, Date.now()),
            updated_at: new Date().toISOString(),
        };
        if (action === 'toggle') s.playing = !s.playing;
        if (action === 'play') s.playing = true;
        if (action === 'pause') s.playing = false;
        if (action === 'seek' && value !== null) s.position = value;
        if (action === 'volume' && value !== null) s.volume = value;

        return { ...d, state: s };
    });
    setStore({ ...store, devices });
}

/** Команда пристрою; перемотка й гучність — із затримкою, щоб повзунок не засипав сервер. */
export function sendCommand(
    target: string,
    action: Exclude<ConnectAction, 'transfer'>,
    value: number | null = null,
) {
    optimistic(target, action, value);
    if (action !== 'seek' && action !== 'volume') {
        void post(target, action, value);

        return;
    }
    clearTimeout(pending.get(action));
    pending.set(
        action,
        setTimeout(() => {
            pending.delete(action);
            void post(target, action, value);
        }, 250),
    );
}

/** «Грати тут / там»: відтворення переходить на пристрій target з того самого місця. */
export async function transferTo(target: string) {
    const p = getPlayerState();
    if (target === deviceId) {
        const active = store.devices.find((d) => d.id === store.activeId);
        if (!active || active.id === deviceId || !active.state?.track) {
            if (p.current && !p.playing) toggle();

            return;
        }
        // «Грати тут» натиснули в цій вкладці — вона й прийме відтворення.
        claim();
    }
    // Сервер бере стан активного пристрою; якщо грає тут — спершу свіжий стан із чергою.
    if (p.current) claim();
    await heartbeat(true);
    try {
        await api('POST', '/music/connect/command', {
            target_device_id: target,
            action: 'transfer',
            device_id: deviceId,
        });
    } catch (error) {
        toast.error(
            error instanceof ApiError
                ? error.message
                : tr('Не вдалося перемкнути відтворення.'),
        );
    }
}

/* ------------------------------------------------------------------ */
/* Плеєр з урахуванням іншого пристрою                                 */
/* ------------------------------------------------------------------ */

/** Позиція зараз: остання відома плюс скільки минуло, поки грає. */
export function remotePosition(state: ConnectState, now: number): number {
    const elapsed = state.playing
        ? Math.max(0, (now - Date.parse(state.updated_at)) / 1000)
        : 0;
    const position = state.position + (Number.isFinite(elapsed) ? elapsed : 0);

    return state.duration > 0 ? Math.min(position, state.duration) : position;
}

/** Інші пристрої (без цього браузера). */
export function useOtherDevices(): ConnectDevice[] {
    const { devices } = useConnect();

    return devices.filter((d) => d.id !== deviceId);
}

/** Пристрій, що грає деінде, коли ця вкладка мовчить, — плеєр переходить у віддалений режим. */
export function useRemote(): ConnectDevice | null {
    const { devices, activeId } = useConnect();
    const local = usePlayer();
    if (local.playing || !activeId || activeId === deviceId) return null;
    const device = devices.find((d) => d.id === activeId);

    return device?.state?.track ? device : null;
}

export type Playback = Omit<PlayerState, 'current'> & {
    current: TrackCard | null;
    /** Пристрій, яким керуємо (null — грає тут). */
    remote: ConnectDevice | null;
    toggle: () => void;
    next: () => void;
    prev: () => void;
    seek: (seconds: number) => void;
    setVolume: (volume: number) => void;
    toggleMute: () => void;
    toggleShuffle: () => void;
    cycleRepeat: () => void;
};

const localControls = {
    toggle,
    next,
    prev,
    seek,
    setVolume,
    toggleMute,
    toggleShuffle,
    cycleRepeat,
};

const noop = () => {};

/**
 * Стан і керування для міні-плеєра, капсули й «Зараз грає»: локальний плеєр або, якщо грає інший
 * пристрій, — його трек і прогрес (дорахований від updated_at), а кнопки шлють йому команди.
 */
export function usePlayback(): Playback {
    const local = usePlayer();
    const remote = useRemote();
    const [now, setNow] = useState(() => Date.now());
    const ticking = !!remote?.state?.playing;

    useEffect(() => {
        if (!ticking) return;
        const timer = setInterval(() => setNow(Date.now()), 500);

        return () => clearInterval(timer);
    }, [ticking]);

    if (!remote?.state) return { ...local, remote: null, ...localControls };

    const s = remote.state;
    const id = remote.id;
    const duration = s.duration || s.track?.duration || 0;

    return {
        ...local,
        remote,
        current: s.track,
        playing: s.playing,
        loading: false,
        position: remotePosition(s, now),
        duration,
        volume: s.volume,
        muted: false,
        shuffle: s.shuffle,
        repeat: s.repeat,
        engine: null,
        toggle: () => sendCommand(id, 'toggle'),
        next: () => sendCommand(id, 'next'),
        prev: () => sendCommand(id, 'prev'),
        seek: (seconds) =>
            sendCommand(id, 'seek', Math.max(0, Math.min(seconds, duration))),
        setVolume: (volume) =>
            sendCommand(id, 'volume', Math.max(0, Math.min(1, volume))),
        toggleMute: () => sendCommand(id, 'volume', s.volume > 0 ? 0 : 0.8),
        // Перемішування й повтор живуть на тому пристрої — звідси лише показуємо.
        toggleShuffle: noop,
        cycleRepeat: noop,
    };
}
