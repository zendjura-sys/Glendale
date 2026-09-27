import { tr } from '../lib/i18n';
import { Suspense, useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import {
  Bell,
  ChevronDown,
  CircleUserRound,
  Image as ImageIcon,
  LogOut,
  MessageCircle,
  Moon,
  Newspaper,
  Search,
  Settings,
  BookOpen,
  CalendarDays,
  ClipboardList,
  Crown,
  Landmark,
  LayoutDashboard,
  Scale,
  Target,
  Trophy,
  UserCog,
  Shield,
  Sun,
  Users,
  UsersRound,
  Download,
} from 'lucide-react';
import { useInstallState } from './InstallApp';
import { promptInstall } from '../lib/install';
import { api } from '../lib/api';
import { useAuth, useMe } from '../lib/auth';
import { useRealtime } from '../lib/realtime';
import { useTheme } from '../lib/theme';
import { fullName } from '../lib/utils';
import { NotificationList } from './Notifications';
import { ImpersonationBar } from './Moderation';
import { LanguageSelect } from './LanguageSelect';
import { useConfig } from '../lib/config';
import { isStaffLevel } from '../lib/types';
import { Avatar, Spinner, useClickOutside } from './ui';
import { ThemeSwitch } from './uiverse';

function Logo() {
  const { config } = useConfig();
  const title = config.siteTitle.trim();
  // «Monsory Connect» → MONSORY / CONNECT; «GameConnect» → GAME / CONNECT.
  const words = title.includes(' ') ? title.split(/\s+/) : title.split(/(?=[A-ZА-ЯІЇЄҐ])/);
  const [main, ...rest] = words.length > 1 ? words : [title];
  const sub = rest.join(title.includes(' ') ? ' ' : '');
  return (
    <Link to="/feed" className="logo" aria-label={config.siteTitle}>
      <span className="logo-mark">{main.charAt(0)}</span>
      {/* Назва в два рядки: перше слово — головне, решта — підпис
          («MONSORY» / «CONNECT»). Так вона вміщується й на телефоні. */}
      <span className="logo-text">
        <span className="logo-main">{main}</span>
        {sub && <span className="logo-sub">{sub}</span>}
      </span>
    </Link>
  );
}

function NotificationsButton() {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const ref = useClickOutside<HTMLDivElement>(open, close);
  const { counters, setCounters } = useRealtime();
  const qc = useQueryClient();

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next) {
      qc.invalidateQueries({ queryKey: ['notifications'] });
      if (counters.notifications) {
        api('/notifications/read', { method: 'POST' }).catch(() => {});
        setCounters({ ...counters, notifications: 0 });
      }
    }
  };

  return (
    <div style={{ position: 'relative' }} ref={ref}>
      <button className="header-icon" onClick={toggle} aria-label={tr('Уведомления')}>
        <Bell size={22} />
        {counters.notifications > 0 && <span className="badge">{counters.notifications}</span>}
      </button>
      {open && (
        <div className="dropdown" style={{ width: 380, maxWidth: 'calc(100vw - 24px)', right: -60, padding: 0, overflow: 'hidden' }}>
          <div className="card-title" style={{ borderBottom: '1px solid var(--separator)' }}>
            {tr('Уведомления')}
          </div>
          <div style={{ maxHeight: 420, overflowY: 'auto' }}>
            <NotificationList compact onItemClick={close} />
          </div>
          <Link to="/activity" className="menu-item" style={{ justifyContent: 'center', color: 'var(--accent)', borderTop: '1px solid var(--separator)', padding: 12 }} onClick={close}>
            {tr('Показать все')}
          </Link>
        </div>
      )}
    </div>
  );
}

function UserMenu() {
  const me = useMe();
  const { signOut } = useAuth();
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const install = useInstallState();
  const ref = useClickOutside<HTMLDivElement>(open, close);
  return (
    <div style={{ position: 'relative' }} ref={ref}>
      <button className="header-user" onClick={() => setOpen((o) => !o)} aria-label={tr('Меню профиля')}>
        <Avatar src={me.avatar} name={fullName(me)} id={me.id} size={32} />
        <ChevronDown size={16} />
      </button>
      {open && (
        <div className="dropdown" style={{ width: 260 }}>
          <Link to={`/id/${me.id}`} className="menu-item" onClick={close} style={{ padding: '10px 16px' }}>
            <Avatar src={me.avatar} name={fullName(me)} id={me.id} size={40} />
            <div style={{ minWidth: 0 }}>
              <div className="name ellipsis">{fullName(me)}</div>
              <div className="meta">{tr('Перейти на свою страницу')}</div>
            </div>
          </Link>
          <div className="menu-sep" />
          {isStaffLevel(me.level.type) && (
            <a href="/admin" className="menu-item" onClick={close}>
              <Shield size={18} /> {tr('Админ-панель')}
            </a>
          )}
          <Link to="/settings" className="menu-item" onClick={close}>
            <Settings size={18} /> {tr('Настройки')}
          </Link>
          <a href="/profile" className="menu-item" onClick={close}>
            <UserCog size={18} /> {tr('Акаунт і безпека')}
          </a>
          <div className="menu-item" style={{ cursor: 'default' }}>
            {theme === 'dark' ? <Moon size={18} /> : <Sun size={18} />}
            {tr('Тема:')} {theme === 'dark' ? tr('тёмная') : tr('светлая')}
            <span style={{ marginLeft: 'auto' }}>
              <ThemeSwitch dark={theme === 'dark'} onChange={(d) => setTheme(d ? 'dark' : 'light')} size={9} />
            </span>
          </div>
          <div className="menu-item" style={{ cursor: 'default' }}>
            <LanguageSelect />
          </div>
          {install.available && !install.installed && (
            <button
              className="menu-item"
              onClick={() => {
                close();
                promptInstall();
              }}
            >
              <Download size={18} /> {tr('Установить приложение')}
            </button>
          )}
          <div className="menu-sep" />
          <button className="menu-item" onClick={signOut}>
            <LogOut size={18} /> {tr('Выйти')}
          </button>
        </div>
      )}
    </div>
  );
}

export function Header() {
  const navigate = useNavigate();
  const location = useLocation();
  const [q, setQ] = useState('');
  useEffect(() => {
    if (location.pathname === '/search') setQ(new URLSearchParams(location.search).get('q') ?? '');
  }, [location]);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (q.trim()) navigate(`/search?q=${encodeURIComponent(q.trim())}`);
  };
  return (
    <header className="header">
      <div className="header-inner">
        <Logo />
        <form className="header-search" onSubmit={submit} role="search">
          <Search size={16} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={tr('Поиск')} aria-label={tr('Поиск')} />
        </form>
        <div className="header-spacer" />
        <Link to="/search" className="header-icon mobile-only" aria-label={tr('Поиск')}>
          <Search size={22} />
        </Link>
        <NotificationsButton />
        <UserMenu />
      </div>
    </header>
  );
}

function Counter({ n, hot }: { n: number; hot?: boolean }) {
  return n > 0 ? <span className={`badge${hot ? ' hot' : ''}`}>{n}</span> : null;
}

/**
 * Розділи системи управління родинами (публічна назва в меню — «Моя
 * родина») — поки сторінки на Vue (Inertia),
 * тому звичайні посилання з повним переходом, а не NavLink.
 */
const FAMILY_LINKS = () => [
  { href: '/dashboard', icon: LayoutDashboard, label: tr('Кабінет') },
  { href: '/reports', icon: ClipboardList, label: tr('Звіти') },
  { href: '/bonuses', icon: Landmark, label: tr('Банк') },
  { href: '/discipline', icon: Scale, label: tr('Покарання') },
  { href: '/family', icon: Target, label: tr('Цілі родини') },
  { href: '/events', icon: CalendarDays, label: tr('Події') },
  { href: '/leaderboard', icon: Trophy, label: tr('Рейтинг') },
  { href: '/rules', icon: BookOpen, label: tr('Правила') },
];

function Sidebar() {
  const me = useMe();
  const { config } = useConfig();
  const { counters } = useRealtime();
  return (
    <nav className="sidebar" aria-label={tr('Главное меню')}>
      <NavLink to={`/id/${me.id}`} end>
        <CircleUserRound size={20} /> {tr('Моя страница')}
      </NavLink>
      <NavLink to="/feed">
        <Newspaper size={20} /> {tr('Новости')}
      </NavLink>
      <a href="/messenger">
        <MessageCircle size={20} /> {tr('Мессенджер')} <Counter n={counters.messages} hot />
      </a>
      <NavLink to="/friends">
        <Users size={20} /> {tr('Друзья')} <Counter n={counters.friends} />
      </NavLink>
      <NavLink to="/groups">
        <UsersRound size={20} /> {tr('Сообщества')}
      </NavLink>
      <NavLink to={`/photos/${me.id}`}>
        <ImageIcon size={20} /> {tr('Фотографии')}
      </NavLink>
      <NavLink to="/activity">
        <Bell size={20} /> {tr('Уведомления')} <Counter n={counters.notifications} />
      </NavLink>
      <div className="sidebar-sep" />
      <div className="sidebar-title">{tr('Моя родина')}</div>
      {FAMILY_LINKS().map(({ href, icon: Icon, label }) => (
        <a key={href} href={href}>
          <Icon size={20} /> {label}
        </a>
      ))}
      <div className="sidebar-sep" />
      <NavLink to="/settings">
        <Settings size={20} /> {tr('Настройки')}
      </NavLink>
      {isStaffLevel(me.level.type) && (
        <a href="/admin">
          <Shield size={20} /> {tr('Админ-панель')}
        </a>
      )}
      <div className="sidebar-foot">
        {config.siteTitle} © {new Date().getFullYear()}
      </div>
    </nav>
  );
}

function TabBar() {
  const me = useMe();
  const { counters } = useRealtime();
  return (
    <nav className="tabbar" aria-label={tr('Навигация')}>
      <NavLink to="/feed">
        <Newspaper size={24} /> {tr('Новости')}
      </NavLink>
      <NavLink to="/groups">
        <UsersRound size={24} /> {tr('Группы')}
      </NavLink>
      <a href="/messenger">
        <MessageCircle size={24} /> {tr('Мессенджер')}
        {counters.messages > 0 && <span className="badge">{counters.messages}</span>}
      </a>
      <a href="/dashboard">
        <Crown size={24} /> {tr('Родина')}
      </a>
      <NavLink to={`/id/${me.id}`}>
        <CircleUserRound size={24} /> {tr('Профиль')}
      </NavLink>
    </nav>
  );
}

export function Toasts() {
  const { toasts, dismissToast } = useRealtime();
  return (
    <div className="toasts" aria-live="polite">
      {toasts.map((t) => (
        <Link key={t.id} to={t.link} className="toast" onClick={() => dismissToast(t.id)}>
          <Avatar src={t.user.avatar} name={t.title} id={t.user.id} size={40} />
          <div className="body">
            <div className="name ellipsis">{t.title}</div>
            <div className="ellipsis muted">{t.text}</div>
          </div>
        </Link>
      ))}
    </div>
  );
}

export function Layout() {
  const { pathname } = useLocation();
  useEffect(() => window.scrollTo(0, 0), [pathname]);
  return (
    <>
      <Header />
      <div className="page">
        <Sidebar />
        <main className="main">
          <Suspense fallback={<Spinner />}>
            <div className="route-view" key={pathname.startsWith('/im') ? '/im' : pathname}>
              <Outlet />
            </div>
          </Suspense>
        </main>
      </div>
      <TabBar />
      <Toasts />
      <ImpersonationBar />
    </>
  );
}
