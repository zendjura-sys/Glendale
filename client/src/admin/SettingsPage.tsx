import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Check } from 'lucide-react';
import { api } from '../lib/api';
import { useConfig } from '../lib/config';
import { Spinner } from '../components/ui';
import { AdminHead, SwitchRow } from './ui';
import type { Settings } from './types';

const ACCENTS = ['#4c5bf5', '#7c3aed', '#db2777', '#e11d48', '#ea580c', '#16a34a', '#0d9488', '#0284c7'];

const SECTIONS = {
  general: ['Общие настройки', 'Название сети, описание и режим обслуживания'],
  signup: ['Регистрация', 'Кто и как может присоединиться'],
  security: ['Защита и баны', 'Блокировки по email и IP, цензура, защита от подбора пароля'],
  appearance: ['Оформление', 'Фирменный цвет и фон для всех участников'],
} as const;

type Section = keyof typeof SECTIONS;

export default function SettingsPage() {
  const { section = 'general' } = useParams();
  const key = (section in SECTIONS ? section : 'general') as Section;
  const qc = useQueryClient();
  const { reload } = useConfig();
  const { data } = useQuery({ queryKey: ['admin', 'settings'], queryFn: () => api<Settings>('/admin/settings') });
  const [s, setS] = useState<Settings | null>(null);
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  useEffect(() => {
    if (data) setS(data);
  }, [data]);
  useEffect(() => setStatus(null), [key]);

  if (!s) return <Spinner />;
  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => setS({ ...s, [k]: v });
  const dirty = JSON.stringify(s) !== JSON.stringify(data);

  const save = async () => {
    try {
      const saved = await api<Settings>('/admin/settings', { method: 'PATCH', body: s });
      qc.setQueryData(['admin', 'settings'], saved);
      setS(saved);
      reload();
      setStatus({ ok: true, text: 'Настройки сохранены' });
    } catch (e) {
      setStatus({ ok: false, text: (e as Error).message });
    }
  };

  return (
    <>
      <AdminHead title={SECTIONS[key][0]} subtitle={SECTIONS[key][1]}>
        <button className="btn" onClick={save} disabled={!dirty}>
          <Check size={16} /> Сохранить
        </button>
      </AdminHead>
      {status && <div className={`card card-pad ${status.ok ? '' : 'error-text'}`}>{status.text}</div>}

      {key === 'general' && (
        <div className="card">
          <div className="settings-form">
            <div>
              <label className="label">Название сети</label>
              <input className="field" value={s.siteTitle} maxLength={60} onChange={(e) => set('siteTitle', e.target.value)} />
              <div className="hint">Показывается во вкладке браузера и на странице входа.</div>
            </div>
            <div>
              <label className="label">Описание</label>
              <textarea className="field" value={s.siteDescription} maxLength={300} onChange={(e) => set('siteDescription', e.target.value)} />
            </div>
            <div>
              <SwitchRow
                title="Писать на стене могут только друзья"
                hint="Если выключить, на стене сможет оставить запись любой участник"
                on={s.wallForFriendsOnly}
                onChange={(v) => set('wallForFriendsOnly', v)}
              />
              <SwitchRow
                title="Режим обслуживания"
                hint="Сайт закрыт для всех, кроме администраторов и модераторов"
                on={s.maintenance}
                onChange={(v) => set('maintenance', v)}
              />
            </div>
            <div>
              <label className="label">Сообщение во время обслуживания</label>
              <textarea className="field" value={s.maintenanceMessage} maxLength={500} onChange={(e) => set('maintenanceMessage', e.target.value)} />
            </div>
          </div>
        </div>
      )}

      {key === 'signup' && (
        <div className="card">
          <div className="settings-form">
            <div>
              <label className="label">Режим регистрации</label>
              <div className="segmented">
                {(
                  [
                    ['open', 'Открыта'],
                    ['approval', 'По одобрению'],
                    ['closed', 'Закрыта'],
                  ] as const
                ).map(([v, label]) => (
                  <button key={v} className={s.signupMode === v ? 'on' : ''} onClick={() => set('signupMode', v)}>
                    {label}
                  </button>
                ))}
              </div>
              <div className="hint">
                {s.signupMode === 'open' && 'Любой может зарегистрироваться и сразу начать пользоваться сетью.'}
                {s.signupMode === 'approval' && 'Новые аккаунты ждут одобрения в разделе «Участники».'}
                {s.signupMode === 'closed' && 'Новые регистрации невозможны. Существующие участники входят как обычно.'}
              </div>
            </div>
          </div>
        </div>
      )}

      {key === 'security' && (
        <>
          <div className="card">
            <div className="card-title">Защита от подбора пароля</div>
            <div className="settings-form">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label className="label">Неудачных попыток до блокировки</label>
                  <input className="field" type="number" min={0} max={50} value={s.lockAttempts} onChange={(e) => set('lockAttempts', Number(e.target.value))} />
                  <div className="hint">0 — не блокировать</div>
                </div>
                <div>
                  <label className="label">Блокировка входа, минут</label>
                  <input className="field" type="number" min={1} max={1440} value={s.lockMinutes} onChange={(e) => set('lockMinutes', Number(e.target.value))} />
                </div>
              </div>
            </div>
          </div>
          <div className="card">
            <div className="card-title">Баны и цензура</div>
            <div className="settings-form">
              <div>
                <label className="label">Запрещённые email</label>
                <textarea className="field" value={s.bannedEmails} placeholder={'spammer@mail.ru\n*@tempmail.com'} onChange={(e) => set('bannedEmails', e.target.value)} />
                <div className="hint">По одному на строку. «*@домен» запрещает весь домен. Касается новых регистраций.</div>
              </div>
              <div>
                <label className="label">Запрещённые IP-адреса</label>
                <textarea className="field" value={s.bannedIps} placeholder={'203.0.113.7\n198.51.100.*'} onChange={(e) => set('bannedIps', e.target.value)} />
                <div className="hint">По одному на строку, «*» в конце — диапазон. Сотрудников не касается.</div>
              </div>
              <div>
                <label className="label">Цензура слов</label>
                <textarea className="field" value={s.bannedWords} placeholder="по одному слову на строку" onChange={(e) => set('bannedWords', e.target.value)} />
                <div className="hint">В новых записях, комментариях и сообщениях эти слова заменяются звёздочками.</div>
              </div>
            </div>
          </div>
        </>
      )}

      {key === 'appearance' && (
        <div className="card">
          <div className="settings-form">
            <div>
              <label className="label">Фирменный цвет</label>
              <div className="swatches">
                {ACCENTS.map((c) => (
                  <button
                    key={c}
                    className={`swatch${s.accentColor.toLowerCase() === c ? ' on' : ''}`}
                    style={{ background: c }}
                    onClick={() => set('accentColor', c)}
                    aria-label={`Цвет ${c}`}
                  />
                ))}
                <input type="color" value={s.accentColor} onChange={(e) => set('accentColor', e.target.value)} aria-label="Свой цвет" style={{ width: 40, height: 32, border: 'none', background: 'none' }} />
              </div>
              <div className="hint">Кнопки, ссылки и активные элементы у всех участников. Изменения видны после сохранения.</div>
            </div>
            <SwitchRow title="Фон «Aurora»" hint="Мягкое цветное сияние за интерфейсом" on={s.aurora} onChange={(v) => set('aurora', v)} />
          </div>
        </div>
      )}
    </>
  );
}
