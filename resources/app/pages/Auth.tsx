import { tr } from '../lib/i18n';
import { Clapperboard, MessageCircle, Users } from 'lucide-react';
import { ThemeSwitch } from '../components/uiverse';
import { LanguageSelect } from '../components/LanguageSelect';
import { useTheme } from '../lib/theme';
import { useConfig } from '../lib/config';
import { APP_BASE } from '../lib/api';

/**
 * Вхід і реєстрація живуть на сторінках сайту (підтвердження пошти, 2FA,
 * чорні списки, тіньові акаунти) — тут лише ведемо туди. {APP_BASE}/enter
 * вимагає сесії: Laravel відправить на /login і поверне назад, а SPA
 * обміняє сесію на токен API.
 */
export default function AuthPage({ staffOnly = false }: { staffOnly?: boolean }) {
  const { config } = useConfig();
  const { theme, setTheme } = useTheme();
  const enter = `${APP_BASE}/enter`;

  return (
    <div className="auth">
      <div className="auth-toolbar">
        <LanguageSelect compact />
        <ThemeSwitch dark={theme === 'dark'} onChange={(d) => setTheme(d ? 'dark' : 'light')} size={10} />
      </div>
      <div className="auth-promo">
        <span className="logo-mark" style={{ width: 56, height: 56, borderRadius: 18, display: 'inline-grid', fontWeight: 800, fontSize: 28 }}>
          M
        </span>
        <h1>{config.siteTitle} {tr('— родина, друзі й кіно в одному місці')}</h1>
        <div className="auth-features">
          <div>
            <Users size={22} /> {tr('Друзья, сообщества и лента новостей')}
          </div>
          <div>
            <MessageCircle size={22} /> {tr('Лайки, комментарии и репосты')}
          </div>
          <div>
            <Clapperboard size={22} /> {tr('Фільми й серіали з друзями')}
          </div>
        </div>
      </div>

      <div className="card auth-card">
        <h2>{staffOnly ? tr('Вход для администрации') : tr('Вход в {site}', { site: config.siteTitle })}</h2>
        <p className="muted" style={{ marginBottom: 16 }}>
          {tr('Один акаунт для сайту й застосунку.')}
        </p>
        <a className="btn block lg" href={enter}>
          {tr('Войти')}
        </a>
        {!staffOnly && (
          <a className="btn secondary block lg" style={{ marginTop: 10 }} href="/register">
            {tr('Создать аккаунт')}
          </a>
        )}
      </div>
    </div>
  );
}
