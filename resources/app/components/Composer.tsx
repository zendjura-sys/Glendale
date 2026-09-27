import { tr } from '../lib/i18n';
import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Image as ImageIcon, Music, X } from 'lucide-react';
import { api, form } from '../lib/api';
import { useMe } from '../lib/auth';
import type { Post, Track } from '../lib/types';
import { fullName } from '../lib/utils';
import { prependPost } from './Post';
import { AutoTextarea, Avatar, pickFile } from './ui';
import { SendButton } from './uiverse';
import { TrackCover, TrackPicker } from './Music';

export function Composer({
  ownerType = 'user',
  ownerId,
  queryKeys,
  placeholder = tr('Что у вас нового?'),
}: {
  ownerType?: 'user' | 'group';
  ownerId?: number;
  queryKeys: unknown[][];
  placeholder?: string;
}) {
  const me = useMe();
  const qc = useQueryClient();
  const [text, setText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [audio, setAudio] = useState<Track | null>(null);
  const [picking, setPicking] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [focused, setFocused] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!file) return setPreview(null);
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const attach = async () => {
    const [f] = await pickFile();
    if (f) setFile(f);
  };

  const submit = async () => {
    if ((!text.trim() && !file && !audio) || busy) return;
    setBusy(true);
    setError('');
    try {
      const post = await api<Post>('/posts', {
        body: form({ text, image: file, audioId: audio ? String(audio.id) : undefined, ownerType, ownerId: ownerId ? String(ownerId) : undefined }),
      });
      for (const key of queryKeys) prependPost(qc, key, post);
      setText('');
      setFile(null);
      setAudio(null);
      setFocused(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const expanded = focused || !!text || !!file || !!audio;

  return (
    <div className="card composer">
      <div className="composer-row">
        <Avatar src={me.avatar} name={fullName(me)} id={me.id} size={36} />
        <AutoTextarea
          placeholder={placeholder}
          value={text}
          maxLength={10000}
          onFocus={() => setFocused(true)}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) submit();
          }}
        />
        {!expanded && (
          <button className="icon-btn" onClick={attach} aria-label={tr('Прикрепить фото')}>
            <ImageIcon size={22} />
          </button>
        )}
      </div>
      {preview && (
        <div className="attach-preview">
          <img src={preview} alt="" />
          <button onClick={() => setFile(null)} aria-label={tr('Убрать фото')}>
            <X size={14} />
          </button>
        </div>
      )}
      {audio && (
        <div className="attach-chip">
          <TrackCover track={audio} size={34} />
          <div className="track-info">
            <div className="track-title ellipsis">{audio.title}</div>
            <div className="track-artist ellipsis">{audio.artist}</div>
          </div>
          <button className="icon-btn" onClick={() => setAudio(null)} aria-label={tr('Убрать аудиозапись')}>
            <X size={16} />
          </button>
        </div>
      )}
      {error && <div className="error-text">{error}</div>}
      {picking && (
        <TrackPicker
          onClose={() => setPicking(false)}
          onPick={(t) => {
            setAudio(t);
            setPicking(false);
            setFocused(true);
          }}
        />
      )}
      {expanded && (
        <div className="composer-tools">
          <button className="icon-btn" onClick={attach} aria-label={tr('Прикрепить фото')}>
            <ImageIcon size={22} />
          </button>
          <button className="icon-btn" onClick={() => setPicking(true)} aria-label={tr('Прикрепить аудиозапись')}>
            <Music size={22} />
          </button>
          <div style={{ flex: 1 }} />
          <SendButton label={tr("Опубликовать")} onClick={submit} disabled={busy || (!text.trim() && !file && !audio)} />
        </div>
      )}
    </div>
  );
}
