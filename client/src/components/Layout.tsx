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
  Shield,
  Sun,
  Users,
  UsersRound,
} from 'lucide-react';
import { api } from '../lib/api';
import { useAuth, useMe } from '../lib/auth';
import { useRealtime } from '../lib/realtime';
import { useTheme } from '../lib/theme';
import { fullName } from '../lib/utils';
import { NotificationList } from './Notifications';
import { ImpersonationBar } from './Moderation';
import { useConfig } from '../lib/config';
import { isStaffLevel } from '../lib/types';
import { Avatar, Spinner, useClickOutside } from './ui';
import { ThemeSwitch } from './uiverse';

function Logo() {
  const { config } = useConfig();
  return (
    <Link to="/feed" className="logo" aria-label="Glendale">
      <span className="logo-mark">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
          <path d="M18.5 7.5A8 8 0 1 0 20 12h-7" />
        </svg>
      </span>
      <span>{config.siteTitle.toLowerCase()}</span>
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
      <button className="header-icon" onClick={toggle} aria-label="Уведомления">
        <Bell size={22} />
        {counters.notifications > 0 && <span className="badge">{counters.notifications}</span>}
      </button>
      {open && (
        <div className="dropdown" style={{ width: 380, maxWidth: 'calc(100vw - 24px)', right: -60, padding: 0, overflow: 'hidden' }}>
          <div className="card-title" style={{ borderBottom: '1px solid var(--separator)' }}>
            Уведомления
          </div>
          <div style={{ maxHeight: 420, overflowY: 'auto' }}>
            <NotificationList compact onItemClick={close} />
          </div>
          <Link to="/notifications" className="menu-item" style={{ justifyContent: 'center', color: 'var(--accent)', borderTop: '1px solid var(--separator)', padding: 12 }} onClick={close}>
            Показать все
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
  const ref = useClickOutside<HTMLDivElement>(open, close);
  return (
    <div style={{ position: 'relative' }} ref={ref}>
      <button className="header-user" onClick={() => setOpen((o) => !o)} aria-label="Меню профиля">
        <Avatar src={me.avatar} name={fullName(me)} id={me.id} size={32} />
        <ChevronDown size={16} />
      </button>
      {open && (
        <div className="dropdown" style={{ width: 260 }}>
          <Link to={`/id/${me.id}`} className="menu-item" onClick={close} style={{ padding: '10px 16px' }}>
            <Avatar src={me.avatar} name={fullName(me)} id={me.id} size={40} />
            <div style={{ minWidth: 0 }}>
              <div className="name ellipsis">{fullName(me)}</div>
              <div className="meta">Перейти на свою страницу</div>
            </div>
          </Link>
          <div className="menu-sep" />
          {isStaffLevel(me.level.type) && (
            <Link to="/admin" className="menu-item" onClick={close}>
              <Shield size={18} /> Админ-панель
            </Link>
          )}
          <Link to="/settings" className="menu-item" onClick={close}>
            <Settings size={18} /> Настройки
          </Link>
          <div className="menu-item" style={{ cursor: 'default' }}>
            {theme === 'dark' ? <Moon size={18} /> : <Sun size={18} />}
            Тема: {theme === 'dark' ? 'тёмная' : 'светлая'}
            <span style={{ marginLeft: 'auto' }}>
              <ThemeSwitch dark={theme === 'dark'} onChange={(d) => setTheme(d ? 'dark' : 'light')} size={9} />
            </span>
          </div>
          <div className="menu-sep" />
          <button className="menu-item" onClick={signOut}>
            <LogOut size={18} /> Выйти
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
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Поиск" aria-label="Поиск" />
        </form>
        <div className="header-spacer" />
        <Link to="/search" className="header-icon mobile-only" aria-label="Поиск">
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

function Sidebar() {
  const me = useMe();
  const { config } = useConfig();
  const { counters } = useRealtime();
  return (
    <nav className="sidebar" aria-label="Главное меню">
      <NavLink to={`/id/${me.id}`} end>
        <CircleUserRound size={20} /> Моя страница
      </NavLink>
      <NavLink to="/feed">
        <Newspaper size={20} /> Новости
      </NavLink>
      <NavLink to="/im">
        <MessageCircle size={20} /> Мессенджер <Counter n={counters.messages} hot />
      </NavLink>
      <NavLink to="/friends">
        <Users size={20} /> Друзья <Counter n={counters.friends} />
      </NavLink>
      <NavLink to="/groups">
        <UsersRound size={20} /> Сообщества
      </NavLink>
      <NavLink to={`/photos/${me.id}`}>
        <ImageIcon size={20} /> Фотографии
      </NavLink>
      <NavLink to="/notifications">
        <Bell size={20} /> Уведомления
      </NavLink>
      <div className="sidebar-sep" />
      <NavLink to="/settings">
        <Settings size={20} /> Настройки
      </NavLink>
      {isStaffLevel(me.level.type) && (
        <NavLink to="/admin">
          <Shield size={20} /> Админ-панель
        </NavLink>
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
    <nav className="tabbar" aria-label="Навигация">
      <NavLink to="/feed">
        <Newspaper size={24} /> Новости
      </NavLink>
      <NavLink to="/groups">
        <UsersRound size={24} /> Сообщества
      </NavLink>
      <NavLink to="/im">
        <MessageCircle size={24} /> Мессенджер
        {counters.messages > 0 && <span className="badge">{counters.messages}</span>}
      </NavLink>
      <NavLink to="/friends">
        <Users size={24} /> Друзья
        {counters.friends > 0 && <span className="badge">{counters.friends}</span>}
      </NavLink>
      <NavLink to={`/id/${me.id}`}>
        <CircleUserRound size={24} /> Профиль
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
