import { tr } from '../lib/i18n';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BadgeCheck, Flag, Megaphone, UserRoundCog, X } from 'lucide-react';
import { api, setToken } from '../lib/api';
import { useMe } from '../lib/auth';
import type { Announcement } from '../lib/types';
import { fullName } from '../lib/utils';
import { Modal } from './ui';

const CATEGORIES = (): [string, string][] => ([
  ['spam', tr('Спам')],
  ['abuse', tr('Оскорбления')],
  ['inappropriate', tr('Неприемлемый контент')],
  ['fake', tr('Фейк или мошенничество')],
  ['copyright', tr('Нарушение авторских прав')],
  ['other', tr('Другое')],
]);

export type ReportTarget = { type: 'post' | 'comment' | 'user' | 'group' | 'message'; id: number };

export function ReportModal({ target, onClose }: { target: ReportTarget; onClose: () => void }) {
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [state, setState] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    try {
      await api('/reports', { body: { targetType: target.type, targetId: target.id, category, description } });
      setState({ ok: true, text: tr('Спасибо! Модераторы рассмотрят жалобу.') });
    } catch (e) {
      setState({ ok: false, text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title={tr('Пожаловаться')}
      onClose={onClose}
      footer={
        state?.ok ? (
          <button className="btn" onClick={onClose}>
            {tr('Готово')}
          </button>
        ) : (
          <>
            <button className="btn secondary" onClick={onClose}>
              {tr('Отмена')}
            </button>
            <button className="btn" onClick={submit} disabled={!category || busy}>
              {tr('Отправить')}
            </button>
          </>
        )
      }
    >
      <div className="modal-body">
        {state?.ok ? (
          <p style={{ margin: 0 }}>{state.text}</p>
        ) : (
          <>
            <div className="label">{tr('Что не так?')}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginBottom: 12 }}>
              {CATEGORIES().map(([value, label]) => (
                <label key={value} className="menu-item check" style={{ borderRadius: 10, cursor: 'pointer' }}>
                  <input type="radio" name="report-category" checked={category === value} onChange={() => setCategory(value)} />
                  {label}
                </label>
              ))}
            </div>
            <textarea className="field" placeholder={tr('Подробности (необязательно)')} maxLength={1000} value={description} onChange={(e) => setDescription(e.target.value)} />
            {state && <div className="error-text">{state.text}</div>}
          </>
        )}
      </div>
    </Modal>
  );
}

/** Small "report" button that opens the modal. */
export function ReportButton({ target, label = tr('Пожаловаться'), className = 'btn secondary' }: { target: ReportTarget; label?: string; className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className={className} onClick={() => setOpen(true)} aria-label={label} title={label}>
        <Flag size={16} />
        {className.includes('icon-btn') ? null : label}
      </button>
      {open && <ReportModal target={target} onClose={() => setOpen(false)} />}
    </>
  );
}

const DISMISSED_KEY = 'dismissedAnnouncements';
function readDismissed(): number[] {
  try {
    return JSON.parse(localStorage.getItem(DISMISSED_KEY) || '[]');
  } catch {
    return [];
  }
}

/** Active announcements from the administration, shown at the top of the feed. */
export function AnnouncementBanner() {
  const { data } = useQuery({ queryKey: ['announcements'], queryFn: () => api<Announcement[]>('/announcements'), staleTime: 5 * 60_000 });
  const [dismissed, setDismissed] = useState(readDismissed);
  const visible = (data ?? []).filter((a) => !dismissed.includes(a.id));
  if (!visible.length) return null;
  const dismiss = (id: number) => {
    const next = [...dismissed, id];
    setDismissed(next);
    try {
      localStorage.setItem(DISMISSED_KEY, JSON.stringify(next.slice(-50)));
    } catch {
      /* storage unavailable */
    }
  };
  return (
    <>
      {visible.map((a) => (
        <div key={a.id} className="card announcement">
          <span className="announcement-icon">
            <Megaphone size={18} />
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <b>{a.title}</b>
            {a.body && <div className="muted" style={{ whiteSpace: 'pre-wrap', marginTop: 2 }}>{a.body}</div>}
          </div>
          <button className="icon-btn" onClick={() => dismiss(a.id)} aria-label={tr('Скрыть объявление')}>
            <X size={18} />
          </button>
        </div>
      ))}
    </>
  );
}

const IMPERSONATOR_KEY = 'impersonator';

/** Shown while an admin is browsing as another member (tr("войти как")). */
export function ImpersonationBar() {
  const me = useMe();
  let original: string | null = null;
  try {
    original = sessionStorage.getItem(IMPERSONATOR_KEY);
  } catch {
    /* storage unavailable */
  }
  if (!original) return null;
  const back = () => {
    sessionStorage.removeItem(IMPERSONATOR_KEY);
    setToken(original);
    location.href = '/admin/members';
  };
  return (
    <div className="impersonation">
      <UserRoundCog size={18} />
      <span>
        {tr('Вы просматриваете сеть как')} <b>{fullName(me)}</b>
      </span>
      <button className="btn secondary" onClick={back}>
        {tr('Вернуться в админку')}
      </button>
    </div>
  );
}

export const Verified = ({ size = 15 }: { size?: number }) => (
  <BadgeCheck size={size} className="verified" aria-label={tr('Подтверждённый аккаунт')}>
    <title>{tr('Подтверждённый аккаунт')}</title>
  </BadgeCheck>
);
