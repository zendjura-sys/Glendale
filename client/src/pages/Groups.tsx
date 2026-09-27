import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Lock, Plus, Search, UsersRound } from 'lucide-react';
import { api } from '../lib/api';
import { useMe } from '../lib/auth';
import type { Group, Profile } from '../lib/types';
import { countLabel, fullName } from '../lib/utils';
import { Avatar, Empty, Modal, Spinner } from '../components/ui';
import { JoinButton, PrivacyPicker } from './Group';

function CreateGroupModal({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [privacy, setPrivacy] = useState<'open' | 'closed'>('open');
  const [error, setError] = useState('');
  const create = async () => {
    try {
      const g = await api<Group>('/groups', { body: { name, description, privacy } });
      navigate(`/club/${g.id}`);
    } catch (e) {
      setError((e as Error).message);
    }
  };
  return (
    <Modal
      title="Новое сообщество"
      onClose={onClose}
      footer={
        <button className="btn" onClick={create} disabled={!name.trim()}>
          Создать сообщество
        </button>
      }
    >
      <div className="modal-body">
        <div className="form-row">
          <label className="label">Название</label>
          <input className="field" autoFocus value={name} maxLength={100} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="form-row">
          <label className="label">Описание</label>
          <textarea className="field" value={description} maxLength={2000} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div className="form-row">
          <label className="label">Тип сообщества</label>
          <PrivacyPicker value={privacy} onChange={setPrivacy} />
        </div>
        {error && <div className="error-text">{error}</div>}
      </div>
    </Modal>
  );
}

export function GroupRow({ g }: { g: Group }) {
  return (
    <div className="row">
      <Link to={`/club/${g.id}`}>
        <Avatar src={g.avatar} name={g.name} id={g.id + 100} square size={64} />
      </Link>
      <div className="info">
        <Link to={`/club/${g.id}`} className="name" style={{ fontSize: 14 }}>
          {g.name}
        </Link>
        {g.privacy === 'closed' && <Lock size={13} style={{ marginLeft: 6, verticalAlign: '-1px', color: 'var(--text-3)' }} aria-label="Закрытое" />}
        {g.description && <div className="ellipsis muted">{g.description}</div>}
        <div className="meta">{countLabel(g.membersCount, 'участник', 'участника', 'участников')}</div>
      </div>
      <div className="actions">
        <JoinButton group={g} compact />
      </div>
    </div>
  );
}

export default function GroupsPage() {
  const me = useMe();
  const [params, setParams] = useSearchParams();
  const userId = Number(params.get('id')) || me.id;
  const own = userId === me.id;
  const tab = own && params.get('tab') === 'all' ? 'all' : 'mine';
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);

  const { data: owner } = useQuery({ queryKey: ['user', userId], queryFn: () => api<Profile>(`/users/${userId}`), enabled: !own });
  const { data: mine, isLoading: loadingMine } = useQuery({
    queryKey: ['groups', 'user', userId],
    queryFn: () => api<Group[]>(`/users/${userId}/groups`),
  });
  const { data: all, isLoading: loadingAll } = useQuery({
    queryKey: ['groups', 'search', query.trim()],
    queryFn: () => api<Group[]>(`/groups?q=${encodeURIComponent(query.trim())}`),
    enabled: tab === 'all',
  });

  const needle = query.trim().toLowerCase();
  const list = tab === 'mine' ? (mine ?? []).filter((g) => !needle || g.name.toLowerCase().includes(needle)) : all ?? [];
  const loading = tab === 'mine' ? loadingMine : loadingAll;

  return (
    <div className="col-main">
      <div className="card">
        {!own && owner && (
          <div className="card-title">
            <Link to={`/id/${userId}`}>{fullName(owner)}</Link>
            <span className="muted">› Сообщества</span>
          </div>
        )}
        <div className="tabs" style={{ alignItems: 'center' }}>
          <button className={`tab${tab === 'mine' ? ' active' : ''}`} onClick={() => setParams(own ? {} : { id: String(userId) })}>
            {own ? 'Мои сообщества' : 'Сообщества'}
            <span className="n">{mine?.length ?? ''}</span>
          </button>
          {own && (
            <button className={`tab${tab === 'all' ? ' active' : ''}`} onClick={() => setParams({ tab: 'all' })}>
              Поиск сообществ
            </button>
          )}
          <div style={{ flex: 1 }} />
          {own && (
            <button className="btn" onClick={() => setCreating(true)}>
              <Plus size={16} /> Создать
            </button>
          )}
        </div>
        <div style={{ padding: '12px 20px', position: 'relative' }}>
          <Search size={16} style={{ position: 'absolute', left: 32, top: 22, color: 'var(--icon)' }} />
          <input
            className="field"
            style={{ paddingLeft: 36 }}
            placeholder="Поиск сообществ"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        {loading && <Spinner />}
        {!loading && !list.length && (
          <Empty icon={<UsersRound size={48} />} title="Сообществ не найдено">
            {tab === 'mine' && own && (
              <button className="btn" style={{ marginTop: 12 }} onClick={() => setParams({ tab: 'all' })}>
                Найти интересные сообщества
              </button>
            )}
          </Empty>
        )}
        {list.map((g) => (
          <GroupRow key={g.id} g={g} />
        ))}
      </div>
      {creating && <CreateGroupModal onClose={() => setCreating(false)} />}
    </div>
  );
}
