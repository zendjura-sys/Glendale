import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Search, UserMinus, Users } from 'lucide-react';
import { api } from '../lib/api';
import { useMe } from '../lib/auth';
import { useRealtime } from '../lib/realtime';
import type { Profile, UserShort } from '../lib/types';
import { countLabel, fullName, lastSeenText } from '../lib/utils';
import { Empty, Spinner } from '../components/ui';
import { FriendButton, UserRow } from '../components/People';

type Tab = 'all' | 'online' | 'requests' | 'suggestions';

export default function FriendsPage() {
  const me = useMe();
  const { counters } = useRealtime();
  const [params, setParams] = useSearchParams();
  const userId = Number(params.get('id')) || me.id;
  const own = userId === me.id;
  const tab = (params.get('tab') as Tab) || 'all';
  const [filter, setFilter] = useState('');
  const qc = useQueryClient();

  const { data: owner } = useQuery({ queryKey: ['user', userId], queryFn: () => api<Profile>(`/users/${userId}`), enabled: !own });
  const { data: friends, isLoading } = useQuery({
    queryKey: ['friends', userId],
    queryFn: () => api<UserShort[]>(`/users/${userId}/friends`),
  });
  const { data: requests } = useQuery({
    queryKey: ['friends', 'requests'],
    queryFn: () => api<{ incoming: UserShort[]; outgoing: UserShort[] }>('/friends/requests'),
    enabled: own,
  });
  const { data: suggestions } = useQuery({
    queryKey: ['friends', 'suggestions'],
    queryFn: () => api<(UserShort & { mutual: number })[]>('/friends/suggestions'),
    enabled: own && tab === 'suggestions',
  });

  const setTab = (t: Tab) => setParams(own ? { tab: t } : { id: String(userId), tab: t });
  const needle = filter.trim().toLowerCase();
  const match = (u: UserShort) => !needle || fullName(u).toLowerCase().includes(needle);
  const list = (friends ?? []).filter((u) => (tab === 'online' ? u.online : true)).filter(match);
  const onlineCount = friends?.filter((u) => u.online).length ?? 0;

  return (
    <div className="columns">
      <div className="col-main">
        <div className="card">
          {!own && owner && (
            <div className="card-title">
              <Link to={`/id/${userId}`}>{fullName(owner)}</Link>
              <span className="muted">› Друзья</span>
            </div>
          )}
          <div className="tabs">
            <button className={`tab${tab === 'all' ? ' active' : ''}`} onClick={() => setTab('all')}>
              Все друзья<span className="n">{friends?.length ?? ''}</span>
            </button>
            <button className={`tab${tab === 'online' ? ' active' : ''}`} onClick={() => setTab('online')}>
              Друзья онлайн<span className="n">{onlineCount || ''}</span>
            </button>
            {own && (
              <>
                <button className={`tab${tab === 'requests' ? ' active' : ''}`} onClick={() => setTab('requests')}>
                  Заявки{counters.friends > 0 && <span className="badge" style={{ marginLeft: 6 }}>{counters.friends}</span>}
                </button>
                <button className={`tab${tab === 'suggestions' ? ' active' : ''}`} onClick={() => setTab('suggestions')}>
                  Поиск друзей
                </button>
              </>
            )}
          </div>

          {(tab === 'all' || tab === 'online') && (
            <>
              <div style={{ padding: '12px 20px', position: 'relative' }}>
                <Search size={16} style={{ position: 'absolute', left: 32, top: 22, color: 'var(--icon)' }} />
                <input className="field" style={{ paddingLeft: 36 }} placeholder="Поиск друзей" value={filter} onChange={(e) => setFilter(e.target.value)} />
              </div>
              {isLoading && <Spinner />}
              {!isLoading && !list.length && (
                <Empty icon={<Users size={48} />} title={needle ? 'Никого не нашлось' : 'Пока нет друзей'}>
                  {own && !needle && (
                    <button className="btn" style={{ marginTop: 12 }} onClick={() => setTab('suggestions')}>
                      Найти друзей
                    </button>
                  )}
                </Empty>
              )}
              {list.map((u) => (
                <UserRow key={u.id} user={u}>
                  {own && (
                    <button
                      className="icon-btn"
                      title="Удалить из друзей"
                      aria-label="Удалить из друзей"
                      onClick={async () => {
                        if (!confirm(`Удалить ${fullName(u)} из друзей?`)) return;
                        await api(`/friends/${u.id}`, { method: 'DELETE' });
                        qc.invalidateQueries({ queryKey: ['friends'] });
                      }}
                    >
                      <UserMinus size={20} />
                    </button>
                  )}
                </UserRow>
              ))}
            </>
          )}

          {tab === 'requests' && requests && (
            <>
              <div className="section-title">Входящие · {requests.incoming.length}</div>
              {!requests.incoming.length && <div className="empty" style={{ padding: 20 }}>Нет новых заявок</div>}
              {requests.incoming.map((u) => (
                <UserRow key={u.id} user={u}>
                  <FriendButton userId={u.id} initial="incoming" />
                </UserRow>
              ))}
              <div className="section-title">Исходящие · {requests.outgoing.length}</div>
              {!requests.outgoing.length && <div className="empty" style={{ padding: 20 }}>Нет отправленных заявок</div>}
              {requests.outgoing.map((u) => (
                <UserRow key={u.id} user={u}>
                  <FriendButton userId={u.id} initial="outgoing" />
                </UserRow>
              ))}
            </>
          )}

          {tab === 'suggestions' && (
            <>
              {!suggestions && <Spinner />}
              {suggestions?.length === 0 && <Empty icon={<Users size={48} />} title="Все уже у вас в друзьях" />}
              {suggestions?.map((u) => (
                <UserRow key={u.id} user={u} sub={u.mutual ? countLabel(u.mutual, 'общий друг', 'общих друга', 'общих друзей') : lastSeenText(u)}>
                  <FriendButton userId={u.id} initial="none" />
                </UserRow>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
