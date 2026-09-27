import { tr } from '../lib/i18n';
import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Link, NavLink, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Bookmark,
  BookmarkCheck,
  CalendarPlus,
  ChevronLeft,
  ChevronRight,
  Clapperboard,
  Clock,
  Crown,
  Film,
  Play,
  Search,
  Send,
  Share2,
  Star,
  Trash2,
  Tv,
  Users,
} from 'lucide-react';
import { api } from '../lib/api';
import { useMe } from '../lib/auth';
import type { CinemaEpisode, CinemaHome, CinemaPerson, TitleCard, TitleFull, UserShort } from '../lib/types';
import { fullName } from '../lib/utils';
import { AutoTextarea, Avatar, Empty, Modal, Spinner, useSentinel } from '../components/ui';

/* ───────────── спільне ───────────── */

const kindLabel = (t: { type: 'movie' | 'series' }) => (t.type === 'series' ? tr('Серіал') : tr('Фільм'));
const runtimeLabel = (min: number | null) => (min ? (min >= 60 ? `${Math.floor(min / 60)} год${min % 60 ? ` ${min % 60} хв` : ''}` : `${min} хв`) : null);

function CinemaNav() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [q, setQ] = useState(params.get('q') ?? '');
  const submit = (e: FormEvent) => {
    e.preventDefault();
    navigate(q.trim() ? `/cinema/browse?q=${encodeURIComponent(q.trim())}` : '/cinema/browse');
  };
  return (
    <div className="cinema-nav card">
      <div className="cinema-brand">
        <Clapperboard size={20} /> {tr('Кіно')}
      </div>
      <nav className="cinema-links">
        <NavLink to="/cinema" end>
          {tr('Головна')}
        </NavLink>
        <NavLink to="/cinema/browse?type=movie" className={() => (params.get('type') === 'movie' ? 'active' : '')}>
          {tr('Фільми')}
        </NavLink>
        <NavLink to="/cinema/browse?type=series" className={() => (params.get('type') === 'series' ? 'active' : '')}>
          {tr('Серіали')}
        </NavLink>
        <NavLink to="/cinema/watchlist">{tr('Хочу подивитись')}</NavLink>
      </nav>
      <form className="cinema-search" onSubmit={submit}>
        <Search size={16} />
        <input className="field" placeholder={tr('Назва фільму чи серіалу')} value={q} onChange={(e) => setQ(e.target.value)} />
      </form>
    </div>
  );
}

export function TitlePoster({ t, wide }: { t: TitleCard; wide?: boolean }) {
  const rating = t.myRating ?? t.localRating ?? t.rating;
  return (
    <Link to={`/cinema/title/${t.id}`} className={`title-poster${wide ? ' wide' : ''}`} title={t.name}>
      <div className="tp-img">
        {(wide ? t.backdrop : t.poster) ? (
          <img src={(wide ? t.backdrop : t.poster)!} alt="" loading="lazy" decoding="async" />
        ) : (
          <div className="tp-blank">
            <Clapperboard size={28} />
          </div>
        )}
        {rating ? (
          <span className={`tp-rate${t.myRating ? ' mine' : ''}`}>
            <Star size={11} fill="currentColor" /> {Number(rating).toFixed(t.myRating ? 0 : 1)}
          </span>
        ) : null}
        {t.hasPlayer && (
          <span className="tp-play">
            <Play size={18} fill="currentColor" />
          </span>
        )}
      </div>
      <div className="tp-name ellipsis">{t.name}</div>
      <div className="tp-sub ellipsis">
        {[t.year, t.role ?? t.genres[0], t.type === 'series' ? tr('серіал') : null].filter(Boolean).join(' · ')}
      </div>
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

function Row({ title, items, more, wide, icon }: { title: string; items: TitleCard[]; more?: string; wide?: boolean; icon?: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  if (!items.length) return null;
  const scroll = (d: number) => ref.current?.scrollBy({ left: d * ref.current.clientWidth * 0.8, behavior: 'smooth' });
  return (
    <section className="cinema-row">
      <div className="cinema-row-head">
        <h2>
          {icon} {title}
        </h2>
        {more && (
          <Link to={more} className="more-link">
            {tr('Усі')}
          </Link>
        )}
        <div className="cinema-row-arrows">
          <button className="icon-btn" onClick={() => scroll(-1)} aria-label={tr('Назад')}>
            <ChevronLeft size={18} />
          </button>
          <button className="icon-btn" onClick={() => scroll(1)} aria-label={tr('Далі')}>
            <ChevronRight size={18} />
          </button>
        </div>
      </div>
      <div className="cinema-strip" ref={ref}>
        {items.map((t) => (
          <TitlePoster key={t.id} t={t} wide={wide} />
        ))}
      </div>
    </section>
  );
}

function Hero({ items }: { items: TitleCard[] }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (items.length < 2) return;
    const t = setInterval(() => setI((x) => (x + 1) % items.length), 7000);
    return () => clearInterval(t);
  }, [items.length]);
  const t = items[i];
  if (!t) return null;
  return (
    <div className="cinema-hero">
      {items.map((x, k) => (
        <div key={x.id} className={`cinema-hero-bg${k === i ? ' on' : ''}`} style={x.backdrop ? { backgroundImage: `url(${x.backdrop.replace('/w780/', '/w1280/')})` } : undefined} />
      ))}
      <div className="cinema-hero-body">
        <div className="cinema-kicker">
          {kindLabel(t)}
          {t.year ? ` · ${t.year}` : ''}
          {t.genres.length ? ` · ${t.genres.join(', ')}` : ''}
        </div>
        <h1>{t.name}</h1>
        {t.originalName && t.originalName !== t.name && <div className="cinema-original">{t.originalName}</div>}
        <div className="cinema-hero-actions">
          <Link to={`/cinema/title/${t.id}${t.hasPlayer ? '#watch' : ''}`} className="btn lg">
            <Play size={18} fill="currentColor" /> {t.hasPlayer ? tr('Дивитися') : tr('Детальніше')}
          </Link>
          {t.rating ? (
            <span className="cinema-score">
              <Star size={16} fill="currentColor" /> {t.rating.toFixed(1)} <small>TMDB</small>
            </span>
          ) : null}
        </div>
      </div>
      {items.length > 1 && (
        <div className="cinema-hero-dots">
          {items.map((x, k) => (
            <button key={x.id} className={k === i ? 'on' : ''} onClick={() => setI(k)} aria-label={x.name} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ───────────── головна ───────────── */

export default function CinemaHomePage() {
  const { data, isLoading } = useQuery({ queryKey: ['cinema', 'home'], queryFn: () => api<CinemaHome>('/cinema/home') });
  const me = useMe();
  return (
    <div className="cinema">
      <CinemaNav />
      {isLoading && <Spinner />}
      {data && !data.movies.length && !data.series.length && (
        <div className="card">
          <Empty icon={<Clapperboard size={48} />} title={tr('Каталог ще порожній')}>
            {me.level.type !== 'user' ? tr('Додайте фільми в адмінці: Кінопортал → Імпорт із TMDB.') : tr('Скоро тут з’являться фільми й серіали.')}
          </Empty>
        </div>
      )}
      {data && (
        <>
          <Hero items={data.featured} />
          <Row title={tr('Продовжити перегляд')} items={data.continue} wide icon={<Clock size={18} />} />
          <Row title={tr('Дивляться друзі й родина')} items={data.circle} icon={<Users size={18} />} />
          <Row title={tr('Хочу подивитись')} items={data.watchlist} more="/cinema/watchlist" icon={<Bookmark size={18} />} />
          <Row title={tr('Популярні фільми')} items={data.movies} more="/cinema/browse?type=movie" icon={<Film size={18} />} />
          <Row title={tr('Популярні серіали')} items={data.series} more="/cinema/browse?type=series" icon={<Tv size={18} />} />
          <Row title={tr('Найвищий рейтинг')} items={data.top} more="/cinema/browse?sort=rating" icon={<Star size={18} />} />
          <Row title={tr('Нове в каталозі')} items={data.fresh} more="/cinema/browse?sort=new" />
          {data.genres.length > 0 && (
            <section className="cinema-row">
              <div className="cinema-row-head">
                <h2>{tr('Жанри')}</h2>
              </div>
              <div className="cinema-genres">
                {data.genres.map((g) => (
                  <Link key={g.id} to={`/cinema/browse?genre=${g.id}`} className="chip">
                    {g.name}
                  </Link>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}

/* ───────────── каталог ───────────── */

export function CinemaBrowsePage() {
  const [params, setParams] = useSearchParams();
  const type = params.get('type') ?? '';
  const genre = params.get('genre') ?? '';
  const sort = params.get('sort') ?? 'popular';
  const q = params.get('q') ?? '';
  const { data: home } = useQuery({ queryKey: ['cinema', 'home'], queryFn: () => api<CinemaHome>('/cinema/home') });
  const query = new URLSearchParams(Object.entries({ type, genre, sort, q }).filter(([, v]) => v)).toString();
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
  return (
    <div className="cinema">
      <CinemaNav />
      <div className="card cinema-filters">
        <div className="chips">
          {[
            ['', tr('Усе')],
            ['movie', tr('Фільми')],
            ['series', tr('Серіали')],
          ].map(([v, l]) => (
            <button key={v} className={`chip${type === v ? ' on' : ''}`} onClick={() => set('type', v)}>
              {l}
            </button>
          ))}
        </div>
        <select className="field" value={genre} onChange={(e) => set('genre', e.target.value)}>
          <option value="">{tr('Усі жанри')}</option>
          {home?.genres.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>
        <select className="field" value={sort} onChange={(e) => set('sort', e.target.value)}>
          <option value="popular">{tr('Популярні')}</option>
          <option value="rating">{tr('За рейтингом')}</option>
          <option value="year">{tr('Новіші за роком')}</option>
          <option value="new">{tr('Нещодавно додані')}</option>
        </select>
        {q && (
          <button className="chip on" onClick={() => set('q', '')}>
            «{q}» ✕
          </button>
        )}
        {data && <span className="muted cinema-total">{tr('Знайдено')}: {data.pages[0].total}</span>}
      </div>
      {isLoading && <Spinner />}
      {data && !items.length && (
        <div className="card">
          <Empty icon={<Search size={44} />} title={tr('Нічого не знайдено')}>
            {tr('Спробуйте інший запит або фільтр')}
          </Empty>
        </div>
      )}
      <TitleGrid items={items} />
      <div ref={sentinel} />
      {isFetchingNextPage && <Spinner />}
    </div>
  );
}

export function CinemaWatchlistPage() {
  const { data, isLoading } = useQuery({ queryKey: ['cinema', 'watchlist'], queryFn: () => api<TitleCard[]>('/cinema/watchlist') });
  return (
    <div className="cinema">
      <CinemaNav />
      <div className="cinema-row-head">
        <h2>
          <Bookmark size={18} /> {tr('Хочу подивитись')}
        </h2>
      </div>
      {isLoading && <Spinner />}
      {data && !data.length && (
        <div className="card">
          <Empty icon={<Bookmark size={44} />} title={tr('Список порожній')}>
            {tr('Натисніть «Хочу подивитись» на сторінці фільму — він з’явиться тут, а друзі побачать, що ви його чекаєте.')}
          </Empty>
        </div>
      )}
      {data && <TitleGrid items={data} />}
    </div>
  );
}

/* ───────────── плеєр Kodik ───────────── */

type KodikMessage = { key?: string; value?: unknown };

function Player({ title, season, episode, onEpisode }: { title: TitleFull; season: number | null; episode: number | null; onEpisode: (s: number, e: number) => void }) {
  const [translation, setTranslation] = useState(0);
  const { data, error, isLoading } = useQuery({
    queryKey: ['cinema', 'player', title.id, translation],
    queryFn: () => api<{ link: string; progress: TitleFull['progress'] }>(`/cinema/titles/${title.id}/player?translation=${translation}`),
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

  if (isLoading) return <div className="cinema-player loading"><Spinner /></div>;
  if (error || !src)
    return (
      <div className="cinema-player empty">
        <Clapperboard size={36} />
        <div>{(error as Error)?.message || tr('Плеєр для цього фільму ще не знайдено')}</div>
        {title.trailer && <div className="muted">{tr('Поки що можна переглянути трейлер.')}</div>}
      </div>
    );
  return (
    <>
      {title.translations.length > 1 && (
        <div className="cinema-translations">
          <span className="muted">{tr('Озвучка')}:</span>
          {title.translations.map((t) => (
            <button key={t.index} className={`chip${translation === t.index ? ' on' : ''}`} onClick={() => setTranslation(t.index)}>
              {t.title}
              {t.quality ? <small> · {t.quality}</small> : null}
            </button>
          ))}
        </div>
      )}
      <div className="cinema-player">
        <iframe key={src} src={src} allow="autoplay; fullscreen; picture-in-picture; encrypted-media" allowFullScreen title={title.name} />
      </div>
    </>
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
    <div className="card cinema-seasons">
      <div className="card-title">{tr('Сезони й серії')}</div>
      <div className="chips" style={{ padding: '0 16px' }}>
        {title.seasons.map((s) => (
          <button key={s.number} className={`chip${season === s.number ? ' on' : ''}`} onClick={() => setSeason(s.number)}>
            {s.name || `${tr('Сезон')} ${s.number}`}
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
    </div>
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

function Reviews({ titleId }: { titleId: number }) {
  const { data } = useQuery({
    queryKey: ['cinema', 'reviews', titleId],
    queryFn: () => api<{ user: UserShort | null; rating: number; body: string; updatedAt: number }[]>(`/cinema/titles/${titleId}/reviews`),
  });
  const items = (data ?? []).filter((r) => r.user && r.body);
  if (!items.length) return null;
  return (
    <div className="card">
      <div className="card-title">
        {tr('Рецензії')} <span className="count">{items.length}</span>
      </div>
      {items.map((r) => (
        <div key={r.user!.id} className="cinema-review">
          <Link to={`/id/${r.user!.id}`}>
            <Avatar src={r.user!.avatar} name={fullName(r.user!)} id={r.user!.id} size={36} />
          </Link>
          <div>
            <div>
              <Link to={`/id/${r.user!.id}`} className="name">
                {fullName(r.user!)}
              </Link>{' '}
              <span className="cinema-mini-rate">
                <Star size={12} fill="currentColor" /> {r.rating}/10
              </span>
            </div>
            <p>{r.body}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ───────────── сторінка фільму ───────────── */

export function CinemaTitlePage() {
  const { id } = useParams();
  const me = useMe();
  const qc = useQueryClient();
  const key = ['cinema', 'title', Number(id)];
  const { data: t, isLoading, error } = useQuery({ queryKey: key, queryFn: () => api<TitleFull>(`/cinema/titles/${id}`) });
  const [modal, setModal] = useState<'rate' | 'recommend' | 'night' | 'share' | 'trailer' | null>(null);
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

  if (isLoading) return <Spinner />;
  if (error || !t)
    return (
      <div className="cinema">
        <CinemaNav />
        <div className="card">
          <Empty icon={<Clapperboard size={44} />} title={tr('Фільм не знайдено')}>
            {(error as Error)?.message}
          </Empty>
        </div>
      </div>
    );

  const update = (next: TitleFull) => qc.setQueryData(key, { ...next, similar: t.similar });
  const toggleWatchlist = async () => {
    const r = await api<{ inWatchlist: boolean }>(`/cinema/titles/${t.id}/watchlist`, { method: t.inWatchlist ? 'DELETE' : 'POST' });
    qc.setQueryData(key, { ...t, inWatchlist: r.inWatchlist });
    qc.invalidateQueries({ queryKey: ['cinema', 'home'] });
    qc.invalidateQueries({ queryKey: ['cinema', 'watchlist'] });
  };
  const canNight = me.families.some((f) => f.status === 'verified' && (f.role === 'leader' || f.role === 'deputy'));
  const pickEpisode = (season: number, episode: number) => {
    setEp({ season, episode });
    setWatching(true);
  };
  const director = t.crew.find((c) => c.role === 'Режисер' || c.role === 'Творець');

  return (
    <div className="cinema">
      <CinemaNav />
      <div className="title-hero" style={t.backdropLarge ? { backgroundImage: `url(${t.backdropLarge})` } : undefined}>
        <div className="title-hero-inner">
          <div className="title-poster-lg">{t.poster ? <img src={t.poster} alt="" /> : <Clapperboard size={48} />}</div>
          <div className="title-main">
            <div className="cinema-kicker">
              {kindLabel(t)}
              {t.year ? ` · ${t.year}` : ''}
              {runtimeLabel(t.runtime) ? ` · ${runtimeLabel(t.runtime)}` : ''}
              {t.seasonsCount ? ` · ${t.seasonsCount} ${tr('сез.')}` : ''}
              {!t.isPublished && <span className="chip" style={{ marginLeft: 8 }}>{tr('Приховано')}</span>}
            </div>
            <h1>{t.name}</h1>
            {t.originalName && t.originalName !== t.name && <div className="cinema-original">{t.originalName}</div>}
            {t.tagline && <div className="title-tagline">«{t.tagline}»</div>}
            <div className="title-scores">
              {t.rating ? (
                <span className="cinema-score">
                  <Star size={16} fill="currentColor" /> {t.rating.toFixed(1)} <small>TMDB · {t.voteCount}</small>
                </span>
              ) : null}
              {t.localRating ? (
                <span className="cinema-score local">
                  <Star size={16} fill="currentColor" /> {t.localRating.toFixed(1)} <small>{tr('GameCon')} · {t.localRatingCount}</small>
                </span>
              ) : null}
              {t.myReview && (
                <span className="cinema-score mine">
                  {tr('Ваша')}: {t.myReview.rating}/10
                </span>
              )}
            </div>
            <div className="title-genres">
              {t.genres.map((g) => (
                <span key={g} className="chip">
                  {g}
                </span>
              ))}
            </div>
            <div className="title-actions">
              <button className="btn lg" onClick={() => setWatching(true)}>
                <Play size={18} fill="currentColor" /> {t.progress && t.progress.position > 30 ? tr('Продовжити') : tr('Дивитися')}
              </button>
              {t.trailer && (
                <button className="btn secondary lg" onClick={() => (setTrailer(t.trailer), setModal('trailer'))}>
                  <Film size={18} /> {tr('Трейлер')}
                </button>
              )}
              <button className={`btn secondary lg${t.inWatchlist ? ' on' : ''}`} onClick={toggleWatchlist}>
                {t.inWatchlist ? <BookmarkCheck size={18} /> : <Bookmark size={18} />} {t.inWatchlist ? tr('У списку') : tr('Хочу подивитись')}
              </button>
              <button className="btn secondary lg" onClick={() => setModal('rate')}>
                <Star size={18} /> {t.myReview ? tr('Змінити оцінку') : tr('Оцінити')}
              </button>
            </div>
            <div className="title-actions small">
              <button className="chip" onClick={() => setModal('recommend')}>
                <Send size={14} /> {tr('Порадити другу')}
              </button>
              <button className="chip" onClick={() => setModal('share')}>
                <Share2 size={14} /> {tr('Поділитися')}
              </button>
              {canNight && (
                <button className="chip" onClick={() => setModal('night')}>
                  <CalendarPlus size={14} /> {tr('Кіновечір з родиною')}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="columns">
        <div className="col-main">
          {watching && (
            <div className="card cinema-watch" ref={playerRef} id="watch">
              <Player title={t} season={ep.season} episode={ep.episode} onEpisode={(s, e) => setEp({ season: s, episode: e })} />
            </div>
          )}
          {t.type === 'series' && <Seasons title={t} current={ep} onPick={pickEpisode} />}
          {t.overview && (
            <div className="card" style={{ padding: 20 }}>
              <div className="card-title" style={{ padding: '0 0 10px' }}>
                {tr('Про що')}
              </div>
              <p className="title-overview">{t.overview}</p>
              <dl className="title-facts">
                {director && (
                  <>
                    <dt>{director.role}</dt>
                    <dd>
                      <Link to={`/cinema/person/${director.personId}`}>{director.name}</Link>
                    </dd>
                  </>
                )}
                {t.countries.length > 0 && (
                  <>
                    <dt>{tr('Країна')}</dt>
                    <dd>{t.countries.join(', ')}</dd>
                  </>
                )}
                {t.releaseDate && (
                  <>
                    <dt>{t.type === 'series' ? tr('Прем’єра') : tr('Вихід')}</dt>
                    <dd>{new Date(t.releaseDate).toLocaleDateString('uk-UA', { day: 'numeric', month: 'long', year: 'numeric' })}</dd>
                  </>
                )}
                {t.episodesCount ? (
                  <>
                    <dt>{tr('Серій')}</dt>
                    <dd>{t.episodesCount}</dd>
                  </>
                ) : null}
              </dl>
            </div>
          )}
          {t.cast.length > 0 && (
            <div className="card">
              <div className="card-title">{tr('У ролях')}</div>
              <div className="cinema-cast">
                {t.cast.map((c) => (
                  <Link key={c.personId} to={`/cinema/person/${c.personId}`} className="cast-item">
                    <div className="cast-photo">{c.photo ? <img src={c.photo} alt="" loading="lazy" /> : <Users size={22} />}</div>
                    <div className="cast-name ellipsis">{c.name}</div>
                    <div className="cast-role ellipsis">{c.role}</div>
                  </Link>
                ))}
              </div>
            </div>
          )}
          {t.videos.length > 1 && (
            <div className="card">
              <div className="card-title">{tr('Відео')}</div>
              <div className="cinema-videos">
                {t.videos.map((v) => (
                  <button key={v.key} className="cinema-video" onClick={() => (setTrailer(v.key), setModal('trailer'))}>
                    <img src={`https://i.ytimg.com/vi/${v.key}/mqdefault.jpg`} alt="" loading="lazy" />
                    <span className="ellipsis">{v.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          <Reviews titleId={t.id} />
          <Row title={tr('Схожі')} items={t.similar} />
        </div>
        <aside className="col-side">
          <div className="card">
            <div className="card-title">{tr('Друзі й родина')}</div>
            {!t.social.ratings.length && !t.social.wantToWatch.length && <div className="muted" style={{ padding: '0 16px 16px' }}>{tr('Ніхто з вашого кола ще не оцінював. Будьте першим!')}</div>}
            {t.social.ratings.map((r) => (
              <Link key={r.user.id} to={`/id/${r.user.id}`} className="row row-link">
                <Avatar src={r.user.avatar} name={fullName(r.user)} id={r.user.id} size={34} />
                <div className="info">
                  <div className="name ellipsis">{fullName(r.user)}</div>
                  <div className="meta">{r.family ? tr('родина') : tr('друг')}</div>
                </div>
                <span className="cinema-mini-rate">
                  <Star size={12} fill="currentColor" /> {r.rating}
                </span>
              </Link>
            ))}
            {t.social.wantToWatch.length > 0 && (
              <div className="cinema-want">
                <div className="muted">{tr('Хочуть подивитись')}:</div>
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
        </aside>
      </div>

      {modal === 'rate' && <RateModal title={t} onClose={() => setModal(null)} onSaved={update} />}
      {modal === 'recommend' && <RecommendModal title={t} onClose={() => setModal(null)} />}
      {modal === 'night' && <FamilyNightModal title={t} onClose={() => setModal(null)} />}
      {modal === 'share' && <ShareModal title={t} onClose={() => setModal(null)} />}
      {modal === 'trailer' && trailer && (
        <Modal title={tr('Трейлер')} onClose={() => setModal(null)} wide>
          <div className="cinema-trailer">
            <iframe src={`https://www.youtube-nocookie.com/embed/${trailer}?autoplay=1&rel=0`} allow="autoplay; fullscreen; encrypted-media" allowFullScreen title={tr('Трейлер')} />
          </div>
        </Modal>
      )}
    </div>
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
    <div className="cinema">
      <CinemaNav />
      <div className="card person-card">
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
      <div className="cinema-row-head">
        <h2>{tr('Фільмографія на GameCon')}</h2>
      </div>
      {p.titles.length ? <TitleGrid items={p.titles} /> : <div className="card"><Empty title={tr('Поки що немає фільмів у каталозі')} /></div>}
    </div>
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
