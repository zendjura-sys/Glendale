import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { api } from './api';
import type { Track } from './types';

type Repeat = 'off' | 'all' | 'one';

interface PlayerState {
  queue: Track[];
  index: number;
  current: Track | null;
  playing: boolean;
  time: number;
  duration: number;
  volume: number;
  shuffle: boolean;
  repeat: Repeat;
  /** Plays `tracks` starting at `start`; calling it with the current track toggles pause. */
  play: (tracks: Track[], start?: number) => void;
  toggle: () => void;
  next: () => void;
  prev: () => void;
  seek: (seconds: number) => void;
  setVolume: (v: number) => void;
  setShuffle: (v: boolean) => void;
  setRepeat: (v: Repeat) => void;
  close: () => void;
  isCurrent: (id: number) => boolean;
}

const PlayerContext = createContext<PlayerState>(null!);

const load = <T,>(key: string, fallback: T): T => {
  try {
    const v = localStorage.getItem(key);
    return v == null ? fallback : (JSON.parse(v) as T);
  } catch {
    return fallback;
  }
};
const save = (key: string, v: unknown) => {
  try {
    localStorage.setItem(key, JSON.stringify(v));
  } catch {
    /* storage unavailable */
  }
};

/** One audio element for the whole app, so music keeps playing while you browse. */
export function PlayerProvider({ children }: { children: ReactNode }) {
  const audio = useRef<HTMLAudioElement | null>(null);
  if (!audio.current && typeof Audio !== 'undefined') audio.current = new Audio();
  const [queue, setQueue] = useState<Track[]>([]);
  const [index, setIndex] = useState(-1);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(() => load('player.volume', 0.8));
  const [shuffle, setShuffleState] = useState(() => load('player.shuffle', false));
  const [repeat, setRepeatState] = useState<Repeat>(() => load('player.repeat', 'off'));
  const current = index >= 0 ? queue[index] ?? null : null;
  const counted = useRef<number | null>(null);

  // Keep the latest values for event handlers bound once.
  const state = useRef({ queue, index, shuffle, repeat });
  state.current = { queue, index, shuffle, repeat };

  const startAt = useCallback((i: number) => {
    const el = audio.current!;
    const track = state.current.queue[i];
    if (!track) return;
    setIndex(i);
    el.src = track.url;
    el.currentTime = 0;
    el.play().catch(() => setPlaying(false));
    if (counted.current !== track.id) {
      counted.current = track.id;
      api(`/music/${track.id}/play`, { method: 'POST' }).catch(() => {});
    }
  }, []);

  const pickNext = useCallback((direction: 1 | -1, auto: boolean) => {
    const { queue: q, index: i, shuffle: sh, repeat: rep } = state.current;
    if (!q.length) return;
    if (auto && rep === 'one') return startAt(i);
    let n: number;
    if (sh && q.length > 1) {
      do n = Math.floor(Math.random() * q.length);
      while (n === i);
    } else n = i + direction;
    if (n >= q.length) {
      if (auto && rep === 'off') {
        setPlaying(false);
        return;
      }
      n = 0;
    }
    if (n < 0) n = q.length - 1;
    startAt(n);
  }, [startAt]);

  useEffect(() => {
    const el = audio.current!;
    el.volume = volume;
    const onTime = () => setTime(el.currentTime);
    const onMeta = () => setDuration(el.duration || 0);
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onEnded = () => pickNext(1, true);
    el.addEventListener('timeupdate', onTime);
    el.addEventListener('loadedmetadata', onMeta);
    el.addEventListener('play', onPlay);
    el.addEventListener('pause', onPause);
    el.addEventListener('ended', onEnded);
    return () => {
      el.removeEventListener('timeupdate', onTime);
      el.removeEventListener('loadedmetadata', onMeta);
      el.removeEventListener('play', onPlay);
      el.removeEventListener('pause', onPause);
      el.removeEventListener('ended', onEnded);
    };
  }, [pickNext]); // eslint-disable-line react-hooks/exhaustive-deps

  const play = useCallback(
    (tracks: Track[], start = 0) => {
      const el = audio.current!;
      const target = tracks[start];
      if (target && current?.id === target.id) {
        if (el.paused) el.play().catch(() => {});
        else el.pause();
        return;
      }
      state.current.queue = tracks;
      setQueue(tracks);
      startAt(start);
    },
    [current, startAt],
  );

  const toggle = useCallback(() => {
    const el = audio.current!;
    if (!current) return;
    if (el.paused) el.play().catch(() => {});
    else el.pause();
  }, [current]);

  const seek = useCallback((s: number) => {
    const el = audio.current!;
    el.currentTime = Math.max(0, Math.min(s, el.duration || s));
    setTime(el.currentTime);
  }, []);

  const setVolume = useCallback((v: number) => {
    audio.current!.volume = v;
    setVolumeState(v);
    save('player.volume', v);
  }, []);
  const setShuffle = useCallback((v: boolean) => {
    setShuffleState(v);
    save('player.shuffle', v);
  }, []);
  const setRepeat = useCallback((v: Repeat) => {
    setRepeatState(v);
    save('player.repeat', v);
  }, []);
  const close = useCallback(() => {
    audio.current!.pause();
    setQueue([]);
    setIndex(-1);
  }, []);
  const next = useCallback(() => pickNext(1, false), [pickNext]);
  const prev = useCallback(() => {
    // Like most players: "previous" restarts the track unless we are at its very beginning.
    if (audio.current!.currentTime > 3) seek(0);
    else pickNext(-1, false);
  }, [pickNext, seek]);

  // Lock-screen / headset controls.
  useEffect(() => {
    if (!('mediaSession' in navigator) || !current) return;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: current.title,
      artist: current.artist,
      album: current.album,
      artwork: current.cover ? [{ src: current.cover, sizes: '512x512' }] : [],
    });
    navigator.mediaSession.setActionHandler('play', toggle);
    navigator.mediaSession.setActionHandler('pause', toggle);
    navigator.mediaSession.setActionHandler('nexttrack', next);
    navigator.mediaSession.setActionHandler('previoustrack', prev);
  }, [current, toggle, next, prev]);

  const value = useMemo<PlayerState>(
    () => ({
      queue,
      index,
      current,
      playing,
      time,
      duration: duration || current?.duration || 0,
      volume,
      shuffle,
      repeat,
      play,
      toggle,
      next,
      prev,
      seek,
      setVolume,
      setShuffle,
      setRepeat,
      close,
      isCurrent: (id) => current?.id === id,
    }),
    [queue, index, current, playing, time, duration, volume, shuffle, repeat, play, toggle, next, prev, seek, setVolume, setShuffle, setRepeat, close],
  );

  return <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>;
}

export const usePlayer = () => useContext(PlayerContext);

export const formatDuration = (s: number) => {
  const sec = Math.max(0, Math.round(s));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const r = String(sec % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${r}` : `${m}:${r}`;
};
