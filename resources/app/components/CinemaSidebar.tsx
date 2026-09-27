import { tr } from '../lib/i18n';
import { Link, NavLink, useLocation } from 'react-router-dom';
import {
  ArrowLeft,
  Bookmark,
  Cat,
  Clapperboard,
  Crown,
  Film,
  Flame,
  Ghost,
  Heart,
  History,
  Home,
  Sparkles,
  Tv,
} from 'lucide-react';
import { useMe } from '../lib/auth';

/** Розділи кінопорталу — у тому ж бічному меню, що й решта сайту. */
export const CINEMA_SECTIONS = [
  { key: 'movie', label: 'Кіно', icon: Film },
  { key: 'series', label: 'Серіали', icon: Tv },
  { key: 'anime', label: 'Аніме', icon: Sparkles },
  { key: 'dorama', label: 'Дорами', icon: Heart },
  { key: 'cartoon', label: 'Мультфільми', icon: Cat },
  { key: 'toon', label: 'Мультсеріали', icon: Ghost },
] as const;

export function CinemaSidebar() {
  const me = useMe();
  const { pathname, search } = useLocation();
  const q = new URLSearchParams(search);
  const browse = pathname === '/cinema/browse';
  const is = (k: string, v: string | null) => browse && q.get(k) === v && [...q.keys()].length === 1;
  const manager = me.families.some((f) => f.status === 'verified' && (f.role === 'leader' || f.role === 'deputy'));
  const family = me.families.find((f) => f.status === 'verified');
  return (
    <nav className="sidebar cinema-sidebar" aria-label={tr('Кінопортал')}>
      <NavLink to="/cinema" end>
        <Home size={20} /> {tr('Рекомендації')}
      </NavLink>
      <Link to="/cinema/browse?sort=new" className={is('sort', 'new') ? 'active' : undefined}>
        <Flame size={20} /> {tr('Новинки')}
      </Link>
      <Link to="/cinema/browse?sort=popular" className={is('sort', 'popular') ? 'active' : undefined}>
        <Clapperboard size={20} /> {tr('Популярне')}
      </Link>
      <div className="sidebar-sep" />
      {CINEMA_SECTIONS.map(({ key, label, icon: Icon }) => (
        <Link key={key} to={`/cinema/browse?category=${key}`} className={is('category', key) ? 'active' : undefined}>
          <Icon size={20} /> {tr(label)}
        </Link>
      ))}
      <div className="sidebar-sep" />
      <NavLink to="/cinema/watchlist">
        <Bookmark size={20} /> {tr('Мої закладки')}
      </NavLink>
      <NavLink to="/cinema/history">
        <History size={20} /> {tr('Історія перегляду')}
      </NavLink>

      {/* Замість «преміуму» — зв'язок із родиною: кіновечори в календарі родини. */}
      <div className="cinema-promo">
        <Crown size={30} />
        <b>{tr('Кіновечір')}</b>
        <span>{tr('з родиною')}</span>
        <ul>
          <li>{tr('Подія в календарі родини')}</li>
          <li>{tr('Нагадування всім учасникам')}</li>
          <li>{tr('Оцінки друзів і родини')}</li>
        </ul>
        {family ? (
          <a href="/events" className="cinema-promo-btn">
            {manager ? tr('Запланувати перегляд') : tr('Календар родини')}
          </a>
        ) : (
          <Link to="/families" className="cinema-promo-btn">
            {tr('Знайти родину')}
          </Link>
        )}
      </div>

      <Link to="/feed" className="cinema-back">
        <ArrowLeft size={16} /> {tr('До соцмережі')}
      </Link>
    </nav>
  );
}
