import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Flame, Newspaper, Sparkles, UserPlus } from 'lucide-react';
import { api } from '../lib/api';
import type { Group, UserShort } from '../lib/types';
import { countLabel, fullName } from '../lib/utils';
import { Composer } from '../components/Composer';
import { PostList } from '../components/Post';
import { Avatar } from '../components/ui';
import { FriendButton } from '../components/People';

export default function FeedPage() {
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') === 'popular' ? 'popular' : 'news';
  const key = ['posts', 'feed', tab];

  const { data: suggestions } = useQuery({
    queryKey: ['friends', 'suggestions'],
    queryFn: () => api<(UserShort & { mutual: number })[]>('/friends/suggestions'),
  });
  const { data: groups } = useQuery({ queryKey: ['groups', 'top'], queryFn: () => api<Group[]>('/groups') });

  return (
    <div className="columns">
      <div className="col-main">
        <Composer queryKeys={[key, ['posts', 'feed', 'popular']]} />
        <div className="card">
          <div className="tabs" style={{ borderBottom: 'none' }}>
            <button className={`tab${tab === 'news' ? ' active' : ''}`} onClick={() => setParams({})}>
              <Newspaper size={16} /> Новости
            </button>
            <button className={`tab${tab === 'popular' ? ' active' : ''}`} onClick={() => setParams({ tab: 'popular' })}>
              <Sparkles size={16} /> Рекомендации
            </button>
          </div>
        </div>
        <PostList
          key={tab}
          queryKey={key}
          path={`/feed?tab=${tab}`}
          emptyText="Добавьте друзей или вступите в сообщества, чтобы видеть их записи."
        />
      </div>
      <aside className="col-side">
        {!!suggestions?.length && (
          <div className="card">
            <div className="card-title">
              <UserPlus size={18} /> Возможные друзья
              <Link to="/friends?tab=suggestions" className="right">
                Все
              </Link>
            </div>
            {suggestions.slice(0, 4).map((u) => (
              <div className="row" key={u.id} style={{ padding: '8px 16px' }}>
                <Link to={`/id/${u.id}`}>
                  <Avatar src={u.avatar} name={fullName(u)} id={u.id} size={40} online={u.online} />
                </Link>
                <div className="info">
                  <Link to={`/id/${u.id}`} className="name ellipsis" style={{ display: 'block' }}>
                    {fullName(u)}
                  </Link>
                  <div className="meta">{u.mutual ? countLabel(u.mutual, 'общий друг', 'общих друга', 'общих друзей') : 'Рекомендация'}</div>
                </div>
                <FriendButton userId={u.id} initial="none" compact />
              </div>
            ))}
          </div>
        )}
        {!!groups?.length && (
          <div className="card">
            <div className="card-title">
              <Flame size={18} /> Популярные сообщества
              <Link to="/groups?tab=all" className="right">
                Все
              </Link>
            </div>
            {groups.slice(0, 4).map((g) => (
              <Link to={`/club/${g.id}`} className="row row-link" key={g.id} style={{ padding: '8px 16px' }}>
                <Avatar src={g.avatar} name={g.name} id={g.id + 100} square size={40} />
                <div className="info">
                  <div className="name ellipsis">{g.name}</div>
                  <div className="meta">{countLabel(g.membersCount, 'участник', 'участника', 'участников')}</div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </aside>
    </div>
  );
}
