import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Ban, Flag, Image, MessageCircle, MessagesSquare, Newspaper, UserCheck, UserPlus, Users, UsersRound, Wifi } from 'lucide-react';
import { api } from '../lib/api';
import { useMe } from '../lib/auth';
import { isAdminLevel } from '../lib/types';
import { formatDate, fullName } from '../lib/utils';
import { Avatar, Spinner } from '../components/ui';
import { AdminHead, BarChart, StatTile, fmt } from './ui';
import type { Dashboard } from './types';

const bytes = (n: number) => (n > 1 << 20 ? `${(n / (1 << 20)).toFixed(1)} МБ` : `${Math.round(n / 1024)} КБ`);
const uptime = (s: number) => (s > 86400 ? `${Math.floor(s / 86400)} д ${Math.floor((s % 86400) / 3600)} ч` : `${Math.floor(s / 3600)} ч ${Math.floor((s % 3600) / 60)} мин`);

export default function DashboardPage() {
  const me = useMe();
  const full = isAdminLevel(me.level.type);
  const { data } = useQuery({ queryKey: ['admin', 'dashboard'], queryFn: () => api<Dashboard>('/admin/dashboard') });
  if (!data) return <Spinner />;
  const t = data.totals;

  return (
    <>
      <AdminHead title="Обзор" subtitle={`Здравствуйте, ${me.firstName}. Вот что происходит в сети.`} />

      {(t.openReports > 0 || (full && t.pendingUsers > 0)) && (
        <div className="tiles">
          {t.openReports > 0 && <StatTile label="Жалобы ждут решения" value={t.openReports} icon={<Flag size={15} />} alert href="/admin/reports" />}
          {full && t.pendingUsers > 0 && (
            <StatTile label="Ждут одобрения" value={t.pendingUsers} icon={<UserCheck size={15} />} alert href="/admin/members?status=pending" />
          )}
        </div>
      )}

      <div className="tiles">
        <StatTile label="Участники" value={t.users} delta={`+${fmt(t.newUsersWeek)} за неделю`} icon={<Users size={15} />} />
        <StatTile label="Сейчас в сети" value={t.online} icon={<Wifi size={15} />} />
        <StatTile label="Записи" value={t.posts} delta={`+${fmt(t.postsWeek)} за неделю`} icon={<Newspaper size={15} />} />
        <StatTile label="Комментарии" value={t.comments} icon={<MessagesSquare size={15} />} />
        <StatTile label="Сообщения" value={t.messages} icon={<MessageCircle size={15} />} />
        <StatTile label="Сообщества" value={t.groups} icon={<UsersRound size={15} />} />
        <StatTile label="Фотографии" value={t.photos} icon={<Image size={15} />} />
        <StatTile label="Заблокированы" value={t.bannedUsers} icon={<Ban size={15} />} />
      </div>

      <div className="chart-grid">
        <div className="card">
          <div className="card-title">
            <UserPlus size={18} /> Регистрации за 14 дней
          </div>
          <BarChart data={data.activity.signups} unit={['регистрация', 'регистрации', 'регистраций']} />
        </div>
        <div className="card">
          <div className="card-title">
            <Newspaper size={18} /> Новые записи за 14 дней
          </div>
          <BarChart data={data.activity.posts} unit={['запись', 'записи', 'записей']} />
        </div>
        <div className="card">
          <div className="card-title">
            <MessageCircle size={18} /> Сообщения за 14 дней
          </div>
          <BarChart data={data.activity.messages} unit={['сообщение', 'сообщения', 'сообщений']} />
        </div>
      </div>

      <div className="columns">
        <div className="card" style={{ flex: 1, minWidth: 0 }}>
          <div className="card-title">
            Новые участники
            {full && (
              <Link to="/admin/members" className="right">
                Все участники
              </Link>
            )}
          </div>
          {data.recentUsers.map((u) => (
            <div className="row" key={u.id}>
              <Avatar src={u.avatar} name={fullName(u)} id={u.id} size={36} online={u.online} />
              <div className="info">
                <Link to={`/id/${u.id}`} className="name">
                  {fullName(u)}
                </Link>
                <div className="meta">{formatDate(u.createdAt)}</div>
              </div>
              {!u.approved && <span className="pill warn">Ждёт одобрения</span>}
              {!u.enabled && <span className="pill bad">Заблокирован</span>}
            </div>
          ))}
        </div>
        <div className="card col-side static" style={{ position: 'static' }}>
          <div className="card-title">Сервер</div>
          <dl className="info-list" style={{ gridTemplateColumns: '110px 1fr' }}>
            <dt>Node.js</dt>
            <dd>{data.system.node}</dd>
            <dt>Работает</dt>
            <dd>{uptime(data.system.uptime)}</dd>
            <dt>Память</dt>
            <dd>{bytes(data.system.memory)}</dd>
            <dt>База данных</dt>
            <dd>{data.system.dbSize ? bytes(data.system.dbSize) : 'в памяти'}</dd>
          </dl>
        </div>
      </div>
    </>
  );
}
