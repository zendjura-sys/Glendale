import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Camera, Check, Clock, Crown, Globe, Lock, Pencil, Plus, Shield, Trash2, UserCheck, UserMinus, UserPlus, X } from 'lucide-react';
import { api, form } from '../lib/api';
import { useMe } from '../lib/auth';
import type { Group, GroupFull, UserShort } from '../lib/types';
import { countLabel, formatDate, fullName } from '../lib/utils';
import { Composer } from '../components/Composer';
import { PostList } from '../components/Post';
import { Avatar, Empty, Modal, Spinner, pickFile } from '../components/ui';
import { ReportButton } from '../components/Moderation';

export function JoinButton({ group, compact }: { group: Group; compact?: boolean }) {
  const qc = useQueryClient();
  const [state, setState] = useState({ member: group.isMember, requested: group.requested });
  const [busy, setBusy] = useState(false);
  useEffect(() => setState({ member: group.isMember, requested: group.requested }), [group.isMember, group.requested]);
  const toggle = async () => {
    setBusy(true);
    try {
      const leaving = state.member || state.requested;
      if (state.member && !confirm(`Покинуть сообщество «${group.name}»?`)) return;
      const g = await api<Group>(`/groups/${group.id}/join`, { method: leaving ? 'DELETE' : 'POST' });
      setState({ member: g.isMember, requested: g.requested });
      qc.setQueryData<GroupFull>(['group', group.id], (old) => (old ? { ...old, ...g } : old));
      qc.invalidateQueries({ queryKey: ['groups'] });
      qc.invalidateQueries({ queryKey: ['posts', 'feed'] });
      if (g.isMember) qc.invalidateQueries({ queryKey: ['group', group.id] });
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  if (group.isAdmin && state.member) {
    return compact ? <Check size={20} color="var(--text-3)" /> : null;
  }
  if (compact)
    return state.member ? (
      <Check size={20} color="var(--text-3)" />
    ) : state.requested ? (
      <Clock size={20} color="var(--text-3)" aria-label="Заявка отправлена" />
    ) : (
      <button className="icon-btn" onClick={toggle} disabled={busy} aria-label={group.privacy === 'closed' ? 'Подать заявку' : 'Вступить'}>
        <Plus size={22} color="var(--icon-accent)" />
      </button>
    );
  if (state.member)
    return (
      <button className="btn secondary" onClick={toggle} disabled={busy}>
        <Check size={16} /> Вы участник
      </button>
    );
  if (state.requested)
    return (
      <button className="btn secondary" onClick={toggle} disabled={busy} title="Отменить заявку">
        <Clock size={16} /> Заявка отправлена
      </button>
    );
  return (
    <button className="btn" onClick={toggle} disabled={busy}>
      {group.privacy === 'closed' ? (
        <>
          <Lock size={16} /> Подать заявку
        </>
      ) : (
        'Вступить в сообщество'
      )}
    </button>
  );
}

export function PrivacyPicker({ value, onChange }: { value: 'open' | 'closed'; onChange: (v: 'open' | 'closed') => void }) {
  return (
    <div>
      <div className="segmented">
        <button className={value === 'open' ? 'on' : ''} onClick={() => onChange('open')} type="button">
          <Globe size={14} style={{ verticalAlign: '-2px' }} /> Открытое
        </button>
        <button className={value === 'closed' ? 'on' : ''} onClick={() => onChange('closed')} type="button">
          <Lock size={14} style={{ verticalAlign: '-2px' }} /> Закрытое
        </button>
      </div>
      <div className="meta" style={{ marginTop: 6 }}>
        {value === 'open' ? 'Вступить может любой, записи видны всем.' : 'Записи и участников видят только участники; вступление по заявке.'}
      </div>
    </div>
  );
}

function EditGroupModal({ group, onClose }: { group: GroupFull; onClose: () => void }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [name, setName] = useState(group.name);
  const [description, setDescription] = useState(group.description);
  const [privacy, setPrivacy] = useState(group.privacy);
  const [error, setError] = useState('');
  const save = async () => {
    try {
      const g = await api<Group>(`/groups/${group.id}`, { method: 'PATCH', body: { name, description, privacy } });
      qc.setQueryData<GroupFull>(['group', group.id], (old) => (old ? { ...old, ...g } : old));
      qc.invalidateQueries({ queryKey: ['groups'] });
      qc.invalidateQueries({ queryKey: ['group', group.id] });
      onClose();
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const remove = async () => {
    if (!confirm('Удалить сообщество и все его записи? Это действие нельзя отменить.')) return;
    await api(`/groups/${group.id}`, { method: 'DELETE' });
    qc.invalidateQueries({ queryKey: ['groups'] });
    navigate('/groups');
  };
  return (
    <Modal
      title="Управление сообществом"
      onClose={onClose}
      footer={
        <>
          {group.isOwner && (
            <button className="btn danger" style={{ marginRight: 'auto' }} onClick={remove}>
              <Trash2 size={16} /> Удалить
            </button>
          )}
          <button className="btn secondary" onClick={onClose}>
            Отмена
          </button>
          <button className="btn" onClick={save} disabled={!name.trim()}>
            Сохранить
          </button>
        </>
      }
    >
      <div className="modal-body">
        <div className="form-row">
          <label className="label">Название</label>
          <input className="field" value={name} maxLength={100} onChange={(e) => setName(e.target.value)} />
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

type Member = UserShort & { role: 'owner' | 'admin' | 'member' };

function MembersModal({ group, onClose }: { group: GroupFull; onClose: () => void }) {
  const qc = useQueryClient();
  const me = useMe();
  const { data, refetch } = useQuery({
    queryKey: ['group', group.id, 'members'],
    queryFn: () => api<Member[]>(`/groups/${group.id}/members`),
  });
  const [error, setError] = useState('');
  const run = async (fn: () => Promise<unknown>) => {
    setError('');
    try {
      await fn();
      await refetch();
      qc.invalidateQueries({ queryKey: ['group', group.id] });
    } catch (e) {
      setError((e as Error).message);
    }
  };
  return (
    <Modal title="Участники" onClose={onClose}>
      <div style={{ maxHeight: '60vh', overflowY: 'auto', padding: '8px 0' }}>
        {!data && <Spinner />}
        {data?.map((u) => (
          <div key={u.id} className="row">
            <Link to={`/id/${u.id}`} onClick={onClose}>
              <Avatar src={u.avatar} name={fullName(u)} id={u.id} size={40} online={u.online} />
            </Link>
            <div className="info">
              <Link to={`/id/${u.id}`} className="name" onClick={onClose}>
                {fullName(u)}
              </Link>
              {u.role !== 'member' && (
                <div className="meta">
                  {u.role === 'owner' ? <Crown size={12} style={{ verticalAlign: '-1px' }} /> : <Shield size={12} style={{ verticalAlign: '-1px' }} />}{' '}
                  {u.role === 'owner' ? 'Владелец' : 'Администратор'}
                </div>
              )}
            </div>
            {group.isAdmin && u.role !== 'owner' && u.id !== me.id && (
              <div className="actions">
                {(u.role === 'member' || group.isOwner) && (
                  <button
                    className="icon-btn"
                    title={u.role === 'admin' ? 'Снять администратора' : 'Назначить администратором'}
                    aria-label={u.role === 'admin' ? 'Снять администратора' : 'Назначить администратором'}
                    onClick={() => run(() => api(`/groups/${group.id}/members/${u.id}`, { method: 'PATCH', body: { role: u.role === 'admin' ? 'member' : 'admin' } }))}
                  >
                    <Shield size={16} className={u.role === 'admin' ? 'on' : ''} />
                  </button>
                )}
                {(u.role === 'member' || group.isOwner) && (
                  <button
                    className="icon-btn"
                    title="Исключить"
                    aria-label="Исключить из сообщества"
                    onClick={() => confirm(`Исключить ${fullName(u)}?`) && run(() => api(`/groups/${group.id}/members/${u.id}`, { method: 'DELETE' }))}
                  >
                    <UserMinus size={16} />
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
        {error && <div className="error-text" style={{ padding: '0 20px' }}>{error}</div>}
      </div>
    </Modal>
  );
}

function RequestsModal({ group, onClose }: { group: GroupFull; onClose: () => void }) {
  const qc = useQueryClient();
  const { data, refetch } = useQuery({
    queryKey: ['group', group.id, 'requests'],
    queryFn: () => api<(UserShort & { requestedAt: number })[]>(`/groups/${group.id}/requests`),
  });
  const decide = async (userId: number, accept: boolean) => {
    await api(`/groups/${group.id}/requests/${userId}`, { method: accept ? 'POST' : 'DELETE' });
    await refetch();
    qc.invalidateQueries({ queryKey: ['group', group.id] });
  };
  return (
    <Modal title="Заявки на вступление" onClose={onClose}>
      <div style={{ maxHeight: '60vh', overflowY: 'auto', padding: '8px 0' }}>
        {!data ? (
          <Spinner />
        ) : !data.length ? (
          <Empty icon={<UserCheck size={36} />} title="Новых заявок нет" />
        ) : (
          data.map((u) => (
            <div key={u.id} className="row">
              <Avatar src={u.avatar} name={fullName(u)} id={u.id} size={40} online={u.online} />
              <div className="info">
                <Link to={`/id/${u.id}`} className="name" onClick={onClose}>
                  {fullName(u)}
                </Link>
                <div className="meta">{formatDate(u.requestedAt)}</div>
              </div>
              <div className="actions">
                <button className="btn" onClick={() => decide(u.id, true)}>
                  <Check size={16} /> Принять
                </button>
                <button className="icon-btn" onClick={() => decide(u.id, false)} aria-label="Отклонить заявку" title="Отклонить">
                  <X size={18} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </Modal>
  );
}

export default function GroupPage() {
  const { id } = useParams();
  const groupId = Number(id);
  const qc = useQueryClient();
  const [modal, setModal] = useState<'edit' | 'members' | 'requests' | null>(null);

  const { data: group, isLoading, error } = useQuery({
    queryKey: ['group', groupId],
    queryFn: () => api<GroupFull>(`/groups/${groupId}`),
  });

  if (isLoading) return <Spinner />;
  if (error || !group)
    return (
      <div className="card">
        <Empty title="Сообщество не найдено" />
      </div>
    );

  const upload = async (kind: 'avatar' | 'cover') => {
    const [file] = await pickFile();
    if (!file) return;
    const g = await api<Group>(`/groups/${group.id}/${kind}`, { body: form({ image: file }) });
    qc.setQueryData<GroupFull>(['group', group.id], (old) => (old ? { ...old, ...g } : old));
  };

  const wallKey = ['posts', 'wall', 'group', groupId];

  return (
    <div className="col-main">
      <div className="card profile-header">
        <div className="cover" style={group.cover ? { backgroundImage: `url(${group.cover})` } : undefined}>
          {group.isAdmin && (
            <button className="btn secondary cover-edit" onClick={() => upload('cover')}>
              <Camera size={16} /> {group.cover ? 'Изменить обложку' : 'Добавить обложку'}
            </button>
          )}
        </div>
        <div className="profile-info">
          <div className="profile-avatar" style={{ borderRadius: '32%' }}>
            <Avatar src={group.avatar} name={group.name} id={group.id + 100} size={112} square />
            {group.isAdmin && (
              <button className="avatar-edit" onClick={() => upload('avatar')} aria-label="Изменить фотографию">
                <Camera size={26} />
              </button>
            )}
          </div>
          <div className="profile-name">
            <h1>{group.name}</h1>
            <div className="meta" style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              {group.privacy === 'closed' ? (
                <span className="pill">
                  <Lock size={11} /> Закрытое сообщество
                </span>
              ) : (
                <span className="pill">
                  <Globe size={11} /> Открытое сообщество
                </span>
              )}
              {countLabel(group.membersCount, 'участник', 'участника', 'участников')}
              {group.friendsInGroup > 0 && ` · ${countLabel(group.friendsInGroup, 'друг', 'друга', 'друзей')}`}
            </div>
          </div>
          <div className="profile-buttons">
            <JoinButton group={group} />
            {group.isAdmin && group.requestsCount > 0 && (
              <button className="btn secondary" onClick={() => setModal('requests')}>
                <UserPlus size={16} /> Заявки <span className="badge">{group.requestsCount}</span>
              </button>
            )}
            {!group.isAdmin && <ReportButton target={{ type: 'group', id: group.id }} className="icon-btn" />}
            {group.isAdmin && (
              <button className="btn secondary" onClick={() => setModal('edit')}>
                <Pencil size={16} /> Управление
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="columns stack">
        <div className="col-main">
          {group.isAdmin && <Composer ownerType="group" ownerId={group.id} queryKeys={[wallKey]} placeholder="Напишите что-нибудь от имени сообщества..." />}
          {group.canSeeContent ? (
            <PostList queryKey={wallKey} path={`/wall/group/${group.id}`} emptyText="В сообществе пока нет записей." />
          ) : (
            <div className="card">
              <Empty icon={<Lock size={40} />} title="Это закрытое сообщество">
                {group.requested ? 'Заявка отправлена — администраторы скоро её рассмотрят.' : 'Подайте заявку, чтобы видеть записи и участников.'}
              </Empty>
            </div>
          )}
        </div>
        <aside className="col-side static">
          <div className="card">
            <div className="card-title">Информация</div>
            <div style={{ padding: '0 20px 16px', whiteSpace: 'pre-wrap' }}>
              {group.description || <span className="muted">Описание не заполнено</span>}
              <div className="meta" style={{ marginTop: 8 }}>
                Создано {formatDate(group.createdAt)}
              </div>
            </div>
          </div>
          {group.canSeeContent && (
            <div className="card">
              <div className="card-title">
                <button className="more-link" style={{ color: 'var(--text)', fontWeight: 700 }} onClick={() => setModal('members')}>
                  Участники
                </button>
                <span className="count">{group.membersCount}</span>
                {group.isAdmin && (
                  <button className="more-link right" onClick={() => setModal('members')}>
                    Управлять
                  </button>
                )}
              </div>
              <div className="mini-grid">
                {group.membersSample.map((u) => (
                  <Link key={u.id} to={`/id/${u.id}`}>
                    <Avatar src={u.avatar} name={fullName(u)} id={u.id} size={52} online={u.online} />
                    <span>{u.firstName}</span>
                  </Link>
                ))}
              </div>
            </div>
          )}
          <div className="card">
            <div className="card-title">Контакты</div>
            {group.admins.map((u) => (
              <Link key={u.id} to={`/id/${u.id}`} className="row row-link" style={{ padding: '6px 16px', borderTop: 'none' }}>
                <Avatar src={u.avatar} name={fullName(u)} id={u.id} size={36} />
                <div className="info">
                  <div className="name ellipsis">{fullName(u)}</div>
                  <div className="meta">{u.id === group.ownerId ? 'Владелец' : 'Администратор'}</div>
                </div>
              </Link>
            ))}
          </div>
        </aside>
      </div>
      {modal === 'edit' && <EditGroupModal group={group} onClose={() => setModal(null)} />}
      {modal === 'members' && <MembersModal group={group} onClose={() => setModal(null)} />}
      {modal === 'requests' && <RequestsModal group={group} onClose={() => setModal(null)} />}
    </div>
  );
}
