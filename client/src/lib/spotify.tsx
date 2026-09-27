import { tr } from './i18n';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './api';
import { useConfig } from './config';

export interface SpotifyItem {
  type: 'track' | 'album' | 'playlist' | 'artist' | 'episode' | 'show';
  id: string;
  name: string;
  subtitle: string;
  image: string | null;
  url: string;
  uri: string;
  durationMs?: number;
  artists?: { id: string; name: string }[];
  album?: { id: string; name: string };
  explicit?: boolean;
}

export interface SpotifyStatus {
  enabled: boolean;
  connected: boolean;
  /** The catalog (search, albums, artists) works without a personal connection. */
  catalog?: boolean;
  profile: { spotifyId: string; displayName: string; avatar: string | null } | null;
  showNowPlaying: boolean;
  product: string | null;
}

export interface SpotifyPlayerState {
  isPlaying: boolean;
  progressMs: number;
  shuffle: boolean;
  repeat: 'off' | 'context' | 'track';
  volume: number | null;
  device: { id: string; name: string; type: string } | null;
  item: SpotifyItem | null;
  devices: { id: string; name: string; type: string; active: boolean; volume: number | null }[];
}

interface SpotifyCtx {
  status: SpotifyStatus | undefined;
  /** Device id of the in-browser Web Playback SDK player (Premium only), once ready. */
  webDeviceId: string | null;
  sdkError: string;
  command: (action: string, body?: Record<string, unknown>) => Promise<void>;
  /** Plays URIs / a context on the chosen device, falling back to this browser. */
  playUris: (opts: { uris?: string[]; contextUri?: string; offsetUri?: string }) => Promise<void>;
  deviceId: string | null;
  setDeviceId: (id: string | null) => void;
}

const Ctx = createContext<SpotifyCtx>(null!);

declare global {
  interface Window {
    onSpotifyWebPlaybackSDKReady?: () => void;
    Spotify?: {
      Player: new (opts: { name: string; getOAuthToken: (cb: (t: string) => void) => void; volume?: number }) => {
        connect: () => Promise<boolean>;
        disconnect: () => void;
        addListener: (event: string, cb: (payload: never) => void) => void;
      };
    };
  }
}

let sdkPromise: Promise<void> | null = null;
function loadSdk() {
  sdkPromise ??= new Promise<void>((resolve, reject) => {
    window.onSpotifyWebPlaybackSDKReady = () => resolve();
    const s = document.createElement('script');
    s.src = 'https://sdk.scdn.co/spotify-player.js';
    s.async = true;
    s.onerror = () => reject(new Error('sdk'));
    document.head.appendChild(s);
  });
  return sdkPromise;
}

export function SpotifyProvider({ children }: { children: ReactNode }) {
  const { config } = useConfig();
  const qc = useQueryClient();
  const { data: status } = useQuery({
    queryKey: ['spotify', 'status'],
    queryFn: () => api<SpotifyStatus>('/spotify'),
    enabled: config.spotifyEnabled,
    staleTime: 5 * 60_000,
  });
  const [webDeviceId, setWebDeviceId] = useState<string | null>(null);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [sdkError, setSdkError] = useState('');
  const player = useRef<{ disconnect: () => void } | null>(null);

  // Premium accounts get a real player inside the browser tab.
  useEffect(() => {
    if (!status?.connected || status.product !== 'premium') return;
    let cancelled = false;
    loadSdk()
      .then(() => {
        if (cancelled || !window.Spotify) return;
        const p = new window.Spotify.Player({
          name: `${config.siteTitle} Web`,
          volume: 0.8,
          getOAuthToken: (cb) => {
            api<{ accessToken: string }>('/spotify/token')
              .then((r) => cb(r.accessToken))
              .catch(() => {});
          },
        });
        p.addListener('ready', ({ device_id }: { device_id: string }) => {
          setWebDeviceId(device_id);
          setSdkError('');
        });
        p.addListener('not_ready', () => setWebDeviceId(null));
        p.addListener('initialization_error', ({ message }: { message: string }) => setSdkError(message));
        p.addListener('authentication_error', () => setSdkError(tr('Spotify: ошибка авторизации плеера')));
        p.addListener('account_error', () => setSdkError(tr('Воспроизведение в браузере требует Spotify Premium')));
        p.addListener('player_state_changed', () => qc.invalidateQueries({ queryKey: ['spotify', 'player'] }));
        p.connect();
        player.current = p;
      })
      .catch(() => setSdkError(tr('Не удалось загрузить плеер Spotify')));
    return () => {
      cancelled = true;
      player.current?.disconnect();
      player.current = null;
      setWebDeviceId(null);
    };
  }, [status?.connected, status?.product, config.siteTitle, qc]);

  const command = useCallback(
    async (action: string, body: Record<string, unknown> = {}) => {
      await api(`/spotify/player/${action}`, { body: { deviceId: deviceId ?? undefined, ...body } });
      setTimeout(() => qc.invalidateQueries({ queryKey: ['spotify', 'player'] }), 350);
    },
    [deviceId, qc],
  );

  const playUris = useCallback(
    async (opts: { uris?: string[]; contextUri?: string; offsetUri?: string }) => {
      const target = deviceId ?? webDeviceId ?? undefined;
      await api('/spotify/player/play', { body: { deviceId: target, ...opts } });
      setTimeout(() => qc.invalidateQueries({ queryKey: ['spotify', 'player'] }), 400);
    },
    [deviceId, webDeviceId, qc],
  );

  return <Ctx.Provider value={{ status, webDeviceId, sdkError, command, playUris, deviceId, setDeviceId }}>{children}</Ctx.Provider>;
}

export const useSpotify = () => useContext(Ctx);

export const msToTime = (ms = 0) => {
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};
