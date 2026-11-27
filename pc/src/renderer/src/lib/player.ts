import { useEffect, useState } from 'react';

export type Track = { id: number; key: string; title: string; artist: string | null; album: string | null; genre: string | null; duration: number | null; url: string | null; cover_url: string | null; favorite?: boolean; in_library?: boolean };

type State = { queue: Track[]; index: number; playing: boolean; time: number; duration: number; volume: number; shuffle: boolean; repeat: 'off' | 'all' | 'one' };

/**
 * Плеєр GameCon у програмі: одна черга на все вікно, грає далі, хоч би яку сторінку відкрили.
 * Медіаклавіші клавіатури й системна панель Windows — через Media Session.
 */
class Player {
    private audio = new Audio();
    state: State = { queue: [], index: -1, playing: false, time: 0, duration: 0, volume: 0.8, shuffle: false, repeat: 'off' };
    private listeners = new Set<() => void>();

    constructor() {
        try {
            this.state.volume = Number(localStorage.getItem('gc-volume') ?? 0.8);
        } catch {
            // немає сховища — гучність за замовчуванням
        }
        this.audio.volume = this.state.volume;
        this.audio.addEventListener('timeupdate', () => this.set({ time: this.audio.currentTime, duration: this.audio.duration || this.current?.duration || 0 }));
        this.audio.addEventListener('play', () => this.set({ playing: true }));
        this.audio.addEventListener('pause', () => this.set({ playing: false }));
        this.audio.addEventListener('ended', () => (this.state.repeat === 'one' ? void this.audio.play() : this.next()));
        const ms = navigator.mediaSession;
        if (ms) {
            ms.setActionHandler('play', () => this.toggle());
            ms.setActionHandler('pause', () => this.toggle());
            ms.setActionHandler('nexttrack', () => this.next());
            ms.setActionHandler('previoustrack', () => this.prev());
        }
    }

    get current(): Track | null {
        return this.state.queue[this.state.index] ?? null;
    }

    private set(patch: Partial<State>): void {
        this.state = { ...this.state, ...patch };
        this.listeners.forEach((l) => l());
    }

    subscribe(l: () => void): () => void {
        this.listeners.add(l);
        return () => this.listeners.delete(l);
    }

    /** Грати список з певного треку (черга = список). */
    play(list: Track[], start = 0): void {
        const queue = list.filter((t) => t.url);
        if (!queue.length) return;
        const at = Math.max(0, queue.findIndex((t) => t.key === list[start]?.key));
        this.set({ queue, index: at });
        this.load();
    }

    private load(): void {
        const t = this.current;
        if (!t?.url) return;
        this.audio.src = t.url;
        void this.audio.play().catch(() => undefined);
        if (navigator.mediaSession) navigator.mediaSession.metadata = new MediaMetadata({ title: t.title, artist: t.artist ?? '', album: t.album ?? '', artwork: t.cover_url ? [{ src: t.cover_url, sizes: '512x512' }] : [] });
    }

    toggle(): void {
        if (!this.current) return;
        if (this.audio.paused) void this.audio.play();
        else this.audio.pause();
    }

    next(): void {
        const { queue, index, shuffle, repeat } = this.state;
        if (!queue.length) return;
        let to = shuffle ? Math.floor(Math.random() * queue.length) : index + 1;
        if (to >= queue.length) {
            if (repeat !== 'all') return this.set({ playing: false });
            to = 0;
        }
        this.set({ index: to });
        this.load();
    }

    prev(): void {
        if (this.audio.currentTime > 3) return void (this.audio.currentTime = 0);
        this.set({ index: Math.max(0, this.state.index - 1) });
        this.load();
    }

    seek(sec: number): void {
        this.audio.currentTime = sec;
    }

    volume(v: number): void {
        this.audio.volume = v;
        try {
            localStorage.setItem('gc-volume', String(v));
        } catch {
            // не критично
        }
        this.set({ volume: v });
    }

    shuffle(): void {
        this.set({ shuffle: !this.state.shuffle });
    }

    repeat(): void {
        this.set({ repeat: this.state.repeat === 'off' ? 'all' : this.state.repeat === 'all' ? 'one' : 'off' });
    }

    jump(i: number): void {
        this.set({ index: i });
        this.load();
    }
}

export const player = new Player();

export function usePlayer(): State & { current: Track | null } {
    const [, tick] = useState(0);
    useEffect(() => player.subscribe(() => tick((n) => n + 1)), []);
    return { ...player.state, current: player.current };
}

export const mmss = (s: number): string => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
