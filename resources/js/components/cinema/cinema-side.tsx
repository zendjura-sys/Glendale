import { Deferred, Link } from '@inertiajs/react';
import { m, useReducedMotion } from 'motion/react';
import {
    Clapperboard,
    Compass,
    Flame,
    MessagesSquare,
    MessageCircle,
    PanelRightOpen,
    Shuffle,
} from 'lucide-react';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { MoviePoster } from '@/components/cinema/movie-tile';
import { PosterBadges } from '@/components/cinema/poster-badges';
import { UserAvatar } from '@/components/gc/user-avatar';
import { tr } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import type { MovieCard, UserCard } from '@/types';

export type CinemaSideData = {
    genres: { name: string; count: number }[];
    years: number[];
    countries: string[];
    types: { key: string; label: string }[];
    popular: { week: MovieCard[]; month: MovieCard[] };
    trailers: (MovieCard & { trailer_url: string })[];
    comments: {
        id: number;
        body: string;
        user: UserCard | null;
        movie: { title: string; href: string };
    }[];
    discussed: { title: string; href: string; count: number }[];
    random: MovieCard | null;
};

/** Заголовок віджета: значок в акцентному квадраті, назва і коротка риска під нею. */
function SideTitle({
    icon,
    children,
}: {
    icon: ReactNode;
    children: ReactNode;
}) {
    return (
        <h2 className="mb-4 flex items-center gap-2.5 font-display text-[17px] font-semibold text-white">
            <span className="flex size-8 items-center justify-center rounded-xl bg-primary/15 text-primary [&_svg]:size-4">
                {icon}
            </span>
            <span className="relative">
                {children}
                <span className="absolute -bottom-1.5 left-0 h-[3px] w-6 rounded-full bg-primary" />
            </span>
        </h2>
    );
}

function Box({
    children,
    className,
}: {
    children: ReactNode;
    className?: string;
}) {
    return (
        <section className={cn('glass rounded-2xl p-4', className)}>
            {children}
        </section>
    );
}

const link = 'truncate text-[13px] text-white/70 transition hover:text-primary';

function Group({
    title,
    cols,
    children,
}: {
    title: string;
    cols: string;
    children: ReactNode;
}) {
    return (
        <div className="mt-4 first:mt-0">
            <h3 className="mb-1.5 text-xs font-semibold tracking-wide text-white/45">
                {title}
            </h3>
            <div className={cn('grid gap-x-3 gap-y-1', cols)}>{children}</div>
        </div>
    );
}

/** Швидкі фільтри каталогу: жанри, роки, країни, типи, статус виходу. */
function Navigation({ side }: { side: CinemaSideData }) {
    const q = (key: string, value: string | number) =>
        `/cinema?${key}=${encodeURIComponent(String(value))}`;

    return (
        <Box>
            <SideTitle icon={<Compass />}>{tr('Навігація')}</SideTitle>
            {side.genres.length > 0 && (
                <Group title={tr('Жанри')} cols="grid-cols-2">
                    {side.genres.map((g) => (
                        <Link
                            key={g.name}
                            href={q('genre', g.name)}
                            className={link}
                        >
                            {g.name}
                        </Link>
                    ))}
                </Group>
            )}
            {side.years.length > 0 && (
                <Group title={tr('За роком')} cols="grid-cols-4">
                    {side.years.map((y) => (
                        <Link
                            key={y}
                            href={q('year', y)}
                            className={cn(link, 'tabular-nums')}
                        >
                            {y}
                        </Link>
                    ))}
                </Group>
            )}
            {side.countries.length > 0 && (
                <Group title={tr('Країни')} cols="grid-cols-2">
                    {side.countries.map((c) => (
                        <Link key={c} href={q('country', c)} className={link}>
                            {c}
                        </Link>
                    ))}
                </Group>
            )}
            <Group title={tr('Тип')} cols="grid-cols-2">
                {side.types.map((t) => (
                    <Link key={t.key} href={q('type', t.key)} className={link}>
                        {t.label}
                    </Link>
                ))}
            </Group>
            <Group title={tr('Інше')} cols="grid-cols-3">
                <Link href={q('release', 'announced')} className={link}>
                    {tr('Анонс')}
                </Link>
                <Link href={q('release', 'ongoing')} className={link}>
                    {tr('Виходить')}
                </Link>
                <Link href={q('release', 'released')} className={link}>
                    {tr('Завершено')}
                </Link>
            </Group>
        </Box>
    );
}

function RandomPick({ movie }: { movie: MovieCard }) {
    return (
        <Box>
            <SideTitle icon={<Shuffle />}>{tr('Випадкове')}</SideTitle>
            <Link
                href={movie.href}
                className="group relative block overflow-hidden rounded-xl"
            >
                {movie.backdrop ? (
                    <img
                        src={movie.backdrop}
                        alt=""
                        loading="lazy"
                        className="aspect-video w-full object-cover transition duration-500 group-hover:scale-105"
                    />
                ) : (
                    <MoviePoster
                        movie={movie}
                        className="aspect-video w-full"
                    />
                )}
                <span
                    data-on-dark
                    className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent p-3 pt-8 text-sm font-semibold text-white"
                >
                    {movie.title}
                </span>
            </Link>
            <Link
                href="/cinema/random"
                className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-primary"
            >
                <Shuffle className="size-3.5" />
                {tr('Ще випадкове')}
            </Link>
        </Box>
    );
}

function Popular({ popular }: { popular: CinemaSideData['popular'] }) {
    const [range, setRange] = useState<'week' | 'month'>('week');
    const reduce = useReducedMotion();
    const list = popular[range];
    if (popular.week.length === 0 && popular.month.length === 0) return null;

    return (
        <Box>
            <SideTitle icon={<Flame />}>{tr('Найпопулярніше')}</SideTitle>
            <div className="mb-3 grid grid-cols-2 rounded-xl bg-white/[0.06] p-1 text-xs font-semibold">
                {(['week', 'month'] as const).map((key) => (
                    <button
                        key={key}
                        type="button"
                        onClick={() => setRange(key)}
                        className={cn(
                            'relative rounded-lg py-1.5 transition',
                            range === key
                                ? 'text-white'
                                : 'text-white/50 hover:text-white',
                        )}
                    >
                        {range === key && (
                            <m.span
                                layoutId="gc-side-popular"
                                transition={
                                    reduce ? { duration: 0 } : undefined
                                }
                                className="absolute inset-0 -z-0 rounded-lg bg-white/10"
                            />
                        )}
                        <span className="relative">
                            {key === 'week'
                                ? tr('За тиждень')
                                : tr('За місяць')}
                        </span>
                    </button>
                ))}
            </div>
            <ol className="space-y-2.5">
                {list.map((movie, i) => (
                    <li key={movie.id}>
                        <Link
                            href={movie.href}
                            className="group flex items-center gap-3"
                        >
                            <span className="line-clamp-2 min-w-0 flex-1 text-[13px] leading-snug text-white/75 group-hover:text-primary">
                                {movie.title}
                            </span>
                            <span className="relative shrink-0">
                                <MoviePoster
                                    movie={movie}
                                    className="h-14 w-11 rounded-lg"
                                />
                                <span className="absolute -right-1.5 -bottom-1.5 flex size-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground tabular-nums">
                                    {i + 1}
                                </span>
                            </span>
                        </Link>
                    </li>
                ))}
            </ol>
        </Box>
    );
}

function Trailers({ items }: { items: CinemaSideData['trailers'] }) {
    if (items.length === 0) return null;

    return (
        <Box>
            <SideTitle icon={<Clapperboard />}>{tr('Трейлери')}</SideTitle>
            <div className="space-y-4">
                {items.map((movie) => (
                    <Link
                        key={movie.id}
                        href={`${movie.href}#trailer`}
                        className="group block"
                    >
                        <span className="relative block overflow-hidden rounded-xl">
                            {movie.backdrop ? (
                                <img
                                    src={movie.backdrop}
                                    alt=""
                                    loading="lazy"
                                    className="aspect-video w-full object-cover transition duration-500 group-hover:scale-105"
                                />
                            ) : (
                                <MoviePoster
                                    movie={movie}
                                    className="aspect-video w-full"
                                />
                            )}
                        </span>
                        <span className="mt-1.5 flex items-center gap-1 text-[11px] font-semibold text-primary">
                            <Clapperboard className="size-3" />
                            {tr('Трейлер')}
                        </span>
                        <span className="line-clamp-2 text-sm text-white/80 group-hover:text-white">
                            {movie.title}
                        </span>
                    </Link>
                ))}
            </div>
        </Box>
    );
}

function Comments({ items }: { items: CinemaSideData['comments'] }) {
    if (items.length === 0) return null;

    return (
        <Box>
            <SideTitle icon={<MessageCircle />}>{tr('Коментарі')}</SideTitle>
            <div className="space-y-3">
                {items.map((c, i) => (
                    <Link
                        key={c.id}
                        href={c.movie.href}
                        className={cn(
                            'flex items-start gap-2.5',
                            i % 2 === 1 && 'flex-row-reverse',
                        )}
                    >
                        {c.user && (
                            <UserAvatar
                                user={c.user}
                                size="sm"
                                showOnline={false}
                            />
                        )}
                        <span className="min-w-0 flex-1 rounded-2xl bg-white/[0.06] px-3 py-2">
                            <span className="block truncate text-[11px] font-semibold text-white/45">
                                {c.movie.title}
                            </span>
                            <span className="line-clamp-3 text-xs text-white/75">
                                {c.body}
                            </span>
                        </span>
                    </Link>
                ))}
            </div>
        </Box>
    );
}

function Discussed({ items }: { items: CinemaSideData['discussed'] }) {
    if (items.length === 0) return null;

    return (
        <Box>
            <SideTitle icon={<MessagesSquare />}>
                {tr('Найобговорюване')}
            </SideTitle>
            <ol className="space-y-2">
                {items.map((item) => (
                    <li key={item.href}>
                        <Link
                            href={item.href}
                            className="group flex items-center gap-3"
                        >
                            <span className="min-w-0 flex-1 truncate text-[13px] text-white/75 group-hover:text-primary">
                                {item.title}
                            </span>
                            <span className="rounded-lg bg-white/[0.07] px-2 py-0.5 text-xs text-white/55 tabular-nums">
                                {item.count}
                            </span>
                        </Link>
                    </li>
                ))}
            </ol>
        </Box>
    );
}

function SideSkeleton() {
    return (
        <div className="space-y-3">
            {[260, 200, 280].map((h) => (
                <div
                    key={h}
                    className="glass animate-pulse rounded-2xl"
                    style={{ height: h }}
                />
            ))}
        </div>
    );
}

export function CinemaSide({ side }: { side: CinemaSideData }) {
    return (
        <div className="space-y-3">
            <Navigation side={side} />
            {side.random && <RandomPick movie={side.random} />}
            <Popular popular={side.popular} />
            <Trailers items={side.trailers} />
            <Comments items={side.comments} />
            <Discussed items={side.discussed} />
        </div>
    );
}

/** Мініатюра тайтлу з бейджами — для рядів у віджетах і на сторінках. */
export function SidePoster({ movie }: { movie: MovieCard }) {
    return (
        <span className="relative block overflow-hidden rounded-xl">
            <MoviePoster movie={movie} className="aspect-[2/3] w-full" />
            <PosterBadges movie={movie} size="sm" />
        </span>
    );
}

/**
 * Оболонка сторінок кіно на ПК: основний вміст і бічна колонка праворуч (навігація й віджети).
 * На вужчих екранах колонка ховається за кнопкою «Бічне меню» над вмістом.
 */
export function CinemaShell({
    side,
    children,
}: {
    side?: CinemaSideData;
    children: ReactNode;
}) {
    const [open, setOpen] = useState(false);
    const panel = (
        <Deferred data="side" fallback={<SideSkeleton />}>
            {side ? <CinemaSide side={side} /> : <SideSkeleton />}
        </Deferred>
    );

    return (
        <div className="gc-cinema-shell flex items-start gap-5">
            <div className="@container min-w-0 flex-1 space-y-4">
                <button
                    type="button"
                    onClick={() => setOpen((v) => !v)}
                    aria-expanded={open}
                    className="glass flex w-full items-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold text-white xl:hidden"
                >
                    <PanelRightOpen className="size-4 text-primary" />
                    {open
                        ? tr('Сховати бічне меню')
                        : tr('Бічне меню: жанри, роки, популярне')}
                </button>
                {open && <div className="xl:hidden">{panel}</div>}
                {children}
            </div>
            <aside className="hidden w-[300px] shrink-0 xl:block">
                {panel}
            </aside>
        </div>
    );
}
