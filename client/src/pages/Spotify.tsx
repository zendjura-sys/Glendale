import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Check,
  ExternalLink,
  Heart,
  ListMusic,
  ListPlus,
  LogOut,
  MonitorSpeaker,
  MoreHorizontal,
  Pause,
  Play,
  Plus,
  Repeat,
  Repeat1,
  Search,
  Share2,
  Shuffle,
  SkipBack,
  SkipForward,
  Volume2,
} from 'lucide-react';
import { api, ApiError } from '../lib/api';
import { useMe } from '../lib/auth';
import { useConfig } from '../lib/config';
import { msToTime, useSpotify, type SpotifyItem, type SpotifyPlayerState } from '../lib/spotify';
import { isAdminLevel } from '../lib/types';
import { Empty, Modal, Spinner, useClickOutside } from '../components/ui';
import { SpotifyEmbed } from '../components/Music';
import { Toggle } from '../admin/ui';

type View = { kind: 'home' | 'library' | 'playlists' | 'search' } | { kind: 'playlist' | 'album' | 'artist'; id: string };

function SpotifyLogo({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden fill="#1ed760">
      <path d="M12 0a12 12 0 1 0 0 24 12 12 0 0 0 0-24Zm5.5 17.3a.75.75 0 0 1-1 .25c-2.85-1.74-6.43-2.13-10.66-1.17a.75.75 0 1 1-.33-1.46c4.62-1.05 8.6-.6 11.74 1.33.36.22.47.69.25 1.05Zm1.47-3.26a.94.94 0 0 1-1.29.3c-3.26-2-8.23-2.59-12.09-1.42a.94.94 0 1 1-.54-1.8c4.4-1.33 9.88-.69 13.61 1.6.44.28.58.86.31 1.32Zm.13-3.4C15.2 8.32 8.78 8.1 5.07 9.23a1.13 1.13 0 1 1-.65-2.16c4.26-1.29 11.34-1.04 15.82 1.62a1.13 1.13 0 1 1-1.14 1.95Z" />
    </svg>
  );
}

/** Playback control that explains Premium / device problems instead of failing silently. */
function useSafe() {
  const [error, setError] = useState('');
  const run = useCallback(async (fn: () => Promise<unknown>) => {
    setError('');
    try {
      await fn();
    } catch (e) {
      setError((e as ApiError).message);
    }
  }, []);
  return { error, setError, run };
}

function ItemCover({ item, size = 44, round }: { item: Pick<SpotifyItem, 'image'>; size?: number; round?: boolean }) {
  return item.image ? (
    <img src={item.image} alt="" style={{ width: size, height: size, borderRadius: round ? '50%' : 10, objectFit: 'cover', flexShrink: 0 }} loading="lazy" />
  ) : (
    <span className="track-cover placeholder" style={{ width: size, height: size, borderRadius: round ? '50%' : 10 }}>
      <ListMusic size={size * 0.45} />
    </span>
  );
}

function PlaylistChooser({ track, onClose }: { track: SpotifyItem; onClose: () => void }) {
  const { data } = useQuery({ queryKey: ['spotify', 'playlists'], queryFn: () => api<SpotifyItem[]>('/spotify/playlists') });
  const [name, setName] = useState('');
  const [done, setDone] = useState('');
  const [error, setError] = useState('');
  const add = async (id: string) => {
    try {
      await api(`/spotify/playlists/${id}/tracks`, { body: { uris: [track.uri] } });
      setDone(id);
      setTimeout(onClose, 500);
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const create = async () => {
    const p = await api<SpotifyItem>('/spotify/playlists', { body: { name } });
    await add(p.id);
  };
  return (
    <Modal title="Добавить в плейлист Spotify" onClose={onClose}>
      <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {!data && <Spinner />}
        {data?.map((p) => (
          <button key={p.id} className="menu-item" style={{ borderRadius: 12 }} onClick={() => add(p.id)}>
            <ItemCover item={p} size={32} /> <span className="ellipsis">{p.name}</span>
            {done === p.id && <Check size={18} style={{ marginLeft: 'auto' }} />}
          </button>
        ))}
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <input className="field" placeholder="Новый плейлист" value={name} maxLength={100} onChange={(e) => setName(e.target.value)} />
          <button className="btn" disabled={!name.trim()} onClick={create}>
            <Plus size={16} /> Создать
          </button>
        </div>
        {error && <div className="error-text">{error}</div>}
      </div>
    </Modal>
  );
}

function ShareModal({ item, onClose }: { item: SpotifyItem; onClose: () => void }) {
  const qc = useQueryClient();
  const [text, setText] = useState('');
  const [done, setDone] = useState(false);
  const share = async () => {
    await api('/posts', { body: { text, spotify: item.url } });
    qc.invalidateQueries({ queryKey: ['posts'] });
    setDone(true);
  };
  return (
    <Modal
      title="Поделиться на стене"
      onClose={onClose}
      footer={
        done ? (
          <button className="btn" onClick={onClose}>
            Готово
          </button>
        ) : (
          <button className="btn" onClick={share}>
            Опубликовать
          </button>
        )
      }
    >
      <div className="modal-body">
        {done ? (
          'Запись опубликована на вашей стене.'
        ) : (
          <>
            <textarea className="field" placeholder="Комментарий (необязательно)" value={text} onChange={(e) => setText(e.target.value)} />
            <SpotifyEmbed spotify={{ type: item.type, id: item.id }} />
          </>
        )}
      </div>
    </Modal>
  );
}

function SpotifyRow({
  item,
  list,
  context,
  onOpen,
  saved,
  onSaved,
  premium,
}: {
  item: SpotifyItem;
  list?: SpotifyItem[];
  context?: string;
  onOpen: (v: View) => void;
  saved?: boolean;
  onSaved?: (id: string, v: boolean) => void;
  premium: boolean;
}) {
  const { playUris, command } = useSpotify();
  const { data: player } = useQuery<SpotifyPlayerState>({ queryKey: ['spotify', 'player'], enabled: false });
  const [menu, setMenu] = useState(false);
  const [modal, setModal] = useState<'playlist' | 'share' | 'preview' | null>(null);
  const [error, setError] = useState('');
  const close = useCallback(() => setMenu(false), []);
  const ref = useClickOutside<HTMLDivElement>(menu, close);
  const isTrack = item.type === 'track';
  const current = player?.item?.id === item.id;

  const play = async () => {
    setError('');
    if (!premium) return setModal('preview');
    try {
      if (!isTrack) await playUris({ contextUri: item.uri });
      else if (context) await playUris({ contextUri: context, offsetUri: item.uri });
      else await playUris({ uris: (list ?? [item]).filter((x) => x.type === 'track').map((x) => x.uri), offsetUri: item.uri });
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const open = () => {
    if (item.type === 'album' || item.type === 'playlist' || item.type === 'artist') onOpen({ kind: item.type, id: item.id });
  };

  return (
    <>
      <div className={`track${current ? ' active' : ''}`}>
        <button className="track-play" onClick={isTrack ? play : open} aria-label={isTrack ? 'Слушать' : 'Открыть'}>
          <ItemCover item={item} round={item.type === 'artist'} />
          <span className="track-play-icon">{isTrack ? <Play size={18} fill="currentColor" /> : <ArrowLeft size={18} style={{ transform: 'rotate(180deg)' }} />}</span>
        </button>
        <div className="track-info" onClick={isTrack ? undefined : open} style={isTrack ? undefined : { cursor: 'pointer' }}>
          <div className="track-title ellipsis">
            {item.name}
            {item.explicit && <span className="pill" style={{ marginLeft: 6, height: 16, fontSize: 10 }}>E</span>}
          </div>
          <div className="track-artist ellipsis">
            {item.type !== 'track' && <span style={{ textTransform: 'capitalize' }}>{TYPE_LABEL[item.type]} · </span>}
            {isTrack && item.artists?.length
              ? item.artists.map((a, i) => (
                  <span key={a.id}>
                    {i > 0 && ', '}
                    <button className="more-link" style={{ color: 'inherit' }} onClick={() => onOpen({ kind: 'artist', id: a.id })}>
                      {a.name}
                    </button>
                  </span>
                ))
              : item.subtitle}
          </div>
          {error && <div className="error-text" style={{ margin: '2px 0 0' }}>{error}</div>}
        </div>
        {item.durationMs != null && <span className="track-time">{msToTime(item.durationMs)}</span>}
        {isTrack && onSaved && (
          <button
            className={`icon-btn${saved ? ' on' : ''}`}
            aria-label={saved ? 'Убрать из медиатеки' : 'Сохранить в медиатеку'}
            onClick={async () => {
              const r = await api<{ saved: boolean }>(`/spotify/saved/${item.id}`, { method: saved ? 'DELETE' : 'PUT' });
              onSaved(item.id, r.saved);
            }}
          >
            <Heart size={18} fill={saved ? 'currentColor' : 'none'} />
          </button>
        )}
        <div style={{ position: 'relative' }} ref={ref}>
          <button className="icon-btn" onClick={() => setMenu((m) => !m)} aria-label="Ещё">
            <MoreHorizontal size={18} />
          </button>
          {menu && (
            <div className="dropdown">
              {isTrack && premium && (
                <button
                  className="menu-item"
                  onClick={async () => {
                    setMenu(false);
                    try {
                      await command('queue', { uri: item.uri });
                    } catch (e) {
                      setError((e as Error).message);
                    }
                  }}
                >
                  <ListMusic size={18} /> В очередь
                </button>
              )}
              {isTrack && (
                <button
                  className="menu-item"
                  onClick={() => {
                    setMenu(false);
                    setModal('playlist');
                  }}
                >
                  <ListPlus size={18} /> В плейлист Spotify
                </button>
              )}
              {isTrack && item.album && (
                <button
                  className="menu-item"
                  onClick={() => {
                    setMenu(false);
                    onOpen({ kind: 'album', id: item.album!.id });
                  }}
                >
                  <ListMusic size={18} /> Открыть альбом
                </button>
              )}
              <button
                className="menu-item"
                onClick={() => {
                  setMenu(false);
                  setModal('share');
                }}
              >
                <Share2 size={18} /> Поделиться на стене
              </button>
              <a className="menu-item" href={item.url} target="_blank" rel="noreferrer" onClick={() => setMenu(false)}>
                <ExternalLink size={18} /> Открыть в Spotify
              </a>
            </div>
          )}
        </div>
      </div>
      {modal === 'playlist' && <PlaylistChooser track={item} onClose={() => setModal(null)} />}
      {modal === 'share' && <ShareModal item={item} onClose={() => setModal(null)} />}
      {modal === 'preview' && (
        <Modal title={item.name} onClose={() => setModal(null)}>
          <div className="modal-body">
            <SpotifyEmbed spotify={{ type: item.type, id: item.id }} />
            <p className="meta" style={{ marginTop: 10 }}>
              Полное воспроизведение и управление доступны со Spotify Premium. Без Premium Spotify показывает превью или полный трек, если вы вошли в Spotify в этом браузере.
            </p>
          </div>
        </Modal>
      )}
    </>
  );
}

const TYPE_LABEL: Record<SpotifyItem['type'], string> = {
  track: 'Трек',
  album: 'Альбом',
  playlist: 'Плейлист',
  artist: 'Исполнитель',
  episode: 'Эпизод',
  show: 'Подкаст',
};

/** Keeps "saved" hearts in sync for a list of tracks. */
function useSaved(items: SpotifyItem[] | undefined) {
  const ids = (items ?? []).filter((i) => i.type === 'track').map((i) => i.id).slice(0, 50).join(',');
  const { data } = useQuery({
    queryKey: ['spotify', 'contains', ids],
    queryFn: () => api<Record<string, boolean>>(`/spotify/saved/contains?ids=${ids}`),
    enabled: !!ids,
  });
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});
  return {
    saved: (id: string) => overrides[id] ?? data?.[id] ?? false,
    onSaved: (id: string, v: boolean) => setOverrides((o) => ({ ...o, [id]: v })),
  };
}

function List({ items, context, onOpen, premium, empty }: { items: SpotifyItem[] | undefined; context?: string; onOpen: (v: View) => void; premium: boolean; empty?: string }) {
  const { saved, onSaved } = useSaved(items);
  if (!items) return <Spinner />;
  if (!items.length) return <Empty title={empty ?? 'Здесь пусто'} />;
  return (
    <div className="track-list">
      {items.map((it) => (
        <SpotifyRow key={`${it.type}:${it.id}`} item={it} list={items} context={context} onOpen={onOpen} saved={saved(it.id)} onSaved={onSaved} premium={premium} />
      ))}
    </div>
  );
}

/** Spotify Connect remote: what is playing on any of your devices, with full controls. */
function NowPlaying({ premium }: { premium: boolean }) {
  const { command, webDeviceId, deviceId, setDeviceId, sdkError } = useSpotify();
  const { data: p, error } = useQuery({
    queryKey: ['spotify', 'player'],
    queryFn: () => api<SpotifyPlayerState>('/spotify/player'),
    refetchInterval: 5000,
  });
  const { error: cmdError, run } = useSafe();
  const [progress, setProgress] = useState(0);
  const [devices, setDevices] = useState(false);
  const closeDevices = useCallback(() => setDevices(false), []);
  const devRef = useClickOutside<HTMLDivElement>(devices, closeDevices);
  const base = useRef({ at: Date.now(), ms: 0 });

  useEffect(() => {
    if (!p) return;
    base.current = { at: Date.now(), ms: p.progressMs };
    setProgress(p.progressMs);
    if (!p.isPlaying) return;
    const t = setInterval(() => setProgress(Math.min(base.current.ms + Date.now() - base.current.at, p.item?.durationMs ?? 0)), 500);
    return () => clearInterval(t);
  }, [p]);

  const allDevices = [
    ...(webDeviceId && !p?.devices.some((d) => d.id === webDeviceId) ? [{ id: webDeviceId, name: 'Этот браузер', type: 'Computer', active: false, volume: null }] : []),
    ...(p?.devices ?? []),
  ];

  if (error) return <div className="error-text" style={{ padding: '0 20px' }}>{(error as Error).message}</div>;
  const item = p?.item;
  const dur = item?.durationMs ?? 0;
  const pct = dur ? (progress / dur) * 100 : 0;

  return (
    <div className="spotify-now">
      {item ? (
        <>
          <ItemCover item={item} size={64} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="track-title ellipsis">{item.name}</div>
            <div className="track-artist ellipsis">{item.subtitle}</div>
            <div className="player-progress" style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="track-time">{msToTime(progress)}</span>
              <input
                type="range"
                min={0}
                max={dur}
                value={progress}
                disabled={!premium}
                onChange={(e) => setProgress(Number(e.target.value))}
                onMouseUp={(e) => run(() => command('seek', { positionMs: Number((e.target as HTMLInputElement).value) }))}
                onTouchEnd={(e) => run(() => command('seek', { positionMs: Number((e.target as HTMLInputElement).value) }))}
                style={{ ['--pct' as string]: `${pct}%`, borderRadius: 2 }}
                aria-label="Перемотка"
              />
              <span className="track-time">{msToTime(dur)}</span>
            </div>
          </div>
        </>
      ) : (
        <div style={{ flex: 1 }} className="muted">
          {premium ? 'Сейчас ничего не играет. Включите трек ниже или на любом устройстве.' : 'Сейчас ничего не играет.'}
        </div>
      )}
      {premium && (
        <div className="player-controls" style={{ flexWrap: 'wrap' }}>
          <button className={`icon-btn${p?.shuffle ? ' on' : ''}`} onClick={() => run(() => command('shuffle', { state: !p?.shuffle }))} aria-label="Перемешать">
            <Shuffle size={18} />
          </button>
          <button className="icon-btn" onClick={() => run(() => command('previous'))} aria-label="Предыдущий">
            <SkipBack size={20} fill="currentColor" />
          </button>
          <button className="player-toggle" onClick={() => run(() => command(p?.isPlaying ? 'pause' : 'play'))} aria-label={p?.isPlaying ? 'Пауза' : 'Слушать'}>
            {p?.isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" />}
          </button>
          <button className="icon-btn" onClick={() => run(() => command('next'))} aria-label="Следующий">
            <SkipForward size={20} fill="currentColor" />
          </button>
          <button
            className={`icon-btn${p?.repeat !== 'off' ? ' on' : ''}`}
            onClick={() => run(() => command('repeat', { state: p?.repeat === 'off' ? 'context' : p?.repeat === 'context' ? 'track' : 'off' }))}
            aria-label="Повтор"
          >
            {p?.repeat === 'track' ? <Repeat1 size={18} /> : <Repeat size={18} />}
          </button>
          {p?.volume != null && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }} className="player-progress">
              <Volume2 size={16} color="var(--icon)" />
              <input
                type="range"
                min={0}
                max={100}
                defaultValue={p.volume}
                key={p.device?.id}
                onMouseUp={(e) => run(() => command('volume', { volume: Number((e.target as HTMLInputElement).value) }))}
                style={{ width: 80, ['--pct' as string]: `${p.volume}%` }}
                aria-label="Громкость"
              />
            </span>
          )}
          <div style={{ position: 'relative' }} ref={devRef}>
            <button className="btn secondary" onClick={() => setDevices((d) => !d)}>
              <MonitorSpeaker size={16} /> {p?.device?.name ?? 'Устройство'}
            </button>
            {devices && (
              <div className="dropdown" style={{ minWidth: 240 }}>
                {!allDevices.length && <div className="menu-item muted">Откройте Spotify на телефоне или компьютере</div>}
                {allDevices.map((d) => (
                  <button
                    key={d.id}
                    className="menu-item"
                    onClick={() => {
                      setDevices(false);
                      setDeviceId(d.id);
                      run(() => command('transfer', { deviceId: d.id, play: !!p?.isPlaying }));
                    }}
                  >
                    <MonitorSpeaker size={18} /> {d.id === webDeviceId ? 'Этот браузер' : d.name}
                    {(d.active || d.id === deviceId) && <Check size={16} style={{ marginLeft: 'auto' }} />}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
      {(cmdError || sdkError) && <div className="error-text" style={{ width: '100%' }}>{cmdError || sdkError}</div>}
    </div>
  );
}

function DetailHeader({ item, extra, onBack, onPlay }: { item: SpotifyItem & { description?: string }; extra?: string; onBack: () => void; onPlay?: () => void }) {
  return (
    <div className="music-hero" style={{ paddingTop: 8 }}>
      <ItemCover item={item} size={110} round={item.type === 'artist'} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <button className="more-link" onClick={onBack} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <ArrowLeft size={14} /> Назад
        </button>
        <div className="meta">{TYPE_LABEL[item.type]}</div>
        <h2 style={{ fontSize: 22, fontWeight: 700, margin: '2px 0' }}>{item.name}</h2>
        {item.description && <div className="muted ellipsis">{item.description.replace(/<[^>]+>/g, '')}</div>}
        <div className="meta">{extra ?? item.subtitle}</div>
        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          {onPlay && (
            <button className="btn" onClick={onPlay}>
              <Play size={16} fill="currentColor" /> Слушать
            </button>
          )}
          <a className="btn secondary" href={item.url} target="_blank" rel="noreferrer">
            <SpotifyLogo size={16} /> Открыть в Spotify
          </a>
        </div>
      </div>
    </div>
  );
}

function Detail({ view, onOpen, onBack, premium }: { view: Extract<View, { id: string }>; onOpen: (v: View) => void; onBack: () => void; premium: boolean }) {
  const { playUris } = useSpotify();
  const { error, run } = useSafe();
  const { data } = useQuery({
    queryKey: ['spotify', view.kind, view.id],
    queryFn: () =>
      api<SpotifyItem & { description?: string; tracks?: SpotifyItem[]; topTracks?: SpotifyItem[]; albums?: SpotifyItem[]; followers?: number; genres?: string[]; releaseDate?: string }>(
        `/spotify/${view.kind}s/${view.id}`,
      ),
  });
  if (!data) return <Spinner />;
  const play = premium ? () => run(() => playUris({ contextUri: data.uri })) : undefined;
  return (
    <>
      <DetailHeader
        item={data}
        onBack={onBack}
        onPlay={play}
        extra={
          view.kind === 'artist'
            ? `${(data.followers ?? 0).toLocaleString('ru-RU')} подписчиков${data.genres?.length ? ` · ${data.genres.slice(0, 3).join(', ')}` : ''}`
            : view.kind === 'album'
              ? `${data.subtitle} · ${data.releaseDate?.slice(0, 4) ?? ''}`
              : undefined
        }
      />
      {error && <div className="error-text" style={{ padding: '0 20px' }}>{error}</div>}
      {view.kind === 'artist' ? (
        <>
          <div className="section-title">Популярные треки</div>
          <List items={data.topTracks} onOpen={onOpen} premium={premium} />
          <div className="section-title">Альбомы и синглы</div>
          <List items={data.albums} onOpen={onOpen} premium={premium} />
        </>
      ) : (
        <List items={data.tracks} context={data.uri} onOpen={onOpen} premium={premium} />
      )}
    </>
  );
}

export function SpotifyTab() {
  const me = useMe();
  const qc = useQueryClient();
  const { status } = useSpotify();
  const { config } = useConfig();
  const [view, setView] = useState<View>({ kind: 'home' });
  const [history, setHistory] = useState<View[]>([]);
  const [q, setQ] = useState('');
  const [debounced, setDebounced] = useState('');
  const [range, setRange] = useState<'short_term' | 'medium_term' | 'long_term'>('medium_term');
  const [error, setError] = useState('');
  const connected = !!status?.connected;
  const premium = status?.product === 'premium';

  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 350);
    return () => clearTimeout(t);
  }, [q]);

  const open = (v: View) => {
    setHistory((h) => [...h, view]);
    setView(v);
  };
  const back = () => {
    setView(history[history.length - 1] ?? { kind: 'home' });
    setHistory((h) => h.slice(0, -1));
  };
  const go = (kind: 'home' | 'library' | 'playlists' | 'search') => {
    setHistory([]);
    setView({ kind });
  };

  const home = view.kind === 'home' && connected;
  const { data: recent } = useQuery({ queryKey: ['spotify', 'recent'], queryFn: () => api<SpotifyItem[]>('/spotify/recent'), enabled: home });
  const { data: top } = useQuery({ queryKey: ['spotify', 'top', range], queryFn: () => api<SpotifyItem[]>(`/spotify/top?range=${range}`), enabled: home });
  const { data: artists } = useQuery({ queryKey: ['spotify', 'top-artists', range], queryFn: () => api<SpotifyItem[]>(`/spotify/top?kind=artists&range=${range}`), enabled: home });
  const { data: saved } = useQuery({
    queryKey: ['spotify', 'saved'],
    queryFn: () => api<{ items: SpotifyItem[]; total: number }>('/spotify/saved'),
    enabled: connected && view.kind === 'library',
  });
  const { data: playlists } = useQuery({ queryKey: ['spotify', 'playlists'], queryFn: () => api<SpotifyItem[]>('/spotify/playlists'), enabled: connected && view.kind === 'playlists' });
  const { data: results, isFetching } = useQuery({
    queryKey: ['spotify', 'search', debounced],
    queryFn: () => api<SpotifyItem[]>(`/spotify/search?q=${encodeURIComponent(debounced)}`),
    enabled: connected && view.kind === 'search' && !!debounced,
  });

  if (!config.spotifyEnabled || (status && !status.enabled))
    return (
      <Empty icon={<SpotifyLogo size={44} />} title="Spotify ещё не подключён к сети">
        {isAdminLevel(me.level.type) ? (
          <>
            Укажите Client ID приложения Spotify в <Link to="/admin/settings/integrations">админ-панели → Интеграции</Link>.
          </>
        ) : (
          'Администратор пока не включил интеграцию.'
        )}
      </Empty>
    );

  if (!status) return <Spinner />;

  if (!connected)
    return (
      <div className="empty">
        <SpotifyLogo size={48} />
        <h3>Подключите Spotify</h3>
        <p className="muted" style={{ maxWidth: 440, margin: '0 auto 14px' }}>
          Ваши плейлисты, медиатека и топ прямо здесь; управление воспроизведением на любом устройстве, плеер в браузере (Premium) и «Сейчас слушает» в профиле.
        </p>
        <button
          className="btn"
          style={{ background: '#1ed760', color: '#000' }}
          onClick={async () => {
            setError('');
            try {
              const r = await api<{ url: string }>('/spotify/connect', { body: { redirectUri: `${location.origin}/spotify/callback` } });
              location.href = r.url;
            } catch (e) {
              setError((e as Error).message);
            }
          }}
        >
          <SpotifyLogo size={16} /> Войти через Spotify
        </button>
        {error && <div className="error-text">{error}</div>}
      </div>
    );

  return (
    <>
      <div className="spotify-account">
        {status.profile?.avatar ? <img src={status.profile.avatar} alt="" /> : <SpotifyLogo size={32} />}
        <div style={{ flex: 1, minWidth: 0 }}>
          <b className="ellipsis">{status.profile?.displayName}</b>
          <div className="meta">
            <SpotifyLogo size={12} /> Spotify {premium ? 'Premium' : 'Free'}
          </div>
        </div>
        <label className="meta" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          «Сейчас слушает» в профиле
          <Toggle
            on={status.showNowPlaying}
            label="Показывать, что я слушаю"
            onChange={async (v) => {
              await api('/spotify', { method: 'PATCH', body: { showNowPlaying: v } });
              qc.invalidateQueries({ queryKey: ['spotify', 'status'] });
            }}
          />
        </label>
        <button
          className="icon-btn"
          title="Отключить Spotify"
          aria-label="Отключить Spotify"
          onClick={async () => {
            if (!confirm('Отключить Spotify?')) return;
            await api('/spotify', { method: 'DELETE' });
            qc.invalidateQueries({ queryKey: ['spotify'] });
          }}
        >
          <LogOut size={18} />
        </button>
      </div>

      <NowPlaying premium={premium} />

      <div className="tabs" style={{ borderTop: '1px solid var(--separator)' }}>
        {(
          [
            ['home', 'Главное'],
            ['library', 'Медиатека'],
            ['playlists', 'Плейлисты'],
            ['search', 'Поиск'],
          ] as const
        ).map(([k, label]) => (
          <button key={k} className={`tab${view.kind === k ? ' active' : ''}`} onClick={() => go(k)}>
            {label}
          </button>
        ))}
      </div>

      {'id' in view ? (
        <Detail view={view} onOpen={open} onBack={back} premium={premium} />
      ) : view.kind === 'home' ? (
        <>
          <div className="section-title">Недавно прослушанные</div>
          <List items={recent} onOpen={open} premium={premium} empty="Пока пусто" />
          <div className="toolbar" style={{ borderBottom: 'none', paddingBottom: 0 }}>
            <b>Ваш топ</b>
            <div className="segmented" style={{ marginLeft: 'auto' }}>
              {(
                [
                  ['short_term', '4 недели'],
                  ['medium_term', '6 месяцев'],
                  ['long_term', 'Всё время'],
                ] as const
              ).map(([r, label]) => (
                <button key={r} className={range === r ? 'on' : ''} onClick={() => setRange(r)}>
                  {label}
                </button>
              ))}
            </div>
          </div>
          {artists && artists.length > 0 && (
            <div className="spotify-artists">
              {artists.slice(0, 10).map((a) => (
                <button key={a.id} onClick={() => open({ kind: 'artist', id: a.id })}>
                  <ItemCover item={a} size={72} round />
                  <span className="ellipsis">{a.name}</span>
                </button>
              ))}
            </div>
          )}
          <List items={top} onOpen={open} premium={premium} empty="Слушайте больше — и здесь появится ваш топ" />
        </>
      ) : view.kind === 'library' ? (
        <>
          {saved && <div className="section-title">Любимые треки · {saved.total}</div>}
          <List items={saved?.items} onOpen={open} premium={premium} empty="В медиатеке пока нет треков" />
        </>
      ) : view.kind === 'playlists' ? (
        <List items={playlists} onOpen={open} premium={premium} empty="Плейлистов нет" />
      ) : (
        <>
          <div style={{ padding: '14px 16px 6px', position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: 28, top: 26, color: 'var(--icon)' }} />
            <input className="field" autoFocus style={{ paddingLeft: 38 }} placeholder="Треки, альбомы, плейлисты в Spotify" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          {!debounced ? null : isFetching && !results ? <Spinner /> : <List items={results} onOpen={open} premium={premium} empty="Ничего не найдено" />}
        </>
      )}
    </>
  );
}

/** Landing page for the OAuth redirect: finishes the connection and returns to the Spotify tab. */
export function SpotifyCallback() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [error, setError] = useState('');
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const p = new URLSearchParams(location.search);
    if (p.get('error')) {
      setError(p.get('error') === 'access_denied' ? 'Вы отменили подключение Spotify' : `Spotify: ${p.get('error')}`);
      return;
    }
    api('/spotify/callback', { body: { code: p.get('code'), state: p.get('state') } })
      .then(() => {
        qc.invalidateQueries({ queryKey: ['spotify'] });
        navigate('/music?tab=spotify', { replace: true });
      })
      .catch((e) => setError((e as Error).message));
  }, [navigate, qc]);
  return (
    <div className="card">
      {error ? (
        <Empty icon={<SpotifyLogo size={40} />} title="Не удалось подключить Spotify">
          {error}
          <div style={{ marginTop: 12 }}>
            <Link to="/music?tab=spotify" className="btn secondary">
              Вернуться
            </Link>
          </div>
        </Empty>
      ) : (
        <Spinner />
      )}
    </div>
  );
}

/** "Сейчас слушает" card on a profile. */
export function SpotifyNowPlayingCard({ userId }: { userId: number }) {
  const { data } = useQuery({
    queryKey: ['spotify', 'now', userId],
    queryFn: () => api<SpotifyItem | null>(`/users/${userId}/spotify-now`),
    refetchInterval: 30_000,
  });
  if (!data) return null;
  return (
    <a className="card spotify-now-card" href={data.url} target="_blank" rel="noreferrer">
      <ItemCover item={data} size={48} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="meta" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <SpotifyLogo size={13} /> Сейчас слушает
          <span className="eq inline" aria-hidden>
            <i />
            <i />
            <i />
          </span>
        </div>
        <div className="track-title ellipsis">{data.name}</div>
        <div className="track-artist ellipsis">{data.subtitle}</div>
      </div>
    </a>
  );
}
