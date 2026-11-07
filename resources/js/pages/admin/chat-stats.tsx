import { Head, Link } from '@inertiajs/react';
import {
    SlidersHorizontal,
    MessageCircle,
    MessagesSquare,
    ShieldAlert,
    UserRound,
    UsersRound,
} from 'lucide-react';
import { useState } from 'react';
import { PageHeader, StatCard } from '@/components/gc/admin';
import { compactNumber, formatDate } from '@/lib/format';
import { tr } from '@/lib/i18n';
import { cn } from '@/lib/utils';

type Day = { date: string; direct: number; group: number; other: number };

type Props = {
    totals: {
        today: number;
        week: number;
        active_chats: number;
        senders: number;
        groups: number;
        new_groups: number;
        guests: number;
        bots: number;
        blocked: number;
    };
    series: Day[];
    top: {
        id: number;
        title: string;
        channel: boolean;
        messages: number;
        members: number;
    }[];
    blocked: { kind: string; label: string; total: number }[];
};

const SERIES = [
    { key: 'direct', label: 'Особисті', color: '#5ec8ff' },
    { key: 'group', label: 'Групи й канали', color: '#a78bfa' },
    { key: 'other', label: 'Гості й боти', color: 'rgba(255,255,255,0.45)' },
] as const;

/** Стовпчики по днях: особисті, групи, гості й боти. */
function DailyBars({ data }: { data: Day[] }) {
    const [hover, setHover] = useState<number | null>(null);
    const max = Math.max(4, ...data.map((d) => d.direct + d.group + d.other));
    const point = hover !== null ? data[hover] : null;

    return (
        <div>
            <div className="mb-4 flex flex-wrap items-center gap-x-5 gap-y-2">
                {SERIES.map((s) => (
                    <span
                        key={s.key}
                        className="flex items-center gap-2 text-sm text-white/55"
                    >
                        <span
                            className="size-2.5 rounded-full"
                            style={{ background: s.color }}
                        />
                        {tr(s.label)}
                        <span className="font-display text-base font-bold text-white">
                            {compactNumber(
                                data.reduce((sum, d) => sum + d[s.key], 0),
                            )}
                        </span>
                    </span>
                ))}
                {point && (
                    <span className="ml-auto text-sm text-white/55">
                        {formatDate(point.date, false)}:{' '}
                        <span className="text-white">
                            {point.direct + point.group + point.other}
                        </span>
                    </span>
                )}
            </div>
            <div
                className="flex h-48 items-end gap-[3px]"
                onMouseLeave={() => setHover(null)}
            >
                {data.map((d, i) => {
                    const total = d.direct + d.group + d.other;

                    return (
                        <div
                            key={d.date}
                            onMouseEnter={() => setHover(i)}
                            className={cn(
                                'flex h-full flex-1 flex-col justify-end rounded-t-md transition-opacity',
                                hover !== null && hover !== i && 'opacity-50',
                            )}
                            title={`${formatDate(d.date, false)} · ${total}`}
                        >
                            {SERIES.map((s) =>
                                d[s.key] > 0 ? (
                                    <div
                                        key={s.key}
                                        className="first:rounded-t-md"
                                        style={{
                                            height: `${(d[s.key] / max) * 100}%`,
                                            background: s.color,
                                        }}
                                    />
                                ) : null,
                            )}
                        </div>
                    );
                })}
            </div>
            <div className="mt-2 flex justify-between text-xs text-white/35">
                <span>{data[0] && formatDate(data[0].date, false)}</span>
                <span>
                    {data.at(-1) && formatDate(data.at(-1)!.date, false)}
                </span>
            </div>
        </div>
    );
}

/** Адмінка → Статистика чатів: обсяг повідомлень, активні бесіди, найживіші групи, антиспам. */
export default function AdminChatStats({
    totals,
    series,
    top,
    blocked,
}: Props) {
    const maxTop = Math.max(1, ...top.map((t) => t.messages));
    const maxBlocked = Math.max(1, ...blocked.map((b) => b.total));

    return (
        <>
            <Head title={tr('Статистика чатів — адмінка')} />
            <PageHeader
                title={tr('Статистика чатів')}
                description={tr(
                    'Скільки пишуть, де найжвавіше і що зупинив антиспам. Дані за 7 днів, графік — за 30.',
                )}
            />

            <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
                <StatCard
                    label={tr('Повідомлень сьогодні')}
                    value={totals.today}
                    icon={MessageCircle}
                />
                <StatCard
                    label={tr('За тиждень')}
                    value={totals.week}
                    icon={MessagesSquare}
                    delay={50}
                />
                <StatCard
                    label={tr('Активних бесід')}
                    value={totals.active_chats}
                    icon={UsersRound}
                    delay={100}
                />
                <StatCard
                    label={tr('Писали людей')}
                    value={totals.senders}
                    icon={UserRound}
                    delay={150}
                />
            </div>

            <section className="glass mb-6 rounded-2xl p-4 sm:p-5">
                <h2 className="mb-4 font-display text-lg font-semibold text-white">
                    {tr('Повідомлення по днях')}
                </h2>
                <DailyBars data={series} />
            </section>

            <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
                <section className="glass rounded-2xl p-4 sm:p-5">
                    <h2 className="mb-1 font-display text-lg font-semibold text-white">
                        {tr('Найжвавіші групи')}
                    </h2>
                    <p className="mb-4 text-sm text-white/50">
                        {tr(
                            'Усього груп: {groups}, нових за тиждень: {fresh}.',
                            { groups: totals.groups, fresh: totals.new_groups },
                        )}
                    </p>
                    {top.length === 0 ? (
                        <p className="text-sm text-white/45">
                            {tr('За тиждень у групах тихо.')}
                        </p>
                    ) : (
                        <ul className="space-y-3">
                            {top.map((row) => (
                                <li key={row.id}>
                                    <div className="flex items-baseline gap-2 text-sm">
                                        <span className="truncate font-medium text-white">
                                            {row.channel ? '# ' : ''}
                                            {row.title}
                                        </span>
                                        <span className="shrink-0 text-xs text-white/40">
                                            {tr('{count} учасн.', {
                                                count: row.members,
                                            })}
                                        </span>
                                        <span className="ml-auto shrink-0 font-display font-semibold text-white">
                                            {compactNumber(row.messages)}
                                        </span>
                                    </div>
                                    <div className="mt-1.5 h-1.5 rounded-full bg-white/[0.06]">
                                        <div
                                            className="h-full rounded-full bg-[#a78bfa]"
                                            style={{
                                                width: `${(row.messages / maxTop) * 100}%`,
                                            }}
                                        />
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </section>

                <section className="glass rounded-2xl p-4 sm:p-5">
                    <h2 className="mb-1 flex items-center gap-2 font-display text-lg font-semibold text-white">
                        <ShieldAlert className="size-5 text-rose-300" />
                        {tr('Антиспам за тиждень')}
                    </h2>
                    <p className="mb-4 text-sm text-white/50">
                        {tr(
                            'Зупинено спроб: {blocked}. Гостьових повідомлень: {guests}, від ботів: {bots}.',
                            {
                                blocked: totals.blocked,
                                guests: totals.guests,
                                bots: totals.bots,
                            },
                        )}
                    </p>
                    <ul className="space-y-2.5">
                        {blocked.map((row) => (
                            <li
                                key={row.kind}
                                className="grid grid-cols-[9rem_1fr_2.5rem] items-center gap-3 text-sm"
                            >
                                <span className="truncate text-white/70">
                                    {tr(row.label)}
                                </span>
                                <span className="h-1.5 rounded-full bg-white/[0.06]">
                                    <span
                                        className="block h-full rounded-full bg-rose-400/70"
                                        style={{
                                            width: `${(row.total / maxBlocked) * 100}%`,
                                        }}
                                    />
                                </span>
                                <span className="text-right font-display font-semibold text-white">
                                    {row.total}
                                </span>
                            </li>
                        ))}
                    </ul>
                    <Link
                        href="/admin/antispam"
                        className="mt-4 inline-flex items-center gap-2 text-sm text-gc-sky hover:underline"
                    >
                        <SlidersHorizontal className="size-4" />
                        {tr('Налаштувати антиспам')}
                    </Link>
                </section>
            </div>
        </>
    );
}
