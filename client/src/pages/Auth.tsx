import { tr } from '../lib/i18n';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { MessageCircle, Users, Zap } from 'lucide-react';
import { ThemeSwitch } from '../components/uiverse';
import { LanguageSelect } from '../components/LanguageSelect';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useTheme } from '../lib/theme';
import { useConfig } from '../lib/config';
import type { Me } from '../lib/types';
import { GoogleLogo } from '../components/brands';

/** Messages for /login?google_error=… (set by the server after the Google redirect). */
const GOOGLE_ERRORS = (): Record<string, string> => ({
  cancelled: tr('Вход через Google отменён'),
  email: tr('Google не подтвердил email этого аккаунта'),
  banned: tr('Аккаунт заблокирован администрацией'),
  pending: tr('Аккаунт ожидает одобрения администратором'),
  signup_closed: tr('Регистрация временно закрыта'),
  disabled: tr('Вход через Google не настроен'),
});

export default function AuthPage({ staffOnly = false }: { staffOnly?: boolean }) {
  const { config } = useConfig();
  const [notice, setNotice] = useState('');
  const { signIn } = useAuth();
  const { theme, setTheme } = useTheme();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [fields, setFields] = useState({ firstName: '', lastName: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof fields) => (e: React.ChangeEvent<HTMLInputElement>) => setFields({ ...fields, [k]: e.target.value });

  // Coming back from Google: exchange the one-time code for a session, or show why it failed.
  const handled = useRef(false);
  useEffect(() => {
    if (handled.current) return;
    handled.current = true;
    const p = new URLSearchParams(location.search);
    const code = p.get('google');
    const failure = p.get('google_error');
    if (!code && !failure) return;
    history.replaceState(null, '', '/feed');
    if (failure) {
      setError(failure === 'maintenance' ? config.maintenanceMessage : GOOGLE_ERRORS()[failure] ?? tr('Не удалось войти через Google'));
      return;
    }
    setBusy(true);
    api<{ token: string; user: Me }>('/auth/google/finish', { body: { code } })
      .then((r) => signIn(r.token, r.user))
      .catch((e) => setError((e as Error).message))
      .finally(() => setBusy(false));
  }, [config.maintenanceMessage, signIn]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const r = await api<{ token?: string; user?: Me; pending?: boolean; message?: string }>(`/auth/${mode}`, { body: fields });
      if (r.pending) {
        setNotice(r.message ?? tr('Заявка отправлена'));
        setMode('login');
        return;
      }
      signIn(r.token!, r.user!);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const demo = () => setFields({ ...fields, email: 'demo@glendale.app', password: 'demo123' });

  return (
    <div className="auth">
      <div className="auth-toolbar">
        <LanguageSelect compact />
        <ThemeSwitch dark={theme === 'dark'} onChange={(d) => setTheme(d ? 'dark' : 'light')} size={10} />
      </div>
      <div className="auth-promo">
        <span className="logo-mark" style={{ width: 56, height: 56, borderRadius: 18, display: 'inline-grid' }}>
          <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
            <path d="M18.5 7.5A8 8 0 1 0 20 12h-7" />
          </svg>
        </span>
        <h1>{config.siteTitle} {tr('— общайтесь без задержек')}</h1>
        <p>{config.siteDescription || tr('Социальная сеть для общения с друзьями, сообществами и всеми, кто вам интересен.')}</p>
        <div className="auth-features">
          <div>
            <Zap size={22} /> {tr('Мгновенные сообщения и уведомления')}
          </div>
          <div>
            <Users size={22} /> {tr('Друзья, сообщества и лента новостей')}
          </div>
          <div>
            <MessageCircle size={22} /> {tr('Лайки, комментарии и репосты')}
          </div>
        </div>
      </div>

      <form className="card auth-card" onSubmit={submit}>
        <h2>{staffOnly ? tr('Вход для администрации') : mode === 'login' ? tr('Вход в {site}', { site: config.siteTitle }) : tr('Регистрация')}</h2>
        {mode === 'register' && (
          <>
            <div className="form-row">
              <input className="field" placeholder={tr('Имя')} value={fields.firstName} onChange={set('firstName')} required autoComplete="given-name" />
            </div>
            <div className="form-row">
              <input className="field" placeholder={tr('Фамилия')} value={fields.lastName} onChange={set('lastName')} required autoComplete="family-name" />
            </div>
          </>
        )}
        <div className="form-row">
          <input className="field" type="email" placeholder="Email" value={fields.email} onChange={set('email')} required autoComplete="email" />
        </div>
        <div className="form-row">
          <input
            className="field"
            type="password"
            placeholder={tr('Пароль')}
            value={fields.password}
            onChange={set('password')}
            required
            minLength={mode === 'register' ? 6 : undefined}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          />
        </div>
        {error && <div className="error-text">{error}</div>}
        {notice && <div className="auth-hint" style={{ margin: '0 0 12px' }}>{notice}</div>}
        {mode === 'register' && config.signupMode === 'approval' && (
          <div className="auth-hint" style={{ margin: '0 0 12px' }}>{tr('Новые аккаунты активируются после проверки администратором.')}</div>
        )}
        <button className="btn block lg" disabled={busy}>
          {mode === 'login' ? tr('Войти') : tr('Зарегистрироваться')}
        </button>
        {config.googleEnabled && !staffOnly && (
          <>
            <div className="auth-or">
              <span>{tr('или')}</span>
            </div>
            <a className="btn secondary block lg google-btn" href="/api/auth/google/start">
              <GoogleLogo size={18} /> {tr('Войти через Google')}
            </a>
          </>
        )}
        {!staffOnly && config.signupMode !== 'closed' && (
          <button
            type="button"
            className="btn secondary block lg"
            style={{ marginTop: 10 }}
            onClick={() => {
              setMode(mode === 'login' ? 'register' : 'login');
              setError('');
              setNotice('');
            }}
          >
            {mode === 'login' ? tr('Создать аккаунт') : tr('У меня уже есть аккаунт')}
          </button>
        )}
        {mode === 'login' && !staffOnly && config.demoAccounts && (
          <div className="auth-hint">
            {tr('Демо-доступ:')} <b>demo@glendale.app</b> / <b>demo123</b>{tr(', админ:')} <b>admin@glendale.app</b> / <b>admin123</b>{' '}
            <button type="button" className="more-link" onClick={demo}>
              {tr('подставить')}
            </button>
          </div>
        )}
      </form>
    </div>
  );
}
