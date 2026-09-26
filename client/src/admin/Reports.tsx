import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Ban, Check, ExternalLink, Flag, Trash2 } from 'lucide-react';
import { api } from '../lib/api';
import { formatDate, fullName } from '../lib/utils';
import { Avatar, Empty, Spinner } from '../components/ui';
import { AdminHead, Pager } from './ui';
import type { Paged, Report } from './types';

const TARGET_LABEL: Record<Report['targetType'], string> = {
  post: 'Запись',
  comment: 'Комментарий',
  user: 'Профиль',
  group: 'Сообщество',
  message: 'Сообщение',
};

type Status = 'open' | 'resolved' | 'dismissed';

function ReportCard({ r, onDone }: { r: Report; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const resolve = async (action: string, confirmText?: string) => {
    if (confirmText && !confirm(confirmText)) return;
    setBusy(true);
    setError('');
    try {
      await api(`/admin/reports/${r.id}/resolve`, { body: { action } });
      onDone();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };
  const author = r.target.author;
  const canDeleteContent = r.target.exists && r.targetType !== 'user';

  return (
    <div className="report-card">
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span className="pill bad">
            <Flag size={12} /> {r.categoryLabel}
          </span>
          <b>{TARGET_LABEL[r.targetType]}</b>
          {author && (
            <>
              {' '}
              от{' '}
              <Link to={`/id/${author.id}`} className="name">
                {fullName(author)}
              </Link>
            </>
          )}
          {r.duplicates > 1 && r.status === 'open' && <span className="pill warn">жалоб: {r.duplicates}</span>}
        </div>
        {r.target.exists ? (
          <div className="quote">
            {r.target.text || <span className="muted">без текста</span>}
            {r.target.image && <img src={r.target.image} alt="" />}
          </div>
        ) : (
          <div className="quote muted">Объект уже удалён</div>
        )}
        <div className="meta" style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          {r.reporter && (
            <>
              <Avatar src={r.reporter.avatar} name={fullName(r.reporter)} id={r.reporter.id} size={18} />
              {fullName(r.reporter)} · {formatDate(r.createdAt)}
            </>
          )}
          {r.description && <span>· «{r.description}»</span>}
          {r.target.link && (
            <Link to={r.target.link} style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
              · открыть <ExternalLink size={12} />
            </Link>
          )}
        </div>
        {r.status !== 'open' && (
          <div className="meta" style={{ marginTop: 6 }}>
            {r.status === 'dismissed' ? 'Отклонена' : `Решена: ${r.resolution}`}
            {r.resolvedBy && ` · ${fullName(r.resolvedBy)}`}
            {r.resolvedAt && ` · ${formatDate(r.resolvedAt)}`}
          </div>
        )}
        {error && <div className="error-text">{error}</div>}
        {r.status === 'open' && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
            {canDeleteContent && (
              <button className="btn" disabled={busy} onClick={() => resolve('delete')}>
                <Trash2 size={16} /> Удалить
              </button>
            )}
            {canDeleteContent && author && (
              <button className="btn secondary" disabled={busy} onClick={() => resolve('delete_ban', `Удалить и заблокировать ${fullName(author)}?`)}>
                <Ban size={16} /> Удалить и заблокировать
              </button>
            )}
            {!canDeleteContent && author && (
              <button className="btn secondary" disabled={busy} onClick={() => resolve('ban', `Заблокировать ${fullName(author)}?`)}>
                <Ban size={16} /> Заблокировать автора
              </button>
            )}
            <button className="btn secondary" disabled={busy} onClick={() => resolve('dismiss')}>
              <Check size={16} /> Нарушений нет
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ReportsPage() {
  const qc = useQueryClient();
  const [status, setStatus] = useState<Status>('open');
  const [page, setPage] = useState(1);
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'reports', status, page],
    queryFn: () => api<Paged<Report>>(`/admin/reports?status=${status}&page=${page}`),
  });
  const done = () => {
    qc.invalidateQueries({ queryKey: ['admin', 'reports'] });
    qc.invalidateQueries({ queryKey: ['admin', 'dashboard'] });
  };

  return (
    <>
      <AdminHead title="Жалобы" subtitle="Сообщения участников о нарушениях" />
      <div className="card">
        <div className="toolbar">
          <div className="segmented">
            {(
              [
                ['open', 'Новые'],
                ['resolved', 'Решённые'],
                ['dismissed', 'Отклонённые'],
              ] as [Status, string][]
            ).map(([s, label]) => (
              <button
                key={s}
                className={status === s ? 'on' : ''}
                onClick={() => {
                  setStatus(s);
                  setPage(1);
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        {isLoading ? (
          <Spinner />
        ) : !data?.items.length ? (
          <Empty icon={<Flag size={40} />} title={status === 'open' ? 'Новых жалоб нет' : 'Здесь пусто'}>
            {status === 'open' ? 'Всё спокойно — можно выпить чаю.' : ''}
          </Empty>
        ) : (
          // Several open reports about the same object collapse into one card (newest first).
          data.items
            .filter((r, i, all) => r.status !== 'open' || all.findIndex((x) => x.targetType === r.targetType && x.targetId === r.targetId) === i)
            .map((r) => <ReportCard key={r.id} r={r} onDone={done} />)
        )}
        {data && data.total > data.perPage && <Pager page={page} total={data.total} perPage={data.perPage} onPage={setPage} />}
      </div>
    </>
  );
}
