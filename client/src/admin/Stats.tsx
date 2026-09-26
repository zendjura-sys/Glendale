import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { fullName } from '../lib/utils';
import { Avatar, Spinner } from '../components/ui';
import { AdminHead, BarChart, HBars, StatTile } from './ui';
import type { Stats } from './types';

const SERIES: [keyof Stats['series'], string, [string, string, string]][] = [
  ['signups', 'Регистрации', ['регистрация', 'регистрации', 'регистраций']],
  ['posts', 'Записи', ['запись', 'записи', 'записей']],
  ['comments', 'Комментарии', ['комментарий', 'комментария', 'комментариев']],
  ['likes', 'Лайки', ['лайк', 'лайка', 'лайков']],
  ['messages', 'Сообщения', ['сообщение', 'сообщения', 'сообщений']],
];

export default function StatsPage() {
  const [days, setDays] = useState(30);
  const { data } = useQuery({ queryKey: ['admin', 'stats', days], queryFn: () => api<Stats>(`/admin/stats?days=${days}`), placeholderData: (p) => p });

  return (
    <>
      <AdminHead title="Статистика" subtitle="Активность в сети по дням">
        <div className="segmented">
          {[7, 30, 90].map((d) => (
            <button key={d} className={days === d ? 'on' : ''} onClick={() => setDays(d)}>
              {d} дней
            </button>
          ))}
        </div>
      </AdminHead>
      {!data ? (
        <Spinner />
      ) : (
        <>
          <div className="tiles">
            {SERIES.map(([key, label]) => (
              <StatTile key={key} label={`${label} за ${days} дн.`} value={data.series[key].reduce((s, d) => s + d.count, 0)} />
            ))}
          </div>
          {/* Small multiples: one single-series chart per measure, so every chart keeps its own honest scale. */}
          <div className="chart-grid">
            {SERIES.map(([key, label, unit]) => (
              <div className="card" key={key}>
                <div className="card-title">{label}</div>
                <BarChart data={data.series[key]} unit={unit} height={150} />
              </div>
            ))}
          </div>
          <div className="chart-grid">
            <div className="card">
              <div className="card-title">Самые активные авторы</div>
              <HBars
                rows={data.topPosters.map((r) => ({
                  key: r.user.id,
                  value: r.posts,
                  label: (
                    <Link to={`/id/${r.user.id}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: 'var(--text)' }}>
                      <Avatar src={r.user.avatar} name={fullName(r.user)} id={r.user.id} size={22} />
                      {r.user.firstName}
                    </Link>
                  ),
                }))}
              />
            </div>
            <div className="card">
              <div className="card-title">Крупнейшие сообщества</div>
              <HBars rows={data.topGroups.map((g) => ({ key: g.id, value: g.members, label: <Link to={`/club/${g.id}`} style={{ color: 'var(--text)' }}>{g.name}</Link> }))} />
            </div>
            <div className="card">
              <div className="card-title">Участники по уровням</div>
              <HBars rows={data.levels.map((l) => ({ key: l.title, value: l.count, label: l.title }))} />
            </div>
          </div>
        </>
      )}
    </>
  );
}
