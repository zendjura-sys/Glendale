import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ScrollText } from 'lucide-react';
import { api } from '../lib/api';
import { formatDate, fullName } from '../lib/utils';
import { Avatar, Empty, Spinner } from '../components/ui';
import { AdminHead, Pager } from './ui';
import type { LogEntry, Paged } from './types';

const ACTIONS: Record<string, string> = {
  'user.update': 'Изменил участника',
  'user.delete': 'Удалил участника',
  'user.login_as': 'Вошёл как участник',
  'user.logout_all': 'Завершил сессии участника',
  'user.bulk_approve': 'Одобрил участников',
  'user.bulk_verify': 'Подтвердил участников',
  'user.bulk_enable': 'Разблокировал участников',
  'user.bulk_disable': 'Заблокировал участников',
  'user.bulk_delete': 'Удалил участников',
  'level.create': 'Создал уровень',
  'level.update': 'Изменил уровень',
  'level.delete': 'Удалил уровень',
  'report.dismiss': 'Отклонил жалобу',
  'report.delete': 'Удалил контент по жалобе',
  'report.ban': 'Заблокировал автора по жалобе',
  'report.delete_ban': 'Удалил контент и заблокировал автора',
  'post.delete': 'Удалил запись',
  'comment.delete': 'Удалил комментарий',
  'group.delete': 'Удалил сообщество',
  'announcement.create': 'Опубликовал объявление',
  'announcement.update': 'Изменил объявление',
  'announcement.delete': 'Удалил объявление',
  'settings.update': 'Изменил настройки',
};

export default function LogPage() {
  const [page, setPage] = useState(1);
  const { data } = useQuery({ queryKey: ['admin', 'log', page], queryFn: () => api<Paged<LogEntry>>(`/admin/log?page=${page}`), placeholderData: (p) => p });
  return (
    <>
      <AdminHead title="Журнал действий" subtitle="Кто из команды и что менял" />
      <div className="card">
        {!data ? (
          <Spinner />
        ) : !data.items.length ? (
          <Empty icon={<ScrollText size={40} />} title="Журнал пуст" />
        ) : (
          <div className="table-wrap">
            <table className="admin">
              <thead>
                <tr>
                  <th>Кто</th>
                  <th>Действие</th>
                  <th>Объект</th>
                  <th className="hide-sm">Когда</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((e) => (
                  <tr key={e.id}>
                    <td>
                      {e.admin && (
                        <div className="who" style={{ minWidth: 140 }}>
                          <Avatar src={e.admin.avatar} name={fullName(e.admin)} id={e.admin.id} size={26} />
                          {fullName(e.admin)}
                        </div>
                      )}
                    </td>
                    <td>{ACTIONS[e.action] ?? e.action}</td>
                    <td>
                      {e.target}
                      {e.details && e.details !== '{}' && <div className="meta ellipsis" style={{ maxWidth: 280 }}>{e.details}</div>}
                    </td>
                    <td className="hide-sm muted" style={{ whiteSpace: 'nowrap' }}>
                      {formatDate(e.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {data && <Pager page={page} total={data.total} perPage={data.perPage} onPage={setPage} />}
      </div>
    </>
  );
}
