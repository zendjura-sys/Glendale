import { tr } from '../lib/i18n';
import '@fontsource-variable/oswald';
import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Link, NavLink, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowRight,
  Bookmark,
  BookmarkCheck,
  CalendarPlus,
  ChevronRight,
  Clapperboard,
  Crown,
  Film,
  History,
  Home,
  Info,
  Play,
  Search,
  Send,
  Share2,
  Star,
  Trash2,
  Tv,
  Users,
  Youtube,
} from 'lucide-react';
import { api } from '../lib/api';
import { useMe } from '../lib/auth';
import type { CinemaCategory, CinemaEpisode, CinemaHistoryItem, CinemaHome, CinemaPerson, CinemaSpotlight, TitleCard, TitleFull, UserShort } from '../lib/types';
import { formatDate, fullName } from '../lib/utils';
import { AutoTextarea, Avatar, Empty, Modal, Spinner, useSentinel } from '../components/ui';
import { CINEMA_SECTIONS } from '../components/CinemaSidebar';

/* ───────────── спільне ───────────── */

const kindLabel = (t: { type: 'movie' | 'series' }) => (t.type === 'series' ? tr('Серіал') : tr('Фільм'));
const runtimeLabel = (min: number | null) => (min ? (min >= 60 ? `${Math.floor(min / 60)} год${min % 60 ? ` ${min % 60} хв` : ''}` : `${min} хв`) : null);
const votes = (n: number) => n.toLocaleString('uk-UA');
const catLabel = (t: TitleCard) => t.categoryLabel ?? kindLabel(t);

/**
 * Режим кінотеатру: ширша сітка й завжди темна тема, поки людина в розділі
 * «Кіно» (після виходу повертається обрана тема).
 */
function useCinemaMode() {
  useEffect(() => {
    const root = document.documentElement;
    const prev = root.dataset.theme;
    root.dataset.wide = 'cinema';
    root.dataset.cinema = '1';
    root.dataset.theme = 'dark';
    return () => {
      delete root.dataset.wide;
      delete root.dataset.cinema;
      if (prev) root.dataset.theme = prev;
    };
  }, []);
}

function Shell({ children }: { children: ReactNode }) {
  useCinemaMode();
  return (
    <div className="cinema">
      <CinemaTabs />
      {children}
    </div>
  );
}

function CinemaTabs() {
  const navigate = useNavigate();
  const { pathname, search } = useLocation();
  const cat = pathname === '/cinema/browse' ? new URLSearchParams(search).get('category') : null;
  const [q, setQ] = useState(new URLSearchParams(search).get('q') ?? '');
  const submit = (e: FormEvent) => {
    e.preventDefault();
    navigate(q.trim() ? `/cinema/browse?q=${encodeURIComponent(q.trim())}` : '/cinema/browse');
  };
  const tabs = CINEMA_SECTIONS.filter((s) => s.key !== 'toon');
  return (
    <header className="k-tabs-bar">
      <nav className="k-tabs-nav">
        <NavLink to="/cinema" end>
          <Home size={17} /> {tr('Головна')}
        </NavLink>
        <Link to="/cinema/browse" className={pathname === '/cinema/browse' && !cat ? 'active' : ''}>
          <Clapperboard size={17} /> {tr('Усі')}
        </Link>
        {tabs.map(({ key, label, icon: Icon }) => (
          <Link key={key} to={`/cinema/browse?category=${key}`} className={cat === key ? 'active' : ''}>
            <Icon size={17} /> {tr(label)}
          </Link>
        ))}
      </nav>
      <form className="k-search" onSubmit={submit}>
        <Search size={18} />
        <input placeholder={tr('Пошук фільмів, серіалів, аніме…')} value={q} onChange={(e) => setQ(e.target.value)} />
      </form>
    </header>
  );
}

const BADGE_CLASS: Record<string, string> = { '4K': 'b4k', HDR: 'bhdr', DUB: 'bdub', SUB: 'bsub', FHD: 'b4k', HD: 'b4k' };

function Badges({ list }: { list?: string[] }) {
  if (!list?.length) return null;
  return (
    <div className="k-badges">
      {list.map((b) => (
        <span key={b} className={`k-badge ${BADGE_CLASS[b] ?? ''}`}>
          {b}
        </span>
      ))}
    </div>
  );
}

export function TitlePoster({ t, wide, progress }: { t: TitleCard; wide?: boolean; progress?: number | null }) {
  const rating = t.myRating ?? t.localRating ?? t.rating;
  const img = wide ? (t.backdrop ?? t.poster) : t.poster;
  return (
    <Link to={`/cinema/title/${t.id}`} className={`title-poster${wide ? ' wide' : ''}`} title={t.name}>
      {img ? <img src={img} alt="" loading="lazy" decoding="async" /> : <span className="tp-blank"><Clapperboard size={28} /></span>}
      <Badges list={t.badges} />
      {t.hasPlayer && (
        <span className="tp-play">
          <Play size={18} fill="currentColor" />
        </span>
      )}
      <span className="tp-foot">
        <span className="tp-name">{t.name}</span>
        <span className="tp-meta">
          <span className="ellipsis">{[t.role ?? catLabel(t), t.year].filter(Boolean).join(' · ')}</span>
          {rating ? (
            <span className={`tp-rate${t.myRating ? ' mine' : ''}`}>
              <Star size={12} fill="currentColor" /> {Number(rating).toFixed(t.myRating ? 0 : 1)}
            </span>
          ) : null}
        </span>
        {progress !== undefined && progress !== null && (
          <span className="tp-progress">
            <i style={{ width: `${Math.min(100, Math.max(3, progress))}%` }} />
          </span>
        )}
      </span>
    </Link>
  );
}

export function TitleGrid({ items }: { items: TitleCard[] }) {
  return (
    <div className="title-grid">
      {items.map((t) => (
        <TitlePoster key={t.id} t={t} />
      ))}
    </div>
  );
}

function SectionHead({ title, to, children, all }: { title: string; to?: string; children?: ReactNode; all?: string }) {
  return (
    <div className="k-head">
      <h2>{to ? <Link to={to}>{title} <ChevronRight size={20} /></Link> : title}</h2>
      {children}
      {all && (
        <Link to={all} className="k-all">
          {tr('Дивитися всі')} <ChevronRight size={16} />
        </Link>
      )}
    </div>
  );
}

/** Горизонтальна стрічка з кнопкою прокрутки праворуч, як на вітрині. */
function Strip({ children, wide }: { children: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const [end, setEnd] = useState(false);
  const scroll = () => {
    const el = ref.current;
    if (!el) return;
    const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 8;
    el.scrollTo({ left: atEnd ? 0 : el.scrollLeft + el.clientWidth * 0.8, behavior: 'smooth' });
  };
  return (
    <div className="k-strip-wrap">
      <div
        className={`cinema-strip${wide ? ' wide' : ''}`}
        ref={ref}
        onScroll={(e) => {
          const el = e.currentTarget;
          setEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 8);
        }}
      >
        {children}
      </div>
      <button className={`k-strip-next${end ? ' back' : ''}`} onClick={scroll} aria-label={tr('Далі')}>
        <ArrowRight size={20} />
      </button>
    </div>
  );
}

function Row({ title, items, more, wide }: { title: string; items: TitleCard[]; more?: string; wide?: boolean }) {
  if (!items.length) return null;
  return (
    <section className="k-section">
      <SectionHead title={title} to={more} all={more} />
      <Strip wide={wide}>
        {items.map((t) => (
          <TitlePoster key={t.id} t={t} wide={wide} />
        ))}
      </Strip>
    </section>
  );
}

/** «Популярне зараз» з перемикачем розділів. */
function PopularRow() {
  const [cat, setCat] = useState<CinemaCategory | ''>('');
  const { data } = useQuery({
    queryKey: ['cinema', 'browse', `category=${cat}&sort=popular`, 'row'],
    queryFn: () => api<{ items: TitleCard[] }>(`/cinema/titles?sort=popular${cat ? `&category=${cat}` : ''}`),
    placeholderData: (prev) => prev,
  });
  const all = `/cinema/browse?sort=popular${cat ? `&category=${cat}` : ''}`;
  return (
    <section className="k-section">
      <SectionHead title={tr('Популярне зараз')} to={all} all={all}>
        <div className="k-pills">
          <button className={cat === '' ? 'on' : ''} onClick={() => setCat('')}>
            {tr('Усі')}
          </button>
          {CINEMA_SECTIONS.map((s) => (
            <button key={s.key} className={cat === s.key ? 'on' : ''} onClick={() => setCat(s.key)}>
              {tr(s.label)}
            </button>
          ))}
        </div>
      </SectionHead>
      {data && !data.items.length ? (
        <div className="k-empty-row">{tr('У цьому розділі поки порожньо')}</div>
      ) : (
        <Strip>{data?.items.map((t) => <TitlePoster key={t.id} t={t} />)}</Strip>
      )}
    </section>
  );
}

/* ───────────── рейтинги й кнопки (банер і сторінка фільму) ───────────── */

function Stars({ value }: { value: number }) {
  const v = value / 2;
  return (
    <span className="k-stars" aria-label={`${value}/10`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <span key={n} className="k-star">
          <Star size={18} />
          <span className="k-star-fill" style={{ width: `${Math.max(0, Math.min(1, v - n + 1)) * 100}%` }}>
            <Star size={18} fill="currentColor" />
          </span>
        </span>
      ))}
    </span>
  );
}

function Bar({ label, value, max = 10, note }: { label: string; value: number | null; max?: number; note?: string }) {
  if (value === null || value === undefined) return null;
  return (
    <div className="k-bar">
      <div className="k-bar-top">
        <span>{label}</span>
        <b>{max === 100 ? `${value}%` : value.toFixed(1)}</b>
        {note && <span className="k-bar-note">{note}</span>}
      </div>
      <div className="k-bar-track">
        <i style={{ width: `${Math.min(100, (value / max) * 100)}%` }} />
      </div>
    </div>
  );
}

type SpotSource = TitleCard & {
  overview: string;
  voteCount: number;
  localRatingCount: number;
  cast: { personId: number; name: string }[];
  interest?: number | null;
};

function SpotInfo({ t, actions, meta }: { t: SpotSource; actions: ReactNode; meta?: ReactNode }) {
  const main = t.localRating ?? t.rating;
  return (
    <div className="k-info">
      {meta}
      <h1 className="k-title">{t.name}</h1>
      {t.originalName && t.originalName !== t.name && <div className="k-original">{t.originalName}</div>}
      <div className="k-scores">
        <div className="k-scores-main">
          {main ? (
            <div className="k-big-rate">
              <Stars value={main} />
              <b>{main.toFixed(1)}</b>
              <small>/10</small>
              <span className="k-votes">{t.localRating ? `${votes(t.localRatingCount)} ${tr('голосів')}` : 'TMDB'}</span>
            </div>
          ) : null}
          <Bar label={tr('Інтерес глядачів')} value={t.interest ?? null} max={100} />
        </div>
        <div className="k-scores-side">
          <Bar label="TMDB" value={t.rating} note={`${votes(t.voteCount)} ${tr('голосів')}`} />
          <Bar label="GameCon" value={t.localRating} note={t.localRatingCount ? `${votes(t.localRatingCount)} ${tr('голосів')}` : undefined} />
        </div>
      </div>
      {t.overview && <p className="k-overview">{t.overview}</p>}
      {t.cast.length > 0 && (
        <div className="k-cast-links">
          {t.cast.slice(0, 4).map((c) => (
            <Link key={c.personId} to={`/cinema/person/${c.personId}`}>
              {c.name}
            </Link>
          ))}
        </div>
      )}
      <div className="k-actions">{actions}</div>
    </div>
  );
}

/** Рядок-кікер: «АНІМЕ · 2024 · 4K DUB SUB». */
function Kicker({ t, extra }: { t: TitleCard; extra?: ReactNode }) {
  return (
    <div className="k-kicker">
      <b>{catLabel(t)}</b>
      {t.year && <span>{t.year}</span>}
      {t.genres.slice(0, 2).map((g) => (
        <span key={g} className="k-kicker-genre">
          {g}
        </span>
      ))}
      <Badges list={t.badges} />
      {extra}
    </div>
  );
}

function WatchButton({ label, onClick, to }: { label: string; onClick?: () => void; to?: string }) {
  const inner = (
    <>
      <span className="k-play-box">
        <Play size={18} fill="currentColor" />
      </span>
      <span className="k-btn-label">{label}</span>
    </>
  );
  return to ? (
    <Link to={to} className="k-btn k-btn-watch">
      {inner}
    </Link>
  ) : (
    <button className="k-btn k-btn-watch" onClick={onClick}>
      {inner}
    </button>
  );
}

function TrailerButton({ onClick }: { onClick: () => void }) {
  return (
    <button className="k-btn" onClick={onClick}>
      <Youtube size={19} className="k-yt" /> {tr('Трейлер')}
    </button>
  );
}

function SaveButton({ saved, onClick }: { saved: boolean; onClick: () => void }) {
  return (
    <button className={`k-btn${saved ? ' on' : ''}`} onClick={onClick}>
      {saved ? <BookmarkCheck size={18} /> : <Bookmark size={18} />} {saved ? tr('У закладках') : tr('У закладки')}
    </button>
  );
}

function TrailerModal({ id, onClose }: { id: string; onClose: () => void }) {
  return (
    <Modal title={tr('Трейлер')} onClose={onClose} wide>
      <div className="cinema-trailer">
        <iframe src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`} allow="autoplay; fullscreen; encrypted-media" allowFullScreen title={tr('Трейлер')} />
      </div>
    </Modal>
  );
}

async function toggleSaved(qc: ReturnType<typeof useQueryClient>, id: number, saved: boolean) {
  const r = await api<{ inWatchlist: boolean }>(`/cinema/titles/${id}/watchlist`, { method: saved ? 'DELETE' : 'POST' });
  qc.invalidateQueries({ queryKey: ['cinema', 'watchlist'] });
  return r.inWatchlist;
}

/* ───────────── банер головної ───────────── */

function Hero({ items }: { items: CinemaSpotlight[] }) {
  const qc = useQueryClient();
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const [saved, setSaved] = useState<Record<number, boolean>>({});
  const [trailer, setTrailer] = useState<string | null>(null);

  useEffect(() => {
    if (items.length < 2 || paused || trailer) return;
    const t = setInterval(() => setI((x) => (x + 1) % items.length), 8000);
    return () => clearInterval(t);
  }, [items.length, paused, trailer]);

  const t = items[i];
  if (!t) return null;
  const isSaved = saved[t.id] ?? t.inWatchlist;
  const thumbs = items.length > 1 ? items : [];

  return (
    <div className="k-hero" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      {items.map((x, k) => (
        <div key={x.id} className={`k-hero-bg${k === i ? ' on' : ''}`} style={x.backdrop ? { backgroundImage: `url(${x.backdrop.replace('/w780/', '/original/')})` } : undefined} />
      ))}
      <div className="k-hero-body" key={t.id}>
        <Kicker t={t} />
        <h1 className="k-hero-name">{t.name}</h1>
        {t.overview && <p className="k-hero-text">{t.overview}</p>}
        <div className="k-actions">
          <WatchButton label={tr('Дивитися')} to={`/cinema/title/${t.id}${t.hasPlayer ? '#watch' : ''}`} />
          <Link to={`/cinema/title/${t.id}`} className="k-btn">
            <Info size={18} /> {tr('Детальніше')}
          </Link>
          {t.trailer && <TrailerButton onClick={() => setTrailer(t.trailer)} />}
          <button
            className={`k-btn k-btn-icon${isSaved ? ' on' : ''}`}
            onClick={async () => setSaved({ ...saved, [t.id]: await toggleSaved(qc, t.id, isSaved) })}
            title={isSaved ? tr('У закладках') : tr('У закладки')}
          >
            {isSaved ? <BookmarkCheck size={18} /> : <Bookmark size={18} />}
          </button>
        </div>
      </div>
      {thumbs.length > 0 && (
        <div className="k-hero-thumbs">
          {thumbs.slice(0, 5).map((x, k) => (
            <button key={x.id} className={k === i ? 'on' : ''} onClick={() => setI(k)} aria-label={x.name}>
              {x.poster ? <img src={x.poster} alt="" /> : <Clapperboard size={18} />}
            </button>
          ))}
        </div>
      )}
      {items.length > 1 && (
        <div className="k-hero-dots">
          {items.map((x, k) => (
            <button key={x.id} className={k === i ? 'on' : ''} onClick={() => setI(k)} aria-label={x.name} />
          ))}
        </div>
      )}
      {trailer && <TrailerModal id={trailer} onClose={() => setTrailer(null)} />}
    </div>
  );
}

function Trends({ items }: { items: TitleCard[] }) {
  if (!items.length) return null;
  return (
    <aside className="k-trends">
      <h3>{tr('Тренди сьогодні')}</h3>
      {items.map((t, k) => (
        <Link key={t.id} to={`/cinema/title/${t.id}`} className="k-trend">
          <span className="k-trend-num">{k + 1}</span>
          <span className="k-trend-img">{t.backdrop || t.poster ? <img src={(t.backdrop ?? t.poster)!} alt="" loading="lazy" /> : <Clapperboard size={16} />}</span>
          <span className="k-trend-info">
            <b className="ellipsis">{t.name}</b>
            <small>
              {catLabel(t)}
              {t.year ? ` · ${t.year}` : ''}
            </small>
          </span>
        </Link>
      ))}
    </aside>
  );
}

function CategoryTiles({ items }: { items: CinemaHome['categories'] }) {
  return (
    <div className="k-cats">
      {items.map((c) => (
        <Link key={c.key} to={`/cinema/browse?category=${c.key}`} className={`k-cat k-cat-${c.key}`}>
          {c.image && <img src={c.image} alt="" loading="lazy" />}
          <span className="k-cat-text">
            <b>{tr(c.name)}</b>
            <small>{c.count ? tr(c.caption) : tr('Скоро')}</small>
          </span>
          <span className="k-cat-go">
            <ArrowRight size={18} />
          </span>
        </Link>
      ))}
    </div>
  );
}

/* ───────────── головна ───────────── */

export default function CinemaHomePage() {
  const { data, isLoading } = useQuery({ queryKey: ['cinema', 'home'], queryFn: () => api<CinemaHome>('/cinema/home') });
  const me = useMe();
  const empty = data && !data.movies.length && !data.series.length;
  return (
    <Shell>
      {isLoading && <Spinner />}
      {empty && (
        <div className="k-panel">
          <Empty icon={<Clapperboard size={48} />} title={tr('Каталог ще порожній')}>
            {me.level.type !== 'user' ? tr('Додайте фільми в адмінці: Кінопортал → Імпорт із TMDB.') : tr('Скоро тут з’являться фільми й серіали.')}
          </Empty>
        </div>
      )}
      {data && !empty && (
        <>
          <div className="k-top">
            <Hero items={data.featured} />
            <Trends items={data.trending} />
          </div>
          <CategoryTiles items={data.categories} />
          <PopularRow />
          <Row title={tr('Новинки')} items={data.fresh} more="/cinema/browse?sort=new" />
          <Row title={tr('Продовжити перегляд')} items={data.continue} more="/cinema/history" wide />
          <Row title={tr('Дивляться друзі й родина')} items={data.circle} />
          <Row title={tr('Мої закладки')} items={data.watchlist} more="/cinema/watchlist" />
          <Row title={tr('Найвищий рейтинг')} items={data.top} more="/cinema/browse?sort=rating" />
          {data.genres.length > 0 && (
            <section className="k-section">
              <SectionHead title={tr('Жанри')} />
              <div className="cinema-genres">
                {data.genres.map((g) => (
                  <Link key={g.id} to={`/cinema/browse?genre=${g.id}`} className="k-genre">
                    {g.name}
                  </Link>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </Shell>
  );
}

export function CinemaHistoryPage() {
  const { data, isLoading } = useQuery({ queryKey: ['cinema', 'history'], queryFn: () => api<CinemaHistoryItem[]>('/cinema/history') });
  return (
    <Shell>
      <SectionHead title={tr('Історія перегляду')} />
      {isLoading && <Spinner />}
      {data && !data.length && (
        <div className="k-panel">
          <Empty icon={<History size={44} />} title={tr('Ви ще нічого не дивились')}>
            {tr('Тут з’являться фільми й серії, які ви почали дивитись, — з місцем, де зупинились.')}
          </Empty>
        </div>
      )}
      {data && data.length > 0 && (
        <div className="title-grid wide">
          {data.map((t) => (
            <TitlePoster key={t.id} t={t} wide progress={t.progress.duration ? (t.progress.position / t.progress.duration) * 100 : null} />
          ))}
        </div>
      )}
    </Shell>
  );
}

/* ───────────── каталог ───────────── */

export function CinemaBrowsePage() {
  const [params, setParams] = useSearchParams();
  const category = params.get('category') ?? '';
  const genre = params.get('genre') ?? '';
  const sort = params.get('sort') ?? 'popular';
  const q = params.get('q') ?? '';
  const { data: home } = useQuery({ queryKey: ['cinema', 'home'], queryFn: () => api<CinemaHome>('/cinema/home') });
  const query = new URLSearchParams(Object.entries({ category, genre, sort, q }).filter(([, v]) => v)).toString();
  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: ['cinema', 'browse', query],
    queryFn: ({ pageParam }) => api<{ items: TitleCard[]; hasMore: boolean; total: number }>(`/cinema/titles?${query}&page=${pageParam}`),
    initialPageParam: 1,
    getNextPageParam: (last, all) => (last.hasMore ? all.length + 1 : undefined),
  });
  const sentinel = useSentinel(() => hasNextPage && !isFetchingNextPage && fetchNextPage(), !!hasNextPage);
  const items = data?.pages.flatMap((p) => p.items) ?? [];
  const set = (k: string, v: string) => {
    const next = new URLSearchParams(params);
    if (v) next.set(k, v);
    else next.delete(k);
    setParams(next, { replace: true });
  };
  const section = CINEMA_SECTIONS.find((s) => s.key === category);
  const genreName = home?.genres.find((g) => String(g.id) === genre)?.name;
  const title = q
    ? tr('Пошук: «{q}»', { q })
    : section
      ? tr(section.label)
      : genreName ?? (sort === 'new' ? tr('Новинки') : sort === 'rating' ? tr('Найвищий рейтинг') : tr('Популярне'));
  return (
    <Shell>
      <SectionHead title={title}>
        {data && <span className="k-total">{tr('Знайдено')}: {data.pages[0].total}</span>}
      </SectionHead>
      <div className="k-filters">
        <div className="k-filters-right">
          <select className="k-select" value={genre} onChange={(e) => set('genre', e.target.value)}>
            <option value="">{tr('Усі жанри')}</option>
            {home?.genres.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
          <select className="k-select" value={sort} onChange={(e) => set('sort', e.target.value)}>
            <option value="popular">{tr('Популярні')}</option>
            <option value="rating">{tr('За рейтингом')}</option>
            <option value="year">{tr('Новіші за роком')}</option>
            <option value="new">{tr('Нещодавно додані')}</option>
          </select>
          {q && (
            <button className="k-chip-x" onClick={() => set('q', '')}>
              «{q}» ✕
            </button>
          )}
        </div>
      </div>
      {isLoading && <Spinner />}
      {data && !items.length && (
        <div className="k-panel">
          <Empty icon={<Search size={44} />} title={tr('Нічого не знайдено')}>
            {tr('Спробуйте інший запит або фільтр')}
          </Empty>
        </div>
      )}
      <TitleGrid items={items} />
      <div ref={sentinel} />
      {isFetchingNextPage && <Spinner />}
    </Shell>
  );
}

export function CinemaWatchlistPage() {
  const { data, isLoading } = useQuery({ queryKey: ['cinema', 'watchlist'], queryFn: () => api<TitleCard[]>('/cinema/watchlist') });
  return (
    <Shell>
      <SectionHead title={tr('Мої закладки')} />
      {isLoading && <Spinner />}
      {data && !data.length && (
        <div className="k-panel">
          <Empty icon={<Bookmark size={44} />} title={tr('Список порожній')}>
            {tr('Натисніть «Хочу подивитись» на сторінці фільму — він з’явиться тут, а друзі побачать, що ви його чекаєте.')}
          </Empty>
        </div>
      )}
      {data && <TitleGrid items={data} />}
    </Shell>
  );
}

/* ───────────── плеєр Kodik ───────────── */

type KodikMessage = { key?: string; value?: unknown };

function Player({ title, season, episode, onEpisode }: { title: TitleFull; season: number | null; episode: number | null; onEpisode: (s: number, e: number) => void }) {
  const [translation, setTranslation] = useState(() => title.translations.find((t) => t.available)?.index ?? title.translations[0]?.index ?? 0);
  const active = title.translations.find((t) => t.index === translation);
  const enabled = active?.available ?? false;
  const { data, error, isLoading } = useQuery({
    queryKey: ['cinema', 'player', title.id, translation],
    queryFn: () => api<{ link: string; progress: TitleFull['progress'] }>(`/cinema/titles/${title.id}/player?translation=${translation}`),
    enabled,
    retry: false,
    staleTime: Infinity,
  });
  const pos = useRef({ position: 0, duration: 0, season, episode, sent: 0 });
  pos.current.season = season;
  pos.current.episode = episode;

  // Прогрес: плеєр шле postMessage — зберігаємо не частіше ніж раз на 15 с і при виході зі сторінки.
  useEffect(() => {
    const save = (force = false) => {
      const p = pos.current;
      if (p.position < 5 || (!force && Date.now() - p.sent < 15000)) return;
      p.sent = Date.now();
      api(`/cinema/titles/${title.id}/progress`, {
        body: { position: Math.floor(p.position), duration: Math.floor(p.duration) || null, season: p.season, episode: p.episode },
      }).catch(() => {});
    };
    const onMessage = (e: MessageEvent<KodikMessage>) => {
      const m = e.data;
      if (!m || typeof m !== 'object' || typeof m.key !== 'string') return;
      if (m.key === 'kodik_player_time_update') {
        pos.current.position = Number(m.value) || 0;
        save();
      } else if (m.key === 'kodik_player_duration_update') {
        pos.current.duration = Number(m.value) || 0;
      } else if (m.key === 'kodik_player_current_episode') {
        const v = m.value as { season?: number | string; episode?: number | string };
        if (v?.season && v?.episode) onEpisode(Number(v.season), Number(v.episode));
      } else if (m.key === 'kodik_player_pause' || m.key === 'kodik_player_video_ended') {
        save(true);
      }
    };
    window.addEventListener('message', onMessage);
    return () => {
      window.removeEventListener('message', onMessage);
      save(true);
    };
  }, [title.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const src = useMemo(() => {
    if (!data?.link) return null;
    const url = new URL(data.link);
    const p = data.progress;
    const s = season ?? p?.season ?? null;
    const ep = episode ?? p?.episode ?? null;
    if (title.type === 'series' && s && ep) {
      url.searchParams.set('season', String(s));
      url.searchParams.set('episode', String(ep));
    }
    // Продовжити з місця, де зупинились (якщо та сама серія).
    if (p && p.position > 30 && (title.type === 'movie' || (p.season === s && p.episode === ep))) url.searchParams.set('start_from', String(p.position));
    return url.toString();
  }, [data, season, episode, title.type]);

  return (
    <div className="k-player">
      {title.translations.length > 0 && (
        <div className="k-tabs">
          {title.translations.map((t) => (
            <button
              key={t.index}
              disabled={!t.available}
              className={[translation === t.index ? 'on' : '', t.source === 'flixcdn' ? 'k-tab-flixcdn' : ''].filter(Boolean).join(' ')}
              onClick={() => t.available && setTranslation(t.index)}
            >
              {t.title}
              {t.quality ? <small>{t.quality}</small> : null}
            </button>
          ))}
        </div>
      )}
      {!enabled ? (
        <div className="cinema-player empty">
          <Clapperboard size={36} />
          <div>{tr('Плеєр Kodik для цього тайтлу ще не знайдено')}</div>
          {title.trailer && <div className="muted">{tr('Поки що можна переглянути трейлер.')}</div>}
        </div>
      ) : isLoading ? (
        <div className="cinema-player loading"><Spinner /></div>
      ) : error || !src ? (
        <div className="cinema-player empty">
          <Clapperboard size={36} />
          <div>{(error as Error)?.message || tr('Плеєр для цього фільму ще не знайдено')}</div>
          {title.trailer && <div className="muted">{tr('Поки що можна переглянути трейлер.')}</div>}
        </div>
      ) : (
        <div className="cinema-player">
          <iframe key={src} src={src} allow="autoplay; fullscreen; picture-in-picture; encrypted-media" allowFullScreen title={title.name} />
        </div>
      )}
    </div>
  );
}

function Seasons({ title, current, onPick }: { title: TitleFull; current: { season: number | null; episode: number | null }; onPick: (s: number, e: number) => void }) {
  const [season, setSeason] = useState(current.season ?? title.progress?.season ?? title.seasons[0]?.number ?? 1);
  useEffect(() => {
    if (current.season) setSeason(current.season);
  }, [current.season]);
  const { data, isLoading } = useQuery({
    queryKey: ['cinema', 'season', title.id, season],
    queryFn: () => api<CinemaEpisode[]>(`/cinema/titles/${title.id}/seasons/${season}`),
    enabled: title.seasons.length > 0,
  });
  if (!title.seasons.length) return null;
  return (
    <section className="cinema-seasons">
      <h2 className="k-subtitle">{tr('Сезони й серії')}</h2>
      <div className="k-tabs">
        {title.seasons.map((s) => (
          <button key={s.number} className={season === s.number ? 'on' : ''} onClick={() => setSeason(s.number)}>
            {s.name || `${tr('Сезон')} ${s.number}`}
            <small>{s.episodes} {tr('сер.')}</small>
          </button>
        ))}
      </div>
      {isLoading && <Spinner />}
      <div className="cinema-episodes">
        {data?.map((e) => {
          const active = current.season === season && current.episode === e.number;
          return (
            <button key={e.number} className={`cinema-episode${active ? ' on' : ''}`} onClick={() => onPick(season, e.number)}>
              <div className="ce-still">
                {e.still ? <img src={e.still} alt="" loading="lazy" /> : <Tv size={22} />}
                <span className="ce-num">{e.number}</span>
              </div>
              <div className="ce-info">
                <div className="ce-name ellipsis">{e.name || `${tr('Серія')} ${e.number}`}</div>
                <div className="ce-meta muted">{[e.airDate, e.runtime ? `${e.runtime} хв` : null].filter(Boolean).join(' · ')}</div>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

/* ───────────── оцінка, поради, кіновечір ───────────── */

function RateModal({ title, onClose, onSaved }: { title: TitleFull; onClose: () => void; onSaved: (t: TitleFull) => void }) {
  const [rating, setRating] = useState(title.myReview?.rating ?? 0);
  const [hover, setHover] = useState(0);
  const [body, setBody] = useState(title.myReview?.body ?? '');
  const [share, setShare] = useState(!title.myReview);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const save = async () => {
    if (!rating) return setError(tr('Оберіть оцінку від 1 до 10'));
    setBusy(true);
    try {
      onSaved(await api<TitleFull>(`/cinema/titles/${title.id}/review`, { method: 'PUT', body: { rating, body, share } }));
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const remove = async () => {
    setBusy(true);
    try {
      onSaved(await api<TitleFull>(`/cinema/titles/${title.id}/review`, { method: 'DELETE' }));
      onClose();
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      title={tr('Ваша оцінка')}
      onClose={onClose}
      footer={
        <>
          {title.myReview && (
            <button className="btn tertiary" onClick={remove} disabled={busy}>
              <Trash2 size={16} /> {tr('Видалити')}
            </button>
          )}
          <div style={{ flex: 1 }} />
          <button className="btn" onClick={save} disabled={busy}>
            {tr('Зберегти')}
          </button>
        </>
      }
    >
      <div className="modal-body">
        <div className="rate-stars" onMouseLeave={() => setHover(0)}>
          {Array.from({ length: 10 }, (_, k) => k + 1).map((n) => (
            <button key={n} className={(hover || rating) >= n ? 'on' : ''} onMouseEnter={() => setHover(n)} onClick={() => setRating(n)} aria-label={String(n)}>
              <Star size={22} fill="currentColor" />
            </button>
          ))}
          <b>{hover || rating || '—'}</b>
        </div>
        <AutoTextarea className="field" placeholder={tr('Кілька слів про фільм (необов’язково)')} value={body} maxLength={5000} onChange={(e) => setBody(e.target.value)} />
        <label className="check-row">
          <input type="checkbox" checked={share} onChange={(e) => setShare(e.target.checked)} /> {tr('Поділитися в стрічці — друзі побачать запис із карткою фільму')}
        </label>
        {error && <div className="error-text">{error}</div>}
      </div>
    </Modal>
  );
}

function RecommendModal({ title, onClose }: { title: TitleFull; onClose: () => void }) {
  const me = useMe();
  const [picked, setPicked] = useState<number[]>([]);
  const [sent, setSent] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const { data: friends } = useQuery({ queryKey: ['friends', me.id], queryFn: () => api<UserShort[]>(`/users/${me.id}/friends`) });
  const { data: relatives } = useQuery({
    queryKey: ['cinema', 'relatives', me.families.map((f) => f.id).join(',')],
    queryFn: async () => (await Promise.all(me.families.filter((f) => f.status === 'verified').map((f) => api<UserShort[]>(`/families/${f.id}/members`)))).flat(),
    enabled: me.families.length > 0,
  });
  const people = useMemo(() => {
    const map = new Map<number, UserShort & { family?: boolean }>();
    for (const u of relatives ?? []) if (u.id !== me.id) map.set(u.id, { ...u, family: true });
    for (const u of friends ?? []) if (!map.has(u.id)) map.set(u.id, u);
    return [...map.values()];
  }, [friends, relatives, me.id]);
  const toggle = (id: number) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length < 20 ? [...p, id] : p));
  const send = async () => {
    setBusy(true);
    try {
      setSent((await api<{ sent: number }>(`/cinema/titles/${title.id}/recommend`, { body: { userIds: picked } })).sent);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      title={tr('Порадити «{name}»', { name: title.name })}
      onClose={onClose}
      footer={
        sent === null ? (
          <button className="btn" onClick={send} disabled={busy || !picked.length}>
            <Send size={16} /> {tr('Надіслати')} {picked.length ? `(${picked.length})` : ''}
          </button>
        ) : (
          <button className="btn" onClick={onClose}>
            {tr('Готово')}
          </button>
        )
      }
    >
      {sent !== null ? (
        <div className="modal-body">
          <Empty icon={<Send size={40} />} title={tr('Надіслано: {n}', { n: sent })}>
            {tr('Вони отримають сповіщення з посиланням на фільм.')}
          </Empty>
        </div>
      ) : !people.length ? (
        <div className="modal-body">
          <Empty icon={<Users size={40} />} title={tr('Поки що нікому')}>
            {tr('Порадити можна друзям і учасникам своєї родини.')}
          </Empty>
        </div>
      ) : (
        <div className="pick-list">
          {people.map((u) => (
            <label key={u.id} className="row row-link">
              <Avatar src={u.avatar} name={fullName(u)} id={u.id} size={36} />
              <div className="info">
                <div className="name">{fullName(u)}</div>
                <div className="meta">{u.family ? tr('Родина') : tr('Друг')}</div>
              </div>
              <input type="checkbox" checked={picked.includes(u.id)} onChange={() => toggle(u.id)} />
            </label>
          ))}
        </div>
      )}
    </Modal>
  );
}

function FamilyNightModal({ title, onClose }: { title: TitleFull; onClose: () => void }) {
  const me = useMe();
  const families = me.families.filter((f) => f.status === 'verified' && (f.role === 'leader' || f.role === 'deputy'));
  const [familyId, setFamilyId] = useState(families[0]?.id ?? 0);
  const tomorrow = new Date(Date.now() + 86400000);
  tomorrow.setHours(20, 0, 0, 0);
  const local = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  const [when, setWhen] = useState(local(tomorrow));
  const [note, setNote] = useState('');
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const submit = async () => {
    setBusy(true);
    setError('');
    try {
      await api(`/cinema/titles/${title.id}/family-event`, { body: { familyId, startsAt: new Date(when).toISOString(), note } });
      setDone(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      title={tr('Кіновечір з родиною')}
      onClose={onClose}
      footer={
        done ? (
          <a className="btn" href="/events">
            {tr('До календаря родини')}
          </a>
        ) : (
          <button className="btn" onClick={submit} disabled={busy || !familyId}>
            <CalendarPlus size={16} /> {tr('Запланувати')}
          </button>
        )
      }
    >
      <div className="modal-body">
        {done ? (
          <Empty icon={<CalendarPlus size={40} />} title={tr('Подію створено')}>
            {tr('Учасники родини отримають сповіщення й нагадування перед початком.')}
          </Empty>
        ) : (
          <>
            {families.length > 1 && (
              <select className="field" value={familyId} onChange={(e) => setFamilyId(Number(e.target.value))}>
                {families.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.tag ? `[${f.tag}] ` : ''}
                    {f.name}
                  </option>
                ))}
              </select>
            )}
            <label className="field-label">{tr('Коли')}</label>
            <input className="field" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
            <label className="field-label">{tr('Примітка')}</label>
            <AutoTextarea className="field" placeholder={tr('Де збираємось, що беремо…')} value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} />
            {error && <div className="error-text">{error}</div>}
          </>
        )}
      </div>
    </Modal>
  );
}

function ShareModal({ title, onClose }: { title: TitleFull; onClose: () => void }) {
  const me = useMe();
  const qc = useQueryClient();
  const targets = [{ type: 'user' as const, id: me.id, label: tr('Моя сторінка') }, ...me.families.filter((f) => f.status === 'verified').map((f) => ({ type: 'family' as const, id: f.id, label: tr('Стіна родини') + ` «${f.name}»` }))];
  const [target, setTarget] = useState(0);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const share = async () => {
    setBusy(true);
    try {
      const t = targets[target];
      const fd = new FormData();
      fd.append('text', text);
      fd.append('ownerType', t.type);
      fd.append('ownerId', String(t.id));
      fd.append('cinemaTitleId', String(title.id));
      await api('/posts', { body: fd });
      qc.invalidateQueries({ queryKey: ['posts'] });
      setDone(true);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      title={tr('Поділитися')}
      onClose={onClose}
      footer={
        done ? (
          <button className="btn" onClick={onClose}>
            {tr('Готово')}
          </button>
        ) : (
          <button className="btn" onClick={share} disabled={busy}>
            <Share2 size={16} /> {tr('Опублікувати')}
          </button>
        )
      }
    >
      <div className="modal-body">
        {done ? (
          <Empty icon={<Share2 size={40} />} title={tr('Опубліковано')} />
        ) : (
          <>
            {targets.length > 1 && (
              <div className="chips">
                {targets.map((t, k) => (
                  <button key={`${t.type}${t.id}`} className={`chip${target === k ? ' on' : ''}`} onClick={() => setTarget(k)}>
                    {t.type === 'family' && <Crown size={13} />} {t.label}
                  </button>
                ))}
              </div>
            )}
            <AutoTextarea className="field" placeholder={tr('Що скажете про «{name}»?', { name: title.name })} value={text} maxLength={10000} onChange={(e) => setText(e.target.value)} />
          </>
        )}
      </div>
    </Modal>
  );
}

function Reviews({ titleId, onWrite }: { titleId: number; onWrite: () => void }) {
  const { data } = useQuery({
    queryKey: ['cinema', 'reviews', titleId],
    queryFn: () => api<{ user: UserShort | null; rating: number; body: string; updatedAt: number }[]>(`/cinema/titles/${titleId}/reviews`),
  });
  const items = (data ?? []).filter((r) => r.user && r.body);
  return (
    <section className="k-comments">
      <div className="k-comments-head">
        <h2 className="k-subtitle">
          {tr('Рецензії глядачів')} <span>{items.length}</span>
        </h2>
        <button className="k-pill accent" onClick={onWrite}>
          <Star size={15} /> {tr('Написати рецензію')}
        </button>
      </div>
      {!items.length && <p className="k-muted">{tr('Поки що без рецензій. Поділіться враженнями першим — друзі побачать їх у стрічці.')}</p>}
      {items.map((r) => (
        <article key={r.user!.id} className="k-comment">
          <Link to={`/id/${r.user!.id}`} className="k-comment-ava">
            <Avatar src={r.user!.avatar} name={fullName(r.user!)} id={r.user!.id} size={44} />
          </Link>
          <div className="k-comment-body">
            <div className="k-comment-meta">
              <Link to={`/id/${r.user!.id}`} className="k-comment-name">
                {fullName(r.user!)}
              </Link>
              <span className="k-comment-date">{formatDate(r.updatedAt)}</span>
              <span className={`k-comment-rate${r.rating >= 7 ? ' good' : r.rating <= 4 ? ' bad' : ''}`}>{r.rating}/10</span>
            </div>
            <p>{r.body}</p>
          </div>
        </article>
      ))}
    </section>
  );
}

/* ───────────── сторінка фільму ───────────── */

export function CinemaTitlePage() {
  const { id } = useParams();
  const me = useMe();
  const qc = useQueryClient();
  const key = ['cinema', 'title', Number(id)];
  const { data: t, isLoading, error } = useQuery({ queryKey: key, queryFn: () => api<TitleFull>(`/cinema/titles/${id}`) });
  const [modal, setModal] = useState<'rate' | 'recommend' | 'night' | 'share' | null>(null);
  const [trailer, setTrailer] = useState<string | null>(null);
  const [ep, setEp] = useState<{ season: number | null; episode: number | null }>({ season: null, episode: null });
  const [watching, setWatching] = useState(false);
  const playerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setEp({ season: null, episode: null });
    setWatching(window.location.hash === '#watch');
    window.scrollTo(0, 0);
  }, [id]);
  useEffect(() => {
    if (watching && t) playerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [watching, t]);

  if (isLoading)
    return (
      <Shell>
        <Spinner />
      </Shell>
    );
  if (error || !t)
    return (
      <Shell>
        <div className="k-section">
          <Empty icon={<Clapperboard size={44} />} title={tr('Фільм не знайдено')}>
            {(error as Error)?.message}
          </Empty>
        </div>
      </Shell>
    );

  const update = (next: TitleFull) => qc.setQueryData(key, { ...next, similar: t.similar });
  const toggleWatchlist = async () => {
    const saved = await toggleSaved(qc, t.id, t.inWatchlist);
    qc.setQueryData(key, { ...t, inWatchlist: saved });
    qc.invalidateQueries({ queryKey: ['cinema', 'home'] });
  };
  const canNight = me.families.some((f) => f.status === 'verified' && (f.role === 'leader' || f.role === 'deputy'));
  const pickEpisode = (season: number, episode: number) => {
    setEp({ season, episode });
    setWatching(true);
  };
  const byRole = (role: string) => t.crew.filter((c) => c.role === role);
  const people = (list: { personId: number; name: string }[]) =>
    list.map((c, k) => (
      <span key={c.personId}>
        {k > 0 && ', '}
        <Link to={`/cinema/person/${c.personId}`}>{c.name}</Link>
      </span>
    ));
  const info: [string, ReactNode][] = [
    [tr('Режисер'), byRole('Режисер').length ? people(byRole('Режисер')) : null],
    [tr('Творці'), byRole('Творець').length ? people(byRole('Творець')) : null],
    [tr('Жанр'), t.genres.join(', ') || null],
    [tr('Країна'), t.countries.join(', ') || null],
    [tr('Сценарист'), byRole('Сценарист').length ? people(byRole('Сценарист')) : null],
    [tr('Актори'), t.cast.length ? people(t.cast.slice(0, 8)) : null],
    [t.type === 'series' ? tr('Прем’єра') : tr('Дата виходу'), t.releaseDate ? new Date(t.releaseDate).toLocaleDateString('uk-UA', { day: 'numeric', month: 'long', year: 'numeric' }) : null],
    [tr('Тривалість'), runtimeLabel(t.runtime)],
    [tr('Сезонів / серій'), t.seasonsCount ? `${t.seasonsCount} / ${t.episodesCount ?? '—'}` : null],
    [tr('Озвучка'), t.translations.length ? t.translations.map((x) => x.title).join(', ') : null],
  ];
  const spot: SpotSource = { ...t, overview: '', cast: [] };

  return (
    <Shell>
      <div className="k-hero k-hero-title">
        <div className="k-hero-bg on" style={t.backdropLarge ? { backgroundImage: `url(${t.backdropLarge})` } : undefined} />
        <div className="k-hero-grid">
          <SpotInfo
            t={spot}
            meta={
              <Kicker
                t={t}
                extra={
                  <>
                    {t.status && t.type === 'series' && <span>{t.status === 'Ended' ? tr('завершено') : tr('виходить')}</span>}
                    {!t.isPublished && <span className="k-badge bdub">{tr('Приховано')}</span>}
                  </>
                }
              />
            }
            actions={
              <>
                <WatchButton label={t.progress && t.progress.position > 30 ? tr('Продовжити') : tr('Дивитися')} onClick={() => setWatching(true)} />
                {t.trailer && <TrailerButton onClick={() => setTrailer(t.trailer)} />}
                <SaveButton saved={t.inWatchlist} onClick={toggleWatchlist} />
              </>
            }
          />
          <div className="k-title-poster">
            {t.poster ? <img src={t.poster.replace('/w342/', '/w500/')} alt="" /> : <Clapperboard size={48} />}
            <span className={`k-label ${t.type === 'series' ? 'red' : 'blue'}`}>
              {t.type === 'series' ? <Tv size={14} /> : <Film size={14} />} {kindLabel(t)}
            </span>
            {t.type === 'series' && t.seasonsCount ? (
              <span className="k-poster-series">
                {t.seasonsCount} {tr('сезон')}, {t.episodesCount ?? '—'} {tr('серій')}
              </span>
            ) : null}
          </div>
        </div>
      </div>

      <div className="k-body">
        <div className="k-main">
          <ul className="k-info-list">
            {info
              .filter(([, v]) => v)
              .map(([label, v]) => (
                <li key={label}>
                  <span>{label}:</span> {v}
                </li>
              ))}
          </ul>

          {t.overview && (
            <section>
              <h2 className="k-subtitle">
                {tr('Про що')} {t.type === 'series' ? tr('серіал') : tr('фільм')} «{t.name}»
              </h2>
              <p className="k-text">{t.overview}</p>
            </section>
          )}

          <section ref={playerRef} id="watch" className="k-player-block">
            <h2 className="k-subtitle center">
              {tr('Дивитися онлайн')} «{t.name}»
            </h2>
            {watching ? (
              <Player title={t} season={ep.season} episode={ep.episode} onEpisode={(s, e) => setEp({ season: s, episode: e })} />
            ) : (
              <button className="k-player-cover" onClick={() => setWatching(true)} style={t.backdropLarge ? { backgroundImage: `url(${t.backdropLarge})` } : undefined}>
                <span className="k-play-big">
                  <Play size={34} fill="currentColor" />
                </span>
                {t.progress && t.progress.position > 30 && (
                  <span className="k-resume">
                    {tr('Продовжити з')} {Math.floor(t.progress.position / 60)} {tr('хв')}
                    {t.progress.season ? ` · S${t.progress.season}E${t.progress.episode}` : ''}
                  </span>
                )}
              </button>
            )}
            <div className="k-player-bottom">
              <div className="k-share-caption">{tr('Розкажи друзям і родині про свої враження:')}</div>
              <div className="k-player-bottom-actions">
                <button className="k-pill" onClick={() => setModal('rate')}>
                  <Star size={15} /> {t.myReview ? `${tr('Ваша оцінка')}: ${t.myReview.rating}` : tr('Оцінити')}
                </button>
                <button className="k-pill" onClick={() => setModal('recommend')}>
                  <Send size={15} /> {tr('Порадити')}
                </button>
                <button className="k-pill" onClick={() => setModal('share')}>
                  <Share2 size={15} /> {tr('У стрічку')}
                </button>
                {canNight && (
                  <button className="k-pill" onClick={() => setModal('night')}>
                    <CalendarPlus size={15} /> {tr('Кіновечір')}
                  </button>
                )}
              </div>
              {t.localRating ? <div className="k-score-circle">{t.localRating.toFixed(1)}</div> : null}
            </div>
          </section>

          {t.type === 'series' && <Seasons title={t} current={ep} onPick={pickEpisode} />}

          {t.cast.length > 0 && (
            <section>
              <h2 className="k-subtitle">{tr('У ролях')}</h2>
              <div className="cinema-cast">
                {t.cast.map((c) => (
                  <Link key={c.personId} to={`/cinema/person/${c.personId}`} className="cast-item">
                    <div className="cast-photo">{c.photo ? <img src={c.photo} alt="" loading="lazy" /> : <Users size={22} />}</div>
                    <div className="cast-name ellipsis">{c.name}</div>
                    <div className="cast-role ellipsis">{c.role}</div>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {t.videos.length > 1 && (
            <section>
              <h2 className="k-subtitle">{tr('Відео')}</h2>
              <div className="cinema-videos">
                {t.videos.map((v) => (
                  <button key={v.key} className="cinema-video" onClick={() => setTrailer(v.key)}>
                    <img src={`https://i.ytimg.com/vi/${v.key}/mqdefault.jpg`} alt="" loading="lazy" />
                    <span className="ellipsis">{v.name}</span>
                  </button>
                ))}
              </div>
            </section>
          )}

          <Reviews titleId={t.id} onWrite={() => setModal('rate')} />
        </div>

        <aside className="k-side">
          <div className="k-side-block">
            <h3>{tr('Друзі й родина')}</h3>
            {!t.social.ratings.length && !t.social.wantToWatch.length && <p className="k-muted">{tr('Ніхто з вашого кола ще не оцінював. Будьте першим!')}</p>}
            {t.social.ratings.map((r) => (
              <Link key={r.user.id} to={`/id/${r.user.id}`} className="k-person-row">
                <Avatar src={r.user.avatar} name={fullName(r.user)} id={r.user.id} size={34} />
                <span className="k-person-name">
                  {fullName(r.user)}
                  <small>{r.family ? tr('родина') : tr('друг')}</small>
                </span>
                <span className="cinema-mini-rate">
                  <Star size={12} fill="currentColor" /> {r.rating}
                </span>
              </Link>
            ))}
            {t.social.wantToWatch.length > 0 && (
              <div className="cinema-want">
                <div className="k-muted">{tr('Хочуть подивитись')}:</div>
                <div className="avatars">
                  {t.social.wantToWatch.map((u) => (
                    <Link key={u.id} to={`/id/${u.id}`} title={fullName(u)}>
                      <Avatar src={u.avatar} name={fullName(u)} id={u.id} size={30} />
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
          {t.similar.length > 0 && (
            <div className="k-side-block">
              <h3>{tr('Схожі')}</h3>
              {t.similar.slice(0, 6).map((s) => (
                <Link key={s.id} to={`/cinema/title/${s.id}`} className="k-side-title">
                  <span className="k-side-poster">{s.poster ? <img src={s.poster} alt="" loading="lazy" /> : <Clapperboard size={18} />}</span>
                  <span className="k-side-info">
                    <b className="ellipsis">{s.name}</b>
                    <small>{[s.year, s.genres[0]].filter(Boolean).join(' · ')}</small>
                    {s.rating ? (
                      <span className="cinema-mini-rate">
                        <Star size={11} fill="currentColor" /> {s.rating.toFixed(1)}
                      </span>
                    ) : null}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </aside>
      </div>

      {modal === 'rate' && <RateModal title={t} onClose={() => setModal(null)} onSaved={update} />}
      {modal === 'recommend' && <RecommendModal title={t} onClose={() => setModal(null)} />}
      {modal === 'night' && <FamilyNightModal title={t} onClose={() => setModal(null)} />}
      {modal === 'share' && <ShareModal title={t} onClose={() => setModal(null)} />}
      {trailer && <TrailerModal id={trailer} onClose={() => setTrailer(null)} />}
    </Shell>
  );
}

/* ───────────── людина ───────────── */

export function CinemaPersonPage() {
  const { id } = useParams();
  const { data: p, isLoading } = useQuery({ queryKey: ['cinema', 'person', Number(id)], queryFn: () => api<CinemaPerson>(`/cinema/people/${id}`) });
  const [more, setMore] = useState(false);
  if (isLoading) return <Spinner />;
  if (!p) return null;
  const long = p.biography.length > 600 && !more;
  return (
    <Shell>
      <div className="k-panel person-card">
        <div className="person-photo">{p.photo ? <img src={p.photo} alt="" /> : <Users size={48} />}</div>
        <div className="person-info">
          <h1>{p.name}</h1>
          <div className="muted">
            {[p.knownFor === 'Acting' ? tr('Актор') : p.knownFor === 'Directing' ? tr('Режисер') : p.knownFor, p.birthday && new Date(p.birthday).getFullYear() + ' р.н.', p.placeOfBirth].filter(Boolean).join(' · ')}
          </div>
          {p.biography && (
            <p className="title-overview" style={{ marginTop: 12 }}>
              {long ? p.biography.slice(0, 560).trimEnd() + '… ' : p.biography}
              {long && (
                <button className="more-link" onClick={() => setMore(true)}>
                  {tr('Показати повністю')}
                </button>
              )}
            </p>
          )}
        </div>
      </div>
      <SectionHead title={tr('Фільмографія на GameCon')} />
      {p.titles.length ? <TitleGrid items={p.titles} /> : <div className="k-panel"><Empty title={tr('Поки що немає фільмів у каталозі')} /></div>}
    </Shell>
  );
}

/* ───────────── розділ «Кіно» в профілі ───────────── */

export function ProfileCinema({ userId }: { userId: number }) {
  const { data } = useQuery({
    queryKey: ['cinema', 'user', userId],
    queryFn: () => api<{ ratings: TitleCard[]; watchlist: TitleCard[]; ratedCount: number }>(`/cinema/users/${userId}`),
  });
  if (!data || (!data.ratings.length && !data.watchlist.length)) return null;
  return (
    <div className="card profile-cinema">
      {data.ratings.length > 0 && (
        <>
          <div className="card-title">
            <Link to="/cinema">{tr('Кіно')}</Link> <span className="count">{data.ratedCount}</span>
          </div>
          <div className="cinema-strip compact">
            {data.ratings.map((t) => (
              <TitlePoster key={t.id} t={t} />
            ))}
          </div>
        </>
      )}
      {data.watchlist.length > 0 && (
        <>
          <div className="card-title">{tr('Хоче подивитись')}</div>
          <div className="cinema-strip compact">
            {data.watchlist.map((t) => (
              <TitlePoster key={t.id} t={t} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
