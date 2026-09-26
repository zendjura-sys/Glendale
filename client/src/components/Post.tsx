import { memo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useInfiniteQuery, useQuery, useQueryClient, type InfiniteData, type QueryClient } from '@tanstack/react-query';
import { Heart, MessageCircle, MoreHorizontal, Newspaper, Repeat2, Send, Share2, Trash2 } from 'lucide-react';
import { api } from '../lib/api';
import { useMe } from '../lib/auth';
import type { Comment, Page, Post } from '../lib/types';
import { formatDate, fullName } from '../lib/utils';
import { AutoTextarea, Avatar, Empty, Modal, PhotoViewer, PostSkeleton, Spinner, useClickOutside, useSentinel } from './ui';

type PostPages = InfiniteData<Page<Post>, number | undefined>;

/** Applies `fn` to a post (and reposts of it) in every cached list. */
export function updatePostEverywhere(qc: QueryClient, id: number, fn: (p: Post) => Post) {
  const patch = (p: Post): Post => {
    let next = p.id === id ? fn(p) : p;
    if (next.repost && next.repost.id === id) next = { ...next, repost: fn(next.repost) };
    return next;
  };
  qc.setQueriesData<PostPages>({ queryKey: ['posts'] }, (data) =>
    data ? { ...data, pages: data.pages.map((pg) => ({ ...pg, items: pg.items.map(patch) })) } : data,
  );
  qc.setQueriesData<Post>({ queryKey: ['post'] }, (p) => (p ? patch(p) : p));
}

export function removePostEverywhere(qc: QueryClient, id: number) {
  qc.setQueriesData<PostPages>({ queryKey: ['posts'] }, (data) =>
    data ? { ...data, pages: data.pages.map((pg) => ({ ...pg, items: pg.items.filter((p) => p.id !== id) })) } : data,
  );
}

export function prependPost(qc: QueryClient, key: unknown[], post: Post) {
  qc.setQueryData<PostPages>(key, (data) =>
    data && data.pages.length
      ? { ...data, pages: [{ ...data.pages[0], items: [post, ...data.pages[0].items] }, ...data.pages.slice(1)] }
      : data,
  );
}

function PostHeader({ post }: { post: Post }) {
  const asGroup = post.fromGroup && post.group;
  const link = asGroup ? `/club/${post.group!.id}` : `/id/${post.author.id}`;
  const name = asGroup ? post.group!.name : fullName(post.author);
  return (
    <>
      <Link to={link}>
        <Avatar src={asGroup ? post.group!.avatar : post.author.avatar} name={name} id={asGroup ? post.group!.id + 100 : post.author.id} size={40} square={!!asGroup} />
      </Link>
      <div className="who">
        <div className="ellipsis">
          <Link to={link} className="name">
            {name}
          </Link>
          {post.wallOwner && (
            <span className="muted">
              {' '}▸{' '}
              <Link to={`/id/${post.wallOwner.id}`} className="name">
                {fullName(post.wallOwner)}
              </Link>
            </span>
          )}
        </div>
        <div className="meta">
          <Link to={`/wall/${post.id}`}>{formatDate(post.createdAt)}</Link>
          {!asGroup && post.group && (
            <>
              {' · '}
              <Link to={`/club/${post.group.id}`}>{post.group.name}</Link>
            </>
          )}
        </div>
      </div>
    </>
  );
}

function PostBody({ post, big }: { post: Post; big?: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const [viewer, setViewer] = useState(false);
  const long = post.text.length > 500 && !expanded;
  return (
    <>
      {post.text && (
        <div className={`post-text${big && post.text.length < 120 && !post.image ? ' big' : ''}`}>
          {long ? post.text.slice(0, 400).trimEnd() + '… ' : post.text}
          {long && (
            <button className="more-link" onClick={() => setExpanded(true)}>
              Показать полностью
            </button>
          )}
        </div>
      )}
      {post.image && (
        <div className="post-image" onClick={() => setViewer(true)}>
          <img src={post.image} alt="" loading="lazy" decoding="async" />
        </div>
      )}
      {viewer && post.image && <PhotoViewer urls={[post.image]} index={0} onClose={() => setViewer(false)} />}
    </>
  );
}

function Comments({ postId, onCountChange }: { postId: number; onCountChange: (delta: number) => void }) {
  const me = useMe();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['comments', postId], queryFn: () => api<Comment[]>(`/posts/${postId}/comments`) });
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);

  const submit = async () => {
    const value = text.trim();
    if (!value || sending) return;
    setSending(true);
    try {
      const c = await api<Comment>(`/posts/${postId}/comments`, { body: { text: value } });
      qc.setQueryData<Comment[]>(['comments', postId], (old) => [...(old ?? []), c]);
      onCountChange(1);
      setText('');
    } finally {
      setSending(false);
    }
  };

  const remove = async (id: number) => {
    await api(`/comments/${id}`, { method: 'DELETE' });
    qc.setQueryData<Comment[]>(['comments', postId], (old) => old?.filter((c) => c.id !== id));
    onCountChange(-1);
  };

  return (
    <div className="comments">
      {isLoading && <Spinner />}
      {data?.map((c) => (
        <div className="comment" key={c.id}>
          <Link to={`/id/${c.author.id}`}>
            <Avatar src={c.author.avatar} name={fullName(c.author)} id={c.author.id} size={32} />
          </Link>
          <div className="comment-body">
            <Link to={`/id/${c.author.id}`} className="name">
              {fullName(c.author)}
            </Link>
            <div className="comment-text">{c.text}</div>
            <div className="meta">{formatDate(c.createdAt)}</div>
          </div>
          {c.author.id === me.id && (
            <button className="icon-btn del" onClick={() => remove(c.id)} aria-label="Удалить комментарий">
              <Trash2 size={16} />
            </button>
          )}
        </div>
      ))}
      <div className="comment-form">
        <Avatar src={me.avatar} name={fullName(me)} id={me.id} size={32} />
        <AutoTextarea
          className="autogrow"
          placeholder="Написать комментарий..."
          value={text}
          maxLength={4000}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
        />
        <button className="icon-btn" onClick={submit} disabled={!text.trim() || sending} aria-label="Отправить">
          <Send size={20} color="var(--icon-accent)" />
        </button>
      </div>
    </div>
  );
}

function RepostModal({ post, onClose }: { post: Post; onClose: () => void }) {
  const qc = useQueryClient();
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    try {
      await api(`/posts/${post.id}/repost`, { body: { text } });
      updatePostEverywhere(qc, post.id, (p) => ({ ...p, reposts: p.reposts + 1, reposted: true }));
      qc.invalidateQueries({ queryKey: ['posts'] });
      onClose();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };
  return (
    <Modal
      title="Поделиться записью"
      onClose={onClose}
      footer={
        <>
          <button className="btn secondary" onClick={onClose}>
            Отмена
          </button>
          <button className="btn" onClick={submit} disabled={busy}>
            Поделиться
          </button>
        </>
      }
    >
      <div className="modal-body">
        <div className="muted" style={{ marginBottom: 8 }}>
          Запись появится на вашей странице и в новостях у друзей
        </div>
        <textarea className="field" placeholder="Ваш комментарий" value={text} onChange={(e) => setText(e.target.value)} maxLength={2000} />
        <div className="repost" style={{ marginTop: 12 }}>
          <div className="post-head">
            <PostHeader post={post} />
          </div>
          <div className="post-text">{post.text.slice(0, 200)}</div>
        </div>
        {error && <div className="error-text">{error}</div>}
      </div>
    </Modal>
  );
}

export const PostCard = memo(function PostCard({ post, openComments = false }: { post: Post; openComments?: boolean }) {
  const qc = useQueryClient();
  const [showComments, setShowComments] = useState(openComments);
  const [menu, setMenu] = useState(false);
  const [repostOpen, setRepostOpen] = useState(false);
  const [pop, setPop] = useState(false);
  const menuRef = useClickOutside<HTMLDivElement>(menu, () => setMenu(false));

  const toggleLike = async () => {
    const liked = !post.liked;
    setPop(liked);
    updatePostEverywhere(qc, post.id, (p) => ({ ...p, liked, likes: p.likes + (liked ? 1 : -1) }));
    try {
      const fresh = await api<Post>(`/posts/${post.id}/like`, { method: liked ? 'POST' : 'DELETE' });
      updatePostEverywhere(qc, post.id, (p) => ({ ...p, liked: fresh.liked, likes: fresh.likes }));
    } catch {
      updatePostEverywhere(qc, post.id, (p) => ({ ...p, liked: !liked, likes: p.likes + (liked ? -1 : 1) }));
    }
  };

  const remove = async () => {
    setMenu(false);
    if (!confirm('Удалить запись?')) return;
    await api(`/posts/${post.id}`, { method: 'DELETE' });
    removePostEverywhere(qc, post.id);
  };

  const copyLink = () => {
    setMenu(false);
    navigator.clipboard?.writeText(`${location.origin}/wall/${post.id}`);
  };

  const source = post.repost;

  return (
    <article className="card post">
      <div className="post-head">
        <PostHeader post={post} />
        <div style={{ position: 'relative' }} ref={menuRef}>
          <button className="icon-btn" onClick={() => setMenu((m) => !m)} aria-label="Действия">
            <MoreHorizontal size={20} />
          </button>
          {menu && (
            <div className="dropdown">
              <button className="menu-item" onClick={copyLink}>
                <Share2 size={18} /> Скопировать ссылку
              </button>
              {post.canDelete && (
                <button className="menu-item danger" onClick={remove}>
                  <Trash2 size={18} /> Удалить запись
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <PostBody post={post} big />

      {source && (
        <div className="repost">
          <div className="post-head">
            <PostHeader post={source} />
          </div>
          <PostBody post={source} />
        </div>
      )}

      <div className="post-actions">
        <button className={`action${post.liked ? ' liked' : ''}${pop ? ' like-pop' : ''}`} onClick={toggleLike} aria-label="Нравится">
          <Heart size={20} />
          {post.likes > 0 && post.likes}
        </button>
        <button className={`action${showComments ? ' on' : ''}`} onClick={() => setShowComments((s) => !s)} aria-label="Комментарии">
          <MessageCircle size={20} />
          {post.comments > 0 && post.comments}
        </button>
        <button
          className={`action${post.reposted || source?.reposted ? ' on' : ''}`}
          onClick={() => setRepostOpen(true)}
          aria-label="Поделиться"
        >
          <Repeat2 size={20} />
          {post.reposts > 0 && post.reposts}
        </button>
      </div>

      {showComments && (
        <Comments
          postId={post.id}
          onCountChange={(d) => updatePostEverywhere(qc, post.id, (p) => ({ ...p, comments: p.comments + d }))}
        />
      )}
      {repostOpen && <RepostModal post={source ?? post} onClose={() => setRepostOpen(false)} />}
    </article>
  );
});

/** Infinite, auto-loading list of posts. */
export function PostList({ queryKey, path, emptyText }: { queryKey: unknown[]; path: string; emptyText: string }) {
  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey,
    queryFn: ({ pageParam }) => api<Page<Post>>(`${path}${path.includes('?') ? '&' : '?'}${pageParam ? `before=${pageParam}` : ''}`),
    initialPageParam: undefined as number | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
  const sentinel = useSentinel(() => hasNextPage && !isFetchingNextPage && fetchNextPage(), !!hasNextPage);
  const posts = data?.pages.flatMap((p) => p.items) ?? [];

  if (isLoading)
    return (
      <>
        <PostSkeleton />
        <PostSkeleton />
      </>
    );
  if (!posts.length)
    return (
      <div className="card">
        <Empty icon={<Newspaper size={48} />} title="Здесь пока пусто">
          {emptyText}
        </Empty>
      </div>
    );
  return (
    <>
      {posts.map((p) => (
        <PostCard key={p.id} post={p} />
      ))}
      <div ref={sentinel} />
      {isFetchingNextPage && <Spinner />}
    </>
  );
}
