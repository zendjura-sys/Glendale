import { tr } from '../lib/i18n';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { BadgeCheck, Check, Crown, Handshake, Pencil, Plus, Search, Trash2, X } from 'lucide-react';
import { api } from '../lib/api';
import { useMe } from '../lib/auth';
import type { Family, FamilyUnion, FamilyUnionFull } from '../lib/types';
import { countLabel } from '../lib/utils';
import { Avatar, Empty, Modal, Spinner } from '../components/ui';
import { FamilyRow, StatusBadge, familyTitle } from './Families';

/*
 * Союзи родин. Створює лідер верифікованої родини (вона — засновниця),
 * союз проходить перевірку адміністрацією. Інші родини подають заявки.
 */

function CreateUnionModal({ onClose }: { onClose: () => void }) {
  const me = useMe();
  const navigate = useNavigate();
  const led = me.families.filter((f) => f.role === 'leader' && f.status === 'verified');
  const [f, setF] = useState({ name: '', tag: '', description: '', familyId: led[0]?.id ?? 0 });
  const [error, setError] = useState('');
  const create = async () => {
    try {
      const u = await api<FamilyUnionFull>('/unions', { body: { ...f, tag: f.tag || null } });
      navigate(`/unions/${u.id}`);
    } catch (e) {
      setError((e as Error).message);
    }
  };
  return (
    <Modal
      title={tr('Новий союз родин')}
      onClose={onClose}
      footer={
        <button className="btn" onClick={create} disabled={!f.name.trim() || !f.familyId}>
          {tr('Надіслати на перевірку')}
        </button>
      }
    >
      <div className="modal-body">
        {!led.length ? (
          <p className="muted">{tr('Створити союз може лідер верифікованої родини.')}</p>
        ) : (
          <>
            <div className="form-row">
              <label className="label">{tr('Від імені родини')}</label>
              <select className="field" value={f.familyId} onChange={(e) => setF({ ...f, familyId: Number(e.target.value) })}>
                {led.map((x) => (
                  <option key={x.id} value={x.id}>
                    {familyTitle(x)}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-grid">
              <div className="form-row">
                <label className="label">{tr('Назва союзу')}</label>
                <input className="field" autoFocus value={f.name} maxLength={60} onChange={(e) => setF({ ...f, name: e.target.value })} />
              </div>
              <div className="form-row">
                <label className="label">{tr('Тег')}</label>
                <input className="field" value={f.tag} maxLength={8} onChange={(e) => setF({ ...f, tag: e.target.value })} />
              </div>
            </div>
            <div className="form-row">
              <label className="label">{tr('Про союз')}</label>
              <textarea className="field" value={f.description} maxLength={3000} onChange={(e) => setF({ ...f, description: e.target.value })} />
            </div>
          </>
        )}
        {error && <div className="error-text">{error}</div>}
      </div>
    </Modal>
  );
}

function UnionRow({ u }: { u: FamilyUnion }) {
  return (
    <div className="row">
      <Link to={`/unions/${u.id}`}>
        <Avatar src={u.avatar} name={u.name} id={u.id + 600} square size={60} />
      </Link>
      <div className="info">
        <Link to={`/unions/${u.id}`} className="name" style={{ fontSize: 14 }}>
          {familyTitle(u)}
        </Link>
        {u.status !== 'verified' ? <StatusBadge status={u.status} /> : <BadgeCheck size={14} className="family-check" />}
        <div className="meta">
          {countLabel(u.familiesCount, tr('родина|родини|родин'))}
          {u.founder && <> · {tr('засновниця')}: {familyTitle(u.founder)}</>}
        </div>
        {u.description && <div className="ellipsis muted">{u.description}</div>}
      </div>
    </div>
  );
}

export default function UnionsPage() {
  const me = useMe();
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);
  const { data, isLoading } = useQuery({
    queryKey: ['unions', query.trim()],
    queryFn: () => api<{ items: FamilyUnion[]; mine: FamilyUnion[] }>(`/unions?q=${encodeURIComponent(query.trim())}`),
  });
  const canCreate = me.families.some((f) => f.role === 'leader' && f.status === 'verified');

  return (
    <div className="col-main">
      {!!data?.mine.length && (
        <div className="card">
          <div className="card-title">{tr('Союзи моїх родин')}</div>
          {data.mine.map((u) => (
            <UnionRow key={u.id} u={u} />
          ))}
        </div>
      )}
      <div className="card">
        <div className="tabs" style={{ alignItems: 'center' }}>
          <Link to="/families" className="tab">
            <Crown size={16} /> {tr('Родини')}
          </Link>
          <span className="tab active">
            <Handshake size={16} /> {tr('Союзи')}
          </span>
          <div style={{ flex: 1 }} />
          {canCreate && (
            <button className="btn" onClick={() => setCreating(true)}>
              <Plus size={16} /> {tr('Створити союз')}
            </button>
          )}
        </div>
        <div style={{ padding: '12px 20px', position: 'relative' }}>
          <Search size={16} style={{ position: 'absolute', left: 32, top: 22, color: 'var(--icon)' }} />
          <input className="field" style={{ paddingLeft: 36 }} placeholder={tr('Пошук союзу')} value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        {isLoading && <Spinner />}
        {!isLoading && !data?.items.length && (
          <Empty icon={<Handshake size={48} />} title={tr('Союзів ще немає')}>
            {canCreate ? tr('Створіть перший — від імені своєї родини.') : tr('Союз може створити лідер верифікованої родини.')}
          </Empty>
        )}
        {data?.items.map((u) => (
          <UnionRow key={u.id} u={u} />
        ))}
      </div>
      {creating && <CreateUnionModal onClose={() => setCreating(false)} />}
    </div>
  );
}

function EditUnionModal({ union, onClose, onSaved }: { union: FamilyUnionFull; onClose: () => void; onSaved: (u: FamilyUnionFull) => void }) {
  const locked = union.status === 'verified';
  const [f, setF] = useState({ name: union.name, tag: union.tag ?? '', description: union.description });
  const [error, setError] = useState('');
  const save = async () => {
    try {
      const body: Record<string, string | null> = { tag: f.tag || null, description: f.description };
      if (!locked) body.name = f.name;
      onSaved(await api<FamilyUnionFull>(`/unions/${union.id}`, { method: 'PATCH', body }));
    } catch (e) {
      setError((e as Error).message);
    }
  };
  return (
    <Modal title={tr('Редагувати союз')} onClose={onClose} footer={<button className="btn" onClick={save}>{union.status === 'rejected' ? tr('Зберегти й подати знову') : tr('Зберегти')}</button>}>
      <div className="modal-body">
        <div className="form-grid">
          <div className="form-row">
            <label className="label">{tr('Назва союзу')}</label>
            <input className="field" value={f.name} disabled={locked} onChange={(e) => setF({ ...f, name: e.target.value })} />
          </div>
          <div className="form-row">
            <label className="label">{tr('Тег')}</label>
            <input className="field" value={f.tag} maxLength={8} onChange={(e) => setF({ ...f, tag: e.target.value })} />
          </div>
        </div>
        <div className="form-row">
          <label className="label">{tr('Про союз')}</label>
          <textarea className="field" value={f.description} maxLength={3000} onChange={(e) => setF({ ...f, description: e.target.value })} />
        </div>
        {error && <div className="error-text">{error}</div>}
      </div>
    </Modal>
  );
}

export function UnionPage() {
  const { id } = useParams();
  const unionId = Number(id);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const { data: u, isLoading, error } = useQuery({ queryKey: ['union', unionId], queryFn: () => api<FamilyUnionFull>(`/unions/${unionId}`) });
  const { data: requests } = useQuery({
    queryKey: ['union', unionId, 'requests'],
    queryFn: () => api<Family[]>(`/unions/${unionId}/requests`),
    enabled: !!u?.isFounder && (u?.requestsCount ?? 0) > 0,
  });

  if (isLoading) return <Spinner />;
  if (error || !u)
    return (
      <div className="col-main">
        <div className="card">
          <Empty icon={<Handshake size={48} />} title={tr('Союз не знайдено')} />
        </div>
      </div>
    );

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['union', unionId] });
    qc.invalidateQueries({ queryKey: ['unions'] });
  };
  const call = async (path: string, method: string, body?: unknown, question?: string) => {
    if (question && !confirm(question)) return;
    try {
      await api(`/unions/${u.id}${path}`, { method, body });
    } catch (e) {
      alert((e as Error).message);
    }
    refresh();
  };
  const joinable = u.myFamilies.filter((f) => f.status === 'verified' && !f.inUnion && !f.requested);
  const pending = u.myFamilies.filter((f) => f.requested);
  const inside = u.myFamilies.filter((f) => f.inUnion === u.id && !u.families.some((x) => x.id === f.id && x.unionRole === 'founder'));

  return (
    <div className="col-main">
      <div className="card" style={{ padding: 20 }}>
        <div className="family-head" style={{ padding: 0 }}>
          <Avatar src={u.avatar} name={u.name} id={u.id + 600} square size={80} />
          <div className="family-title">
            <h1>
              {familyTitle(u)} {u.status === 'verified' && <BadgeCheck size={20} className="family-check" />}
            </h1>
            <div className="muted">{countLabel(u.familiesCount, tr('родина|родини|родин'))}</div>
          </div>
          <div className="family-actions">
            {u.canJoin &&
              joinable.map((f) => (
                <button key={f.id} className="btn" onClick={() => call('/join', 'POST', { familyId: f.id })}>
                  <Plus size={16} /> {tr('Подати заявку від «{name}»', { name: f.name })}
                </button>
              ))}
            {pending.map((f) => (
              <button key={f.id} className="btn secondary" onClick={() => call('/join', 'DELETE', { familyId: f.id })} title={tr('Скасувати заявку')}>
                {tr('Заявку «{name}» надіслано', { name: f.name })}
              </button>
            ))}
            {inside.map((f) => (
              <button key={f.id} className="btn secondary" onClick={() => call('/join', 'DELETE', { familyId: f.id }, tr('Вивести «{name}» із союзу?', { name: f.name }))}>
                {tr('Вийти із союзу')}
              </button>
            ))}
            {u.isFounder && (
              <>
                <button className="btn secondary" onClick={() => setEditing(true)}>
                  <Pencil size={16} /> {tr('Редагувати')}
                </button>
                <button
                  className="icon-btn"
                  title={tr('Розпустити союз')}
                  onClick={async () => {
                    if (!confirm(tr('Розпустити союз «{name}»?', { name: u.name }))) return;
                    await api(`/unions/${u.id}`, { method: 'DELETE' }).catch((e) => alert((e as Error).message));
                    qc.invalidateQueries({ queryKey: ['unions'] });
                    navigate('/unions');
                  }}
                >
                  <Trash2 size={18} />
                </button>
              </>
            )}
          </div>
        </div>
        {u.description && <p style={{ whiteSpace: 'pre-wrap', marginTop: 14 }}>{u.description}</p>}
      </div>

      {u.status !== 'verified' && (
        <div className={`card family-review ${u.status}`}>
          <StatusBadge status={u.status} />
          <p>
            {u.status === 'pending'
              ? tr('Адміністрація перевіряє союз. Після підтвердження інші родини зможуть подавати заявки.')
              : `${tr('Причина')}: ${u.reviewNote || '—'}`}
          </p>
          {u.status === 'rejected' && u.isFounder && (
            <button className="btn secondary" onClick={() => setEditing(true)}>
              <Pencil size={16} /> {tr('Виправити й подати знову')}
            </button>
          )}
        </div>
      )}

      {u.isFounder && !!requests?.length && (
        <div className="card">
          <div className="card-title">
            {tr('Заявки родин')} <span className="count">{requests.length}</span>
          </div>
          {requests.map((f) => (
            <div key={f.id} style={{ display: 'flex', alignItems: 'center' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <FamilyRow f={f} />
              </div>
              <div style={{ display: 'flex', gap: 6, paddingRight: 16 }}>
                <button className="btn" onClick={() => call(`/requests/${f.id}`, 'POST')}>
                  <Check size={16} /> {tr('Прийняти')}
                </button>
                <button className="icon-btn" onClick={() => call(`/requests/${f.id}`, 'DELETE')} aria-label={tr('Відхилити')}>
                  <X size={20} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="card">
        <div className="card-title">
          {tr('Родини союзу')} <span className="count">{u.families.length}</span>
        </div>
        {u.families.map((f) => (
          <div key={f.id} style={{ display: 'flex', alignItems: 'center' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <FamilyRow f={f} />
            </div>
            {f.unionRole === 'founder' ? (
              <span className="family-role leader" style={{ paddingRight: 16 }}>
                {tr('Засновниця')}
              </span>
            ) : (
              u.isFounder && (
                <button className="icon-btn" style={{ marginRight: 12 }} title={tr('Виключити із союзу')} onClick={() => call(`/families/${f.id}`, 'DELETE', undefined, tr('Виключити «{name}» із союзу?', { name: f.name }))}>
                  <X size={18} />
                </button>
              )
            )}
          </div>
        ))}
      </div>
      {editing && (
        <EditUnionModal
          union={u}
          onClose={() => setEditing(false)}
          onSaved={(next) => {
            qc.setQueryData(['union', unionId], next);
            setEditing(false);
          }}
        />
      )}
    </div>
  );
}
