import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useQueryClient } from '@tanstack/react-query';
import {
  Check,
  ChevronDown,
  Disc3,
  ImagePlus,
  ListMusic,
  Pause,
  Pencil,
  Play,
  Plus,
  Repeat,
  Repeat1,
  Shuffle,
  SkipBack,
  SkipForward,
  Trash2,
  Type,
  Volume1,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { api, form } from '../lib/api';
import { tr } from '../lib/i18n';
import { useMe } from '../lib/auth';
import { formatDuration, usePlayer } from '../lib/player';
import type { Track } from '../lib/types';
import { Modal, pickFile } from './ui';
import { TrackCover } from './Music';

/** Pushes edited metadata into every cached track list and into the player queue. */
export function useTrackUpdated() {
  const qc = useQueryClient();
  const player = usePlayer();
  return useCallback(
    (t: Track) => {
      const patch = (list: Track[] | undefined) => list?.map((x) => (x.id === t.id ? { ...x, ...t, added: x.added } : x));
      qc.setQueriesData<Track[]>({ queryKey: ['music'] }, patch);
      qc.setQueriesData<{ tracks?: Track[] }>({ queryKey: ['playlist'] }, (p) => (p?.tracks ? { ...p, tracks: patch(p.tracks) } : p));
      player.updateTrack(t);
    },
    [qc, player],
  );
}

/** Metadata editor for an uploaded track: title, artist, album, genre, year, number, lyrics and cover. */
export function TrackEditor({ track, onClose }: { track: Track; onClose: () => void }) {
  const updated = useTrackUpdated();
  const [t, setT] = useState(track);
  const [f, setF] = useState({
    title: track.title,
    artist: track.artist,
    album: track.album,
    genre: track.genre ?? '',
    year: track.year ? String(track.year) : '',
    trackNo: track.trackNo ? String(track.trackNo) : '',
    lyrics: track.lyrics ?? '',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF((v) => ({ ...v, [k]: e.target.value }));

  const apply = (fresh: Track) => {
    setT(fresh);
    updated(fresh);
  };
  const changeCover = async () => {
    const [file] = await pickFile();
    if (!file) return;
    setBusy(true);
    try {
      apply(await api<Track>(`/music/${t.id}/cover`, { body: form({ image: file }) }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const removeCover = async () => apply(await api<Track>(`/music/${t.id}/cover`, { method: 'DELETE' }));
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!f.title.trim()) return setError(tr('Укажите название'));
    setBusy(true);
    try {
      apply(
        await api<Track>(`/music/${t.id}`, {
          method: 'PATCH',
          body: { ...f, year: f.year ? Number(f.year) : null, trackNo: f.trackNo ? Number(f.trackNo) : null },
        }),
      );
      onClose();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };

  return (
    <Modal title={tr('Редактировать трек')} onClose={onClose} wide>
      <form className="modal-body track-editor" onSubmit={save}>
        <div className="track-editor-cover">
          <TrackCover track={t} size={148} />
          <div className="track-editor-cover-actions">
            <button type="button" className="btn secondary small" onClick={changeCover} disabled={busy}>
              <ImagePlus size={16} /> {t.cover ? tr('Изменить обложку') : tr('Добавить обложку')}
            </button>
            {t.cover && (
              <button type="button" className="btn secondary small" onClick={removeCover} disabled={busy}>
                <Trash2 size={16} /> {tr('Убрать обложку')}
              </button>
            )}
          </div>
        </div>
        <div className="track-editor-fields">
          <label className="form-label">
            {tr('Название')}
            <input className="field" value={f.title} onChange={set('title')} maxLength={200} required autoFocus />
          </label>
          <label className="form-label">
            {tr('Исполнитель')}
            <input className="field" value={f.artist} onChange={set('artist')} maxLength={200} />
          </label>
          <label className="form-label">
            {tr('Альбом')}
            <input className="field" value={f.album} onChange={set('album')} maxLength={200} />
          </label>
          <div className="track-editor-row">
            <label className="form-label">
              {tr('Жанр')}
              <input className="field" value={f.genre} onChange={set('genre')} maxLength={100} />
            </label>
            <label className="form-label">
              {tr('Год')}
              <input className="field" inputMode="numeric" value={f.year} onChange={set('year')} maxLength={4} />
            </label>
            <label className="form-label">
              {tr('№ трека')}
              <input className="field" inputMode="numeric" value={f.trackNo} onChange={set('trackNo')} maxLength={4} />
            </label>
          </div>
          <label className="form-label">
            {tr('Текст песни')}
            <textarea className="field" rows={6} value={f.lyrics} onChange={set('lyrics')} maxLength={20000} />
          </label>
          {error && <div className="error-text">{error}</div>}
          <div className="track-editor-actions">
            <button type="button" className="btn secondary" onClick={onClose}>
              {tr('Отмена')}
            </button>
            <button className="btn" disabled={busy}>
              <Check size={16} /> {tr('Сохранить')}
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
}

function Slider({ value, max, onChange, label }: { value: number; max: number; onChange: (v: number) => void; label: string }) {
  const pct = max ? Math.min(100, (value / max) * 100) : 0;
  return (
    <input
      className="fp-slider"
      type="range"
      min={0}
      max={max || 0}
      step={max > 2 ? 0.1 : 0.01}
      value={Math.min(value, max || 0)}
      onChange={(e) => onChange(Number(e.target.value))}
      aria-label={label}
      style={{ ['--pct' as string]: `${pct}%` }}
    />
  );
}

/** Full-screen player: big cover, seeking, all controls, queue and lyrics. */
export function FullPlayer() {
  const p = usePlayer();
  const me = useMe();
  const updated = useTrackUpdated();
  const [panel, setPanel] = useState<'queue' | 'lyrics'>('queue');
  const [editing, setEditing] = useState(false);
  const t = p.current;
  const { setExpanded, toggle, seek } = p;

  // Android "back" and Escape close the player instead of leaving the page.
  useEffect(() => {
    history.pushState({ fullPlayer: true }, '');
    const onPop = () => setExpanded(false);
    window.addEventListener('popstate', onPop);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('popstate', onPop);
      document.body.style.overflow = prev;
      if (history.state?.fullPlayer) history.back();
    };
  }, [setExpanded]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (editing || el.closest('input, textarea, select, [contenteditable]')) return;
      if (e.key === 'Escape') setExpanded(false);
      else if (e.key === ' ') {
        e.preventDefault();
        toggle();
      } else if (e.key === 'ArrowRight') seek(p.time + 5);
      else if (e.key === 'ArrowLeft') seek(p.time - 5);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [editing, setExpanded, toggle, seek, p.time]);

  if (!t) return null;
  const nextRepeat = p.repeat === 'off' ? 'all' : p.repeat === 'all' ? 'one' : 'off';
  const canEdit = t.ownerId === me.id;
  const toggleLibrary = async () => updated(await api<Track>(`/music/${t.id}/add`, { method: t.added ? 'DELETE' : 'POST' }));

  return createPortal(
    <div className="fullplayer" role="dialog" aria-label={tr('Плеер')}>
      <div className="fp-backdrop" aria-hidden>
        {t.cover && <img src={t.cover} alt="" />}
      </div>
      <header className="fp-head">
        <button className="icon-btn" onClick={() => setExpanded(false)} aria-label={tr('Свернуть')} title={tr('Свернуть')}>
          <ChevronDown size={24} />
        </button>
        <div className="fp-head-title">
          <span className="muted">{tr('Сейчас играет')}</span>
          <span className="ellipsis">{t.album || t.artist || tr('Моя музыка')}</span>
        </div>
        {canEdit ? (
          <button className="icon-btn" onClick={() => setEditing(true)} aria-label={tr('Редактировать трек')} title={tr('Редактировать трек')}>
            <Pencil size={20} />
          </button>
        ) : (
          <span style={{ width: 40 }} />
        )}
      </header>

      <div className="fp-body">
        <section className="fp-main">
          <div className="fp-cover">
            {t.cover ? <img src={t.cover} alt="" /> : <span className="fp-cover-empty" data-hue={t.id % 6}><Disc3 size={96} /></span>}
          </div>
          <div className="fp-meta">
            <div className="fp-titles">
              <h2 className="ellipsis">{t.title}</h2>
              <div className="muted ellipsis">
                {t.artist || tr('Неизвестный исполнитель')}
                {t.year ? ` · ${t.year}` : ''}
                {t.genre ? ` · ${t.genre}` : ''}
              </div>
            </div>
            <button
              className={`icon-btn${t.added ? ' on' : ''}`}
              onClick={toggleLibrary}
              aria-label={t.added ? tr('Убрать из моей музыки') : tr('Добавить в мою музыку')}
              title={t.added ? tr('В моей музыке') : tr('Добавить в мою музыку')}
            >
              {t.added ? <Check size={22} /> : <Plus size={22} />}
            </button>
          </div>
          <div className="fp-seek">
            <Slider value={p.time} max={p.duration} onChange={p.seek} label={tr('Перемотка')} />
            <div className="fp-times">
              <span>{formatDuration(p.time)}</span>
              <span>-{formatDuration(Math.max(0, p.duration - p.time))}</span>
            </div>
          </div>
          <div className="fp-controls">
            <button className={`icon-btn${p.shuffle ? ' on' : ''}`} onClick={() => p.setShuffle(!p.shuffle)} aria-label={tr('Перемешать')} title={tr('Перемешать')}>
              <Shuffle size={22} />
            </button>
            <button className="icon-btn fp-skip" onClick={p.prev} aria-label={tr('Предыдущий')}>
              <SkipBack size={30} fill="currentColor" />
            </button>
            <button className="fp-toggle" onClick={p.toggle} aria-label={p.playing ? tr('Пауза') : tr('Слушать')}>
              {p.playing ? <Pause size={32} fill="currentColor" /> : <Play size={32} fill="currentColor" style={{ marginLeft: 3 }} />}
            </button>
            <button className="icon-btn fp-skip" onClick={p.next} aria-label={tr('Следующий')}>
              <SkipForward size={30} fill="currentColor" />
            </button>
            <button
              className={`icon-btn${p.repeat !== 'off' ? ' on' : ''}`}
              onClick={() => p.setRepeat(nextRepeat)}
              aria-label={tr('Повтор')}
              title={p.repeat === 'one' ? tr('Повтор трека') : p.repeat === 'all' ? tr('Повтор списка') : tr('Без повтора')}
            >
              {p.repeat === 'one' ? <Repeat1 size={22} /> : <Repeat size={22} />}
            </button>
          </div>
          <div className="fp-volume">
            <button className="icon-btn" onClick={() => p.setVolume(p.volume ? 0 : 0.8)} aria-label={tr('Громкость')}>
              {p.volume === 0 ? <VolumeX size={18} /> : p.volume < 0.5 ? <Volume1 size={18} /> : <Volume2 size={18} />}
            </button>
            <Slider value={p.volume} max={1} onChange={p.setVolume} label={tr('Уровень громкости')} />
          </div>
        </section>

        <section className="fp-side card">
          <div className="fp-tabs" role="tablist">
            <button role="tab" aria-selected={panel === 'queue'} className={panel === 'queue' ? 'active' : ''} onClick={() => setPanel('queue')}>
              <ListMusic size={16} /> {tr('Очередь')} <span className="muted">{p.queue.length}</span>
            </button>
            <button role="tab" aria-selected={panel === 'lyrics'} className={panel === 'lyrics' ? 'active' : ''} onClick={() => setPanel('lyrics')}>
              <Type size={16} /> {tr('Текст песни')}
            </button>
          </div>
          {panel === 'queue' ? (
            <ol className="fp-queue">
              {p.queue.map((q, i) => (
                <li key={`${q.id}-${i}`}>
                  <button className={`fp-queue-item${i === p.index ? ' active' : ''}`} onClick={() => p.jump(i)}>
                    <TrackCover track={q} size={40} />
                    <span className="track-info">
                      <span className="track-title ellipsis">{q.title}</span>
                      <span className="track-artist ellipsis">{q.artist || tr('Неизвестный исполнитель')}</span>
                    </span>
                    <span className="track-time">{formatDuration(q.duration)}</span>
                  </button>
                </li>
              ))}
            </ol>
          ) : t.lyrics ? (
            <div className="fp-lyrics">{t.lyrics}</div>
          ) : (
            <div className="fp-lyrics-empty muted">
              {tr('Текста песни пока нет.')}
              {canEdit && (
                <button className="btn secondary small" onClick={() => setEditing(true)}>
                  <Pencil size={14} /> {tr('Добавить текст')}
                </button>
              )}
            </div>
          )}
        </section>
      </div>
      {editing && <TrackEditor track={t} onClose={() => setEditing(false)} />}
    </div>,
    document.body,
  );
}
