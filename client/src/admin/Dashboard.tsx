import { tr } from '../lib/i18n';
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

const bytes = (n: number) => (n > 1 << 20 ? tr('{n} МБ', { n: (n / (1 << 20)).toFixed(1) }) : tr('{n} КБ', { n: Math.round(n / 1024) }));
const uptime = (s: number) =>
  s > 86400
    ? tr('{d} д {h} ч', { d: Math.floor(s / 86400), h: Math.floor((s % 86400) / 3600) })
    : tr('{h} ч {m} мин', { h: Math.floor(s / 3600), m: Math.floor((s % 3600) / 60) });

export default function DashboardPage() {
  const me = useMe();
  const full = isAdminLevel(me.level.type);
  const { data } = useQuery({ queryKey: ['admin', 'dashboard'], queryFn: () => api<Dashboard>('/admin/dashboard') });
  if (!data) return <Spinner />;
  const t = data.totals;

  return (
    <>
      <AdminHead title={tr('Обзор')} subtitle={tr('Здравствуйте, {name}. Вот что происходит в сети.', { name: me.firstName })} />

      {(t.openReports > 0 || (full && t.pendingUsers > 0)) && (
        <div className="tiles">
          {t.openReports > 0 && <StatTile label={tr("Жалобы ждут решения")} value={t.openReports} icon={<Flag size={15} />} alert href="/admin/reports" />}
          {full && t.pendingUsers > 0 && (
            <StatTile label={tr("Ждут одобрения")} value={t.pendingUsers} icon={<UserCheck size={15} />} alert href="/admin/members?status=pending" />
          )}
        </div>
      )}

      <div className="tiles">
        <StatTile label={tr("Участники")} value={t.users} delta={tr('+{n} за неделю', { n: fmt(t.newUsersWeek) })} icon={<Users size={15} />} />
        <StatTile label={tr("Сейчас в сети")} value={t.online} icon={<Wifi size={15} />} />
        <StatTile label={tr("Записи")} value={t.posts} delta={tr('+{n} за неделю', { n: fmt(t.postsWeek) })} icon={<Newspaper size={15} />} />
        <StatTile label={tr("Комментарии")} value={t.comments} icon={<MessagesSquare size={15} />} />
        <StatTile label={tr("Сообщения")} value={t.messages} icon={<MessageCircle size={15} />} />
        <StatTile label={tr("Сообщества")} value={t.groups} icon={<UsersRound size={15} />} />
        <StatTile label={tr("Фотографии")} value={t.photos} icon={<Image size={15} />} />
        <StatTile label={tr("Заблокированы")} value={t.bannedUsers} icon={<Ban size={15} />} />
      </div>

      <div className="chart-grid">
        <div className="card">
          <div className="card-title">
            <UserPlus size={18} /> {tr('Регистрации за 14 дней')}
          </div>
          <BarChart data={data.activity.signups} unit={'регистрация|регистрации|регистраций'} />
        </div>
        <div className="card">
          <div className="card-title">
            <Newspaper size={18} /> {tr('Новые записи за 14 дней')}
          </div>
          <BarChart data={data.activity.posts} unit={'запись|записи|записей'} />
        </div>
        <div className="card">
          <div className="card-title">
            <MessageCircle size={18} /> {tr('Сообщения за 14 дней')}
          </div>
          <BarChart data={data.activity.messages} unit={'сообщение|сообщения|сообщений'} />
        </div>
      </div>

      <div className="columns">
        <div className="card" style={{ flex: 1, minWidth: 0 }}>
          <div className="card-title">
            {tr('Новые участники')}
            {full && (
              <Link to="/admin/members" className="right">
                {tr('Все участники')}
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
              {!u.approved && <span className="pill warn">{tr('Ждёт одобрения')}</span>}
              {!u.enabled && <span className="pill bad">{tr('Заблокирован')}</span>}
            </div>
          ))}
        </div>
        <div className="card col-side static" style={{ position: 'static' }}>
          <div className="card-title">{tr('Сервер')}</div>
          <dl className="info-list" style={{ gridTemplateColumns: '110px 1fr' }}>
            <dt>Node.js</dt>
            <dd>{data.system.node}</dd>
            <dt>{tr('Работает')}</dt>
            <dd>{uptime(data.system.uptime)}</dd>
            <dt>{tr('Память')}</dt>
            <dd>{bytes(data.system.memory)}</dd>
            <dt>{tr('База данных')}</dt>
            <dd>{data.system.dbSize ? bytes(data.system.dbSize) : tr('в памяти')}</dd>
          </dl>
        </div>
      </div>
    </>
  );
}
