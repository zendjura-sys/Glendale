import { tr } from '../lib/i18n';
import { useEffect, useState, type DragEvent } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Flame, Library, ListMusic, Music as MusicIcon, Pause, Play, Plus, Search, Shuffle, Trash2, Upload } from 'lucide-react';
import { api, form } from '../lib/api';
import { useMe } from '../lib/auth';
import { formatDuration, usePlayer } from '../lib/player';
import type { Playlist, Profile, Track } from '../lib/types';
import { countLabel, fullName } from '../lib/utils';
import { Empty, Modal, Spinner, pickFile } from '../components/ui';
import { TrackList } from '../components/Music';
import { SpotifyTab } from './Spotify';

type Tab = 'mine' | 'playlists' | 'popular' | 'search' | 'spotify';

function PlayAll({ tracks }: { tracks: Track[] }) {
  const player = usePlayer();
  const playingThis = tracks.some((t) => player.isCurrent(t.id)) && player.playing;
  if (!tracks.length) return null;
  return (
    <div style={{ display: 'flex', gap: 8 }}>
      <button className="btn" onClick={() => (playingThis ? player.toggle() : player.play(tracks, 0))}>
        {playingThis ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}
        {playingThis ? tr('Пауза') : tr('Слушать')}
      </button>
      <button
        className="btn secondary"
        onClick={() => {
          player.setShuffle(true);
          player.play(tracks, Math.floor(Math.random() * tracks.length));
        }}
      >
        <Shuffle size={16} /> {tr('Перемешать')}
      </button>
    </div>
  );
}

function Uploader({ onDone }: { onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const [over, setOver] = useState(false);
  const [error, setError] = useState('');
  const send = async (files: File[]) => {
    const audio = files.filter((f) => f.type.startsWith('audio/') || /\.(mp3|m4a|aac|ogg|oga|wav|flac|webm)$/i.test(f.name)).slice(0, 10);
    if (!audio.length) return setError(tr('Выберите аудиофайлы'));
    setBusy(true);
    setError('');
    try {
      const fd = form({});
      audio.forEach((f) => fd.append('audio', f));
      await api('/music', { body: fd });
      onDone();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const drop = (e: DragEvent) => {
    e.preventDefault();
    setOver(false);
    send(Array.from(e.dataTransfer.files));
  };
  return (
    <div
      className={`dropzone${over ? ' over' : ''}`}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={drop}
    >
      {busy ? (
        <Spinner small />
      ) : (
        <>
          {tr('Перетащите сюда MP3, M4A, OGG, WAV или FLAC — или')}{' '}
          <button className="more-link" onClick={async () => send(await pickFile('audio/*,.mp3,.m4a,.aac,.ogg,.wav,.flac', true))}>
            {tr('выберите файлы')}
          </button>
          {tr('. Название, исполнитель и обложка возьмутся из тегов.')}
        </>
      )}
      {error && <div className="error-text">{error}</div>}
    </div>
  );
}

function PlaylistArt({ p, size }: { p: Pick<Playlist, 'covers'>; size?: number }) {
  const covers = p.covers.slice(0, 4);
  return (
    <div className={`playlist-art${covers.length < 4 ? ' single' : ''}`} style={size ? { width: size, height: size, flexShrink: 0 } : undefined}>
      {covers.length >= 4 ? covers.map((c, i) => <img key={i} src={c} alt="" />) : covers[0] ? <img src={covers[0]} alt="" /> : <ListMusic size={size ? size / 3 : 42} />}
    </div>
  );
}

function Playlists({ userId, own }: { userId: number; own: boolean }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ['playlists', userId], queryFn: () => api<Playlist[]>(`/users/${userId}/playlists`) });
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState('');
  const create = async () => {
    const p = await api<Playlist>('/playlists', { body: { title } });
    qc.invalidateQueries({ queryKey: ['playlists'] });
    navigate(`/music/playlist/${p.id}`);
  };
  if (!data) return <Spinner />;
  return (
    <>
      <div className="playlist-grid">
        {own && (
          <button className="playlist-card" onClick={() => setCreating(true)}>
            <div className="playlist-art single" style={{ background: 'var(--field)', color: 'var(--accent)' }}>
              <Plus size={40} />
            </div>
            <b>{tr('Новый плейлист')}</b>
          </button>
        )}
        {data.map((p) => (
          <Link key={p.id} to={`/music/playlist/${p.id}`} className="playlist-card">
            <PlaylistArt p={p} />
            <b className="ellipsis">{p.title}</b>
            <span className="meta">{countLabel(p.count, 'трек|трека|треков')}</span>
          </Link>
        ))}
      </div>
      {!data.length && !own && <Empty icon={<ListMusic size={40} />} title={tr('Плейлистов пока нет')} />}
      {creating && (
        <Modal
          title={tr('Новый плейлист')}
          onClose={() => setCreating(false)}
          footer={
            <button className="btn" disabled={!title.trim()} onClick={create}>
              {tr('Создать')}
            </button>
          }
        >
          <div className="modal-body">
            <input className="field" autoFocus placeholder={tr('Название')} value={title} maxLength={100} onChange={(e) => setTitle(e.target.value)} />
          </div>
        </Modal>
      )}
    </>
  );
}

export function PlaylistPage() {
  const { id } = useParams();
  const me = useMe();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data: p, isLoading } = useQuery({ queryKey: ['playlist', Number(id)], queryFn: () => api<Playlist>(`/playlists/${id}`) });
  if (isLoading) return <Spinner />;
  if (!p)
    return (
      <div className="card">
        <Empty title={tr('Плейлист не найден')} />
      </div>
    );
  const own = p.owner.id === me.id;
  const tracks = p.tracks ?? [];
  const remove = async () => {
    if (!confirm(tr('Удалить плейлист «{title}»?', { title: p.title }))) return;
    await api(`/playlists/${p.id}`, { method: 'DELETE' });
    qc.invalidateQueries({ queryKey: ['playlists'] });
    navigate('/music?tab=playlists');
  };
  return (
    <div className="col-main">
      <div className="card">
        <div className="music-hero">
          <PlaylistArt p={p} size={120} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="meta">{tr('Плейлист')}</div>
            <h1 style={{ fontSize: 24, fontWeight: 700, margin: '2px 0 4px' }}>{p.title}</h1>
            {p.description && <div className="muted">{p.description}</div>}
            <div className="meta" style={{ margin: '4px 0 12px' }}>
              <Link to={`/id/${p.owner.id}`}>{fullName(p.owner)}</Link> · {countLabel(p.count, 'трек|трека|треков')} · {formatDuration(p.duration)}
            </div>
            <PlayAll tracks={tracks} />
          </div>
        </div>
        <TrackList
          tracks={tracks}
          empty={own ? tr('Добавляйте треки через меню «…» → «Добавить в плейлист»') : ''}
          onRemoved={() => qc.invalidateQueries({ queryKey: ['playlist', p.id] })}
        />
        <div className="toolbar" style={{ borderTop: '1px solid var(--separator)', borderBottom: 'none' }}>
          <Link to="/music?tab=playlists" className="btn tertiary">
            <ArrowLeft size={16} /> {tr('Все плейлисты')}
          </Link>
          {own && (
            <button className="btn danger" style={{ marginLeft: 'auto' }} onClick={remove}>
              <Trash2 size={16} /> {tr('Удалить плейлист')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function MusicPage() {
  const me = useMe();
  const qc = useQueryClient();
  const [params, setParams] = useSearchParams();
  const userId = Number(params.get('id')) || me.id;
  const own = userId === me.id;
  const tab = (params.get('tab') as Tab) || 'mine';
  const [input, setInput] = useState(params.get('q') ?? '');
  const q = params.get('q') ?? '';

  useEffect(() => {
    if (tab !== 'search' || input === q) return;
    const t = setTimeout(() => setParams({ tab: 'search', q: input }, { replace: true }), 300);
    return () => clearTimeout(t);
  }, [input]); // eslint-disable-line react-hooks/exhaustive-deps

  const { data: owner } = useQuery({ queryKey: ['user', userId], queryFn: () => api<Profile>(`/users/${userId}`), enabled: !own });
  const { data: mine } = useQuery({
    queryKey: ['music', 'mine', userId],
    queryFn: () => api<Track[]>(`/music?userId=${userId}`),
    enabled: tab === 'mine',
  });
  const { data: popular } = useQuery({ queryKey: ['music', 'popular'], queryFn: () => api<Track[]>('/music?section=popular'), enabled: tab === 'popular' });
  const { data: found, isFetching } = useQuery({
    queryKey: ['music', 'search', q],
    queryFn: () => api<Track[]>(`/music?q=${encodeURIComponent(q)}`),
    enabled: tab === 'search' && !!q.trim(),
  });

  const setTab = (t: Tab) => setParams(own ? { tab: t } : { id: String(userId), tab: t });
  const refresh = () => qc.invalidateQueries({ queryKey: ['music'] });
  const tabs: [Tab, string, React.ReactNode][] = [
    ['mine', own ? tr('Моя музыка') : tr('Музыка'), <Library size={16} key="l" />],
    ['playlists', tr('Плейлисты'), <ListMusic size={16} key="p" />],
    ...(own
      ? ([
          ['popular', tr('Популярное'), <Flame size={16} key="f" />],
          ['search', tr('Поиск'), <Search size={16} key="s" />],
          ['spotify', 'Spotify', <MusicIcon size={16} key="sp" />],
        ] as [Tab, string, React.ReactNode][])
      : []),
  ];

  return (
    <div className="col-main">
      <div className="card">
        {!own && owner && (
          <div className="card-title">
            <Link to={`/id/${userId}`}>{fullName(owner)}</Link>
            <span className="muted">{tr('› Музыка')}</span>
          </div>
        )}
        <div className="tabs">
          {tabs.map(([t, label, icon]) => (
            <button key={t} className={`tab${tab === t ? ' active' : ''}`} onClick={() => setTab(t)}>
              {icon} {label}
            </button>
          ))}
        </div>

        {tab === 'mine' && (
          <>
            {own && <div style={{ height: 12 }} />}
            {own && <Uploader onDone={refresh} />}
            {mine && mine.length > 0 && (
              <div className="toolbar" style={{ borderBottom: 'none', paddingBottom: 4 }}>
                <PlayAll tracks={mine} />
                <span className="meta" style={{ marginLeft: 'auto' }}>
                  {countLabel(mine.length, tr('трек|трека|треков'))}
                </span>
              </div>
            )}
            {!mine ? <Spinner /> : <TrackList tracks={mine} onRemoved={refresh} empty={own ? tr('Загрузите свои треки или добавьте из поиска') : ''} />}
          </>
        )}

        {tab === 'playlists' && <Playlists userId={userId} own={own} />}

        {tab === 'popular' && (!popular ? <Spinner /> : <TrackList tracks={popular} onRemoved={refresh} />)}

        {tab === 'search' && (
          <>
            <div style={{ padding: '14px 16px 6px', position: 'relative' }}>
              <Search size={16} style={{ position: 'absolute', left: 28, top: 26, color: 'var(--icon)' }} />
              <input className="field" autoFocus style={{ paddingLeft: 38 }} placeholder={tr('Исполнитель, трек или альбом')} value={input} onChange={(e) => setInput(e.target.value)} />
            </div>
            {!q.trim() ? (
              <Empty icon={<Upload size={36} />} title={tr('Найдите музыку')}>
                {tr('Ищите среди всех треков, загруженных участниками')}
              </Empty>
            ) : isFetching && !found ? (
              <Spinner />
            ) : (
              <TrackList tracks={found ?? []} onRemoved={refresh} empty={tr("Ничего не найдено")} />
            )}
          </>
        )}

        {tab === 'spotify' && <SpotifyTab />}
      </div>
    </div>
  );
}
