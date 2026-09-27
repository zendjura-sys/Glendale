import { tr } from '../lib/i18n';
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Star, Trash2 } from 'lucide-react';
import { api } from '../lib/api';
import { useMe } from '../lib/auth';
import { Modal, Spinner } from '../components/ui';
import { AdminHead, LEVEL_TYPE_LABEL, SwitchRow, fmt } from './ui';
import type { Level, PermissionKey } from './types';

const PERMS = (): [PermissionKey, string, string][] => ([
  ['can_post', tr('Публиковать записи'), tr('Записи на стенах и репосты')],
  ['can_comment', tr('Комментировать'), tr('Комментарии к записям')],
  ['can_message', tr('Писать сообщения'), tr('Личные сообщения в мессенджере')],
  ['can_create_groups', tr('Создавать сообщества'), ''],
  ['can_upload', tr('Загружать фотографии'), tr('Аватар, обложка, фото в записях и альбомах')],
]);

type Draft = Omit<Level, 'id' | 'members'> & { id?: number };

const EMPTY: Draft = {
  title: '',
  description: '',
  type: 'user',
  isDefault: false,
  floodSeconds: 0,
  permissions: { can_post: true, can_comment: true, can_message: true, can_create_groups: true, can_upload: true },
};

function LevelModal({ initial, onClose }: { initial: Draft; onClose: () => void }) {
  const me = useMe();
  const qc = useQueryClient();
  const [d, setD] = useState<Draft>(initial);
  const [error, setError] = useState('');
  const locked = d.type === 'superadmin';

  const save = async () => {
    try {
      await api(d.id ? `/admin/levels/${d.id}` : '/admin/levels', { method: d.id ? 'PATCH' : 'POST', body: d });
      qc.invalidateQueries({ queryKey: ['admin', 'levels'] });
      onClose();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <Modal
      title={d.id ? tr('Уровень доступа') : tr('Новый уровень')}
      onClose={onClose}
      footer={
        <>
          <button className="btn secondary" onClick={onClose}>
            {tr('Отмена')}
          </button>
          <button className="btn" onClick={save} disabled={!d.title.trim()}>
            {tr('Сохранить')}
          </button>
        </>
      }
    >
      <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <label className="label">{tr('Название')}</label>
          <input className="field" value={d.title} maxLength={60} onChange={(e) => setD({ ...d, title: e.target.value })} />
        </div>
        <div>
          <label className="label">{tr('Описание')}</label>
          <input className="field" value={d.description} maxLength={300} onChange={(e) => setD({ ...d, description: e.target.value })} />
        </div>
        {!locked && (
          <div>
            <label className="label">{tr('Тип')}</label>
            <div className="segmented">
              {(['user', 'moderator', 'admin'] as const)
                .filter((t) => t !== 'admin' || me.level.type === 'superadmin' || d.type === 'admin')
                .map((t) => (
                  <button key={t} className={d.type === t ? 'on' : ''} onClick={() => setD({ ...d, type: t })}>
                    {LEVEL_TYPE_LABEL()[t]}
                  </button>
                ))}
            </div>
            <div className="settings-form" style={{ padding: 0 }}>
              <div className="hint">
                {tr('Модераторы разбирают жалобы и чистят контент. Администраторы получают всю админ-панель.')}
              </div>
            </div>
          </div>
        )}
        <div>
          {PERMS().map(([key, title, hint]) => (
            <SwitchRow
              key={key}
              title={title}
              hint={hint}
              on={d.permissions[key]}
              onChange={(v) => setD({ ...d, permissions: { ...d.permissions, [key]: v } })}
            />
          ))}
          <div className="switch-row">
            <div className="text">
              <b>{tr('Пауза между записями')}</b>
              <span>{tr('Защита от флуда, в секундах (0 — без ограничений)')}</span>
            </div>
            <input
              className="field"
              type="number"
              min={0}
              max={3600}
              style={{ width: 90 }}
              value={d.floodSeconds}
              onChange={(e) => setD({ ...d, floodSeconds: Number(e.target.value) })}
            />
          </div>
          {d.type === 'user' && !initial.isDefault && (
            <SwitchRow title={tr('Уровень по умолчанию')} hint={tr("Назначается новым участникам при регистрации")} on={d.isDefault} onChange={(v) => setD({ ...d, isDefault: v })} />
          )}
        </div>
        {error && <div className="error-text">{error}</div>}
      </div>
    </Modal>
  );
}

export default function LevelsPage() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ['admin', 'levels'], queryFn: () => api<Level[]>('/admin/levels') });
  const [edit, setEdit] = useState<Draft | null>(null);

  const remove = async (l: Level) => {
    if (!confirm(tr('Удалить уровень «{title}»? Участники ({n}) получат уровень по умолчанию.', { title: l.title, n: l.members }))) return;
    try {
      await api(`/admin/levels/${l.id}`, { method: 'DELETE' });
      qc.invalidateQueries({ queryKey: ['admin', 'levels'] });
    } catch (e) {
      alert((e as Error).message);
    }
  };

  return (
    <>
      <AdminHead title={tr('Уровни доступа')} subtitle={tr("Роли участников и что им разрешено")}>
        <button className="btn" onClick={() => setEdit(EMPTY)}>
          <Plus size={16} /> {tr('Новый уровень')}
        </button>
      </AdminHead>
      <div className="card">
        {!data ? (
          <Spinner />
        ) : (
          <div className="table-wrap">
            <table className="admin">
              <thead>
                <tr>
                  <th>{tr('Уровень')}</th>
                  <th>{tr('Тип')}</th>
                  {PERMS().map(([k, t]) => (
                    <th key={k} className="hide-sm" style={{ textAlign: 'center' }}>
                      {t.split(' ')[0]}
                    </th>
                  ))}
                  <th className="num">{tr('Участники')}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {data.map((l) => (
                  <tr key={l.id} style={{ cursor: 'pointer' }} onClick={() => setEdit({ ...l })}>
                    <td>
                      <b>{tr(l.title)}</b> {l.isDefault && <Star size={13} style={{ color: 'var(--warning)', verticalAlign: '-2px' }} aria-label={tr('по умолчанию')} />}
                      <div className="meta">{tr(l.description)}</div>
                    </td>
                    <td>
                      <span className={`pill${l.type !== 'user' ? ' accent' : ''}`}>{LEVEL_TYPE_LABEL()[l.type]}</span>
                    </td>
                    {PERMS().map(([k]) => (
                      <td key={k} className="hide-sm" style={{ textAlign: 'center' }}>
                        {l.permissions[k] ? <span className="pill good">{tr('да')}</span> : <span className="pill bad">{tr('нет')}</span>}
                      </td>
                    ))}
                    <td className="num">{fmt(l.members)}</td>
                    <td className="actions" onClick={(e) => e.stopPropagation()}>
                      {l.type !== 'superadmin' && !l.isDefault && (
                        <button className="icon-btn" onClick={() => remove(l)} aria-label={tr('Удалить уровень')}>
                          <Trash2 size={16} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {edit && <LevelModal initial={edit} onClose={() => setEdit(null)} />}
    </>
  );
}
