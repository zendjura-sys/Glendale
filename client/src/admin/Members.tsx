import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { BadgeCheck, Ban, Check, KeyRound, LogIn, LogOut, Pencil, Search, Trash2, Unlock, UserCheck } from 'lucide-react';
import { api, getToken, setToken } from '../lib/api';
import { useMe } from '../lib/auth';
import { formatDate, fullName } from '../lib/utils';
import { Avatar, Empty, Modal, Spinner } from '../components/ui';
import { AdminHead, LEVEL_TYPE_LABEL, Pager, SwitchRow, fmt } from './ui';
import type { AdminUser, AdminUserDetails, Level, Paged } from './types';

export const IMPERSONATOR_KEY = 'impersonator';

export function loginAs(token: string) {
  try {
    const current = getToken();
    if (current && !sessionStorage.getItem(IMPERSONATOR_KEY)) sessionStorage.setItem(IMPERSONATOR_KEY, current);
  } catch {
    /* storage unavailable */
  }
  setToken(token);
  location.href = '/feed';
}

function StatusPills({ u }: { u: AdminUser }) {
  return (
    <span style={{ display: 'inline-flex', gap: 4, flexWrap: 'wrap' }}>
      {!u.enabled && <span className="pill bad">Заблокирован</span>}
      {!u.approved && <span className="pill warn">Ждёт одобрения</span>}
      {u.lockedUntil > Date.now() && <span className="pill warn">Вход заблокирован</span>}
      {u.enabled && u.approved && <span className="pill good">Активен</span>}
      {u.verified && <span className="pill accent">Подтверждён</span>}
    </span>
  );
}

function MemberModal({ id, levels, onClose }: { id: number; levels: Level[]; onClose: () => void }) {
  const me = useMe();
  const qc = useQueryClient();
  const { data: u, refetch } = useQuery({ queryKey: ['admin', 'user', id], queryFn: () => api<AdminUserDetails>(`/admin/users/${id}`) });
  const [form, setForm] = useState<{ firstName: string; lastName: string; email: string; levelId: number; password: string } | null>(null);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (u) setForm({ firstName: u.firstName, lastName: u.lastName, email: u.email, levelId: u.level.id, password: '' });
  }, [u]);

  const patch = async (body: Record<string, unknown>) => {
    setError('');
    setSaved(false);
    try {
      await api(`/admin/users/${id}`, { method: 'PATCH', body });
      await refetch();
      qc.invalidateQueries({ queryKey: ['admin', 'users'] });
      qc.invalidateQueries({ queryKey: ['admin', 'dashboard'] });
      setSaved(true);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const action = async (path: string, confirmText?: string) => {
    if (confirmText && !confirm(confirmText)) return;
    setError('');
    try {
      const r = await api<{ token?: string }>(`/admin/users/${id}/${path}`, { method: 'POST' });
      if (r.token) return loginAs(r.token);
      await refetch();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const remove = async () => {
    if (!u || !confirm(`Удалить аккаунт ${fullName(u)} со всеми записями? Это необратимо.`)) return;
    try {
      await api(`/admin/users/${id}`, { method: 'DELETE' });
      qc.invalidateQueries({ queryKey: ['admin'] });
      onClose();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const self = u?.id === me.id;

  return (
    <Modal title="Участник" onClose={onClose} wide>
      {!u || !form ? (
        <Spinner />
      ) : (
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <Avatar src={u.avatar} name={fullName(u)} id={u.id} size={56} online={u.online} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <Link to={`/id/${u.id}`} className="name" style={{ fontSize: 16 }} onClick={onClose}>
                {fullName(u)}
              </Link>{' '}
              <span className="muted">#{u.id}</span>
              <div style={{ marginTop: 4 }}>
                <StatusPills u={u} />
              </div>
            </div>
          </div>

          <div className="tiles" style={{ gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
            {(
              [
                ['Записи', u.stats.posts],
                ['Комментарии', u.stats.comments],
                ['Сообщения', u.stats.messages],
                ['Друзья', u.stats.friends],
                ['Сообщества', u.stats.groups],
                ['Фото', u.stats.photos],
                ['Сессии', u.stats.sessions],
                ['Жалобы на него', u.stats.reportsAgainst],
              ] as [string, number][]
            ).map(([label, value]) => (
              <div key={label} className="counters" style={{ padding: 0 }}>
                <a style={{ cursor: 'default' }}>
                  <b>{fmt(value)}</b>
                  {label}
                </a>
              </div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label className="label">Имя</label>
              <input className="field" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
            </div>
            <div>
              <label className="label">Фамилия</label>
              <input className="field" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
            </div>
            <div>
              <label className="label">Email</label>
              <input className="field" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div>
              <label className="label">Уровень доступа</label>
              <select className="field" value={form.levelId} disabled={self} onChange={(e) => setForm({ ...form, levelId: Number(e.target.value) })}>
                {levels.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.title}
                  </option>
                ))}
              </select>
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label className="label">Новый пароль (необязательно)</label>
              <input
                className="field"
                type="password"
                autoComplete="new-password"
                placeholder="Оставьте пустым, чтобы не менять"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
            </div>
          </div>

          <div>
            <SwitchRow title="Аккаунт активен" hint="Заблокированный участник не может войти, все его сессии завершаются" on={u.enabled} onChange={(v) => !self && patch({ enabled: v })} />
            <SwitchRow title="Одобрен" hint="Нужен, если регистрация идёт по одобрению" on={u.approved} onChange={(v) => patch({ approved: v })} />
            <SwitchRow title="Подтверждённый аккаунт" hint="Галочка рядом с именем" on={u.verified} onChange={(v) => patch({ verified: v })} />
          </div>

          <dl className="info-list" style={{ padding: 0, gridTemplateColumns: '150px 1fr' }}>
            <dt>Зарегистрирован</dt>
            <dd>{formatDate(u.createdAt)}</dd>
            <dt>Последний визит</dt>
            <dd>{u.online ? 'в сети' : formatDate(u.lastSeen)}</dd>
            <dt>IP при регистрации</dt>
            <dd>{u.signupIp || '—'}</dd>
            <dt>Последний IP</dt>
            <dd>{u.lastIp || '—'}</dd>
          </dl>

          {error && <div className="error-text">{error}</div>}
          {saved && !error && <div className="muted">Сохранено</div>}

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              className="btn"
              onClick={() => {
                const { password, ...rest } = form;
                patch(password ? { ...rest, password } : rest);
              }}
            >
              <Check size={16} /> Сохранить
            </button>
            {!self && u.enabled && (
              <button className="btn secondary" onClick={() => action('login-as', `Войти как ${fullName(u)}? Вы сможете вернуться в админку.`)}>
                <LogIn size={16} /> Войти как
              </button>
            )}
            <button className="btn secondary" onClick={() => action('logout-all', 'Завершить все сессии участника?')}>
              <LogOut size={16} /> Завершить сессии
            </button>
            {u.lockedUntil > Date.now() && (
              <button className="btn secondary" onClick={() => patch({ unlock: true })}>
                <Unlock size={16} /> Снять блокировку входа
              </button>
            )}
            {!self && (
              <button className="btn danger" style={{ marginLeft: 'auto' }} onClick={remove}>
                <Trash2 size={16} /> Удалить
              </button>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}

export default function MembersPage() {
  const me = useMe();
  const qc = useQueryClient();
  const [params, setParams] = useSearchParams();
  const page = Number(params.get('page')) || 1;
  const status = params.get('status') ?? '';
  const level = params.get('level') ?? '';
  const sort = params.get('sort') ?? '';
  const [search, setSearch] = useState(params.get('q') ?? '');
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [open, setOpen] = useState<number | null>(null);
  const [notice, setNotice] = useState('');

  const set = (patch: Record<string, string>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) (v ? next.set(k, v) : next.delete(k));
    if (!('page' in patch)) next.delete('page');
    setParams(next, { replace: true });
    setSelected(new Set());
  };

  useEffect(() => {
    const t = setTimeout(() => search !== (params.get('q') ?? '') && set({ q: search }), 300);
    return () => clearTimeout(t);
  }, [search]); // eslint-disable-line react-hooks/exhaustive-deps

  const query = new URLSearchParams({ page: String(page), q: params.get('q') ?? '', status, level, sort }).toString();
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'users', query],
    queryFn: () => api<Paged<AdminUser>>(`/admin/users?${query}`),
    placeholderData: (p) => p,
  });
  const { data: levels = [] } = useQuery({ queryKey: ['admin', 'levels'], queryFn: () => api<Level[]>('/admin/levels') });

  const items = data?.items ?? [];
  const allChecked = items.length > 0 && items.every((u) => selected.has(u.id));
  const toggle = (id: number) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const bulk = async (action: string, label: string) => {
    if (action === 'delete' && !confirm(`Удалить ${selected.size} аккаунт(ов)? Это необратимо.`)) return;
    const r = await api<{ done: number; skipped: number[] }>('/admin/users/bulk', { body: { ids: [...selected], action } });
    setNotice(`${label}: ${r.done}${r.skipped.length ? `, пропущено ${r.skipped.length} (нет прав)` : ''}`);
    setSelected(new Set());
    qc.invalidateQueries({ queryKey: ['admin'] });
  };

  return (
    <>
      <AdminHead title="Участники" subtitle="Поиск, модерация и управление аккаунтами" />
      <div className="card">
        <div className="toolbar">
          <div className="grow" style={{ position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: 12, top: 10, color: 'var(--icon)' }} />
            <input className="field" style={{ width: '100%', paddingLeft: 36 }} placeholder="Имя, email или ID" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <select className="field" value={status} onChange={(e) => set({ status: e.target.value })} aria-label="Статус">
            <option value="">Все статусы</option>
            <option value="active">Активные</option>
            <option value="pending">Ждут одобрения</option>
            <option value="banned">Заблокированные</option>
            <option value="verified">Подтверждённые</option>
          </select>
          <select className="field" value={level} onChange={(e) => set({ level: e.target.value })} aria-label="Уровень">
            <option value="">Все уровни</option>
            {levels.map((l) => (
              <option key={l.id} value={l.id}>
                {l.title}
              </option>
            ))}
          </select>
          <select className="field" value={sort} onChange={(e) => set({ sort: e.target.value })} aria-label="Сортировка">
            <option value="">Сначала новые</option>
            <option value="last_seen">По активности</option>
            <option value="name">По имени</option>
          </select>
        </div>

        {selected.size > 0 && (
          <div className="bulkbar">
            <b>Выбрано: {selected.size}</b>
            <button className="btn secondary" onClick={() => bulk('approve', 'Одобрено')}>
              <UserCheck size={16} /> Одобрить
            </button>
            <button className="btn secondary" onClick={() => bulk('verify', 'Подтверждено')}>
              <BadgeCheck size={16} /> Подтвердить
            </button>
            <button className="btn secondary" onClick={() => bulk('enable', 'Разблокировано')}>
              <KeyRound size={16} /> Разблокировать
            </button>
            <button className="btn secondary" onClick={() => bulk('disable', 'Заблокировано')}>
              <Ban size={16} /> Заблокировать
            </button>
            <button className="btn danger" onClick={() => bulk('delete', 'Удалено')}>
              <Trash2 size={16} /> Удалить
            </button>
          </div>
        )}
        {notice && (
          <div className="toolbar muted" style={{ justifyContent: 'space-between' }}>
            {notice}
            <button className="more-link" onClick={() => setNotice('')}>
              Скрыть
            </button>
          </div>
        )}

        {isLoading ? (
          <Spinner />
        ) : !items.length ? (
          <Empty title="Никого не нашлось">Измените фильтры или запрос</Empty>
        ) : (
          <div className="table-wrap">
            <table className="admin">
              <thead>
                <tr>
                  <th style={{ width: 32 }}>
                    <input
                      type="checkbox"
                      aria-label="Выбрать всех"
                      checked={allChecked}
                      onChange={() => setSelected(allChecked ? new Set() : new Set(items.map((u) => u.id)))}
                    />
                  </th>
                  <th>Участник</th>
                  <th className="hide-sm">Email</th>
                  <th>Уровень</th>
                  <th>Статус</th>
                  <th className="hide-sm">Регистрация</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {items.map((u) => (
                  <tr key={u.id} className={selected.has(u.id) ? 'selected' : ''}>
                    <td>
                      <input type="checkbox" aria-label={`Выбрать ${fullName(u)}`} checked={selected.has(u.id)} onChange={() => toggle(u.id)} />
                    </td>
                    <td>
                      <div className="who">
                        <Avatar src={u.avatar} name={fullName(u)} id={u.id} size={32} online={u.online} />
                        <div style={{ minWidth: 0 }}>
                          <button className="more-link name" style={{ color: 'var(--name)' }} onClick={() => setOpen(u.id)}>
                            {fullName(u)}
                          </button>
                          <div className="meta">#{u.id}{u.id === me.id ? ' · это вы' : ''}</div>
                        </div>
                      </div>
                    </td>
                    <td className="hide-sm ellipsis" style={{ maxWidth: 200 }}>
                      {u.email}
                    </td>
                    <td>
                      <span className={`pill${u.level.type !== 'user' ? ' accent' : ''}`} title={LEVEL_TYPE_LABEL[u.level.type]}>
                        {u.level.title}
                      </span>
                    </td>
                    <td>
                      <StatusPills u={u} />
                    </td>
                    <td className="hide-sm muted">{new Date(u.createdAt).toLocaleDateString('ru-RU')}</td>
                    <td className="actions">
                      <button className="icon-btn" onClick={() => setOpen(u.id)} aria-label="Редактировать">
                        <Pencil size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {data && <Pager page={page} total={data.total} perPage={data.perPage} onPage={(p) => set({ page: String(p) })} />}
      </div>
      {open != null && <MemberModal id={open} levels={levels} onClose={() => setOpen(null)} />}
    </>
  );
}
