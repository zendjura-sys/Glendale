import { useSyncExternalStore } from 'react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import type { SpotifyTrack, TrackCard } from '@/types';
import { resumeAudioGraph, setNormalize } from '@/lib/audio-graph';
import { tr } from '@/lib/i18n';

/**
 * Глобальний плеєр GameCon. Живе поза React-деревом, тому музика не зупиняється
 * під час переходів між сторінками Inertia.
 *
 * Рушії: власні треки — HTMLAudioElement; Spotify — Web Playback SDK (Premium)
 * або офіційний iFrame-плеєр Spotify для всіх інших.
 */

export type Engine = 'audio' | 'live' | 'sdk' | 'embed';
export type RepeatMode = 'off' | 'all' | 'one';

export type PlayerState = {
    queue: TrackCard[];
    index: number;
    current: TrackCard | null;
    playing: boolean;
    loading: boolean;
    position: number;
    duration: number;
    volume: number;
    muted: boolean;
    shuffle: boolean;
    repeat: RepeatMode;
    engine: Engine | null;
    /** ∞ — коли черга скінчилась, грати схожі треки (як автовідтворення в Apple Music). */
    autoplay: boolean;
    /** Безкінечна станція, з якої підвантажуються наступні треки (me, genre:…, artist:…, track:…). */
    station: string | null;
    /** Щойно зіграні треки (історія в «Далі в черзі»). */
    played: TrackCard[];
    /** «Грає з…» — звідки черга: альбом, плейлист, станція (підпис і посилання над чергою). */
    from: PlayFrom | null;
    /** Плавні переходи між треками, секунди (0 — вимкнено). */
    crossfade: number;
    /** «Вирівнювання гучності» (як Sound Check). */
    normalize: boolean;
    /** Таймер сну: час зупинки (мс) або «наприкінці треку». */
    sleep: number | 'track' | null;
    /** Показувати переклад під рядками тексту пісні (можна вимкнути). */
    lyricsTranslate: boolean;
};

export type PlayFrom = { label: string; href?: string | null };

type SpotifyAuth = { connected: boolean; premium: boolean };

const STORAGE_KEY = 'gc.player';
const saved = (() => {
    try {
        return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as {
            volume?: number;
            shuffle?: boolean;
            repeat?: RepeatMode;
            autoplay?: boolean;
            crossfade?: number;
            normalize?: boolean;
            lyricsTranslate?: boolean;
        };
    } catch {
        return {};
    }
})();

let state: PlayerState = {
    queue: [],
    index: -1,
    current: null,
    playing: false,
    loading: false,
    position: 0,
    duration: 0,
    volume: saved.volume ?? 0.8,
    muted: false,
    shuffle: saved.shuffle ?? false,
    repeat: saved.repeat ?? 'off',
    engine: null,
    autoplay: saved.autoplay ?? true,
    station: null,
    played: [],
    from: null,
    crossfade: saved.crossfade ?? 0,
    normalize: saved.normalize ?? false,
    sleep: null,
    lyricsTranslate: saved.lyricsTranslate ?? false,
};

const listeners = new Set<() => void>();
let spotifyAuth: SpotifyAuth = { connected: false, premium: false };
let reportTimer: ReturnType<typeof setTimeout> | undefined;
let ticker: ReturnType<typeof setInterval> | undefined;
let history: number[] = [];
let endedFor: string | null = null;

function set(patch: Partial<PlayerState>) {
    state = { ...state, ...patch };
    listeners.forEach((listener) => listener());

    if (
        'volume' in patch ||
        'shuffle' in patch ||
        'repeat' in patch ||
        'autoplay' in patch ||
        'crossfade' in patch ||
        'normalize' in patch ||
        'lyricsTranslate' in patch
    ) {
        try {
            localStorage.setItem(
                STORAGE_KEY,
                JSON.stringify({
                    volume: state.volume,
                    shuffle: state.shuffle,
                    repeat: state.repeat,
                    autoplay: state.autoplay,
                    crossfade: state.crossfade,
                    normalize: state.normalize,
                    lyricsTranslate: state.lyricsTranslate,
                }),
            );
        } catch {
            // Без сховища налаштування живуть до перезавантаження.
        }
    }
}

function subscribe(listener: () => void) {
    listeners.add(listener);

    return () => listeners.delete(listener);
}

export function usePlayer(): PlayerState {
    return useSyncExternalStore(subscribe, () => state);
}

export function getPlayerState(): PlayerState {
    return state;
}

/** Множник гучності для плавного переходу (1 — без затухання). */
let fadeLevel = 1;
let fadeTimer: ReturnType<typeof setInterval> | undefined;
let fadeInNext = false;
let fadingIn = false;

const effectiveVolume = () => (state.muted ? 0 : state.volume);

/* ------------------------------------------------------------------ */
/* Рушій HTMLAudioElement                                              */
/* ------------------------------------------------------------------ */

let audio: HTMLAudioElement | null = null;

let live: HTMLAudioElement | undefined;

/** Живе радіо — окремий елемент: чужий потік без CORS не можна вести через Web Audio («Караоке»). */
function liveEl(): HTMLAudioElement {
    if (live) return live;

    live = new Audio();
    live.preload = 'none';
    live.addEventListener('playing', () => {
        if (state.engine === 'live') set({ playing: true, loading: false });
    });
    live.addEventListener('pause', () => {
        if (state.engine === 'live') set({ playing: false });
    });
    live.addEventListener('waiting', () => {
        if (state.engine === 'live') set({ loading: true });
    });
    live.addEventListener('error', () => {
        if (state.engine !== 'live' || !live!.src) return;
        set({ playing: false, loading: false });
        toast.error(tr('Станція зараз не відповідає. Спробуйте пізніше.'));
    });

    return live;
}

/** Спільний HTMLAudioElement для власних треків (і графа «Караоке»). */
export function audioElement(): HTMLAudioElement {
    return audioEl();
}

/** Елемент, що зараз звучить (ефірне радіо грає в окремому), і всі елементи — для вибору виходу звуку. */
export function playingElement(): HTMLAudioElement {
    return state.engine === 'live' ? liveEl() : audioEl();
}

export function mediaElements(): HTMLAudioElement[] {
    return [audioEl(), liveEl()];
}

function audioEl(): HTMLAudioElement {
    if (audio) return audio;

    audio = new Audio();
    audio.preload = 'auto';
    audio.addEventListener('timeupdate', () => {
        if (state.engine !== 'audio') return;
        set({ position: audio!.currentTime });
        // Плавний перехід: останні секунди треку затихають, наступний з’являється з тиші.
        const left = audio!.duration - audio!.currentTime;
        if (
            state.crossfade > 0 &&
            state.repeat !== 'one' &&
            state.sleep !== 'track' &&
            Number.isFinite(left) &&
            audio!.duration > state.crossfade * 3 &&
            left <= state.crossfade
        ) {
            clearInterval(fadeTimer);
            fadingIn = false;
            fadeLevel = Math.max(left / state.crossfade, 0);
            audio!.volume = effectiveVolume() * fadeLevel;
        } else if (fadeLevel < 1 && !fadingIn) {
            // Перемотали назад під час затухання — гучність повертається.
            fadeLevel = 1;
            audio!.volume = effectiveVolume();
        }
    });
    audio.addEventListener('loadedmetadata', () => {
        if (state.engine === 'audio' && Number.isFinite(audio!.duration))
            set({ duration: audio!.duration });
    });
    audio.addEventListener('playing', () => {
        if (state.engine === 'audio') set({ playing: true, loading: false });
    });
    audio.addEventListener('pause', () => {
        if (state.engine === 'audio') set({ playing: false });
    });
    audio.addEventListener('waiting', () => {
        if (state.engine === 'audio') set({ loading: true });
    });
    audio.addEventListener('ended', () => {
        if (state.engine === 'audio') onEnded();
    });
    audio.addEventListener('error', () => {
        if (state.engine !== 'audio' || !audio!.src) return;
        set({ playing: false, loading: false });
        toast.error(tr('Не вдалося відтворити трек.'));
    });

    return audio;
}

/* ------------------------------------------------------------------ */
/* Spotify Web Playback SDK (Premium)                                  */
/* ------------------------------------------------------------------ */

type SdkState = {
    paused: boolean;
    position: number;
    duration: number;
    loading?: boolean;
    track_window: {
        current_track: { id: string | null } | null;
        previous_tracks: { id: string | null }[];
    };
};

type SdkPlayer = {
    connect(): Promise<boolean>;
    disconnect(): void;
    addListener(event: string, cb: (payload: never) => void): void;
    togglePlay(): Promise<void>;
    pause(): Promise<void>;
    resume(): Promise<void>;
    seek(ms: number): Promise<void>;
    setVolume(volume: number): Promise<void>;
    activateElement?(): Promise<void>;
};

declare global {
    interface Window {
        onSpotifyWebPlaybackSDKReady?: () => void;
        onSpotifyIframeApiReady?: (api: EmbedApi) => void;
        Spotify?: {
            Player: new (options: {
                name: string;
                getOAuthToken: (cb: (token: string) => void) => void;
                volume?: number;
            }) => SdkPlayer;
        };
    }
}

let sdkPlayer: SdkPlayer | null = null;
let sdkDevice: Promise<string> | null = null;
let sdkFailed = false;

function injectScript(src: string) {
    if (document.querySelector(`script[src="${src}"]`)) return;
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    document.body.appendChild(script);
}

function loadSdk(): Promise<string> {
    if (sdkDevice) return sdkDevice;

    sdkDevice = new Promise<string>((resolve, reject) => {
        const timeout = setTimeout(
            () => reject(new Error(tr('Spotify SDK не відповідає.'))),
            15000,
        );

        window.onSpotifyWebPlaybackSDKReady = () => {
            const player = new window.Spotify!.Player({
                name: 'GameCon Web Player',
                volume: effectiveVolume(),
                getOAuthToken: (cb) => {
                    api<{ access_token: string }>('GET', '/music/spotify/token')
                        .then((r) => cb(r.access_token))
                        .catch(() => reject(new Error(tr('Немає токена.'))));
                },
            });

            player.addListener('ready', (({
                device_id,
            }: {
                device_id: string;
            }) => {
                clearTimeout(timeout);
                resolve(device_id);
            }) as never);
            for (const event of [
                'initialization_error',
                'authentication_error',
                'account_error',
            ]) {
                player.addListener(event, (({
                    message,
                }: {
                    message: string;
                }) => {
                    clearTimeout(timeout);
                    reject(new Error(message));
                }) as never);
            }
            player.addListener('player_state_changed', ((
                sdk: SdkState | null,
            ) => {
                if (!sdk || state.engine !== 'sdk') return;
                const current = state.current;
                const finished =
                    sdk.paused &&
                    sdk.position === 0 &&
                    current?.source === 'spotify' &&
                    sdk.track_window.previous_tracks.some(
                        (t) => t.id === current.id,
                    );

                set({
                    playing: !sdk.paused,
                    loading: !!sdk.loading,
                    position: sdk.position / 1000,
                    duration: sdk.duration / 1000 || state.duration,
                });
                if (finished) onEnded();
            }) as never);

            void player.connect();
            sdkPlayer = player;
        };

        injectScript('https://sdk.scdn.co/spotify-player.js');
    });

    sdkDevice.catch(() => {
        sdkFailed = true;
        sdkDevice = null;
    });

    return sdkDevice;
}

async function playViaSdk(track: SpotifyTrack): Promise<void> {
    const deviceId = await loadSdk();
    await sdkPlayer?.activateElement?.();
    await api('PUT', '/music/spotify/play', {
        device_id: deviceId,
        uris: [track.uri],
    });
    set({ engine: 'sdk', duration: track.duration });
}

/* ------------------------------------------------------------------ */
/* Spotify iFrame API (без Premium / без акаунта)                      */
/* ------------------------------------------------------------------ */

type EmbedController = {
    loadUri(uri: string): void;
    play(): void;
    pause(): void;
    resume(): void;
    togglePlay(): void;
    seek(seconds: number): void;
    destroy(): void;
    addListener(
        event: 'playback_update' | 'ready',
        cb: (e: {
            data: {
                isPaused: boolean;
                isBuffering: boolean;
                duration: number;
                position: number;
            };
        }) => void,
    ): void;
};

type EmbedApi = {
    createController(
        element: HTMLElement,
        options: { uri: string; width?: string | number; height?: number },
        callback: (controller: EmbedController) => void,
    ): void;
};

let embedApi: Promise<EmbedApi> | null = null;
let embed: EmbedController | null = null;
let embedHost: HTMLDivElement | null = null;

export const EMBED_HOST_ID = 'gc-spotify-embed';

function loadEmbedApi(): Promise<EmbedApi> {
    embedApi ??= new Promise<EmbedApi>((resolve) => {
        window.onSpotifyIframeApiReady = resolve;
        injectScript('https://open.spotify.com/embed/iframe-api/v1');
    });

    return embedApi;
}

function ensureEmbedHost(): HTMLDivElement {
    if (embedHost?.isConnected) return embedHost;

    embedHost = document.createElement('div');
    embedHost.id = EMBED_HOST_ID;
    embedHost.className =
        'fixed right-3 bottom-[148px] z-40 hidden w-[min(360px,calc(100vw-1.5rem))] overflow-hidden rounded-2xl shadow-[0_20px_60px_-15px_rgb(30_215_96/0.45)] ring-1 ring-white/10 lg:bottom-[92px]';
    const target = document.createElement('div');
    embedHost.appendChild(target);
    document.body.appendChild(embedHost);

    return embedHost;
}

function showEmbed(visible: boolean) {
    embedHost?.classList.toggle('hidden', !visible);
}

async function playViaEmbed(track: SpotifyTrack): Promise<void> {
    const host = ensureEmbedHost();
    set({ engine: 'embed', duration: track.duration });
    showEmbed(true);

    if (embed) {
        embed.loadUri(track.uri);
        embed.play();

        return;
    }

    const IFrameAPI = await loadEmbedApi();
    await new Promise<void>((resolve) => {
        IFrameAPI.createController(
            host.firstElementChild as HTMLElement,
            { uri: track.uri, width: '100%', height: 80 },
            (controller) => {
                embed = controller;
                controller.addListener('playback_update', (e) => {
                    if (state.engine !== 'embed') return;
                    const { isPaused, isBuffering, duration, position } =
                        e.data;
                    set({
                        playing: !isPaused,
                        loading: isBuffering,
                        position: position / 1000,
                        duration: duration / 1000 || state.duration,
                    });
                    if (
                        isPaused &&
                        duration > 0 &&
                        position > 0 &&
                        duration - position < 600
                    )
                        onEnded();
                });
                controller.addListener('ready', () => {
                    controller.play();
                    resolve();
                });
            },
        );
    });
}

/* ------------------------------------------------------------------ */
/* Керування                                                           */
/* ------------------------------------------------------------------ */

function stopEngines(except?: Engine) {
    if (except !== 'audio' && audio && !audio.paused) audio.pause();
    if (except !== 'live' && live) {
        live.pause();
        live.removeAttribute('src');
    }
    if (except !== 'sdk' && sdkPlayer && state.engine === 'sdk')
        void sdkPlayer.pause();
    if (except !== 'embed' && embed && state.engine === 'embed') embed.pause();
    if (except !== 'embed') showEmbed(false);
}

function report(track: TrackCard) {
    clearTimeout(reportTimer);
    if (track.source === 'radio') return;
    reportTimer = setTimeout(() => {
        const body =
            track.source === 'local'
                ? { source: 'local', track_id: track.id }
                : {
                      source: 'spotify',
                      track: {
                          id: track.id,
                          title: track.title,
                          artist: track.artist,
                          album: track.album,
                          duration: track.duration,
                          cover_url: track.cover_url,
                      },
                  };
        void api('POST', '/music/now-playing', body).catch(() => {});
    }, 1500);
}

function mediaSession(track: TrackCard) {
    if (!('mediaSession' in navigator)) return;
    navigator.mediaSession.metadata = new MediaMetadata({
        title: track.title,
        artist: track.artist,
        album: track.album ?? 'GameCon',
        artwork: track.cover_url
            ? [{ src: track.cover_url, sizes: '600x600' }]
            : [],
    });
    navigator.mediaSession.setActionHandler('play', () => toggle());
    navigator.mediaSession.setActionHandler('pause', () => toggle());
    navigator.mediaSession.setActionHandler('nexttrack', () => next());
    navigator.mediaSession.setActionHandler('previoustrack', () => prev());
}

function startTicker() {
    clearInterval(ticker);
    ticker = setInterval(() => {
        if (state.engine === 'sdk' && state.playing)
            set({ position: Math.min(state.position + 0.5, state.duration) });
    }, 500);
}

async function start(index: number) {
    const track = state.queue[index];
    if (!track) return;
    endedFor = null;
    if (state.current && state.current.key !== track.key) {
        set({
            played: [
                state.current,
                ...state.played.filter((t) => t.key !== state.current!.key),
            ].slice(0, 30),
        });
    }

    set({
        index,
        current: track,
        position: 0,
        duration: track.duration,
        loading: true,
        playing: false,
    });
    mediaSession(track);
    report(track);

    try {
        if (track.source === 'radio') {
            stopEngines('live');
            const el = liveEl();
            set({ engine: 'live', duration: 0 });
            el.src = track.url;
            el.volume = effectiveVolume();
            await el.play();

            return;
        }

        if (track.source === 'local') {
            stopEngines('audio');
            const el = audioEl();
            set({ engine: 'audio' });
            el.src = track.url;
            if (state.normalize) setNormalize(el, true);
            resumeAudioGraph();
            fadeIn(el, fadeInNext && state.crossfade > 0);
            fadeInNext = false;
            await el.play();

            return;
        }

        if (spotifyAuth.premium && !sdkFailed) {
            stopEngines('sdk');
            try {
                await playViaSdk(track);
                startTicker();

                return;
            } catch (error) {
                toast.message(
                    tr(
                        'Повне відтворення Spotify недоступне — вмикаємо вбудований плеєр.',
                    ),
                    {
                        description:
                            error instanceof Error ? error.message : undefined,
                    },
                );
            }
        }

        stopEngines('embed');
        await playViaEmbed(track);
    } catch (error) {
        // AbortError («play() перервано викликом pause()» чи новим src) — звичайна гонка при швидкому
        // перемиканні треків: новий запуск уже керує станом, людині тут нічого показувати.
        if (error instanceof DOMException && error.name === 'AbortError')
            return;
        set({ loading: false, playing: false });
        if (error instanceof DOMException && error.name === 'NotAllowedError')
            return;
        toast.error(
            error instanceof Error && error.message
                ? error.message
                : tr('Не вдалося відтворити трек.'),
        );
    }
}

function onEnded() {
    const marker = `${state.index}:${state.current?.key}`;
    if (endedFor === marker) return;
    endedFor = marker;

    if (state.sleep === 'track') {
        set({ sleep: null, playing: false });

        return;
    }
    fadeInNext = true;

    if (state.repeat === 'one') {
        void start(state.index);

        return;
    }

    const hasNext = state.shuffle
        ? state.queue.length > 1
        : state.index < state.queue.length - 1;
    if (hasNext || state.repeat === 'all') next();
    else if (
        state.current?.source === 'local' &&
        (state.station || state.autoplay)
    )
        void extend().then((added) => {
            if (added) next();
            else set({ playing: false, position: 0 });
        });
    else set({ playing: false, position: 0 });
}

/**
 * Дописати в чергу наступну порцію: зі станції або «схожі на останній трек» (∞).
 * Повертає, чи щось додалося.
 */
async function extend(): Promise<boolean> {
    const last = [...state.queue].reverse().find((t) => t.source === 'local');
    const key = state.station ?? (last ? `track:${last.id}` : null);
    if (!key) return false;
    const exclude = state.queue
        .filter((t) => t.source === 'local')
        .map((t) => t.id)
        .slice(-300);
    try {
        const params = new URLSearchParams({ key });
        exclude.forEach((id) => params.append('exclude[]', String(id)));
        const { tracks } = await api<{ tracks: TrackCard[] }>(
            'GET',
            `/music/station?${params.toString()}`,
        );
        if (tracks.length === 0) return false;
        set({ queue: [...state.queue, ...tracks] });

        return true;
    } catch {
        return false;
    }
}

/** Безкінечна станція: перша порція одразу, далі — підвантажується, коли черга закінчується. */
export async function playStation(key: string, label?: string) {
    set({ station: key });
    try {
        const params = new URLSearchParams({ key });
        const { tracks } = await api<{ tracks: TrackCard[] }>(
            'GET',
            `/music/station?${params.toString()}`,
        );
        if (tracks.length === 0) {
            toast.message(tr('На цій станції поки немає треків.'));

            return;
        }
        history = [];
        set({
            queue: tracks,
            index: 0,
            station: key,
            from: label ? { label } : pageSource(),
        });
        void start(0);
    } catch {
        toast.error(tr('Не вдалося запустити станцію.'));
    }
}

/** Грати останнім (у кінці черги). */
export function playLater(track: TrackCard) {
    if (!state.current) {
        playTrack(track);

        return;
    }
    set({ queue: [...state.queue.filter((t) => t.key !== track.key), track] });
    toast.success(tr('Трек гратиме останнім.'));
}

export function toggleAutoplay() {
    set({ autoplay: !state.autoplay });
}

/** Перемістити трек у черзі (перетягування в «Далі в черзі»). */
export function moveInQueue(from: number, to: number) {
    if (from === to || from === state.index) return;
    const queue = [...state.queue];
    const [item] = queue.splice(from, 1);
    queue.splice(to, 0, item);
    const index = queue.findIndex((t) => t.key === state.current?.key);
    set({ queue, index });
}

/** Очистити «Далі в черзі» (усе після поточного треку). */
export function clearUpNext() {
    set({ queue: state.queue.slice(0, state.index + 1) });
}

export function setSpotifyAuth(auth: SpotifyAuth) {
    if (auth.premium !== spotifyAuth.premium) sdkFailed = false;
    spotifyAuth = auth;
}

export function playQueue(
    tracks: TrackCard[],
    index = 0,
    from: PlayFrom | null = null,
) {
    if (tracks.length === 0) return;
    const current = state.current;
    const target = tracks[index];

    if (current && target && current.key === target.key) {
        set({ queue: tracks, index, from: from ?? state.from });
        toggle();

        return;
    }

    history = [];
    set({ queue: tracks, index, station: null, from: from ?? pageSource() });
    void start(index);
}

/** «Грає з…» за замовчуванням — сторінка, з якої запустили (назва без « · GameCon» і посилання). */
function pageSource(): PlayFrom | null {
    if (typeof document === 'undefined') return null;
    const label = document.title.split(' · ').slice(0, -1).join(' · ');

    return label ? { label, href: location.pathname + location.search } : null;
}

export function shuffled<T>(items: T[]): T[] {
    const copy = [...items];
    for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
    }

    return copy;
}

export function playTrack(track: TrackCard) {
    playQueue([track], 0);
}

export function playNext(track: TrackCard) {
    if (!state.current) {
        playTrack(track);

        return;
    }

    const queue = state.queue.filter((t) => t.key !== track.key);
    const at = queue.findIndex((t) => t.key === state.current!.key) + 1;
    queue.splice(at, 0, track);
    set({ queue, index: at - 1 });
    toast.success(tr('Трек буде наступним.'));
}

export function jumpTo(index: number) {
    history.push(state.index);
    void start(index);
}

export function removeFromQueue(index: number) {
    if (index === state.index) return;
    const queue = state.queue.filter((_, i) => i !== index);
    set({ queue, index: index < state.index ? state.index - 1 : state.index });
}

export function toggle() {
    if (!state.current) return;

    switch (state.engine) {
        case 'audio': {
            const el = audioEl();
            resumeAudioGraph();
            if (el.paused) void el.play().catch(() => {});
            else el.pause();
            break;
        }
        case 'live': {
            // Живий ефір після паузи починається з поточного моменту, а не з буфера.
            const el = liveEl();
            if (el.paused) {
                el.src = state.current?.url ?? el.src;
                void el.play().catch(() => {});
            } else el.pause();
            break;
        }
        case 'sdk':
            void sdkPlayer?.togglePlay();
            break;
        case 'embed':
            embed?.togglePlay();
            break;
        default:
            void start(state.index);
    }
}

export function next() {
    if (state.queue.length === 0) return;
    history.push(state.index);

    let index = state.index + 1;
    if (state.shuffle && state.queue.length > 1) {
        do index = Math.floor(Math.random() * state.queue.length);
        while (index === state.index);
    }
    void start(index % state.queue.length);
}

export function prev() {
    if (state.position > 4) {
        seek(0);

        return;
    }

    const previous = history.pop();
    const index = previous ?? Math.max(state.index - 1, 0);
    void start(index);
}

export function seek(seconds: number) {
    const position = Math.max(0, Math.min(seconds, state.duration || seconds));
    set({ position });

    if (state.engine === 'audio') audioEl().currentTime = position;
    if (state.engine === 'sdk') void sdkPlayer?.seek(position * 1000);
    if (state.engine === 'embed') embed?.seek(position);
}

export function setVolume(volume: number) {
    set({ volume: Math.max(0, Math.min(1, volume)), muted: false });
    applyVolume();
}

export function toggleMute() {
    set({ muted: !state.muted });
    applyVolume();
}

function applyVolume() {
    if (audio) audio.volume = effectiveVolume() * fadeLevel;
    if (live) live.volume = effectiveVolume();
    void sdkPlayer?.setVolume(Math.max(effectiveVolume(), 0.0001));
}

export function toggleShuffle() {
    set({ shuffle: !state.shuffle });
}

export function cycleRepeat() {
    set({
        repeat:
            state.repeat === 'off'
                ? 'all'
                : state.repeat === 'all'
                  ? 'one'
                  : 'off',
    });
}

export function patchTrack(key: string, patch: Partial<TrackCard>) {
    const apply = (t: TrackCard) =>
        t.key === key ? ({ ...t, ...patch } as TrackCard) : t;
    set({
        queue: state.queue.map(apply),
        current: state.current ? apply(state.current) : null,
    });
}

export function closePlayer() {
    stopEngines();
    clearInterval(ticker);
    if (audio) audio.removeAttribute('src');
    if (live) live.removeAttribute('src');
    set({
        queue: [],
        index: -1,
        current: null,
        playing: false,
        loading: false,
        position: 0,
        duration: 0,
        engine: null,
    });
    void api('DELETE', '/music/now-playing').catch(() => {});
}

export function isCurrent(track: { key: string }): boolean {
    return state.current?.key === track.key;
}

/** Новий трек з’являється з тиші за половину тривалості переходу (або одразу на повній гучності). */
function fadeIn(el: HTMLAudioElement, smooth: boolean) {
    clearInterval(fadeTimer);
    fadingIn = false;
    if (!smooth) {
        fadeLevel = 1;
        el.volume = effectiveVolume();

        return;
    }
    fadeLevel = 0;
    fadingIn = true;
    el.volume = 0;
    const step = 50 / ((state.crossfade * 1000) / 2);
    fadeTimer = setInterval(() => {
        fadeLevel = Math.min(fadeLevel + step, 1);
        el.volume = effectiveVolume() * fadeLevel;
        if (fadeLevel >= 1) {
            clearInterval(fadeTimer);
            fadingIn = false;
        }
    }, 50);
}

export function setCrossfade(seconds: number) {
    set({ crossfade: Math.max(0, Math.min(12, Math.round(seconds))) });
}

export function setNormalizeVolume(on: boolean) {
    set({ normalize: on });
    if (on || audio) setNormalize(audioEl(), on);
}

/* Таймер сну: хвилини або «наприкінці треку»; null — вимкнути. */
let sleepTimer: ReturnType<typeof setInterval> | undefined;

export function setSleepTimer(value: number | 'track' | null) {
    clearInterval(sleepTimer);
    if (value === null || value === 'track') {
        set({ sleep: value });

        return;
    }
    set({ sleep: Date.now() + value * 60_000 });
    sleepTimer = setInterval(() => {
        if (typeof state.sleep !== 'number') {
            clearInterval(sleepTimer);

            return;
        }
        if (Date.now() >= state.sleep) {
            clearInterval(sleepTimer);
            set({ sleep: null });
            if (state.playing) toggle();
        }
    }, 1000);
}

export function setLyricsTranslate(on: boolean) {
    set({ lyricsTranslate: on });
}
