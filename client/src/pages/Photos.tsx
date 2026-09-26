import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { Image as ImageIcon, Trash2, Upload } from 'lucide-react';
import { api, form } from '../lib/api';
import { useMe } from '../lib/auth';
import type { Page, Photo, Profile } from '../lib/types';
import { fullName } from '../lib/utils';
import { Empty, PhotoViewer, Spinner, pickFile, useSentinel } from '../components/ui';

export default function PhotosPage() {
  const { id } = useParams();
  const userId = Number(id);
  const me = useMe();
  const own = userId === me.id;
  const qc = useQueryClient();
  const [viewer, setViewer] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);

  const { data: owner } = useQuery({ queryKey: ['user', userId], queryFn: () => api<Profile>(`/users/${userId}`) });
  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: ['photos', userId],
    queryFn: ({ pageParam }) => api<Page<Photo>>(`/users/${userId}/photos${pageParam ? `?before=${pageParam}` : ''}`),
    initialPageParam: 0,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
  const sentinel = useSentinel(() => !isFetchingNextPage && fetchNextPage(), !!hasNextPage);
  const photos = data?.pages.flatMap((p) => p.items) ?? [];

  const upload = async () => {
    const files = await pickFile(undefined, true);
    if (!files.length) return;
    setUploading(true);
    try {
      const fd = form({});
      files.slice(0, 10).forEach((f) => fd.append('images', f));
      await api('/photos', { body: fd });
      qc.invalidateQueries({ queryKey: ['photos', userId] });
      qc.invalidateQueries({ queryKey: ['user', userId] });
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setUploading(false);
    }
  };

  const remove = async (p: Photo) => {
    if (!confirm('Удалить фотографию?')) return;
    await api(`/photos/${p.id}`, { method: 'DELETE' });
    qc.invalidateQueries({ queryKey: ['photos', userId] });
    qc.invalidateQueries({ queryKey: ['user', userId] });
  };

  return (
    <div className="col-main">
      <div className="card">
        <div className="card-title" style={{ paddingBottom: 14 }}>
          {own ? (
            'Мои фотографии'
          ) : (
            <>
              <Link to={`/id/${userId}`}>{owner ? fullName(owner) : '...'}</Link>
              <span className="muted">› Фотографии</span>
            </>
          )}
          {own && (
            <button className="btn right" onClick={upload} disabled={uploading}>
              {uploading ? <Spinner small /> : <Upload size={16} />} Загрузить фото
            </button>
          )}
        </div>
        {isLoading && <Spinner />}
        {!isLoading && !photos.length && (
          <Empty icon={<ImageIcon size={48} />} title="Нет фотографий">
            {own ? 'Загрузите первые фотографии' : 'Пользователь ещё не добавил фотографии'}
          </Empty>
        )}
        <div className="photo-grid">
          {photos.map((p, i) => (
            <div key={p.id} style={{ position: 'relative' }}>
              <button className="photo-tile" style={{ width: '100%' }} onClick={() => setViewer(i)}>
                <img src={p.url} alt="" loading="lazy" decoding="async" />
              </button>
              {own && (
                <button
                  className="icon-btn"
                  style={{ position: 'absolute', top: 4, right: 4, background: 'rgba(0,0,0,.5)', color: '#fff' }}
                  onClick={() => remove(p)}
                  aria-label="Удалить фото"
                >
                  <Trash2 size={16} />
                </button>
              )}
            </div>
          ))}
        </div>
        <div ref={sentinel} />
        {isFetchingNextPage && <Spinner />}
      </div>
      {viewer != null && <PhotoViewer urls={photos.map((p) => p.url)} index={viewer} onClose={() => setViewer(null)} />}
    </div>
  );
}
