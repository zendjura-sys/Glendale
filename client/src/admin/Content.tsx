import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ExternalLink, Search, Trash2 } from 'lucide-react';
import { api } from '../lib/api';
import { countLabel, formatDate, fullName } from '../lib/utils';
import { Avatar, Empty, Spinner } from '../components/ui';
import { AdminHead, Pager } from './ui';
import type { AdminComment, AdminGroup, Paged, Post } from './types';

type Kind = 'posts' | 'comments' | 'groups';

export default function ContentPage() {
  const qc = useQueryClient();
  const [kind, setKind] = useState<Kind>('posts');
  const [input, setInput] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  useEffect(() => {
    const t = setTimeout(() => {
      setQ(input.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [input]);

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'content', kind, q, page],
    queryFn: () => api<Paged<Post | AdminComment | AdminGroup>>(`/admin/${kind}?q=${encodeURIComponent(q)}&page=${page}`),
    placeholderData: (p) => p,
  });

  const remove = async (id: number, what: string) => {
    if (!confirm(`Удалить ${what}?`)) return;
    await api(`/admin/${kind}/${id}`, { method: 'DELETE' });
    qc.invalidateQueries({ queryKey: ['admin', 'content'] });
    qc.invalidateQueries({ queryKey: ['posts'] });
  };

  return (
    <>
      <AdminHead title="Контент" subtitle="Записи, комментарии и сообщества" />
      <div className="card">
        <div className="toolbar">
          <div className="segmented">
            {(
              [
                ['posts', 'Записи'],
                ['comments', 'Комментарии'],
                ['groups', 'Сообщества'],
              ] as [Kind, string][]
            ).map(([k, label]) => (
              <button
                key={k}
                className={kind === k ? 'on' : ''}
                onClick={() => {
                  setKind(k);
                  setPage(1);
                }}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="grow" style={{ position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: 12, top: 10, color: 'var(--icon)' }} />
            <input className="field" style={{ width: '100%', paddingLeft: 36 }} placeholder="Поиск по тексту" value={input} onChange={(e) => setInput(e.target.value)} />
          </div>
        </div>
        {isLoading ? (
          <Spinner />
        ) : !data?.items.length ? (
          <Empty title="Ничего не найдено" />
        ) : (
          <div className="table-wrap">
            <table className="admin">
              <tbody>
                {kind === 'posts' &&
                  (data.items as Post[]).map((p) => {
                    const who = p.fromGroup && p.group ? p.group.name : fullName(p.author);
                    return (
                      <tr key={p.id}>
                        <td style={{ width: '100%' }}>
                          <div className="who" style={{ alignItems: 'flex-start' }}>
                            <Avatar src={p.fromGroup ? p.group?.avatar : p.author.avatar} name={who} id={p.author.id} size={32} square={p.fromGroup} />
                            <div style={{ minWidth: 0 }}>
                              <b>{who}</b> <span className="meta">· {formatDate(p.createdAt)}</span>
                              <div className="ellipsis" style={{ maxWidth: 520 }}>
                                {p.text || (p.repost ? 'Репост' : p.image ? 'Фотография' : '')}
                              </div>
                              <div className="meta">
                                {countLabel(p.likes, 'лайк', 'лайка', 'лайков')} · {countLabel(p.comments, 'комментарий', 'комментария', 'комментариев')}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="actions">
                          <Link to={`/wall/${p.id}`} className="icon-btn" aria-label="Открыть">
                            <ExternalLink size={16} />
                          </Link>
                          <button className="icon-btn" onClick={() => remove(p.id, 'запись')} aria-label="Удалить">
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                {kind === 'comments' &&
                  (data.items as AdminComment[]).map((c) => (
                    <tr key={c.id}>
                      <td style={{ width: '100%' }}>
                        <div className="who" style={{ alignItems: 'flex-start' }}>
                          {c.author && <Avatar src={c.author.avatar} name={fullName(c.author)} id={c.author.id} size={32} />}
                          <div style={{ minWidth: 0 }}>
                            <b>{c.author ? fullName(c.author) : 'Удалённый'}</b> <span className="meta">· {formatDate(c.createdAt)}</span>
                            <div className="ellipsis" style={{ maxWidth: 520 }}>
                              {c.text}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="actions">
                        <Link to={`/wall/${c.postId}`} className="icon-btn" aria-label="Открыть запись">
                          <ExternalLink size={16} />
                        </Link>
                        <button className="icon-btn" onClick={() => remove(c.id, 'комментарий')} aria-label="Удалить">
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                {kind === 'groups' &&
                  (data.items as AdminGroup[]).map((g) => (
                    <tr key={g.id}>
                      <td style={{ width: '100%' }}>
                        <div className="who">
                          <Avatar src={g.avatar} name={g.name} id={g.id + 100} size={32} square />
                          <div style={{ minWidth: 0 }}>
                            <b>{g.name}</b>
                            <div className="meta">
                              {countLabel(g.membersCount, 'участник', 'участника', 'участников')} · {countLabel(g.posts, 'запись', 'записи', 'записей')}
                              {g.owner && ` · владелец ${fullName(g.owner)}`}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="actions">
                        <Link to={`/club/${g.id}`} className="icon-btn" aria-label="Открыть">
                          <ExternalLink size={16} />
                        </Link>
                        <button className="icon-btn" onClick={() => remove(g.id, `сообщество «${g.name}» со всеми записями`)} aria-label="Удалить">
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
        {data && <Pager page={page} total={data.total} perPage={data.perPage} onPage={setPage} />}
      </div>
    </>
  );
}
