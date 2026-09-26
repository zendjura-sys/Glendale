import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Camera, Check, Pencil, Plus, Trash2 } from 'lucide-react';
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
  const [member, setMember] = useState(group.isMember);
  const [busy, setBusy] = useState(false);
  useEffect(() => setMember(group.isMember), [group.isMember]);
  const toggle = async () => {
    setBusy(true);
    try {
      const g = await api<Group>(`/groups/${group.id}/join`, { method: member ? 'DELETE' : 'POST' });
      setMember(g.isMember);
      qc.setQueryData<GroupFull>(['group', group.id], (old) => (old ? { ...old, ...g } : old));
      qc.invalidateQueries({ queryKey: ['groups'] });
      qc.invalidateQueries({ queryKey: ['posts', 'feed'] });
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  if (group.isAdmin && member) {
    return compact ? <Check size={20} color="var(--text-3)" /> : <button className="btn secondary" disabled>Вы администратор</button>;
  }
  if (compact)
    return member ? (
      <Check size={20} color="var(--text-3)" />
    ) : (
      <button className="icon-btn" onClick={toggle} disabled={busy} aria-label="Вступить">
        <Plus size={22} color="var(--icon-accent)" />
      </button>
    );
  return member ? (
    <button className="btn secondary" onClick={toggle} disabled={busy}>
      <Check size={16} /> Вы участник
    </button>
  ) : (
    <button className="btn" onClick={toggle} disabled={busy}>
      Вступить в сообщество
    </button>
  );
}

function EditGroupModal({ group, onClose }: { group: GroupFull; onClose: () => void }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const me = useMe();
  const [name, setName] = useState(group.name);
  const [description, setDescription] = useState(group.description);
  const [error, setError] = useState('');
  const save = async () => {
    try {
      const g = await api<Group>(`/groups/${group.id}`, { method: 'PATCH', body: { name, description } });
      qc.setQueryData<GroupFull>(['group', group.id], (old) => (old ? { ...old, ...g } : old));
      qc.invalidateQueries({ queryKey: ['groups'] });
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
          {group.ownerId === me.id && (
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
        {error && <div className="error-text">{error}</div>}
      </div>
    </Modal>
  );
}

function MembersModal({ groupId, onClose }: { groupId: number; onClose: () => void }) {
  const { data } = useQuery({
    queryKey: ['group', groupId, 'members'],
    queryFn: () => api<(UserShort & { role: string })[]>(`/groups/${groupId}/members`),
  });
  return (
    <Modal title="Участники" onClose={onClose}>
      <div style={{ maxHeight: '60vh', overflowY: 'auto', padding: '8px 0' }}>
        {!data && <Spinner />}
        {data?.map((u) => (
          <Link key={u.id} to={`/id/${u.id}`} className="row row-link" onClick={onClose}>
            <Avatar src={u.avatar} name={fullName(u)} id={u.id} size={40} online={u.online} />
            <div className="info">
              <div className="name">{fullName(u)}</div>
              {u.role === 'admin' && <div className="meta">Администратор</div>}
            </div>
          </Link>
        ))}
      </div>
    </Modal>
  );
}

export default function GroupPage() {
  const { id } = useParams();
  const groupId = Number(id);
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [members, setMembers] = useState(false);

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
            <Avatar src={group.avatar} name={group.name} id={group.id + 100} square size={112} />
            {group.isAdmin && (
              <button className="avatar-edit" onClick={() => upload('avatar')} aria-label="Изменить фотографию">
                <Camera size={26} />
              </button>
            )}
          </div>
          <div className="profile-name">
            <h1>{group.name}</h1>
            <div className="meta" style={{ marginTop: 4 }}>
              {countLabel(group.membersCount, 'участник', 'участника', 'участников')}
              {group.friendsInGroup > 0 && ` · ${countLabel(group.friendsInGroup, 'друг', 'друга', 'друзей')}`}
            </div>
          </div>
          <div className="profile-buttons">
            <JoinButton group={group} />
            {!group.isAdmin && <ReportButton target={{ type: 'group', id: group.id }} className="icon-btn" />}
            {group.isAdmin && (
              <button className="btn secondary" onClick={() => setEditing(true)}>
                <Pencil size={16} /> Управление
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="columns stack">
        <div className="col-main">
          {group.isAdmin && <Composer ownerType="group" ownerId={group.id} queryKeys={[wallKey]} placeholder="Напишите что-нибудь от имени сообщества..." />}
          <PostList queryKey={wallKey} path={`/wall/group/${group.id}`} emptyText="В сообществе пока нет записей." />
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
          <div className="card">
            <div className="card-title">
              <button className="more-link" style={{ color: 'var(--text)', fontWeight: 500 }} onClick={() => setMembers(true)}>
                Участники
              </button>
              <span className="count">{group.membersCount}</span>
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
          <div className="card">
            <div className="card-title">Контакты</div>
            {group.admins.map((u) => (
              <Link key={u.id} to={`/id/${u.id}`} className="row row-link" style={{ padding: '6px 16px', borderTop: 'none' }}>
                <Avatar src={u.avatar} name={fullName(u)} id={u.id} size={36} />
                <div className="info">
                  <div className="name ellipsis">{fullName(u)}</div>
                  <div className="meta">Администратор</div>
                </div>
              </Link>
            ))}
          </div>
        </aside>
      </div>
      {editing && <EditGroupModal group={group} onClose={() => setEditing(false)} />}
      {members && <MembersModal groupId={group.id} onClose={() => setMembers(false)} />}
    </div>
  );
}
