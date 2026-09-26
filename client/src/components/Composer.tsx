import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Image as ImageIcon, X } from 'lucide-react';
import { api, form } from '../lib/api';
import { useMe } from '../lib/auth';
import type { Post } from '../lib/types';
import { fullName } from '../lib/utils';
import { prependPost } from './Post';
import { AutoTextarea, Avatar, pickFile } from './ui';

export function Composer({
  ownerType = 'user',
  ownerId,
  queryKeys,
  placeholder = 'Что у вас нового?',
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
    if ((!text.trim() && !file) || busy) return;
    setBusy(true);
    setError('');
    try {
      const post = await api<Post>('/posts', {
        body: form({ text, image: file, ownerType, ownerId: ownerId ? String(ownerId) : undefined }),
      });
      for (const key of queryKeys) prependPost(qc, key, post);
      setText('');
      setFile(null);
      setFocused(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const expanded = focused || !!text || !!file;

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
          <button className="icon-btn" onClick={attach} aria-label="Прикрепить фото">
            <ImageIcon size={22} />
          </button>
        )}
      </div>
      {preview && (
        <div className="attach-preview">
          <img src={preview} alt="" />
          <button onClick={() => setFile(null)} aria-label="Убрать фото">
            <X size={14} />
          </button>
        </div>
      )}
      {error && <div className="error-text">{error}</div>}
      {expanded && (
        <div className="composer-tools">
          <button className="icon-btn" onClick={attach} aria-label="Прикрепить фото">
            <ImageIcon size={22} />
          </button>
          <div style={{ flex: 1 }} />
          <button className="btn" onClick={submit} disabled={busy || (!text.trim() && !file)}>
            Опубликовать
          </button>
        </div>
      )}
    </div>
  );
}
