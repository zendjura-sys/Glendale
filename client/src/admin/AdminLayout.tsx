import { tr } from '../lib/i18n';
import { Suspense, useEffect } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  BarChart3,
  Flag,
  LayoutDashboard,
  Megaphone,
  MessagesSquare,
  Palette,
  Plug,
  ScrollText,
  Settings2,
  ShieldCheck,
  ShieldAlert,
  Users,
  UserPlus,
} from 'lucide-react';
import { api } from '../lib/api';
import { useMe } from '../lib/auth';
import { isAdminLevel } from '../lib/types';
import { Header, Toasts } from '../components/Layout';
import { Spinner } from '../components/ui';
import type { Dashboard } from './types';

export function AdminLayout() {
  const me = useMe();
  const full = isAdminLevel(me.level.type);
  const { pathname } = useLocation();
  useEffect(() => window.scrollTo(0, 0), [pathname]);
  const { data } = useQuery({ queryKey: ['admin', 'dashboard'], queryFn: () => api<Dashboard>('/admin/dashboard'), refetchInterval: 60_000 });
  const openReports = data?.totals.openReports ?? 0;
  const pending = data?.totals.pendingUsers ?? 0;

  return (
    <>
      <Header />
      <div className="page">
        <nav className="sidebar admin-nav" aria-label={tr('Админ-панель')}>
          <NavLink to="/admin" end>
            <LayoutDashboard size={20} /> {tr('Обзор')}
          </NavLink>
          <div className="nav-group">{tr('Модерация')}</div>
          <NavLink to="/admin/reports">
            <Flag size={20} /> {tr('Жалобы')} {openReports > 0 && <span className="count">{openReports}</span>}
          </NavLink>
          <NavLink to="/admin/content">
            <MessagesSquare size={20} /> {tr('Контент')}
          </NavLink>
          {full && (
            <>
              <div className="nav-group">{tr('Управление')}</div>
              <NavLink to="/admin/members">
                <Users size={20} /> {tr('Участники')} {pending > 0 && <span className="count">{pending}</span>}
              </NavLink>
              <NavLink to="/admin/levels">
                <ShieldCheck size={20} /> {tr('Уровни доступа')}
              </NavLink>
              <NavLink to="/admin/announcements">
                <Megaphone size={20} /> {tr('Объявления')}
              </NavLink>
              <div className="nav-group">{tr('Настройки')}</div>
              <NavLink to="/admin/settings/general">
                <Settings2 size={20} /> {tr('Общие')}
              </NavLink>
              <NavLink to="/admin/settings/signup">
                <UserPlus size={20} /> {tr('Регистрация')}
              </NavLink>
              <NavLink to="/admin/settings/security">
                <ShieldAlert size={20} /> {tr('Защита и баны')}
              </NavLink>
              <NavLink to="/admin/settings/appearance">
                <Palette size={20} /> {tr('Оформление')}
              </NavLink>
              <NavLink to="/admin/settings/integrations">
                <Plug size={20} /> {tr('Интеграции')}
              </NavLink>
              <div className="nav-group">{tr('Аналитика')}</div>
              <NavLink to="/admin/stats">
                <BarChart3 size={20} /> {tr('Статистика')}
              </NavLink>
              <NavLink to="/admin/log">
                <ScrollText size={20} /> {tr('Журнал')}
              </NavLink>
            </>
          )}
          <div className="sidebar-sep" />
          <NavLink to="/feed">
            <ArrowLeft size={20} /> {tr('На сайт')}
          </NavLink>
        </nav>
        <main className="main">
          <nav className="admin-chips" aria-label={tr('Разделы админ-панели')}>
            {[
              ['/admin', tr('Обзор'), true],
              ['/admin/reports', `${tr('Жалобы')}${openReports ? ` · ${openReports}` : ''}`, true],
              ['/admin/content', tr('Контент'), true],
              ['/admin/members', `${tr('Участники')}${pending ? ` · ${pending}` : ''}`, full],
              ['/admin/levels', tr('Уровни'), full],
              ['/admin/announcements', tr('Объявления'), full],
              ['/admin/settings/general', tr('Настройки'), full],
              ['/admin/settings/signup', tr('Регистрация'), full],
              ['/admin/settings/security', tr('Защита'), full],
              ['/admin/settings/appearance', tr('Оформление'), full],
              ['/admin/settings/integrations', tr('Интеграции'), full],
              ['/admin/stats', tr('Статистика'), full],
              ['/admin/log', tr('Журнал'), full],
              ['/feed', tr('На сайт'), true],
            ]
              .filter(([, , show]) => show)
              .map(([to, label]) => (
                <NavLink key={to as string} to={to as string} end={to === '/admin'}>
                  {label}
                </NavLink>
              ))}
          </nav>
          <Suspense fallback={<Spinner />}>
            <div className="route-view admin-page" key={pathname}>
              <Outlet />
            </div>
          </Suspense>
        </main>
      </div>
      <Toasts />
    </>
  );
}
