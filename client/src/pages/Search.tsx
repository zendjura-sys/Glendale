import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { api } from '../lib/api';
import type { Friendship, Group, Post, UserShort } from '../lib/types';
import { lastSeenText } from '../lib/utils';
import { PostCard } from '../components/Post';
import { Empty, Spinner } from '../components/ui';
import { FriendButton, UserRow } from '../components/People';
import { GroupRow } from './Groups';

type Result = { users: (UserShort & { city: string; friendship: Friendship })[]; groups: Group[]; posts: Post[] };
type Tab = 'all' | 'people' | 'groups' | 'posts';

export default function SearchPage() {
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const tab = (params.get('tab') as Tab) || 'all';
  const [input, setInput] = useState(q);
  useEffect(() => setInput(q), [q]);

  // Debounced search-as-you-type.
  useEffect(() => {
    if (input === q) return;
    const t = setTimeout(() => setParams(input ? { q: input, tab } : { tab }, { replace: true }), 300);
    return () => clearTimeout(t);
  }, [input]); // eslint-disable-line react-hooks/exhaustive-deps

  const { data, isFetching } = useQuery({
    queryKey: ['search', q],
    queryFn: () => api<Result>(`/search?q=${encodeURIComponent(q)}`),
    enabled: !!q.trim(),
    placeholderData: (prev) => prev,
  });

  const setTab = (t: Tab) => setParams({ q, tab: t });
  const show = (t: Tab) => tab === 'all' || tab === t;
  const nothing = data && !data.users.length && !data.groups.length && !data.posts.length;

  return (
    <div className="col-main">
      <div className="card">
        <div style={{ padding: '16px 20px 8px', position: 'relative' }}>
          <Search size={18} style={{ position: 'absolute', left: 32, top: 26, color: 'var(--icon)' }} />
          <input
            className="field"
            autoFocus
            style={{ paddingLeft: 40, height: 40 }}
            placeholder="Поиск людей, сообществ и записей"
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
        </div>
        <div className="tabs">
          {(
            [
              ['all', 'Все'],
              ['people', 'Люди'],
              ['groups', 'Сообщества'],
              ['posts', 'Записи'],
            ] as [Tab, string][]
          ).map(([t, label]) => (
            <button key={t} className={`tab${tab === t ? ' active' : ''}`} onClick={() => setTab(t)}>
              {label}
            </button>
          ))}
        </div>
        {!q && <Empty icon={<Search size={48} />} title="Начните вводить запрос" />}
        {q && isFetching && !data && <Spinner />}
        {q && nothing && <Empty title="Ничего не найдено">Попробуйте изменить запрос</Empty>}
      </div>

      {data && show('people') && data.users.length > 0 && (
        <div className="card">
          <div className="card-title">
            Люди <span className="count">{data.users.length}</span>
          </div>
          {(tab === 'all' ? data.users.slice(0, 5) : data.users).map((u) => (
            <UserRow key={u.id} user={u} sub={[u.city, lastSeenText(u)].filter(Boolean).join(' · ')}>
              <FriendButton userId={u.id} initial={u.friendship} />
            </UserRow>
          ))}
        </div>
      )}
      {data && show('groups') && data.groups.length > 0 && (
        <div className="card">
          <div className="card-title">
            Сообщества <span className="count">{data.groups.length}</span>
          </div>
          {(tab === 'all' ? data.groups.slice(0, 5) : data.groups).map((g) => (
            <GroupRow key={g.id} g={g} />
          ))}
        </div>
      )}
      {data && show('posts') && data.posts.length > 0 && (
        <>
          <div className="card">
            <div className="card-title">
              Записи <span className="count">{data.posts.length}</span>
            </div>
          </div>
          {data.posts.map((p) => (
            <PostCard key={p.id} post={p} />
          ))}
        </>
      )}
    </div>
  );
}
