import { useEffect } from 'react';
import { api } from '../lib/api';
import { useRealtime } from '../lib/realtime';
import { NotificationList } from '../components/Notifications';

export default function NotificationsPage() {
  const { counters, setCounters } = useRealtime();
  useEffect(() => {
    if (!counters.notifications) return;
    api('/notifications/read', { method: 'POST' }).catch(() => {});
    setCounters({ ...counters, notifications: 0 });
  }, [counters.notifications]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="col-main">
      <div className="card" style={{ paddingBottom: 8 }}>
        <div className="card-title" style={{ borderBottom: '1px solid var(--separator)', paddingBottom: 14 }}>
          Уведомления
        </div>
        <NotificationList />
      </div>
    </div>
  );
}
