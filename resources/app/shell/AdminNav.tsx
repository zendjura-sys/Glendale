import { tr } from '../lib/i18n';
import { createPortal } from 'react-dom';
import { useLocation } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  Blocks,
  CalendarDays,
  Crown,
  Handshake,
  History,
  IdCard,
  LayoutDashboard,
  Megaphone,
  MessageCircle,
  Palette,
  Scale,
  ScrollText,
  Settings,
  ShieldCheck,
  ShieldOff,
  Target,
  TrendingUp,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import type { ShellConfig } from './config';

const ICONS: Record<string, LucideIcon> = {
  dashboard: LayoutDashboard,
  crown: Crown,
  scroll: ScrollText,
  users: Users,
  idcard: IdCard,
  scale: Scale,
  trending: TrendingUp,
  target: Target,
  calendar: CalendarDays,
  wallet: Wallet,
  megaphone: Megaphone,
  handshake: Handshake,
  shieldoff: ShieldOff,
  blocks: Blocks,
  shield: ShieldCheck,
  message: MessageCircle,
  palette: Palette,
  history: History,
  alert: AlertTriangle,
  settings: Settings,
};

/** Активний пункт: сама сторінка або вкладені (/admin/families/… для «Родини та союзи»). */
function useActive() {
  const { pathname } = useLocation();
  return (href: string) => (href === '/admin' ? pathname === '/admin' : pathname === href || pathname.startsWith(href + '/'));
}

/** Меню адмінки — як у соцмережі: групи розділів у тому самому боковому меню. */
export function AdminSidebar({ groups }: { groups: ShellConfig['admin'] }) {
  const isActive = useActive();
  return (
    <nav className="sidebar admin-nav" aria-label={tr('Админ-панель')}>
      {groups.map((g, i) => (
        <div key={g.label}>
          {i > 0 && <div className="nav-group">{g.label}</div>}
          {g.items.map((it) => {
            const Icon = ICONS[it.icon] ?? LayoutDashboard;
            return (
              <a key={it.href} href={it.href} className={isActive(it.href) ? 'active' : undefined}>
                <Icon size={20} /> <span className="ellipsis">{it.label}</span>
              </a>
            );
          })}
        </div>
      ))}
      <div className="sidebar-sep" />
      <a href="/feed">
        <ArrowLeft size={20} /> {tr('На сайт')}
      </a>
    </nav>
  );
}

/** На телефоні бокового меню немає — розділи адмінки стрічкою чіпів над сторінкою. */
export function AdminChips({ groups, target }: { groups: ShellConfig['admin']; target: HTMLElement }) {
  const items = groups.flatMap((g) => g.items);
  const isActive = useActive();
  return createPortal(
    <nav className="admin-chips" aria-label={tr('Разделы админ-панели')}>
      {items.map((it) => (
        <a key={it.href} href={it.href} className={isActive(it.href) ? 'active' : undefined}>
          {it.label}
        </a>
      ))}
      <a href="/feed">{tr('На сайт')}</a>
    </nav>,
    target,
  );
}
