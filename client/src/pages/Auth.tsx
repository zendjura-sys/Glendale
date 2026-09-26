import { useState, type FormEvent } from 'react';
import { MessageCircle, Moon, Sun, Users, Zap } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useTheme } from '../lib/theme';
import type { User } from '../lib/types';

export default function AuthPage() {
  const { signIn } = useAuth();
  const { theme, toggle } = useTheme();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [fields, setFields] = useState({ firstName: '', lastName: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof fields) => (e: React.ChangeEvent<HTMLInputElement>) => setFields({ ...fields, [k]: e.target.value });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const r = await api<{ token: string; user: User }>(`/auth/${mode}`, { body: fields });
      signIn(r.token, r.user);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const demo = () => setFields({ ...fields, email: 'demo@glendale.app', password: 'demo123' });

  return (
    <div className="auth">
      <button className="icon-btn" onClick={toggle} style={{ position: 'fixed', top: 16, right: 16 }} aria-label="Сменить тему">
        {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
      </button>
      <div className="auth-promo">
        <span className="logo-mark" style={{ width: 56, height: 56, borderRadius: 18, display: 'inline-grid' }}>
          <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
            <path d="M18.5 7.5A8 8 0 1 0 20 12h-7" />
          </svg>
        </span>
        <h1>Glendale — общайтесь без задержек</h1>
        <p>Социальная сеть для общения с друзьями, сообществами и всеми, кто вам интересен.</p>
        <div className="auth-features">
          <div>
            <Zap size={22} /> Мгновенные сообщения и уведомления
          </div>
          <div>
            <Users size={22} /> Друзья, сообщества и лента новостей
          </div>
          <div>
            <MessageCircle size={22} /> Лайки, комментарии и репосты
          </div>
        </div>
      </div>

      <form className="card auth-card" onSubmit={submit}>
        <h2>{mode === 'login' ? 'Вход в Glendale' : 'Регистрация'}</h2>
        {mode === 'register' && (
          <>
            <div className="form-row">
              <input className="field" placeholder="Имя" value={fields.firstName} onChange={set('firstName')} required autoComplete="given-name" />
            </div>
            <div className="form-row">
              <input className="field" placeholder="Фамилия" value={fields.lastName} onChange={set('lastName')} required autoComplete="family-name" />
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
            placeholder="Пароль"
            value={fields.password}
            onChange={set('password')}
            required
            minLength={mode === 'register' ? 6 : undefined}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          />
        </div>
        {error && <div className="error-text">{error}</div>}
        <button className="btn block lg" disabled={busy}>
          {mode === 'login' ? 'Войти' : 'Зарегистрироваться'}
        </button>
        <button
          type="button"
          className="btn secondary block lg"
          style={{ marginTop: 10 }}
          onClick={() => {
            setMode(mode === 'login' ? 'register' : 'login');
            setError('');
          }}
        >
          {mode === 'login' ? 'Создать аккаунт' : 'У меня уже есть аккаунт'}
        </button>
        {mode === 'login' && (
          <div className="auth-hint">
            Демо-доступ: <b>demo@glendale.app</b> / <b>demo123</b>{' '}
            <button type="button" className="more-link" onClick={demo}>
              подставить
            </button>
          </div>
        )}
      </form>
    </div>
  );
}
