import { Deferred, Head, Link } from '@inertiajs/react';
import {
    Activity,
    Ban,
    Blocks,
    FileText,
    Heart,
    MessageSquare,
    Server,
    UserPlus,
    UsersRound,
    Wifi,
} from 'lucide-react';
import { useState } from 'react';
import { PageHeader, Pill, StatCard } from '@/components/gc/admin';
import { UserAvatar } from '@/components/gc/user-avatar';
import { compactNumber, formatDate, timeAgo } from '@/lib/format';
import type { UserCard } from '@/types';

type Stats = {
    users: number;
    users_today: number;
    online: number;
    active_week: number;
    posts: number;
    posts_today: number;
    comments: number;
    likes: number;
    friendships: number;
    banned: number;
    modules_enabled: number;
    modules_total: number;
};

type ChartPoint = { date: string; users: number; posts: number };

type Props = {
    stats: Stats;
    chart?: ChartPoint[];
    latestUsers: (UserCard & { created_at: string })[];
    latestPosts: {
        id: number;
        body: string | null;
        author: UserCard;
        likes_count: number;
        comments_count: number;
        created_at: string;
    }[];
    system: Record<string, string>;
};

const SERIES = {
    posts: { label: 'Записи', color: '#a855f7' },
    users: { label: 'Реєстрації', color: '#4f8bff' },
} as const;

function path(points: [number, number][]) {
    if (points.length < 2) {
        return '';
    }

    let d = `M${points[0][0]},${points[0][1]}`;

    for (let i = 1; i < points.length; i++) {
        const [x0, y0] = points[i - 1];
        const [x1, y1] = points[i];
        const cx = (x0 + x1) / 2;
        d += ` C${cx},${y0} ${cx},${y1} ${x1},${y1}`;
    }

    return d;
}

function ActivityChart({ data }: { data: ChartPoint[] }) {
    const [hover, setHover] = useState<number | null>(null);
    const W = 760;
    const H = 240;
    const pad = { t: 16, r: 8, b: 26, l: 8 };
    const max = Math.max(4, ...data.flatMap((d) => [d.users, d.posts]));
    const x = (i: number) =>
        pad.l + (i / (data.length - 1)) * (W - pad.l - pad.r);
    const y = (v: number) => pad.t + (1 - v / max) * (H - pad.t - pad.b);

    const lines = (Object.keys(SERIES) as (keyof typeof SERIES)[]).map(
        (key) => {
            const line = path(
                data.map((d, i) => [x(i), y(d[key])] as [number, number]),
            );

            return {
                key,
                line,
                area: `${line} L${x(data.length - 1)},${H - pad.b} L${x(0)},${H - pad.b} Z`,
            };
        },
    );

    const totals = {
        users: data.reduce((s, d) => s + d.users, 0),
        posts: data.reduce((s, d) => s + d.posts, 0),
    };
    const point = hover !== null ? data[hover] : null;

    return (
        <div>
            <div className="mb-4 flex flex-wrap gap-5">
                {(Object.keys(SERIES) as (keyof typeof SERIES)[]).map((key) => (
                    <div key={key} className="flex items-center gap-2.5">
                        <span
                            className="size-2.5 rounded-full"
                            style={{
                                background: SERIES[key].color,
                                boxShadow: `0 0 12px ${SERIES[key].color}`,
                            }}
                        />
                        <span className="text-sm text-white/55">
                            {SERIES[key].label}
                        </span>
                        <span className="font-display text-lg font-bold text-white">
                            {totals[key]}
                        </span>
                    </div>
                ))}
                {point && (
                    <div className="ml-auto text-sm text-white/55">
                        {formatDate(point.date, false)}:{' '}
                        <span className="text-[#9cbcff]">{point.users}</span> /{' '}
                        <span className="text-[#d3b0ff]">{point.posts}</span>
                    </div>
                )}
            </div>
            <svg
                viewBox={`0 0 ${W} ${H}`}
                className="h-[240px] w-full overflow-visible"
                preserveAspectRatio="none"
                onMouseLeave={() => setHover(null)}
            >
                <defs>
                    {lines.map(({ key }) => (
                        <linearGradient
                            key={key}
                            id={`area-${key}`}
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                        >
                            <stop
                                offset="0%"
                                stopColor={SERIES[key].color}
                                stopOpacity="0.35"
                            />
                            <stop
                                offset="100%"
                                stopColor={SERIES[key].color}
                                stopOpacity="0"
                            />
                        </linearGradient>
                    ))}
                </defs>
                {[0.25, 0.5, 0.75, 1].map((f) => (
                    <line
                        key={f}
                        x1={pad.l}
                        x2={W - pad.r}
                        y1={y(max * f)}
                        y2={y(max * f)}
                        stroke="rgb(255 255 255 / 0.05)"
                        strokeDasharray="3 5"
                    />
                ))}
                {lines.map(({ key, line, area }) => (
                    <g key={key}>
                        <path d={area} fill={`url(#area-${key})`} />
                        <path
                            d={line}
                            fill="none"
                            stroke={SERIES[key].color}
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            style={{
                                filter: `drop-shadow(0 0 6px ${SERIES[key].color})`,
                            }}
                        />
                    </g>
                ))}
                {hover !== null && (
                    <g>
                        <line
                            x1={x(hover)}
                            x2={x(hover)}
                            y1={pad.t}
                            y2={H - pad.b}
                            stroke="rgb(255 255 255 / 0.2)"
                        />
                        {(Object.keys(SERIES) as (keyof typeof SERIES)[]).map(
                            (key) => (
                                <circle
                                    key={key}
                                    cx={x(hover)}
                                    cy={y(data[hover][key])}
                                    r="4.5"
                                    fill="#05070f"
                                    stroke={SERIES[key].color}
                                    strokeWidth="2.5"
                                />
                            ),
                        )}
                    </g>
                )}
                {data.map((d, i) => (
                    <rect
                        key={d.date}
                        x={x(i) - W / data.length / 2}
                        y={0}
                        width={W / data.length}
                        height={H}
                        fill="transparent"
                        onMouseEnter={() => setHover(i)}
                    />
                ))}
                {data.map((d, i) =>
                    i % 5 === 0 || i === data.length - 1 ? (
                        <text
                            key={d.date}
                            x={x(i)}
                            y={H - 6}
                            textAnchor={
                                i === 0
                                    ? 'start'
                                    : i === data.length - 1
                                      ? 'end'
                                      : 'middle'
                            }
                            className="fill-white/30 text-[11px]"
                        >
                            {formatDate(d.date, false)}
                        </text>
                    ) : null,
                )}
            </svg>
        </div>
    );
}

export default function AdminDashboard({
    stats,
    chart,
    latestUsers,
    latestPosts,
    system,
}: Props) {
    return (
        <>
            <Head title="Адмін-панель" />
            <PageHeader
                title="Огляд"
                description="Пульс спільноти GameCon у реальному часі"
            />

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <StatCard
                    label="Користувачі"
                    value={compactNumber(stats.users)}
                    hint={
                        <>
                            <span className="text-emerald-300">
                                +{stats.users_today}
                            </span>{' '}
                            сьогодні
                        </>
                    }
                    icon={UsersRound}
                />
                <StatCard
                    label="Онлайн зараз"
                    value={stats.online}
                    hint={`${stats.active_week} активних за тиждень`}
                    icon={Wifi}
                    tone="from-[#22d3a6] to-[#38e1ff]"
                    delay={60}
                />
                <StatCard
                    label="Записи"
                    value={compactNumber(stats.posts)}
                    hint={
                        <>
                            <span className="text-emerald-300">
                                +{stats.posts_today}
                            </span>{' '}
                            сьогодні
                        </>
                    }
                    icon={FileText}
                    tone="from-[#6d5dfc] to-[#a855f7]"
                    delay={120}
                />
                <StatCard
                    label="Реакції"
                    value={compactNumber(stats.likes)}
                    hint={`${compactNumber(stats.comments)} коментарів`}
                    icon={Heart}
                    tone="from-[#f04fd8] to-[#ff8a5c]"
                    delay={180}
                />
            </div>

            <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_340px]">
                <section className="glass rounded-3xl p-5 sm:p-6">
                    <div className="mb-4 flex items-center gap-2">
                        <Activity className="size-4 text-[#8fa0ff]" />
                        <h2 className="font-display text-sm font-semibold tracking-wide text-white/90 uppercase">
                            Активність за 30 днів
                        </h2>
                    </div>
                    <Deferred
                        data="chart"
                        fallback={
                            <div className="skeleton h-[280px] rounded-2xl" />
                        }
                    >
                        <ActivityChart data={chart ?? []} />
                    </Deferred>
                </section>

                <div className="grid gap-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="glass rounded-3xl p-4">
                            <UserPlus className="size-4 text-[#9cbcff]" />
                            <div className="mt-3 font-display text-2xl font-bold text-white">
                                {compactNumber(stats.friendships)}
                            </div>
                            <div className="text-xs text-white/45">дружб</div>
                        </div>
                        <div className="glass rounded-3xl p-4">
                            <Ban className="size-4 text-rose-300" />
                            <div className="mt-3 font-display text-2xl font-bold text-white">
                                {stats.banned}
                            </div>
                            <div className="text-xs text-white/45">
                                заблоковано
                            </div>
                        </div>
                    </div>
                    <Link
                        href="/admin/modules"
                        className="glass group rounded-3xl p-5 transition hover:border-white/15"
                    >
                        <div className="flex items-center justify-between">
                            <Blocks className="size-5 text-[#d3b0ff]" />
                            <span className="text-xs text-white/40 group-hover:text-white/70">
                                Керувати →
                            </span>
                        </div>
                        <div className="mt-3 font-display text-2xl font-bold text-white">
                            {stats.modules_enabled}
                            <span className="text-base text-white/35">
                                {' '}
                                / {stats.modules_total}
                            </span>
                        </div>
                        <div className="text-xs text-white/45">
                            модулів увімкнено
                        </div>
                        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                            <div
                                className="bg-gradient-brand h-full rounded-full"
                                style={{
                                    width: `${(stats.modules_enabled / Math.max(1, stats.modules_total)) * 100}%`,
                                }}
                            />
                        </div>
                    </Link>
                    <section className="glass rounded-3xl p-5">
                        <div className="mb-3 flex items-center gap-2">
                            <Server className="size-4 text-[#8fa0ff]" />
                            <h2 className="font-display text-xs font-semibold tracking-wide text-white/80 uppercase">
                                Система
                            </h2>
                        </div>
                        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                            {Object.entries({
                                PHP: system.php,
                                Laravel: system.laravel,
                                База: system.database,
                                Кеш: system.cache,
                                Черги: system.queue,
                                Режим: system.environment,
                            }).map(([k, v]) => (
                                <div
                                    key={k}
                                    className="flex justify-between gap-2"
                                >
                                    <dt className="text-white/40">{k}</dt>
                                    <dd className="truncate font-medium text-white/80">
                                        {v}
                                    </dd>
                                </div>
                            ))}
                        </dl>
                    </section>
                </div>
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-2">
                <section className="glass rounded-3xl p-5">
                    <div className="mb-3 flex items-center justify-between">
                        <h2 className="font-display text-sm font-semibold tracking-wide text-white/90 uppercase">
                            Нові користувачі
                        </h2>
                        <Link
                            href="/admin/users"
                            className="text-xs text-white/45 hover:text-white"
                        >
                            Усі
                        </Link>
                    </div>
                    <ul className="divide-y divide-white/[0.05]">
                        {latestUsers.map((u) => (
                            <li
                                key={u.id}
                                className="flex items-center gap-3 py-2.5"
                            >
                                <UserAvatar user={u} size="sm" />
                                <Link
                                    href={`/${u.username}`}
                                    className="min-w-0 flex-1"
                                >
                                    <span className="block truncate text-sm font-medium text-white">
                                        {u.name}
                                    </span>
                                    <span className="block text-xs text-white/40">
                                        @{u.username}
                                    </span>
                                </Link>
                                {u.is_online ? (
                                    <Pill tone="green">онлайн</Pill>
                                ) : null}
                                <span className="text-xs text-white/35">
                                    {timeAgo(u.created_at)}
                                </span>
                            </li>
                        ))}
                    </ul>
                </section>
                <section className="glass rounded-3xl p-5">
                    <div className="mb-3 flex items-center justify-between">
                        <h2 className="font-display text-sm font-semibold tracking-wide text-white/90 uppercase">
                            Останні записи
                        </h2>
                        <Link
                            href="/admin/posts"
                            className="text-xs text-white/45 hover:text-white"
                        >
                            Усі
                        </Link>
                    </div>
                    <ul className="divide-y divide-white/[0.05]">
                        {latestPosts.map((p) => (
                            <li key={p.id} className="flex gap-3 py-2.5">
                                <UserAvatar
                                    user={p.author}
                                    size="sm"
                                    showOnline={false}
                                />
                                <Link
                                    href={`/posts/${p.id}`}
                                    className="min-w-0 flex-1"
                                >
                                    <span className="block text-xs text-white/45">
                                        <span className="font-medium text-white/85">
                                            {p.author.name}
                                        </span>{' '}
                                        · {timeAgo(p.created_at)}
                                    </span>
                                    <span className="line-clamp-2 text-sm text-white/70">
                                        {p.body || 'Фото'}
                                    </span>
                                </Link>
                                <span className="flex shrink-0 flex-col items-end gap-1 text-[11px] text-white/40">
                                    <span className="flex items-center gap-1">
                                        <Heart className="size-3" />{' '}
                                        {p.likes_count}
                                    </span>
                                    <span className="flex items-center gap-1">
                                        <MessageSquare className="size-3" />{' '}
                                        {p.comments_count}
                                    </span>
                                </span>
                            </li>
                        ))}
                    </ul>
                </section>
            </div>
        </>
    );
}
