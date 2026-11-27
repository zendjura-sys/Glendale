import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';

export type ModuleId = string;
export type LayoutState = { mode: 'unified' | 'widgets'; gameOverlay: boolean; widgets: Record<ModuleId, { open: boolean; pinned: boolean }> };
export type ApiResult<T = unknown> = { ok: true; status: number; data: T } | { ok: false; status: number; message: string };
export type CaptureSource = { id: string; name: string; kind: 'screen' | 'window'; thumbnail: string; icon: string | null };
export type Settings = { overlay: 'auto' | 'always' | 'off'; launchAtLogin: boolean; modules: ModuleId[] };

function on<T>(channel: string, listener: (payload: T) => void): () => void {
    const handler = (_e: IpcRendererEvent, payload: T): void => listener(payload);
    ipcRenderer.on(channel, handler);
    return () => ipcRenderer.removeListener(channel, handler);
}

/** Єдиний міст до Main: інтерфейс не має доступу до Node, токена й файлів — лише ці виклики. */
const api = {
    window: {
        minimize: () => ipcRenderer.invoke('window:minimize'),
        toggleMaximize: () => ipcRenderer.invoke('window:toggle-maximize'),
        close: () => ipcRenderer.invoke('window:close'),
    },
    layout: {
        state: () => ipcRenderer.invoke('layout:state') as Promise<LayoutState>,
        setMode: (mode: 'unified' | 'widgets') => ipcRenderer.invoke('layout:mode', mode),
        detach: (id: ModuleId) => ipcRenderer.invoke('layout:detach', id),
        toggle: (id: ModuleId) => ipcRenderer.invoke('layout:toggle', id),
        hide: (id: ModuleId) => ipcRenderer.invoke('layout:hide', id),
        pin: (id: ModuleId, on: boolean) => ipcRenderer.invoke('layout:pin', id, on),
        reset: () => ipcRenderer.invoke('layout:reset'),
        onChange: (listener: (state: LayoutState) => void) => on('state', listener),
    },
    session: {
        signedIn: () => ipcRenderer.invoke('session:signed-in') as Promise<boolean>,
        save: (token: string) => ipcRenderer.invoke('session:save', token),
        logout: () => ipcRenderer.invoke('session:logout'),
        onChange: (listener: (signedIn: boolean) => void) => on('session', listener),
    },
    request: <T = unknown>(method: string, path: string, body?: unknown) => ipcRenderer.invoke('api', method, path, body) as Promise<ApiResult<T>>,
    sync: {
        emit: (topic: string, payload?: unknown) => ipcRenderer.send('sync', topic, payload),
        on: (listener: (event: { topic: string; payload: unknown }) => void) => on('sync', listener),
    },
    settings: {
        get: () => ipcRenderer.invoke('settings:get') as Promise<Settings>,
        set: (patch: Partial<Settings>) => ipcRenderer.invoke('settings:set', patch) as Promise<Settings>,
        onChange: (listener: (settings: Settings) => void) => on('settings', listener),
    },
    onGame: (listener: (title: string | null) => void) => on('game', listener),
    studio: {
        open: () => ipcRenderer.invoke('studio:open'),
        load: <T>(key: string) => ipcRenderer.invoke('store:get', key) as Promise<T | null>,
        persist: (key: string, value: unknown) => ipcRenderer.invoke('store:set', key, value),
        sources: () => ipcRenderer.invoke('capture:sources') as Promise<CaptureSource[]>,
        save: (bytes: ArrayBuffer, name: string) => ipcRenderer.invoke('studio:save', bytes, name) as Promise<string | null>,
        rtmpStart: (url: string, bitrate: number, fps: number) => ipcRenderer.invoke('rtmp:start', url, bitrate, fps) as Promise<{ ok: boolean; message?: string }>,
        rtmpChunk: (bytes: ArrayBuffer) => ipcRenderer.send('rtmp:chunk', bytes),
        rtmpStop: () => ipcRenderer.invoke('rtmp:stop'),
        onRtmpClosed: (listener: (code: number | null) => void) => on('rtmp:closed', listener),
        onRtmpLog: (listener: (line: string) => void) => on('rtmp:log', listener),
    },
};

contextBridge.exposeInMainWorld('gamecon', api);

export type GameConApi = typeof api;
