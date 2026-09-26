import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Cake, Camera, Info, MapPin, MessageCircle, Pencil } from 'lucide-react';
import { api, form } from '../lib/api';
import { useAuth, useMe } from '../lib/auth';
import type { Profile, User } from '../lib/types';
import { countLabel, formatBirthday, formatDate, fullName, lastSeenText, plural } from '../lib/utils';
import { Composer } from '../components/Composer';
import { PostList } from '../components/Post';
import { Avatar, Empty, Modal, PhotoViewer, Spinner, pickFile } from '../components/ui';
import { FriendButton } from '../components/People';

function StatusEditor({ value, onDone }: { value: string; onDone: () => void }) {
  const { setUser } = useAuth();
  const qc = useQueryClient();
  const [text, setText] = useState(value);
  const save = async () => {
    const u = await api<User>('/me', { method: 'PATCH', body: { status: text } });
    setUser(u);
    qc.invalidateQueries({ queryKey: ['user', u.id] });
    onDone();
  };
  return (
    <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
      <input
        className="field"
        autoFocus
        value={text}
        maxLength={140}
        placeholder="Введите статус"
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') save();
          if (e.key === 'Escape') onDone();
        }}
      />
      <button className="btn" onClick={save}>
        Сохранить
      </button>
    </div>
  );
}

function DetailsModal({ user, onClose }: { user: Profile; onClose: () => void }) {
  return (
    <Modal title="Подробная информация" onClose={onClose}>
      <dl className="info-list" style={{ paddingTop: 16 }}>
        {user.status && (
          <>
            <dt>Статус</dt>
            <dd>{user.status}</dd>
          </>
        )}
        {user.birthday && (
          <>
            <dt>День рождения</dt>
            <dd>{formatBirthday(user.birthday)}</dd>
          </>
        )}
        {user.city && (
          <>
            <dt>Город</dt>
            <dd>{user.city}</dd>
          </>
        )}
        {user.bio && (
          <>
            <dt>О себе</dt>
            <dd>{user.bio}</dd>
          </>
        )}
        <dt>На Glendale с</dt>
        <dd>{formatDate(user.createdAt)}</dd>
      </dl>
      <div className="counters">
        <Link to={`/friends?id=${user.id}`}>
          <b>{user.counts.friends}</b>
          {plural(user.counts.friends, 'друг', 'друга', 'друзей')}
        </Link>
        <Link to={`/friends?id=${user.id}`}>
          <b>{user.counts.followers}</b>подписчиков
        </Link>
        <Link to={`/photos/${user.id}`}>
          <b>{user.counts.photos}</b>фото
        </Link>
        <Link to={`/groups?id=${user.id}`}>
          <b>{user.counts.groups}</b>сообществ
        </Link>
      </div>
    </Modal>
  );
}

export default function ProfilePage() {
  const { id } = useParams();
  const userId = Number(id);
  const me = useMe();
  const { setUser } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const own = userId === me.id;
  const [editingStatus, setEditingStatus] = useState(false);
  const [details, setDetails] = useState(false);
  const [viewer, setViewer] = useState<{ urls: string[]; index: number } | null>(null);
  const [uploading, setUploading] = useState(false);

  const { data: user, isLoading, error } = useQuery({
    queryKey: ['user', userId],
    queryFn: () => api<Profile>(`/users/${userId}`),
    enabled: Number.isInteger(userId),
  });

  if (isLoading) return <Spinner />;
  if (error || !user)
    return (
      <div className="card">
        <Empty title="Страница не найдена">Возможно, она была удалена или ещё не создана.</Empty>
      </div>
    );

  const upload = async (kind: 'avatar' | 'cover') => {
    const [file] = await pickFile();
    if (!file) return;
    setUploading(true);
    try {
      const u = await api<User>(`/me/${kind}`, { body: form({ image: file }) });
      setUser(u);
      qc.invalidateQueries({ queryKey: ['user', me.id] });
      qc.invalidateQueries({ queryKey: ['photos', me.id] });
    } finally {
      setUploading(false);
    }
  };

  const name = fullName(user);
  const wallKey = ['posts', 'wall', 'user', userId];
  const canPost = own || user.friendship === 'friends';

  return (
    <div className="col-main">
      <div className="card profile-header">
        <div className="cover" style={user.cover ? { backgroundImage: `url(${user.cover})` } : undefined}>
          {own && (
            <button className="btn secondary cover-edit" onClick={() => upload('cover')} disabled={uploading}>
              <Camera size={16} /> {user.cover ? 'Изменить обложку' : 'Добавить обложку'}
            </button>
          )}
        </div>
        <div className="profile-info">
          <div className="profile-avatar">
            <div style={{ cursor: user.avatar ? 'zoom-in' : undefined }} onClick={() => user.avatar && setViewer({ urls: [user.avatar], index: 0 })}>
              <Avatar src={user.avatar} name={name} id={user.id} size={128} />
            </div>
            {own && (
              <button className="avatar-edit" onClick={() => upload('avatar')} aria-label="Изменить фотографию">
                <Camera size={28} />
              </button>
            )}
          </div>
          <div className="profile-name">
            <h1>
              {name}
              {user.online && <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--online)' }} title="онлайн" />}
            </h1>
            {editingStatus ? (
              <StatusEditor value={user.status} onDone={() => setEditingStatus(false)} />
            ) : own ? (
              <div
                className={`profile-status${user.status ? '' : ' empty'}`}
                style={{ cursor: 'pointer' }}
                onClick={() => setEditingStatus(true)}
              >
                {user.status || 'Установить статус'}
              </div>
            ) : (
              user.status && <div className="profile-status">{user.status}</div>
            )}
            {!own && <div className="meta" style={{ marginTop: 4 }}>{lastSeenText(user)}</div>}
          </div>
          <div className="profile-buttons">
            {own ? (
              <button className="btn secondary" onClick={() => navigate('/settings')}>
                <Pencil size={16} /> Редактировать профиль
              </button>
            ) : (
              <>
                <FriendButton userId={user.id} initial={user.friendship} />
                <button className="btn secondary" onClick={() => navigate(`/im/${user.id}`)}>
                  <MessageCircle size={16} /> Сообщение
                </button>
              </>
            )}
          </div>
        </div>
        <div className="profile-details">
          {user.city && (
            <span>
              <MapPin size={16} /> {user.city}
            </span>
          )}
          {user.birthday && (
            <span>
              <Cake size={16} /> {formatBirthday(user.birthday)}
            </span>
          )}
          <button className="more-link" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }} onClick={() => setDetails(true)}>
            <Info size={16} /> Подробнее
          </button>
        </div>
        <div className="counters">
          <Link to={`/friends?id=${user.id}`}>
            <b>{user.counts.friends}</b>
            {plural(user.counts.friends, 'друг', 'друга', 'друзей')}
          </Link>
          {!own && user.counts.mutual > 0 && (
            <Link to={`/friends?id=${user.id}`}>
              <b>{user.counts.mutual}</b>
              общих
            </Link>
          )}
          <Link to={`/photos/${user.id}`}>
            <b>{user.counts.photos}</b>фото
          </Link>
          <Link to={`/groups?id=${user.id}`}>
            <b>{user.counts.groups}</b>
            {plural(user.counts.groups, 'сообщество', 'сообщества', 'сообществ')}
          </Link>
          <Link to={`/id/${user.id}`}>
            <b>{user.counts.posts}</b>
            {plural(user.counts.posts, 'запись', 'записи', 'записей')}
          </Link>
        </div>
      </div>

      <div className="columns stack">
        <div className="col-main">
          {user.photosSample.length > 0 && (
            <div className="card">
              <div className="card-title">
                <Link to={`/photos/${user.id}`}>Фотографии</Link> <span className="count">{user.counts.photos}</span>
                <Link to={`/photos/${user.id}`} className="right">
                  Показать все
                </Link>
              </div>
              <div className="photo-grid small">
                {user.photosSample.map((p, i) => (
                  <button key={p.id} className="photo-tile" onClick={() => setViewer({ urls: user.photosSample.map((x) => x.url), index: i })}>
                    <img src={p.url} alt="" loading="lazy" />
                  </button>
                ))}
              </div>
            </div>
          )}
          {canPost && (
            <Composer
              ownerId={user.id}
              queryKeys={[wallKey]}
              placeholder={own ? 'Что у вас нового?' : `Напишите что-нибудь ${user.firstName}...`}
            />
          )}
          <div className="card">
            <div className="card-title">
              {own ? 'Мои записи' : `Записи ${user.firstName}`} <span className="count">{user.counts.posts}</span>
            </div>
          </div>
          <PostList queryKey={wallKey} path={`/wall/user/${user.id}`} emptyText={own ? 'Напишите первую запись.' : 'На стене пока нет записей.'} />
        </div>

        <aside className="col-side static">
          <div className="card">
            <div className="card-title">
              <Link to={`/friends?id=${user.id}`}>Друзья</Link> <span className="count">{user.counts.friends}</span>
            </div>
            {user.friendsSample.length ? (
              <div className="mini-grid">
                {user.friendsSample.map((f) => (
                  <Link key={f.id} to={`/id/${f.id}`}>
                    <Avatar src={f.avatar} name={fullName(f)} id={f.id} size={56} online={f.online} />
                    <span>{f.firstName}</span>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="muted" style={{ padding: '0 20px 16px' }}>
                Пока нет друзей
              </div>
            )}
          </div>
          {user.groupsSample.length > 0 && (
            <div className="card">
              <div className="card-title">
                <Link to={`/groups?id=${user.id}`}>Сообщества</Link> <span className="count">{user.counts.groups}</span>
              </div>
              {user.groupsSample.map((g) => (
                <Link key={g.id} to={`/club/${g.id}`} className="row row-link" style={{ padding: '6px 16px', borderTop: 'none' }}>
                  <Avatar src={g.avatar} name={g.name} id={g.id + 100} square size={36} />
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

      {details && <DetailsModal user={user} onClose={() => setDetails(false)} />}
      {viewer && <PhotoViewer {...viewer} onClose={() => setViewer(null)} />}
    </div>
  );
}
