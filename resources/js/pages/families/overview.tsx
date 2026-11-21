import { OnboardingCard } from '@/components/families/onboarding-card';
import type { OnboardingCardData } from '@/components/families/onboarding-card';
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
import { DonationJarCard } from '@/components/gc/donation-jar';
import type { DonationJar } from '@/components/gc/donation-jar';
import { FamilyChatCard } from '@/components/families/family-chat-card';
import type { FamilyChatData } from '@/components/families/family-chat-card';
import { FamilyShell } from '@/components/families/family-shell';
import { InviteLinkButton } from '@/components/gc/invite-link';
import { VoiceRooms } from '@/components/gc/voice-rooms';
import { ListenRoomButton } from '@/components/music/listen-room-button';
import { Amount, Metric, Panel, kyivDateTime } from '@/components/families/ui';
import { timeAgo } from '@/lib/format';
import { uah, uahShort } from '@/lib/money';
import { cn } from '@/lib/utils';
import type {
    AuditEntry,
    FamilyShellProps,
    LeaderboardRow,
    LedgerEntry,
} from '@/types';
import { tr } from '@/lib/i18n';
import { WeeklyGoalsCard } from '@/components/families/weekly-goals';
import { LiveBlock } from '@/components/lobby/bento-feed';
import type { WeeklyGoal } from '@/components/families/weekly-goals';

type Props = FamilyShellProps & {
    onboarding?: OnboardingCardData | null;
    stats: {
        week_earned: number;
        week_total: number;
        pending_reports: number;
        warns: number;
        warn_limit: number;
    };
    leaders: LeaderboardRow[];
    goals?: WeeklyGoal[];
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
    /** Чат сім’ї: сьогодні, останні повідомлення, ШІ-підсумок. */
    chat?: FamilyChatData | null;
    /** Банка Monobank сім’ї (відкладений проп). */
    donation?: DonationJar | null;
};

const medals = ['🥇', '🥈', '🥉'];

export default function FamilyOverview(props: Props) {
    const { family, stats, events, transactions, low_stock, activity } = props;
    const leaders = props.leaders.filter((row) => row.points > 0);
    const base = `/f/${family.slug}`;

    return (
        <FamilyShell {...props} title={tr('Огляд')}>
            {/* Огляд сім’ї — мозаїка живих блоків, як лобі: мітка у вирізі, порожнє не показуємо. */}
            <div className="gc-bento gc-lobby-bento">
                <LiveBlock wide badge={tr('Тиждень')}>
                    <div className="grid grid-cols-2 gap-2 p-4 lg:grid-cols-4">
                        <Metric
                            label={tr('Заробив за тиждень')}
                            value={uahShort(stats.week_earned)}
                            tone="text-emerald-400"
                            icon={TrendingUp}
                        />
                        <Metric
                            label={tr('Виплати сім’ї')}
                            value={uahShort(stats.week_total)}
                            icon={Wallet}
                        />
                        <Metric
                            label={tr('Мої звіти на перевірці')}
                            value={stats.pending_reports}
                            tone="text-amber-400"
                            icon={Clock3}
                        />
                        <Metric
                            label={tr('Попередження')}
                            value={`${stats.warns}/${stats.warn_limit}`}
                            tone={
                                stats.warns > 0 ? 'text-red-400' : 'text-white'
                            }
                            icon={AlertTriangle}
                        />
                    </div>
                </LiveBlock>

                <LiveBlock badge={tr('Звіт')} tone="accent">
                    <Link
                        href={`${base}/reports?new=1`}
                        className="flex items-center gap-3 p-4"
                    >
                        <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-amber-400/15 text-amber-400">
                            <FilePlus2 className="size-6" />
                        </span>
                        <span className="min-w-0">
                            <span className="block text-[15px] font-semibold">
                                {tr('Подати звіт')}
                            </span>
                            <span className="block text-sm text-[var(--gc-text-2)]">
                                {tr(
                                    'Бізвар, контракти, інвестиція — за себе чи за друга',
                                )}
                            </span>
                        </span>
                    </Link>
                </LiveBlock>

                {props.onboarding && (
                    <LiveBlock wide badge={tr('Перші кроки')} tone="accent">
                        <OnboardingCard base={base} data={props.onboarding} />
                    </LiveBlock>
                )}

                <LiveBlock badge={tr('Голос')} tone="live">
                    <VoiceRooms
                        owner={{ type: 'family', id: family.id }}
                        label={`[${family.tag}] ${family.name}`}
                        href={`/f/${family.slug}`}
                    />
                    <div className="px-4 pb-4">
                        <ListenRoomButton group="family" id={family.id} />
                    </div>
                </LiveBlock>

                {props.chat && (
                    <LiveBlock badge={tr('Чат')} tone="accent">
                        <FamilyChatCard chat={props.chat} tag={family.tag} />
                    </LiveBlock>
                )}

                {events.length > 0 && (
                    <LiveBlock badge={tr('Події')} tone="accent">
                        <Panel
                            title={tr('Найближчі події')}
                            icon={CalendarDays}
                            actions={
                                family.sections?.events !== false && (
                                    <Link
                                        href={`${base}/events`}
                                        className="text-xs font-semibold text-[var(--gc-accent)]"
                                    >
                                        {tr('Усі')}
                                    </Link>
                                )
                            }
                        >
                            <ul className="space-y-2">
                                {events.map((e) => (
                                    <li
                                        key={e.id}
                                        className="gc-solid-2 flex items-center gap-3 rounded-xl px-3 py-2.5"
                                    >
                                        <CalendarDays className="size-4 text-[var(--gc-accent)]" />
                                        <div className="min-w-0 flex-1">
                                            <div className="truncate text-sm font-medium">
                                                {e.title}
                                            </div>
                                            <div className="text-xs text-[var(--gc-text-2)]">
                                                {e.type_label} ·{' '}
                                                {kyivDateTime(e.starts_at)}
                                            </div>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        </Panel>
                    </LiveBlock>
                )}

                {(props.goals?.length ?? 0) > 0 && (
                    <LiveBlock badge={tr('Цілі')}>
                        <WeeklyGoalsCard
                            goals={props.goals ?? []}
                            settingsHref={
                                props.can['settings.manage']
                                    ? `${base}/settings`
                                    : null
                            }
                        />
                    </LiveBlock>
                )}

                {leaders.length > 0 && (
                    <LiveBlock badge={tr('Рейтинг')}>
                        <Panel
                            title={tr('Лідери тижня')}
                            icon={BarChart3}
                            actions={
                                family.sections?.rating !== false && (
                                    <Link
                                        href={`${base}/rating`}
                                        className="text-xs font-semibold text-[var(--gc-accent)]"
                                    >
                                        {tr('Усі')}
                                    </Link>
                                )
                            }
                        >
                            <ol className="space-y-1.5">
                                {leaders.map((row) => (
                                    <li
                                        key={row.id}
                                        className="gc-solid-2 flex items-center gap-3 rounded-xl px-3 py-2"
                                    >
                                        <span className="w-6 text-center text-sm">
                                            {medals[row.place - 1] ?? row.place}
                                        </span>
                                        <span className="min-w-0 flex-1 truncate font-mono text-sm">
                                            {row.display}
                                        </span>
                                        <span className="text-xs text-[var(--gc-text-2)]">
                                            {uah(row.earned)}
                                        </span>
                                        <span className="w-12 text-right font-bold text-amber-400 tabular-nums">
                                            {row.points}
                                        </span>
                                    </li>
                                ))}
                            </ol>
                        </Panel>
                    </LiveBlock>
                )}

                {low_stock.length > 0 && (
                    <LiveBlock badge={tr('Склад')} tone="alert">
                        <Panel
                            title={tr('Закінчується на складі')}
                            icon={Package}
                        >
                            <ul className="space-y-1.5">
                                {low_stock.map((i) => (
                                    <li
                                        key={i.id}
                                        className="flex items-center justify-between rounded-xl bg-red-500/[0.07] px-3 py-2 text-sm"
                                    >
                                        <span>{i.name}</span>
                                        <span className="font-mono text-red-400">
                                            {i.quantity}
                                            {i.unit ? ` ${i.unit}` : ''}{' '}
                                            {tr('/ мін.')} {i.min_stock}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        </Panel>
                    </LiveBlock>
                )}

                {transactions.length > 0 && (
                    <LiveBlock badge={tr('Банк')}>
                        <Panel
                            title={tr('Мої операції')}
                            icon={Wallet}
                            actions={
                                <Link
                                    href={`${base}/bank`}
                                    className="text-xs font-semibold text-[var(--gc-accent)]"
                                >
                                    {tr('Усі')}
                                </Link>
                            }
                        >
                            <ul className="divide-y divide-[var(--gc-hairline)]">
                                {transactions.map((t) => (
                                    <li
                                        key={t.id}
                                        className="flex items-center gap-3 py-2"
                                    >
                                        <div className="min-w-0 flex-1">
                                            <div className="text-sm">
                                                {t.type_label}
                                            </div>
                                            <div className="truncate text-xs text-[var(--gc-text-2)]">
                                                {t.comment ??
                                                    timeAgo(t.created_at)}
                                            </div>
                                        </div>
                                        <Amount value={t.amount} />
                                    </li>
                                ))}
                            </ul>
                        </Panel>
                    </LiveBlock>
                )}

                {activity.length > 0 && (
                    <LiveBlock badge={tr('Журнал')}>
                        <Panel
                            title={tr('Остання активність')}
                            icon={ScrollText}
                            actions={
                                <Link
                                    href={`${base}/audit`}
                                    className="text-xs font-semibold text-[var(--gc-accent)]"
                                >
                                    {tr('Усі')}
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
                                                    ? 'bg-red-400'
                                                    : 'bg-emerald-400',
                                            )}
                                        />
                                        <div className="min-w-0 text-xs">
                                            <div>
                                                <span className="font-semibold">
                                                    {a.action_label}
                                                </span>
                                                {a.target && (
                                                    <span className="font-mono">
                                                        {' '}
                                                        · {a.target}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="text-[var(--gc-text-2)]">
                                                {a.actor ?? '—'} ·{' '}
                                                {timeAgo(a.created_at)}
                                            </div>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        </Panel>
                    </LiveBlock>
                )}

                <LiveBlock badge={tr('Банка')}>
                    <DonationJarCard
                        jar={props.donation}
                        title={tr('Підтримати сім’ю')}
                    />
                </LiveBlock>
            </div>

            <div className="flex flex-wrap items-center gap-3">
                {props.can['members.manage'] && (
                    <InviteLinkButton
                        url={`${base}/invite-link`}
                        className="gc-ghost-btn"
                    />
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
                        className="ml-auto text-xs text-[var(--gc-text-2)] transition hover:text-red-400"
                    >
                        {tr('Покинути сім’ю')}
                    </button>
                )}
            </div>
        </FamilyShell>
    );
}
