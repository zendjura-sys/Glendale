import { tr } from '../lib/i18n';
import { useCallback, useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Check,
  ListMusic,
  ListPlus,
  MoreHorizontal,
  Music,
  Pause,
  Play,
  Plus,
  Repeat,
  Repeat1,
  Shuffle,
  SkipBack,
  SkipForward,
  Trash2,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { api } from '../lib/api';
import { useMe } from '../lib/auth';
import { formatDuration, usePlayer } from '../lib/player';
import type { Playlist, SpotifyRef, Track } from '../lib/types';
import { Empty, Modal, Spinner, useClickOutside } from './ui';

export function TrackCover({ track, size = 40 }: { track: Pick<Track, 'cover' | 'id'>; size?: number }) {
  return track.cover ? (
    <img className="track-cover" src={track.cover} alt="" style={{ width: size, height: size }} loading="lazy" />
  ) : (
    <span className="track-cover placeholder" style={{ width: size, height: size }} data-hue={track.id % 6}>
      <Music size={size * 0.45} />
    </span>
  );
}

/** Adds/removes a track from tr("Моя музыка") everywhere it is cached. */
function useLibraryToggle() {
  const qc = useQueryClient();
  return useCallback(
    async (t: Track) => {
      const fresh = await api<Track>(`/music/${t.id}/add`, { method: t.added ? 'DELETE' : 'POST' });
      qc.setQueriesData<Track[]>({ queryKey: ['music'] }, (list) => list?.map((x) => (x.id === t.id ? { ...x, added: fresh.added } : x)));
      qc.invalidateQueries({ queryKey: ['music', 'mine'] });
      return fresh;
    },
    [qc],
  );
}

function PlaylistPicker({ track, onClose }: { track: Track; onClose: () => void }) {
  const me = useMe();
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ['playlists', me.id], queryFn: () => api<Playlist[]>(`/users/${me.id}/playlists`) });
  const [title, setTitle] = useState('');
  const [done, setDone] = useState<number | null>(null);
  const add = async (id: number) => {
    await api(`/playlists/${id}/tracks`, { body: { trackId: track.id } });
    qc.invalidateQueries({ queryKey: ['playlists'] });
    qc.invalidateQueries({ queryKey: ['playlist', id] });
    setDone(id);
    setTimeout(onClose, 500);
  };
  const create = async () => {
    const p = await api<Playlist>('/playlists', { body: { title } });
    await add(p.id);
  };
  return (
    <Modal title={tr('Добавить в плейлист')} onClose={onClose}>
      <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {!data && <Spinner />}
        {data?.map((p) => (
          <button key={p.id} className="menu-item" style={{ borderRadius: 12 }} onClick={() => add(p.id)}>
            <ListMusic size={18} /> {p.title} <span className="muted">· {p.count}</span>
            {done === p.id && <Check size={18} style={{ marginLeft: 'auto' }} />}
          </button>
        ))}
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <input className="field" placeholder={tr('Новый плейлист')} value={title} maxLength={100} onChange={(e) => setTitle(e.target.value)} />
          <button className="btn" disabled={!title.trim()} onClick={create}>
            <Plus size={16} /> {tr('Создать')}
          </button>
        </div>
      </div>
    </Modal>
  );
}

export function TrackRow({
  track,
  list,
  index,
  onRemoved,
  extraAction,
}: {
  track: Track;
  list: Track[];
  index: number;
  onRemoved?: (id: number) => void;
  extraAction?: { label: string; icon: React.ReactNode; run: () => void };
}) {
  const me = useMe();
  const player = usePlayer();
  const toggleLibrary = useLibraryToggle();
  const [added, setAdded] = useState(track.added);
  const [menu, setMenu] = useState(false);
  const [picker, setPicker] = useState(false);
  const close = useCallback(() => setMenu(false), []);
  const menuRef = useClickOutside<HTMLDivElement>(menu, close);
  const active = player.isCurrent(track.id);
  const playing = active && player.playing;

  const remove = async () => {
    setMenu(false);
    if (!confirm(tr('Удалить «{title}» навсегда?', { title: track.title }))) return;
    await api(`/music/${track.id}`, { method: 'DELETE' });
    onRemoved?.(track.id);
  };

  return (
    <div className={`track${active ? ' active' : ''}`} onDoubleClick={() => player.play(list, index)}>
      <button className="track-play" onClick={() => player.play(list, index)} aria-label={playing ? tr('Пауза') : tr('Слушать')}>
        <TrackCover track={track} />
        <span className="track-play-icon">{playing ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}</span>
        {playing && (
          <span className="eq" aria-hidden>
            <i />
            <i />
            <i />
          </span>
        )}
      </button>
      <div className="track-info">
        <div className="track-title ellipsis">{track.title}</div>
        <div className="track-artist ellipsis">{track.artist || tr('Неизвестный исполнитель')}</div>
      </div>
      <span className="track-time">{active ? formatDuration(player.time) : formatDuration(track.duration)}</span>
      {extraAction ? (
        <button className="icon-btn" onClick={extraAction.run} aria-label={extraAction.label} title={extraAction.label}>
          {extraAction.icon}
        </button>
      ) : (
        <button
          className={`icon-btn${added ? ' on' : ''}`}
          aria-label={added ? tr('Убрать из моей музыки') : tr('Добавить в мою музыку')}
          title={added ? tr('В моей музыке') : tr('Добавить в мою музыку')}
          onClick={async () => setAdded((await toggleLibrary({ ...track, added })).added)}
        >
          {added ? <Check size={18} /> : <Plus size={18} />}
        </button>
      )}
      <div style={{ position: 'relative' }} ref={menuRef}>
        <button className="icon-btn" onClick={() => setMenu((m) => !m)} aria-label={tr('Ещё')}>
          <MoreHorizontal size={18} />
        </button>
        {menu && (
          <div className="dropdown">
            <button
              className="menu-item"
              onClick={() => {
                setMenu(false);
                setPicker(true);
              }}
            >
              <ListPlus size={18} /> {tr('Добавить в плейлист')}
            </button>
            {track.ownerId === me.id && (
              <button className="menu-item danger" onClick={remove}>
                <Trash2 size={18} /> {tr('Удалить')}
              </button>
            )}
          </div>
        )}
      </div>
      {picker && <PlaylistPicker track={track} onClose={() => setPicker(false)} />}
    </div>
  );
}

export function TrackList({ tracks, onRemoved, empty }: { tracks: Track[]; onRemoved?: (id: number) => void; empty?: string }) {
  if (!tracks.length)
    return (
      <Empty icon={<Music size={40} />} title={tr('Нет аудиозаписей')}>
        {empty}
      </Empty>
    );
  return (
    <div className="track-list">
      {tracks.map((t, i) => (
        <TrackRow key={t.id} track={t} list={tracks} index={i} onRemoved={onRemoved} />
      ))}
    </div>
  );
}

/** Choose one of my tracks (to attach to a post or a message). */
export function TrackPicker({ onPick, onClose }: { onPick: (t: Track) => void; onClose: () => void }) {
  const { data } = useQuery({ queryKey: ['music', 'mine'], queryFn: () => api<Track[]>('/music') });
  const [q, setQ] = useState('');
  const list = (data ?? []).filter((t) => `${t.artist} ${t.title}`.toLowerCase().includes(q.trim().toLowerCase()));
  return (
    <Modal title={tr('Прикрепить аудиозапись')} onClose={onClose} wide>
      <div className="modal-body">
        <input className="field" placeholder={tr('Поиск в моей музыке')} value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
        <div style={{ maxHeight: '55vh', overflowY: 'auto', marginTop: 10 }}>
          {!data ? (
            <Spinner />
          ) : !list.length ? (
            <Empty icon={<Music size={36} />} title={tr('Ничего не найдено')}>
              {tr('Загрузите музыку в разделе «Музыка»')}
            </Empty>
          ) : (
            list.map((t, i) => (
              <TrackRow key={t.id} track={t} list={list} index={i} extraAction={{ label: tr('Прикрепить'), icon: <Plus size={18} />, run: () => onPick(t) }} />
            ))
          )}
        </div>
      </div>
    </Modal>
  );
}

const EMBED_HEIGHT: Record<SpotifyRef['type'], number> = { track: 152, episode: 152, album: 352, playlist: 352, show: 232, artist: 352 };

/** Official Spotify embed — plays previews (or full tracks when signed in to Spotify in the browser). */
export function SpotifyEmbed({ spotify }: { spotify: SpotifyRef }) {
  return (
    <iframe
      className="spotify-embed"
      title="Spotify"
      src={`https://open.spotify.com/embed/${spotify.type}/${spotify.id}?utm_source=glendale`}
      height={EMBED_HEIGHT[spotify.type]}
      loading="lazy"
      allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
    />
  );
}

/** Persistent mini player at the bottom of the screen. */
export function PlayerBar() {
  const p = usePlayer();
  const [volOpen, setVolOpen] = useState(false);
  const visible = !!p.current;
  useEffect(() => {
    document.body.classList.toggle('has-player', visible);
    return () => document.body.classList.remove('has-player');
  }, [visible]);
  if (!p.current) return null;
  const t = p.current;
  const pct = p.duration ? (p.time / p.duration) * 100 : 0;
  const nextRepeat = p.repeat === 'off' ? 'all' : p.repeat === 'all' ? 'one' : 'off';

  return (
    <div className="player-bar" role="region" aria-label={tr('Плеер')}>
      <div className="player-progress">
        <input
          type="range"
          min={0}
          max={p.duration || 0}
          step={0.1}
          value={p.time}
          onChange={(e) => p.seek(Number(e.target.value))}
          aria-label={tr('Перемотка')}
          style={{ ['--pct' as string]: `${pct}%` }}
        />
      </div>
      <div className="player-main">
        <TrackCover track={t} size={42} />
        <div className="track-info">
          <div className="track-title ellipsis">{t.title}</div>
          <div className="track-artist ellipsis">
            {t.artist || tr('Неизвестный исполнитель')} · {formatDuration(p.time)} / {formatDuration(p.duration)}
          </div>
        </div>
        <div className="player-controls">
          <button className={`icon-btn hide-mobile${p.shuffle ? ' on' : ''}`} onClick={() => p.setShuffle(!p.shuffle)} aria-label={tr('Перемешать')} title={tr('Перемешать')}>
            <Shuffle size={18} />
          </button>
          <button className="icon-btn" onClick={p.prev} aria-label={tr('Предыдущий')}>
            <SkipBack size={20} fill="currentColor" />
          </button>
          <button className="player-toggle" onClick={p.toggle} aria-label={p.playing ? tr('Пауза') : tr('Слушать')}>
            {p.playing ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" />}
          </button>
          <button className="icon-btn" onClick={p.next} aria-label={tr('Следующий')}>
            <SkipForward size={20} fill="currentColor" />
          </button>
          <button
            className={`icon-btn hide-mobile${p.repeat !== 'off' ? ' on' : ''}`}
            onClick={() => p.setRepeat(nextRepeat)}
            aria-label={tr('Повтор')}
            title={p.repeat === 'one' ? tr('Повтор трека') : p.repeat === 'all' ? tr('Повтор списка') : tr('Без повтора')}
          >
            {p.repeat === 'one' ? <Repeat1 size={18} /> : <Repeat size={18} />}
          </button>
          <div className="player-volume hide-mobile" onMouseLeave={() => setVolOpen(false)}>
            <button className="icon-btn" onClick={() => p.setVolume(p.volume ? 0 : 0.8)} onMouseEnter={() => setVolOpen(true)} aria-label={tr('Громкость')}>
              {p.volume ? <Volume2 size={18} /> : <VolumeX size={18} />}
            </button>
            {volOpen && (
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={p.volume}
                onChange={(e) => p.setVolume(Number(e.target.value))}
                aria-label={tr('Уровень громкости')}
                style={{ ['--pct' as string]: `${p.volume * 100}%` }}
              />
            )}
          </div>
          <button className="icon-btn" onClick={p.close} aria-label={tr('Закрыть плеер')}>
            <X size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
