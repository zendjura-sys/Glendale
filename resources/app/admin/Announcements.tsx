import { tr } from '../lib/i18n';
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Megaphone, Pencil, Plus, Trash2 } from 'lucide-react';
import { api } from '../lib/api';
import { formatDate, fullName } from '../lib/utils';
import { Empty, Modal, Spinner } from '../components/ui';
import { AdminHead, SwitchRow, Toggle } from './ui';
import type { AdminAnnouncement } from './types';

type Draft = { id?: number; title: string; body: string; active: boolean };

function Editor({ initial, onClose }: { initial: Draft; onClose: () => void }) {
  const qc = useQueryClient();
  const [d, setD] = useState(initial);
  const [error, setError] = useState('');
  const save = async () => {
    try {
      await api(d.id ? `/admin/announcements/${d.id}` : '/admin/announcements', { method: d.id ? 'PATCH' : 'POST', body: d });
      qc.invalidateQueries({ queryKey: ['admin', 'announcements'] });
      qc.invalidateQueries({ queryKey: ['announcements'] });
      onClose();
    } catch (e) {
      setError((e as Error).message);
    }
  };
  return (
    <Modal
      title={d.id ? tr('Объявление') : tr('Новое объявление')}
      onClose={onClose}
      footer={
        <>
          <button className="btn secondary" onClick={onClose}>
            {tr('Отмена')}
          </button>
          <button className="btn" onClick={save} disabled={!d.title.trim()}>
            {d.id ? tr('Сохранить') : tr('Опубликовать')}
          </button>
        </>
      }
    >
      <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <label className="label">{tr('Заголовок')}</label>
          <input className="field" autoFocus value={d.title} maxLength={150} onChange={(e) => setD({ ...d, title: e.target.value })} />
        </div>
        <div>
          <label className="label">{tr('Текст')}</label>
          <textarea className="field" value={d.body} maxLength={3000} onChange={(e) => setD({ ...d, body: e.target.value })} />
        </div>
        <SwitchRow title={tr('Показывать участникам')} hint={tr("Активные объявления видны вверху ленты новостей")} on={d.active} onChange={(v) => setD({ ...d, active: v })} />
        {error && <div className="error-text">{error}</div>}
      </div>
    </Modal>
  );
}

export default function AnnouncementsPage() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ['admin', 'announcements'], queryFn: () => api<AdminAnnouncement[]>('/admin/announcements') });
  const [edit, setEdit] = useState<Draft | null>(null);

  const toggle = async (a: AdminAnnouncement, active: boolean) => {
    await api(`/admin/announcements/${a.id}`, { method: 'PATCH', body: { active } });
    qc.invalidateQueries({ queryKey: ['admin', 'announcements'] });
    qc.invalidateQueries({ queryKey: ['announcements'] });
  };
  const remove = async (a: AdminAnnouncement) => {
    if (!confirm(tr('Удалить объявление «{title}»?', { title: a.title }))) return;
    await api(`/admin/announcements/${a.id}`, { method: 'DELETE' });
    qc.invalidateQueries({ queryKey: ['admin', 'announcements'] });
    qc.invalidateQueries({ queryKey: ['announcements'] });
  };

  return (
    <>
      <AdminHead title={tr('Объявления')} subtitle={tr("Сообщения для всех участников вверху ленты")}>
        <button className="btn" onClick={() => setEdit({ title: '', body: '', active: true })}>
          <Plus size={16} /> {tr('Новое объявление')}
        </button>
      </AdminHead>
      <div className="card">
        {!data ? (
          <Spinner />
        ) : !data.length ? (
          <Empty icon={<Megaphone size={40} />} title={tr('Объявлений пока нет')} />
        ) : (
          data.map((a) => (
            <div className="row" key={a.id} style={{ alignItems: 'flex-start' }}>
              <div className="info">
                <b>{a.title}</b>
                {a.body && <div className="muted" style={{ whiteSpace: 'pre-wrap', margin: '4px 0' }}>{a.body}</div>}
                <div className="meta">
                  {formatDate(a.createdAt)}
                  {a.author && ` · ${fullName(a.author)}`}
                </div>
              </div>
              <div className="actions" style={{ alignItems: 'center' }}>
                <Toggle on={a.active} onChange={(v) => toggle(a, v)} label={tr("Показывать")} />
                <button className="icon-btn" onClick={() => setEdit(a)} aria-label={tr('Редактировать')}>
                  <Pencil size={16} />
                </button>
                <button className="icon-btn" onClick={() => remove(a)} aria-label={tr('Удалить')}>
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
      {edit && <Editor initial={edit} onClose={() => setEdit(null)} />}
    </>
  );
}
