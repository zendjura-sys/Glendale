import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Check, MessageCircle, UserCheck, UserPlus, X } from 'lucide-react';
import { api } from '../lib/api';
import type { Friendship, Profile, UserShort } from '../lib/types';
import { fullName, lastSeenText } from '../lib/utils';
import { Avatar } from './ui';

export function FriendButton({ userId, initial, compact }: { userId: number; initial: Friendship; compact?: boolean }) {
  const [status, setStatus] = useState<Friendship>(initial);
  const [busy, setBusy] = useState(false);
  const qc = useQueryClient();
  useEffect(() => setStatus(initial), [initial]);

  const act = async (method: 'POST' | 'DELETE') => {
    setBusy(true);
    try {
      const r = await api<{ friendship: Friendship }>(`/friends/${userId}`, { method });
      setStatus(r.friendship);
      qc.invalidateQueries({ queryKey: ['friends'] });
      qc.setQueryData<Profile>(['user', userId], (p) => (p ? { ...p, friendship: r.friendship } : p));
    } finally {
      setBusy(false);
    }
  };

  if (status === 'self') return null;
  if (compact) {
    if (status === 'none')
      return (
        <button className="icon-btn" onClick={() => act('POST')} disabled={busy} aria-label="Добавить в друзья">
          <UserPlus size={20} color="var(--icon-accent)" />
        </button>
      );
    return <Check size={20} color="var(--text-3)" />;
  }
  switch (status) {
    case 'friends':
      return (
        <button className="btn secondary" onClick={() => confirm('Удалить из друзей?') && act('DELETE')} disabled={busy}>
          <UserCheck size={16} /> У вас в друзьях
        </button>
      );
    case 'outgoing':
      return (
        <button className="btn secondary" onClick={() => act('DELETE')} disabled={busy}>
          <X size={16} /> Отменить заявку
        </button>
      );
    case 'incoming':
      return (
        <>
          <button className="btn" onClick={() => act('POST')} disabled={busy}>
            <UserPlus size={16} /> Принять заявку
          </button>
          <button className="btn secondary" onClick={() => act('DELETE')} disabled={busy}>
            Отклонить
          </button>
        </>
      );
    default:
      return (
        <button className="btn" onClick={() => act('POST')} disabled={busy}>
          <UserPlus size={16} /> Добавить в друзья
        </button>
      );
  }
}

export function UserRow({ user, children, sub }: { user: UserShort; children?: ReactNode; sub?: ReactNode }) {
  return (
    <div className="row">
      <Link to={`/id/${user.id}`}>
        <Avatar src={user.avatar} name={fullName(user)} id={user.id} size={64} online={user.online} />
      </Link>
      <div className="info">
        <Link to={`/id/${user.id}`} className="name" style={{ fontSize: 14 }}>
          {fullName(user)}
        </Link>
        <div className="meta">{sub ?? lastSeenText(user)}</div>
        <Link to={`/im/${user.id}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 6 }}>
          <MessageCircle size={14} /> Написать сообщение
        </Link>
      </div>
      {children && <div className="actions">{children}</div>}
    </div>
  );
}
