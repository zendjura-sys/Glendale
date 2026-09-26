import { Link } from 'react-router-dom';
import { useInfiniteQuery } from '@tanstack/react-query';
import { Bell, Heart, MessageCircle, Repeat2, UserCheck, UserPlus, PenLine } from 'lucide-react';
import { api } from '../lib/api';
import { NOTIFICATION_TEXT } from '../lib/realtime';
import type { Notification, Page } from '../lib/types';
import { formatDate, fullName } from '../lib/utils';
import { Avatar, Empty, Spinner, useSentinel } from './ui';

const ICONS: Record<Notification['type'], { icon: typeof Heart; color: string }> = {
  like: { icon: Heart, color: '#ff3347' },
  comment: { icon: MessageCircle, color: '#2688eb' },
  repost: { icon: Repeat2, color: '#4bb34b' },
  wall_post: { icon: PenLine, color: '#ff9e2c' },
  friend_request: { icon: UserPlus, color: '#2688eb' },
  friend_accept: { icon: UserCheck, color: '#4bb34b' },
};

export function NotificationItem({ n, onClick }: { n: Notification; onClick?: () => void }) {
  const { icon: Icon, color } = ICONS[n.type];
  const link = n.post ? `/wall/${n.post.id}` : `/id/${n.actor.id}`;
  return (
    <Link to={link} className="row row-link" onClick={onClick} style={n.isRead ? undefined : { background: 'var(--hover)' }}>
      <div style={{ position: 'relative' }}>
        <Avatar src={n.actor.avatar} name={fullName(n.actor)} id={n.actor.id} size={44} />
        <span
          style={{
            position: 'absolute',
            right: -3,
            bottom: -3,
            width: 20,
            height: 20,
            borderRadius: '50%',
            background: color,
            display: 'grid',
            placeItems: 'center',
            boxShadow: '0 0 0 2px var(--card-solid)',
          }}
        >
          <Icon size={12} color="#fff" fill={n.type === 'like' ? '#fff' : 'none'} />
        </span>
      </div>
      <div className="info">
        <div>
          <span className="name">{fullName(n.actor)}</span> {NOTIFICATION_TEXT[n.type]}
        </div>
        {n.text && <div className="ellipsis" style={{ color: 'var(--text)' }}>«{n.text}»</div>}
        {!n.text && n.post?.text && <div className="ellipsis muted">{n.post.text}</div>}
        <div className="meta">{formatDate(n.createdAt)}</div>
      </div>
      {n.post?.image && <img src={n.post.image} alt="" style={{ width: 44, height: 44, objectFit: 'cover', borderRadius: 6 }} />}
    </Link>
  );
}

export function NotificationList({ onItemClick, compact }: { onItemClick?: () => void; compact?: boolean }) {
  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: ['notifications'],
    queryFn: ({ pageParam }) => api<Page<Notification>>(`/notifications${pageParam ? `?before=${pageParam}` : ''}`),
    initialPageParam: 0,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
  const sentinel = useSentinel(() => !isFetchingNextPage && fetchNextPage(), !compact && !!hasNextPage);
  const items = data?.pages.flatMap((p) => p.items) ?? [];
  if (isLoading) return <Spinner />;
  if (!items.length)
    return (
      <Empty icon={<Bell size={40} />} title="Нет уведомлений">
        Здесь будут лайки, комментарии и заявки в друзья
      </Empty>
    );
  return (
    <>
      {(compact ? items.slice(0, 6) : items).map((n) => (
        <NotificationItem key={n.id} n={n} onClick={onItemClick} />
      ))}
      {!compact && <div ref={sentinel} />}
      {isFetchingNextPage && <Spinner />}
    </>
  );
}
