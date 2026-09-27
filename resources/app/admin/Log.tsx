import { tr } from '../lib/i18n';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ScrollText } from 'lucide-react';
import { api } from '../lib/api';
import { formatDate, fullName } from '../lib/utils';
import { Avatar, Empty, Spinner } from '../components/ui';
import { AdminHead, Pager } from './ui';
import type { LogEntry, Paged } from './types';

const ACTIONS = (): Record<string, string> => ({
  'user.update': tr('Изменил участника'),
  'user.delete': tr('Удалил участника'),
  'user.login_as': tr('Вошёл как участник'),
  'user.logout_all': tr('Завершил сессии участника'),
  'user.bulk_approve': tr('Одобрил участников'),
  'user.bulk_verify': tr('Подтвердил участников'),
  'user.bulk_enable': tr('Разблокировал участников'),
  'user.bulk_disable': tr('Заблокировал участников'),
  'user.bulk_delete': tr('Удалил участников'),
  'level.create': tr('Создал уровень'),
  'level.update': tr('Изменил уровень'),
  'level.delete': tr('Удалил уровень'),
  'report.dismiss': tr('Отклонил жалобу'),
  'report.delete': tr('Удалил контент по жалобе'),
  'report.ban': tr('Заблокировал автора по жалобе'),
  'report.delete_ban': tr('Удалил контент и заблокировал автора'),
  'post.delete': tr('Удалил запись'),
  'comment.delete': tr('Удалил комментарий'),
  'group.delete': tr('Удалил сообщество'),
  'announcement.create': tr('Опубликовал объявление'),
  'announcement.update': tr('Изменил объявление'),
  'announcement.delete': tr('Удалил объявление'),
  'settings.update': tr('Изменил настройки'),
});

export default function LogPage() {
  const [page, setPage] = useState(1);
  const { data } = useQuery({ queryKey: ['admin', 'log', page], queryFn: () => api<Paged<LogEntry>>(`/admin/log?page=${page}`), placeholderData: (p) => p });
  return (
    <>
      <AdminHead title={tr('Журнал действий')} subtitle={tr("Кто из команды и что менял")} />
      <div className="card">
        {!data ? (
          <Spinner />
        ) : !data.items.length ? (
          <Empty icon={<ScrollText size={40} />} title={tr('Журнал пуст')} />
        ) : (
          <div className="table-wrap">
            <table className="admin">
              <thead>
                <tr>
                  <th>{tr('Кто')}</th>
                  <th>{tr('Действие')}</th>
                  <th>{tr('Объект')}</th>
                  <th className="hide-sm">{tr('Когда')}</th>
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
                    <td>{ACTIONS()[e.action] ?? e.action}</td>
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
