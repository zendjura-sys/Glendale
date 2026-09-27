import { LANGUAGES, tr } from '../lib/i18n';
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Copy, Eye, EyeOff, Smartphone, Trash2 } from 'lucide-react';
import { GoogleLogo, SpotifyLogo } from '../components/brands';
import { api } from '../lib/api';
import { useConfig } from '../lib/config';
import { Spinner } from '../components/ui';
import { AdminHead, SwitchRow } from './ui';
import type { Settings } from './types';

const ACCENTS = ['#4c5bf5', '#7c3aed', '#db2777', '#e11d48', '#ea580c', '#16a34a', '#0d9488', '#0284c7'];

const SECTIONS = () => ({
  general: [tr('Общие настройки'), tr('Название сети, описание и режим обслуживания')],
  signup: [tr('Регистрация'), tr('Кто и как может присоединиться')],
  security: [tr('Защита и баны'), tr('Блокировки по email и IP, цензура, защита от подбора пароля')],
  appearance: [tr('Оформление'), tr('Фирменный цвет и фон для всех участников')],
  integrations: [tr('Интеграции'), tr('Подключение внешних сервисов')],
} as const);

type Section = keyof ReturnType<typeof SECTIONS>;

export default function SettingsPage() {
  const { section = 'general' } = useParams();
  const key = (section in SECTIONS() ? section : 'general') as Section;
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
      setStatus({ ok: true, text: tr('Настройки сохранены') });
    } catch (e) {
      setStatus({ ok: false, text: (e as Error).message });
    }
  };

  return (
    <>
      <AdminHead title={SECTIONS()[key][0]} subtitle={SECTIONS()[key][1]}>
        <button className="btn" onClick={save} disabled={!dirty}>
          <Check size={16} /> {tr('Сохранить')}
        </button>
      </AdminHead>
      {status && <div className={`card card-pad ${status.ok ? '' : 'error-text'}`}>{status.text}</div>}

      {key === 'general' && (
        <div className="card">
          <div className="settings-form">
            <div>
              <label className="label">{tr('Название сети')}</label>
              <input className="field" value={s.siteTitle} maxLength={60} onChange={(e) => set('siteTitle', e.target.value)} />
              <div className="hint">{tr('Показывается во вкладке браузера и на странице входа.')}</div>
            </div>
            <div>
              <label className="label">{tr('Язык сайта по умолчанию')}</label>
              <select className="field" value={s.defaultLanguage} onChange={(e) => set('defaultLanguage', e.target.value)} style={{ maxWidth: 260 }}>
                {LANGUAGES.map((l) => (
                  <option key={l.code} value={l.code}>
                    {l.name}
                  </option>
                ))}
              </select>
              <div className="hint">{tr('Для гостей и участников, которые не выбрали язык сами.')}</div>
            </div>
            <div>
              <label className="label">{tr('Описание')}</label>
              <textarea className="field" value={s.siteDescription} maxLength={300} onChange={(e) => set('siteDescription', e.target.value)} />
            </div>
            <div>
              <SwitchRow
                title={tr('Писать на стене могут только друзья')}
                hint={tr("Если выключить, на стене сможет оставить запись любой участник")}
                on={s.wallForFriendsOnly}
                onChange={(v) => set('wallForFriendsOnly', v)}
              />
              <SwitchRow
                title={tr('Режим обслуживания')}
                hint={tr("Сайт закрыт для всех, кроме администраторов и модераторов")}
                on={s.maintenance}
                onChange={(v) => set('maintenance', v)}
              />
            </div>
            <div>
              <label className="label">{tr('Сообщение во время обслуживания')}</label>
              <textarea className="field" value={s.maintenanceMessage} maxLength={500} onChange={(e) => set('maintenanceMessage', e.target.value)} />
            </div>
          </div>
        </div>
      )}

      {key === 'signup' && (
        <div className="card">
          <div className="settings-form">
            <div>
              <label className="label">{tr('Режим регистрации')}</label>
              <div className="segmented">
                {(
                  [
                    ['open', tr('Открыта')],
                    ['approval', tr('По одобрению')],
                    ['closed', tr('Закрыта')],
                  ] as const
                ).map(([v, label]) => (
                  <button key={v} className={s.signupMode === v ? 'on' : ''} onClick={() => set('signupMode', v)}>
                    {label}
                  </button>
                ))}
              </div>
              <div className="hint">
                {s.signupMode === 'open' && tr('Любой может зарегистрироваться и сразу начать пользоваться сетью.')}
                {s.signupMode === 'approval' && tr('Новые аккаунты ждут одобрения в разделе «Участники».')}
                {s.signupMode === 'closed' && tr('Новые регистрации невозможны. Существующие участники входят как обычно.')}
              </div>
            </div>
          </div>
        </div>
      )}

      {key === 'security' && (
        <>
          <div className="card">
            <div className="card-title">{tr('Защита от подбора пароля')}</div>
            <div className="settings-form">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label className="label">{tr('Неудачных попыток до блокировки')}</label>
                  <input className="field" type="number" min={0} max={50} value={s.lockAttempts} onChange={(e) => set('lockAttempts', Number(e.target.value))} />
                  <div className="hint">{tr('0 — не блокировать')}</div>
                </div>
                <div>
                  <label className="label">{tr('Блокировка входа, минут')}</label>
                  <input className="field" type="number" min={1} max={1440} value={s.lockMinutes} onChange={(e) => set('lockMinutes', Number(e.target.value))} />
                </div>
              </div>
            </div>
          </div>
          <div className="card">
            <div className="card-title">{tr('Баны и цензура')}</div>
            <div className="settings-form">
              <div>
                <label className="label">{tr('Запрещённые email')}</label>
                <textarea className="field" value={s.bannedEmails} placeholder={'spammer@mail.ru\n*@tempmail.com'} onChange={(e) => set('bannedEmails', e.target.value)} />
                <div className="hint">{tr('По одному на строку. «*@домен» запрещает весь домен. Касается новых регистраций.')}</div>
              </div>
              <div>
                <label className="label">{tr('Запрещённые IP-адреса')}</label>
                <textarea className="field" value={s.bannedIps} placeholder={'203.0.113.7\n198.51.100.*'} onChange={(e) => set('bannedIps', e.target.value)} />
                <div className="hint">{tr('По одному на строку, «*» в конце — диапазон. Сотрудников не касается.')}</div>
              </div>
              <div>
                <label className="label">{tr('Цензура слов')}</label>
                <textarea className="field" value={s.bannedWords} placeholder={tr('по одному слову на строку')} onChange={(e) => set('bannedWords', e.target.value)} />
                <div className="hint">{tr('В новых записях, комментариях и сообщениях эти слова заменяются звёздочками.')}</div>
              </div>
            </div>
          </div>
        </>
      )}

      {key === 'integrations' && (
        <>
          <div className="card">
            <div className="card-title integration-title">
              <SpotifyLogo size={20} /> Spotify
              <span className={`pill ${s.spotifyClientId ? 'good' : ''}`}>{s.spotifyClientId ? tr('Подключено') : tr('Не настроено')}</span>
            </div>
            <div className="settings-form">
              <div>
                <label className="label">Client ID</label>
                <input
                  className="field"
                  value={s.spotifyClientId}
                  placeholder={tr('например, 3f8c1a…')}
                  onChange={(e) => set('spotifyClientId', e.target.value.trim())}
                  spellCheck={false}
                />
              </div>
              <SecretField
                label="Client Secret"
                isSet={s.spotifyClientSecretSet}
                value={s.spotifyClientSecret}
                onChange={(v) => set('spotifyClientSecret', v)}
                hint={tr('С секретом поиск, альбомы и исполнители Spotify доступны всем участникам, даже без подключения своего аккаунта. Секрет хранится только на сервере.')}
              />
              <div>
                <label className="label">{tr('Страна каталога')}</label>
                <select className="field" value={s.spotifyMarket} onChange={(e) => set('spotifyMarket', e.target.value)}>
                  {MARKETS.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
                <div className="hint">{tr('Для участников без подключённого Spotify: от страны зависит, какие треки доступны.')}</div>
              </div>
              <Steps
                title={tr('Как получить ключи')}
                steps={[
                  <>
                    {tr('Откройте')}{' '}
                    <a href="https://developer.spotify.com/dashboard" target="_blank" rel="noreferrer">
                      developer.spotify.com/dashboard
                    </a>{' '}
                    {tr('и войдите своим аккаунтом Spotify.')}
                  </>,
                  tr('Нажмите «Create app». Название и описание — любые, например «Glendale».'),
                  <>
                    {tr('В поле «Redirect URIs» добавьте адрес:')} <CopyCode text={`${location.origin}/spotify/callback`} />
                  </>,
                  tr('В разделе «Which API/SDKs are you planning to use?» отметьте «Web API» и «Web Playback SDK», примите условия и сохраните.'),
                  tr('Откройте «Settings» приложения: скопируйте Client ID, затем нажмите «View client secret» и скопируйте секрет. Вставьте оба сюда и нажмите «Сохранить».'),
                  tr('Пока приложение в режиме Development, подключать Spotify могут только те, чей email добавлен во вкладке «User Management» (до 25 человек). Чтобы открыть всем — подайте заявку «Extension request» там же.'),
                ]}
              />
            </div>
          </div>

          <div className="card">
            <div className="card-title integration-title">
              <GoogleLogo size={20} /> Google
              <span className={`pill ${s.googleClientId && s.googleClientSecretSet ? 'good' : ''}`}>
                {s.googleClientId && s.googleClientSecretSet ? tr('Подключено') : tr('Не настроено')}
              </span>
            </div>
            <div className="settings-form">
              <div>
                <label className="label">Client ID</label>
                <input
                  className="field"
                  value={s.googleClientId}
                  placeholder="1234567890-abc….apps.googleusercontent.com"
                  onChange={(e) => set('googleClientId', e.target.value.trim())}
                  spellCheck={false}
                />
              </div>
              <SecretField label="Client Secret" isSet={s.googleClientSecretSet} value={s.googleClientSecret} onChange={(v) => set('googleClientSecret', v)} />
              <div className="hint">{tr('Когда оба поля заполнены, на странице входа появляется кнопка «Войти через Google». Участник с тем же email входит в свой аккаунт, новый — регистрируется.')}</div>
              <Steps
                title={tr('Как получить ключи')}
                steps={[
                  <>
                    {tr('Откройте')}{' '}
                    <a href="https://console.cloud.google.com/projectcreate" target="_blank" rel="noreferrer">
                      console.cloud.google.com
                    </a>{' '}
                    {tr('и создайте проект (например, «Glendale»).')}
                  </>,
                  <>
                    {tr('Настройте экран согласия:')}{' '}
                    <a href="https://console.cloud.google.com/auth/branding" target="_blank" rel="noreferrer">
                      Google Auth Platform → Branding
                    </a>
                    {tr('. Тип аудитории — «External», укажите название сайта и свой email.')}
                  </>,
                  <>
                    {tr('Создайте ключ:')}{' '}
                    <a href="https://console.cloud.google.com/auth/clients/create" target="_blank" rel="noreferrer">
                      Clients → Create client
                    </a>
                    {tr(', тип приложения «Web application».')}
                  </>,
                  <>
                    {tr('В «Authorized JavaScript origins» добавьте:')} <CopyCode text={location.origin} />
                  </>,
                  <>
                    {tr('В «Authorized redirect URIs» добавьте:')} <CopyCode text={`${location.origin}/api/auth/google/callback`} />
                  </>,
                  tr('Нажмите «Create», скопируйте Client ID и Client secret сюда и сохраните.'),
                  <>
                    {tr('Чтобы входить мог любой пользователь Google, опубликуйте приложение:')}{' '}
                    <a href="https://console.cloud.google.com/auth/audience" target="_blank" rel="noreferrer">
                      Audience → Publish app
                    </a>
                    {tr('. До этого вход доступен только тестовым пользователям из того же раздела.')}
                  </>,
                ]}
              />
            </div>
          </div>

          <div className="card">
            <div className="card-title integration-title">
              <Smartphone size={20} /> {tr('Android-приложение')}
              <span className={`pill ${s.androidAssetLinks.trim() ? 'good' : ''}`}>{s.androidAssetLinks.trim() ? tr('Подключено') : tr('Не настроено')}</span>
            </div>
            <div className="settings-form">
              <div className="hint" style={{ marginTop: 0 }}>
                {tr('Сайт уже устанавливается как приложение прямо из браузера (Chrome на Android, Safari на iPhone). Файл APK/AAB для Google Play собирается из него без программирования:')}
              </div>
              <Steps
                title={tr('Как собрать APK')}
                steps={[
                  <>
                    {tr('Откройте')}{' '}
                    <a href={`https://www.pwabuilder.com/reportcard?site=${encodeURIComponent(location.origin)}`} target="_blank" rel="noreferrer">
                      pwabuilder.com
                    </a>{' '}
                    {tr('— адрес сайта подставится сам. Дождитесь проверки.')}
                  </>,
                  tr('Нажмите «Package for stores» → «Android» → «Generate Package». Package ID оставьте предложенный или укажите свой, например net.monsory.social.'),
                  tr('Скачайте архив. В нём: APK для установки на телефон, AAB для Google Play, ключ подписи (signing.keystore и пароль) и файл assetlinks.json.'),
                  tr('Храните ключ подписи в надёжном месте: без него нельзя выпустить обновление приложения.'),
                  tr('Откройте assetlinks.json из архива, скопируйте всё содержимое в поле ниже и сохраните. Тогда приложение откроется без адресной строки браузера.'),
                  tr('Установите APK на телефон (разрешите установку из неизвестных источников) или загрузите AAB в Google Play Console.'),
                ]}
              />
              <div>
                <label className="label">assetlinks.json</label>
                <textarea
                  className="field mono"
                  rows={6}
                  spellCheck={false}
                  placeholder='[{"relation": ["delegate_permission/common.handle_all_urls"], "target": {…}}]'
                  value={s.androidAssetLinks}
                  onChange={(e) => set('androidAssetLinks', e.target.value)}
                />
                <div className="hint">
                  {tr('Будет доступен по адресу')} <CopyCode text={`${location.origin}/.well-known/assetlinks.json`} />
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {key === 'appearance' && (
        <div className="card">
          <div className="settings-form">
            <div>
              <label className="label">{tr('Фирменный цвет')}</label>
              <div className="swatches">
                {ACCENTS.map((c) => (
                  <button
                    key={c}
                    className={`swatch${s.accentColor.toLowerCase() === c ? ' on' : ''}`}
                    style={{ background: c }}
                    onClick={() => set('accentColor', c)}
                    aria-label={tr('Цвет {c}', { c })}
                  />
                ))}
                <input type="color" value={s.accentColor} onChange={(e) => set('accentColor', e.target.value)} aria-label={tr('Свой цвет')} style={{ width: 40, height: 32, border: 'none', background: 'none' }} />
              </div>
              <div className="hint">{tr('Кнопки, ссылки и активные элементы у всех участников. Изменения видны после сохранения.')}</div>
            </div>
            <SwitchRow title={tr('Фон «Aurora»')} hint={tr("Мягкое цветное сияние за интерфейсом")} on={s.aurora} onChange={(v) => set('aurora', v)} />
          </div>
        </div>
      )}
    </>
  );
}

const MARKETS = ['UA', 'KZ', 'PL', 'DE', 'FR', 'ES', 'GB', 'US', 'JP'];

/** Write-only secret: shows whether one is stored, never its value. */
function SecretField({
  label,
  isSet,
  value,
  onChange,
  hint,
}: {
  label: string;
  isSet: boolean;
  value: string | null;
  onChange: (v: string | null) => void;
  hint?: string;
}) {
  const [show, setShow] = useState(false);
  const cleared = value === null;
  return (
    <div>
      <label className="label">{label}</label>
      <div className="secret-field">
        <input
          className="field"
          type={show ? 'text' : 'password'}
          value={value ?? ''}
          autoComplete="off"
          spellCheck={false}
          placeholder={cleared ? tr('Будет удалён после сохранения') : isSet ? tr('Сохранён — введите новый, чтобы заменить') : tr('Не задан')}
          onChange={(e) => onChange(e.target.value.trim())}
        />
        <button type="button" className="icon-btn" onClick={() => setShow((v) => !v)} aria-label={show ? tr('Скрыть') : tr('Показать')}>
          {show ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
        {isSet && !cleared && (
          <button type="button" className="btn secondary small" onClick={() => onChange(null)}>
            <Trash2 size={14} /> {tr('Удалить')}
          </button>
        )}
      </div>
      {hint && <div className="hint">{hint}</div>}
    </div>
  );
}

function CopyCode({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <span className="copy-code">
      <code>{text}</code>
      <button
        type="button"
        className="icon-btn"
        aria-label={tr('Скопировать')}
        title={tr('Скопировать')}
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(text);
            setDone(true);
            setTimeout(() => setDone(false), 1500);
          } catch {
            /* clipboard unavailable: the code is selectable */
          }
        }}
      >
        {done ? <Check size={14} /> : <Copy size={14} />}
      </button>
    </span>
  );
}

function Steps({ title, steps }: { title: string; steps: React.ReactNode[] }) {
  return (
    <details className="setup-steps">
      <summary>{title}</summary>
      <ol>
        {steps.map((st, i) => (
          <li key={i}>{st}</li>
        ))}
      </ol>
    </details>
  );
}
