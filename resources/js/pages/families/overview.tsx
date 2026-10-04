import { Link, router } from '@inertiajs/react';
import {
    AlertTriangle,
    BarChart3,
    CalendarDays,
    Clock3,
    FilePlus2,
    Package,
    ScrollText,
    TrendingUp,
    Wallet,
} from 'lucide-react';
import { FamilyShell } from '@/components/families/family-shell';
import { VoiceRooms } from '@/components/gc/voice-rooms';
import {
    Amount,
    Empty,
    Metric,
    Panel,
    kyivDateTime,
} from '@/components/families/ui';
import { timeAgo } from '@/lib/format';
import { uah } from '@/lib/money';
import { cn } from '@/lib/utils';
import type {
    AuditEntry,
    FamilyShellProps,
    LeaderboardRow,
    LedgerEntry,
} from '@/types';
import { tr } from '@/lib/i18n';

type Props = FamilyShellProps & {
    stats: {
        week_earned: number;
        week_total: number;
        pending_reports: number;
        warns: number;
        warn_limit: number;
    };
    leaders: LeaderboardRow[];
    events: {
        id: number;
        title: string;
        type: string;
        type_label: string;
        starts_at: string;
    }[];
    transactions: LedgerEntry[];
    low_stock: {
        id: number;
        name: string;
        quantity: number;
        min_stock: number | null;
        unit: string | null;
    }[];
    activity: AuditEntry[];
};

const medals = ['🥇', '🥈', '🥉'];

export default function FamilyOverview(props: Props) {
    const { family, stats, events, transactions, low_stock, activity } = props;
    const leaders = props.leaders.filter((row) => row.points > 0);
    const base = `/f/${family.slug}`;

    return (
        <FamilyShell {...props} title={tr('Огляд')}>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <Metric
                    label={tr('Заробив за тиждень')}
                    value={uah(stats.week_earned)}
                    tone="text-emerald-300"
                    icon={TrendingUp}
                />
                <Metric
                    label={tr('Виплати сім’ї (тиждень)')}
                    value={uah(stats.week_total)}
                    icon={Wallet}
                />
                <Metric
                    label={tr('Мої звіти на перевірці')}
                    value={stats.pending_reports}
                    tone="text-amber-200"
                    icon={Clock3}
                />
                <Metric
                    label={tr('Попередження')}
                    value={`${stats.warns}/${stats.warn_limit}`}
                    tone={stats.warns > 0 ? 'text-rose-300' : 'text-white'}
                    icon={AlertTriangle}
                />
            </div>

            {/* Голосові кімнати — одразу під показниками, щоб на телефоні не губились унизу. */}
            <VoiceRooms
                owner={{ type: 'family', id: family.id }}
                label={`[${family.tag}] ${family.name}`}
                href={`/f/${family.slug}`}
            />

            <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
                <div className="space-y-4">
                    <Link
                        href={`${base}/reports?new=1`}
                        className="glass group flex items-center gap-4 overflow-hidden rounded-3xl p-5 transition hover:bg-white/[0.06]"
                    >
                        <span className="flex size-12 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-300 to-rose-500 shadow-[0_10px_30px_-10px_rgb(250_204_21/0.8)]">
                            <FilePlus2 className="size-6 text-white" />
                        </span>
                        <div className="min-w-0 flex-1">
                            <div className="font-display text-lg font-semibold text-white">
                                {tr('Подати звіт')}
                            </div>
                            <div className="text-sm text-white/50">
                                {tr(
                                    'Бізвар, контракти, інвестиція — за себе чи за друга',
                                )}
                            </div>
                        </div>
                    </Link>

                    <Panel
                        title={tr('Лідери тижня')}
                        icon={BarChart3}
                        actions={
                            <Link
                                href={`${base}/rating`}
                                className="text-xs text-white/50 hover:text-white"
                            >
                                {tr('Увесь рейтинг')}
                            </Link>
                        }
                    >
                        {leaders.length === 0 ? (
                            <Empty
                                icon={BarChart3}
                                text={tr(
                                    'Схвалених звітів цього тижня ще немає',
                                )}
                            />
                        ) : (
                            <ol className="space-y-1.5">
                                {leaders.map((row) => (
                                    <li
                                        key={row.id}
                                        className="flex items-center gap-3 rounded-xl bg-white/[0.03] px-3 py-2"
                                    >
                                        <span className="w-6 text-center text-sm">
                                            {medals[row.place - 1] ?? row.place}
                                        </span>
                                        <span className="min-w-0 flex-1 truncate font-mono text-sm text-white">
                                            {row.display}
                                        </span>
                                        <span className="text-xs text-white/40">
                                            {uah(row.earned)}
                                        </span>
                                        <span className="w-14 text-right font-display font-bold text-amber-200">
                                            {row.points}
                                        </span>
                                    </li>
                                ))}
                            </ol>
                        )}
                    </Panel>

                    <Panel
                        title={tr('Мої операції')}
                        icon={Wallet}
                        actions={
                            <Link
                                href={`${base}/bank`}
                                className="text-xs text-white/50 hover:text-white"
                            >
                                {tr('Банк')}
                            </Link>
                        }
                    >
                        {transactions.length === 0 ? (
                            <Empty
                                icon={Wallet}
                                text={tr('Операцій ще не було')}
                            />
                        ) : (
                            <ul className="divide-y divide-white/[0.05]">
                                {transactions.map((t) => (
                                    <li
                                        key={t.id}
                                        className="flex items-center gap-3 py-2"
                                    >
                                        <div className="min-w-0 flex-1">
                                            <div className="text-sm text-white">
                                                {t.type_label}
                                            </div>
                                            <div className="truncate text-xs text-white/40">
                                                {t.comment ??
                                                    timeAgo(t.created_at)}
                                            </div>
                                        </div>
                                        <Amount value={t.amount} />
                                    </li>
                                ))}
                            </ul>
                        )}
                    </Panel>
                </div>

                <div className="space-y-4">
                    <Panel
                        title={tr('Найближчі події')}
                        icon={CalendarDays}
                        actions={
                            <Link
                                href={`${base}/events`}
                                className="text-xs text-white/50 hover:text-white"
                            >
                                {tr('Усі')}
                            </Link>
                        }
                    >
                        {events.length === 0 ? (
                            <Empty
                                icon={CalendarDays}
                                text={tr('Запланованих подій немає')}
                            />
                        ) : (
                            <ul className="space-y-2">
                                {events.map((e) => (
                                    <li
                                        key={e.id}
                                        className="flex items-center gap-3 rounded-xl bg-white/[0.03] px-3 py-2.5"
                                    >
                                        <CalendarDays className="size-4 text-[#a5b4fc]" />
                                        <div className="min-w-0 flex-1">
                                            <div className="truncate text-sm font-medium text-white">
                                                {e.title}
                                            </div>
                                            <div className="text-xs text-white/40">
                                                {e.type_label} ·{' '}
                                                {kyivDateTime(e.starts_at)}
                                            </div>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </Panel>

                    {low_stock.length > 0 && (
                        <Panel
                            title={tr('Закінчується на складі')}
                            icon={Package}
                        >
                            <ul className="space-y-1.5">
                                {low_stock.map((i) => (
                                    <li
                                        key={i.id}
                                        className="flex items-center justify-between rounded-xl bg-rose-500/[0.07] px-3 py-2 text-sm"
                                    >
                                        <span className="text-white">
                                            {i.name}
                                        </span>
                                        <span className="font-mono text-rose-200">
                                            {i.quantity}
                                            {i.unit ? ` ${i.unit}` : ''}{' '}
                                            {tr('/ мін.')} {i.min_stock}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        </Panel>
                    )}

                    {activity.length > 0 && (
                        <Panel
                            title={tr('Остання активність')}
                            icon={ScrollText}
                            actions={
                                <Link
                                    href={`${base}/audit`}
                                    className="text-xs text-white/50 hover:text-white"
                                >
                                    {tr('Журнал')}
                                </Link>
                            }
                        >
                            <ul className="space-y-2.5">
                                {activity.map((a) => (
                                    <li key={a.id} className="flex gap-2.5">
                                        <span
                                            className={cn(
                                                'mt-1.5 size-1.5 shrink-0 rounded-full',
                                                a.action.includes('REJECT') ||
                                                    a.action.includes('KICK') ||
                                                    a.action.includes('PUNISH')
                                                    ? 'bg-rose-400'
                                                    : 'bg-emerald-400',
                                            )}
                                        />
                                        <div className="min-w-0 text-xs">
                                            <div className="text-white/80">
                                                <span className="font-semibold text-white">
                                                    {a.action_label}
                                                </span>
                                                {a.target && (
                                                    <span className="font-mono">
                                                        {' '}
                                                        · {a.target}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="text-white/40">
                                                {a.actor ?? '—'} ·{' '}
                                                {timeAgo(a.created_at)}
                                            </div>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        </Panel>
                    )}

                    {!props.can.owner && (
                        <button
                            type="button"
                            onClick={() =>
                                confirm(
                                    tr(
                                        'Покинути сім’ю? Баланс залишиться в історії, але вивести його вже не вийде.',
                                    ),
                                ) && router.post(`${base}/leave`)
                            }
                            className="w-full rounded-2xl py-2 text-xs text-white/35 transition hover:text-rose-300"
                        >
                            {tr('Покинути сім’ю')}
                        </button>
                    )}
                </div>
            </div>
        </FamilyShell>
    );
}
